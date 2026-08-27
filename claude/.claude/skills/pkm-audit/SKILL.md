---
name: pkm-audit
description: >-
  Audit an existing PKM knowledge base for false claims, untested negatives, cross-source
  composition errors, and duplicate or overlapping notes. Use when a body of notes is about
  to be relied on for a decision, after a multi-source research session, when checking a
  corpus for duplication, or when the user asks to verify, review, or audit what is in pkm/.
argument-hint: [pkm-directory]
---

# PKM Audit

!`cat ~/.claude/references/epistemic-reference.md`

## Overview

Research produces two kinds of defect, and they need different passes to find.

**Per-source passes find labelling and citation defects.** Is the claim tagged? Does the
cited line say what the claim says? These are cheap to find and cheap to fix, and they
change no conclusions.

**Cross-source passes find the wrong claims.** Every false claim in a well-run
investigation tends to be one of two shapes: a conclusion *composed* from two sources
that neither states, or a *negative* asserted from inside one source that the source
cannot establish. Neither is visible to a pass that reads one source at a time, however
carefully.

Audit accordingly. A programme that only re-reads refs will report tagging debt and miss
every substantive error.

**Audit synths harder than refs.** Refs are extraction and stay inside one scope. Synths
are composition, and composition is where the errors are.

**Duplication is the third concern, and it is corpus-level.** Whether two notes cover the
same ground can only be judged against the whole corpus, so it cannot be delegated to the
pass that writes a note — an agent mid-research has no view of the collection and should
never suppress a finding on suspicion of redundancy. Audit is where that judgment belongs,
and its useful output is usually not "delete one" but "these two disagree" or "these two
corroborate."

## Reliability ordering

Rank every claim you encounter by how it was established, not by how confident it sounds:

| Tier | How the claim was established | Default disposition |
|---|---|---|
| 1 | Tested by hunting the counterexample and failing to find it | Trust |
| 2 | Cross-checked between two sources that were read independently | Trust with the method recorded |
| 3 | Assembled from several sources each merely not mentioning it | **Verify — do not leave open** |

Tier 3 is the trap. It reads as consensus and is the weakest class there is. Two
independent searches agreeing does not upgrade a negative: if they shared a pattern, they
shared a blind spot, and that is one result rather than two.

## Pass 0 — mechanical lint

Free, deterministic, run first so the model passes are not spent on it:

```
"${DOTFILES_DIR:-$HOME/dotfiles}/scripts/pkm-integrity-hook.sh" --lint <pkm-directory>
```

Not on `PATH` — use the full path above, the same form `settings.json` uses for the write hook. Directory arguments are walked recursively.

Reports phantom sources and missing gap sections (blocking-tier schema rules), plus weak
citations, source paths that do not resolve, and paragraphs carrying no epistemic marker.
Fix or triage everything here before dispatching an agent. Nothing below should spend
tokens on what a linter already found.

## Pass 1 — load-bearing claim spot-check

Highest value of the model passes, and the only one that escapes a misconception shared by
the writing and reviewing passes, because it goes back to the source rather than reasoning
over the notes.

Enumerate the claims the conclusions actually rest on — not every claim, the load-bearing
ones. Include every claim that was relayed to the user as fact. Hand them to an agent with
instructions to **open each at source** and confirm or refute individually.

Report as `confirmed / refuted / unreachable` with a count. Unreachable is a real outcome:
say which claims could not be checked and why.

## Pass 2 — overlap and duplication map

Duplicate checking belongs here and nowhere else. Judging that two notes cover the same
ground requires seeing the whole corpus, which no single research pass can — an agent
writing one note cannot make that call, and should not try. It is also a decision, not a
finding: consolidating notes changes what a future reader finds, so it needs a human.

Group the corpus into topic clusters. `qmd search <key terms>` helps if the index is
usable; plain filename and summary reading is a fine substitute and often better.

Sort each overlapping pair into one of four outcomes — the last two are the reason this
pass earns its place:

| Outcome | Disposition |
|---|---|
| **Redundant** — same claims, same sources | Propose consolidation. Do not merge. |
| **Complementary** — same topic, different facts | Propose cross-links in `sources:` plus inline. |
| **Contradictory** — overlapping claims that disagree | Hand to pass 3. This is a correctness defect wearing a duplication costume. |
| **Corroborating** — same claim, independent source class | Record it. Two source classes agreeing raises confidence, and that is a finding worth keeping rather than a redundancy to delete. |

**Propose; do not execute — with one exception.** Report the clusters and dispositions and
let the human decide. Merging is destructive and reconciling across collections is not
automatic. The single write an audit performs is the `ai_reviewed_at` stamp described in
Recording results.

Three things about the tooling, all verified:

