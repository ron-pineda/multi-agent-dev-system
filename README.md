# Multi-Agent Development System

A template for running a portfolio of software projects through a team of
specialized AI agents in Claude Code. 28 agent roles across Build, Quality,
Operations, Growth, and Strategy — all on-demand, nothing runs until invoked.

## What's here

```
agents/         # 28 agent role definitions (PM, Architect, Frontend, …)
shared/         # Standards, templates, prompts, onboarding, learnings
dashboard/      # Localhost HTML control center (port 3737)
scripts/        # Git-driven sprint/task sync
projects/       # Your projects live here (gitignored state per project)

CLAUDE.md       # Root system doc — Claude Code loads this automatically
INBOX.md        # Cross-project queue needing human attention
ROADMAP.md      # Portfolio priorities
JOURNAL.md      # Raw idea/frustration dump (PM reviews weekly)
RETROS.md       # Short retros after ships or stumbles
```

## Core idea

- **PM is the primary human interface.** You talk to PM; PM routes work.
- **Architect coordinates technical handoffs.** No narrative-only handoffs —
  task state lives in a project's `tasks.json`.
- **Dashboard derives state from git.** Agents write `Sprint X.Y` and task IDs
  in commit messages; the dashboard parses them. No manual status files.
- **Projects are independent.** Each project has its own `CLAUDE.md` declaring
  which agents are active for it.

## Getting started

1. Clone this repo to your workspace.
2. Open it in Claude Code. The root `CLAUDE.md` loads automatically.
3. Read `agents/_index.md` to see the full roster.
4. Read `shared/onboarding.md` for the collaboration conventions.
5. Create your first project under `projects/<name>/` with its own `CLAUDE.md`
   that names its active agent roster.
6. (Optional) Run the dashboard:
   ```
   node dashboard/server.js
   # then open http://localhost:3737
   ```

## Adapting to your workflow

- **Edit agent roles** in `agents/*.md` — each file is a self-contained prompt.
- **Tune standards** in `shared/standards/` (backend, database, frontend, git,
  testing) to match your stack.
- **Templates** in `shared/templates/` (brief, PR, task) are starting points —
  override per-project as needed.

## License

MIT (or whatever the original author sets).
