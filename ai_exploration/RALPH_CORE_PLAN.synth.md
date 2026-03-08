---
id: ralph-core-plan
summary: "Implementation plan for core ralph loop — task-per-session executor with planned gate, triage filter, and extensible artifact structure"
topics:
  - ralph-loop
  - task-management
  - trust-economics
  - autonomous-execution
  - triage
status: draft
auto_summary: false
sources:
  - AI_TOOLING.md
  - guiding_principles.md
  - pkm.synth.md
  - gap_analysis/V1.md
  - gap_analysis/V2.md
  - gap_analysis/V3.md
  - gap_analysis/D2.md
  - gap_analysis/D12.md
---

# Ralph Loop: Core Implementation Plan

## Context

AI_TOOLING.md defines a full autonomous pipeline (brainstorm → plan → triage → execute → review) with ralph as the central executor. The design is well-documented with pseudocode (AT lines 254-291, 326-357) and rigorously analyzed against external research in the gap analysis corpus.

**Why now**: Priority #1 in the document. All upstream components (triage, planning) and downstream components (review, fix-pr-comments) depend on ralph existing.

**Design grounding**: Every decision below is traceable to either AI_TOOLING.md's architecture, the gap analysis findings, or guiding_principles.md's trust economics. Where the gap analysis found a claim overstated or rejected, the plan reflects the corrected understanding.

### Key findings informing this design

- **V1 (Partial)**: The planned gate is sound engineering judgment. The research validates orchestration-over-autonomy as a principle, but AT's specific implementation (tk tags, shell loop, task-per-session) is AT's design, not a research finding. The gate is cheap and deterministic — good trust economics.
- **V2 (Partial)**: Task-per-session is justified by **isolation and verification simplicity** (one clean diff per task for review), NOT cost efficiency. The "quadratic token growth" framing compares against the wrong baseline.
- **V3 (Partial)**: Triage filters on **specification clarity**, not task type. The capability cliff (bug-fix vs feature) is a separate concern handled downstream by dialectic assessment and human review. Triage should stay focused.
- **D2 (Partial)**: Triage is a **probabilistic filter with known false-positive bias** (~43pp agent overconfidence). Downstream gates (dialectic, review) are load-bearing, not supplementary. The triage prompt should use adversarial framing and err toward NEEDS_INPUT.
- **D12 (Accepted)**: The review pipeline is a downstream confirmation pass. Its verification burden is inversely proportional to upstream gate quality. Defense in depth, not redundancy.

## Core Scope

### Building
1. `ralph` — task-per-session executor with `planned` gate
2. `ralph_triage` — pre-execution gate evaluating specification clarity
3. Basic run artifacts — `.ralph/runs/<run-id>/` with per-task results
4. `claude/CLAUDE.md` update — agent-facing task management instructions
5. Shell integration — sourcing from `.bash_profile`

