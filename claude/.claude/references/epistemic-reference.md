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

## Epistemic Classification in PKM Artifacts

The classifications above apply to claims within PKM file bodies:

- `.ref.md` files should contain primarily **Verified** claims. If most claims are Inferred or Guess, the content likely belongs in `.synth.md` or `.temp.md` instead.
- `.synth.md` files naturally contain more **Inferred** claims, but supporting facts should still be Verified and ideally extracted to cited `.ref.md` files.
- `.temp.md` files have no epistemic burden.

When writing PKM artifacts, tag every claim in the body. A short ref that is 100% Verified is worth more than a long ref with untagged synthesis mixed in.

Most sessions contain ref-shaped material (facts, observations) tangled inside reasoning. Actively decompose content to extract refs — more knowledge lands in the cheapest-to-verify tier, and synths get shorter because they cite refs instead of restating facts.
