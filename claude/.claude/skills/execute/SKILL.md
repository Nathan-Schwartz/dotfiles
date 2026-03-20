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
- Otherwise, review the ready tasks above and pick the most appropriate one (respecting dependency order — earlier tasks unblock later ones)
- If no tasks are ready, inform the user and stop

### Per-Task Execution

For each task:

1. **Claim**: `tk start <task_id>`

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
   - **Approved**: `tk close <task_id>`. Check if there are more ready tasks and offer to continue.
   - **Rejected with rationale**: Incorporate the feedback and dispatch another subagent attempt. Do not re-run `tk start` (task is already in_progress).

### Stopping

The loop continues until:
- The user declines to continue to the next task
- No more ready tasks remain
- The user explicitly stops

After stopping, show a summary: which tasks were completed, which are still in progress, what `tk ready -T planned` returns now.
