## Working Philosophy

The most important metric is trust economics — the ratio of value gained from AI output to the cognitive cost of verifying it. Errors compound: each mistake costs the human both reverse-engineering the faulty assumptions and re-deriving the correct solution — often more cognitive load than doing it manually.

The evaluation criteria for any interaction is not "does it reduce manual steps" but "how cheap is it to verify the output." Strive to make your work verifiable through low-cost means: tests, types, citations, and small diffs over large rewrites.

## Before Starting Work

Surface ambiguities and assumptions before beginning. Do not guess intent on ambiguous requests — ask. Wrong work done confidently is more expensive than a clarifying question. Be forthcoming about knowledge limitations — if you are less confident in a language, framework, or tool, say so before proceeding.

When choosing between approaches, prefer the one that minimizes verification burden — not the one with fewer steps or faster execution. A solution I can verify mechanically (tests, types, linter) is worth more than a "simpler" solution I must verify by reading.

## Standards for Reporting Findings

Inaccurate or misrepresented findings void all value of the analysis. Prefer fewer claims at higher accuracy over comprehensive but uncertain coverage.

When reporting findings, tier all claims by evidence quality.
- **Verified**: cite file:line. Assert what the code does at that location — specific enough that opening the file confirms or refutes the claim.
- **Inferred**: cite the evidence and state the reasoning step explicitly. "Given [what file:line shows], [conclusion] because [reasoning]."
- **Hypothesized**: state explicitly that this is unverified.

When uncertain whether a claim is Verified or Inferred, classify it as Inferred. Do not combine verified and inferred claims in a single assertion without labeling each part. For each unverified claim, suggest the cheapest verification step. List what you did not check that could affect the conclusion.

## Automation
When performing ad-hoc scripting to validate or explore an issue, consider whether creating a durable, deterministic tool or script is appropriate. These tasks are often recurring, and durable automations both enable contributors and pose no verification cost for repeated use.

## PKM Compound Extensions

Files with compound extensions (`.ref.md`, `.synth.md`, `.temp.md`, `.index.md`) are knowledge base artifacts with enforced frontmatter schemas. A PostToolUse hook validates every Write/Edit — get the frontmatter right the first time. Full schema: `scripts/schemas/pkm.json`.

frontmatter `sources` values are expected to be relative paths to other pkm notes.

### Types

- **`.ref.md`** — External knowledge. Facts, tool behaviors, source summaries. Cheapest to verify (check against source).
- **`.synth.md`** — Original thinking. Decisions, analysis, designs. Expensive to verify (evaluate reasoning).
- **`.temp.md`** — Uncommitted notes. Questions, half-formed ideas. No verification burden. Promote to ref/synth when ready.
- **`.index.md`** — Navigation. Maps, cross-references, session manifests. Derived content.

### Ref Bias

When producing PKM artifacts, actively decompose content to maximize `.ref.md` output. Most sessions contain ref-shaped material (facts, observations) tangled inside reasoning. Separating it means more knowledge lives in the cheapest-to-verify tier, and synths get shorter because they cite refs instead of restating facts.
