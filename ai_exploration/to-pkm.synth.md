---
id: to-pkm-design
summary: "Design for /to-pkm skill that converts session content into PKM-compatible artifacts with compound extensions, frontmatter, and manifest-first review"
topics:
  - session-capture
  - pkm
  - trust-economics
  - compound-extensions
  - progressive-formalization
status: draft
sources:
  - pkm.synth.md
  - AI_TOOLING.md
auto_summary: true
---

# `/to-pkm` Skill Design

## Problem

Moving from conversation to durable knowledge is manual and expensive. The core tension (AI_TOOLING.md:1566): Claude exercising editorial judgment — deciding what matters, how to frame it, what to omit — triggers the re-derivation problem. You end up verifying a summary instead of confirming a fact.

The PKM system (pkm.synth.md) provides the structural answer — compound extensions, frontmatter schemas, atomic notes — but has no mechanism for *producing* those artifacts from a session. `/to-pkm` is that mechanism.

## Key Design Decision: Ref Bias

The skill should actively decompose conversation content to maximize `.ref.md` output. Most sessions produce more ref-shaped content than people realize, because refs are embedded in reasoning.

A conversation about "we should use qmd for retrieval" contains:
- **Ref material**: qmd's capabilities, its CLI, its three-model pipeline, the 2GB tradeoff — facts about an external tool
- **Synth material**: the decision to use qmd, why it fits our requirements, how it integrates