- **Ignore similarity scores.** `qmd search` returns BM25 relevance to a query, not
  document similarity, and prints a percentage. A file indexed near-identically in three
  collections scored 16% on a single-term query. Any numeric threshold is a category
  error; read the summaries.
- **The index is often stale or partial.** Collections go months without a refresh, and a
  directory that was never registered is absent entirely. Check `qmd status` before
  trusting a negative — an unregistered collection produces "no duplicates" for free.
- **A sandboxed agent usually cannot open it** (`SQLITE_CANTOPEN` — the index lives outside
  the write allowlist, and SQLite needs write access even to read). Run lookups from the
  main session and hand the results down.

## Pass 3 — contradiction and implication sweep

One agent, the whole corpus, **no source access at all**. It reasons over claims, not
code. Two jobs:

1. **Contradictions** — claims that cannot both be true. Where two notes disagree, say
   which side wins and why it wins; that is a judgment about relative reliability, not a
   proof, and it should be labelled as one.
2. **Implication gaps** — claims that are individually true and *jointly imply* something
   no note states. This is the more valuable half, and it is where composed claims get
   caught.

Cheap, no scope exposure, tiny context. Give it the composition errors already known from
this corpus as calibration so it hunts that shape rather than rediscovering them.

## Pass 4 — boundary enumeration

List every external system, service, identifier, header, event, or document named anywhere
in the corpus. Classify each:

- **Documented** — a note extracts facts from it
- **Named only** — it appears in claims but nothing was read
- **Assumed** — claims depend on its behaviour and no note establishes that behaviour

Then rank by which conclusions break if the assumption is wrong.

This is the only pass that catches **shared omissions** — things every agent missed
because no source described them. Expect the diagnosis to be that callers are documented
exhaustively and callees not at all, because the documentation boundary silently became
the source boundary.

## Pass 5 — per-source adversarial review

One agent per source scope. **Retest negatives; do not re-read them.** Hand each agent a
specific negative claim to attack, and require the four-part absence bar in return: the
exact command, the paths covered, the pattern variants tried, and what the search could
not see.

Findings that *survive* attack are worth reporting as prominently as findings that break.
A negative that held after widening is materially stronger than one that was never
widened.

## Pass 6 — targeted verification

Everything still sitting at **Inferred from absence** after passes 1-5, ordered by
consequence. Instruct the agent to look for the thing the claim says is not there, and to
broaden patterns rather than trusting the first negative.

Expect refutations here. Items flagged as worth verifying are flagged precisely because
they were assembled rather than tested, which is the tier that fails most often.

## Recording results

**Dispositions belong in a `.synth.md` inside the knowledge base, not in scratch and not
only in the conversation.** An audit whose findings live in session scratch is the least
durable thing the session produced.

Write it to `<pkm-directory>/audits/audit-YYYY-MM-DD.synth.md`, or
`audit-YYYY-MM-DD-<scope>.synth.md` for a partial run. One file per run; never edit a
previous audit. Recency lives in the filename — do not use `status` to mark supersession,
since `draft`/`partial`/`complete` describes whether the audit finished, not whether it is
still current.

**Stamping.** After a full run, set `ai_reviewed_at` to the run date in the frontmatter of
every file the audit covered. This is the one mutation an audit makes, and it is
all-or-nothing: a partial or scoped run — a subset of files, or only some of the passes —
stamps nothing at all. A stamp asserts the whole programme was applied to that file, so a
stamp that means "was in the neighbourhood" is worse than no stamp.

Give every finding a disposition: `Fixed` / `Accepted` / `Verify` / `Refuted` / `Open`.
Tier-3 claims default to `Verify`, never `Open`.

If raw audit reports are promoted alongside the synth, they are `.temp.md` — no epistemic
burden, which is honest for a working document — and each needs a banner naming the synth
as authoritative. Audit reports go stale within hours of being written, because the
corrections they trigger invalidate them.

**Line citations decay.** Applying corrections shifts line numbers in the files the audit
cited. Re-locate any cited line before acting on a finding written before the last round
of edits.

## Scaling

Not every corpus needs all seven passes.

- **A handful of notes from one source** — pass 0, then pass 1 on the load-bearing claims.
- **One source, relied on for a decision** — passes 0, 1, 5.
- **A corpus that has grown by accretion** — passes 0, 2, 3. Overlap is the presenting
  symptom; contradiction between overlapping notes is the actual defect.
- **Multi-source corpus** — all of it. Passes 3 and 4 are cheap and target the failures
  that actually change conclusions; skipping them is what leaves composed claims standing.

## Reporting

State the count of claims checked and refuted, not just the findings. "16/16 load-bearing
claims confirmed" is a result; a list of six tagging nits without a denominator is not.

Report the honest limit of the programme: an audit that reasons over the notes using the
same process that produced them is a check on execution, not independent confirmation. A
misconception shared by both passes survives. Say so.
