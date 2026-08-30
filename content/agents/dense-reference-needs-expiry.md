---
title: "A reference algorithm needs an expiry condition"
date: 2026-08-30T20:54:00+02:00
lastmod: 2026-08-30T20:54:00+02:00
schema_version: 2
description: "Dense QSA is a useful correctness oracle through 2,051 visible keys; without a hard ceiling, temporary reference code silently becomes an impossible long-context implementation."
note_id: "AFN-011"
status: "verified checkpoint"
phase: "5"
evidence: "Host and physical-Metal boundary tests accept the inclusive 2,051-key dense case and reject 2,052 plus 262,143/262,144/262,145 before graph execution"
evidence_checkpoint: "Hebrus 0626603"
decision: "Use dense QSA only as a bounded correctness oracle through 2,051 visible keys and reject larger contexts until the native sparse algorithm is independently qualified."
machine_summary: "You need a simple reference path to unlock graph bring-up without allowing its memory complexity or semantics to leak into advertised long-context support."
invariant: "No request above the declared dense-oracle ceiling can allocate or execute a dense Q-by-K QSA path."
failure_signature: "A small-context reference implementation passes tests and is accidentally reused at production context, creating quadratic allocation, hangs, OOM, or a false support claim."
minimal_safe_implementation: "Encode the reference ceiling in geometry admission and backend dispatch, test the exact last accepted and first rejected values, and keep sparse support behind a later parity gate."
rejected_shortcut: "Calling the dense implementation temporary while leaving its context limit as documentation, an optional flag, or an unchecked allocation."
claim_boundary: "The dense oracle establishes small-context QSA semantics only; it does not implement sparse selection, long-state lifecycle, 100K context, or production memory behavior."
retrieval_triggers:
  - "reference attention becomes production path"
  - "quadratic long-context allocation"
  - "dense versus sparse parity plan"
  - "boundary test at first unsupported context"
prerequisites: ["AFN-001", "AFN-008"]
related_notes: ["AFN-004", "AFN-010", "AFN-013"]
supersedes: []
audience: "Autonomous coding agents and engineers staging sparse-attention implementations"
keywords:
  - Hebrus
  - sparse attention
  - dense reference
  - QSA
  - long context
  - fail closed
  - Qwen4Exp
draft: false
---

## Decision

Every deliberately simple oracle needs a machine-enforced expiry condition.

Phase 5 uses dense QSA because it is easy to inspect and compare with pinned reference vectors. That is appropriate for correctness bring-up. It is not a viable implementation for the model's long-context target, where forming dense query-by-key work would defeat the sparse design.

Hebrus therefore accepts the dense path only through 2,051 visible keys. The 2,052 case fails closed, as do explicit cases around the 262K model boundary. Rejection happens before a dense graph or proportional allocation is reachable.

## Why the boundary belongs in code

“Temporary” is not a runtime property. Once reference code compiles, links, and returns plausible results, later agents can mistake it for the supported path—especially after the original implementation conversation is gone.

A prose warning also fails too late. An oversized dense allocation can already create memory pressure before a downstream kernel notices that sparse QSA is unavailable.

The limit must therefore live in geometry validation and dispatch, alongside tests for:

- the exact largest accepted input;
- the first rejected input;
- values near the advertised architectural maximum;
- unchanged output and state on rejection.

## What the dense path is for

The bounded implementation remains valuable. It gives the future sparse path a local oracle for all visible-key cases up to the ceiling. The sparse implementation can be compared against the same selection, cache position, partial-tail, and attention semantics without involving an entire checkpoint.

That is a stronger role than “slow fallback.” It is executable specification with a finite domain.

## Agent checklist

Before merging a reference algorithm, record:

1. the domain in which it is authoritative;
2. the first input it must reject;
3. the resource complexity that makes the boundary necessary;
4. the later implementation that must match it;
5. the gate required before removing or raising the ceiling.

## Failure boundary

Phase 5 does not claim sparse QSA or long-context support. Phase 6 must add tiled sparse selection, compact gathers, cache lifecycle operations, and model-backed long-context evidence before the ceiling can move.
