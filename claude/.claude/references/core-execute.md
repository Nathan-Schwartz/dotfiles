# Core Execution Flow

This defines the per-ticket execution flow for implementing a single tk ticket. Both the collaborative `/execute` skill and ralph's autonomous loop reference this flow.

## 1. Load Context

- Read the ticket: `tk show <task_id>`
- Identify: what needs to change, which files are involved, what the acceptance criteria are
- If the ticket has a parent, check the parent's design field for orchestration context: `tk show <parent_id>`
- Note any test expectations or acceptance criteria specified in the ticket

## 2. Do the Work

- Prefer TDD when practical: write or update a test first, see it fail, implement the change, see it pass
- TDD is a preference, not a rigid mandate — use judgment based on what the ticket involves
- Stay within the ticket's scope. If you discover adjacent work that needs doing, create a new ticket (`tk create`) and add dependencies (`tk dep`) rather than scope-creeping

## 3. Self-Check

Run whatever verification the ticket specifies. Common checks:

- Run the project's test suite (or the relevant subset)
- Run linters if the project uses them
- Verify compilation/build succeeds
- Manually verify the acceptance criteria from the ticket

If the ticket doesn't specify verification steps, use judgment based on what changed — at minimum, confirm the change does what the ticket asked.

## 4. Commit

- Stage only the changes you've made in service of your ticket (no blind `git add .`)
- Create a single commit for the ticket's changes. If the work naturally splits into distinct logical commits, that's acceptable — but default to one.
- Include the ticket ID in the commit message: `tk(<task_id>): <brief description of change>`

## 5. Report

Summarize the following in your response **and** persist it as a note on the ticket via `tk add-note <task_id> "<summary>"`:

- What was done (brief description of the change)
- What files were modified
- What verification was run and the results
- Anything the reviewer should pay attention to
- Any follow-up tickets created

## Edge Cases

- **Stuck or underspecified**: Add a note to the ticket (`tk add-note <task_id> "what's unclear"`) explaining what's blocking progress. Do not guess at requirements.
- **Scope creep discovered**: Create new tickets for the adjacent work. Add dependencies if the current ticket should block or be blocked by them.
- **Tests fail unexpectedly**: Investigate whether the failure is related to your change. If it's a pre-existing failure, note it. If your change caused it, fix it before reporting.

## Status Transitions

Ticket status transitions (start, close) are managed by the caller — do not call `tk start` or `tk close` unless explicitly instructed to by the invoking context.
