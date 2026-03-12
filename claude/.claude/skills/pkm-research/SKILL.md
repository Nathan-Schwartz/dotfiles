---
name: pkm-research
description: >-
  Reference material for producing epistemically classified PKM artifacts during research.
  Covers .ref.md schema, qmd duplicate checking, and epistemic classification in frontmatter.
user-invocable: false
---

# PKM Research Reference

This skill provides domain knowledge for producing epistemically classified PKM artifacts during research. It is preloaded into the epistemic-explore agent as reference material.

## When to Write vs. When to Return

This is controlled by the delegation prompt from the main conversation:

- **Return mode** (default): Return epistemically classified findings as structured text. Do not write files.
- **Persist mode**: When the delegation mentions persisting/saving, write `.ref.md` files directly.

If a target folder is not specified, write it to the repo's root if it is a git repo, or the working directory otherwise.

## .ref.md Frontmatter Schema

```yaml
---
summary: "<one-line factual summary>"
generated: true
created: "<ISO-8601 datetime>"
topics: [<classification tags>]
sources: [<URLs, file paths, or source descriptions>]
---
```

Optional fields: `id`, `related`, `ai_reviewed_at`, `human_reviewed_at`

## Epistemic Classification in Frontmatter

When writing `.ref.md` files, every claim in the body must be epistemically tagged:

- **Verified**: Cite file:line, URL, or tool output the reader can confirm in one step. Use for facts directly observed via tool use during research.
- **Inferred**: Cite evidence and state reasoning. "Given [evidence], [conclusion] because [reasoning]."
- **Guess**: State explicitly as unverified. Acceptable in `.temp.md` but should be rare in `.ref.md`.

A `.ref.md` file should contain primarily Verified claims. If most claims are Inferred or Guess, the content may belong in `.synth.md` or `.temp.md` instead.

## Content Rules for .ref.md

Every claim must be verifiable against a cited external source.

**Must NOT contain:**
- Design proposals or options
- Recommendations or strategic advice
- Risk assessments or evaluative judgments
- Implications sections reasoning beyond the facts
- Proposed code changes or implementation sketches
- Comparative analysis or trade-off discussion

**When in doubt:** Split. Facts in `.ref.md`, analysis in `.synth.md` that cites it.

## .synth.md — Original Thinking

Synths capture analysis, decisions, designs, and proposals — things that exist *because* of reasoning, not before it. They are expensive to verify because the reader must evaluate the logic, not just check a source.

**Frontmatter schema:**

```yaml
---
summary: "<one-line description of the analysis or decision>"
generated: true
created: "<ISO-8601 datetime>"
topics: [<classification tags>]
sources: [<cited .ref.md files, URLs, or descriptions>]
status: draft | partial | complete
---
```

Optional fields: `id`, `related`, `ai_reviewed_at`, `human_reviewed_at`

**Content rules:** Cite `.ref.md` files for supporting facts rather than restating them inline. Synths should be lean — reasoning and conclusions, not restated evidence. A synth that cites a list of refs to build an argument is the intended pattern; an `.index.md` that merely lists files without analysis is not.

**Must NOT contain:**
- Raw facts or source documentation that belong in a `.ref.md` (extract and cite instead)
- Navigation structures or cross-reference maps without analysis (use `.index.md`)
- Unstructured scratch notes without analysis (use `.temp.md`)

**When to produce a .synth.md instead of .ref.md:** When the research involves drawing conclusions, comparing approaches, making recommendations, or proposing designs. If the delegation prompt asks for analysis (not just fact-finding), the output is synth-shaped.

**Epistemic tagging in synths:** The same Verified/Inferred/Guess classifications apply. Synths will naturally contain more Inferred claims, but supporting facts should still be Verified and ideally extracted to cited `.ref.md` files.

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

## Frontmatter `sources` Values

Use relative paths from the note to referenced PKM notes. For external sources, use URLs or descriptive strings.
