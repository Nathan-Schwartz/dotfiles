---
name: plan-to-tk
description: >-
  Convert a plan file into actionable tk tickets with dependencies.
  Researches the codebase to vet the plan, decomposes into tickets,
  verifies the decomposition, and creates tickets in tk.
argument-hint: <plan-file-path> [autonomous]
---

Convert a plan file into actionable tk tickets. The plan file path is provided as `$0`. The supervision level is `$1` — if absent or anything other than "autonomous", default to collaborative mode.

## Contract

Every ticket this skill produces MUST be:
1. Tagged `planned` and ready for ralph to execute
2. Sufficiently specified that a fresh claude session (with only the ticket context) can implement it

If this contract cannot be met, the skill MUST fail loudly rather than produce under-specified tickets. This failure signal is data for whether recursive planning is needed in the future.

## Supervision Modes

| Step | `collaborative` (default) | `autonomous` |
|---|---|---|
| Prerequisites fail | Present findings, user decides | Abort with error |
| Research/vet results | Shown to user | Silent |
| Plan amendment needed | Discuss with user | Amend and proceed |
| Decomposition | Proposed breakdown shown | Silent |
| Verification issues | Surfaced for discussion | Self-corrected |
| Pre-creation review | User approves ticket list | Skipped |
| Contract failure | Present gap via AskUserQuestion | Abort, stdout summary + OS notification |

## Phase 0: Prerequisites

Before doing any work, check for conditions that would invalidate ticket creation:

1. **Plan file**: Verify the file exists and is readable at `$0`. Abort if not found.

2. **Overlapping tickets**: Check for existing tickets that may conflict:
   ```bash
   tk list --status=open
   tk list --status=in_progress
   ```
   - If existing tickets cover the same work → alert (collaborative) or abort (autonomous)
   - If partial overlap → note them as potential dependencies for later phases

3. **Clean worktree**: Check for uncommitted changes via `git status --porcelain`
   - Warn if dirty — tickets should reference a stable codebase state

If prerequisites fail:
- `collaborative`: present findings, let user decide whether to proceed
- `autonomous`: abort with clear error message

## Phase 1: Read & Parse Plan

- Read the plan file at `$0`
- The plan may be a plain markdown file (from plan mode) or a PKM artifact (`.synth.md`). If it has YAML frontmatter, parse it — epistemic classifications in the body are meaningful. Do not decompose Guess-level claims into tickets without flagging them.
- Assess the plan's level of detail (specific files/changes vs directional approach)
- Extract: goal, approach, key components, any existing structure

## Phase 2: Research & Vet

Spawn 2-5 orthogonal `Explore` subagents to validate the plan against the codebase. Each agent examines the plan through a different lens.

All agents MUST use epistemic classification (Verified/Inferred/Guess) on their findings. This is critical for deciding whether plan amendments are warranted, especially in autonomous mode where there is no human to catch bad inferences. Use `subagent_type: "epistemic-explore"` for all research agents.

### Always spawn:

**Implementation Agent** — Validates that the plan's technical approach is sound:
- Do referenced files, patterns, APIs, and modules actually exist?
- Are there existing implementations to reuse that the plan missed?
- Does the proposed approach follow existing codebase conventions?

**Dependency Agent** — Identifies ordering constraints and external factors:
- What existing code/systems does this plan depend on?
- Are there existing tk tickets that relate to this work? (run `tk list --status=open` and `tk list --status=in_progress`)
- What sequencing constraints exist between the plan's components?

### Spawn based on plan scope:

**Architecture Agent** — For plans that affect system structure:
- Does the proposed structure fit the existing architecture?
- Are there integration points the plan missed?
- Does it introduce new patterns where existing ones would work?

**Risk Agent** — For plans with uncertainty or potential for breakage:
- What could go wrong? Breaking changes, regressions, edge cases?
- Are there performance or security implications?
- What areas of technical debt might complicate execution?

**Data/API Agent** — For plans involving data models or external interfaces:
- Do referenced schemas, endpoints, or contracts exist as described?
- Are there validation rules or constraints the plan missed?
- What external service dependencies are involved?

### Synthesize

Collect agent findings and form an assessment: does the plan hold up?

