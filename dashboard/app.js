// ── Config ───────────────────────────────────────────────────
const STATE_INTERVAL  = 15_000;
const AGENTS_INTERVAL = 30_000;

const DEPT_ORDER = ['Build', 'Quality', 'Operations', 'Growth', 'Business'];

const DEPT_MAP = {
  'Build':      ['PM', 'Architect', 'Frontend Engineer', 'Backend Engineer',
                 'Database Engineer', 'Mobile', 'AI Engineer', 'Designer', 'Integrations'],
  'Quality':    ['QA', 'Reviewer', 'Doc Writer', 'Security', 'Performance'],
  'Operations': ['DevOps', 'SRE', 'Analytics', 'Finance', 'Legal', 'Chief of Staff'],
  'Growth':     ['Growth', 'Brand', 'Copywriter', 'Content', 'Customer Success'],
  'Business':   ['Strategist', 'Research', 'Sales'],
};

// ── Module State ─────────────────────────────────────────────
let stateData     = null;
let agentsData    = null;
let syncTime      = null;
let firstRender   = true;
let lastVisit     = localStorage.getItem('lastVisit') || null;
let toastTimer    = null;
let cmdOpen       = false;
let cmdIdx        = -1;
let cmdItems      = [];
let selectedProjectName = null;
let selectedAgentName   = null;
const notesCache = {}; // projectName → note text

// ── Helpers ──────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const escHtml = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function relTime(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60)     return 'just now';
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

function agentAbbr(name) {
  const map = {
    'PM': 'PM', 'Architect': 'AR', 'Frontend Engineer': 'FE',
    'Backend Engineer': 'BE', 'Database Engineer': 'DB',
    'QA': 'QA', 'Reviewer': 'RV', 'Doc Writer': 'DW',
    'Mobile': 'MB', 'AI Engineer': 'AI', 'Designer': 'DS',
    'Integrations': 'IN', 'Research': 'RS', 'Security': 'SC',
    'Performance': 'PF', 'DevOps': 'DO', 'SRE': 'SR',
    'Analytics': 'AN', 'Finance': 'FN', 'Legal': 'LG',
    'Chief of Staff': 'CS', 'Growth': 'GR', 'Brand': 'BR',
    'Copywriter': 'CW', 'Content': 'CN', 'Customer Success': 'CU',
    'Strategist': 'ST', 'Sales': 'SL',
  };
  return map[name] || name.slice(0, 2).toUpperCase();
}

function agentBadgeClass(name) {
  const map = {
    'PM': 'pm', 'Architect': 'arch', 'Frontend Engineer': 'fe',
    'Backend Engineer': 'be', 'Database Engineer': 'db',
    'QA': 'qa', 'Reviewer': 'rev', 'Doc Writer': 'doc',
    'Mobile': 'be', 'AI Engineer': 'be', 'Designer': 'be',
    'Integrations': 'be', 'Research': 'be',
    'Security': 'qa', 'Performance': 'qa',
    'DevOps': 'db', 'SRE': 'db', 'Analytics': 'db',
    'Finance': 'db', 'Legal': 'db', 'Chief of Staff': 'db',
    'Growth': 'rev', 'Brand': 'rev', 'Copywriter': 'rev',
    'Content': 'rev', 'Customer Success': 'rev',
    'Strategist': 'arch', 'Sales': 'arch',
  };
  return map[name] || 'doc';
}

function deptBadgeClass(dept) {
  const map = {
    'Build': 'build', 'Quality': 'quality',
    'Operations': 'ops', 'Growth': 'growth', 'Business': 'business',
  };
  return map[dept] || 'build';
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.removeAttribute('hidden');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.setAttribute('hidden', ''), 300);
  }, 3000);
}

// ── Favicon ──────────────────────────────────────────────────
function updateFavicon(alerts, hasActive) {
  let fill;
  if (alerts && alerts.length) fill = '%23ef4444';       // red
  else if (hasActive)          fill = '%23f59e0b';       // amber
  else                         fill = '%2334d399';       // green
  $('favicon').href =
    `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='${fill}'/></svg>`;
}

// ── Sync Status ──────────────────────────────────────────────
function updateSyncStatus() {
  if (!syncTime) return;
  const s = Math.round((Date.now() - syncTime) / 1000);
  $('syncStatus').textContent = s < 5 ? 'Synced' : `Synced ${s}s ago`;
}

// ── Since Last Visit ─────────────────────────────────────────
function renderSinceVisit() {
  const section = $('since-section');
  const banner  = $('sinceVisit');

  if (!lastVisit || !stateData?.timeline) {
    section.dataset.empty = 'true';
    return;
  }

  const cutoff = new Date(lastVisit);
  const newSprints = stateData.timeline.filter(entry => {
    return entry.lastCommit && new Date(entry.lastCommit) > cutoff;
  });

  if (!newSprints.length) {
    section.dataset.empty = 'true';
    return;
  }

  delete section.dataset.empty;
  banner.innerHTML = newSprints.map(entry => `
    <div class="since-item">
      <span class="since-check">&#10003;</span>
      <span class="since-text">Sprint ${escHtml(entry.sprintId)} completed &mdash; ${escHtml(entry.sprintName)}</span>
    </div>`).join('');
}

