# Agent Roster

28 agents across 5 departments. All agents are on-demand — nothing runs until you invoke it.

---

## Build

The core engineering team. Every feature flows through this group.

| Agent | File | Model | Primary Job |
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

## Quality

Ensures what ships is correct, safe, and understandable.

| Agent | File | Model | Primary Job |
|-------|------|-------|-------------|
| QA | `QA.md` | Haiku / Sonnet | Acceptance criteria verification |
| Reviewer | `Reviewer.md` | Sonnet | Code legibility, safety, final gate |
| Doc Writer | `DocWriter.md` | Haiku | README, comments, changelog, glossary |
| Security | `Security.md` | Sonnet | Threat modeling, OWASP audits, pen testing |
| Performance | `Performance.md` | Haiku / Sonnet | Profiling, bottleneck analysis, optimization |

## Operations

Keeps things running and the business healthy.

| Agent | File | Model | Primary Job |
|-------|------|-------|-------------|
| DevOps | `DevOps.md` | Sonnet | CI/CD, deployments, env management, app store submissions |
| SRE | `SRE.md` | Sonnet | Monitoring, incident response, runbooks |
| Analytics | `Analytics.md` | Sonnet | Event tracking, schema design, usage reports |
| Finance | `Finance.md` | Haiku / Sonnet | Unit economics, API cost modeling, revenue projections |
| Legal | `Legal.md` | Sonnet | Privacy policy, ToS, GDPR/CCPA, app store compliance |
| Chief of Staff | `ChiefOfStaff.md` | Sonnet | Weekly portfolio briefing, cross-project visibility |

## Growth

Acquires users, builds the brand, and converts.

| Agent | File | Model | Primary Job |
|-------|------|-------|-------------|
| Growth | `Growth.md` | Haiku / Sonnet | ASO, SEO, Product Hunt launches |
| Brand | `Brand.md` | Sonnet | Brand guide, visual identity, consistency review |
| Copywriter | `Copywriter.md` | Haiku / Sonnet | Landing pages, onboarding, app store listings, email |
| Content | `Content.md` | Haiku / Sonnet | Content strategy, build-in-public, newsletters |
| Customer Success | `CustomerSuccess.md` | Sonnet | Feedback triage, pilot health, support templates |

## Business

Strategy, revenue, and go-to-market.

| Agent | File | Model | Primary Job |
|-------|------|-------|-------------|
| Strategist | `Strategist.md` | Sonnet | Pricing analysis, competitive positioning, GTM planning |
| Research | `Research.md` | Sonnet | Pre-brief investigation, technical feasibility, landscape analysis |
| Sales | `Sales.md` | Sonnet | Prospect research, outreach drafts, pitch materials |

---

## How to Use an Agent
Open the project folder in Claude Code. Start your prompt with:
> "You are the [Agent Name]. Read [agent file] and the project startup files. Here is your task: ..."

Or reference the agent file directly — each one tells you exactly what to read at startup.

## Skills Integration
Many agents have a `## Skills to Invoke` section listing Claude Code Skills relevant to their role. These are not optional suggestions — they are the right tool for a specific situation the agent will regularly encounter.

- When an agent enters a situation matching a listed skill, invoke it via the `Skill` tool before proceeding.
- Example: Architect invokes `superpowers:writing-plans` when decomposing a complex feature into tasks.
- Example: Research invokes `superpowers:dispatching-parallel-agents` when a request has 2+ independent sub-topics.
- Example: Strategist invokes `superpowers:brainstorming` when exploring competitive positioning options with no obvious winner.

Agents that omit `## Skills to Invoke` have no applicable skills for their core workflow — do not invent them.

## Task Lifecycle
```
proposed → approved → in-progress → review → done
                                   ↓
                              needs-rework → in-progress (same engineer)
```

Fast lane: `proposed → approved (auto) → in-progress → review (light) → done`

## Handoff Rules (all agents)
1. Update `tasks.json` before announcing a handoff
2. Append to `.agent-state\handoffs.md`
3. Narrative-only handoffs are forbidden

## tasks.json Safety (all agents)
- `tasks.json` is machine-parsed JSON. Invalid JSON silently breaks the dashboard and hides project status.
- **Never use backticks, template literals, or code snippets in notes[] strings.** Use plain English descriptions instead of inline code. Write `sql LEFT(users.name, 1)` not `` sql\`LEFT(${users.name}, 1)\` ``.
- After writing to tasks.json, validate your output is parseable: the file must be valid JSON.
- Keep notes[] entries under 300 characters. If you need more detail, create `.agent-state/notes/<task-id>.md` and reference it.

## STOP
Human types STOP → PM marks task abandoned, logs reason, waits for new direction.

## Per-Project Rosters
Each project's `CLAUDE.md` declares which agents are active. Not every project uses every agent.
Specialized agents (Security, Legal, SRE, Finance) are typically invoked on-demand rather than listed in project rosters.
