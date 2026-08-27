---
name: discussion
description: Maintain shared state in a multi-item conversation. Repaint the open-item list whenever anything changes status, so dismissals are acknowledged and resolutions survive the session. Invoke when a turn has produced several items you will resolve out of order.
disable-model-invocation: true
---

# Discussion

## The contract

**When shared state changes, re-emit the state — not the change.**

A list scatters the moment it is resolved out of order. Answering one item is not an
acknowledgment of the two dismissed alongside it, and silence is indistinguishable from a
dismissal that never registered. Repaint the whole list instead of replying to the delta.

This works retroactively. Invoked three exchanges after the list has scattered, the first
repaint is the repair.

## The repaint

Emit after any turn where an item changes status. Every item, every time — unresolved
items carry forward rather than being dropped.

```
1A  worklist location   answered — nowhere; the list lives in the conversation
1B  ID semantics        open
2B  the trigger         dismissed — explicit invocation; the contract self-repairs
                        when invoked late, so forgetting costs the turns before you
                        noticed, not the outcome
2C  premise propagation deferred — revisit on a real instance
```

- **Every ID carries a short label.** A bare `2B` costs a trip out of the conversation to
  resolve. Four words prevent it.
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

- **It does not assign IDs.** Whatever minted the list owns that. Findings arriving from
  several agents each numbered from 1 must be deduplicated at merge time, before the list
  reaches here.
- **It does not write a file.** A worklist file records *that* items were answered rather
  than *what* the answers were, and it splits one state into two that can diverge. The
  repaint is the artifact.
- **It does not propagate dismissals.** Rejecting an item by naming a premise its siblings
  share is a cross-cutting concern arriving disguised as a per-item dismissal. Not handled
  — say so explicitly when it comes up.
