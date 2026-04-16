# Multi-Agent Development System

## Overview
This workspace manages multiple projects through a team of 8 specialized AI agents.
Each project lives in `projects/` with its own context and agent state.

## Structure
- `INBOX.md` — cross-project queue of items needing human attention
- `ROADMAP.md` — portfolio-level priorities across all projects
- `JOURNAL.md` — personal idea/frustration dump (PM reads weekly)
- `agents/` — global agent definitions (version-controlled)
- `dashboard/` — HTML control center (localhost:3737)
- `shared/` — standards, templates, prompts, and institutional knowledge
- `projects/` — all project folders

## Agent Team
PM, Architect, Frontend Engineer, Backend Engineer, Database Engineer, QA, Reviewer, Doc Writer.
See `agents/` for full definitions. Each project's CLAUDE.md declares its active roster.

## Key Rules
- PM is the primary human interface
- Architect coordinates all technical work and handoffs
- Handoffs require tasks.json updates (narrative-only handoffs are forbidden)
- `needs-rework` returns to the original engineer
- STOP halts current task, marks abandoned, logs reason
- Fast lane: PM auto-approves typos, copy, minor styling
