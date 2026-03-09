---
id: dialectic-assessment
summary: "Dialectic assessment as a standalone adversarial review skill — thesis-first interface for scrutinizing plans, research, designs, and debugging hypotheses"
topics:
  - dialectic-assessment
  - trust-economics
  - competing-subagents
  - adversarial-review
  - verification
status: draft
auto_summary: true
sources:
  - AI_TOOLING.md
  - pkm.synth.md
  - RALPH_CORE_PLAN.synth.md
  - to-pkm.synth.md
  - guiding_principles.md
  - LANDSCAPE.md
  - ClaimVerification.md
  - gap_analysis/W1.md
  - gap_analysis/W2.md
  - gap_analysis/W6.md
  - gap_analysis/D2.md
  - gap_analysis/D9.md
  - gap_analysis/D15.md
  - gap_analysis/V6.md
  - gap_analysis/V7.md
  - gap_analysis/V9.md
  - gap_analysis/V10.md
---

# Dialectic Assessment: Standalone Skill Design

## Problem

AI-assisted work produces reasoning you can't verify mechanically. Tests verify code. Types verify contracts. Linters verify style. Nothing verifies whether a design decision is sound, a research synthesis is well-reasoned, or a debugging hypothesis targets the right root cause.

The trust economics cost is asymmetric: implementation work has oracles (tests pass or they don't), but conceptual work — designs, analyses, research conclusions, diagnostic hypotheses — has no oracle. You either verify the reasoning yourself (expensive, defeats the purpose) or you trust it (risky). The dialectic pattern addresses this gap: competing perspectives surface assumptions, factual errors, and reasoning flaws so that the human review pass is a spot-check, not a full audit.

AI_TOOLING.md (lines 382-676) defines this pattern in detail but frames it as a ralph loop extension — a pre-execution gate for implementation plans. The mechanism is general; the framing is specific. This document reframes dialectic assessment as a standalone skill whose primary value is in conceptual work, with ralph integration as one consumer.

Additionally, D2's finding on agent overconfidence (~43pp systematic overestimate) reframes the dialectic as **load-bearing, not supplementary**. Upstream gates (triage, preflight) are probabilistic filters with known false-positive bias. The dialectic compensates — it's a second chance to catch what triage misses. For standalone conceptual use, where there's no downstream test suite either, the dialectic may be the *only* structured verification step.

## Core Mechanism

The dialectic method applied to any thesis:

1. **Thesis** — The artifact under review (a plan, a `.synth.md`, a debugging hypothesis, an inline argument)
2. **Antithesis** — Assessors challenge it from orthogonal angles, producing severity-classified findings
3. **Synthesis** — Reconciliation step that aggregates findings, surfaces tradeoffs, and flags unresolved issues with citations back to individual assessor reports
4. **Audit** — Meta-review of the synthesis itself for coherency, dropped findings, and unsound reasoning
5. **Convergence loop** — Rounds repeat until no Blockers remain or `MAX_ROUNDS` is hit

This is unchanged from AI_TOOLING.md's design. What changes is the interface, the trigger, and the assumption about what a "thesis" is.

## Use Cases

### 1. Planned Work Review

You've decomposed a task (via `/planner` or manually). It has a `planned` tag. Before execution — either by ralph or by hand — you want adversarial scrutiny of the plan.

**Thesis**: The plan (a file, a tk ticket body, or inline).
**Assessors**: Task-driven. Risk, plan-critic, and claim-verification are the common set. Domain-specific assessors (OWASP, performance, API contract) when the plan's scope warrants them.
**Value**: Catches wrong assumptions before they become wrong code. The downstream cost of a flawed plan is the entire implementation — catching it here is the cheapest possible intervention.

### 2. Research / Synth Scrutiny

You've produced a `.synth.md` — original analysis, a design proposal, a synthesis of research findings. The reasoning has no oracle. This is the "no oracle" problem from guiding_principles.md: exploratory/analytical work is the hardest to trust.

**Thesis**: The synth document (or a draft of one).
**Assessors**: Claim-verification is almost always relevant — separating ref-shaped content (checkable facts) from genuinely synth-shaped content (reasoning) shrinks the unverifiable surface. A critic role that challenges the reasoning structure itself. Domain-specific assessors if the subject warrants them.
**Value**: The highest-ROI application. Conceptual work is where verification cost is highest and automated checks are nonexistent. Each assessment round either builds confidence or surfaces the specific assumptions the human needs to evaluate — never "re-read the whole thing."

### 3. Complex Debugging

A hypothesis about root cause IS a thesis. You believe the bug is caused by X. You've gathered evidence. But confirmation bias is real — you've been looking for evidence that supports X, not evidence that refutes it.

**Thesis**: The diagnostic hypothesis (inline or as a file).
**Assessors**: A "devil's advocate" role asking "what else could explain this?" A claim-verification role checking "is the evidence you're citing actually what you think it is?" A risk role asking "if this hypothesis is wrong, what's the blast radius of acting on it?"
**Value**: Prevents the expensive failure mode where you fix the wrong thing confidently. Each assessor round either strengthens the hypothesis or reveals it's built on shaky evidence — before you've written the fix.

## Skill Interface

### Input: A Thesis

The skill takes a thesis, not a task ID. Task IDs are one source of theses; draft synths, debugging write-ups, and inline arguments are others.

```
/assess <file>                    # assess a file
/assess <file> --with risk,owasp  # explicit assessor selection
/assess                           # assess inline (thesis provided in conversation)
```

When invoked with a file, the skill reads it. When invoked without a file, the thesis is the preceding conversation context (or the user provides it after invocation). The skill should not guess — it should present its understanding of the thesis and ask the user to confirm or correct before proceeding. A confirmation step like "I'll assess the following: [summary]. Is this the thesis, or should I adjust scope?" is low-cost and prevents the expensive failure mode of assessing the wrong thing.

### Assessor Count

Any number of assessors is valid, including one. `/assess <file> --with claim-verification` runs just that assessor and presents its report directly — no synthesis step (nothing to synthesize from one perspective), no audit (nothing to cross-check). The synthesis/audit steps activate when 2+ assessors run.

This creates a natural on-ramp: start with a single claim-verification pass on a draft synth. If findings warrant deeper scrutiny, re-run with additional assessors for the full dialectic.

### Assessor Selection

Three mechanisms, from most to least explicit:

1. **Explicit** — `--with risk,claim-verification,plan-critic`. The user knows which lenses matter. No ceremony beyond naming them.
2. **Default set** — When no assessors are specified, a small default set runs. The default should be broadly useful without being expensive: `plan-critic` + `claim-verification` covers the two most common failure modes (flawed reasoning and incorrect facts).
3. **Registry browse** — The user can list available assessors to choose from. The registry grows over time; not every assessor needs to exist at launch.

The tag-based profile system from AI_TOOLING.md (lines 489-502) remains useful for ralph integration — when the thesis source is a tk ticket, tag-based defaults provide automated selection. But for manual invocation, explicit selection and sensible defaults are sufficient.

### Output: Synthesis + Artifacts

The synthesis is the deliverable. Individual assessor reports are process artifacts for drill-down.

The synthesis format from AI_TOOLING.md carries over unchanged:

```markdown
## Synthesis

### Blockers (must resolve before proceeding)
- <finding> (<Assessor> §<section> — Blocker)
  → Suggested resolution

### Improvements (human decision)
- <finding> (<Assessor> §<section> — Improvement)

### Nits
- <finding> (<Assessor> §<section> — Nit)

### Unresolved
- <question or gap> — cheapest verification step: <suggestion>
```

Each claim cites `<Assessor> §<section>`, making the synthesis a table of contents into the decision tree. The human can spot-check any claim by reading the referenced report section without reading all reports end-to-end.

## Severity Classification

Unchanged from AI_TOOLING.md (lines 584-594). This is the primary signal:noise filter.

| Severity | Definition | Effect |
|----------|-----------|--------|
| **Blocker** | Correctness issue, unsupported conclusion, factual error, or critical gap. The thesis cannot stand as-is. | Triggers a revision round. |
| **Improvement** | Better approach exists but current approach works. Quality, not correctness. | Recorded in synthesis. Human decides. |
| **Nit** | Style, phrasing, minor clarity. No substantive impact. | Recorded but never triggers revision. |

Only Blockers trigger revisions. This prevents the diminishing-returns problem where each round produces more Improvements and Nits but no actual corrections.

Note: for non-implementation theses (research, design), "correctness" maps to "sound reasoning and accurate facts" rather than "code works." A synth built on a misrepresented source is a Blocker. A synth that could be organized better is an Improvement.

Severity classification is justified on first principles from trust economics, not research (V7 — the cited sources don't actually validate it). Without tiers, the human must read all findings to determine which matter. With tiers, review becomes a confirmation pass.

V7 also surfaces a potentially useful second dimension: **certainty alongside severity**. A Blocker with high confidence ("this SQL injection is exploitable") has a different review cost than a Blocker with low confidence ("this *might* have a race condition under load"). Currently, severity alone determines whether a revision round triggers. Adding certainty wouldn't change the convergence protocol — it would help the human prioritize which Blockers to spot-check first. Not critical for the initial design but worth noting for future iteration.

## Convergence

The iterative protocol from AI_TOOLING.md (lines 773-837) carries over with one clarification about what "convergence" means for non-implementation work.

### Protocol Per Round

1. **Assess** — Assessors critique the current thesis (parallel, read-only)
2. **Respond** — The author responds to each finding: ACCEPT, REBUT (with evidence), or ACKNOWLEDGE (valid but deferred)
3. **Audit** — The auditor reviews the exchange for coherency, dropped findings, and sound reasoning
4. **Apply** — Changes only after the auditor signs off
5. **Loop** — If changes were made, new round against the updated thesis

The plan must not change during deliberation within a round. All participants evaluate the same artifact. Changes are batched and applied only after the round concludes.

### Convergence Criteria

Both must hold:
1. **No Blockers** in the current round
2. **All factual claims classified** — verified, explicitly marked as assumptions, or flagged as unverifiable

For conceptual work, criterion 2 is where the real value lives. A research synthesis might have zero Blockers (the reasoning is sound) but several unverified factual claims embedded in the argument. The synthesis surfaces those as explicit assumptions with suggested verification steps — shrinking the human's review from "evaluate the whole argument" to "check these 3 facts."

### Hard Limit

`MAX_ROUNDS` (default 3). If Blockers persist, the thesis is not ready — the synthesis documents what remains unresolved and why.

W6 confirms this is sufficient — with only 3 rounds, the maximum waste from cycling is 1-2 extra rounds. Elaborate property-tracking or pre-registration mechanisms to detect cycling are not worth the complexity. The convergence check (no Blockers + all claims classified) already detects progress. The steps required for cycling detection (semantic matching of findings across rounds, distinguishing legitimate re-raising from repetition) are themselves LLM judgments that need verification — ceremony without proportional trust gain.

One low-cost observability improvement: when MAX_ROUNDS is hit, the summary should note which Blockers persisted across all rounds. This is logging, not detection.

## Prompt Design: Questions Over Statements

D15 identifies sycophancy as a cross-cutting threat to every adversarial verification pattern. Models change answers to agree with assertive input ~58% of the time. The entire dialectic relies on adversarial behavior from models RLHF-trained for agreement.

The single highest-leverage zero-cost mitigation: **question framing**. "Ask Don't Tell" (Feb 2026) shows question-based prompts eliminate near-zero sycophancy compared to semantically equivalent statement-based prompts. This is directly actionable.

**Instead of:** "Evaluate this plan for risks."
**Use:** "What are the most critical problems with this plan? What assumptions could be wrong? What failure modes are unaddressed?"

The difference is structural, not cosmetic. A statement ("evaluate this plan") invites agreement with the plan's framing. A question ("what could go wrong?") invites contradiction. This applies to every assessor prompt and — critically — the auditor prompt.

The **auditor is the highest-risk sycophancy point** (D15, V10). It receives a polished synthesis full of confident, resolved-looking statements — exactly the assertive input that maximally triggers agreement bias. The auditor prompt should be a checklist of specific questions ("Are citations accurate? Were any findings dropped? Do conclusions follow from cited evidence?"), not a general "review this synthesis." Consider using a different model family for the auditor as an additional structural defense.

Do NOT add "don't be sycophantic" instructions. Research shows this is less effective than structural framing. AT's existing mechanical defenses (structured artifacts, hooks, severity classification constraining the surface area for agreement) are partial mitigations but were not explicitly designed as anti-sycophancy measures — the question-framing principle makes them work harder.

## Assessor Registry

Each assessor is a skill with `context: fork`, living in a dedicated directory:

```
claude/.claude/skills/assessors/
├── plan-critic/SKILL.md
├── claim-verification/SKILL.md
├── risk/SKILL.md
├── ...
```

Assessors are created as needed. The registry grows over time. A minimal starting set:

### Plan Critic

Challenges structure, necessity, and over-engineering. Asks: "What's unnecessary? What's missing? Is this the simplest approach that works?"

Applicable to: planned work, design synths, architecture proposals.

### Claim Verification

Identifies every factual claim in the thesis and classifies each as Verified (cite evidence), Inferred (evidence + gap), or Hypothesized (no evidence). This is the assessor that separates ref-shaped content from synth-shaped content.

For implementation plans, claims are about the codebase ("function X exists in file Y"). For research synths, claims are about external sources ("tool X supports feature Y," "paper Z concludes W"). For debugging hypotheses, claims are about observed behavior ("the error occurs when X happens").

The claim-verification assessor generalizes across all use cases because the operation is the same: decompose the thesis into atomic factual claims and check each one. What counts as "evidence" changes by context — codebase files, external documentation, reproduction steps — but the protocol doesn't.

The Verified/Inferred/Hypothesized taxonomy originates from CV §4 (epistemic status tagging), not CV §1's fact-checking pipeline (V9). The three-step operation (decompose → retrieve → classify) follows the FActScore structure, but the verdict categories are an epistemic status convention. The assessor's value is proportional to the fraction of claims that are structurally verifiable — theses heavy on behavioral claims ("this handles concurrency correctly") will produce mostly Inferred/Hypothesized output, which is honest but less immediately useful. This is a correct reflection of verification limits, not a flaw.

**Spot-checking Verified claims is load-bearing** (V6, V9). If the assessor misclassifies an Inferred claim as Verified — citing a file:line that exists but doesn't actually support the claim — downstream trust is corrupted. The spot-check mechanism catches this.

#### Verification Beyond the Codebase

For implementation plans, claims check against a deterministic source of truth (the codebase). For research synths and design documents, factual claims are often about external sources the assessor can't directly access. The assessor should be transparent about this limitation and ask for direction rather than silently degrading. Three strategies, depending on available tooling:

1. **Honest classification** (always available). Claims about inaccessible sources get classified as Hypothesized with a note: "Cannot verify — source not available locally. Cheapest verification: [specific suggestion]." This surfaces which claims the human needs to check, even when the assessor can't.

2. **Assisted research** (when tools are available). If the assessor has access to web search, scholarly MCP servers (e.g., Semantic Scholar, arXiv), or a local knowledge base indexed by qmd, it can attempt verification against those sources. The classification still applies — Verified means "found confirming evidence at [source]," not "I believe this is true."

3. **Ref-file cross-reference** (when a PKM knowledge base exists). If the thesis cites `.ref.md` files, those are local and checkable. The assessor can verify that the thesis accurately represents what the ref says, even if it can't verify the ref's accuracy against the original source. Catching misrepresentation of your own research notes is high-ROI.

Default to strategy 1. Strategies 2 and 3 activate when relevant tools/files are available, extending the Verified surface without changing the protocol.

Applicable to: everything. This is the highest-value default assessor.

### Risk

Asks: "What breaks? What's irreversible? What's the blast radius if this is wrong?" For implementation plans, this is about failure modes. For research conclusions, this is about downstream decisions that depend on the conclusion being correct. For debugging hypotheses, this is about the cost of acting on a wrong diagnosis.

Applicable to: anything with meaningful consequences.

### Future Assessors (Created As Needed)

- **OWASP** — security-specific, for plans touching auth, input handling, data storage
- **Performance** — for plans with scale implications
- **Cognitive Load** — for designs that will be maintained by humans
- **API Contract** — for changes to public interfaces
- **Accessibility** — for frontend work
- **Domain-specific** — any recurring concern that justifies a dedicated lens

The key constraint: the number of assessors is a function of how orthogonal their scopes are, not a fixed target. Three assessors with truly independent concerns produce more signal than five with overlapping ones.

This is grounded in two independent research findings. W1 confirms the N-assessor fan-out with orthogonal scopes is the correct architecture for plan review (vs the coach/player dyad, which solves a different problem). D9 grounds orthogonality in CV §12's methodological triangulation — assessors with genuinely different analytical methods (security analysis vs claim decomposition vs structural critique) produce independent perspectives that reduce shared blind spots, analogous to how mixed-methods research catches what any single method misses. Scope diversity is the primary mechanism and it's free — just prompt design.

## Heterogeneity

LANDSCAPE.md §22 finding: 2 diverse agents (different model families) match or exceed 16 homogeneous agents. Same-model debate pays multi-agent prices for single-agent quality.

W2 qualifies this: the benchmarks tested general reasoning/coding debate, not plan review with orthogonal scopes. AT's assessors ask different questions (OWASP vs performance vs claim verification), which is structurally different from same-question debate. The echo-chamber risk is real but the magnitude may be lower than the benchmarks suggest for this topology. Same-model assessors share training-data blind spots that no amount of prompt engineering eliminates — but orthogonal scopes partially mitigate this by asking questions the model wouldn't spontaneously raise.

The correct framing (W2): **model diversity is an amplifier, not a prerequisite.** The pattern's primary value comes from structured opposition with severity classification and convergence detection. Heterogeneity makes it better; its absence doesn't make it worthless.

Each assessor skill can declare an optional `model` field. When specified, the assessor runs on a different model family. When omitted, it uses the session default. When running via `claude -p` (ralph integration or shell invocation), different `--model` flags per assessor achieve heterogeneity. Within Claude Code's native subagent system, this depends on whether `context: fork` skills can specify model — if not, heterogeneity is only available in the shell-orchestrated path.

If budget allows only one form of diversity, a second model family beats a fourth assessor role on the same model (W2). D15 adds that sycophancy compounds the echo-chamber problem independently of blind spots — another reason to prioritize heterogeneity for the auditor specifically.

Start with same-model assessment. Add heterogeneity when the shell orchestration path is built.

## Artifact Structure

### Within Ralph

When dialectic assessment runs as part of the ralph pipeline, artifacts live in the existing structure:

```
.ralph/runs/<id>/tasks/<task-id>/assessment/
├── plan.md
├── assessors.txt
├── round-N-<role>.md
├── round-N-response.md
├── round-N-audit.md
├── synthesis.md
└── changelog.md
```

Per RALPH_CORE_PLAN.synth.md's decision: frontmatter `kind:` fields for schema validation, directory-based globs for hooks. No compound extensions for agent artifacts.

### Standalone

When invoked outside ralph (the primary use case), artifacts need a home. Options:

1. **Adjacent to the thesis** — If assessing `design.synth.md`, artifacts go in a sibling directory: `design.assessment/`. Keeps the assessment co-located with the thing it assessed.
2. **Dedicated directory** — `.assessments/` (or similar) at the project root. Centralized, easy to gitignore.
3. **Inline only** — No persisted artifacts; the synthesis is presented in the conversation. Simplest, lowest ceremony, but loses the drill-down capability.

Recommendation: **start with inline** (option 3). The synthesis is presented in the conversation. If the user wants to persist it, `/to-pkm` or manual save handles that. Artifact persistence is an optimization for later — it adds value when you're reviewing assessment history, but that's not the first problem to solve.

When persistence is added, option 1 (adjacent to thesis) is the better default for standalone use — the assessment's relevance is scoped to the document it assessed, not to a project-wide timeline. Staleness tracking (checksums linking assessment to thesis version) is a natural addition at that point but not worth building until persistent artifacts exist — re-running is cheap enough.

## Relationship to Other Components

### Ralph Loop

Ralph is one consumer. The ralph extension point (RALPH_CORE_PLAN.synth.md line 66) wraps the execution call with dialectic assessment for high-risk tasks. The mechanism is the same; the trigger is automated (tag-based) rather than manual.

The skill should be usable both ways: manually via `/assess` and programmatically via shell function for ralph integration. The core logic (run assessors, synthesize, audit, converge) is shared.

### PKM System

pkm.synth.md (lines 102-117) maps dialectic phases to Bloom's taxonomy and proposes structural contracts for assessment artifacts. The standalone skill benefits from this infrastructure:

- Claim-verification assessor output is ref-shaped — facts that can be promoted to `.ref.md` via `/to-pkm`
- The synthesis is synth-shaped — reasoning that can be promoted to `.synth.md`
- The ref/synth split maps directly to verification cost, which is the whole point

Promotion is lazy and human-triggered — the same principle as ralph artifact promotion (RALPH_CORE_PLAN.synth.md lines 476-481).

### `/to-pkm`

Downstream of dialectic assessment. After an assessment session, `/to-pkm` can extract durable findings — verified facts become refs, validated design decisions become synths, open questions become temps. The assessment's severity classifications and claim verifications make `/to-pkm`'s job easier: Blocker resolutions are likely worth capturing; Nits probably aren't.

### Auditor Role

The post-synthesis auditor is independently justified without needing a research pedigree (V10 — the CV §3 "dual screening" mapping doesn't hold). It catches synthesis-level errors at the highest-impact point: the synthesis is the deliverable the human reviews. One LLM call, short output, bounded cost. The failure mode it catches — misquoting assessors, silently dropping findings, citing evidence that doesn't support conclusions — is high-impact and verifiable (auditor's claims about the synthesis can be spot-checked against assessor reports).

### Evidence-First Investigation

The tiered claims pattern (AI_TOOLING.md lines 811-875) — Verified/Inferred/Hypothesized with citations — is exactly what the claim-verification assessor produces. Dialectic assessment operationalizes the evidence-first norm: instead of asking the author to self-classify their claims, an independent assessor does it adversarially.

## Cost Considerations

Each assessor is a separate context window. Cost scales with assessor count and round count.

- **Default (2 assessors, 1 round, no Blockers)**: ~3 LLM calls (2 assessors + synthesis). Comparable to a thorough single-agent review but with structural separation of concerns.
- **Full assessment (3 assessors, 2 rounds)**: ~10 LLM calls (round 1: 3 assess + respond + audit, round 2: 3 assess + respond + audit, + synthesis). Expensive but targeted — only for high-stakes decisions.
- **Cost control levers**: Fewer assessors, cheaper models for non-critical assessors (LANDSCAPE.md's model routing insight), `MAX_ROUNDS=1` for a single-pass review without convergence loop.

The trust economics case: the cost of dialectic assessment is paid once per thesis. The cost of a flawed thesis that propagates into implementation, other synths, or downstream decisions compounds. For conceptual work especially — where there's no test suite to catch errors later — the assessment cost is insurance against the most expensive failure mode: confident wrong reasoning that looks right.

### Per-Assessor Cost Reporting

Cost should be tracked and surfaced per-assessor, following the same pattern as ralph loop cost tracking. When running via `claude -p --output-format json`, each assessor invocation produces token usage data. The skill reports per-assessor cost alongside findings:

```
Assessment complete (2 assessors, 1 round):
  plan-critic:          1.2K input / 0.8K output ($0.03)
  claim-verification:   2.1K input / 1.4K output ($0.05)
  synthesis:            1.8K input / 0.6K output ($0.03)
  total:                                          $0.11
```

Over time, this data answers "which assessors consistently produce Blockers vs only Nits for which thesis types?" empirically rather than through formal calibration infrastructure (U9 rejects the formal approach — the mechanism's verification burden exceeds the review burden it aims to reduce). Cost-per-finding is a more natural metric than assessor weighting.

## Open Questions

### Interactive Mode

The batch design (assess → synthesize → present) is the baseline. But for complex cases — especially research scrutiny and debugging — an interactive variant where the human participates in the respond phase could be higher value.

The author-response step (ACCEPT/REBUT/ACKNOWLEDGE) is where the human has the most to contribute. The automated author has access to the thesis and the assessor reports, but the human has context the agent doesn't: why a tradeoff was made, what constraints aren't written down, which assumptions are load-bearing vs incidental.

A lightweight approach: after assessors run, present findings to the human and ask "How would you respond to these findings?" instead of generating an automated response. The human's responses feed into synthesis. This doesn't require new infrastructure — it's a control flow decision in the skill (pause for input vs generate response). The full automated path remains the default; interactive mode activates via a flag (`--interactive` or similar) or when the human is already in conversation.

Not a launch requirement. The batch path covers the common case. Interactive mode adds value when the thesis is the human's own reasoning and they're the best-positioned author to respond to challenges. Worth exploring once the batch path is proven.
