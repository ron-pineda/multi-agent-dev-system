# Agent Team — Usage Guide

> You're the founder. You talk to the PM. The PM runs the team.

---

## Your Role

You don't manage agents directly. Your job:
- **Share ideas and goals with PM** — PM translates them into work
- **Approve proposed tasks** in the dashboard — nothing moves without your approval
- **Check the INBOX** — agents flag items that genuinely need your decision
- **Provide direction when blocked** — if a task is stuck, the answer usually lives with you

You don't need to write briefs, assign engineers, or track handoffs. PM and Architect handle all of that.

---

## How Work Flows

```
You → PM → Architect → Engineers → QA → Reviewer → Done
```

1. **You** tell PM what you want to build
2. **PM** writes a brief and asks Architect to plan it
3. **Architect** breaks it into tasks with acceptance criteria, assigns engineers
4. **You** approve proposed tasks in the dashboard (or PM auto-approves fast-lane items)
5. **Engineers** build (Frontend, Backend, Database — whichever applies)
6. **QA** verifies each task against its acceptance criteria
7. **Reviewer** checks legibility, safety, and standards — then marks done
8. **Doc Writer** updates README, CHANGELOG, and comments as needed

You see all of this in the dashboard in real time.

---

## The 8 Agents

### PM (Project Manager)
**Model:** Sonnet / Haiku

Your primary interface. PM asks you the right questions, writes the project brief, gates tasks (only well-defined tasks get approved), runs weekly reviews, and handles the STOP protocol. Every interaction starts with PM.

**When PM needs you:** Kickoff questions for new projects, STOP/direction changes, anything in the INBOX.

---

### Architect
**Model:** Opus / Sonnet

Breaks features into discrete, independently buildable tasks. Writes acceptance criteria. Assigns the right engineer. Coordinates rework when QA or Reviewer rejects something. Makes architecture decisions and records them in `decisions.md`.

**When Architect needs you:** Rarely directly — surfaces conflicts to PM who surfaces to you.

---

### Frontend Engineer
**Model:** Sonnet

Builds UI: screens, components, interactions, styling. Works from a task spec. Self-checks against acceptance criteria before handing to Reviewer.

**When Frontend needs you:** Almost never. Blocked tasks appear in the dashboard.

---

### Backend Engineer
**Model:** Sonnet

Builds server-side logic: APIs, business rules, auth, integrations. Goes to QA before Reviewer (unlike Frontend which goes straight to Reviewer).

**When Backend needs you:** Almost never. Blocked tasks (e.g. missing credentials) surface to PM.

---

### Database Engineer
**Model:** Sonnet

Handles schema changes, migrations, queries, and data integrity. High-risk role — moves deliberately. Writes rollback migrations. Never runs migrations in production without your explicit instruction.

**When Database needs you:** Production migration runs require your approval.

---

### QA
**Model:** Haiku / Sonnet

Verifies every task against its acceptance criteria. Binary pass/fail — no "close enough." Passes to Reviewer or sends back to Architect with specific failure reasons.

**When QA needs you:** Never directly. Failed tasks surface in the dashboard.

---

### Reviewer
**Model:** Sonnet

Final gate before done. Checks correctness, legibility, standards compliance, and safety (no secrets, no XSS, no SQL injection). Either approves (task → done, CHANGELOG updated) or requests rework with specific feedback.

**When Reviewer needs you:** Never directly. Completed tasks are reflected in the dashboard.

---

### Doc Writer
**Model:** Haiku

Writes README updates, inline comments, CHANGELOG entries, and glossary terms after tasks are completed. Only documents what actually exists.

**When Doc Writer needs you:** Never directly.

---

## Common Scenarios

### "I have a new feature idea"
Tell PM. PM will ask clarifying questions, write the brief, and kick off Architect to plan it. You'll see proposed tasks in the dashboard to approve.

### "Something looks wrong / I want to stop work"
Click **STOP** on the project card in the dashboard. This abandons all in-progress tasks and asks PM for new direction.

### "I want to change direction mid-build"
Tell PM. PM will invoke STOP on the relevant tasks, then re-brief Architect with the new direction.

### "A task has been sitting there for days"
Check the task in the dashboard — it may be blocked. Look at the blockers field. The answer is usually a decision or credential that only you can provide. Leave a comment in the task or respond to the INBOX item.

### "I want to see what everyone is working on"
Go to the **Team** tab — shows all 8 agents with their current assignments. Go to the **Activity** tab for the full chronological handoff log.

---

## Dashboard Actions

| Button | What it does |
|--------|-------------|
| **Approve** | Moves a proposed task to approved. Architect will assign it to an engineer. |
| **Pause** | Freezes a project. No new work starts. Existing in-progress tasks finish their current step. |
| **Resume** | Unfreezes a paused project. |
| **STOP** | Immediately abandons all in-progress tasks. Use for direction changes or emergencies. |
| **Comment** | Leaves a note on a task. The assigned agent will see it in `notes[]` next session. |

---

## Quick Reference

| Agent | Role | Hands Off To | Model |
|-------|------|-------------|-------|
| PM | Human interface, task gating | Architect | Sonnet/Haiku |
| Architect | Feature breakdown, coordination | Engineers | Opus/Sonnet |
| Frontend Engineer | UI, components, styling | Reviewer | Sonnet |
| Backend Engineer | APIs, business logic, auth | QA | Sonnet |
| Database Engineer | Schema, migrations, queries | QA | Sonnet |
| QA | Verify against acceptance criteria | Reviewer (pass) / Architect (fail) | Haiku/Sonnet |
| Reviewer | Code legibility, safety, final gate | Done (pass) / Architect (fail) | Sonnet |
| Doc Writer | README, comments, CHANGELOG | Done | Haiku |