Extracting refs separately means more of the knowledge base lives in the cheapest-to-verify tier (Bloom's: remember/understand), and synths get shorter because they cite refs instead of restating facts. The goal is not to force synth material into refs — it's to *separate* what's already ref-shaped from the reasoning it's embedded in.

## Compound Extension Taxonomy

### `.ref.md` — External Knowledge
Facts learned, tool behaviors observed, external patterns documented. Things that were true before we discussed them. Cheapest to verify — check against the source.

### `.synth.md` — Original Thinking
Decisions made, analysis produced, designs proposed. Things that exist *because* we discussed them. Expensive to verify — requires evaluating reasoning.

### `.temp.md` — Uncommitted Notes
Questions raised, half-formed ideas, things to explore. Notes you haven't committed to yet. No expectation of completeness, no verification burden. Promotion path: edit until ready, then rename to `.ref.md` or `.synth.md` and add required frontmatter.

### `.index.md` — Session Manifest
Per-session index of all created files. Derived content — regeneratable from the files it lists.

## `.temp.md` Contract

Low ceremony. The distinction from `.synth.md` isn't "less metadata" — it's no `status` field, no expectation of completeness, no verification burden.

```yaml
---
# required
id: <id>
summary: "<summary>"
captured: YYYY-MM-DD
auto_summary: true
# optional
topics: [...]
sources: [...]
---
```

Topics and sources aren't required but are encouraged — they make the note findable via qmd and includable in generated MOCs while it's still in temp state.

## Skill Flow

### Invocation

`/to-pkm <target-directory>`

### Phase 1 — Analyze & Manifest

1. Read conversation history
2. qmd search against target directory — find existing files by topic similarity
3. Classify conversation content with ref bias:
   - `.ref.md` candidates — facts, observations, external knowledge
   - `.synth.md` candidates — decisions, analysis, designs
   - `.temp.md` candidates — questions, half-formed ideas, explorations
4. For each proposed file:
   - Filename with compound extension
   - One-line summary
   - Topics (checked against synonym dictionary if available)
   - `related:` links to existing files (found by qmd) and to other proposed files
5. Output manifest inline in conversation for review
6. User confirms, rejects, or reclassifies each item

### Phase 2 — Write

1. Write confirmed files with full frontmatter, all marked `auto_summary: true`
2. Generate session index file

### Phase 3 — Link (optional, on request)

For new files that relate to existing content, create lightweight link notes or add `related:` entries in *new* files pointing to old ones. Never edit existing files — new file → old file links only, preserving old file integrity.

## Session Index Format

One index per `/to-pkm` invocation. Collision handled by appending a partial conversation ID.

Filename: `session-YYYY-MM-DD-<id>.index.md`

```yaml
---
id: session-2026-03-08-a3f2
date: 2026-03-08
summary: "Session exploring /to-pkm skill design and PKM synergies with session capture"
topics: [session-capture, pkm, trust-economics]
auto_summary: true
---

# Session: 2026-03-08

## Refs
- [qmd-capabilities.ref.md](qmd-capabilities.ref.md) — qmd provides hybrid BM25 + semantic search with MCP support

## Synths
- [session-capture-design.synth.md](session-capture-design.synth.md) — /to-pkm skill as PKM-native session capture mechanism

## Temp
- [scratch-pkm-overlap.temp.md](scratch-pkm-overlap.temp.md) — is /scratch redundant with .temp.md promotion?

## Related Existing
- [pkm.synth.md](pkm.synth.md) — foundational PKM architecture this session builds on
```

## Manifest Review UX

The manifest is presented inline in the conversation — not a file yet. Each item is a small reviewable unit:

```
PROPOSED FILES (confirm/reject/reclassify each):

1. [ref] qmd-capabilities.ref.md
   summary: "qmd provides hybrid BM25 + semantic + LLM re-ranking search via CLI and MCP"
   topics: [semantic-retrieval, qmd, toolchain]
   related: [pkm.synth.md]

2. [synth] to-pkm-design.synth.md
   summary: "/to-pkm skill converts session content into PKM artifacts with manifest-first review"
   topics: [session-capture, pkm, trust-economics]
   sources: [pkm.synth.md, AI_TOOLING.md]
   related: [qmd-capabilities.ref.md]

3. [temp] scratch-obsolescence.temp.md
   summary: "Does /scratch serve a purpose now that .temp.md exists?"
   topics: [progressive-formalization]
```

The user responds with confirmations, rejections, or reclassifications (e.g., "3 → synth", "drop 1"). Only confirmed items proceed to Phase 2.

## Trust Economics Assessment

**What's cheaper to verify vs. raw session summary:**
- Each proposed file is a binary decision (keep/drop) — not re-derivation
- Compound extension encodes the verification burden upfront (ref = check source, synth = evaluate reasoning, temp = no burden)
- `auto_summary: true` on everything — nothing claims to be human-reviewed
- Atomic notes mean each file is one idea — seconds to confirm or reject
- Manifest review happens before any writes — no cleanup cost for rejected items

**Residual editorial judgment:**
- Claude still decides what's worth capturing and what to omit
- The omission risk is real but cheaper to catch than misrepresentation — you know what you discussed
- Ref bias helps: factual content is harder to misrepresent than analytical content

**Failure modes:**
- Over-production — too many files, manifest review becomes its own burden. Mitigation: the skill should prefer fewer, more substantial files over many tiny ones. A ref that captures three related facts is better than three single-fact refs.
- Miscategorization — ref tagged as synth or vice versa. Mitigation: the manifest makes categorization visible; reclassification is a one-word response.
- Stale temps — `.temp.md` files accumulate without promotion or cleanup. Mitigation: periodic review (tooling can surface temps older than N days).

## Relationship to Other Concepts

### `/scratch` — Obsoleted

`/to-pkm` with `.temp.md` as an output category covers the same ground as `/scratch` with better PKM integration. The three `/scratch` zones (Raw/Refined/Ready) collapse into a promotion path: `.temp.md` → edit until ready → rename to `.ref.md` or `.synth.md`. No separate staging mechanism needed.

### Propose-and-Confirm (AI_TOOLING.md:1568) — Complementary

Propose-and-confirm is in-flight capture (individual decisions as they happen). `/to-pkm` is end-of-session systematic extraction. They're complementary: propose-and-confirm captures high-confidence atomic items in real time; `/to-pkm` catches everything else in a structured sweep. If both are used in a session, `/to-pkm` should reconcile against already-captured items to avoid duplication.

### Semantic Retrieval (qmd) — Dependency

qmd provides the "what exists already" intelligence. Without it, the skill can still work (propose files without `related:` links), but with it, the manifest includes connections to existing knowledge, making the output immediately integrated into the knowledge base rather than orphaned.

## Open Questions

- **qmd invocation**: Should the skill call qmd directly via MCP, or should it be a prerequisite the user runs? MCP is cleaner but adds a hard dependency.
- **Conversation scope**: Full conversation or from a marker? Long sessions may produce bloated manifests. A "since last `/to-pkm`" scoping or explicit marker could help.
- **Promotion tooling**: What does `.temp.md` → `.synth.md` promotion look like in practice? A `/promote` command? Manual rename + add frontmatter? Could be a second skill or a simple shell function.
- **Cross-session continuity**: If a temp note from session A gets refined in session B, does session B's `/to-pkm` propose an update to the existing temp, or a new file that supersedes it?
