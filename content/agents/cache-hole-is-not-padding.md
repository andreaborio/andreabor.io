---
title: "A hole in cache history is not padding"
date: 2026-08-31T12:34:00+02:00
lastmod: 2026-08-31T12:34:00+02:00
schema_version: 2
description: "Left padding may move the first real token; a missing position inside the visible run destroys sparse-group semantics and must fail closed."
note_id: "AFN-018"
status: "hypothesis"
phase: "6 architecture"
evidence: "llama.cpp ff24f38 makes index-cache lifecycle mirror the main cache and c88c916 groups by logical position rather than cell adjacency; the stricter contiguous-run Hebrus rule awaits its public Phase 6 checkpoint"
evidence_checkpoint: "llama.cpp ff24f38 and c88c916; Phase 6 public checkpoint pending"
decision: "Model each visible sequence as one contiguous logical-position run: permit an arbitrary first position for left padding, require every append to advance by one, and reject internal holes before sparse planning."
machine_summary: "You are grouping cached tokens by logical position and need to distinguish legal left padding or eviction from an internal gap that would silently drop attention history."
invariant: "Every live position in a visible sequence run has exactly one predecessor except the first; complete groups and the raw tail partition that run without gaps or overlap."
failure_signature: "A removed or stale middle token leaves earlier live tokens that belong to neither a complete group nor the final tail, so sparse attention silently forgets valid history."
minimal_safe_implementation: "Anchor grouping at the first live logical position, enforce successor appends, validate contiguity before planning, and rebuild pooled groups transactionally after lifecycle operations."
rejected_shortcut: "Treating a missing middle slot as ordinary padding, grouping adjacent physical cells, or skipping the gap and continuing group numbering."
claim_boundary: "This is the proposed Hebrus long-state contract; verified remove, wrap, rewind, shift, copy, restore, and multi-sequence evidence remains pending a public Phase 6 checkpoint."
retrieval_triggers:
  - "hole inside KV cache history"
  - "left padding versus missing token"
  - "group adjacent physical cache cells"
  - "sparse attention silently drops history"
prerequisites: ["AFN-010", "AFN-011"]
related_notes: ["AFN-016", "AFN-017"]
supersedes: []
audience: "Inference-runtime engineers designing logical cache and sparse-group lifecycle semantics"
keywords:
  - KV cache
  - logical positions
  - sparse attention
  - cache holes
  - left padding
  - transactional state
  - Qwen4Exp
  - Hebrus
architecture_area: "Cache semantics"
draft: false
---

## Decision

Padding is outside a sequence. A hole is inside it. Sparse grouping cannot treat
them as the same thing.

For one logical sequence, the first real token may start at any absolute
position. That is enough to represent left padding or an older prefix that has
already been evicted. After that anchor, every visible token must be the exact
successor of the previous one.

```text
legal left padding:     [100, 101, 102, 103, 104]
legal shifted history:  [4096, 4097, 4098, 4099]
illegal internal hole:  [100, 101, 103, 104]
```

## Why QSA cannot skip the gap

QSA partitions the visible run into complete four-token groups plus one final
raw tail of zero to three tokens. An internal gap breaks that partition.

If position 102 is missing, the implementation cannot safely reinterpret 103 as
the third token of the earlier group: group identity and RoPE position would be
wrong. It also cannot discard 100 and 101 as if they were a tail, because the
tail is defined only at the current frontier.

Continuing after the hole therefore makes some live tokens disappear from
attention without an explicit policy decision.

## Logical identity before physical layout

The public llama.cpp hybrid index cache at
[`ff24f38`](https://github.com/ggml-org/llama.cpp/commit/ff24f38) establishes the
important ownership direction: index state follows the main cache's sequence,
copy, remove, and restore lifecycle. The QSA integration at
[`c88c916`](https://github.com/ggml-org/llama.cpp/commit/c88c916) likewise forms
blocks from positions rather than adjacent cache cells.

Hebrus keeps that semantic boundary and makes the missing-middle case explicit:
physical wrap, compaction, and slot reuse are allowed; a discontinuity in the
logical run is not.

## Reject early, rebuild transactionally

The cheapest time to preserve contiguity is append: the first position is free,
and every later reservation must target `frontier + 1`.

Lifecycle operations still need validation. Remove, rewind, shift, fork, copy,
and restore can change the derived pooled groups. They rebuild those groups in a
private candidate state and publish only when the complete run is valid.

If a caller intentionally needs segmented attention, that is a new semantic
model with explicit segments—not permission to reinterpret a hole.

## Failure boundary

This note does not claim that current public Hebrus supports long QSA state. It
records the fail-closed cache model that Phase 6 must verify across holes, wrap,
rewind, shift, serialization, and multiple interleaved sequences before the
sparse path can replace the bounded dense oracle.
