---
id: pkm-synth
summary: "Compound file extensions + frontmatter schemas + semantic retrieval as a portable, trust-aware PKM system for research knowledge bases"
topics:
  - knowledge-management
  - compound-extensions
  - frontmatter
  - semantic-retrieval
  - trust-economics
  - claude-hooks
  - vim-integration
status: draft
auto_summary: true
sources:
  - guiding_principles.md
  - AI_TOOLING.md
---

# Personal Knowledge Management for Research Knowledge Bases

## Problem

Research rabbit holes produce structured findings across multiple sessions. As findings accumulate, referencing them from a main document becomes expensive — either you maintain a cross-reference index manually (burning tokens on maintenance instead of research) or you lose track of what you've already established.

This is a recurring pattern across independent research topics, not a one-time problem. The solution must be topic-agnostic and low-ceremony — something you can point at any directory of markdown and immediately get value from, without per-corpus setup work.

Manual index maintenance is essentially reinventing the indexing half of RAG by hand. The maintenance loop is O(n) per session, fragile to source changes, and directly competes with the actual research for token budget and attention.

## Architecture

Three complementary layers, each solving a different problem:

### Layer 1: Compound File Extensions

The filesystem-level type system. Encodes a document's **role** in the knowledge system into the filename itself.

`*.ref.md`, `*.synth.md`, and `*.index.md` are all still `*.md` — every existing tool matches them. But the narrower glob provides a selector for targeted tooling: hooks, schema validation, editor integrations, and retrieval filters. The convention IS the metadata — no config files, no manifests, no marker files.

### Layer 2: Frontmatter as Document Contract

Per-document structured metadata in YAML frontmatter. The compound extension determines which schema applies — the extension IS the schema selector, derived mechanically from the filename.

Frontmatter serves two purposes:
1. **Token-efficient triage.** Claude reads frontmatter from all files in a knowledge base (~50 tokens each) and knows which documents to read in full, without scanning every body.
2. **Trust infrastructure.** Each document type has a different verification burden. Frontmatter makes that burden legible at a glance — status, sources, whether the summary has been human-reviewed.

### Layer 3: Semantic Retrieval

A local tool that indexes markdown files and provides semantic search, eliminating manual cross-reference maintenance entirely.

Requirements for a good fit:
- **CLI + MCP** — usable from the terminal and within Claude sessions
- **Hybrid search** (keyword + semantic) — catches both exact identifiers like "W1" and conceptual matches where terminology differs
- **Collection-based** — point at any directory, minimal per-project setup
- **Incremental re-indexing** — detects file changes, doesn't require full rebuild
- **Scriptable output** — JSON or structured formats for building tooling on top

