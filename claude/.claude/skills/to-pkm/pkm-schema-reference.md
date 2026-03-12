# PKM Frontmatter Schema Reference

Source: `scripts/schemas/pkm.json`

## Compound Extensions

Files use compound extensions to declare their type: `.ref.md`, `.synth.md`, `.temp.md`, `.index.md`.

## Types

### ref (`.ref.md`) — External Knowledge

Facts, tool behaviors, source summaries. Cheapest to verify.

**Required frontmatter:**
- `summary`: string — one-line description
- `generated`: bool — always `true` for AI-generated
- `created`: datetime — ISO-8601
- `topics`: string[] — classification tags
- `sources`: string[] — where the facts come from (URLs, filenames, descriptions)

**Optional:** `id`, `related`, `ai_reviewed_at`, `human_reviewed_at`

**Content rules:** Every claim must be verifiable against a cited external source.

**Must NOT contain:**
- Design proposals or options (e.g. "Option A vs Option B")
- Recommendations or strategic advice
- Risk assessments or evaluative judgments
- Implications sections reasoning about what facts mean
- Proposed code changes or implementation sketches
- Comparative analysis or trade-off discussion

**When in doubt:** Split the file. Facts stay in `.ref.md`, analysis goes in `.synth.md` that cites it.

### synth (`.synth.md`) — Original Thinking

Analysis, decisions, designs, proposals. Expensive to verify.

**Required frontmatter:**
- `summary`: string
- `generated`: bool
- `created`: datetime
- `topics`: string[]
- `sources`: string[] — cited refs, URLs, files
- `status`: enum — `draft`, `partial`, or `complete`

**Optional:** `id`, `related`, `ai_reviewed_at`, `human_reviewed_at`

**Content rules:** Cite `.ref.md` files for supporting facts rather than restating them inline.

**Must NOT contain:**
- Raw facts that belong in a `.ref.md` (extract and cite instead)
- Navigation structures or file listings (use `.index.md`)
- Unstructured scratch notes without analysis (use `.temp.md`)

**When in doubt:** If a section is purely factual, extract to `.ref.md` and cite it.

### temp (`.temp.md`) — Scratch Notes

Questions, half-formed ideas. No verification burden.

**Required frontmatter:**
- `summary`: string
- `generated`: bool
- `created`: datetime

**Optional:** `id`, `topics`, `sources`, `ai_reviewed_at`, `human_reviewed_at`

**Content rules:** Capture thoughts quickly; promote to `.ref.md` or `.synth.md` when content solidifies.

**Must NOT contain:**
- Polished analysis (use `.synth.md`)
- Verified facts with citations (use `.ref.md`)

**When in doubt:** Keep it in `.temp.md`. Always safe to start here and promote later.

### index (`.index.md`) — Navigation

Maps, cross-references, session manifests. Purely structural.

**Required frontmatter:**
- `summary`: string
- `generated`: bool
- `created`: datetime
- `topics`: string[]
- `sources`: string[] — files being indexed

**Optional:** `id`, `related`, `ai_reviewed_at`, `human_reviewed_at`

**Content rules:** Links, lists, and cross-references only. No original content.

**Must NOT contain:**
- Original analysis (use `.synth.md`)
- Factual documentation (use `.ref.md`)
- Prose paragraphs — keep to links and brief descriptions

## Frontmatter `sources` Values

Expected to be relative paths from the note itself to referenced PKM notes, or URLs/descriptions for external sources.
