---
name: discussion
description: Use when a turn has produced several items — findings, questions, options, review comments, competing concerns — that will be resolved out of order over more than one exchange. Assigns stable IDs if the list arrived without them, then repaints the whole open-item list on every status change, so dismissals are acknowledged and resolutions survive the session. Also use retroactively, once a conversation has already scattered into unresolved threads.
---

# Discussion

## The contract

**When shared state changes, re-emit the state — not the change.**

A list scatters the moment it is resolved out of order. Answering one item is not an
acknowledgment of the two dismissed alongside it, and silence is indistinguishable from a
dismissal that never registered. Repaint the whole list instead of replying to the delta.

This works retroactively, which is the normal case rather than the exception — a
conversation that has fork-bombed into six open threads was never a numbered list to begin
with. Invoked three exchanges after the list has scattered, the first repaint is the
repair: reconstruct the items from the transcript, mint IDs for them, and repaint.

## Minting IDs

If the list already carries IDs, keep them. Otherwise assign them at the first repaint —
before that there is nothing for a status to attach to.

**`PREFIX-NN`.** A short uppercase topic tag, a hyphen, and a zero-padded counter that
starts at 01 within each prefix: `STATE-01`, `STATE-02`, `TRIG-01`. Invent the prefixes for
the conversation at hand — three to five characters, mnemonic, one per grouping of items
that genuinely belong together. They are ad-hoc discussion handles and deliberately
resemble nothing real; they are not ticket references and must never be carried into
commit messages, code comments, or actual trackers.

Counters are per-prefix and monotonic, so a topic that goes quiet for four turns and comes
back continues its own sequence. A grouping that turns out to be one item is fine at
`FOO-01`; a new topic mid-conversation gets a new prefix rather than being wedged into an
existing one.

Reconstructing retroactively, walk the transcript forward and group as you go, numbering
items in the order they first appeared.

**A minted prefix is frozen, including when it turns out to be wrong.** Grouping is a
judgment made before the discussion has finished revealing what the items are, so some
share of it will read badly in hindsight. Refiling an item under a better prefix is a
renumber, and it breaks every reference made to it up to that point. Leave the ID and
correct the label instead — the label is the part that is allowed to change.

Discard whatever numbering the items arrived with. Findings from several agents are each
numbered from 1 and will collide; merge and deduplicate first, then mint over the top.
Agent-side numbering is not identity — it is an artifact of how many agents ran.

## The repaint

Emit after any turn where an item changes status. Every item, every time — unresolved
items carry forward rather than being dropped.

```
STATE-01  worklist location    answered — nowhere; the list lives in the conversation
IDS-01    ID semantics         open
IDS-02    minting on merge     answered — discard agent numbering, mint over the top
TRIG-01   the trigger          dismissed — explicit invocation; the contract self-repairs
                               when invoked late, so forgetting costs the turns before you
                               noticed, not the outcome
SCOPE-01  premise propagation  deferred — revisit on a real instance
```

- **Every ID carries a short label.** The prefix narrows the topic; it does not say which
  item. A bare `IDS-02` still costs a trip out of the conversation to resolve. Four words
  prevent it.
- **Status is one of `open` / `answered` / `dismissed` / `deferred`**, optionally followed
  by free text after an em dash. The token is what makes the list scannable; the free text
  is what makes it useful.
- **A resolved item carries its resolution**, in enough detail to be lifted out. "Answered
  above" is a pointer into a conversation that is about to end. The repaint is what
  survives, so it has to hold the answer — which also means the final repaint is already a
  complete input to `/to-pkm`.
- **Never renumber.** Not on dismissal, not on reprioritization. Sort order cannot be
  identity, or references break exactly when reordering starts — the operation this exists
  to support.

## What this does not do

- **It does not write a file.** A worklist file records *that* items were answered rather
  than *what* the answers were, and it splits one state into two that can diverge. The
  repaint is the artifact.
- **It does not propagate dismissals.** Rejecting an item by naming a premise its siblings
  share is a cross-cutting concern arriving disguised as a per-item dismissal. Not handled
  — say so explicitly when it comes up.
