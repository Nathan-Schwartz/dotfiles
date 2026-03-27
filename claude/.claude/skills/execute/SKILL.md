---
name: execute
description: >-
  Execute tk tickets interactively with human approval gates.
  Dispatches subagents per task, presents results for review.
argument-hint: "[task-id]"
disable-model-invocation: true
---

Execute tk tickets collaboratively. Work is done by subagents; you approve each result before the ticket is closed.

If a task ID is provided as `$0`, execute that specific task. Otherwise, select from the ready tasks below.

## Ready Tasks

!`tk ready -T planned 2>/dev/null || echo "No ready planned tasks found."`

## Execution Flow

### Task Selection

- If `$0` is provided, use that task ID
- Otherwise, review the ready tasks above and pick the most appropriate one:
  - **Prefer `open` tasks over `in_progress` ones** — an `in_progress` task may be claimed by another session
  - Respect dependency order — earlier tasks unblock later ones
- If no tasks are ready, inform the user and stop

### Parallel Safety

Multiple `/execute` sessions can run concurrently on independent tasks:

1. **Claim verification**: Use `tk start --if=open <task_id>` as the first-line guard — it atomically claims the task only if it's still `open`, failing otherwise. If it fails, another session likely claimed it: inform the user and ask whether to proceed on that task anyway or pick a different one. The human decides — `--if=open` catches the common case, but it's not perfect (e.g., a task you yourself started earlier), so the advisory matters.
2. **Independent tasks only**: Parallel sessions should work on tasks that don't modify the same files. If two tasks touch the same files, run them sequentially to avoid git merge conflicts.
3. **Dependency awareness**: Closing a task in one session may make new tasks ready for other sessions. This is expected and safe.

### Per-Task Execution

For each task:

1. **Claim**: `tk start --if=open <task_id>`. If this fails, inform the user that the task may already be claimed by another session and ask which task to try instead.

2. **Execute**: Dispatch a subagent (using the Agent tool) to implement the task. The subagent prompt must include:
   - The full output of `tk show <task_id>`
   - The contents of the core execution reference: read `~/.claude/references/core-execute.md` and include it
   - If the ticket has a parent, include `tk show <parent_id>` for orchestration context
   - Instruction to commit work but NOT to call `tk close` (the human gates that)

3. **Present Results**: When the subagent returns, present to the user:
   - Summary of what was done
   - Files modified
   - Verification results (tests, linting, etc.)
   - Any concerns or follow-up tickets created
   - The diff of changes (use `git diff` or `git diff --cached` as appropriate)

4. **Human Gate**: Ask the user to approve or reject the work:
   - **Approved**: `tk close <task_id>`. Then **re-run `tk ready -T planned`** (the earlier list may be stale — other sessions, ralph, or manual changes can alter state) and present the fresh list. Ask the user whether to continue. The user may simply approve continuing (you pick the best candidate) or specify a task ID. **Do not start the next task without explicit approval.**
   - **Rejected with rationale**: Incorporate the feedback and dispatch another subagent attempt. Do not re-run `tk start` (task is already in_progress).

### Continuation

Never autonomously pick up a new task. After each completed task, you **must** get explicit user approval before proceeding. The user may:
- Approve continuing (you select the best candidate from the fresh ready list)
- Approve continuing and specify a task ID
- Decline or stop

The loop stops when:
- The user declines to continue
- No more ready tasks remain
- The user explicitly stops

After stopping, show a summary: which tasks were completed, which are still in progress, what `tk ready -T planned` returns now.