### Not building (but extension points are designed in)
- Dialectic assessment / competing subagents (priority #2)
- Git worktree isolation
- Cost tracking / budget ceilings
- Review pipeline / draft PRs
- Autonomous planning (planner skill)
- Supervised mode
- Compound extensions for artifacts (pkm.synth.md integration)

## Extension Architecture

Each advanced feature plugs into a specific point without modifying core:

| Extension | Hook point | Mechanism |
|-----------|-----------|-----------|
| Dialectic assessment | Between claim and `claude -p` | Wrap execution call; populate `assessment/` subdir |
| Worktrees | Task setup/teardown | Wrap execution in `git worktree add/remove` |
| Cost tracking | After `claude -p` | `--output-format json` → parse tokens → `costs.csv` |
| Budget ceiling | After cost tracking | Check cumulative cost, break loop |
| Review pipeline | After loop completes | New `ralph_review` iterates task branches → draft PRs |
| Supervised mode | Between tasks | `RALPH_SUPERVISED=true` → confirmation prompt |
| Recent changes | Prompt construction | Prepend `git diff`/`git log` to prompt |
| Compound extensions | Artifact output | Rename files, add frontmatter, hook validation |

## Implementation

### Step 0: Verify tk CLI

Before writing code, verify tk's actual commands. Need to confirm:
- `tk ready -T <tag> --limit 1 --format json` — filtered task listing
- `tk tag <id> <tag>` — add tag to task
- `tk update <id> --status in_progress` — claim task
- `tk show <id>` — full task context
- `tk close <id>` — mark done
- `tk update <id> --note "..."` — add note

Check via `tk --help` and `vendor/ticket/` source. Adjust function calls to match actual CLI.

### File: `bash/.bash/ralph.sh` (create)

Sourceable function file following the pattern of `functions.sh`, `aliases.sh`. Functions become available as shell commands.

#### Configuration via environment variables

```bash
RALPH_MAX_TASKS    # max tasks per run; 0 = unlimited (default: 0)
RALPH_RUN_DIR      # artifact directory (default: .ralph/runs)
```

Future variables (`RALPH_BUDGET_TOKENS`, `RALPH_MAX_ROUNDS`, `RALPH_SUPERVISED`, `RALPH_MODEL`) extend this surface without core changes. Per-project overrides via direnv (AT lines 1081-1104).

#### `ralph` function

Design rationale:
- **Task-per-session** (V2): Each `claude -p` invocation gets fresh context. Justified by isolation — each task produces one clean diff for independent review, and failed work can't contaminate the next task.
- **Planned gate** (V1): `tk ready -T planned` ensures only triaged tasks execute. This is a cheap, deterministic control point — minimal ceremony (one tag) for substantial trust gain.
- **Claim-before-work**: `tk update --status in_progress` prevents the loop from retrying a task that's already running.
- **Failure → blocked**: Non-zero exit marks the task blocked with a note. The loop moves on rather than retrying — failed tasks need human attention, not blind retries.

```bash
ralph() {
  local project_dir="${1:-.}"
  cd "$project_dir" || return 1

  command_exists tk || { echo "error: tk not found" >&2; return 1; }
  command_exists claude || { echo "error: claude not found" >&2; return 1; }

  local max_tasks="${RALPH_MAX_TASKS:-0}"
  local run_dir="${RALPH_RUN_DIR:-.ralph/runs}"
  local run_id
  run_id=$(date +%Y%m%d-%H%M%S)
  local run_path="$run_dir/$run_id"
  mkdir -p "$run_path/tasks"

  local completed=0 failed=0

  while true; do
    # Task limit check
    if [ "$max_tasks" -gt 0 ] && [ $((completed + failed)) -ge "$max_tasks" ]; then
      echo "Task limit reached ($max_tasks)."
      break
    fi

    # Find next planned task
    local task
    task=$(tk ready -T planned --limit 1 --format json 2>/dev/null)

    if [ -z "$task" ]; then
      local unplanned
      unplanned=$(tk ready --format json 2>/dev/null)
      if [ -n "$unplanned" ]; then
        echo "No planned tasks. Unplanned tasks exist — run ralph_triage first."
      else
        echo "No ready tasks."
      fi
      break
    fi

    local task_id
    task_id=$(echo "$task" | jq -r '.id')
    local task_dir="$run_path/tasks/$task_id"
    mkdir -p "$task_dir"

    echo "=== $task_id ==="

    # Claim
    tk update "$task_id" --status in_progress

    # Build prompt — minimal, behavioral norms live in CLAUDE.md
    local task_context
    task_context=$(tk show "$task_id")

    local prompt
    prompt="$(cat <<EOF
Implement this task and verify your work.

Task details:
$task_context

When finished, close the task: tk close $task_id
EOF
)"

    # Execute (extension point: wrap for worktrees, assessment, cost tracking)
    if claude -p "$prompt" > "$task_dir/claude-output.txt" 2>&1; then
      echo "  completed"
      printf 'status: completed\ntask: %s\ntime: %s\n' "$task_id" "$(date -Iseconds)" > "$task_dir/result.md"
      completed=$((completed + 1))
    else
      echo "  failed"
      tk update "$task_id" --status blocked --note "ralph: non-zero exit"
      printf 'status: failed\ntask: %s\ntime: %s\n' "$task_id" "$(date -Iseconds)" > "$task_dir/result.md"
      failed=$((failed + 1))
    fi

    # Capture diff (may be empty if task committed or failed early)
    git diff > "$task_dir/diff.patch" 2>/dev/null || true
  done

  # Run summary
  cat > "$run_path/summary.md" <<EOF
# Ralph Run $run_id
completed: $completed
failed: $failed
total: $((completed + failed))
EOF

  echo "Run artifacts: $run_path"
}

export -f ralph
```

#### `ralph_triage` function

Design rationale:
- **Specification clarity filter** (V3): Triage evaluates whether a task is well-specified enough for autonomous execution. It does NOT classify task type (bug vs feature) — that's a separate concern.
- **Probabilistic filter** (D2): Agent overconfidence means triage will have false positives (ambiguous tasks classified as READY). The prompt uses adversarial framing and errs toward NEEDS_INPUT. Downstream gates (dialectic, review) compensate.
- **Adversarial framing** (D2, citing L §11): Asking "what assumptions would you make?" reduces overconfidence by ~15pp vs confirmatory framing.

```bash
ralph_triage() {
  local project_dir="${1:-.}"
  cd "$project_dir" || return 1

  command_exists tk || { echo "error: tk not found" >&2; return 1; }
  command_exists claude || { echo "error: claude not found" >&2; return 1; }

  local tasks
  tasks=$(tk ready --format json 2>/dev/null)
  [ -z "$tasks" ] && { echo "No ready tasks."; return 0; }

  local planned=0 needs_input=0

  echo "$tasks" | jq -c '.[]' | while read -r task; do
    local task_id
    task_id=$(echo "$task" | jq -r '.id')

    local triage_prompt
    triage_prompt="$(cat <<'TRIAGE_EOF'
Review this task for specification clarity. Do NOT implement it.

Evaluate:
1. Is the task specified clearly enough to implement without human input?
2. What assumptions would you need to make?
3. What risks or edge cases are not addressed?
4. What questions would you ask the task author?

Default to skepticism — when in doubt, classify as NEEDS_INPUT. A false
NEEDS_INPUT is cheap (human answers a question). A false READY is expensive
(wrong work done confidently).

If the task is unambiguously clear and safe to implement: respond READY
If not: respond NEEDS_INPUT followed by your questions.

Task:
TRIAGE_EOF
)"
    triage_prompt="$triage_prompt
$task"

    local output
    output=$(claude -p "$triage_prompt" 2>&1)

    if echo "$output" | grep -q "NEEDS_INPUT"; then
      tk update "$task_id" --note "triage: $output"
      echo "NEEDS_INPUT $task_id"
      needs_input=$((needs_input + 1))
    else
      tk tag "$task_id" planned
      echo "PLANNED    $task_id"
      planned=$((planned + 1))
    fi
  done

  echo "---"
  echo "Planned: $planned | Needs input: $needs_input"
}

export -f ralph_triage
```

### File: `claude/CLAUDE.md` (edit)

Add task management section. These are the behavioral norms that apply to every Claude session — the ralph prompt stays minimal because CLAUDE.md handles universal expectations.

```markdown
## Task Management
- Use `tk ready` to find unblocked tasks
- Use `tk show <id>` before starting work to understand full context
- Use `tk update <id> --status in_progress` when starting a task
- Use `tk close <id>` when done, with a note summarizing what was done
- Do not work on tasks that are blocked by unfinished dependencies
- If you encounter work that should be split off, use `tk create` to make a new task
- If a new task depends on or blocks the current task, use `tk dep` to set dependencies
- Verify your work before closing — run tests, check diffs, confirm the change does what the task asked
```

### File: `bash/.bash_profile` (edit)

Add after line 13 (`source ~/.bash/aliases.sh`):
```bash
source ~/.bash/ralph.sh
```

### Artifact structure

```
.ralph/
└── runs/
    └── 20260308-143022/
        ├── summary.md
        └── tasks/
            └── <task-id>/
                ├── result.md           # status, task_id, timestamp
                ├── claude-output.txt   # raw session output
                └── diff.patch          # git diff at completion
```

Extension-ready:
- `assessment/` subdir for dialectic artifacts (priority #2)
- `costs.csv` at run level for cost tracking
- `triage/` subdir for triage session output
- Files can gain compound extensions (`.synth.md`, `.triage.md`) and frontmatter per pkm.synth.md

Projects using ralph should add `.ralph/` to their `.gitignore`. Artifacts are review material, not source.

### PKM connection (future)

pkm.synth.md defines agent workflow artifacts with compound extensions:

| Core artifact | Future PKM form | What changes |
|---------------|-----------------|--------------|
| `result.md` | `result.synth.md` + frontmatter | File rename + schema |
| `summary.md` | `summary.index.md` + frontmatter | File rename + schema |
| Assessment (future) | `round-N-<role>.assessment.md` | Compound extension + severity frontmatter |
| Triage output (future) | `<task-id>.triage.md` | READY/NEEDS_INPUT frontmatter |

The same hook mechanism (PreToolUse validation) enforces structural contracts on both knowledgebase and agent artifacts. Core ralph outputs plain markdown; the extension adds typing.

## Verification

1. **Shellcheck**: `shellcheck bash/.bash/ralph.sh`
2. **Source test**: `source bash/.bash/ralph.sh && type ralph && type ralph_triage`
3. **tk CLI**: `tk --help` — confirm subcommands match function calls
4. **Triage**: `tk create "test task"` → `ralph_triage` → verify `planned` tag applied
5. **Execution**: `ralph` → verify planned task picked up, executed, artifacts written
6. **Failure**: Create a task designed to fail → verify `blocked` status + note
7. **Stow**: `stow bash` → verify `~/.bash/ralph.sh` symlinked
8. **Regression**: `./test.sh` passes

## Files

| File | Action |
|------|--------|
| `bash/.bash/ralph.sh` | Create — `ralph` and `ralph_triage` functions |
| `bash/.bash_profile` | Edit — source ralph.sh |
| `claude/CLAUDE.md` | Edit — add task management section |

Note: existing `ralph.sh` at repo root is left untouched (scratch notes).
