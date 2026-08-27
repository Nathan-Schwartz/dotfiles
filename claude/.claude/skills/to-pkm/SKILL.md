---
name: to-pkm
description: >-
  Convert conversation context into atomic PKM artifacts (.ref.md, .synth.md, .temp.md)
  with compound extensions and frontmatter. Use when the user asks to capture findings,
  save research, or create knowledge base entries.
argument-hint: [target-directory]
---

Convert the current conversation into atomic PKM artifacts with compound extensions, frontmatter, and manifest-first review.

!`cat ~/.claude/references/epistemic-reference.md`

!`cat ~/.claude/references/pkm-schema-reference.md`

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

## 3. Discover and present manifest

Before assembling the manifest, discover any epistemic-explore research docs produced earlier in this session using `ls` only — do not read the file contents:

`<project-root>/.claude/scratch/epistemic-explore/$CLAUDE_CODE_SESSION_ID/`

where `<project-root>` is `git rev-parse --show-toplevel` (or `$PWD` if not in a git repo). Each subdirectory is a topic slug. Reconciliation (step 6) is the only step that reads these files.

**Fallback — do not skip this.** An agent handed an explicit scratch destination may have written outside the session directory, so the session path can be missing or empty while research docs exist. If it is, `ls` the parent:

`<project-root>/.claude/scratch/epistemic-explore/`

Directories there whose names are not session UUIDs are unscoped topic folders. Present them in the manifest as a **separate tier requiring explicit opt-in** — they may belong to this session or to an earlier one, and you cannot tell from the path. Name the tier so the ambiguity is visible, e.g. "UNSCOPED RESEARCH DOCS (session unknown — confirm each)". Never fold them in silently.

Reporting nothing found when a sibling directory holds a session's entire research output is the failure this fallback exists to prevent.

**Do not search the existing corpus for related or duplicate notes.** This skill captures what the conversation produced; it does not reconcile that against what the knowledge base already holds. Deciding two notes cover the same ground requires a view of the whole corpus and is a destructive-by-implication call, so it belongs to a deliberate audit pass — see the `pkm-audit` skill, which does overlap and duplication as a distinct step. Cross-references between files created *in this invocation* are still expected; those are certain, not inferred from a similarity search.

Present a numbered list inline in the conversation. Each conversation-derived item shows:

- Type tag: `[ref]`, `[synth]`, `[temp]`
- Proposed filename (kebab-case with compound extension)
- One-line summary
- Topics
- `sources:` (refs, URLs, files, or notes the content derives from — includes cross-references to other proposed files)

After the conversation items, list the discovered research docs as a separate section using their topic-slug directory names only (no file count, no content peek). The session-id wrapper is omitted both in the UI and in the copy destination — only the topic-slug folder lands in the target.

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

EPISTEMIC-EXPLORE RESEARCH DOCS (from this session, copied as-is):
- topic-foo/
- topic-bar/

UNSCOPED RESEARCH DOCS (session unknown — confirm each):
- topic-baz/

Reply with any changes, or confirm to write all. Examples:
  "drop 3" / "2 → ref" / "drop topic-bar" / "keep topic-baz" / "looks good"
```

**Stop and wait for the user's response.** Do not write any files until confirmation.

## 4. Write confirmed conversation files

Write the conversation-derived files first — these capture content that disappears if context runs out. The copied research docs and reconciliation can wait.

For each confirmed item, write the file to the target directory. Use the required and optional frontmatter fields from the schema reference above for each type.

Include cross-references to other files created in this invocation in the `sources:` list alongside external sources.

**Body content**: Write the actual substance — not a summary of the conversation, but the knowledge itself. For refs, document the facts clearly. For synths, capture the reasoning and decisions. For temps, capture the question or idea with enough context to be useful later.

**Inline citations**: Every entry in a file's frontmatter `sources:` must appear as an inline markdown link (`[text](path)`) in the body. The link anchors the source to the specific content it supports — a claim, a section, or an argument. No phantom sources (listed in frontmatter but never linked in the body). Citation granularity can vary — per-claim, per-section, per-argument — as long as the connection between source and content is clear.

## 5. Copy epistemic-explore research docs

For each confirmed research doc folder, copy it into the target directory using `cp -r`. The session-id wrapper from the scratch path is dropped — only the topic-slug folder lands in the destination.

Source: `<project-root>/.claude/scratch/epistemic-explore/$CLAUDE_CODE_SESSION_ID/<topic-slug>/`
Destination: `<target>/<topic-slug>/`

For a confirmed unscoped folder, the source is `<project-root>/.claude/scratch/epistemic-explore/<topic-slug>/` and the destination is the same.

If a destination path already exists, prompt the user before overwriting.

`cp` bypasses the PostToolUse hook, so reindexing waits for step 8.

## 6. Reconciliation

This is the first step that reads the files written in step 4 and the research docs copied in step 5. Goals:

1. **Cross-link related files.** Identify topical overlap between conversation files and copied research docs, and add reciprocal `sources:` entries plus inline body links. Every added `sources:` entry must appear as an inline markdown link in the body — no phantom sources.
2. **Flag substantive discrepancies.** If a conversation file and a research doc make contradictory claims on the same topic, surface the contradiction for the user. Do not silently resolve.

Hybrid posture: apply mechanical cross-links directly, gate contradictions on user input.

## 7. Generate session index

Write a session index file to the target directory:

Filename: `session-YYYY-MM-DD-HHMM.index.md`

```yaml
---
summary: "<one-line session summary>"
topics: [<union of all created and copied file topics>]
sources: [<all conversation files written + all research doc folders copied>]
generated: true
created: "<ISO-8601 datetime>"
---
```

Body: categorized list grouped by origin — conversation files (subgrouped by Refs/Synths/Temp) and epistemic-explore research docs (by topic).

## 8. Update search index

After all writes, copies, and reconciliation edits are done, refresh both indices:

1. `qmd update` — rebuilds the keyword index. Required because `cp` (step 5) bypasses the PostToolUse hook that normally keeps the keyword index current.
2. `qmd embed` — generates vector embeddings for semantic search.

The PostToolUse hook keeps the keyword index current automatically for `Write|Edit` (including reconciliation edits), but `cp` flows through Bash, so the explicit `qmd update` is needed.

## Rules

- **Never write files before manifest confirmation.**
- **Never edit pre-existing files** in the target directory (those that existed before this invocation). Reconciliation (step 6) may edit files written or copied during this invocation to add cross-links.
- Every file gets `generated: true` — nothing claims to be human-reviewed.
- Ref bias means actively decomposing reasoning to extract embedded facts. When the type is genuinely ambiguous, ask.
- Atomicity: one idea per file. But "one idea" means one coherent topic, not one sentence.
- Filenames: kebab-case with compound extension (`.ref.md`, `.synth.md`, `.temp.md`). Descriptive but concise.
- If the conversation produced nothing worth capturing, say so and stop. Don't manufacture content.
- **Do not read epistemic-explore research doc contents before step 6 (reconciliation).** Steps 3-5 use the file tree only (`ls`, `cp`); reading is deferred to keep context lean and preserve urgency-first ordering. If context runs out before step 6, the data files are all on disk and the user can re-run for the remaining steps.
- **qmd indexing**: A PostToolUse hook automatically updates the qmd keyword index for existing collections. If the target directory is not yet a qmd collection, remind the user to run `qmd-sync.sh <dir>` to register it.
