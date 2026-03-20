#!/usr/bin/env bash

# ralph — task-per-session autonomous executor backed by tk and claude CLI
#
# Usage: ralph [project_dir]
#   project_dir defaults to current directory
#
# Environment:
#   RALPH_MAX_TASKS  — max tasks per run; 0 = unlimited (default: 0)
#   RALPH_LOG_DIR    — directory for session logs (default: .ralph/runs)
#
# =============================================================================
# STATE MACHINE
# =============================================================================
#
# Task States (owned by tk, not ralph):
#   open          — default state, not yet claimed
#   in_progress   — claimed by ralph via `tk start`
#   closed        — completed by agent via `tk close`
#
# Task Lifecycle Within Ralph:
#
#   open + planned tag ──[tk start]──▸ in_progress ──[claude -p]──▸ ?
#                                                                   │
#                                           ┌───────────────────────┤
#                                           │                       │
#                                    agent tk close           agent exits
#                                           │               without closing
#                                           ▼                       ▼
#                                        closed              in_progress
#                                     (completed)          + abandoned tag
#                                                            (failed)
#
# Loop States:
#   SELECT  ──▸ pick next task from tk ready -T planned (skip in_progress)
#   CLAIM   ──▸ tk start (open → in_progress)
#   EXECUTE ──▸ claude -p with task context
#   EVAL    ──▸ check tk status: closed = completed, else = abandoned
#   NEXT    ──▸ back to SELECT (or exit if no tasks / limit reached)
#
# =============================================================================
# PREREQUISITES
# =============================================================================
#
# - tk is installed and on PATH
# - claude CLI is installed and on PATH
# - A .tickets/ directory is reachable from the project directory (tk resolves)
# - Tasks to execute have the `planned` tag (human responsibility in v0)
# - The project directory is a git repo (for uncommitted-changes detection)
#
# =============================================================================
# INVARIANTS
# =============================================================================
#
# - A task is only executed once per run: tk start claims it, in_progress
#   tasks are filtered out of the selection query
# - Failed tasks stay in_progress: this prevents retry AND blocks dependents
#   (tk ready only unblocks deps when predecessors are closed)
# - ralph never modifies task content — only status (start) and metadata
#   (tag, add-note)
# - The loop is bounded by RALPH_MAX_TASKS (if set > 0)
# - Runs in a subshell: cd does not affect the caller's working directory
#
# =============================================================================
# FAILURE MODES
# =============================================================================
#
# NO_TASKS        tk ready -T planned returns nothing.
#                 → Loop exits cleanly. "No ready planned tasks."
#
# TASK_ABANDONED  Agent exits without calling tk close (crash, timeout,
#                 confusion, task too large, task too poorly specified).
#                 → Task stays in_progress (prevents retry, blocks dependents).
#                 → Tagged `abandoned`, note added with exit code.
#                 → Notification sent. Loop continues to next task.
#
# TASK_LIMIT      RALPH_MAX_TASKS reached.
#                 → Loop exits cleanly. "Task limit reached."
#
# PREREQ_MISSING  tk or claude not found on PATH.
#                 → Exits with error before loop starts.
#
# DIRTY_WORKTREE  Agent left uncommitted changes after execution.
#                 → WARNING printed. Loop continues.
#                 → These changes will be visible to the next task's agent.
#                 Note: this is a symptom — the agent should commit its work.
#
# Not handled in v0 (human responsibility):
#
# UNDERSPECIFIED  Task is poorly specified → agent may abandon or do wrong
#                 work. Mitigation: human tags `planned` only when satisfied.
#
# TASK_TOO_LARGE  Task exceeds what one agent session can handle → partial
#                 work or abandon. Mitigation: human decomposes before tagging.
#
# CONCURRENT_CLAIM  Ralph and an interactive /execute session claim the same
#                 task. tk start has no guard against re-starting an in_progress
#                 task, so both succeed and work on it simultaneously. Ralph
#                 filters out in_progress tasks, but /execute does not — and
#                 even with filtering, a race window exists between listing and
#                 claiming. Mitigation: avoid running ralph while an interactive
#                 session is executing planned tasks.
#
# =============================================================================

