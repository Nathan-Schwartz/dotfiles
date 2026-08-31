---
name: disproof-review
description: Review a pull request, diff, or working changes and report defects, with each finding's severity backed by a check that could have killed it.
disable-model-invocation: true
---

# Disproof Review

## Why

The common review failure is not a false statement. It is a true statement given more
weight than it deserves. "This call sits outside the error handler" can be correct and
still be worthless if the call cannot raise, the flag is off, or nothing reaches it.

A finding is three claims stacked:

| Layer | Claim | Usually cited? |
|---|---|---|
| Mechanism | the code does X | yes |
| Reachability | X happens in production | no |
| Consequence | when it happens, Y breaks | no |

Only the first gets a citation. The other two ride on its credibility. Check them before
you rank.

## Before writing a finding

Write the question whose answer would make the finding harmless, then try to answer it
that way.

- Binary and falsifiable — "does X raise on failure?", not "is this risky?"
- Name the file or command that answers it before opening anything. If you cannot name
  one, you do not understand the finding well enough to rank it.
- Point it at code you did not write — a dependency, a callee, the framework. That is
  usually where the unchecked assumption is.
- If the opposite answer would not change your conclusion, it is the wrong question. You
  have restated the finding instead of testing it.

The finding then dies, survives with limits you can name, or survives unbounded. Grade it
before writing it up — that is where you catch yourself narrowing a finding and keeping
the original severity anyway. The grade does not go in the report. The limits do.

## Reachability

Record each precondition with the value you actually read:

- flags and guards — the configured value, not "behind a flag". String flags are often
  truthy in every environment.
- callers that reach the code — count them
- whether the effect is already visible somewhere else

If the change has no runtime — config, docs, schema, prose — say so and move on. Do not
fill the field to satisfy the template.

## Output

Two depths. The bold lines alone are the review. The fields under them are how to check
it.

```
**Verdict:** one line.

1. **<what is wrong>** — `file:line`
   Fires: <when, with the value you read>
   Breaks: <what, and for whom> — Inferred unless you saw it happen
   Checked: <the question> → <answer, and its source>
```

Order findings by what you would fix first. Each field is one line; if it runs to a
paragraph, it belongs in the answer to a follow-up question, not here.

Close with the count you dropped after checking — "checked 12, kept 5" — so the
denominator is visible without listing the dead ones.

**Questions** — anything whose check you did not finish. No severity, no ordering.

Nothing else unless asked. No documentation, naming, or test-design notes unless they
hide a defect.

## Classification

The global Verified/Inferred/Guess rules apply. This skill adds no vocabulary of its own.

- The mechanism line carries `file:line`, so it is Verified by construction. Do not tag
  it; the citation is the tag.
- The Breaks line is usually Inferred. That is the one to label, and the one reviews get
  wrong.

## Writing

Plain sentences. State the finding, then the evidence. Avoid aphorism, rhetorical
contrast, and "X is not Y" constructions — they read as insight and carry none. Prefer a
plain statement over a memorable one.

## Delegation

Subagent output is unranked leads. Classifications can be trusted; severity words
("should fix", "the most substantive") are judgments — re-derive those from a citation
you fetched yourself.

Put the disproof question in the research prompt. A prompt that says "X is broken,
confirm the call sites" comes back as a well-cited restatement of its own premise.

Reading config files can trip DLP scanners. Gather config values in the main session and
pass them down as context.

## Common mistakes

| Mistake | Fix |
|---|---|
| Severity assigned before preconditions are checked | Check first, rank second |
| "It's behind a feature flag" | Read the value |
| "Unlike the others, this one…" | A comparison claims something about both sides. Check both. |
| Factual asides inside a cited finding | They inherit the citation. Cite them or cut them. |
| Ranking after writing | Rank while analyzing. A long, undifferentiated list means the template is producing findings rather than the code. |
| Relaying a subagent's severity | Leads arrive unranked. |
