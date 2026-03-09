---
id: ralph-core-plan
summary: "Implementation plan for core ralph loop — task-per-session executor with planned gate, preflight filter, and extensible artifact structure"
topics:
  - ralph-loop
  - task-management
  - trust-economics
  - autonomous-execution
  - preflight
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

author:ralph-agent — task created by the executing agent during a ralph loop
author:planner — task created by /planner decomposition
(no author tag) — human-created
 
implement: tk tag


---
#	Category	Status	Summary
1 No formal verification for AC Open  no way to identify if agent closed ticket improperly without manual review.
5	Critical	Documented	Preflight has no codebase access — evaluates prose, not implementability
7	Critical	Documented	Agent self-expansion loop. Constraints + known gap documented. author:ralph-agent tag will make it observable.
8	Fragility	Open	Text-parsing tk ready output — coupled to undocumented format
10	Fragility	Documented	_resolve_tickets_dir duplication — tracked as tk gap (tk root)

---



# Ralph Loop: Core Implementation Plan

## Context

AI_TOOLING.md defines a full autonomous pipeline (brainstorm → plan → preflight → execute → review) with ralph as the central executor. The design is well-documented with pseudocode (AT lines 254-291, 326-357) and rigorously analyzed against external research in the gap analysis corpus.

**Why now**: Priority #1 in the document. All upstream components (preflight, planning) and downstream components (review, fix-pr-comments) depend on ralph existing.

**Design grounding**: Every decision below is traceable to either AI_TOOLING.md's architecture, the gap analysis findings, or guiding_principles.md's trust economics. Where the gap analysis found a claim overstated or rejected, the plan reflects the corrected understanding.

### Key findings informing this design

- **V1 (Partial)**: The planned gate is sound engineering judgment. The research validates orchestration-over-autonomy as a principle, but AT's specific implementation (tk tags, shell loop, task-per-session) is AT's design, not a research finding. The gate is cheap and deterministic — good trust economics.
- **V2 (Partial)**: Task-per-session is justified by **isolation and verification simplicity** (one clean diff per task for review), NOT cost efficiency. The "quadratic token growth" framing compares against the wrong baseline.
- **V3 (Partial)**: Preflight filters on **specification clarity**, not task type. The capability cliff (bug-fix vs feature) is a separate concern handled downstream by dialectic assessment and human review. Preflight should stay focused.
- **D2 (Partial)**: Preflight is a **probabilistic filter with known false-positive bias** (~43pp agent overconfidence). Downstream gates (dialectic, review) are load-bearing, not supplementary. The preflight prompt should use adversarial framing and err toward NEEDS_INPUT.
- **D12 (Accepted)**: The review pipeline is a downstream confirmation pass. Its verification burden is inversely proportional to upstream gate quality. Defense in depth, not redundancy. **Note: v1 ships without the downstream gates (dialectic, review). Until those exist, preflight is the only automated quality gate — the human review of diffs and artifacts is load-bearing, not optional.**

## Core Scope

### Building
1. `ralph` — task-per-session executor with `planned` gate and inline preflight
2. `ralph_preflight` — pre-execution gate evaluating specification clarity
3. Basic run artifacts — `.ralph/runs/<run-id>/` with per-task results
4. `claude/CLAUDE.md` update — agent-facing task management instructions
5. Shell integration — sourcing from `.bash_profile`

