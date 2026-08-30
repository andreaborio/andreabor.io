---
title: "One bank flip is enough: make the whole inference chunk transactional"
date: 2026-08-30T20:53:00+02:00
lastmod: 2026-08-30T20:53:00+02:00
schema_version: 2
description: "A token chunk can touch recurrent state, caches, routing, residual streams, and logits; publishing any one of them early creates a state that never existed mathematically."
note_id: "AFN-010"
status: "verified checkpoint"
phase: "5"
evidence: "Token, chunk, and interleaved multi-turn equivalence; failure injection after every graph stage; non-finite rejection; Metal allocation, command, and status rollback"
evidence_checkpoint: "Hebrus 0626603"
decision: "Execute a complete token chunk against a private state bank and publish every persistent owner with one bank-index flip only after all host and Metal stages succeed."
machine_summary: "You are implementing stateful inference, speculative work, or a multi-stage accelerator graph where one request can fail after mutating recurrent state, KV/index caches, routing state, or logits."
invariant: "Public frontier, logits, residuals, GDN state, QSA caches, PLE state, and routing state always describe the same successfully completed chunk."
failure_signature: "A failed token leaves the frontier unchanged but advances one cache, convolution row, route, or logits buffer, so the next request starts from a state no valid execution produced."
minimal_safe_implementation: "Keep two complete state banks, copy the public snapshot into the private bank, run every fallible stage privately, validate finite values and accelerator status, then publish through one index swap."
rejected_shortcut: "Rolling back only the visibly changed buffer, or copying old bytes back after an accelerator command has partially completed."
claim_boundary: "This proves transactional behavior for the Phase 5 model-free resident graph; it does not prove full-checkpoint logits, production codecs, SSD execution, memory fit, or product support."
retrieval_triggers:
  - "failed inference corrupts the next request"
  - "partial KV or recurrent-state commit"
  - "transactional GPU graph publication"
  - "chunk and token execution diverge"
prerequisites: ["AFN-001", "AFN-008"]
related_notes: ["AFN-012", "AFN-013", "AFN-014"]
supersedes: []
audience: "Autonomous coding agents and engineers implementing stateful inference runtimes"
keywords:
  - Hebrus
  - transactional inference
  - double buffering
  - Metal rollback
  - recurrent state
  - KV cache
  - Qwen4Exp
draft: false
---

## Decision

Treat the whole chunk as the transaction—not each kernel, layer, or token-shaped buffer.

In the Phase 5 Hebrus graph, a chunk can update the four-stream residual, GDN convolution and recurrent matrices, QSA K/V and raw-index caches, PLE history and convolution state, selected routes, the public frontier, and logits. These values form one logical state image. Publishing them independently would permit combinations that the model never computed.

## Why local rollback is insufficient

A stage can fail after earlier stages have produced valid private results. The failure may be structural, a non-finite intermediate, an allocation denial, a Metal command that did not complete, or a nonzero device status word. Tracking which individual writes need undo logic turns every future state owner into another rollback branch.

That approach is fragile because ownership grows faster than the rollback checklist. It also asks the host to reconstruct whether device work partially executed.

## The publication model

Hebrus keeps two complete state banks:

1. one bank is the only public state;
2. the other becomes the transaction-private working image;
3. every graph stage mutates only the private image;
4. output remains caller-private while work is fallible;
5. finite checks, command completion, and status words must all pass;
6. one bank-index flip publishes the new frontier, state, and logits together.

Failure therefore discards an unpublished image. It does not attempt to reverse history.

## Evidence that matters

The useful test is not merely “a successful token produces expected logits.” Phase 5 injects failure after every graph stage and verifies two properties: the digest of all public state owners is unchanged, and the caller's output sentinel is untouched. Separate cases cover non-finite arithmetic and Metal allocation, command-completion, and status failures.

The same final state is then required for single-token, differently chunked, and interleaved multi-turn execution. Chunk size is a scheduling choice; it must not change model history.

## Reusable rule

When an inference operation updates more than one persistent owner, define one publication point before adding optimization. If the implementation cannot name that point, it does not yet have transactional state semantics.

## Failure boundary

This milestone uses a tiny deterministic correctness graph. It establishes the transaction seam, not production quality or speed. Real weights, quantized tensors, streamed PLE pages, sparse long-context QSA, and the product execution route remain later gates.
