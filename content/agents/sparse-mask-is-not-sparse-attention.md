---
title: "A sparse mask is not sparse attention"
date: 2026-08-31T12:36:00+02:00
lastmod: 2026-08-31T12:54:00+02:00
schema_version: 2
description: "Selecting 2,051 keys does not make attention sparse if the backend still allocates or traverses the full query-by-key matrix."
note_id: "AFN-016"
status: "verified checkpoint"
phase: "6 architecture"
evidence: "Pinned Transformers plus independent NumPy capture; host strict and ASan/UBSan lanes; actual-device Metal selection at 65,537, 100,000, and 262,144 visible tokens; compact gather and online attention; zero dense-mask byte accounting; private allocation, non-completion, and clean-completion gates"
evidence_checkpoint: "Hebrus c3759b5"
decision: "Define sparse attention by physical work: keep compact logical IDs, resolve only selected cache slots, gather only selected K/V rows, and run online softmax over the compact row."
machine_summary: "You are implementing sparse or selected attention and need to distinguish mathematically sparse visibility from bounded memory traffic and compute."
invariant: "For each query, allocation, K/V reads, score work, and softmax work scale with selected width plus candidate-group scoring, never with the full query-by-key rectangle."
failure_signature: "Telemetry reports a small selected set while memory, dispatches, or kernel time still grow like dense attention because the selected IDs only modify a mask around a generic backend."
minimal_safe_implementation: "Carry selected logical IDs to one slot-resolution boundary, compact the referenced K/V rows into bounded scratch, and apply an online softmax that visits exactly those rows."
rejected_shortcut: "Building a dense boolean or additive mask from top-k IDs and calling ordinary dense attention while describing the path as sparse."
claim_boundary: "Hebrus c3759b5 proves the model-free F32 host and Metal sparse-QSA path through the frozen 262,144-token boundary; it does not register a production profile, family dispatch, artifact codec, full-checkpoint logits claim, or runtime support."
retrieval_triggers:
  - "top-k mask still runs dense attention"
  - "selected keys but quadratic memory"
  - "prove physically sparse QSA"
  - "compact K/V gather and online softmax"
prerequisites: ["AFN-011"]
related_notes: ["AFN-010", "AFN-017", "AFN-018"]
supersedes: []
audience: "Inference-runtime architects implementing sparse attention on accelerators"
keywords:
  - sparse attention
  - Qwen4Exp
  - QSA
  - Metal
  - online softmax
  - KV cache
  - memory complexity
  - Hebrus
featured: true
architecture_area: "Sparse attention"
draft: false
---

## Decision

Sparse attention is a physical-work contract, not a property of a mask.

Qwen4Exp's indexer can reduce one query to at most 512 complete four-token
groups plus a raw tail of at most three tokens: 2,051 visible keys. That result
is mathematically sparse. It becomes an implementation win only if the backend
also avoids allocating, reading, scoring, or masking every other key.

The Phase 6 path verified at
[`c3759b5`](https://github.com/andreaborio/hebrus/commit/c3759b5b096afeb44c4db5768dee9a1de23a63a7)
is:

```text
logical history
  -> score complete groups in bounded tiles
  -> compact selected logical token IDs
  -> resolve selected IDs through the shared slot map
  -> gather only selected K/V rows
  -> online softmax over at most 2,051 rows
```

Only the gather crosses from logical identity into physical cache layout. The
selection stage does not need to know whether the KV cache wrapped, compacted,
or reused a physical slot.

## Why a sparse mask can still be dense

The public llama.cpp QSA integration at
[`c88c916`](https://github.com/ggml-org/llama.cpp/commit/c88c916) is valuable
semantic evidence: it pools complete groups, preserves the raw index-key cache,
compares selected indices directly, and catches the crucial
`sum(ReLU(dot_h))` ordering. Its graph then turns selected IDs into a mask around
the generic attention builder.

That is a valid engineering reference, but a mask alone cannot prove what every
backend physically traverses. The MLX-VLM Qwen4Exp path provides a similar
comparison point: correct selected visibility can still be represented as a
dense query-by-key boolean array before ordinary attention.

Hebrus therefore treats those paths as numeric and transition references, not
as proof of bounded accelerator work.

## What the checkpoint measures

Selected-count telemetry alone would be insufficient. The checkpoint freezes:

- candidate groups scored;
- selected groups and expanded token width;
- raw-key, K/V, pooled-key, workspace, and total allocation byte ownership;
- scratch sized as groups plus budget plus selected width, never queries by keys;
- compact gather and online-attention outputs against the host oracle;
- actual-device selection at 65,537, 100,000, and 262,144 visible tokens.

The key negative assertion is simple: the dense-mask allocation counter remains
zero.

## Why compact gather comes before fusion

Gathering into bounded contiguous scratch adds one explicit copy, but it makes
ownership and work visible. The selected row has a hard maximum, cache-slot
resolution happens once, and the simple attention kernel becomes directly
comparable to the dense oracle.

A later fused indirect-load kernel may remove scratch traffic. It should replace
the gather only after profiling, without changing the logical-ID contract or
weakening the zero-dense-allocation gate.

## Failure boundary

AFN-011 remains the bounded dense oracle through 2,051 visible keys.
[`c3759b5`](https://github.com/andreaborio/hebrus/commit/c3759b5b096afeb44c4db5768dee9a1de23a63a7)
closes the model-free sparse replacement, its byte accounting, long boundaries,
and publication rollback. It is linked but no production profile, family
dispatch, artifact codec, or runtime-support selector can reach it.
