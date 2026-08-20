---
name: disproof-review
description: Use when reviewing a pull request, diff, or working changes and reporting defects to a human — including when ranking findings by severity, filtering a review down to what matters, or re-examining findings that have been challenged.
---

# Disproof Review

## Overview

Reviews rarely fail by stating false facts. They fail by attaching unearned weight to true
ones. "This call sits outside the error handler" can be verified and still be worthless if
the call cannot raise, sits behind a flag that is off, or is unreachable from any caller.

**Severity is a claim. It needs evidence like any other claim.**

A finding is three separate claims stacked together:

| Layer | Claim | Normally cited? |
|---|---|---|
| Mechanism | the code does X | yes |
| Reachability | X occurs in production | no |
| Consequence | when it occurs, Y breaks | no |

Only the first gets a citation. The other two ride on its credibility. This skill makes
them explicit.

## The finding contract

Every finding IS these four parts, in this order:

```
<claim: what the code does, one line, with file:line>
Disproof: <question> — <source consulted> → <answer>. [Refuted | Narrowed | Intact]
Reachability: <each precondition, with its checked value>
Impact: <what breaks, and for whom>
```

A finding whose `Disproof` line is missing or unanswered goes under **Questions**, not
**Findings**, and carries no severity.

## Writing the disproof question

Before investigating, write the question whose answer would make the finding harmless.

- **Binary and falsifiable** — "does X raise on failure?", not "is this risky?"
- **Assumes harmless** — phrase it so the expected answer kills the finding, then try to
  falsify that
- **Names its source** — say which file or command answers it *before* opening anything.
  If you cannot name one, you do not understand the finding well enough to rank it
- **Genuinely open** — if the opposite answer would not change the conclusion, you have
  restated the finding instead of testing it

Point it at code you did not write — a dependency, a callee, the framework. That is where
the unexamined assumption lives.

Outcomes are graded: **Refuted** (drop it), **Narrowed** (keep it, bounded by conditions
you can name), **Intact** (keep it, nothing bounds it).

## Reachability is not a vibe

Record each precondition with its **actual value**:

- guards and feature flags — read the config and report the value, not "behind a flag"
- which callers reach the code — count them
- position in the calling sequence
- whether the effect is already observable elsewhere

"Behind a conditional" is not reachability. "`config[:enabled]`, a string, truthy in every
environment" is.

## Output

The review is:

1. **Verdict** — one line.
2. **Findings** — the contract above, ranked, limited to what survived disproof.
3. **Questions** — anything whose disproof you did not complete.

Nothing else unless asked. Reviews are point-in-time: no documentation notes, naming or
style preferences, or test-design commentary unless they conceal a defect.

## Delegation

Subagent output arrives as **unranked leads**. Classifications may be trusted; severity
words ("should fix", "the most substantive omission") are judgments, not classifications —
re-derive those locally from a citation you fetched yourself.

Put the disproof question **in the research prompt**. A prompt that says "X is broken,
confirm the call sites" comes back as a well-cited restatement of its own premise.

Reading config files can trip DLP scanners. Gather config values in the main session and
hand them to the subagent as context.

## Common mistakes

| Mistake | Fix |
|---|---|
| Severity assigned before preconditions are checked | No severity without a completed Disproof line |
| "It's behind a feature flag" | Read the flag's value. String flags are often truthy in every environment. |
| Comparative framing ("unlike the others, this one…") | A comparison is a claim about both sides. Check both. |
| Factual asides tucked inside a cited finding | They inherit the citation's credibility. Cite them or cut them. |
| Many findings, ranked after writing | Rank during analysis. Volume is a template artifact. |
| Relaying a subagent's severity | Leads arrive unranked. |
