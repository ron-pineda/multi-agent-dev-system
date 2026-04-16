#!/usr/bin/env node
/**
 * Dashboard Server — Git Observatory
 *
 * Derives all project state from git history. tasks.json is auto-generated
 * from commits, not maintained by agents. Agent profiles parsed from .md files.
 *
 * Endpoints:
 *   GET  /api/state          Main dashboard state (projects, alerts, actions, timeline)
 *   GET  /api/agents         Agent roster with activity stats
 *   GET  /api/briefing/:name Project briefing as markdown
 *   POST /api/task/approve   Approve a proposed task
 *   POST /api/task/comment   Add a note to a task
 *   GET  /                   Serve dashboard HTML
 *   GET  /*.css|*.js         Serve static assets
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT       = 3737;
const ROOT       = path.join(__dirname, '..');
const PROJECTS   = path.join(ROOT, 'projects');
const AGENTS_DIR = path.join(ROOT, 'agents');
const DASH_DIR   = __dirname;

const read     = p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists   = p => { try { fs.accessSync(p); return true; } catch { return false; } };

// ─── Git Parsing ──────────────────────────────────────────────────────────────

function getGitLog(cwd, limit = 500) {
  try {
    const raw = execSync(`git log --format="%H|%aI|%s" -${limit}`, {
      cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 10000
    });
    return raw.trim().split('\n').filter(Boolean).map(line => {
      const idx1 = line.indexOf('|');
      const idx2 = line.indexOf('|', idx1 + 1);
      return {
        hash: line.substring(0, idx1),
        date: line.substring(idx1 + 1, idx2),
        message: line.substring(idx2 + 1)
      };
    });
  } catch { return []; }
}

function extractSprint(message) {
  const m = message.match(/\bSprint\s+([\d]+\.[\d]+)/i);
  return m ? m[1] : null;
}

// ─── Agent Parsing ────────────────────────────────────────────────────────────

const DEPT_MAP = {
  'PM': 'build', 'Architect': 'build', 'Frontend Engineer': 'build',
  'Backend Engineer': 'build', 'Database Engineer': 'build', 'Mobile': 'build',
  'AI Engineer': 'build', 'Designer': 'build', 'Integrations': 'build',
  'QA': 'quality', 'Reviewer': 'quality', 'Doc Writer': 'quality',
  'Security': 'quality', 'Performance': 'quality',
  'DevOps': 'ops', 'SRE': 'ops', 'Analytics': 'ops',
  'Finance': 'ops', 'Legal': 'ops', 'Chief of Staff': 'ops',
  'Growth': 'growth', 'Brand': 'growth', 'Copywriter': 'growth',
  'Content': 'growth', 'Customer Success': 'growth',
  'Strategist': 'business', 'Research': 'business', 'Sales': 'business'
};

const AGENT_NAMES = {
  'AIEngineer': 'AI Engineer', 'Analytics': 'Analytics', 'Architect': 'Architect',
  'Backend': 'Backend Engineer', 'Brand': 'Brand', 'ChiefOfStaff': 'Chief of Staff',
  'Content': 'Content', 'Copywriter': 'Copywriter', 'CustomerSuccess': 'Customer Success',
  'Database': 'Database Engineer', 'Designer': 'Designer', 'DevOps': 'DevOps',
  'DocWriter': 'Doc Writer', 'Finance': 'Finance', 'Frontend': 'Frontend Engineer',
  'Growth': 'Growth', 'Integrations': 'Integrations', 'Legal': 'Legal',
  'Mobile': 'Mobile', 'Performance': 'Performance', 'PM': 'PM', 'QA': 'QA',
  'Research': 'Research', 'Reviewer': 'Reviewer', 'Sales': 'Sales',
  'Security': 'Security', 'SRE': 'SRE', 'Strategist': 'Strategist',
};

function parseAgentFile(filePath) {
  const content = read(filePath);
  if (!content) return null;

  const rawName = path.basename(filePath, '.md');
  const name = AGENT_NAMES[rawName] || rawName;
  const lines = content.split('\n');

  // Extract role
  let role = '';
  let inRole = false;
  for (const line of lines) {
    if (/^##\s+Role/i.test(line)) { inRole = true; continue; }
    if (inRole && /^##\s/.test(line)) break;
    if (inRole && line.trim()) { role = line.trim(); break; }
  }

  // Extract model
  let model = 'Sonnet';
  let pastModelHeader = false;
  for (const line of lines) {
    if (/^##\s+Model/i.test(line)) { pastModelHeader = true; continue; }
    if (pastModelHeader && line.trim()) {
      const mm = line.match(/\b(Sonnet|Opus|Haiku)\b/i);
      if (mm) model = mm[1].charAt(0).toUpperCase() + mm[1].slice(1).toLowerCase();
      break;
    }
  }

  // Extract boundaries
  const boundaries = [];
  let inDont = false;
  for (const line of lines) {
    if (/What You Don.t Do/i.test(line)) { inDont = true; continue; }
    if (inDont && /^##\s/.test(line)) break;
    if (inDont && line.startsWith('-')) {
      boundaries.push(line.replace(/^-\s*/, '').trim());
    }
  }

  return {
    name,
    role,
    model,
    department: DEPT_MAP[name] || 'other',
    boundaries: boundaries.slice(0, 5),
  };
}