# OS notification + terminal bell
_ralph_notify() {
  local title="$1"
  local message="$2"
  printf '\a' # terminal bell
  case "$OSTYPE" in
    darwin*)
      osascript -e "display notification \"$(printf '%s' "$message" | sed 's/["\]/\\&/g')\" with title \"$(printf '%s' "$title" | sed 's/["\]/\\&/g')\"" 2>/dev/null
      ;;
    linux*)
      if [ "$(command_exists notify-send)" = 'true' ]; then
        notify-send "$title" "$message" 2>/dev/null
      fi
      ;;
  esac
}

export -f _ralph_notify

# shellcheck disable=SC2030,SC2031
ralph() (
  set -e

  local project_dir="${1:-.}"
  cd "$project_dir" || return 1

  # --- PREREQ CHECK ---
  if [ "$(command_exists tk)" != 'true' ]; then
    echo "error: tk not found" >&2
    return 1
  fi
  if [ "$(command_exists claude)" != 'true' ]; then
    echo "error: claude not found" >&2
    return 1
  fi

  local max_tasks="${RALPH_MAX_TASKS:-0}"
  local log_dir="${RALPH_LOG_DIR:-.ralph/runs}"
  mkdir -p "$log_dir"
  local completed=0
  local failed=0

  while true; do
    # --- SELECT ---

    # Task limit check
    if [ "$max_tasks" -gt 0 ] && [ $((completed + failed)) -ge "$max_tasks" ]; then
      echo "Task limit reached ($max_tasks)."
      break
    fi

    # Get next planned task, filtering out in_progress (already claimed or failed)
    # tk ready output format: "<id>  [P<priority>][<status>] - <title>"
    local task_line
    task_line=$(tk ready -T planned 2>/dev/null | grep -v '\[in_progress\]' | head -1) || true

    if [ -z "$task_line" ]; then
      echo "No ready planned tasks."
      break
    fi

    local task_id
    task_id=$(echo "$task_line" | awk '{print $1}')

    echo "=== $task_id ==="

    # --- CLAIM ---
    tk start "$task_id"

    # --- EXECUTE ---
    local task_context
    task_context=$(tk show "$task_id")

    local core_flow
    core_flow=$(cat "$HOME/.claude/references/core-execute.md" 2>/dev/null || echo "Implement this task and verify your work.")

    local prompt
    prompt="$(cat <<EOF
$core_flow

---

Task details:
$task_context

When finished, close the task: tk close $task_id
EOF
)"

    local exit_code=0
    local log_file="$log_dir/${task_id}.json"
    claude -p "$prompt" --permission-mode acceptEdits --allowedTools "Bash(git add *),Bash(git commit *)" --output-format json > "$log_file" 2>&1 || exit_code=$?

    # --- EVAL ---
    # Agent-authoritative: check tk state, not exit code.
    # The agent is more informed than ralph about whether the work is done.
    local task_status
    task_status=$(tk show "$task_id" 2>/dev/null | grep -m1 '^status:' | awk '{print $2}') || true

    if [ "$task_status" = "closed" ]; then
      echo "  completed — log: $log_file"
      completed=$((completed + 1))
    else
      echo "  abandoned (exit code: $exit_code) — log: $log_file"
      tk tag "$task_id" abandoned 2>/dev/null || true
      tk add-note "$task_id" "ralph: agent exited without closing (exit code: $exit_code). Log: $log_file"
      _ralph_notify "Ralph: task abandoned" "$task_id — agent exited without closing"
      failed=$((failed + 1))
    fi

    # Warn on uncommitted changes — the agent should commit its own work
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
      echo "  WARNING: uncommitted changes in working tree"
    fi

    # --- NEXT (implicit: loop back to SELECT) ---
  done

  # Summary
  echo "Done. completed=$completed failed=$failed"
  if [ "$failed" -gt 0 ]; then
    _ralph_notify "Ralph: run finished" "$completed completed, $failed failed"
  fi
)

export -f ralph
