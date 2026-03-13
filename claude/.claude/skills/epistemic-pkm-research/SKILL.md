---
name: epistemic-pkm-research
description: >-
  Reference material for producing epistemically classified PKM artifacts during research.
  Covers epistemic classification, PKM schema, behavioral guidance, and qmd duplicate checking.
user-invocable: false
---

# PKM Research Reference

This skill provides behavioral guidance for producing epistemically classified PKM artifacts. It is preloaded into the epistemic-explore agent as reference material.

!`cat ${CLAUDE_SKILL_DIR}/../../references/epistemic-reference.md`

!`cat ${CLAUDE_SKILL_DIR}/../../references/pkm-schema-reference.md`

## When to Write vs. When to Return

This is controlled by the delegation prompt from the main conversation:

- **Return mode** (default): Return epistemically classified findings as structured text. Do not write files.
- **Persist mode**: When the delegation mentions persisting/saving, write `.ref.md` files directly.

If a target folder is not specified, write it to the repo's root if it is a git repo, or the working directory otherwise.

## Choosing Between Types

- **ref**: Facts that existed before this conversation. The reader can verify by checking the cited source.
- **synth**: Analysis, decisions, designs, proposals — things that exist *because* of reasoning, not before it. Expensive to verify because the reader must evaluate the logic.
- **temp**: Half-formed ideas, questions, things to explore. No verification burden.

**When to produce a .synth.md instead of .ref.md:** When the research involves drawing conclusions, comparing approaches, making recommendations, or proposing designs. If the delegation prompt asks for analysis (not just fact-finding), the output is synth-shaped.

**Epistemic tagging in synths:** The same Verified/Inferred/Guess classifications apply. Synths will naturally contain more Inferred claims, but supporting facts should still be Verified and ideally extracted to cited `.ref.md` files.

Synths should be lean — reasoning and conclusions, not restated evidence. A synth that cites a list of refs to build an argument is the intended pattern.

### .index.md is not .synth.md

An `.index.md` is purely navigational — it lists and links to other files with brief descriptions, nothing more. It contains no original analysis, no argument, no cited evidence chain. If you find yourself writing prose that reasons over a collection of refs, that is a `.synth.md` that cites those refs, not an index.

## Duplicate Checking

This may be skipped if qmd is inaccessible via mcp, but you must check.

Before writing any `.ref.md`, search qmd for semantically similar existing files:

1. Use `qmd_search` with a lexical query matching the key terms
2. Use `qmd_search` with a semantic query matching the concept
3. If near-duplicates exist (score > 0.7), report them instead of creating redundant files
4. If partial overlap, reference the existing file and write only the new facts

## File Naming

- kebab-case with compound extension: `tool-name-capabilities.ref.md`
- Descriptive but concise
- One coherent topic per file (not one sentence — a tool's capabilities, tradeoffs, and CLI in one doc is fine)