function loadAgents() {
  try {
    const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    return files.map(f => parseAgentFile(path.join(AGENTS_DIR, f))).filter(Boolean);
  } catch { return []; }
}

// ─── Handoff Parsing ──────────────────────────────────────────────────────────

function parseHandoffPatterns(handoffsContent) {
  const patterns = {};
  const re = /(\w[\w\s]*?)\s*[→>]+\s*(\w[\w\s]*?):/g;
  let m;
  while ((m = re.exec(handoffsContent)) !== null) {
    const from = m[1].trim();
    const to = m[2].trim();
    if (from === 'Dashboard' || from === 'sync') continue;
    const key = `${from} → ${to}`;
    patterns[key] = (patterns[key] || 0) + 1;
  }
  return patterns;
}

// ─── Project Loading ──────────────────────────────────────────────────────────

function loadProject(name) {
  const base     = path.join(PROJECTS, name);
  const stateDir = path.join(base, '.agent-state');
  if (!exists(stateDir)) return null;

  const sprints    = readJSON(path.join(stateDir, 'sprints.json')) || [];
  const tasks      = readJSON(path.join(stateDir, 'tasks.json')) || [];
  const handoffs   = read(path.join(stateDir, 'handoffs.md')) || '';
  const commits    = getGitLog(base);

  // Sprint commits map
  const sprintCommits = {};
  for (const c of commits) {
    const sid = extractSprint(c.message);
    if (sid) {
      if (!sprintCommits[sid]) sprintCommits[sid] = [];
      sprintCommits[sid].push(c);
    }
  }

  // Supplement sprints.json with any sprint IDs seen in tasks or git commits
  // Agents add tasks for new sprints before updating sprints.json
  const knownIds = new Set(sprints.map(s => s.id));
  const extraIds = new Set([
    ...tasks.map(t => t.sprint).filter(Boolean),
    ...Object.keys(sprintCommits),
  ]);
  for (const id of extraIds) {
    if (!knownIds.has(id)) {
      // Infer phase from id (e.g. "7.1" → phase 7)
      const phase = parseInt(id.split('.')[0], 10) || null;
      sprints.push({ id, phase, name: `Sprint ${id}` });
      knownIds.add(id);
    }
  }
  // Sort sprints by id numerically (e.g. 5.4, 6.1, 7.2)
  sprints.sort((a, b) => {
    const [am, an] = a.id.split('.').map(Number);
    const [bm, bn] = b.id.split('.').map(Number);
    return am !== bm ? am - bm : an - bn;
  });

  // Sprint list with git-derived status
  const sprintList = sprints.map(s => {
    const sc = sprintCommits[s.id] || [];
    const sprintTasks = tasks.filter(t => t.sprint === s.id);
    const doneTasks = sprintTasks.filter(t => ['done', 'abandoned'].includes(t.status));
    const openTasks = sprintTasks.filter(t => !['done', 'abandoned'].includes(t.status));

    let status;
    if (sc.length > 0 && openTasks.length === 0) status = 'done';
    else if (sc.length > 0) status = 'active';
    else if (sprintTasks.length > 0 && doneTasks.length === sprintTasks.length) status = 'done';
    else if (sprintTasks.length > 0) status = 'active';
    else status = 'planned';

    return {
      id: s.id, phase: s.phase, name: s.name || `Sprint ${s.id}`,
      features: s.features || 0, size: s.size || '?', status,
      commits: sc.length,
      tasks: { total: sprintTasks.length, done: doneTasks.length, open: openTasks.length },
      firstCommit: sc.length ? sc[sc.length - 1].date : null,
      lastCommit: sc.length ? sc[0].date : null,
    };
  });

  // Phases
  const phaseSet = [...new Set(sprints.map(s => s.phase))].sort((a, b) => a - b);
  const phasesComplete = phaseSet.filter(p =>
    sprintList.filter(s => s.phase === p).every(s => s.status === 'done')
  ).length;

  const currentSprint = sprintList.find(s => s.status === 'active') || null;
  const nextSprint = sprintList.find(s => s.status === 'planned') || null;

  // Health scores
  const doneSprints = sprintList.filter(s => s.status === 'done');
  const coverage = sprintList.length > 0 ? Math.round((doneSprints.length / sprintList.length) * 5) : 0;

  const lastCommit = commits[0] || null;
  let momentum = 0;
  if (lastCommit) {
    const h = (Date.now() - new Date(lastCommit.date).getTime()) / 3600000;
    momentum = h < 1 ? 5 : h < 6 ? 4 : h < 24 ? 3 : h < 72 ? 2 : h < 168 ? 1 : 0;
  }

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const velocity = Math.min(5, doneSprints.filter(s => s.lastCommit && s.lastCommit > weekAgo).length);

  const recent30 = commits.slice(0, 30);
  const fixCount = recent30.filter(c => /^fix/i.test(c.message)).length;
  const stability = recent30.length > 0 ? Math.max(0, 5 - Math.round((fixCount / recent30.length) * 8)) : 3;

  // Trend: compare commits this week vs previous week
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const thisWeekCommits = commits.filter(c => c.date > weekAgo).length;
  const prevWeekCommits = commits.filter(c => c.date > twoWeeksAgo && c.date <= weekAgo).length;
  const trend = thisWeekCommits > prevWeekCommits ? 'up'
    : thisWeekCommits < prevWeekCommits ? 'down' : 'flat';

  const health = {
    coverage, momentum, velocity, stability,
    overall: Math.round(((coverage + momentum + velocity + stability) / 4) * 10) / 10,
    trend,
  };

  // Pipeline — derive stages from git commit messages
  const codeComplete = sprintList.length > 0 && doneSprints.length === sprintList.length;

  const deployCommit = commits.find(c => /\b(deploy|redeploy|go.?live|production|released?\s+to\s+prod)/i.test(c.message));
  const buildCommit  = deployCommit || commits.find(c => /\b(build|bundle|compile|vercel|ci:|github.actions)/i.test(c.message));

  const pipeline = {
    code:   codeComplete ? 'complete' : (currentSprint ? 'active' : 'not-started'),
    build:  buildCommit  ? 'complete' : (codeComplete ? 'active' : null),
    deploy: deployCommit ? 'complete' : null,
    config: { missing: [] },
    lastDeploy: deployCommit ? { hash: deployCommit.hash.substring(0, 7), message: deployCommit.message, date: deployCommit.date } : null,
  };

  // Agent stats
  const agentStats = {};
  for (const t of tasks) {
    const agent = t.assigned_agent;
    if (!agent) continue;
    if (!agentStats[agent]) agentStats[agent] = { tasks: 0, done: 0, sprints: new Set() };
    agentStats[agent].tasks++;
    if (['done', 'abandoned'].includes(t.status)) agentStats[agent].done++;
    if (t.sprint) agentStats[agent].sprints.add(t.sprint);
  }

  // Timeline grouped by sprint
  const timeline = [];
  for (const [sid, sc] of Object.entries(sprintCommits)) {
    const sprint = sprints.find(s => s.id === sid);
    const agents = [...new Set(tasks.filter(t => t.sprint === sid).map(t => t.assigned_agent).filter(Boolean))];
    timeline.push({
      sprintId: sid,
      sprintName: sprint?.name || `Sprint ${sid}`,
      phase: sprint?.phase,
      project: name,
      agents,
      commits: sc.map(c => ({ hash: c.hash.substring(0, 7), message: c.message, date: c.date })),
      firstCommit: sc[sc.length - 1].date,
      lastCommit: sc[0].date,
    });
  }
  timeline.sort((a, b) => b.lastCommit.localeCompare(a.lastCommit));

  const handoffPatterns = parseHandoffPatterns(handoffs);

  // Sparkline: daily commit counts for last 7 days
  const sparkline = Array(7).fill(0);
  const now = new Date();
  for (const c of commits) {
    const daysAgo = Math.floor((now - new Date(c.date)) / 86400000);
    if (daysAgo >= 0 && daysAgo < 7) sparkline[6 - daysAgo]++;
  }

  return {
    name,
    phases: { total: phaseSet.length, complete: phasesComplete },
    sprints: {
      total: sprintList.length, complete: doneSprints.length,
      current: currentSprint ? { id: currentSprint.id, name: currentSprint.name } : null,
      next: nextSprint ? { id: nextSprint.id, name: nextSprint.name, features: nextSprint.features, size: nextSprint.size } : null,
      list: sprintList,
    },
    health, pipeline, sparkline,
    lastCommit: lastCommit ? { hash: lastCommit.hash.substring(0, 7), message: lastCommit.message, date: lastCommit.date } : null,
    totalCommits: commits.length,
    tasks: {
      total: tasks.length,
      done: tasks.filter(t => t.status === 'done').length,
      open: tasks.filter(t => !['done', 'abandoned'].includes(t.status)).length,
      byAgent: Object.fromEntries(
        Object.entries(agentStats).map(([k, v]) => [k, { tasks: v.tasks, done: v.done, sprints: v.sprints.size }])
      ),
    },
    timeline, handoffPatterns,
    rawTasks: tasks,
  };
}