### Not building (but extension points are designed in)
- Dialectic assessment / competing subagents (priority #2)
- Git worktree isolation
- Cost tracking / budget ceilings
- Review pipeline (structured commit review, not PRs/branches)
- Autonomous planning (`/planner` skill) — see [Relationship: `/planner` vs `ralph_preflight`](#relationship-planner-vs-ralph_preflight)
- Supervision / ambiguity posture (loop-level checkpoints + agent behavioral bias toward pausing vs proceeding)
- Compound extensions for artifacts (pkm.synth.md integration)

## Extension Architecture

Each advanced feature plugs into a specific point without modifying core:

| Extension | Hook point | Mechanism |
|-----------|-----------|-----------|
| Dialectic assessment | Between claim and `claude -p` | Wrap execution call; populate `assessment/` subdir |
| Worktrees | Task setup/teardown | Wrap execution in `git worktree add/remove` |
| Cost tracking | After `claude -p` | Parse `claude.json` (saved in core) → extract tokens/cost → `costs.csv` rollup |
| Budget ceiling | After cost tracking | Check cumulative `costs.csv`; supports `RALPH_BUDGET_TOKENS` (plan-agnostic) and `RALPH_BUDGET_USD` (convenience) |
| Review pipeline | After loop completes | Walk ralph commits, present each with its artifacts for accept/revert. Commits are the reviewable unit — no branches or PRs needed. |
| Supervision | Two dimensions | Loop-level: between-task checkpoints (review diff, accept/reject/abort). Agent-level: CLAUDE.md behavioral bias toward pausing on ambiguity vs proceeding with assumptions. These compose — neither alone is sufficient. |
| Compound extensions | Artifact output | Rename files, add frontmatter, hook validation |
| `/planner` skill | Upstream of preflight | Decomposes large tickets into sub-tasks; trivial leaves get `planned` tag directly. See [relationship section](#relationship-planner-vs-ralph_preflight). |

## Relationship: `/planner` vs `ralph_preflight`

These are **not competing gates** — they serve different roles at different cost points.

**`/planner`** is the happy path for complex work. It runs multi-phase research (parallel Explore subagents), decomposes a large ticket into sub-tasks with design notes and dependency ordering, and tags trivial leaf tasks `planned` directly. When `/planner` tags something `planned`, that classification is backed by thorough analysis — it has read the codebase, considered the decomposition, and written design notes justifying why the task is implementable. This is the highest-quality path to a `planned` tag.

**`ralph_preflight`** is the universal fast-gate. It applies to tasks from **any source** — manually created tickets, tasks that become ready mid-loop when dependencies close, or anything else that arrives in `tk ready` without a `planned` tag. It runs one cheap `claude -p` call with adversarial framing to check specification clarity. It is the minimum bar, not the gold standard.

The key asymmetry: `/planner` produces well-specified tasks as a byproduct of its decomposition work. `ralph_preflight` *only* checks specification clarity — it does no research, no decomposition, no design. This means:

- **Planner-produced `planned` tasks skip preflight.** The planner's analysis is strictly stronger than what preflight would do. Preflight's idempotency check (skip tasks already tagged `planned`) handles this automatically.
- **Everything else goes through preflight.** Manual tasks, dependency-wave tasks, imported tasks — if it doesn't have a `planned` tag, preflight evaluates it.
- **No double-evaluation.** A task either went through the planner (thorough path) or through preflight (fast path), never both.

**Observability gap**: The `planned` tag flattens two very different confidence levels into a single boolean. Ralph cannot distinguish a planner-vetted task (thorough codebase analysis) from a preflight-approved task (one-shot prose clarity check). This information is lost at execution time. **Mitigation for v1**: preflight adds a note (`tk add-note`) recording its evaluation; the planner should do the same with its design notes. The provenance is recoverable from task notes, but ralph doesn't surface it. **Future option**: use distinct tags (`planned:planner`, `planned:preflight`) if routing decisions need to vary by provenance — e.g., skipping review for planner-produced tasks.

```
                    ┌─────────────┐
                    │  tk create  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         complex work              simple work
              │                         │
              ▼                         │
      ┌───────────────┐                 │
      │   /planner    │                 │
      │  (thorough)   │                 │
      └───────┬───────┘                 │
              │                         │
         trivial leaves            all tasks without
         get `planned`             `planned` tag
              │                         │
              │              ┌──────────┴──────────┐
              │              │  ralph_preflight     │
              │              │  (fast adversarial)  │
              │              └──────────┬──────────┘
              │                         │
              └────────────┬────────────┘
                           │
                     `planned` tag
                           │
                           ▼
                    ┌─────────────┐
                    │    ralph    │
                    └─────────────┘
```

**Escape hatch for later**: If experience shows preflight should also validate planner-produced tasks (e.g., the planner's trivial/non-trivial heuristic proves unreliable), remove the idempotency skip for `planned` tasks in preflight. The adversarial check becomes a universal second opinion. But start without it — the planner's analysis is expensive enough that rubber-stamping it with a cheaper model is likely waste.

## Implementation

### tk CLI (verified against `tk --help` output, 2026-03-09)

- `tk ready` — returns tasks with status open OR in_progress AND all dependencies closed. **Dependency resolution is built in** — ralph does not need to check deps separately. Ralph filters out `in_progress` tasks (already claimed or previously failed) via `grep -v '\[in_progress\]'`.
- `tk ready -T <tag>` — filters by tag.
- `tk ready` does NOT support `--format json` or `--limit N`. Output is plain text: `<id>  [P<priority>][<status>] - <title>`. Parse task ID from first field.
- `tk start <id>` — set status to in_progress (claim task)
- `tk status <id> <status>` — update status (open|in_progress|closed)
- `tk show <id>` — full task context
- `tk close <id>` — mark done
- `tk add-note <id> [text]` — append timestamped note
- `tk list [-T <tag>]` — list tickets (bundled plugin)

#### tk gaps: commands assumed but not yet available

The pseudocode below assumes tk capabilities that **do not currently exist**:

1. **`tk tag <id> <tag>`** — add a tag to an existing ticket. Tags are set at create time (`--tags`) and stored in YAML frontmatter, but there is no mutation command. Ralph needs this to tag tasks `planned` and `needs_input` in preflight. **Resolution options**: write a tk plugin, write a shell helper that edits frontmatter, or add the command upstream to tk. **Blocking** — must be resolved before ralph can run. The pseudocode uses `tk tag` as-if it exists, with TODO comments marking each call site.

2. **`tk root`** (or `tk config tickets-dir`) — print the resolved `.tickets/` path. tk resolves this by walking parent directories (or `TICKETS_DIR` env var), but doesn't expose the result. Ralph reimplements the walk logic in `_resolve_tickets_dir` to log which ticket store is in scope — useful when multiple projects have `.tickets/` dirs at different levels. **Non-blocking** — the workaround works, but creates drift risk if tk changes its resolution logic. The walk is simple enough that silent drift is unlikely (failure would be loud: "no `.tickets/` found"), but this is still tech debt.

**Resolved: `blocked` status is not needed.** Failed tasks stay `in_progress` (from `tk start`) — this prevents erroneous dependency unblocking (`tk ready` only unblocks deps when predecessors are `closed`). Ralph filters out `in_progress` tasks from `tk ready` output via `grep -v '\[in_progress\]'`, preventing retry loops. A `tk add-note` records the failure. Once `tk tag` exists, adding a `failed` tag will improve discoverability (`tk list -T failed`).

### File: `bash/.bash/ralph.sh` (create)

Sourceable function file following the pattern of `functions.sh`, `aliases.sh`. Functions become available as shell commands.

#### Configuration via environment variables

```bash
RALPH_MAX_TASKS      # max tasks per run; 0 = unlimited (default: 0)
RALPH_RUN_DIR        # artifact directory (default: .ralph/runs)
RALPH_AUTO_PREFLIGHT # true = preflight inline when unplanned tasks found (default: true)
                     # false = stop and prompt user to run ralph_preflight manually
```

Future variables (`RALPH_BUDGET_TOKENS`, `RALPH_BUDGET_USD`, `RALPH_MAX_ROUNDS`, `RALPH_MODEL`, and supervision-related controls TBD) extend this surface without core changes. `RALPH_BUDGET_TOKENS` is plan-agnostic; `RALPH_BUDGET_USD` uses the CLI's reported cost (convenient but plan-dependent). Per-project overrides via direnv (AT lines 1081-1104).

#### `ralph` function

Design rationale:
- **Task-per-session** (V2): Each `claude -p` invocation gets fresh context. Justified by isolation — each task produces one clean diff for independent review, and failed work can't contaminate the next task.
- **Planned gate** (V1): `tk ready -T planned` ensures only preflight-approved tasks execute. This is a cheap, deterministic control point — minimal ceremony (one tag) for substantial trust gain.
- **Inline preflight**: When no planned tasks remain but unplanned ready tasks exist, ralph calls `ralph_preflight` to evaluate them. This solves the dependency-wave problem — tasks that become ready mid-loop (because predecessors were just closed) get preflighted and executed without stopping the loop. Controlled by `RALPH_AUTO_PREFLIGHT` (default: true). **Trust note**: inline preflight prints per-task evaluation results (PLANNED/NEEDS_INPUT/SKIP) to the terminal in real time. The human can observe which tasks were auto-approved, but this is a post-hoc or passive check — inline preflight trades the planned gate's proactive human checkpoint for throughput. This is an acceptable tradeoff for the dependency-wave case; for higher-stakes projects, set `RALPH_AUTO_PREFLIGHT=false`.
- **Dependencies for free**: `tk ready` only returns tasks whose dependencies are all closed (ticket:707-719). No additional dependency checking needed.
- **Subshell isolation**: Both `ralph` and `ralph_preflight` use `( )` (subshell) instead of `{ }` so `cd "$project_dir"` doesn't change the caller's working directory.
- **Claim-before-work**: `tk start` prevents the loop from retrying a task that's already running.
- **Agent-authoritative completion**: The agent owns `tk close` — it is more informed than ralph about whether the work is actually done. After `claude -p` exits, ralph checks tk state (not exit code) to determine outcome. If the task is `closed` in tk, it succeeded — ralph respects the agent's judgment. If the task is not `closed`, the agent abandoned it (crash, timeout, confusion) — ralph tags it `abandoned`, leaves it `in_progress`, and moves on. `in_progress` prevents retry and blocks dependents by construction. Exit code is captured in artifacts for diagnostics but does not drive the state machine.

```bash
ralph() (
  local project_dir="${1:-.}"
  cd "$project_dir" || return 1

  [ "$(command_exists tk)" = 'true' ] || { echo "error: tk not found" >&2; return 1; }
  [ "$(command_exists claude)" = 'true' ] || { echo "error: claude not found" >&2; return 1; }

  local max_tasks="${RALPH_MAX_TASKS:-0}"
  local auto_preflight="${RALPH_AUTO_PREFLIGHT:-true}"
  local run_dir="${RALPH_RUN_DIR:-.ralph/runs}"
  local run_id
  run_id="$(date +%Y%m%d-%H%M%S)-$(head -c4 /dev/urandom | xxd -p)"
  local run_path="$run_dir/$run_id"
  mkdir -p "$run_path/tasks"

  # Resolve and log .tickets/ location
  local tickets_dir
  if ! tickets_dir=$(_resolve_tickets_dir "$PWD"); then
    echo "error: no .tickets/ directory found (searched parent directories from $PWD)" >&2
    return 1
  fi
  echo "Tickets:  $tickets_dir"
  echo "Artifacts: $run_path"

  local completed=0 failed=0

  while true; do
    # Task limit check
    if [ "$max_tasks" -gt 0 ] && [ $((completed + failed)) -ge "$max_tasks" ]; then
      echo "Task limit reached ($max_tasks)."
      break
    fi

    # Find next planned task (tk ready filters deps automatically)
    # Filter out in_progress tasks (already claimed or previously failed)
    # Output format: "<id>  [P<priority>][<status>] - <title>"
    local task_line
    task_line=$(tk ready -T planned 2>/dev/null | grep -v '\[in_progress\]' | head -1)

    if [ -z "$task_line" ]; then
      # No planned tasks — check for unplanned ready tasks
      local unplanned
      unplanned=$(tk ready 2>/dev/null | grep -v '\[in_progress\]' | head -1)

      if [ -z "$unplanned" ]; then
        echo "No ready tasks."
        break
      fi

      if [ "$auto_preflight" = "true" ]; then
        echo "No planned tasks. Running preflight on ready tasks..."
        ralph_preflight "$project_dir"
        # Re-check: did preflight produce any planned tasks?
        task_line=$(tk ready -T planned 2>/dev/null | grep -v '\[in_progress\]' | head -1)
        if [ -z "$task_line" ]; then
          echo "Preflight found no tasks ready for execution."
          break
        fi
      else
        echo "No planned tasks. Unplanned tasks exist — run ralph_preflight first."
        break
      fi
    fi

    local task_id
    task_id=$(echo "$task_line" | awk '{print $1}')
    local task_dir="$run_path/tasks/$task_id"
    mkdir -p "$task_dir"

    echo "=== $task_id ==="

    # Claim
    tk start "$task_id"

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

    # Snapshot HEAD before execution (for diff capture)
    local head_before
    head_before=$(git rev-parse HEAD 2>/dev/null)

    # Execute (--output-format json enables cost tracking as a pure extension)
    # stderr kept separate — mixing it into json corrupts the file for downstream parsing.
    local exit_code=0
    claude -p "$prompt" --output-format json > "$task_dir/claude.json" 2>"$task_dir/claude.stderr" || exit_code=$?

    # Agent-authoritative: check tk state, not exit code
    local task_status
    task_status=$(tk show "$task_id" 2>/dev/null | grep -m1 '^status:' | awk '{print $2}')

    if [ "$task_status" = "closed" ]; then
      echo "  completed"
      printf 'status: completed\ntask: %s\nexit_code: %s\ntime: %s\n' \
        "$task_id" "$exit_code" "$(date -Iseconds)" > "$task_dir/result.md"
      completed=$((completed + 1))
    else
      echo "  abandoned (agent exited without closing)"
      # TODO: tk does not have a 'tag' command — need plugin or helper.
      tk tag "$task_id" abandoned
      tk add-note "$task_id" "ralph: agent exited without closing (exit code: $exit_code)"
      printf 'status: abandoned\ntask: %s\nexit_code: %s\ntime: %s\n' \
        "$task_id" "$exit_code" "$(date -Iseconds)" > "$task_dir/result.md"
      failed=$((failed + 1))
    fi

    # Capture what the agent committed
    local head_after
    head_after=$(git rev-parse HEAD 2>/dev/null)
    if [ "$head_before" != "$head_after" ]; then
      echo "$head_after" > "$task_dir/commit"
      git diff "$head_before".."$head_after" > "$task_dir/diff.patch" 2>/dev/null
    fi
    # Warn on uncommitted changes — agent should commit its work
    if ! git diff --quiet 2>/dev/null; then
      echo "  WARNING: uncommitted changes left in working tree"
    fi
  done

  # Run summary
  cat > "$run_path/summary.md" <<EOF
# Ralph Run $run_id
completed: $completed
failed: $failed
total: $((completed + failed))
EOF

  echo "Run artifacts: $run_path"
)

export -f ralph
```

#### `ralph_preflight` function

Design rationale:
- **Universal fast-gate**: Preflight is the minimum bar for any task entering the ralph loop, regardless of source. Manually created tasks, dependency-wave tasks that become ready mid-loop, imported tasks — anything without a `planned` tag goes through preflight. Tasks produced by `/planner` (which does thorough analysis) arrive pre-tagged `planned` and skip this check. See [relationship section](#relationship-planner-vs-ralph_preflight).
- **Specification clarity filter** (V3): Preflight evaluates whether a task is well-specified enough for autonomous execution. It does NOT classify task type (bug vs feature) — that's a separate concern. **Critical limitation**: preflight sees only `tk show` output — it has no codebase access. It evaluates *clarity of specification language*, not *implementability given what exists*. A task like "fix the parser bug" may read as clear but be ambiguous if three parsers exist. Preflight catches underspecified prose; it cannot catch specification-codebase mismatches. This is a known gap — the downstream execution agent (which has codebase access) is where implementability is actually tested. If preflight proves insufficient, the escape hatch is to give preflight a `--with-context` mode that runs `claude` with a working directory instead of `claude -p`.
- **Probabilistic filter** (D2): Agent overconfidence means preflight will have false positives (ambiguous tasks classified as READY). The prompt uses adversarial framing and errs toward NEEDS_INPUT. Downstream gates (dialectic, review) compensate.
- **Adversarial framing** (D2, citing L §11): Asking "what assumptions would you make?" reduces overconfidence by ~15pp vs confirmatory framing.
- **Idempotent**: Skips tasks already tagged `planned` or `needs_input` by checking `tk list -T <tag>` — delegates tag matching to tk instead of regex-parsing YAML frontmatter. Safe to call repeatedly — from the ralph loop inline or standalone. This is also the mechanism that prevents double-evaluation of planner-produced tasks.
- **Tags rejected tasks**: NEEDS_INPUT tasks get a `needs_input` tag (in addition to a note with questions). This prevents the ralph loop from re-triaging the same task on every iteration.
- **Async notification**: OS-level notification (macOS/Linux) + terminal bell on NEEDS_INPUT. The notification is a best-effort nudge — dismissable, non-persistent. The durable record is the tk tag + note: `tk list -T needs_input` finds outstanding items, `tk show <id>` has the preflight questions. Run artifacts (`claude-output.txt`, etc.) live at the run path logged at startup.
- **Explicit `.tickets/` logging**: tk resolves `.tickets/` by walking parent directories (or `TICKETS_DIR` env var), so it could be anywhere up the tree. Preflight logs the resolved path at startup so the human knows which ticket store is in scope.

```bash
# Notification helper — OS notification + terminal bell
_ralph_notify() {
  local title="$1"
  local message="$2"
  printf '\a'  # terminal bell
  case "$OSTYPE" in
    darwin*) osascript -e 'display notification "'"$(printf '%s' "$message" | sed 's/["\]/\\&/g')"'" with title "'"$(printf '%s' "$title" | sed 's/["\]/\\&/g')"'"' 2>/dev/null ;;
    linux*)  command_exists notify-send && notify-send "$title" "$message" 2>/dev/null ;;
  esac
}

export -f _ralph_notify

# Resolve .tickets/ directory (mirrors tk's parent-walking logic)
_resolve_tickets_dir() {
  if [ -n "${TICKETS_DIR:-}" ]; then
    echo "$TICKETS_DIR"
    return 0
  fi
  local dir="${1:-$PWD}"
  while [ "$dir" != "/" ]; do
    if [ -d "$dir/.tickets" ]; then
      echo "$dir/.tickets"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

export -f _resolve_tickets_dir

ralph_preflight() (
  local project_dir="${1:-.}"
  cd "$project_dir" || return 1

  [ "$(command_exists tk)" = 'true' ] || { echo "error: tk not found" >&2; return 1; }
  [ "$(command_exists claude)" = 'true' ] || { echo "error: claude not found" >&2; return 1; }

  # Resolve and log .tickets/ location
  local tickets_dir
  if ! tickets_dir=$(_resolve_tickets_dir "$PWD"); then
    echo "error: no .tickets/ directory found (searched parent directories from $PWD)" >&2
    return 1
  fi
  echo "Tickets: $tickets_dir"

  local task_lines
  task_lines=$(tk ready 2>/dev/null)
  [ -z "$task_lines" ] && { echo "No ready tasks."; return 0; }

  local planned=0 needs_input=0 skipped=0

  # tk ready output: "<id>  [P<priority>][<status>] - <title>"
  while read -r line; do
    local task_id
    task_id=$(echo "$line" | awk '{print $1}')
    [ -z "$task_id" ] && continue

    # Get full task context (also used for tag check and prompt)
    local task_detail
    task_detail=$(tk show "$task_id")

    # Skip already-evaluated tasks — use tk's own tag filtering instead of parsing YAML
    if tk list -T planned 2>/dev/null | grep -q "^$task_id " || \
       tk list -T needs_input 2>/dev/null | grep -q "^$task_id "; then
      echo "  SKIP       $task_id (already evaluated)"
      skipped=$((skipped + 1))
      continue
    fi

    echo "  EVALUATING $task_id ..."

    local preflight_prompt
    preflight_prompt="$(cat <<'PREFLIGHT_EOF'
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
PREFLIGHT_EOF
)"
    preflight_prompt="$preflight_prompt
$task_detail"

    local output
    output=$(claude -p "$preflight_prompt" 2>&1)

    if echo "$output" | grep -q "^READY"; then
      # TODO: tk does not have a 'tag' command — need plugin or helper to add tags to existing tickets.
      tk tag "$task_id" planned
      echo "  PLANNED     $task_id"
      planned=$((planned + 1))
    else
      # Default to NEEDS_INPUT — a false NEEDS_INPUT is cheap, a false READY is expensive.
      # TODO: tk does not have a 'tag' command — need plugin or helper to add tags to existing tickets.
      tk tag "$task_id" needs_input
      tk add-note "$task_id" "preflight: $output"
      echo "  NEEDS_INPUT $task_id — review: tk show $task_id ($tickets_dir/$task_id.md)"
      _ralph_notify "Ralph: needs input" "$task_id requires clarification. Run: tk show $task_id"
      needs_input=$((needs_input + 1))
    fi
  done <<< "$task_lines"

  echo "---"
  echo "Planned: $planned | Needs input: $needs_input | Skipped: $skipped"
  if [ "$needs_input" -gt 0 ]; then
    echo "Review items needing input: tk list -T needs_input"
  fi
)

export -f ralph_preflight
```

### File: `claude/CLAUDE.md` (edit)

Add task management section. These are the behavioral norms that apply to every Claude session — the ralph prompt stays minimal because CLAUDE.md handles universal expectations.

```markdown
## Task Management
- Use `tk ready` to find unblocked tasks
- Use `tk show <id>` before starting work to understand full context
- Use `tk start <id>` when starting a task
- Use `tk close <id>` when done, with a note summarizing what was done
- Do not work on tasks that are blocked by unfinished dependencies
- If you encounter work that should be split off, use `tk create` to make a new task
- If a new task depends on or blocks the current task, use `tk dep` to set dependencies
- **Do not create tasks that are unrelated to the current task** — only split off work discovered during implementation
- Verify your work before closing — run tests, check diffs, confirm the change does what the task asked
```

### Agent-created tasks and scope expansion

The CLAUDE.md instructions permit the executing agent to `tk create` new tasks and `tk dep` to set dependencies. This is intentional — agents discover necessary sub-work during implementation. But combined with inline preflight (`RALPH_AUTO_PREFLIGHT=true`), this creates a self-feeding loop: agent creates task → preflight auto-approves → ralph executes in the same run.

**Constraints**:
- `RALPH_MAX_TASKS` bounds total iterations (human-created and agent-created combined)
- CLAUDE.md restricts `tk create` to work discovered during implementation of the current task (no unrelated tasks)
- Agent-created tasks still pass through preflight — they don't get automatic `planned` tags

**Known gap**: There is no mechanism to distinguish human-created from agent-created tasks in the queue. `RALPH_MAX_TASKS` is the only hard bound. For v1, this is acceptable — the human reviews diffs post-run. If agent scope creep becomes a problem, options include: a `source:agent` tag on agent-created tasks (for visibility), a separate `RALPH_MAX_AGENT_TASKS` limit, or requiring agent-created tasks to go through planner-level evaluation instead of fast preflight.

### File: `bash/.bash_profile` (edit)

Add after line 14 (`source ~/.bash/powerline.sh`) — after all existing shell config is loaded:
```bash
source ~/.bash/ralph.sh
```

### Artifact structure

```
.ralph/
└── runs/
    └── 20260308-143022-a1b2c3d4/
        ├── summary.md
        └── tasks/
            └── <task-id>/
                ├── result.md           # status, task_id, exit_code, timestamp
                ├── claude.json         # raw session output (--output-format json)
                ├── claude.stderr       # stderr from claude invocation
                ├── commit              # commit hash (only if agent committed)
                └── diff.patch          # committed diff (only if agent committed)
```

Extension-ready:
- `assessment/` subdir for dialectic artifacts (priority #2)
- `costs.csv` at run level — derived from per-task `claude.json` for budget ceiling and stats
- `preflight/` subdir for preflight session output

Projects using ralph should add `.ralph/` to their `.gitignore`. Artifacts are review material, not source.

### Cost tracking design notes

Findings from testing `claude -p --output-format json` (verified 2026-03-08):

- **Four token types, not two.** `usage.input_tokens` (non-cached), `usage.cache_creation_input_tokens`, `usage.cache_read_input_tokens`, `usage.output_tokens`. Ignoring cache tokens drastically undercounts — in a simple test, `input_tokens` was 3 while cache tokens totaled ~18K.
- **`total_cost_usd` is plan-dependent.** The CLI computes USD at runtime based on current pricing tier. Token counts are the plan-agnostic invariant — store all four types, derive USD at read time if cross-run consistency matters.
- **`num_turns` and `modelUsage` are available.** Turn count is a useful complexity proxy. `modelUsage` gives per-model token breakdowns, supporting multi-model routing if added later.
- **Session-level aggregates.** The schema structure (`num_turns`, `total_cost_usd`) indicates cumulative session tracking. Context window compression mid-session should be reflected in totals, though this has only been verified for single-turn sessions.
- **JSON schema stability is unverified.** These fields are not documented with stability guarantees. The cost tracking extension should validate expected fields exist and degrade gracefully if the schema changes.

### Artifact typing

Agent artifacts use **frontmatter `kind:` fields** instead of compound extensions. Compound extensions earn their keep for knowledgebase documents (flat namespace, many files, diverse tooling), but ralph artifacts already live in a scoped directory hierarchy — `.ralph/runs/<id>/tasks/<id>/` — so the directory structure provides the routing that compound extensions would otherwise supply.

Hooks validate artifact schemas via **directory-based globs** (e.g., `.ralph/runs/**/assessment/*.md`), not filename patterns. This avoids inventing a parallel compound extension namespace for agent artifacts and sidesteps the `.synth.md` (knowledgebase) vs `.synthesis.md` (agent) naming collision flagged in pkm.synth.md.

Specific artifact types (result, plan, assessment, synthesis, changelog) may benefit from **path-scoped Claude rules** that load relevant context when working on those files — e.g., a rule matching `.ralph/runs/**/assessment/` that reinforces severity classification requirements.

### Promotion to durable knowledge

Promotion of ralph artifacts into the PKM knowledge base (`.ref.md`, `.synth.md`) is **out of scope for the ralph loop**. Ralph's job is execute-and-record. At task completion, you don't yet know which findings are durable — that judgment requires seeing how findings hold up across multiple tasks. The executing agent is also the worst judge of what's worth promoting (same overconfidence problem that justifies adversarial preflight).

Promotion is a separate, lazy process — human-triggered or periodically-triggered — that takes reviewed ralph artifacts as input and produces knowledgebase documents. Ralph makes promotion easy by producing well-structured artifacts with frontmatter (`summary`, `topics`, `sources`); the *decision to promote* happens later.

The `/to-pkm` skill handles a related but distinct case: converting *conversation* content (from any session, not just ralph) into PKM artifacts via manifest-first review. Ralph artifact promotion — selecting which *task outputs* are worth preserving as durable knowledge — remains a separate concern.

## Verification

1. **Shellcheck**: `shellcheck bash/.bash/ralph.sh`
2. **Source test**: `source bash/.bash/ralph.sh && type ralph && type ralph_preflight`
3. **tk CLI**: `tk --help` — confirm subcommands match function calls
4. **Preflight**: `tk create "test task"` → `ralph_preflight` → verify `planned` tag applied
5. **Preflight rejection**: Create an ambiguous task → `ralph_preflight` → verify `needs_input` tag applied + note attached
6. **Idempotent preflight**: Run `ralph_preflight` twice → verify already-tagged tasks are skipped
7. **Execution**: `ralph` → verify planned task picked up, executed, artifacts written
8. **Inline preflight**: Create task with dep → close dep → verify ralph auto-preflights and executes the newly-ready task
9. **Failure**: Create a task designed to fail → verify task stays `in_progress` + note attached + ralph skips it on next iteration
7. **Stow**: `stow bash` → verify `~/.bash/ralph.sh` symlinked
8. **Regression**: `./test.sh` passes

## Files

| File | Action |
|------|--------|
| `bash/.bash/ralph.sh` | Create — `ralph` and `ralph_preflight` functions |
| `bash/.bash_profile` | Edit — source ralph.sh |
| `claude/CLAUDE.md` | Edit — add task management section |

Note: existing `ralph.sh` at repo root is left untouched (scratch notes).
