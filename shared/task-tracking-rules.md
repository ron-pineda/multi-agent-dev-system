# Task Tracking Rules (mandatory for all agents)

The dashboard at localhost:3737 is the human's only window into what the team is doing.
It reads entirely from `.agent-state/tasks.json`. If you don't update it, the human sees nothing.

## Two mandatory updates per task

**When you START work** (Architect hands task to engineer):
```json
{ "status": "in-progress", "last_touched": "<ISO timestamp>" }
```

**When you HAND OFF** (engineer → QA, QA → Reviewer, Reviewer → done):

| Transition | Status to set |
|---|---|
| Engineer → QA | `review` |
| QA fail → Architect | `needs-rework` |
| Reviewer approve | `done` |
| Reviewer reject | `needs-rework` |

Always add a note to `notes[]` explaining what happened (max 300 chars, no backticks).
Always append to `.agent-state/handoffs.md`: `[timestamp] From → To: task-id title — context`

## Sprint kickoff rule

No engineer writes code until tasks exist in tasks.json and are `approved`.
PM → Architect creates tasks as `proposed` → PM approves → Architect sets `in-progress` → engineers build.
