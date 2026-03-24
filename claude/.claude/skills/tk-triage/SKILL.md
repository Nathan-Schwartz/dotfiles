---
name: tk-triage
description: >-
  Review abandoned and in-progress tk tickets with timestamps and ralph logs.
  Use to audit stalled work and decide what to do about it.
disable-model-invocation: true
---

Triage stalled tk tickets. Surface abandoned and in-progress work, examine timestamps and ralph execution logs, classify failure modes, and help the user decide next steps.

## Current State

### Open / In-Progress Tickets

!`bash ~/dotfiles/scripts/tk-triage-context.sh ready`

### Stale In-Progress (not abandoned — claimed but never resolved)

!`bash ~/dotfiles/scripts/tk-triage-context.sh stale`

### Abandoned (all statuses)

!`bash ~/dotfiles/scripts/tk-triage-context.sh abandoned`

### Available Ralph Logs

!`bash ~/dotfiles/scripts/tk-triage-context.sh logs`

## Triage Procedure

1. **Identify tickets to triage**: From the state above, collect all in-progress and abandoned tickets. If none are found, tell the user and stop.

2. **Gather context for each ticket**:

   - Run `tk show <id>` for full details (status, tags, creation timestamp, notes)
   - Check for partial commits: `git log --oneline --all --grep="tk(<id>)"` — an abandoned ticket with commits means partial work exists in the repo
   - Check for a ralph log at `${RALPH_LOG_DIR:-.ralph/runs}/<id>.json`. If it exists, read it and extract:
     - `result` — what the agent reported
     - `subtype` — success or error
     - `duration_ms` — how long the session ran
     - `total_cost_usd` — cost of the run
     - `num_turns` — how many turns the agent took (key for failure classification)
     - `permission_denials` — tool permissions that blocked the agent
   - **Map dependency impact** — tk has no reverse dep tree, so build one:
     1. Find direct dependents: `grep -rl '<id>' .tickets/*.md` and check which tickets list it in their `deps:` field
     2. For each dependent found, recursively find its dependents the same way
     3. Run `tk dep tree <id>` on the stalled ticket itself to show its own dependencies (context for why it may be stuck)
     4. Present the full cascade as an indented tree showing what's blocked downstream:
        ```
        <stalled-id> [in_progress, abandoned] Stalled ticket title   ← THIS IS STUCK
        ├── <dep-a> [open] Blocked ticket A                          ← blocked
        │   └── <dep-a1> [open] Transitively blocked                 ← blocked
        └── <dep-b> [open] Another blocked ticket                    ← blocked
        ```

3. **Classify failure mode** (Inferred — cite evidence from log and ticket notes):

   | Pattern | Classification | Evidence |
   |---|---|---|
   | Permission denials present | **Permission blocked** | Agent needed tools ralph doesn't allow |
   | Low `num_turns` (< 5), no commits | **Underspecified or early block** | Agent couldn't make progress — ticket may need more context |
   | High `num_turns` (> 20), no `tk close` | **Too large or context exhaustion** | Agent worked extensively but couldn't finish in one session |
   | Exit code 0 but not closed | **Agent confusion** | Agent thought it was done but didn't close the ticket |
   | Exit code non-0 | **Crash or timeout** | Agent process terminated abnormally |
   | Commits exist but ticket open | **Partial work** | Agent committed changes but didn't complete all acceptance criteria |
   | `in_progress`, no `abandoned` tag, no ralph log | **Stale claim** | Claimed by `/execute` or ralph but session ended without closing or abandoning — likely user closed terminal or switched context |
   | `in_progress`, no `abandoned` tag, has ralph log | **Missed abandonment** | Ralph ran but failed to tag — check log for details |

4. **Present the triage report** as a structured summary per ticket:

   | Field | Value |
   |---|---|
   | ID / Title | from `tk show` |
   | Status | current status + tags |
   | Created | creation timestamp |
   | Last Activity | most recent note timestamp |
   | Ralph Outcome | success/error, duration, cost, turns |
   | Failure Mode | classification from step 3 |
   | Partial Work | commits found via `git log --grep` |
   | Downstream Impact | tickets blocked by this one |
   | Agent Notes | any `tk add-note` content from the agent (agents are told to note what's blocking them) |

   After all tickets, show aggregate stats: total stalled tickets, total cost burned, tickets with downstream impact.

5. **Check for stale worktree state**: Run `git status --short` — if there are uncommitted changes, flag them as potentially leftover from a failed ralph run.

6. **Offer actions** for each ticket (wait for user decision before acting):

   - **Reopen** — `tk reopen <id>` then `tk untag <id> abandoned` — reset for another attempt
   - **Close** — `tk close <id>` — work was completed or is no longer needed
   - **Add context and retry** — `tk add-note <id> "<context>"`, `tk untag <id> abandoned`, `tk reopen <id>` — enrich the ticket with what was missing
   - **Split** — create smaller child tickets, close the original as an epic — for "too large" failures
   - **Drop** — `tk close <id>` — intentionally abandon, not worth pursuing