// ─── Actions & Alerts ─────────────────────────────────────────────────────────

function loadActions() {
  const actions = [];
  const inbox = read(path.join(ROOT, 'INBOX.md')) || '';
  for (const line of inbox.split('\n')) {
    const m = line.match(/^-\s*\[([^\]]*)\]\s*(.*)/);
    if (m && m[1].trim() === '') {
      const pm = m[2].match(/^\[(\w+)\]\s*(.*)/);
      actions.push(pm
        ? { project: pm[1], text: pm[2].trim(), source: 'INBOX.md' }
        : { project: null, text: m[2].trim(), source: 'INBOX.md' }
      );
    }
  }
  return actions;
}

function computeAlerts(projects) {
  const alerts = [];
  for (const p of projects) {
    if (p.health.momentum === 0 && p.sprints.complete < p.sprints.total) {
      alerts.push({ project: p.name, text: 'No commits in 7+ days', severity: 'warning' });
    }
    if (p.health.stability <= 1 && p.totalCommits > 10) {
      alerts.push({ project: p.name, text: 'High fix-commit ratio — may be unstable', severity: 'warning' });
    }
  }
  return alerts;
}

// ─── Recommendation ──────────────────────────────────────────────────────────

function computeRecommendation(projects) {
  const active = projects.filter(p => p.sprints.current);
  const stale  = projects.filter(p =>
    p.sprints.complete < p.sprints.total && p.health.momentum === 0
  );

  // Best active project: highest velocity + recent commits
  if (active.length) {
    const best = active.sort((a, b) =>
      (b.health.velocity + b.health.momentum) - (a.health.velocity + a.health.momentum)
    )[0];
    const sprint = best.sprints.current;
    return {
      project: best.name,
      text: `${best.name} has momentum — sprint ${sprint.id} (${sprint.name}) is in progress.`,
      action: 'Continue',
    };
  }

  // Stale project that needs attention
  if (stale.length) {
    const p = stale[0];
    return {
      project: p.name,
      text: `${p.name} has been idle for 7+ days — ${p.sprints.total - p.sprints.complete} sprints remain.`,
      action: 'Resume',
    };
  }

  // All done
  return { project: null, text: 'All projects are complete or planned.', action: null };
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────

function loadRoadmap() {
  const content = read(path.join(ROOT, 'ROADMAP.md'));
  if (!content) return [];
  const items = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^\d+\.\s+\*\*(\w[\w\s-]*?)\*\*\s*[—-]\s*(.*)/);
    if (m) {
      const sm = m[2].match(/`(\w[\w\s-]*?)`/);
      items.push({
        project: m[1].trim(),
        description: m[2].replace(/`[^`]*`/g, '').replace(/\(.*?\)/g, '').trim(),
        status: sm ? sm[1].trim() : 'unknown'
      });
    }
  }
  return items;
}

// ─── Briefing ─────────────────────────────────────────────────────────────────

function generateBriefing(project) {
  const p = project;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
  let md = `# ${p.name} — Briefing (${now})\n\n`;

  md += `## Status\n`;
  if (p.sprints.complete === p.sprints.total) {
    md += `All ${p.sprints.total} sprints complete (Phase ${p.phases.complete}/${p.phases.total}). Code is finished.\n\n`;
  } else {
    md += `${p.sprints.complete}/${p.sprints.total} sprints complete.\n`;
    if (p.sprints.current) md += `Current: ${p.sprints.current.id} — ${p.sprints.current.name}\n`;
    if (p.sprints.next) md += `Next: ${p.sprints.next.id} — ${p.sprints.next.name}\n`;
    md += '\n';
  }

  md += `## Recent Activity\n`;
  for (const t of p.timeline.slice(0, 5)) {
    const d = new Date(t.lastCommit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    md += `- Sprint ${t.sprintId} (${t.sprintName}): ${t.commits.length} commits, ${d}\n`;
  }
  if (p.lastCommit) md += `\nLast commit: \`${p.lastCommit.message}\` (${p.lastCommit.hash})\n`;
  md += '\n';

  md += `## Health\n`;
  md += `Velocity: ${p.health.velocity}/5 · Momentum: ${p.health.momentum}/5 · Stability: ${p.health.stability}/5 · Coverage: ${p.health.coverage}/5\n\n`;

  md += `## Task Distribution\n`;
  for (const [agent, stats] of Object.entries(p.tasks.byAgent)) {
    md += `- ${agent}: ${stats.done} tasks, ${stats.sprints} sprints\n`;
  }
  md += '\n';

  md += `## Next Action\n`;
  if (p.sprints.complete === p.sprints.total) {
    md += `All sprints complete. Verify deployment and config.\n`;
  } else if (p.sprints.next) {
    md += `Kick off Sprint ${p.sprints.next.id} — ${p.sprints.next.name} (${p.sprints.next.features} features, ${p.sprints.next.size})\n`;
  }

  return md;
}

// ─── Agent Enrichment ─────────────────────────────────────────────────────────

function enrichAgents(agents, projects) {
  for (const agent of agents) {
    agent.stats = { tasksCompleted: 0, sprints: 0, recentWork: [] };
    const sprintSet = new Set();

    for (const p of projects) {
      const byAgent = p.tasks.byAgent[agent.name];
      if (byAgent) {
        agent.stats.tasksCompleted += byAgent.done;
      }
      for (const t of p.rawTasks) {
        if (t.assigned_agent === agent.name && t.sprint) sprintSet.add(t.sprint);
        if (t.assigned_agent === agent.name && t.status === 'done') {
          agent.stats.recentWork.push({
            project: p.name, sprint: t.sprint,
            sprintName: p.sprints.list.find(s => s.id === t.sprint)?.name || t.sprint,
            task: t.title,
          });
        }
      }
    }
    agent.stats.sprints = sprintSet.size;
    agent.stats.recentWork.sort((a, b) => (b.sprint || '').localeCompare(a.sprint || ''));
    agent.stats.recentWork = agent.stats.recentWork.slice(0, 5);

    // Open tasks across all projects
    agent.stats.openTasks = [];
    for (const p of projects) {
      for (const t of p.rawTasks) {
        if (t.assigned_agent === agent.name && !['done', 'abandoned'].includes(t.status)) {
          agent.stats.openTasks.push({ project: p.name, task: t.title, status: t.status, sprint: t.sprint });
        }
      }
    }

    // Current status
    agent.status = 'available';
    agent.currentTask = null;
    for (const p of projects) {
      const active = p.rawTasks.find(t => t.assigned_agent === agent.name && t.status === 'in-progress');
      if (active) {
        agent.status = 'working';
        agent.currentTask = { project: p.name, task: active.title, sprint: active.sprint };
        break;
      }
    }

    // Handoff patterns
    agent.handoffs = { receives: [], handsTo: [] };
    for (const p of projects) {
      for (const [key, count] of Object.entries(p.handoffPatterns)) {
        const [from, to] = key.split(' → ');
        if (to === agent.name && !agent.handoffs.receives.some(r => r.from === from)) {
          agent.handoffs.receives.push({ from, count });
        }
        if (from === agent.name && !agent.handoffs.handsTo.some(r => r.to === to)) {
          agent.handoffs.handsTo.push({ to, count });
        }
      }
    }
  }
  return agents;
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath) {
  const content = read(filePath);
  if (!content) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  res.end(content);
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API routes
  if (pathname === '/api/state' && req.method === 'GET') {
    let dirs;
    try { dirs = fs.readdirSync(PROJECTS, { withFileTypes: true }).filter(d => d.isDirectory()); }
    catch { return sendJSON(res, { ok: true, projects: [], actions: [], alerts: [], timeline: [], roadmap: [] }); }

    const projects = dirs.map(d => loadProject(d.name)).filter(Boolean);
    const actions = loadActions();
    const alerts = computeAlerts(projects);
    const roadmap = loadRoadmap();
    const timeline = projects.flatMap(p => p.timeline).sort((a, b) => b.lastCommit.localeCompare(a.lastCommit));

    const clean = projects.map(({ rawTasks, handoffPatterns, ...rest }) => rest);
    const recommendation = computeRecommendation(projects);

    return sendJSON(res, {
      ok: true, timestamp: new Date().toISOString(),
      projects: clean, actions, alerts, roadmap, recommendation,
      timeline: timeline.slice(0, 50),
    });
  }

  if (pathname === '/api/agents' && req.method === 'GET') {
    const agents = loadAgents();
    let dirs;
    try { dirs = fs.readdirSync(PROJECTS, { withFileTypes: true }).filter(d => d.isDirectory()); } catch { dirs = []; }
    const projects = dirs.map(d => loadProject(d.name)).filter(Boolean);
    return sendJSON(res, { ok: true, agents: enrichAgents(agents, projects) });
  }

  if (pathname.startsWith('/api/briefing/') && req.method === 'GET') {
    const projectName = decodeURIComponent(pathname.split('/')[3]);
    const project = loadProject(projectName);
    if (!project) return sendJSON(res, { error: 'Not found' }, 404);
    const md = generateBriefing(project);
    res.writeHead(200, { 'Content-Type': 'text/markdown', 'Access-Control-Allow-Origin': '*' });
    return res.end(md);
  }

  if (pathname === '/api/task/approve' && req.method === 'POST') {
    const { project, taskId } = await readBody(req);
    const tp = path.join(PROJECTS, project, '.agent-state', 'tasks.json');
    const tasks = readJSON(tp);
    if (!tasks) return sendJSON(res, { error: 'Not found' }, 404);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return sendJSON(res, { error: 'Task not found' }, 404);
    task.status = 'approved'; task.last_touched = new Date().toISOString();
    fs.writeFileSync(tp, JSON.stringify(tasks, null, 2));
    return sendJSON(res, { ok: true, task });
  }

  if (pathname === '/api/task/comment' && req.method === 'POST') {
    const { project, taskId, comment } = await readBody(req);
    const tp = path.join(PROJECTS, project, '.agent-state', 'tasks.json');
    const tasks = readJSON(tp);
    if (!tasks) return sendJSON(res, { error: 'Not found' }, 404);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return sendJSON(res, { error: 'Task not found' }, 404);
    if (!task.notes) task.notes = [];
    task.notes.push(`[${new Date().toISOString()}] Human: ${comment}`);
    task.last_touched = new Date().toISOString();
    fs.writeFileSync(tp, JSON.stringify(tasks, null, 2));
    return sendJSON(res, { ok: true, task });
  }

  if (pathname.startsWith('/api/notes/') && req.method === 'GET') {
    const projectName = decodeURIComponent(pathname.split('/')[3]);
    const notesPath = path.join(PROJECTS, projectName, '.agent-state', 'notes.md');
    const content = read(notesPath) || '';
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(content);
  }

  if (pathname.startsWith('/api/notes/') && req.method === 'POST') {
    const projectName = decodeURIComponent(pathname.split('/')[3]);
    const { content } = await readBody(req);
    const notesPath = path.join(PROJECTS, projectName, '.agent-state', 'notes.md');
    fs.writeFileSync(notesPath, content || '');
    return sendJSON(res, { ok: true });
  }

  if (pathname === '/api/action/complete' && req.method === 'POST') {
    const { text } = await readBody(req);
    const inboxPath = path.join(ROOT, 'INBOX.md');
    const inbox = read(inboxPath);
    if (!inbox) return sendJSON(res, { error: 'INBOX.md not found' }, 404);
    // Replace first unchecked line matching the text
    const updated = inbox.replace(
      new RegExp(`(^- \\[\\s*\\]\\s*(?:\\[\\w+\\]\\s*)?${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 40).replace(/\s+/g, '.*')}.*)`, 'm'),
      line => line.replace('[ ]', '[x]')
    );
    if (updated === inbox) return sendJSON(res, { error: 'Item not found' }, 404);
    fs.writeFileSync(inboxPath, updated);
    return sendJSON(res, { ok: true });
  }

  // Static files
  if (pathname === '/' || pathname === '/index.html') return serveStatic(res, path.join(DASH_DIR, 'index.html'));
  if (pathname === '/guide.html') return serveStatic(res, path.join(DASH_DIR, 'guide.html'));
  const staticFile = path.join(DASH_DIR, pathname.substring(1));
  if (exists(staticFile)) return serveStatic(res, staticFile);

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
