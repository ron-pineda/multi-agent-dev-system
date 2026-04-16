#!/usr/bin/env node
/**
 * sync-dashboard.js — git-based sprint sync
 *
 * Marks sprint tasks done by reading git commit messages.
 * Agents consistently write "Sprint X.Y" in every commit — that's the signal.
 *
 * Detection methods (in order of reliability):
 *   1. Git log — any commit mentioning "Sprint X.Y" marks that sprint's open tasks done
 *   2. Git log — commits mentioning a task ID (proj-s5.4-81) mark that task done
 *   3. Handoffs — "Reviewer → done: task-id" pattern (manual agent logs)
 *   4. Stale blocker cleanup — clears blockers on done/abandoned tasks
 *
 * Runs via UserPromptSubmit hook and git post-commit hook.
 *
 * Usage:  node scripts/sync-dashboard.js              (all projects)
 *         node scripts/sync-dashboard.js my-project   (one project)
 */

const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');

const ROOT     = path.join(__dirname, '..');
const PROJECTS = path.join(ROOT, 'projects');

const read     = p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

/**
 * Scan git log for sprint and task references.
 * Returns:
 *   sprintIds  — Set of sprint IDs that have at least one commit (e.g. "5.5", "6.1")
 *   taskIds    — Set of task IDs explicitly mentioned in commits (e.g. "pj-s5.4-81")
 */
function gitSignals(projectBase) {
  const sprintIds = new Set();
  const taskIds   = new Set();

  let log;
  try {
    log = execSync('git log --format=%s', { cwd: projectBase, encoding: 'utf8', stdio: ['pipe','pipe','ignore'] });
  } catch { return { sprintIds, taskIds }; }

  for (const line of log.split('\n')) {
    // Sprint reference: "Sprint 6.3" or "(Sprint 5.4)" or "sprint 5.4 task 2"
    const sprintRe = /\bSprint\s+([\d]+\.[\d]+)/gi;
    let m;
    while ((m = sprintRe.exec(line)) !== null) sprintIds.add(m[1]);

    // Task ID reference: "pj-s5.4-81" or similar pattern
    const taskRe = /\b([a-z]+-s[\d]+\.[\d]+-\d+)\b/gi;
    while ((m = taskRe.exec(line)) !== null) taskIds.add(m[1].toLowerCase());
  }

  return { sprintIds, taskIds };
}

function syncProject(name) {
  const base      = path.join(PROJECTS, name);
  const stateDir  = path.join(base, '.agent-state');
  const tasksPath = path.join(stateDir, 'tasks.json');
  const handoffs  = read(path.join(stateDir, 'handoffs.md')) || '';
  const tasks     = readJSON(tasksPath);
  if (!tasks) return null;

  let changed = false;
  const now   = new Date().toISOString();
  const fixes = [];

  const markDone = (task, reason) => {
    task.status = 'done'; task.last_touched = now;
    fixes.push(`${task.id}: → done (${reason})`);
    changed = true;
  };

  // 1. Git log — sprint-level: any commit mentioning Sprint X.Y closes that sprint's open tasks
  //    Only closes tasks that were started (not still in proposed)
  const { sprintIds, taskIds } = gitSignals(base);
  const openStatuses = new Set(['approved', 'in-progress', 'review', 'needs-rework']);

  for (const sprintId of sprintIds) {
    const open = tasks.filter(t => t.sprint === sprintId && openStatuses.has(t.status));
    for (const task of open) markDone(task, `git: Sprint ${sprintId} committed`);
  }

  // 2. Git log — task-level: commit explicitly names a task ID
  for (const taskId of taskIds) {
    const task = tasks.find(t => t.id === taskId);
    if (task && !['done', 'abandoned'].includes(task.status)) {
      markDone(task, `git: task ID in commit`);
    }
  }

  // 3. Handoffs — "Reviewer → done: task-id" (manual agent logs)
  const doneRe = /Reviewer\s*[→>-]+\s*done:\s*([\w-]+)/gi;
  let m;
  while ((m = doneRe.exec(handoffs)) !== null) {
    const task = tasks.find(t => t.id === m[1]);
    if (task && !['done', 'abandoned'].includes(task.status)) {
      markDone(task, 'Reviewer logged');
    }
  }

  // 4. Clear stale blockers on finished tasks
  for (const task of tasks) {
    if (['done', 'abandoned'].includes(task.status) && task.blockers?.length) {
      task.blockers = []; task.last_touched = now; changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
    fs.appendFileSync(path.join(stateDir, 'handoffs.md'),
      `\n[${now}] Dashboard sync — ${fixes.length} fix(es): ${fixes.join('; ')}\n`);
  }

  // Summary
  const sm = {};
  for (const t of tasks) {
    if (!t.sprint) continue;
    if (!sm[t.sprint]) sm[t.sprint] = { done: 0, open: 0 };
    ['done', 'abandoned'].includes(t.status) ? sm[t.sprint].done++ : sm[t.sprint].open++;
  }
  const active = Object.entries(sm).sort().find(([, v]) => v.open > 0);
  return {
    name,
    status: active ? `sprint ${active[0]} active — ${active[1].open} open` : 'all done',
    fixes
  };
}

const target  = process.argv[2];
const results = [];
if (target) {
  const r = syncProject(target); if (r) results.push(r);
} else {
  let dirs; try { dirs = fs.readdirSync(PROJECTS, { withFileTypes: true }).filter(d => d.isDirectory()); } catch { process.exit(0); }
  for (const d of dirs) { const r = syncProject(d.name); if (r) results.push(r); }
}

const fixed = results.filter(r => r.fixes.length);
if (fixed.length) { console.log('Dashboard sync fixed drift:'); fixed.forEach(r => console.log(`  [${r.name}] ${r.fixes.join('; ')}`)); }
const active = results.filter(r => r.status.includes('active'));
if (active.length) { console.log('Active sprints:'); active.forEach(r => console.log(`  [${r.name}] ${r.status}`)); }