// ── Recommendation ────────────────────────────────────────────
function renderRecommendation() {
  const rec     = stateData?.recommendation;
  const section = $('rec-section');
  const banner  = $('recBanner');

  if (!rec || !rec.project) {
    section.dataset.empty = 'true';
    return;
  }

  delete section.dataset.empty;
  // Bold the project name in the text
  const highlighted = escHtml(rec.text).replace(
    escHtml(rec.project),
    `<strong>${escHtml(rec.project)}</strong>`
  );
  banner.innerHTML = `
    <span class="rec-text">${highlighted}</span>
    ${rec.action ? `<button class="rec-btn" data-rec-project="${escHtml(rec.project)}">${escHtml(rec.action)}</button>` : ''}`;
}

// ── Alerts ───────────────────────────────────────────────────
function renderAlerts() {
  const alerts  = stateData?.alerts || [];
  const section = $('alerts-section');
  const list    = $('alertsList');

  // Update nav badge
  const badge = $('navAlertCount');
  if (alerts.length) {
    badge.textContent = alerts.length;
    badge.removeAttribute('hidden');
  } else {
    badge.setAttribute('hidden', '');
  }

  if (!alerts.length) {
    section.dataset.empty = 'true';
    return;
  }

  delete section.dataset.empty;
  list.innerHTML = alerts.map(a => `
    <div class="alert-card" data-severity="${escHtml(a.severity || 'warning')}">
      <div class="alert-text">${escHtml(a.text)}</div>
      <div class="alert-project">${escHtml(a.project)}</div>
    </div>`).join('');
}

// ── Actions ──────────────────────────────────────────────────
function renderActions() {
  const actions = stateData?.actions || [];
  const section = $('actions-section');
  const list    = $('actionsList');

  if (!actions.length) {
    section.dataset.empty = 'true';
    return;
  }

  delete section.dataset.empty;
  list.innerHTML = actions.map((a, i) => `
    <div class="action-item" data-action-idx="${i}">
      <input type="checkbox" class="action-checkbox" data-action-text="${escHtml(a.text)}" title="Mark done">
      <div style="flex:1;min-width:0">
        <span class="action-text">${escHtml(a.text)}</span>
        <div class="action-meta">${escHtml(a.project || '')}${a.project ? ' &middot; ' : ''}${escHtml(a.source)}</div>
      </div>
    </div>`).join('');
}

// ── Project Cards ────────────────────────────────────────────
function projectStatus(p) {
  const { sprints } = p;
  if (!sprints || sprints.total === 0) return 'planned';
  if (sprints.complete === sprints.total) return 'complete';
  if (sprints.current) return 'active';
  return 'planned';
}

function renderProjectCard(p) {
  const status    = projectStatus(p);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const sprints   = p.sprints || {};
  const total     = sprints.total || 0;
  const complete  = sprints.complete || 0;
  const pct       = total > 0 ? Math.round((complete / total) * 100) : 0;
  const health    = p.health || {};
  const dots      = Math.round(health.overall || 0);
  const commit    = p.lastCommit;
  const tasks     = p.tasks || {};

  const trendArrow = { up: '\u2197', down: '\u2198', flat: '\u2192' }[health.trend] || '';
  const trendClass = { up: 'trend-up', down: 'trend-down', flat: 'trend-flat' }[health.trend] || '';

  const healthDots = Array.from({ length: 5 }, (_, i) =>
    `<div class="health-dot ${i < dots ? 'active' : ''}"></div>`).join('')
    + (trendArrow ? `<span class="health-trend ${trendClass}">${trendArrow}</span>` : '');

  const spark = p.sparkline || [];
  const sparkMax = Math.max(...spark, 1);
  const sparkBars = spark.map(v =>
    `<div class="spark-bar" style="height:${Math.max(Math.round((v / sparkMax) * 100), v > 0 ? 8 : 2)}%"></div>`
  ).join('');

  const commitLine = commit
    ? `<div class="project-commit mono">${escHtml(commit.hash)} &middot; ${escHtml(commit.message)}</div>`
    : '';

  const lastActive = commit?.date ? relTime(commit.date) : '';

  // Stale: active project with no commits in 3+ days
  const daysSince = commit?.date ? (Date.now() - new Date(commit.date)) / 86400000 : 999;
  const isStale   = status === 'active' && daysSince >= 3;

  const metaLine = tasks.total
    ? `<div class="project-meta">${tasks.done}/${tasks.total} tasks &middot; ${p.totalCommits || 0} commits</div>`
    : '';

  return `
<div class="project-card" data-project="${escHtml(p.name)}" tabindex="0" ${isStale ? 'data-stale="true"' : ''}>
  <div class="project-header">
    <span class="project-name">${escHtml(p.name)}</span>
    <div class="project-header-right">
      ${lastActive ? `<span class="project-last-active">${escHtml(lastActive)}</span>` : ''}
      <span class="project-status ${status}" data-status="${status}">${statusLabel}</span>
    </div>
  </div>
  <div class="project-progress">
    <div class="progress-bar">
      <div class="progress-fill ${status === 'complete' ? 'complete' : ''}" style="width:${pct}%"></div>
    </div>
    <div class="progress-label">
      <span>${complete}/${total} sprints</span>
      <span>${pct}%</span>
    </div>
  </div>
  ${metaLine}
  ${commitLine}
  <div class="project-footer">
    <div class="sparkline" title="Commits last 7 days">${sparkBars}</div>
    <div class="project-footer-right">
      <button class="start-session-btn" data-session="${escHtml(p.name)}">Start Session</button>
      <button class="card-briefing-btn" data-briefing="${escHtml(p.name)}" title="Copy briefing">&#128203;</button>
      <div class="project-health">${healthDots}</div>
    </div>
  </div>
</div>`;
}

