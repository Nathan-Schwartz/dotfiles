---
name: to-pkm
description: Convert conversation content into PKM-compatible atomic markdown files
---

Convert the current conversation into atomic PKM artifacts with compound extensions, frontmatter, and manifest-first review.

## 1. Validate target

The user provides `<target-directory>` as an argument. Verify it exists. If omitted, ask.

## 2. Analyze conversation with ref bias

Scan the full conversation. Classify content into three buckets:

- **ref** — facts learned, tool behaviors observed, external patterns. Things that were true before this conversation happened.
- **synth** — decisions made, analysis produced, designs proposed. Things that exist *because* of this conversation.
- **temp** — questions raised, half-formed ideas, things to explore. No expectation of completeness.

**Ref bias**: Actively decompose reasoning to extract embedded facts. A discussion about "use tool X because Y" contains ref material (what X does, its tradeoffs) tangled with synth material (the decision to use it, why it fits). Separate them. The goal: more of the output lands in the cheapest-to-verify tier (facts checkable against sources).

When the type is genuinely ambiguous, ask the user — don't guess.

**Atomicity**: One idea per file. Prefer fewer substantial files over many tiny ones — three related facts in one ref beats three single-fact refs. A ref that captures a tool's capabilities, tradeoffs, and CLI in one document is better than three separate files.

## 3. Present manifest

<!-- TODO: When qmd is available, add a step here to search the target directory for
     semantically related existing files. Include matches in the manifest as a separate
     "possibly related" tier (distinct from the certain cross-references between files
     created in the same invocation). See to-pkm.synth.md Phase 1 Step 2. -->

Present a numbered list inline in the conversation. Each item shows:

- Type tag: `[ref]`, `[synth]`, `[temp]`
- Proposed filename (kebab-case with compound extension)
- One-line summary
- Topics
- `related:` links to other proposed files (certain — created in the same invocation)
- `sources:` for synths (which refs or conversation content informed them)

Example format:

```
PROPOSED FILES (confirm/drop/reclassify):

1. [ref] qmd-capabilities.ref.md
   summary: "qmd provides hybrid BM25 + semantic + LLM re-ranking search via CLI and MCP"
   topics: [semantic-retrieval, qmd, toolchain]

2. [synth] to-pkm-design.synth.md
   summary: "Design for /to-pkm skill as PKM-native session capture"
   topics: [session-capture, pkm, trust-economics]
   sources: [pkm.synth.md, AI_TOOLING.md]
   related: [qmd-capabilities.ref.md]

3. [temp] scratch-obsolescence.temp.md
   summary: "Does /scratch serve a purpose now that .temp.md exists?"
   topics: [progressive-formalization]

Reply with any changes, or confirm to write all. Examples:
  "drop 3" / "2 → ref" / "looks good" / "drop 1, rest is fine"
```

**Stop and wait for the user's response.** Do not write any files until confirmation.

## 4. Write confirmed files

For each confirmed item, write the file to `<target-directory>/` with frontmatter and body content.

**All types** get:

```yaml
---
id: <kebab-case-id>
summary: "<one-line>"
topics: [...]
auto_summary: true
---
```

**Synths** additionally get:

```yaml
status: draft
sources: [...]
```

**Temps** additionally get:

```yaml
captured: YYYY-MM-DD
```

**Refs** get no additional required fields for now. Add `sources:` or `origin:` in frontmatter or body as appropriate to the content.

Add `related:` in frontmatter for cross-references between files created in this invocation.

**Body content**: Write the actual substance — not a summary of the conversation, but the knowledge itself. For refs, document the facts clearly. For synths, capture the reasoning and decisions. For temps, capture the question or idea with enough context to be useful later.

## 5. Generate session index

Write a session index file to `<target-directory>/`:

Filename: `session-YYYY-MM-DD-HHMM.index.md`

```yaml
---
id: session-YYYY-MM-DD-HHMM
date: YYYY-MM-DD
summary: "<one-line session summary>"
topics: [<union of all created file topics>]
auto_summary: true
---
```

Body: categorized list of all created files with their summaries, grouped by type (Refs, Synths, Temp).

## Rules

- **Never write files before manifest confirmation.**
- **Never edit existing files** in the target directory.
- Every file gets `auto_summary: true` — nothing claims to be human-reviewed.
- Ref bias means actively decomposing reasoning to extract embedded facts. When the type is genuinely ambiguous, ask.
- Atomicity: one idea per file. But "one idea" means one coherent topic, not one sentence.
- Filenames: kebab-case with compound extension (`.ref.md`, `.synth.md`, `.temp.md`). Descriptive but concise.
- If the conversation produced nothing worth capturing, say so and stop. Don't manufacture content.