[qmd](https://github.com/tobi/qmd) is a strong candidate — it meets all five criteria, combining BM25 keyword search, vector semantic search, and LLM-based re-ranking in a CLI-first tool with MCP support. Tradeoff is ~2GB of local models for the three-model pipeline (query expansion, retrieval, re-ranking).

These three layers don't compete. Extensions route tooling behavior. Frontmatter provides structured metadata for triage and trust. Semantic search handles discovery across documents that don't share terminology.

## Compound Extension Taxonomy

### Durability Test

A category earns a compound extension only if it passes all four criteria:

1. **Stable** — documents don't change category over their lifetime
2. **Actionable** — the category drives meaningfully different tooling behavior (different schema, different hooks)
3. **Obvious** — when creating a document, the category is immediately clear
4. **Universal** — applies across research topics, not domain-specific

### Knowledgebase Extensions

| Extension | Role | What it contains |
|-----------|------|-----------------|
| `.ref.md` | External knowledge | Sources, evidence, literature summaries. Someone else's work, contextualized by you. |
| `.synth.md` | Your original thinking | Analysis, synthesis, design, conclusions, findings. Your cognitive work, informed by refs. |
| `.temp.md` | Uncommitted notes | Questions, half-formed ideas, things to explore. No expectation of completeness or verification. |
| `.index.md` | Navigation and structure | Maps of content, cross-references, manifests. |

Why not split analysis from synthesis: the boundary is genuinely blurry. A finding examines a claim (analysis) but also connects it to a design (synthesis). The document's role doesn't change — a finding stays a finding even as its conclusions feed into a larger synthesis. If the distinction matters for a specific document, it belongs in frontmatter (`stage: analysis | synthesis | design`) where reclassification is cheap.

The ref/synth split maps to trust cost. Refs require verifying accurate representation of the source — relatively cheap. Synths require verifying the reasoning — expensive, the "no oracle" problem. Index documents require verifying completeness — mechanical. Each type has a fundamentally different verification burden, which justifies different schemas and different tooling behavior.

### Bloom's Taxonomy as a Validation Lens

Bloom's revised taxonomy (remember, understand, apply, analyze, evaluate, create) doesn't map well to knowledgebase document types — a single document often spans multiple cognitive levels. But it provides a useful test for extension design: if two proposed extensions map to the same Bloom's level AND the same structural contract, they probably shouldn't be separate extensions. If they map to different levels, the distinction is likely durable.

#### The Inverted Pyramid: Ref Bias as a Design Principle

Bloom's pyramid puts a premium on higher cognitive levels — synthesis and evaluation are harder to achieve, rarer, and traditionally more valued. Trust economics inverts the emphasis. Higher Bloom's levels are also harder to *verify*: checking whether a ref accurately represents its source (remember/understand) is cheap; checking whether a synth's reasoning is sound (analyze/evaluate/create) is expensive — the "no oracle" problem.

The design goal is to push knowledge *down* the pyramid whenever honest. Conversations naturally produce a mix of ref-shaped content (facts learned, tool behaviors observed, external patterns) and synth-shaped content (decisions, analysis, original design). Most of the ref material is embedded *inside* the reasoning — restated inline rather than captured separately. Extracting it into standalone `.ref.md` files means:

- **More of the knowledge base lives in the cheapest-to-verify tier.** A broad base of refs that can be checked against their sources mechanically.
- **Synths get smaller and more verifiable.** They cite refs instead of restating facts, so what remains is concentrated reasoning — the part that actually requires evaluating the argument.
- **The pyramid shape emerges naturally.** Many refs at the base, fewer synths at the top, each synth standing on cited refs. This mirrors the intuitive ratio of understanding to synthesis — the same shape Bloom's predicts for cognitive work, but driven by verification cost rather than cognitive difficulty.

This is not about forcing synth material into refs — that would misrepresent the document's role. It's about *separating* what's already ref-shaped from the reasoning it's tangled with. The `/to-pkm` skill (see [to-pkm.synth.md](to-pkm.synth.md)) operationalizes this as the "ref-bias principle": actively decompose session content to maximize ref output.

#### Agent Workflow Extensions

Where Bloom's becomes directly actionable is in **agent workflow artifacts**. The phases of a structured workflow like dialectic assessment map cleanly to distinct cognitive levels:

| Phase | Bloom's Level | Agent Role | Possible Extension |
|-------|--------------|------------|-------------------|
| Plan | Create | Planner | `.plan.md` |
| Assess | Analyze | Assessors | `.assessment.md` |
| Respond | Evaluate | Author | `.response.md` |
| Audit | Evaluate (meta) | Auditor | `.audit.md` |
| Synthesize | Create (from analysis) | Synthesizer | `.synthesis.md` |
| Triage | Evaluate | Triage agent | `.triage.md` |

Each of these phases has a distinct structural contract — an assessment MUST have severity classifications, a triage output MUST have a READY/NEEDS_INPUT determination, an audit MUST have APPROVED/CONCERNS. Compound extensions enable hooks and schemas to enforce these contracts deterministically rather than relying on prompt instructions. The extension makes the document's structural requirements machine-readable, so a hook can reject a `*.assessment.md` write that lacks severity classifications.

This is the connection between the taxonomy and the trust economics principle: deterministic validation of agent output is higher trust than probabilistic instruction-following. The compound extension is what makes the hook possible.

### Knowledgebase vs Agent Extensions

Knowledgebase extensions (`.ref.md`, `.synth.md`, `.index.md`) describe durable knowledge artifacts. Agent extensions (`.plan.md`, `.assessment.md`, etc.) describe ephemeral process artifacts. They serve different purposes — trust infrastructure for human review vs structural contracts for agent workflows — and live in different contexts (knowledge base directories vs `.ralph/runs/`). They share the same mechanism (compound extension → schema → hook) but are separate namespaces.

## Frontmatter Design

### Per-Type Schemas

The compound extension determines the schema. No configuration mapping — a validation tool derives the schema path from the filename mechanically:

```
*.ref.md    → schemas/ref.schema.yaml
*.synth.md  → schemas/synth.schema.yaml
*.index.md  → schemas/index.schema.yaml
```

Schema details are intentionally deferred — they should emerge from actual use. Initial required fields likely include:

- **All types**: `id`, `summary`, `topics`
- **Synth**: `status`, `sources`
- **Ref**: `source` or `origin`

### Topics

Free-form vocabulary is the only scalable option. Controlled vocabularies require governance that recreates the maintenance burden we're eliminating.

To manage synonym drift, a lazy synonym dictionary:

```yaml
# .kb/topic-synonyms.yaml
dialectic-assessment:
  - competing-subagents
  - adversarial-review
trust-economics:
  - verification-burden
  - trust-cost
```

This dictionary is advisory, not enforced at write time. Two uses:
- An advisory hook suggests canonical forms when near-matches exist (non-blocking)
- A periodic normalization script proposes canonicalization across a knowledge base when it feels messy

Since semantic retrieval handles discovery regardless of vocabulary consistency, synonym governance can be lazy and eventually-consistent. The dictionary is for human legibility and structured queries, not for retrieval.

### Topic Extraction

Ideally, topics are assigned at authoring time — Claude includes them when creating a document, enforced by the PreToolUse hook as a required frontmatter field. The synonym dictionary in CLAUDE.md gives Claude enough vocabulary context to pick reasonable topics cheaply.

When topics are missing or incomplete (legacy documents, bulk imports, fleeting notes promoted to synths), three fallback strategies avoid the expensive full-pass LLM extraction:

**Heading extraction** (zero LLM cost). Parse h2/h3 headings, strip common words, map against the synonym dictionary. `## Dialectic Assessment` → `dialectic-assessment`. Works especially well for `.ref.md` files which tend to be organized by topic. Scriptable.

**Neighbor propagation** (zero LLM cost). Inherit candidate topics from a document's `sources` and `related` fields. If W1 cites LANDSCAPE.ref.md and LANDSCAPE already has `topics: [multi-agent, dialectic-assessment]`, those are strong candidates for W1. A script walks the dependency graph and suggests topics from neighbors. The more documents have topics, the easier it gets — the graph bootstraps itself.

**Similarity clustering** (near-free, reuses retrieval embeddings). If the retrieval tool has already embedded documents, cluster by embedding similarity and propagate topics within clusters. Documents without topics inherit from their nearest neighbors that have them. The embeddings are already computed for search; this reuses them for a different purpose.

These replace the post-hoc full-pass LLM extraction entirely. Topic quality doesn't need to be perfect at authoring time — it needs to be good enough that semantic retrieval can find the document. Periodic normalization catches drift later.

### The `auto_summary` Pattern

The `summary` field is the highest-value frontmatter field — it enables token-efficient triage across an entire knowledge base. But when Claude authors the summary, it's an unverified claim about the document's content.

The `auto_summary: true` field signals that the summary was machine-generated and hasn't been human-reviewed. This creates a reviewable queue (`grep -rl 'auto_summary: true'`) without blocking authoring. When you've confirmed a summary, remove the field or set it to `false`.

This doesn't solve the trust problem — it makes it visible. The summary is a claim that itself has an epistemic status.

## Zettelkasten Practices

Several Zettelkasten techniques map naturally onto this system. Some are already baked in; others add value.

**Already present:** Literature notes / permanent notes (`.ref.md` / `.synth.md`), structure notes (`.index.md`), bidirectional linking (frontmatter `related` and `sources`), progressive summarization (the `summary` field is layer 4 — distill to the gist), and serendipitous discovery (semantic retrieval finds connections without pre-imposed structure).

**Atomicity.** One idea per note. Findings like W1 are already atomic — one claim examined per document. Larger design documents are not. The compound extension system is designed for atomic documents connected by `.index.md` files. Atomicity should be preferred for new knowledgebase documents; monolithic documents should decompose over time. Atomicity also improves staleness detection — per-idea granularity instead of "somewhere in this 1400-line file."

**Fleeting notes.** Temporary capture that either gets promoted or discarded. Fleeting notes use the `.temp.md` compound extension — giving tooling a selector for cleanup scripts, review reminders, and qmd exclusion, while keeping ceremony minimal. Frontmatter requires only `id`, `summary`, and `captured` date; `topics` and `sources` are optional but encouraged for discoverability. Promotion means renaming to `.synth.md` or `.ref.md` and adding the required frontmatter for that type. The `/to-pkm` skill (see [to-pkm.synth.md](to-pkm.synth.md)) is the primary mechanism for producing `.temp.md` files from session content.

**MOC generation.** `.index.md` files can be generated mechanically from frontmatter across a knowledge base rather than hand-maintained. The index is a **view over frontmatter**, not a separate artifact:

- Read `topics` from all `*.{ref,synth}.md` files → group documents by topic
- Read `summary` → display the gist without opening each file
- Read `related` and `sources` → show the forward link graph
- Compute **backlinks** by inverting `related` and `sources` across all files → show what references each document

Example generated output:
```markdown
## dialectic-assessment

### Synths
- **W1** — Coach/player dyad is a simplification; AT's N-assessor model is distinct [partial]
  - sources: LANDSCAPE.ref.md, AI_TOOLING.synth.md
  - related: V11, W2
  - referenced by: W2, pkm.synth.md

### Refs
- **LANDSCAPE §22** — Heterogeneity beats homogeneity
  - referenced by: W1, W3, AI_TOOLING.synth.md
```

Backlinks appear in the generated index, never in source documents. This preserves checksum integrity for staleness detection while providing the full bidirectional link graph. The index can be regenerated at any time — frontmatter is the source of truth, the index is derived content.

This directly replaces the manual INDEX.md maintenance workflow. The token cost drops from "read and update a 90KB index every session" to "run a script."

**Orphan detection.** Documents not linked to or from anything — a `.synth.md` with no `related` entries and not referenced in any other document's frontmatter — may represent integration gaps. Worth checking periodically but not a primary automation target.

## Toolchain

All components live in dotfiles (stowable or referenceable). Any new project inherits them.

### Claude Hooks

**PreToolUse on Write/Edit matching `*.{ref,synth,index}.md`** — schema validation. Rejects the write if required frontmatter is missing or malformed. This is the deterministic enforcement layer — CLAUDE.md tells Claude what frontmatter to include, the hook ensures it actually did.

**PostToolUse on Write/Edit matching `*.ref.md`** — staleness detection. When a ref is modified, grep all `*.synth.md` files for that filename in their `sources:` frontmatter and surface a warning listing potentially stale synths. Non-blocking, informational.

**PostToolUse on Write matching `*.{ref,synth,index}.md`** — advisory synonym check. Compare topics against the synonym dictionary and suggest canonical forms if near-matches exist. Non-blocking.

### Git Hooks

**post-commit** — staleness detection outside Claude sessions. When `*.ref.md` files appear in a commit diff, grep `*.synth.md` files for references and warn about potentially stale synths.

Start with grep-based staleness detection. If insufficient, evolve to source checksums in frontmatter:

```yaml
sources:
  - file: LANDSCAPE.ref.md
    sha: a3f2c1
```

### Structural Integrity Checks

Beyond frontmatter, knowledgebase documents have content-level correctness properties that should be validated mechanically.

**Referential numbering consistency.** Documents that use numbered identifiers for sections or items (e.g., `§1`, `§2`, `L1`, `L2`) must maintain coherent numbering throughout. If LANDSCAPE.md uses `L1, L2, L3` in one section and switches to `1, 2, 3` later, every cross-reference citing `LANDSCAPE §22` in other synths becomes ambiguous or silently wrong. This is the worst kind of staleness — it looks correct but points to the wrong content. A linter can detect numbering scheme inconsistencies within a document.

**Table of contents accuracy.** TOCs can be generated mechanically from headings. A validator can diff the existing TOC against the current heading structure and flag drift. Generated TOCs should be treated as derived content — regenerated, not hand-maintained.

These checks should run from multiple surfaces:
- **Vim** — ALE linter or autocommand that validates on save
- **Claude hooks** — PostToolUse on Edit matching knowledgebase files
- **test.sh / CI** — alongside yamllint, shellcheck, and frontmatter schema validation

Claude hooks alone aren't sufficient — they only catch edits made within Claude sessions. Vim catches manual edits. CI catches everything. All three run the same underlying validation, just triggered differently.

### Frontmatter Validation

`remark-lint-frontmatter-schema` (or a custom script) for JSON Schema validation of frontmatter against per-type schemas. Runnable in `test.sh` alongside existing linters.

### Vim Integration

**Template insertion** — when opening a new `*.{ref,synth,index}.md` with no content, insert the appropriate frontmatter skeleton. Vim parses the compound extension from the filename to determine the type.

**ALE linting** — register the frontmatter schema linter as an ALE linter for knowledgebase file patterns. Inline diagnostics for missing required fields, unknown topics (advisory synonym check), malformed YAML.

**Statusline** — lightline already shows branch + filepath. For knowledgebase files, parse and display document type and status from frontmatter. Quick visual signal: `W1.synth.md | partial | 3 topics`.

**Navigation** — extend `gf` (already overridden to open in new tab) to be frontmatter-aware. Cursor on a `related: [W1, V11]` entry resolves to `W1.synth.md` in the same directory. Same for `sources:` entries resolving to `*.ref.md` files.

## Open Questions

- **Semantic retrieval + frontmatter interaction.** Can the retrieval tool treat frontmatter as structured metadata for filtering (e.g., "findings with status: partial about multi-agent patterns")? Or does it treat the whole file as text? If the latter, structured queries need a separate mechanism.
- **Cross-project references.** Knowledge bases are scattered across projects. How do cross-project references work? Are retrieval collections project-scoped? Can frontmatter reference documents in other collections?
- **Migration path.** Existing knowledge bases need retrofitting with compound extensions and frontmatter. Renaming files updates every cross-reference. What happens to existing index files — deprecated, trimmed, or converted?
- **Summary trust.** `auto_summary` signals the problem but doesn't solve it. Is spot-checking sufficient, or does the summary need a more rigorous review mechanism?
- **Agent extension naming.** `.synth.md` (knowledgebase: your thinking) and `.synthesis.md` (agent: reconciled assessor output) are conceptually related but operationally different. They live in different contexts (knowledge base directories vs `.ralph/runs/`), but the naming similarity could cause confusion. Worth disambiguating?
- **Staleness detection granularity.** Grep-based detection finds which synths reference a changed ref, but not whether the change actually affects the synth's conclusions. Is file-level granularity sufficient, or does section-level tracking justify the added complexity?

## TODO
- figure out how to handle filename/id conflicts and multi-folder topologies
- consider `stage: axiom` or `kind: normative` in frontmatter to support content like philosophy or guiding principles
- [ ] Write a staleness detection tool that autonomously identifies stale `*.synth.md` and `*.index.md` files by comparing their `sources:` frontmatter against the current state of referenced files (git history, checksums, or modification times). Should be runnable as a standalone CLI, from vim, from Claude hooks, and from CI.
- [ ] Write a MOC generator that reads frontmatter from all `*.{ref,synth}.md` files in a directory, groups by topic, computes backlinks by inverting `related` and `sources` fields, and outputs `.index.md` files. Should be re-runnable (index is derived content, always regeneratable from frontmatter).
- [ ] Write an influence/risk scorer that builds the dependency graph from frontmatter (`sources`, `related`), computes per-document influence (in-degree, transitive dependents), cross-references with trust signals (`auto_summary`, `status: draft`, unreviewed content), and outputs a prioritized review queue. High influence + low trust = review first. This directly operationalizes trust economics: review effort proportional to blast radius, not document count.

- [ ] Define a claude.md
  - core methodology
  - prefer atomic/small notes, especially for reference-type notes
    - This avoids context bloat
    - This makes references easier to follow
  - Are there zettelkasten concepts or methodologies