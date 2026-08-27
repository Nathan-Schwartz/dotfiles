# Epistemic Classification Reference

An incorrect classification is worse than producing nothing or using too many tokens because it will invalidate all results.

## Classifications

- **Verified**: cite evidence the reader can confirm in one step. In all cases be specific enough that the human can confirm/refute without rederivation.
    - for code, cite file:line and assert what the code does at that location
    - for websites, cite the URL and section
    - for tooling, you may test automated quality checks or cli command outputs
- **Inferred**: cite the evidence and state the reasoning step explicitly. "Given [evidence], [conclusion] because [reasoning]."
- **Guess**: state explicitly that this is unverified.

Prefer fewer claims at higher accuracy over comprehensive but uncertain coverage.

When in doubt, err on the side of the lower classification.

Do not combine verified and inferred claims in a single assertion without labeling each part.

## Claim shapes that require classification

Classification defaults to propositions — statements that are straightforwardly true or false. These shapes carry claims without looking like claims, so they pass unlabeled:

- **Severity, priority, significance** — "should fix", "the most important", "worth flagging". State the axis. An unqualified "most severe" is an unclassified judgment.
- **Comparative clauses** — "unlike X, Y…" asserts a fact about X. Verify X or drop the clause.
- **Invoked convention** — any "best practice" or "standard approach" offered as a reason is an empirical claim about *this* environment. Check it here before relying on it.
- **A user's characterization of past events** — Verified as a report of their belief, and no higher. If it is load-bearing for a conclusion, check it against the record.
- **What a body of evidence implies** — "the corpus predicts", "this rests on one instance", "the numbers point at X". A claim about the weight or direction of evidence is a judgment about material you may not have re-examined, and it is especially prone to generalizing from the nearest sample. Name the specific items and what they would have to show for the claim to fail.
- **An absence** — "no rate limiter", "nothing consumes this", "there is no such route", "X does not appear anywhere". A search that returns nothing looks identical whether the thing is absent or the pattern was wrong. **Verified** requires four things: the exact command, the paths it covered, the pattern variants tried, and what the search could not see. Short of all four, it is *Inferred from absence* — say so in those words. An absence assembled from several sources each failing to mention something is the weakest claim class there is; name the single search that would refute it.

A finding whose facts are Verified but whose severity is Inferred must be labeled as such.

## Epistemic Classification in PKM Artifacts

The classifications above apply to claims within PKM file bodies:

- `.ref.md` files should contain primarily **Verified** claims. If most claims are Inferred or Guess, the content likely belongs in `.synth.md` or `.temp.md` instead.
- `.synth.md` files naturally contain more **Inferred** claims, but supporting facts should still be Verified and ideally extracted to cited `.ref.md` files.
- `.temp.md` files have no epistemic burden.

When writing PKM artifacts, tag every claim in the body. A short ref that is 100% Verified is worth more than a long ref with untagged synthesis mixed in.

Most sessions contain ref-shaped material (facts, observations) tangled inside reasoning. Actively decompose content to extract refs — more knowledge lands in the cheapest-to-verify tier, and synths get shorter because they cite refs instead of restating facts.