function renderProjects() {
  const projects = (stateData?.projects || []).slice().sort((a, b) => {
    const order = { active: 0, planned: 1, complete: 2 };
    return (order[projectStatus(a)] ?? 1) - (order[projectStatus(b)] ?? 1);
  });
  const grid = $('projectsGrid');
  if (!projects.length) {
    grid.innerHTML = '<p class="empty-state">No projects found.</p>';
    return;
  }

  const active    = projects.filter(p => projectStatus(p) !== 'complete');
  const completed = projects.filter(p => projectStatus(p) === 'complete');

  // Update nav + inline count
  const activeCount = active.filter(p => projectStatus(p) === 'active').length;
  const projBadge   = $('navProjectCount');
  if (activeCount) {
    projBadge.textContent = activeCount + ' active';
    projBadge.style.background = 'var(--amber)';
    projBadge.style.color = '#000';
    projBadge.removeAttribute('hidden');
  } else {
    projBadge.setAttribute('hidden', '');
  }
  const inlineCount = $('navProjectCountInline');
  if (inlineCount) inlineCount.textContent = `(${projects.length})`;

  let html = active.map(renderProjectCard).join('');

  if (completed.length) {
    const isOpen = grid.querySelector('.completed-toggle')?.classList.contains('open');
    html += `<button class="completed-toggle ${isOpen ? 'open' : ''}" id="completedToggle">
      <span class="toggle-arrow">&#9654;</span>
      Completed (${completed.length})
    </button>`;
    if (isOpen) {
      html += `<div class="completed-grid">${completed.map(renderProjectCard).join('')}</div>`;
    }
  }

  grid.innerHTML = html;
}

// ── Project Detail ────────────────────────────────────────────
function openProjectDetail(name) {
  const project = (stateData?.projects || []).find(p => p.name === name);
  if (!project) return;
  selectedProjectName = name;

  if (activeTab !== 'projects') switchTab('projects');
  $('projects-section').setAttribute('hidden', '');
  $('project-detail').removeAttribute('hidden');

  renderProjectDetailContent(project);
}

function closeProjectDetail() {
  $('project-detail').setAttribute('hidden', '');
  $('projects-section').removeAttribute('hidden');
  selectedProjectName = null;
}

function renderProjectDetailContent(project) {
  const container = $('projectDetailContent');
  const sprints   = project.sprints || {};
  const tasks     = project.tasks   || {};
  const health    = project.health  || {};
  const pipeline  = project.pipeline || {};
  const sprintList = sprints.list || [];
  const status    = projectStatus(project);

  // ── Phase progress
  const phases = {};
  for (const s of sprintList) {
    if (!phases[s.phase]) phases[s.phase] = { total: 0, done: 0 };
    phases[s.phase].total++;
    if (s.status === 'done') phases[s.phase].done++;
  }

  const phaseRows = Object.entries(phases).map(([ph, d]) => {
    const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
    return `
    <div class="phase-row">
      <span class="phase-label">Phase ${escHtml(ph)}</span>
      <div class="phase-bar"><div class="phase-fill" style="width:${pct}%"></div></div>
      <span class="phase-status">${d.done}/${d.total}</span>
    </div>`;
  }).join('');

  // ── Sprint table
  const sprintRows = sprintList.map(s => {
    const dotColor = s.status === 'done'
      ? 'var(--green)'
      : s.status === 'active'
        ? 'var(--amber)'
        : 'var(--border)';
    const dateStr = s.lastCommit ? formatDate(s.lastCommit) : '';
    return `
    <tr>
      <td class="mono">${escHtml(s.id)}</td>
      <td class="sprint-name">${escHtml(s.name)}</td>
      <td>${s.commits || 0}</td>
      <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor}"></span></td>
      <td>${escHtml(dateStr)}</td>
    </tr>`;
  }).join('');

  // ── Pipeline
  const pipelineSteps = [
    { key: 'code',   label: 'Code' },
    { key: 'build',  label: 'Build' },
    { key: 'deploy', label: 'Deploy' },
  ].map(step => {
    const val = pipeline[step.key] || 'not-started';
    const cls = val === 'complete' ? 'complete' : val === 'active' ? 'active' : '';
    return `
    <div class="pipeline-step ${cls}">
      <div class="pipeline-label">${step.label}</div>
      <div class="pipeline-value">${val}</div>
    </div>`;
  }).join('');

  const missingConfig = (pipeline.config?.missing || []);
  const configNote = missingConfig.length
    ? `<p class="text-sm" style="color:var(--amber);margin-top:8px">Missing config: ${escHtml(missingConfig.join(', '))}</p>`
    : '';

  const lastDeploy = pipeline.lastDeploy
    ? `<p class="text-sm mono" style="color:var(--text-muted);margin-top:8px">
        Last deploy: ${escHtml(pipeline.lastDeploy.hash)} &middot; ${escHtml(pipeline.lastDeploy.message)} &middot; ${escHtml(relTime(pipeline.lastDeploy.date))}
       </p>`
    : '';

  // ── Health scores
  const healthRows = health.overall ? `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px">
      ${['coverage','momentum','velocity','stability'].map(k =>
        `<div><div style="font-size:20px;font-weight:600;color:var(--text-primary)">${health[k] || 0}</div>
         <div class="text-sm" style="color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">${k}</div></div>`
      ).join('')}
      <div><div style="font-size:20px;font-weight:600;color:var(--green)">${health.overall || 0}</div>
        <div class="text-sm" style="color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Overall</div></div>
    </div>` : '';

  container.innerHTML = `
    <div class="detail-header">
      <div class="detail-name">${escHtml(project.name)}</div>
      <div class="detail-subtitle">${escHtml(project.sprints?.current?.name || `${sprints.complete || 0} of ${sprints.total || 0} sprints complete`)}</div>
    </div>

    <button class="briefing-btn" data-briefing="${escHtml(project.name)}">Copy Briefing</button>

    <div style="margin-top:24px">
      <h3 class="section-title">Pipeline</h3>
      <div class="pipeline">${pipelineSteps}</div>
      ${configNote}
      ${lastDeploy}
    </div>

    <div style="margin-top:24px">
      <h3 class="section-title">Phase Progress</h3>
      <div class="phase-list">${phaseRows || '<p class="empty-state">No phases yet.</p>'}</div>
    </div>

    <div style="margin-top:24px">
      <h3 class="section-title">Health</h3>
      ${healthRows || '<p class="empty-state">No health data.</p>'}
    </div>

    <div style="margin-top:24px">
      <h3 class="section-title">Sprints</h3>
      ${sprintList.length ? `
      <table class="sprint-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Commits</th>
            <th>Status</th>
            <th>Last</th>
          </tr>
        </thead>
        <tbody>${sprintRows}</tbody>
      </table>` : '<p class="empty-state">No sprints.</p>'}
    </div>

    <div style="margin-top:24px">
      <h3 class="section-title">Notes</h3>
      <textarea id="projectNotes" class="notes-area" placeholder="Anything worth remembering — waiting on keys, blocked by X, don't start Phase N until…" rows="4"></textarea>
      <div class="notes-footer">
        <span id="notesSaveStatus" class="notes-save-status"></span>
      </div>
    </div>`;

  // Briefing button handler
  const btn = container.querySelector('.briefing-btn');
  if (btn) btn.addEventListener('click', () => copyBriefing(project.name));

  // Load notes
  loadNotes(project.name);
}