- **If plan holds up**: proceed to decomposition
- **If plan needs amendment**:
  - `collaborative`: present findings as a structured review (not a dump of agent output), then iterate with the user until the plan is solid, then proceed to decomposition. The review structure:
    1. **Organize by severity**: blockers (Verified findings that contradict plan assumptions), concerns (Inferred findings suggesting risk), and informational (context that enriches but doesn't challenge)
    2. **Group by theme**: related findings presented together so the user sees the full picture. For each group, present the evidence and a recommended resolution — the user may accept, discuss, or ignore the recommendation.
    3. **Confirm the amended understanding**: after all issues are addressed, summarize how the plan differs from the original. Get explicit confirmation before proceeding to decomposition.
  - `autonomous`: amend the plan understanding internally based on Verified/Inferred findings (never amend based on Guesses alone). If blockers exist that require human judgment to resolve, trigger contract failure rather than guessing. Proceed to decomposition.

## Phase 3: Decompose

Break the plan into discrete tk tickets.

### Sub-ticket criteria

**Create a sub-ticket when:**
- The work is independently testable
- It produces a meaningful, shippable increment
- It can be completed in a focused ralph session (single claude invocation)
- Other work depends on it completing first

**Do NOT create a sub-ticket for:**
- Trivial changes (under ~20 lines) that are part of a larger ticket
- Tightly coupled changes that must ship together to avoid a broken state
- Work that only makes sense in the context of another ticket

### Ticket hierarchy

- **Single capability** (most plans): parent is a **feature**, children are **tasks**
- **Multiple distinct capabilities**: parent is an **epic**, children are **features** — this likely means the plan is too large for one pass, which should trigger the contract failure

Features group tasks by **what they deliver** (a capability, component, or subsystem), not when they execute. If your proposed features map to "Phase 1, Phase 2, Phase 3" or "bug fixes, then features, then enhancements," you've created phases, not features. Restructure so each feature represents a coherent capability.

### Dependency direction

Children block their parents. Work flows bottom-up:

```
Task (do first) ──blocks──► Feature ──blocks──► Epic (complete last)
```

`tk dep A B` means "A depends on B" (A is blocked until B is closed).

- Parent depends on all children: `tk dep <parent_id> <child_id>`
- Between siblings with ordering constraints: `tk dep <downstream_id> <upstream_id>`

This ensures `tk ready` surfaces leaf tasks first — the actual work for ralph to execute.

### Dependency types

There are two kinds of ordering constraints between sibling tasks:

- **Logical**: task B consumes the output/artifact of task A. Fixed order.
- **Contention**: tasks modify the same file(s) and must be serialized to avoid conflicts, but either could go first. Pick the order that minimizes blocking (e.g., smaller task first to unblock the chain faster).

Both are expressed via `tk dep`. The distinction matters during decomposition — logical deps come from the plan's structure, contention deps come from file-overlap analysis.

### File-contention analysis

After decomposition, map each task to the files it will modify. Tasks that write to the same file(s) MUST be serialized via contention deps. This is a mechanical constraint — even logically independent changes conflict at the file level when executed in parallel sessions.

### Ticket content

For each ticket, write:
- **Title**: clear, action-oriented
- **Description** (`-d`): enough context for a fresh claude session to understand the work without external references
- **Design** (`--design`): implementation approach, key files to modify, and acceptance criteria
- **Verification expectations**: when the ticket involves code changes, the design must include expectations for quality checks — tests (updating existing tests and writing new ones where appropriate), linting, compilation, and any other project-specific checks. Be specific about what to run.

## Phase 4: Verify Decomposition

Agent-driven audit of the proposed ticket structure. This always runs regardless of supervision mode.

### Checklist

- **Coverage**: do the tickets fully cover the plan's goals?
- **Gaps**: is there work that falls between tickets?
- **Sizing**: is any ticket too large for a single ralph session? Is any ticket too trivial to be standalone?
- **Dependencies**: are ordering constraints correct? Check the proposed dependency graph for cycles before any tickets are created.
- **Parallelism safety**: look at which tasks `tk ready` would surface simultaneously. Do any of them modify the same files? If so, add contention deps.
- **Clarity**: could ralph (a fresh claude session receiving only the output of `tk show <id>`) execute each ticket without needing additional context?

### If issues are found

Fix them. Loop back to decompose if structural changes are needed.

### If the contract cannot be met

Some work cannot be adequately planned in this session:

- `collaborative`: present the gap to the user via `AskUserQuestion` with specifics about what areas could not be planned and why. The user may choose to narrow the scope, provide more context, or accept the limitation.
- `autonomous`: abort ticket creation entirely — all or nothing, no partial ticket state. Output a detailed failure summary to stdout explaining what areas could not be planned and why, then send an OS notification:
  ```bash
  printf '\a'
  case "$OSTYPE" in
    darwin*)
      osascript -e 'display notification "'"<summary of what couldn't be planned>"'" with title "plan-to-tk: contract failure"' 2>/dev/null
      ;;
    linux*)
      command -v notify-send >/dev/null 2>&1 && notify-send "plan-to-tk: contract failure" "<summary of what couldn't be planned>" 2>/dev/null
      ;;
  esac
  ```

Do NOT create under-specified tickets or omit the `planned` tag as a workaround.

## Phase 5: Review (collaborative only)

Skip this phase entirely in autonomous mode.

Present the full proposed ticket structure to the user:
- Parent ticket: title, type, description
- Each child ticket: title, type, description, design summary
- Dependency graph showing execution order
- Which tickets `tk ready` will surface first

Use `AskUserQuestion` to get approval or revision requests. Iterate until approved.

## Phase 6: Create Tickets

### Create parent ticket

```bash
tk create "<title>" -t <feature|epic> -p 2 -d "<description — include reference to source plan file: $0>" --design "<orchestration plan>" --tags planned
```

The parent's design field is the orchestration plan:
- Overview of the approach and how it maps to the original plan
- How child tickets fit together (what each contributes to the whole)
- Integration and verification steps to perform after all children complete

### Create child tickets

```bash
tk create "<title>" -t task -p 2 --parent <parent_id> -d "<description>" --design "<implementation approach, key files, acceptance criteria, test expectations>" --tags planned
```

### Establish dependencies

```bash
tk dep <parent_id> <child_id>          # parent blocked until child done
tk dep <downstream_id> <upstream_id>   # sibling ordering
```

If a `tk create` or `tk dep` command fails, retry it before proceeding. Partial ticket state from infrastructure failures is recoverable — the planning work is already done.

### Post-creation verification

```bash
tk dep cycle        # verify no circular dependencies
tk ready            # verify leaf tasks surface correctly
tk dep tree <parent_id>  # display the full structure
```

### Output summary

Always output:
- Parent ticket ID and title
- List of all created tickets with IDs, titles, and types
- Dependency graph / execution order
- Which tickets `tk ready` surfaces first
- Source plan file path (`$0`) for provenance

## Phase 7: Next Steps

Do NOT offer to begin implementation. The tickets are the durable handoff artifact.

Direct the user to use the `/execute` skill for interactive ticket implementation or `$ ralph` for autonomous ticket implementation. Note that:
- `/execute` can be run in a new session — tickets contain all necessary context.
- `/execute` can be run in multiple parallel sessions, but it is highly recommended to hand-pick tasks for this because:
    1. parallel tasks that touch the same files will interfere with one another and the commits would not be atomic.
    2. there is no guarantee that `/execute` won't pick up a task that's in progress in another session.
- `$ ralph` runs each task with `--permission-mode acceptEdits` (file edits auto-accepted) and `--allowedTools "Bash(git add *),Bash(git commit *)"` (only git add and git commit). It inherits both global and project-level `settings.json` permissions — so if a project allowlists the tools its tasks need (e.g., test runners, build commands), ralph can execute them. Tasks that need tools not covered by any settings.json allowlist or ralph's `--allowedTools` will fail because the non-interactive agent cannot request permission.

## Examples

### Focused Plan (single feature)

Input: `/plan-to-tk plans/add-retry-logic.md`

Plan: "Add exponential backoff retry logic to the HTTP client, with configurable max retries and circuit breaker."

Research spawns: Implementation Agent + Dependency Agent.

```
feature: Add retry logic to HTTP client (parent)
  ├── task: Add retry configuration options          ─┐
  ├── task: Implement exponential backoff strategy    ─┤ (depends on config)
  ├── task: Add circuit breaker                       ─┤ (depends on backoff)
  └── task: Add integration tests for retry behavior  ─┘ (depends on all above)
```

`tk ready` surfaces "Add retry configuration options" first.

### Broad Plan (multiple components)

Input: `/plan-to-tk plans/notification-system.md`

Plan: "Add user notification system with preferences API, email delivery, and in-app notifications."

Research spawns: Implementation + Dependency + Architecture + Data/API agents.

Detects multiple distinct capabilities → parent is an **epic**. If fully plannable:

```
epic: User notification system (parent)
  ├── feature: Notification preferences API
  │     ├── task: Add preferences schema
  │     ├── task: Create CRUD endpoints         (depends on schema)
  │     └── task: Add preference validation     (depends on endpoints)
  ├── feature: Email delivery                   (depends on preferences API)
  │     ├── task: Email template system
  │     └── task: Delivery queue integration    (depends on templates)
  └── feature: In-app notifications             (depends on preferences API)
        ├── task: Notification store
        └── task: Real-time push via WebSocket  (depends on store)
```

If the skill cannot adequately plan all features → contract failure alert listing which features need more planning.

### Thin Plan (directional)

Input: `/plan-to-tk plans/improve-api-perf.md`

Plan: "API response times are too slow. Profile the hot paths and optimize the worst offenders."

Research does heavy lifting — spawns all 5 agents. May amend the plan significantly (e.g., "the bottleneck is in the ORM layer, not the API handlers"). In collaborative mode, this amendment is discussed with the user before decomposition.
