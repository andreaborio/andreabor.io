---
title: "Top-k chooses the set; time chooses the order"
date: 2026-08-31T12:35:00+02:00
lastmod: 2026-08-31T12:35:00+02:00
schema_version: 2
description: "Ranking decides which sparse-attention groups survive; canonical logical order decides how the selected row is represented and reduced."
note_id: "AFN-017"
status: "hypothesis"
phase: "6 architecture"
evidence: "AFN-011 freezes the dense comparison domain and llama.cpp c88c916 shows why selected token IDs are a stronger oracle than plausible logits; the canonical Hebrus emission-order checkpoint remains pending"
evidence_checkpoint: "AFN-011; llama.cpp c88c916; Phase 6 public checkpoint pending"
decision: "Use deterministic score order only to choose the top-k set, then emit the chosen groups in ascending logical position before expansion and tail append."
machine_summary: "You have a top-k selector whose mathematical result is a set, but downstream cache gathers and floating reductions require one canonical sequence."
invariant: "Selection membership depends only on score and the frozen tie rule; the emitted token row is always chronological and is byte-identical to dense visibility whenever every complete group fits the budget."
failure_signature: "The correct groups are selected but appear in rank order, so below-budget sparse rows differ from dense rows and finite-precision attention changes with heap or parallel-reduction details."
minimal_safe_implementation: "Select membership with descending score and ascending group-position ties, sort the surviving group IDs by position, expand each group contiguously, then append the raw tail."
rejected_shortcut: "Treating top-k rank order as the cache-read and reduction order merely because exact real-number attention is permutation invariant."
claim_boundary: "The ordering rule is an architectural candidate until its dense parity, tie mutations, host/Metal identity, and long-boundary tests are attached to a public Hebrus checkpoint."
retrieval_triggers:
  - "top-k membership versus output order"
  - "sparse row differs below budget"
  - "heap order changes floating attention"
  - "deterministic selected ID sequence"
prerequisites: ["AFN-011"]
related_notes: ["AFN-016", "AFN-018"]
supersedes: []
audience: "Systems engineers implementing deterministic selection and sparse reductions"
keywords:
  - top-k selection
  - deterministic ordering
  - sparse attention
  - floating-point reproducibility
  - QSA
  - Qwen4Exp
  - Hebrus
architecture_area: "Determinism"
draft: false
---

## Decision

Do not confuse a ranked set with an execution sequence.

QSA ranks complete four-token groups by score. Ranking answers one question:
which groups fit inside the 512-group budget? Attention needs a second answer:
in which order should the resulting token row be gathered and reduced?

Hebrus gives those questions different contracts:

```text
candidate scores
  -> choose set by (score descending, group position ascending)
  -> sort chosen group IDs by logical position
  -> expand every group to four consecutive token IDs
  -> append the incomplete raw tail
```

## The dense-parity property

Before the history exceeds the group budget, every complete group is selected.
If emission is chronological, the sparse row is then byte-for-byte the ordinary
dense causal row, followed by the same incomplete tail.

That creates a powerful local oracle: below the cut, any selected-ID difference
is a selection or ordering defect before attention arithmetic enters the
comparison.

Rank-order emission throws this property away. The chosen membership may still
be correct, but the row now depends on score distribution and selector internals
even when nothing needed to be dropped.

## Floating point makes order observable

In exact arithmetic, attention over the same key/value set is permutation
invariant. A real online softmax is a sequence of finite-precision maximum,
rescale, exponent, denominator, and accumulator updates. Changing the visit
order can change the final bits.

That does not make chronological order uniquely mathematical. It makes one
canonical order necessary if host, Metal, dense-oracle, and future fused paths
must remain reproducible.

Chronology is also the useful systems order: selected logical IDs are monotonic,
four-token groups stay contiguous, and cache gathers can coalesce nearby rows.

## Tie handling belongs to membership

Equal scores choose the smaller logical group position. This tie rule is applied
while selecting membership, not recovered from the final chronological sort.
Otherwise an over-budget tie could select a different set even though the
emitted rows look well ordered.

Tests must therefore distinguish:

- set membership under equal scores;
- chronological emission of that set;
- group-contiguous expansion;
- raw-tail placement;
- below-budget identity with the dense row.

## Failure boundary

The rule does not claim a verified Hebrus Phase 6 implementation yet. Its value
is architectural: it separates semantic selection from deterministic physical
representation and creates a much sharper parity oracle. Verification requires
the public host/Metal selected-ID fixtures and mutations that fail when either
membership or emission order changes.