async function loadNotes(projectName) {
  const ta = $('projectNotes');
  if (!ta) return;
  if (notesCache[projectName] !== undefined) {
    ta.value = notesCache[projectName];
    return;
  }
  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(projectName)}`);
    const text = await res.text();
    notesCache[projectName] = text;
    if ($('projectNotes')) $('projectNotes').value = text;
  } catch { /* silent */ }
}

let notesSaveTimer = null;
function scheduleNotesSave(projectName) {
  clearTimeout(notesSaveTimer);
  const status = $('notesSaveStatus');
  if (status) status.textContent = 'Unsaved…';
  notesSaveTimer = setTimeout(async () => {
    const ta = $('projectNotes');
    if (!ta) return;
    const content = ta.value;
    notesCache[projectName] = content;
    try {
      await fetch(`/api/notes/${encodeURIComponent(projectName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if ($('notesSaveStatus')) $('notesSaveStatus').textContent = 'Saved';
      setTimeout(() => { if ($('notesSaveStatus')) $('notesSaveStatus').textContent = ''; }, 2000);
    } catch {
      if ($('notesSaveStatus')) $('notesSaveStatus').textContent = 'Failed to save';
    }
  }, 800);
}

async function copyBriefing(projectName) {
  const detailBtn = $('projectDetailContent').querySelector('.briefing-btn');
  if (detailBtn) { detailBtn.textContent = 'Copying…'; detailBtn.disabled = true; }
  try {
    const res  = await fetch(`/api/briefing/${encodeURIComponent(projectName)}`);
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    showToast('Briefing copied');
    if (detailBtn) { detailBtn.textContent = 'Copied!'; detailBtn.classList.add('copied'); }
    setTimeout(() => { if (detailBtn) { detailBtn.textContent = 'Copy Briefing'; detailBtn.classList.remove('copied'); detailBtn.disabled = false; } }, 2000);
    return text;
  } catch (e) {
    showToast('Failed to copy briefing');
    if (detailBtn) { detailBtn.textContent = 'Copy Briefing'; detailBtn.disabled = false; }
    return null;
  }
}

// ── Session Modal ─────────────────────────────────────────────
function openSessionModal(projectName) {
  const project = (stateData?.projects || []).find(p => p.name === projectName);
  if (!project) return;

  const modal   = $('sessionModal');
  const sprints = project.sprints || {};
  const health  = project.health || {};

  $('sessionProjectName').textContent = projectName;

  const current = sprints.current;
  const next    = sprints.next;
  const nextBlock = current
    ? `<div class="session-next">
        <div class="session-next-label">Current Sprint</div>
        <div class="session-next-name">${escHtml(current.id)} — ${escHtml(current.name)}</div>
      </div>`
    : next
    ? `<div class="session-next">
        <div class="session-next-label">Next Sprint</div>
        <div class="session-next-name">${escHtml(next.id)} — ${escHtml(next.name)}</div>
      </div>`
    : `<p style="color:var(--text-muted);font-size:13px">All sprints complete.</p>`;

  $('sessionContent').innerHTML = `
    <div class="session-stat-row">
      <div class="session-stat">
        <span class="session-stat-val">${sprints.complete || 0}/${sprints.total || 0}</span>
        <span class="session-stat-lbl">Sprints</span>
      </div>
      <div class="session-stat">
        <span class="session-stat-val" style="color:var(--green)">${health.overall || 0}</span>
        <span class="session-stat-lbl">Health</span>
      </div>
      <div class="session-stat">
        <span class="session-stat-val">${project.totalCommits || 0}</span>
        <span class="session-stat-lbl">Commits</span>
      </div>
    </div>
    ${nextBlock}`;

  modal.removeAttribute('hidden');
  $('sessionCopyBtn').dataset.project = projectName;
  $('sessionCopyBtn').textContent = 'Copy Briefing & Start';
  $('sessionCopyBtn').classList.remove('copied');
}

