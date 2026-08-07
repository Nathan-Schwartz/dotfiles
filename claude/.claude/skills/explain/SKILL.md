---
name: explain
description: Use when the user wants to understand something in or behind the session — missing background on a service or system, work that was completed autonomously without exposing details, ambiguities or second-order effects of a plan or proposal, or a complex flow that is hard to follow.
disable-model-invocation: true
---

Close the gap between what you know and what the user knows. An explanation is not a work product — it is a verification-cost reducer. Success means the user can reason about the subject without you.

## Invocation

- `/explain <topic or question>` — deliver the explanation immediately, shaped by the contract below.
- `/explain` (bare) — dialogue first. Do not guess the target and dump. Identify the 2-4 most plausible gaps from recent context (latest autonomous work, active plan or proposal, the system under discussion) and ask one question — prefer AskUserQuestion with those candidates. One question, not an interview; once the target is known, explain.

## The Explanation Contract

The response is built top-down, in this order:

1. **Mental model** — 2-4 sentences that let the reader predict the system's behavior. A reader who stops here should leave with a correct, if coarse, model.
2. **Structure** — the moving parts and how they connect. When the subject is a flow, lifecycle, state machine, or topology, include a diagram: mermaid or ASCII in the terminal. If a rendered diagram would be substantially clearer (large graphs, parallel timelines), offer a private artifact — suggest, don't publish unprompted.
3. **Selective depth** — expand only what is surprising, load-bearing, or targeted by the user's question. Depth is allocated by importance, not uniformly: exhaustive coverage transfers reading burden, not understanding.
4. **Boundaries and second-order effects** — where the explanation stops, what the subject touches elsewhere, and (for plans/proposals) the non-obvious consequences and ambiguities still open.
5. **Drill-down directions** — close with 2-3 named directions the user can pick to go deeper, including anything you did not check.

Calibrate the starting altitude to what the user has already shown they know; skip re-explaining what the session established.

## Explaining Your Own Autonomous Work

Explain the system and the problem, not your process. The diff is the changelog; the explanation is the understanding needed to review it. Lead with how the affected component works, then why the observed behavior emerged, then what the change alters — not a chronological narration of your investigation.

## Grounding

- Claims about code cite `file:line`. Targeted reads to confirm a claim are fine; do not launch research subagents unless the gap requires open-ended exploration and the user agrees.
- Global epistemic classification rules apply. Label load-bearing claims; do not tag every sentence — readability is the point of this skill. Unverified material belongs in the drill-down/not-checked section, not silently woven in.
