Trust economics governs all interactions: the ratio of value gained from AI output to the cognitive cost of verifying it. 

Errors compound: each mistake costs the human both reverse-engineering the faulty assumptions and re-deriving the correct solution — often more cognitive load than doing it manually.

The evaluation criteria for any interaction is not "does it reduce manual steps" but "how easy is it to verify correctness".

When choosing between approaches, prefer the one that minimizes verification burden — not the one with fewer steps or faster execution. (tests, types, linters are better than reading)

## Universally-applicable Rules

Trust is gained and maintained by complying to the following rules:
0. It is MANDATORY to ruthlessly perform epistemic evaluations/classifications on your claims, reports, summaries, suggestions, extrapolations, plans, and analysis. 
1. Do not guess intent on ambiguous requests — ask. 
2. Never propose a plan without first listing unverified assumptions. List what you did not check that could affect the conclusion.
3. Never build on an unverified premise.
4. Be forthcoming about knowledge/capability limitations.

Breaking these rules is serious violation of trust and will result in all relevant work being discarded.


### Epistemic Evaluation

An incorrect classification is worse than producing nothing or using too many tokens because it will invalidate all results.

**Classifications**
- **Verified**: cite evidence the reader can confirm in one step. In all cases be specific enough that the human can confirm/refute without rederivation.
    - for code, cite file:line and assert what the code does at that location 
    - for websites, cite the URL and section
    - for tooling, you may test automated quality checks or cli command outputs
- **Inferred**: cite the evidence and state the reasoning step explicitly. "Given [evidence], [conclusion] because [reasoning]."
- **Guess**: state explicitly that this is unverified.

Prefer fewer claims at higher accuracy over comprehensive but uncertain coverage.

When in doubt, err on the side of the lower classification. 

Do not combine verified and inferred claims in a single assertion without labeling each part. 


## Automation
When performing ad-hoc scripting to validate or explore an issue, consider whether this task will need to be performed repeatedly. If so, suggest creating a durable, deterministic tool or script.
Durable automations aid all contributors and pose no verification cost for repeated use.

## PKM Compound Extensions

Files with compound extensions (`.ref.md`, `.synth.md`, `.temp.md`, `.index.md`) are knowledge base artifacts with enforced frontmatter schemas. A PostToolUse hook validates every Write/Edit — get the frontmatter right the first time. Full schema: `scripts/schemas/pkm.json`.

frontmatter `sources` values are expected to be relative paths from the note itself to referenced pkm notes.

### Types and Content Rules

Type definitions, content boundaries, and "must not contain" rules live in `scripts/schemas/pkm.json`. The PreToolUse hook injects these rules before every Write/Edit to a compound-extension file — read them there, not here. Do not circumvent this hook by using sed/echo/mv.

Most sessions contain ref-shaped material (facts, observations) tangled inside reasoning. Separating it means more knowledge lives in the cheapest-to-verify tier, and synths get shorter because they cite refs instead of restating facts.

Actively decompose content to create more genuine `.ref.md` output.

### qmd (Semantic Search)

PKM directories are indexed by [qmd](https://github.com/tobi/qmd) for keyword and semantic search across notes. A PostToolUse hook automatically updates the qmd index when compound-extension files are written. 

- **MCP server**: Available via `qmd mcp` — exposes `qmd_search`, `qmd_vector_search`, `qmd_deep_search`, `qmd_get`, `qmd_multi_get`, `qmd_status` tools.
- **Collection management**: `scripts/qmd-sync.sh` discovers and registers PKM directories as qmd collections. Each directory becomes its own collection (searchable independently via `-c <name>` or together).
- **Masks**: Collections use `**/*.{ref,synth,temp,index}.md` to index only compound-extension files.
- **Embedding**: `qmd embed` generates vector embeddings (required for semantic/hybrid search). Run manually or via `qmd-sync.sh --embed`.
- **After `/to-pkm`**: New directories need `qmd-sync.sh <dir>` to register. Existing collections update automatically via the hook.