function closeSessionModal() {
  $('sessionModal').setAttribute('hidden', '');
}

// ── Team ─────────────────────────────────────────────────────
function renderTeam() {
  const agents  = agentsData?.agents || [];
  const grid    = $('teamGrid');
  const countEl = $('teamCount');

  countEl.textContent = agents.length ? `(${agents.length})` : '';

  if (!agents.length) {
    grid.innerHTML = '<p class="empty-state">No agents loaded.</p>';
    return;
  }

  // Workload summary — agents with open tasks
  const busy = agents
    .filter(a => a.stats?.openTasks?.length)
    .sort((a, b) => b.stats.openTasks.length - a.stats.openTasks.length);

  let workloadHtml = '';
  if (busy.length) {
    workloadHtml = `<div class="workload-bar">
      <span class="workload-title">Active workload</span>
      ${busy.map(a => `
        <div class="workload-item" title="${escHtml(a.stats.openTasks.map(t => t.project + ': ' + t.task).join('\n'))}">
          <span class="workload-agent">${escHtml(agentAbbr(a.name))}</span>
          <span class="workload-count">${a.stats.openTasks.length}</span>
        </div>`).join('')}
    </div>`;
  }

  const byName = Object.fromEntries(agents.map(a => [a.name, a]));
  let html = workloadHtml;

  for (const dept of DEPT_ORDER) {
    const members = (DEPT_MAP[dept] || []).map(n => byName[n]).filter(Boolean);
    if (!members.length) continue;

    html += `<div class="dept-section">
      <div class="dept-title">${escHtml(dept)}</div>
      <div class="dept-grid">
        ${members.map(agent => renderAgentCard(agent)).join('')}
      </div>
    </div>`;
  }

  // Uncategorized
  const known = new Set(Object.values(DEPT_MAP).flat());
  const uncategorized = agents.filter(a => !known.has(a.name));
  if (uncategorized.length) {
    html += `<div class="dept-section">
      <div class="dept-title">Other</div>
      <div class="dept-grid">${uncategorized.map(renderAgentCard).join('')}</div>
    </div>`;
  }

  grid.innerHTML = html;
}

function renderAgentCard(agent) {
  const statusDotCls = agent.status === 'working' ? 'working' : 'available';
  const stats = agent.stats || {};
  return `
<div class="agent-card" data-agent="${escHtml(agent.name)}" tabindex="0">
  <div class="agent-header">
    <span class="agent-name">${escHtml(agent.name)}</span>
    <span class="agent-status-dot ${statusDotCls}"></span>
  </div>
  <div class="agent-role">${escHtml(agent.role || '')}</div>
  <div class="agent-stats">
    <span><span class="agent-stat-value">${stats.tasksCompleted || 0}</span> <span class="agent-stat-label">tasks</span></span>
    <span><span class="agent-stat-value">${stats.sprints || 0}</span> <span class="agent-stat-label">sprints</span></span>
  </div>
</div>`;
}

// ── Agent Detail ─────────────────────────────────────────────
function openAgentDetail(name) {
  const agent = (agentsData?.agents || []).find(a => a.name === name);
  if (!agent) return;
  selectedAgentName = name;

  if (activeTab !== 'team') switchTab('team');
  $('team-section').setAttribute('hidden', '');
  $('agent-detail').removeAttribute('hidden');

  renderAgentDetailContent(agent);
}

function closeAgentDetail() {
  $('agent-detail').setAttribute('hidden', '');
  $('team-section').removeAttribute('hidden');
  selectedAgentName = null;
}

