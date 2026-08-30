---
title: "An ubatch is not a sequence boundary"
date: 2026-08-30T20:55:00+02:00
lastmod: 2026-08-30T20:55:00+02:00
schema_version: 2
description: "Dilated PLE convolution and token-history hashing must survive arbitrary chunking without leaking state between sequences or changing the current-EOS transition."
note_id: "AFN-012"
status: "verified checkpoint"
phase: "5"
evidence: "One-shot and 1/2/1-token ubatch plans produce identical PLE rows, convolution state, public digest, and logits; independent-sequence and current-EOS controls pass on host and Metal"
evidence_checkpoint: "Hebrus 0626603"
decision: "Own PLE history and dilated-convolution state by logical sequence, carrying it across ubatches and updating it in the frozen EOS order."
machine_summary: "You are chunking a stateful convolution, hash-derived embedding, or recurrent prefill path and need batching changes to preserve exact sequence semantics."
invariant: "For the same token sequence, PLE row IDs, convolution outputs, persistent state, and final logits are identical across every valid ubatch partition, while separate sequences share no mutable history."
failure_signature: "Changing prefill chunk size changes row hashes or logits, the first token after a boundary sees zeroed history, or one sequence consumes another sequence's convolution tail."
minimal_safe_implementation: "Store history and the full dilated receptive-field tail per sequence, advance them token by token inside each ubatch, and parity-test multiple partitions plus EOS and independent-sequence controls."
rejected_shortcut: "Resetting convolution or n-gram history at each scheduler chunk, or indexing persistent state by a transient batch row without generation ownership."
claim_boundary: "This proves model-free PLE state transitions with resident synthetic rows; it does not qualify the 320M-row production codec, page cache, SSD reads, or I/O overlap."
retrieval_triggers:
  - "prefill chunk size changes logits"
  - "dilated convolution state across batches"
  - "sequence state leaks between batch rows"
  - "EOS changes n-gram embedding history"
prerequisites: ["AFN-003", "AFN-008"]
related_notes: ["AFN-010", "AFN-013"]
supersedes: []
audience: "Autonomous coding agents and engineers implementing chunked recurrent or convolutional inference"
keywords:
  - Hebrus
  - ubatch parity
  - PLE
  - dilated convolution
  - sequence state
  - EOS semantics
  - Qwen4Exp
draft: false
---

## Decision

Scheduler chunks must not become model boundaries.

Qwen4Exp's PLE path combines token-history-derived row selection with a dilated causal convolution. Both operations depend on preceding tokens. A runtime is free to divide prefill into ubatches for memory or scheduling reasons, but that division is not visible to the model.

Hebrus therefore owns PLE history and convolution tails per logical sequence and carries them across every ubatch. The state advances in token order, including the frozen current-EOS rule, regardless of how the caller partitions the same input.

## The hidden receptive field

A causal convolution with kernel width four and dilation three needs nine preceding positions of state. Keeping only the last contiguous three values would look plausible and still be wrong: the next output reads spaced historical positions.

The correct persistent state is derived from the receptive field, not from the number of coefficients or the current ubatch size.

The history hash has a similar trap. Resetting at a chunk boundary changes bigram and trigram row identities even though the user supplied one continuous sequence.

## Evidence shape

Phase 5 compares the same token sequence executed in one shot and in a 1/2/1-token partition. It checks more than final logits:

- the generated PLE row identities;
- persistent convolution bytes;
- the digest of all public state owners;
- final output;
- behavior at the EOS transition;
- isolation between independent sequence state images.

Comparing only the last output could allow offsetting state defects to escape.

## Ownership rule

Persistent sequence state should be addressed by a stable slot plus generation, not by the temporary row number of the current ubatch. Copy, rewind, reset, and future cache reuse must operate on the history and convolution group together.

This is also why the state belongs inside the whole-chunk transaction described in AFN-010. A failed later stage must not leave PLE one token ahead of the public frontier.

## Agent checklist

For any chunked stateful operator:

1. derive the exact historical receptive field;
2. separate logical sequence ownership from batch placement;
3. specify update order around EOS and reset events;
4. compare internal state as well as output across partitions;
5. include a multi-sequence isolation case;
6. make failure preserve the pre-chunk snapshot.

## Failure boundary

These tests use tiny resident rows and deterministic F32 computation. Production PLE storage, decoding, page leases, cancellation, cold/warm behavior, and SSD overlap remain Phase 7 work.
