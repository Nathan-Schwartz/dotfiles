---
name: epistemic-pkm-research
description: >-
  Reference material for producing epistemically classified PKM artifacts during research.
  Covers epistemic classification, PKM schema, and behavioral guidance for choosing between
  ref, synth, and temp.
user-invocable: false
---

# PKM Research Reference

This skill provides behavioral guidance for producing epistemically classified PKM artifacts. It is preloaded into the epistemic-explore agent as reference material.

!`cat ~/.claude/references/epistemic-reference.md`

!`cat ~/.claude/references/pkm-schema-reference.md`

## Output Destination

Every invocation writes findings to disk and returns the path alongside the summary.

- **Default (no destination specified)**: Write to `<project-root>/.claude/scratch/epistemic-explore/$CLAUDE_CODE_SESSION_ID/<topic-slug>/`.
  - Project root: `git rev-parse --show-toplevel` if inside a git repo; otherwise `$PWD`.
  - Create intermediate directories as needed (`mkdir -p`).
  - Topic slug: derive from the delegation prompt, ≤50 chars, kebab-case. One folder per invocation.
- **Explicit destination**: When the delegation specifies a target directory (or mentions "persist"/"save" with one), write there instead.

Scratch artifacts are durable within the session. Follow-up exploration should re-read scratch files rather than re-running the research. Scratch files can be promoted to permanent PKM by manually moving them into a project's `pkm/` directory (run `qmd update` afterward to refresh the index — the hook fires on `Write|Edit`, not `Bash`).

## Choosing Between Types

- **ref**: Facts that existed before this conversation. The reader can verify by checking the cited source.
- **synth**: Analysis, decisions, designs, proposals — things that exist *because* of reasoning, not before it. Expensive to verify because the reader must evaluate the logic.
- **temp**: Half-formed ideas, questions, things to explore. No verification burden.

**When to produce a .synth.md instead of .ref.md:** When the research involves drawing conclusions, comparing approaches, making recommendations, or proposing designs. If the delegation prompt asks for analysis (not just fact-finding), the output is synth-shaped.

**Epistemic tagging in synths:** The same Verified/Inferred/Guess classifications apply. Synths will naturally contain more Inferred claims, but supporting facts should still be Verified and ideally extracted to cited `.ref.md` files.

Synths should be lean — reasoning and conclusions, not restated evidence. A synth that cites a list of refs to build an argument is the intended pattern.

### .index.md is not .synth.md

An `.index.md` is purely navigational — it lists and links to other files with brief descriptions, nothing more. It contains no original analysis, no argument, no cited evidence chain. If you find yourself writing prose that reasons over a collection of refs, that is a `.synth.md` that cites those refs, not an index.

### .ref.md is not a catalog

A `.ref.md` does factual extraction — it captures the substance of its sources, not just pointers to them. If the body is a list of external links with one-line summaries rather than extracted facts, the file is doing index-shaped work for external sources. Either:

- **Deepen**: Extract the actual facts from those sources into a coherent document. The sources become citations backing specific claims, not the content itself.
- **Split**: Create individual refs per source (or per logical grouping) so each one does meaningful extraction.

The test: if someone deleted the source URLs, would the ref still contain useful knowledge? If not, it's a catalog, not a reference.

## File Naming

- kebab-case with compound extension: `tool-name-capabilities.ref.md`
- Descriptive but concise
- One coherent topic per file (not one sentence — a tool's capabilities, tradeoffs, and CLI in one doc is fine)
