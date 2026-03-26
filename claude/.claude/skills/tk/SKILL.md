---
name: tk
description: >-
  tk (ticket) is a bash-based, git-native task manager with zero dependencies.
  Use this knowledge when working with tasks, tickets, dependencies, or when
  any skill references tk commands.
user-invocable: false
---

# tk — Task Management

tk is a minimal ticket system with dependency tracking. Tickets are stored as markdown files in `.tickets/` within the project directory. It supports partial ID matching (e.g., `tk show 5c4` matches `nw-5c46`).

Installed from `vendor/ticket/` submodule, symlinked to `~/.local/bin/tk`.

## State Machine

Three statuses, linear progression with reopen escape:

```
open ──[tk start]──▸ in_progress ──[tk close]──▸ closed
  ▲                                                 │
  └──────────────────[tk reopen]────────────────────┘
```

## Workflow Conventions

These are not tk built-ins — they are conventions enforced by the skills and scripts in this system.

### Tags

- **`planned`** — Human-applied gate meaning "this ticket is sufficiently specified and ready for execution." Applied by `plan-to-tk`. Both ralph and `/execute` filter on this tag.
- **`abandoned`** — Applied by ralph when an agent exits without closing a task. Signals the task needs human attention. The ticket stays `in_progress` (prevents retry, blocks dependents).

### Task Selection

The standard query for finding executable work:

```bash
tk ready -T planned
```

`tk ready` returns open/in_progress tickets whose dependencies are all resolved. The `-T planned` flag filters to only those tagged `planned`. Ralph additionally filters out `in_progress` tickets to avoid re-claiming work.

### Dependency Direction

Children block parents. Work flows bottom-up:

```
task (do first) ──blocks──▸ feature ──blocks──▸ epic (complete last)
```

`tk dep A B` means "A depends on B" — A is blocked until B is closed. This ensures `tk ready` surfaces leaf tasks first.

### Ticket Hierarchy

- **epic** — multiple distinct capabilities; parent of features
- **feature** — single capability; parent of tasks
- **task** — atomic unit of work; what gets executed

## Commands Reference

### Ticket Lifecycle

```bash
tk create "<title>" [options]       # Create ticket, prints ID
  -d, --description "<text>"        # Description
  --design "<text>"                 # Design notes
  --acceptance "<text>"             # Acceptance criteria
  -t, --type <type>                 # bug|feature|task|epic|chore (default: task)
  -p, --priority <0-4>             # 0=highest (default: 2)
  -a, --assignee <name>            # Assignee
  --external-ref <ref>             # External reference (e.g., gh-123)
  --parent <id>                    # Parent ticket ID
  --id <custom-id>                 # Custom ticket ID (default: auto-generated)
  --dir <subdir>                   # Put ticket in subdirectory (auto-creates if needed)
  --tags <tag1,tag2>               # Comma-separated tags

tk start <id> [--if=STATUS] [--by=NAME]  # open → in_progress
  --if=STATUS                      # Assert current status before transitioning (fails if mismatch)
  --by=NAME                        # Record claim attribution (falls back to git user.name / $USER)
tk close <id>                       # → closed
tk reopen <id>                      # → open
tk status <id> <status>             # Set arbitrary status
```

### Dependencies

```bash
tk dep <id> <dep-id>                # id depends on dep-id
tk undep <id> <dep-id>              # Remove dependency
tk dep tree [--full] [--reverse] <id>  # Show dependency tree
  --reverse                         # Show reverse tree (which tickets depend on this one)
tk dep cycle                        # Find cycles in open tickets
```

### Querying

```bash
tk ready [-s STATUS] [--dir X] [-a <assignee>] [-T <tag>]
                                    # Tickets with deps resolved
  -s, --status=STATUS               # Filter by specific status (default: open + in_progress)
  --dir X                           # Filter by subdirectory
tk blocked [-s STATUS] [--dir X] [-a <assignee>] [-T <tag>]
                                    # Tickets with unresolved deps
  -s, --status=STATUS               # Filter by specific status (default: open + in_progress)
  --dir X                           # Filter by subdirectory
tk list [--status=<status>] [--dir X] [-a <assignee>] [-T <tag>]
                                    # List tickets (plugin)
  --dir X                           # Filter by subdirectory
  --summary                         # Show directory progress summary
tk closed [--limit=N] [--dir X] [-a <assignee>] [-T <tag>]
                                    # Recently closed tickets
  --dir X                           # Filter by subdirectory
tk show <id>                        # Display ticket details
```

### Metadata

```bash
tk add-note <id> "<text>"           # Append timestamped note
tk tag <id> <tag> [<tag2>...]       # Add tags (plugin)
tk untag <id> <tag> [<tag2>...]     # Remove tags (plugin)
tk link <id> <id> [<id>...]         # Link tickets (symmetric)
tk unlink <id> <target-id>          # Remove link
```

### Utility

```bash
tk dir                              # Print resolved .tickets/ path
tk super <cmd> [args]               # Bypass plugins, run built-in command directly
tk help                             # List commands and installed plugins
```

## Plugin System

Executables named `tk-<cmd>` or `ticket-<cmd>` in PATH are invoked automatically when you run `tk <cmd>`. This allows custom commands or overrides of built-ins.

Plugins receive two environment variables:
- `TICKETS_DIR` — path to the resolved `.tickets/` directory
- `TK_SCRIPT` — absolute path to the tk script (use `"$TK_SCRIPT" super <cmd>` to call built-ins from within a plugin)

Use `tk super <cmd>` to bypass plugins and run the built-in directly.

**Plugin descriptions** (shown in `tk help`):
- Scripts: comment `# tk-plugin: description` in first 10 lines
- Binaries: `--tk-describe` flag outputs `tk-plugin: description`

## Examples

### Create a task under a feature

```bash
parent=$(tk create "Add retry logic" -t feature -p 2 -d "Exponential backoff for HTTP client" --tags planned)
child=$(tk create "Add retry config" -t task -p 2 --parent "$parent" -d "Configuration options for max retries and backoff" --tags planned)
tk dep "$parent" "$child"
```

### Check what's ready to execute

```bash
tk ready -T planned          # What can be worked on now
tk blocked -T planned        # What's waiting on dependencies
tk dep tree "$parent"        # Visualize the full structure
```

### Task lifecycle during execution

```bash
tk start "$task_id"                          # Claim the task
# ... do the work ...
tk add-note "$task_id" "Discovered edge case, created follow-up task"
tk close "$task_id"                          # Mark complete
```
