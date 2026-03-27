<!-- Generated from scripts/schemas/pkm.json — do not edit manually. -->
<!-- Regenerate: scripts/generate-pkm-reference.sh -->

# PKM Frontmatter Schema Reference

Source: `scripts/schemas/pkm.json`

## Compound Extensions

Files use compound extensions to declare their type: `.ref.md`, `.synth.md`, `.temp.md`, `.index.md`.

## Types

### ref (`.ref.md`) — External knowledge

Facts, tool behaviors, source summaries. Cheapest to verify.

**Required frontmatter:**
- `summary` (string) — one-line description
- `generated` (bool) — always true for AI-generated
- `created` (datetime) — ISO-8601
- `topics` (string[]) — classification tags
- `sources` (string[]) — where the facts come from (URLs, filenames, relative paths to PKM notes)

**Optional:** `ai_reviewed_at`, `human_reviewed_at`, `id`

**Content rules:** External knowledge: facts, tool behaviors, source summaries. Cite sources as inline markdown links (`[text](path-or-url)`) — every frontmatter `sources` entry must appear as a link in the body. Every claim must be verifiable against a cited external source.

**Must NOT contain:**
- Design proposals or options (e.g. 'Option A vs Option B', 'Proposed approach')
- Recommendations or strategic advice (e.g. 'Recommended', 'Should consider')
- Risk assessments or evaluative judgments (e.g. 'high risk', 'maximally friendly')
- Implications sections that reason about what facts mean for unrelated work
- Proposed code changes, implementation sketches, or 'minimal change sets'
- Comparative analysis or trade-off discussion between alternatives
- Phantom sources — frontmatter `sources:` entries that never appear as inline markdown links in the body. Every source must be cited where it's relevant.
- Catalogs or listings of many external sources with only light summaries (extract the substantive facts, or split into individual refs per source)

**When in doubt:** Split the file. Facts stay in .ref.md, analysis and proposals go in a .synth.md that cites it. A short ref that is 100% verifiable is worth more than a long ref with synthesis mixed in. If the body reads like a list of links with one-line descriptions rather than extracted facts, either deepen the extraction or split into individual refs.

### synth (`.synth.md`) — Original thinking

Analysis, decisions, designs, proposals. Expensive to verify.

**Required frontmatter:**
- `summary` (string) — one-line description of the analysis or decision
- `generated` (bool) — always true for AI-generated
- `created` (datetime) — ISO-8601
- `topics` (string[]) — classification tags
- `sources` (string[]) — cited refs, URLs, files
- `status` (enum:draft,partial,complete) — draft, partial, or complete

**Optional:** `ai_reviewed_at`, `human_reviewed_at`, `id`

**Content rules:** Original thinking: analysis, decisions, designs, proposals. Cite sources as inline markdown links (`[text](path)`) — every frontmatter `sources` entry must appear as a link in the body, anchoring it to the content it supports. Do not restate facts from refs; link to them.

**Must NOT contain:**
- Raw facts or source documentation that belong in a .ref.md (extract and cite instead)
- Navigation structures, file listings, or cross-reference maps (use .index.md)
- Unstructured scratch notes or questions without analysis (use .temp.md)
- Phantom sources — frontmatter `sources:` entries that never appear as inline markdown links in the body. Every source must be cited where it's relevant.

**When in doubt:** If a section is purely factual and verifiable against an external source, extract it to a .ref.md and cite it. Synths should be lean — reasoning and conclusions, not restated evidence.

### temp (`.temp.md`) — Uncommitted notes

Questions, half-formed ideas. No verification burden.

**Required frontmatter:**
- `summary` (string) — one-line description
- `generated` (bool) — always true for AI-generated
- `created` (datetime) — ISO-8601

**Optional:** `ai_reviewed_at`, `human_reviewed_at`, `id`, `sources`, `topics`

**Content rules:** Scratch space with no verification burden. Capture thoughts quickly; promote to .ref.md or .synth.md when the content solidifies. If sources are listed, cite them as inline markdown links (`[text](path)`) — every frontmatter `sources` entry must appear as a link in the body.

**Must NOT contain:**
- Polished analysis or design decisions that should be a .synth.md
- Verified facts with source citations that should be a .ref.md
- Phantom sources — frontmatter `sources:` entries that never appear as inline markdown links in the body. Every source must be cited where it's relevant.

**When in doubt:** Keep it in .temp.md. Temp is the lowest-cost default — it's always safe to start here and promote later.

### index (`.index.md`) — Navigation and structure

Maps, cross-references, session manifests.

**Required frontmatter:**
- `summary` (string) — one-line description
- `generated` (bool) — always true for AI-generated
- `created` (datetime) — ISO-8601
- `topics` (string[]) — classification tags
- `sources` (string[]) — files being indexed

**Optional:** `ai_reviewed_at`, `human_reviewed_at`, `id`

**Content rules:** Purely structural. Links, lists, and cross-references to other PKM files. No original content — all substance lives in the files being linked. Cite sources as inline markdown links (`[text](path)`) — every frontmatter `sources` entry must appear as a link in the body.

**Must NOT contain:**
- Original analysis or commentary (use .synth.md)
- Factual documentation (use .ref.md)
- Prose paragraphs — index files should be links and brief descriptions, not essays
- Phantom sources — frontmatter `sources:` entries that never appear as inline markdown links in the body. Every source must be cited where it's relevant.

**When in doubt:** If you're writing more than a sentence of description per link, the content probably belongs in its own .ref.md or .synth.md.

## Frontmatter `sources` Values

Expected to be relative paths from the note itself to referenced PKM notes, or URLs/descriptions for external sources.
`sources` serves as both provenance (where facts came from) and cross-reference (related PKM files).
