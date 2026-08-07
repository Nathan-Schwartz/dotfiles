---
name: transition-to-superpowers
description: Use when ideation has converged and the user wants the superpowers pipeline to take over planning and execution of the work discussed in this conversation.
disable-model-invocation: true
---

# Transition to Superpowers

Hand off from ideation (e.g. `/brainstorm`) to the superpowers pipeline. No intermediate spec file is written — the conversation is the spec.

## Preconditions

- The conversation contains a converged design: goal, approach, constraints. If it does not, state what is missing and return to ideation — do not fabricate a spec.
- If load-bearing claims are still classified Guess/Inferred, surface them now. Planning must not build on unverified premises.

## Handoff

Invoking this skill is the user's explicit instruction that ideation and design approval are complete. This satisfies superpowers' brainstorming hard-gate and its human-override condition — do NOT invoke superpowers:brainstorming, and do not require a spec file.

When writing-plans needs spec content (requirements, Global Constraints), take it verbatim from what the user stated or approved in this conversation — do not re-derive or loosen it.

**REQUIRED SUB-SKILL:** Use superpowers:writing-plans with the conversation as the spec.

If the user passed an executor preference as an argument (`sdd` → superpowers:subagent-driven-development, `inline` → superpowers:executing-plans), skip writing-plans' execution-choice question and use it once the plan is saved.
