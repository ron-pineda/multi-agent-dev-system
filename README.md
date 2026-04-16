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

## The roster

28 agents across 5 departments. Nothing runs until you invoke it. See
`agents/_index.md` for the canonical source, or each `agents/<Name>.md` for
the full role prompt.

### Build — the core engineering team

| Agent | File | Model | Primary job |
|-------|------|-------|-------------|
| PM | `PM.md` | Sonnet / Haiku | Human interface, task gating, kickoff, weekly reviews |
| Architect | `Architect.md` | Opus / Sonnet | Feature breakdown, task creation, handoff coordination |
| Frontend Engineer | `Frontend.md` | Sonnet | UI, screens, components, styling |
| Backend Engineer | `Backend.md` | Sonnet | APIs, business logic, auth, integrations |
| Database Engineer | `Database.md` | Sonnet | Schema, migrations, queries |
| Mobile | `Mobile.md` | Sonnet | Flutter/Dart, Android/iOS native features |
| AI Engineer | `AIEngineer.md` | Sonnet / Opus | System prompts, model selection, eval harnesses |
| Designer | `Designer.md` | Sonnet | Design specs, wireframes, component specs |
| Integrations | `Integrations.md` | Sonnet | Third-party APIs, webhooks, auth flows |

### Quality — ensures what ships is correct, safe, and understandable

| Agent | File | Model | Primary job |
|-------|------|-------|-------------|
| QA | `QA.md` | Haiku / Sonnet | Acceptance criteria verification |
| Reviewer | `Reviewer.md` | Sonnet | Code legibility, safety, final gate |
| Doc Writer | `DocWriter.md` | Haiku | README, comments, changelog, glossary |
| Security | `Security.md` | Sonnet | Threat modeling, OWASP audits, pen testing |
| Performance | `Performance.md` | Haiku / Sonnet | Profiling, bottleneck analysis, optimization |

### Operations — keeps things running and the business healthy

| Agent | File | Model | Primary job |
|-------|------|-------|-------------|
| DevOps | `DevOps.md` | Sonnet | CI/CD, deployments, env management, app store submissions |
| SRE | `SRE.md` | Sonnet | Monitoring, incident response, runbooks |
| Analytics | `Analytics.md` | Sonnet | Event tracking, schema design, usage reports |
| Finance | `Finance.md` | Haiku / Sonnet | Unit economics, API cost modeling, revenue projections |
| Legal | `Legal.md` | Sonnet | Privacy policy, ToS, GDPR/CCPA, app store compliance |
| Chief of Staff | `ChiefOfStaff.md` | Sonnet | Weekly portfolio briefing, cross-project visibility |

### Growth — acquires users, builds the brand, and converts

| Agent | File | Model | Primary job |
|-------|------|-------|-------------|
| Growth | `Growth.md` | Haiku / Sonnet | ASO, SEO, Product Hunt launches |
| Brand | `Brand.md` | Sonnet | Brand guide, visual identity, consistency review |
| Copywriter | `Copywriter.md` | Haiku / Sonnet | Landing pages, onboarding, app store listings, email |
| Content | `Content.md` | Haiku / Sonnet | Content strategy, build-in-public, newsletters |
| Customer Success | `CustomerSuccess.md` | Sonnet | Feedback triage, pilot health, support templates |

### Business — strategy, revenue, and go-to-market

| Agent | File | Model | Primary job |
|-------|------|-------|-------------|
| Strategist | `Strategist.md` | Sonnet | Pricing analysis, competitive positioning, GTM planning |
| Research | `Research.md` | Sonnet | Pre-brief investigation, technical feasibility, landscape analysis |
| Sales | `Sales.md` | Sonnet | Prospect research, outreach drafts, pitch materials |

### Invoking an agent

Open the project folder in Claude Code. Start your prompt with:

> "You are the [Agent Name]. Read `agents/[Agent].md` and the project startup files. Here is your task: …"

Or just reference the agent file directly — each one tells you exactly what
to read at startup.

### Task lifecycle

```
proposed → approved → in-progress → review → done
                                   ↓
                              needs-rework → in-progress (same engineer)
```

Fast lane (typos, copy, minor styling): `proposed → approved (auto) → in-progress → review (light) → done`

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