function renderAgentDetailContent(agent) {
  const container = $('agentDetailContent');
  const stats     = agent.stats || {};
  const handoffs  = agent.handoffs || {};
  const abbr      = agentAbbr(agent.name);
  const badgeCls  = agentBadgeClass(agent.name);
  const deptCls   = deptBadgeClass(agent.department || 'Build');
  const statusDot = agent.status === 'working' ? 'working' : 'available';

  // Recent work
  const recentWork = (stats.recentWork || []).slice(0, 5).map(w =>
    `<div style="padding:6px 0;border-bottom:1px solid var(--border-subtle)">
      <span style="font-size:11px;color:var(--blue);font-family:var(--font-mono)">${escHtml(w.project)}</span>
      <span style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono)"> · ${escHtml(w.sprint)} ${escHtml(w.sprintName)}</span>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${escHtml(w.task)}</div>
    </div>`
  ).join('') || '<p class="empty-state">No recent work.</p>';

  // Boundaries
  const boundaries = (agent.boundaries || []).map(b =>
    `<li style="padding:4px 0;font-size:13px;color:var(--text-secondary)">${escHtml(b)}</li>`
  ).join('');

  // Handoff flow
  const receives = (handoffs.receives || []).map(h =>
    `<span style="font-size:12px;color:var(--text-muted)">${escHtml(h.from)} (${h.count})</span>`
  ).join(', ');
  const handsTo = (handoffs.handsTo || []).map(h =>
    `<span style="font-size:12px;color:var(--text-muted)">${escHtml(h.to)} (${h.count})</span>`
  ).join(', ');

  const currentTaskHtml = agent.currentTask
    ? `<div style="margin-top:8px;padding:8px 12px;background:var(--bg-inset);border-radius:var(--radius);border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono)">${escHtml(agent.currentTask.project)} &middot; ${escHtml(agent.currentTask.sprint || '')}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">${escHtml(agent.currentTask.task || '')}</div>
      </div>`
    : '';

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:24px">
      <div class="agent-badge ${badgeCls}" style="width:48px;height:48px;font-size:16px">${escHtml(abbr)}</div>
      <div>
        <div style="font-size:22px;font-weight:600;color:var(--text-primary)">${escHtml(agent.name)}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap">
          <span class="dept-badge ${deptCls}">${escHtml(agent.department || '')}</span>
          <span class="model-badge">${escHtml(agent.model || '')}</span>
          <span class="agent-status-dot ${statusDot}" style="width:8px;height:8px"></span>
          <span style="font-size:12px;color:var(--text-muted)">${agent.status === 'working' ? 'Working' : 'Available'}</span>
        </div>
      </div>
    </div>

    <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:20px">${escHtml(agent.role || '')}</div>

    ${currentTaskHtml}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0">
      <div>
        <div style="font-size:24px;font-weight:700;color:var(--text-primary)">${stats.tasksCompleted || 0}</div>
        <div class="text-sm" style="color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Tasks Completed</div>
      </div>
      <div>
        <div style="font-size:24px;font-weight:700;color:var(--text-primary)">${stats.sprints || 0}</div>
        <div class="text-sm" style="color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Sprints</div>
      </div>
    </div>

    <div style="margin-bottom:20px">
      <h3 class="section-title">Recent Work</h3>
      ${recentWork}
    </div>

    ${boundaries ? `
    <div style="margin-bottom:20px">
      <h3 class="section-title">What They Don't Do</h3>
      <ul style="display:flex;flex-direction:column;gap:2px">${boundaries}</ul>
    </div>` : ''}

    ${(receives || handsTo) ? `
    <div style="margin-bottom:20px">
      <h3 class="section-title">Handoff Flow</h3>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 0">
        ${receives ? `<div style="font-size:12px;color:var(--text-dim)">Receives from: ${receives}</div>` : ''}
        ${receives && handsTo ? '<span style="color:var(--border)">→</span>' : ''}
        ${handsTo ? `<div style="font-size:12px;color:var(--text-dim)">Hands to: ${handsTo}</div>` : ''}
      </div>
    </div>` : ''}`;
}

// ── Timeline ─────────────────────────────────────────────────
let timelineExpanded = false;

function renderTimeline() {
  const entries = stateData?.timeline || [];
  const list    = $('timelineList');

  if (!entries.length) {
    list.innerHTML = '<p class="empty-state">No timeline entries yet.</p>';
    return;
  }

  // Filter to last 7 days unless expanded
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const visible = timelineExpanded ? entries : entries.filter(e => e.lastCommit && new Date(e.lastCommit) >= cutoff);
  const hidden  = entries.length - visible.length;

  // Group by date
  const groups = {};
  for (const entry of visible) {
    const dateKey = entry.lastCommit ? formatDate(entry.lastCommit) : 'Unknown';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(entry);
  }

  let html = '';
  for (const [date, dayEntries] of Object.entries(groups)) {
    html += `<div class="timeline-date">${escHtml(date)}</div>`;
    for (const entry of dayEntries) {
      const agents  = (entry.agents || []).join(', ');
      const commits = entry.commits || [];
      const shown   = commits.slice(0, 3);
      const extra   = commits.length - 3;

      const commitHtml = shown.map(c =>
        `<div class="timeline-commit">${escHtml(c.message || c.hash || '')}</div>`
      ).join('');

      const extraHtml = extra > 0
        ? `<div class="timeline-commit" style="color:var(--text-dim);cursor:pointer"
             onclick="this.closest('.timeline-entry').querySelector('.timeline-commits-extra').toggleAttribute('hidden')">
             +${extra} more commits</div>
           <div class="timeline-commits-extra" hidden>
             ${commits.slice(3).map(c => `<div class="timeline-commit">${escHtml(c.message || c.hash || '')}</div>`).join('')}
           </div>`
        : '';

      html += `
<div class="timeline-entry">
  <div class="timeline-header">
    <span class="timeline-time">${escHtml(formatTime(entry.lastCommit))}</span>
    <span class="timeline-project">${escHtml(entry.project)}</span>
  </div>
  <div class="timeline-sprint">${escHtml(entry.sprintName)}</div>
  <div class="timeline-stats">
    Sprint ${escHtml(entry.sprintId)} &middot; ${commits.length} commits
    ${agents ? `&middot; <span class="timeline-agents">${escHtml(agents)}</span>` : ''}
  </div>
  ${commitHtml || extraHtml ? `<div class="timeline-commits">${commitHtml}${extraHtml}</div>` : ''}
</div>`;
    }
  }

  if (hidden > 0 && !timelineExpanded) {
    html += `<button class="timeline-show-more" id="timelineShowMore">${hidden} older entries &mdash; Show more</button>`;
  }

  list.innerHTML = html;
}

// ── Command Palette ───────────────────────────────────────────
function buildCmdItems() {
  const items = [];

  // Action commands — always at the top
  items.push({ type: 'Nav', label: 'Go to Projects', meta: 'Switch to projects tab', action: () => switchTab('projects') });
  items.push({ type: 'Nav', label: 'Go to Team',     meta: 'Switch to team tab',     action: () => switchTab('team') });
  items.push({ type: 'Nav', label: 'Go to Timeline', meta: 'Switch to timeline tab', action: () => switchTab('timeline') });

  for (const p of (stateData?.projects || [])) {
    const pName = p.name;
    items.push({ type: 'Project', label: pName, meta: projectStatus(p), action: () => openProjectDetail(pName) });
    items.push({ type: 'Briefing', label: `Brief: ${pName}`, meta: 'Copy briefing to clipboard', action: () => copyBriefing(pName) });
    items.push({ type: 'Session', label: `Start: ${pName}`, meta: 'Open session modal', action: () => openSessionModal(pName) });

    for (const s of (p.sprints?.list || [])) {
      items.push({
        type: 'Sprint', label: s.name,
        meta: `${p.name} · ${s.id}`,
        action: () => openProjectDetail(p.name),
      });
    }
  }

  for (const a of (agentsData?.agents || [])) {
    items.push({
      type: 'Agent', label: a.name,
      meta: a.department || '',
      action: () => openAgentDetail(a.name),
    });
  }

  return items;
}

function openCmdPalette() {
  cmdOpen = true;
  const palette = $('cmdPalette');
  palette.removeAttribute('hidden');
  const input = $('cmdInput');
  input.value = '';
  renderCmdResults('');
  requestAnimationFrame(() => input.focus());
}

function closeCmdPalette() {
  cmdOpen  = false;
  cmdIdx   = -1;
  cmdItems = [];
  $('cmdPalette').setAttribute('hidden', '');
  $('cmdInput').value = '';
}

function renderCmdResults(query) {
  const all  = buildCmdItems();
  const q    = query.trim().toLowerCase();

  cmdItems = q
    ? all.filter(item =>
        item.label.toLowerCase().includes(q) ||
        (item.meta || '').toLowerCase().includes(q)
      )
    : all;

  cmdItems = cmdItems.slice(0, 12);
  cmdIdx   = cmdItems.length > 0 ? 0 : -1;

  const resultsEl = $('cmdResults');

  if (!cmdItems.length) {
    resultsEl.innerHTML = `<div class="cmd-empty">No results${q ? ` for "${escHtml(q)}"` : ''}</div>`;
    return;
  }

  resultsEl.innerHTML = cmdItems.map((item, i) => `
    <div class="cmd-result ${i === cmdIdx ? 'active' : ''}" data-idx="${i}">
      <div>
        <div class="cmd-result-name">${escHtml(item.label)}</div>
        <div class="cmd-result-meta">${escHtml(item.meta || '')}</div>
      </div>
      <span class="cmd-result-type">${escHtml(item.type)}</span>
    </div>`).join('');
}

function updateCmdSelection() {
  $('cmdResults').querySelectorAll('.cmd-result').forEach((el, i) => {
    el.classList.toggle('active', i === cmdIdx);
  });
  const sel = $('cmdResults').querySelector('.active');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function executeCmdItem(item) {
  closeCmdPalette();
  item.action();
}

// ── Fetch ─────────────────────────────────────────────────────
async function fetchState() {
  try {
    const res  = await fetch('/api/state');
    if (!res.ok) throw new Error(res.status);
    stateData = await res.json();
    syncTime  = Date.now();
    renderAll();
  } catch (e) {
    $('syncStatus').textContent = 'Error';
  }
}

async function fetchAgents() {
  try {
    const res  = await fetch('/api/agents');
    if (!res.ok) throw new Error(res.status);
    agentsData = await res.json();
    renderTeam();
  } catch (e) {
    console.warn('Failed to fetch agents:', e);
  }
}

// ── Render All ────────────────────────────────────────────────
function renderAll() {
  const projects = stateData?.projects || [];
  const alerts   = stateData?.alerts   || [];
  const hasActive = projects.some(p => p.sprints?.current);

  updateFavicon(alerts, hasActive);
  renderRecommendation();
  renderSinceVisit();
  renderAlerts();
  renderActions();
  renderProjects();
  renderTimeline();

  // Refresh project detail if currently open
  if (selectedProjectName) {
    const p = projects.find(p => p.name === selectedProjectName);
    if (p) renderProjectDetailContent(p);
  }

  // Persist lastVisit only after the first render
  if (firstRender) {
    firstRender = false;
    localStorage.setItem('lastVisit', new Date().toISOString());
  }
}

// ── Event Listeners ───────────────────────────────────────────

// Project card clicks (delegation)
$('projectsGrid').addEventListener('click', e => {
  const briefBtn = e.target.closest('.card-briefing-btn');
  if (briefBtn) {
    e.stopPropagation();
    copyBriefing(briefBtn.dataset.briefing);
    return;
  }
  const sessBtn = e.target.closest('.start-session-btn');
  if (sessBtn) {
    e.stopPropagation();
    openSessionModal(sessBtn.dataset.session);
    return;
  }
  if (e.target.id === 'completedToggle' || e.target.closest('#completedToggle')) return; // handled by separate listener
  const card = e.target.closest('.project-card');
  if (card?.dataset.project) openProjectDetail(card.dataset.project);
});

// Timeline show more
$('timelineList').addEventListener('click', e => {
  if (e.target.id === 'timelineShowMore') {
    timelineExpanded = true;
    renderTimeline();
  }
});

// Back to projects
$('backToProjects').addEventListener('click', closeProjectDetail);

// Notes autosave (delegation on project detail)
$('projectDetailContent').addEventListener('input', e => {
  if (e.target.id === 'projectNotes' && selectedProjectName) {
    scheduleNotesSave(selectedProjectName);
  }
});

// Team card clicks (delegation)
$('teamGrid').addEventListener('click', e => {
  const card = e.target.closest('.agent-card');
  if (card?.dataset.agent) openAgentDetail(card.dataset.agent);
});

// Back to team
$('backToTeam').addEventListener('click', closeAgentDetail);

// Recommendation banner — Start button
$('recBanner').addEventListener('click', e => {
  const btn = e.target.closest('.rec-btn');
  if (btn?.dataset.recProject) openSessionModal(btn.dataset.recProject);
});

// Session modal — close and copy
$('sessionClose').addEventListener('click', closeSessionModal);
$('sessionModal').querySelector('.session-backdrop').addEventListener('click', closeSessionModal);
$('sessionCopyBtn').addEventListener('click', async e => {
  const projectName = e.target.dataset.project;
  e.target.textContent = 'Copying…';
  const text = await copyBriefing(projectName);
  if (text) {
    e.target.textContent = 'Copied!';
    e.target.classList.add('copied');
    setTimeout(closeSessionModal, 800);
  } else {
    e.target.textContent = 'Copy Briefing & Start';
  }
});

// Action checkboxes (delegation)
$('actionsList').addEventListener('change', async e => {
  if (e.target.type !== 'checkbox') return;
  const text = e.target.dataset.actionText;
  const item = e.target.closest('.action-item');
  e.target.disabled = true;
  try {
    await fetch('/api/action/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    item.style.opacity = '0.4';
    item.style.textDecoration = 'line-through';
    showToast('Marked done');
    setTimeout(() => fetchState(), 500);
  } catch {
    e.target.disabled = false;
    e.target.checked = false;
    showToast('Failed to update INBOX.md');
  }
});

// Completed projects toggle (delegation on grid)
$('projectsGrid').addEventListener('click', e => {
  if (e.target.closest('#completedToggle')) {
    const toggle = $('completedToggle');
    if (!toggle) return;
    const isOpen = toggle.classList.toggle('open');
    const completed = (stateData?.projects || []).filter(p => projectStatus(p) === 'complete');
    const existing = $('projectsGrid').querySelector('.completed-grid');
    if (isOpen) {
      const grid = document.createElement('div');
      grid.className = 'completed-grid';
      grid.innerHTML = completed.map(renderProjectCard).join('');
      toggle.after(grid);
    } else if (existing) {
      existing.remove();
    }
  }
});

// Ctrl+K button
$('cmdKBtn').addEventListener('click', openCmdPalette);

// Cmd palette backdrop
$('cmdPalette').querySelector('.cmd-backdrop').addEventListener('click', closeCmdPalette);

// Cmd palette input
$('cmdInput').addEventListener('input', e => renderCmdResults(e.target.value));

// Cmd palette result clicks (delegation)
$('cmdResults').addEventListener('click', e => {
  const row = e.target.closest('.cmd-result');
  if (row) {
    const idx = parseInt(row.dataset.idx, 10);
    if (cmdItems[idx]) executeCmdItem(cmdItems[idx]);
  }
});

// Cmd palette hover
$('cmdResults').addEventListener('mousemove', e => {
  const row = e.target.closest('.cmd-result');
  if (row) {
    const idx = parseInt(row.dataset.idx, 10);
    if (!isNaN(idx) && idx !== cmdIdx) {
      cmdIdx = idx;
      updateCmdSelection();
    }
  }
});

// Keyboard events
document.addEventListener('keydown', e => {
  // Ctrl+K / Meta+K
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    cmdOpen ? closeCmdPalette() : openCmdPalette();
    return;
  }

  // Command palette keys
  if (cmdOpen) {
    if (e.key === 'Escape')    { e.preventDefault(); closeCmdPalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdIdx = Math.min(cmdIdx + 1, cmdItems.length - 1); updateCmdSelection(); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); cmdIdx = Math.max(cmdIdx - 1, 0); updateCmdSelection(); return; }
    if (e.key === 'Enter')     { e.preventDefault(); const item = cmdItems[cmdIdx >= 0 ? cmdIdx : 0]; if (item) executeCmdItem(item); return; }
    return;
  }

  // Escape from modals / detail views
  if (e.key === 'Escape') {
    if (!$('sessionModal').hasAttribute('hidden')) { closeSessionModal(); return; }
    if (selectedProjectName) closeProjectDetail();
    else if (selectedAgentName) closeAgentDetail();
    return;
  }

  // Arrow keys / Enter for project & agent card navigation
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
    const focused = document.activeElement;
    const isCard = focused?.classList.contains('project-card') || focused?.classList.contains('agent-card');
    if (!isCard) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      focused.click();
      return;
    }

    const cards = [...focused.parentElement.querySelectorAll('.project-card, .agent-card')];
    const idx = cards.indexOf(focused);
    if (idx === -1) return;

    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(idx + 1, cards.length - 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')    next = Math.max(idx - 1, 0);
    if (next >= 0 && next !== idx) {
      e.preventDefault();
      cards[next].focus();
    }
  }
});

// ── Tab switching ─────────────────────────────────────────────
let activeTab = 'projects';

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.hidden = panel.dataset.tab !== name;
  });
  document.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  // Reset detail views when switching tabs
  if (name !== 'projects') {
    $('project-detail').setAttribute('hidden', '');
    $('projects-section').removeAttribute('hidden');
    selectedProjectName = null;
  }
  if (name !== 'team') {
    $('agent-detail').setAttribute('hidden', '');
    $('team-section').removeAttribute('hidden');
    selectedAgentName = null;
  }
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-link[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Sync status ticker ────────────────────────────────────────
setInterval(updateSyncStatus, 5000);

// ── Init ─────────────────────────────────────────────────────
$('cmdKBtn').textContent = navigator.platform?.startsWith('Mac') ? '⌘K' : 'Ctrl+K';
fetchState();
fetchAgents();
setInterval(fetchState,  STATE_INTERVAL);
setInterval(fetchAgents, AGENTS_INTERVAL);
