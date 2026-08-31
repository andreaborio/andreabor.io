---
title: "A phase handoff needs a decision delta"
date: 2026-08-31T12:10:28+02:00
lastmod: 2026-08-31T12:10:28+02:00
schema_version: 2
description: "Finishing code is not the same as preserving reusable reasoning: every verified phase closes with either a new evidence-bound note or an explicit no-new-decision record."
note_id: "AFN-015"
status: "verified checkpoint"
phase: "agent operations"
evidence: "Agent Field Notes schema v2 already separates fourteen Phase 0-5 decisions into retrieval capsules with explicit evidence and claim boundaries; the closeout rule makes that preservation step deterministic"
evidence_checkpoint: "Agent Field Notes schema v2"
decision: "Require Andrea-launched agents to perform a decision-delta review before closing each verified phase, publishing reusable evidence-bound choices or explicitly recording that no new note is warranted."
machine_summary: "You are closing an implementation phase or architecture checkpoint and need to preserve reusable reasoning without publishing progress logs or unverified claims."
invariant: "A verified phase handoff always states whether it produced a new reusable decision, and every published decision names public evidence plus the boundary of what that evidence does not prove."
failure_signature: "A later agent repeats a settled investigation, reintroduces a rejected shortcut, or learns an invariant only by reconstructing an old diff because the prior handoff recorded tests but not the reusable decision."
minimal_safe_implementation: "At phase close, compare the work against the Field Notes selector, publish one compact note for each genuinely new evidence-backed decision, or record an explicit no-new-decision result in the handoff."
rejected_shortcut: "Publishing a diary of changed files, copying the whole handoff into the archive, or labelling dirty and local-only work as a verified public checkpoint."
claim_boundary: "This operator workflow does not bind external contributors, make incomplete work publishable, or replace repository source, tests, accepted decisions, support contracts, and QA gates."
retrieval_triggers:
  - "phase handoff missing reusable decisions"
  - "agent repeats settled architecture research"
  - "publish technical choice after implementation"
  - "closeout checklist for autonomous agent"
prerequisites: ["AFN-009"]
related_notes: ["AFN-014"]
supersedes: []
audience: "Autonomous implementation agents explicitly launched by Andrea Borio"
keywords:
  - agent handoff
  - decision delta
  - architecture knowledge
  - evidence checkpoint
  - retrieval capsule
  - Hebrus
draft: false
---

## Decision

An implementation phase is not fully handed off when the code and tests are
green. It is handed off when the next agent can also recover the new reasoning
without reconstructing it from the diff.

For agents explicitly launched by Andrea, phase close therefore includes one
mandatory question:

> Did this phase establish a reusable decision that the current Field Notes do
> not already preserve?

If the answer is yes, the agent prepares or publishes an evidence-bound note.
If the answer is no, the handoff says so explicitly. External contributors are
not required to follow this operator-specific closeout rule.

## What counts as a decision delta

A note is warranted when the phase establishes at least one reusable item:

- an invariant whose violation can produce plausible but wrong behavior;
- a failure signature that identifies the defect earlier next time;
- a minimal safe implementation or ownership rule;
- a shortcut that was attractive, tested, and rejected;
- an evidence gate that separates structural correctness from support;
- a claim boundary that prevents a narrow result from becoming a broad claim.

A list of files changed, pass counts, or remaining tasks is not a decision
delta. Those belong in the phase handoff.

## The publication boundary

The review happens at phase close, but publication still follows the evidence.
A dirty worktree, local-only commit, private transcript, or unpublished artifact
cannot anchor a verified public note. The candidate remains pending until a
public checkpoint exists.

This delay is useful. It prevents the archive from borrowing authority from
tests or source that another contributor cannot inspect. It also forces the note
to cite the smallest durable checkpoint instead of a transient session state.

## Closeout procedure

1. Open the compact Field Notes selector and search by the phase's new failure
   modes, invariants, and rejected alternatives.
2. Remove duplicates and status-only observations.
3. For each remaining decision, write the recovery capsule first: decision,
   invariant, failure signature, minimal safe implementation, rejected shortcut,
   evidence, checkpoint, and claim boundary.
4. Publish only after the checkpoint and sources are public and the site gate
   passes.
5. If nothing remains, add `Agent Field Notes: no new decision delta` to the
   handoff.

The standalone machine-readable operator contract lives at
[`/agents/operator-contract.txt`](/agents/operator-contract.txt).

## Failure boundary

This workflow improves retrieval discipline. It cannot prove that an agent
recognized every important decision, that the decision itself is correct, or
that a published note supersedes the repository's normative documents.
