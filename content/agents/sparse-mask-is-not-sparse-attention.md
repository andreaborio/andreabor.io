---
title: "A sparse mask is not sparse attention"
date: 2026-08-31T12:36:00+02:00
lastmod: 2026-08-31T12:36:00+02:00
schema_version: 2
description: "Selecting 2,051 keys does not make attention sparse if the backend still allocates or traverses the full query-by-key matrix."
note_id: "AFN-016"
status: "hypothesis"
phase: "6 architecture"
evidence: "AFN-011 provides the bounded dense oracle; llama.cpp c88c916 exposes exact QSA selection semantics through a generic attention mask, while MLX-VLM PR #2032 likewise provides a dense-mask comparison point"
evidence_checkpoint: "AFN-011; llama.cpp c88c916; MLX-VLM PR #2032"
decision: "Define sparse attention by physical work: keep compact logical IDs, resolve only selected cache slots, gather only selected K/V rows, and run online softmax over the compact row."
machine_summary: "You are implementing sparse or selected attention and need to distinguish mathematically sparse visibility from bounded memory traffic and compute."
invariant: "For each query, allocation, K/V reads, score work, and softmax work scale with selected width plus candidate-group scoring, never with the full query-by-key rectangle."
failure_signature: "Telemetry reports a small selected set while memory, dispatches, or kernel time still grow like dense attention because the selected IDs only modify a mask around a generic backend."
minimal_safe_implementation: "Carry selected logical IDs to one slot-resolution boundary, compact the referenced K/V rows into bounded scratch, and apply an online softmax that visits exactly those rows."
rejected_shortcut: "Building a dense boolean or additive mask from top-k IDs and calling ordinary dense attention while describing the path as sparse."
claim_boundary: "This is the Phase 6 Hebrus architecture under qualification; it does not claim that the current public Hebrus checkpoint contains the compact Metal path or proves long-context throughput."
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

The intended Hebrus path is:

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

## What must be measured

Selected-count telemetry is insufficient. A physically sparse path records:

- candidate groups scored;
- selected groups and expanded token width;
- K/V rows and bytes gathered;
- scratch bytes, with no query-by-key allocation;
- attention rows actually visited;
- kernel time at fixed selected width while total history grows.

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

AFN-011 remains the verified public baseline: dense QSA is an executable oracle
through 2,051 visible keys and rejects larger histories. This note records the
native sparse architecture that must replace the dense execution path. The
claim becomes verified only after the compact path, counters, long boundaries,
and failure rollback are anchored in a public Hebrus checkpoint.
