---
name: to-pkm
description: >-
  Convert conversation context into atomic PKM artifacts (.ref.md, .synth.md, .temp.md)
  with compound extensions and frontmatter. Use when the user asks to capture findings,
  save research, or create knowledge base entries.
argument-hint: [target-directory]
---

Convert the current conversation into atomic PKM artifacts with compound extensions, frontmatter, and manifest-first review.

!`cat ${CLAUDE_SKILL_DIR}/../../references/epistemic-reference.md`

!`cat ${CLAUDE_SKILL_DIR}/../../references/pkm-schema-reference.md`

## 1. Validate target

The target directory is: $ARGUMENTS

Verify it exists. If empty or omitted, ask the user.

## 2. Analyze conversation with ref bias

Scan the full conversation. Classify content into three buckets:

- **ref** — facts learned, tool behaviors observed, external patterns. Things that were true before this conversation happened.
- **synth** — decisions made, analysis produced, designs proposed. Things that exist *because* of this conversation.
- **temp** — questions raised, half-formed ideas, things to explore. No expectation of completeness.

**Ref bias**: Actively decompose reasoning to extract embedded facts. A discussion about "use tool X because Y" contains ref material (what X does, its tradeoffs) tangled with synth material (the decision to use it, why it fits). Separate them. The goal: more of the output lands in the cheapest-to-verify tier (facts checkable against sources).

When the type is genuinely ambiguous, ask the user — don't guess.

**Atomicity**: One idea per file. Prefer fewer substantial files over many tiny ones — three related facts in one ref beats three single-fact refs. A ref that captures a tool's capabilities, tradeoffs, and CLI in one document is better than three separate files.

## 3. Present manifest

If qmd MCP tools are available and the target directory is a registered qmd collection, search for semantically related existing files using `qmd_search` or `qmd_deep_search`. Include matches in the manifest as a separate "possibly related" tier (distinct from the certain cross-references between files created in the same invocation).

Present a numbered list inline in the conversation. Each item shows:

- Type tag: `[ref]`, `[synth]`, `[temp]`
- Proposed filename (kebab-case with compound extension)
- One-line summary
- Topics
- `sources:` (refs, URLs, files, or notes the content derives from — includes cross-references to other proposed files)

Example format:

```
PROPOSED FILES (confirm/drop/reclassify):

1. [ref] qmd-capabilities.ref.md
   summary: "qmd provides hybrid BM25 + semantic + LLM re-ranking search via CLI and MCP"
   topics: [semantic-retrieval, qmd, toolchain]
   sources: [github.com/tobi/qmd]

2. [synth] to-pkm-design.synth.md
   summary: "Design for /to-pkm skill as PKM-native session capture"
   topics: [session-capture, pkm, trust-economics]
   sources: [pkm.synth.md, AI_TOOLING.md, qmd-capabilities.ref.md]

3. [temp] scratch-obsolescence.temp.md
   summary: "Does /scratch serve a purpose now that .temp.md exists?"
   topics: [progressive-formalization]

Reply with any changes, or confirm to write all. Examples:
  "drop 3" / "2 → ref" / "looks good" / "drop 1, rest is fine"
```

**Stop and wait for the user's response.** Do not write any files until confirmation.

## 4. Write confirmed files

For each confirmed item, write the file to the target directory. Use the required and optional frontmatter fields from the schema reference above for each type.

Include cross-references to other files created in this invocation in the `sources:` list alongside external sources.

**Body content**: Write the actual substance — not a summary of the conversation, but the knowledge itself. For refs, document the facts clearly. For synths, capture the reasoning and decisions. For temps, capture the question or idea with enough context to be useful later.

## 5. Generate session index

Write a session index file to the target directory:

Filename: `session-YYYY-MM-DD-HHMM.index.md`

```yaml
---
summary: "<one-line session summary>"
topics: [<union of all created file topics>]
sources: [<list of all files created in this session>]
generated: true
created: "<ISO-8601 datetime>"
---
```

Body: categorized list of all created files with their summaries, grouped by type (Refs, Synths, Temp).

## 6. Update search index

After all files are written, update vector embeddings so semantic search can find the new content:

```
qmd embed
```

The PostToolUse hook keeps the keyword index current automatically, but vector embeddings require this explicit step.

## Rules

- **Never write files before manifest confirmation.**
- **Never edit existing files** in the target directory.
- Every file gets `generated: true` — nothing claims to be human-reviewed.
- Ref bias means actively decomposing reasoning to extract embedded facts. When the type is genuinely ambiguous, ask.
- Atomicity: one idea per file. But "one idea" means one coherent topic, not one sentence.
- Filenames: kebab-case with compound extension (`.ref.md`, `.synth.md`, `.temp.md`). Descriptive but concise.
- If the conversation produced nothing worth capturing, say so and stop. Don't manufacture content.
- **qmd indexing**: A PostToolUse hook automatically updates the qmd keyword index for existing collections. If the target directory is not yet a qmd collection, remind the user to run `qmd-sync.sh <dir>` to register it.
