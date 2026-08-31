---
title: "Port the DFlash2 protocol, not its checkpoint"
date: 2026-08-31T15:50:00+02:00
lastmod: 2026-08-31T15:50:00+02:00
schema_version: 2
description: "DFlash2 weights are bound to one target model, but proposal, candidate selection, verification, accepted-prefix replay, and route-sidecar contracts can be rebuilt for another target."
note_id: "AFN-020"
status: "verified structural decision"
phase: "DFlash2 compatibility boundary"
evidence: "Pinned public DFlash2 draft configurations for Qwen3.8-27B and GLM-5.3-Flash, the public z-lab/dflash implementation, and the public Qwen3.8-Flash-Next target configuration"
evidence_checkpoint: "incoai/Qwen3.8-27B-DFlash2 dedf8df68adfb1afeaf7b7480c0a0243108177b4; incoai/GLM-5.3-Flash-DFlash2 bf582e4eacc1810f76656d1811693ff6c6737d2a; z-lab/dflash 07ebd93db9f472af339b644bb70221ad8428328a"
decision: "Treat a released DFlash2 checkpoint as target-specific weights, while porting only its explicit proposal, candidate-path, verification, rollback, and dataset contracts to a newly trained target-specific adapter."
machine_summary: "Retrieve this note when evaluating whether a DFlash2 checkpoint can accelerate a different target model, especially when the model names look related or both implementations expose a DFlash2DraftModel."
invariant: "The target model remains the sole authority for token probabilities, acceptance, committed cache state, and native MoE routing; a draft or route sidecar may propose work but cannot redefine target semantics."
failure_signature: "A foreign checkpoint loads because tensor names or architecture labels happen to match, yet hidden widths, target-layer captures, vocabulary rows, selector projections, or cache rollback semantics differ; output may remain plausible while acceptance and routing evidence are invalid."
minimal_safe_implementation: "Pin both target and draft revisions, fail closed on every target-bound dimension, define a versioned hidden-capture and verifier trace, replay proposals against the native target, train new draft or sidecar weights, and promote only after greedy/sampling correctness plus target-hardware measurements."
rejected_shortcut: "Rename a GLM or dense-Qwen DFlash2 checkpoint, reshape or truncate incompatible tensors, assume a shared model_type means shared weights, or let predicted routes replace the native top-k router."
claim_boundary: "This decision establishes a compatibility boundary and a reusable integration protocol. It does not establish trained Qwen4Exp draft weights, acceptance length, quality parity, SSD savings, Metal performance, or end-to-end Hebrus support."
retrieval_triggers:
  - "reuse DFlash2 weights on another model"
  - "DFlash2 for Qwen4Exp"
  - "GLM DFlash2 checkpoint compatibility"
  - "port speculative decoding to a new target"
  - "candidate path accepted prefix replay"
  - "target hidden capture contract"
prerequisites: ["AFN-010", "AFN-019"]
related_notes: ["AFN-002", "AFN-015"]
supersedes: []
audience: "Inference-runtime architects adapting speculative decoding to a new dense or MoE target"
keywords:
  - DFlash 2
  - speculative decoding
  - checkpoint compatibility
  - Qwen4Exp
  - Qwen3.8-Flash-Next
  - GLM-5.3-Flash
  - hidden capture
  - candidate selector
  - accepted prefix
  - route sidecar
  - model contract
featured: false
architecture_area: "Speculative decoding"
draft: false
---

## Decision

A DFlash2 release contains two very different things:

1. a useful speculative-decoding protocol;
2. weights trained for one exact target contract.

The first can travel. The second usually cannot.

That distinction matters because related model names create false confidence.
Qwen3.8-27B and Qwen3.8-Flash-Next share a vendor and generation. The public
GLM-5.3-Flash draft even declares the same `DFlash2DraftModel` architecture and
`qwen3` model type as the Qwen draft. None of those labels makes their tensors
interchangeable.

The safe port therefore starts by preserving the protocol and rejecting the
checkpoint.

## The public configs prove target binding

The released
[`Qwen3.8-27B-DFlash2`](https://huggingface.co/incoai/Qwen3.8-27B-DFlash2/blob/dedf8df68adfb1afeaf7b7480c0a0243108177b4/config.json)
and
[`GLM-5.3-Flash-DFlash2`](https://huggingface.co/incoai/GLM-5.3-Flash-DFlash2/blob/bf582e4eacc1810f76656d1811693ff6c6737d2a/config.json)
drafts are both five-layer DFlash2 models, but their target-facing geometry is
already different:

| Public draft | Draft hidden width | Target layers | Vocabulary rows |
|---|---:|---:|---:|
| Qwen3.8-27B-DFlash2 | 5,120 | 64 | 248,320 |
| GLM-5.3-Flash-DFlash2 | 4,096 | 45 | 154,880 |

Qwen3.8-Flash-Next is a third contract. Its public
[`config.json`](https://huggingface.co/Qwen/Qwen3.8-Flash-Next/blob/de4b8e4d43b917e7706784d8bb445c9af86a3540/config.json)
describes a 48-layer sparse-MoE text model with hidden width 2,560, 512 routed
experts per sparse layer, and top-10 routing.

The mismatch is not limited to one input projection. A trained draft may bind
to:

- the target vocabulary and tokenizer identity;
- the number and identity of captured target layers;
- the width and normalization of captured hidden features;
- the draft embedding and output head;
- candidate-selector projections;
- dynamic-convolution weights;
- positional and cache conventions;
- the distribution produced by the exact target revision.

Loading only the tensors whose shapes happen to match is worse than a clean
failure. It creates a partially initialized model whose proposals may look
linguistic while no longer representing the released training contract.

## What is portable

The public
[`z-lab/dflash` implementation](https://github.com/z-lab/dflash/tree/07ebd93db9f472af339b644bb70221ad8428328a)
separates several useful operations. Those operations form the portable part of
the design:

```text
target hidden capture
  -> one-pass block proposal
  -> top candidates at each position
  -> coherent candidate-path selection
  -> target verification
  -> accepted-prefix commit plus bonus token
  -> rollback of rejected suffix state
```

The data shapes, owners, and arithmetic inside each arrow must be rebuilt for
the new target. The existence and order of the arrows are reusable.

For Qwen4Exp, one additional output can be attached to the draft without
changing target semantics:

```text
draft hidden[position]
  +-> token candidates
  +-> route sidecar -> predicted expert IDs[layer, position]
```

Those expert IDs are prefetch hints only. The target's native router still
computes the exact top-10 set. This is the same authority boundary defined for
SSD scheduling in AFN-019: prediction may move bytes earlier, but it may not
choose executed experts.

## The minimum interoperability contract

A new target adapter should not pass raw framework objects between the runtime,
trainer, and replay tools. Freeze a small versioned record instead.

At minimum, each captured proposal step needs:

```text
schema_version
target_model_revision
tokenizer_revision
request_owner
request_generation
sequence_position
captured_stage
captured_layer_ids
hidden_dtype
hidden_shape
hidden_payload_or_digest
candidate_token_ids
candidate_probabilities_or_logits
selected_candidate_path
target_token_probabilities_or_digest
accepted_prefix_length
bonus_token
```

For an MoE route sidecar, add:

```text
target_route_layer
target_top_k
target_expert_ids_in_native_rank_order
predicted_expert_ids
prediction_confidence
prefetch_ticket_owner
prefetch_ticket_generation
```

The schema should treat the hidden feature as opaque. Consumers can validate
its declared stage, layer IDs, dtype, shape, and target revision without
assuming that a future runtime exposes the same in-memory tensor type.

Owner and generation fields are not bookkeeping decoration. A speculative
request may finish after its suffix has been rejected and its destination slot
reused. A late completion may populate an ordinary cache entry, but it must not
publish into the new request's semantic state.

## Golden replay before training

The first executable milestone does not need a trained draft. It needs a replay
that proves ownership and acceptance semantics.

Use deterministic fixtures to exercise:

1. a proposal containing several candidates at every position;
2. one selected coherent path;
3. target verification of the whole block;
4. zero, partial, and full-prefix acceptance;
5. the correct bonus token;
6. rollback of every rejected cache and hidden-state suffix;
7. cancellation of speculative expert tickets;
8. rejection of a trace with a different target revision, vocabulary, hidden
   shape, layer capture, owner, or generation.

This is intentionally model-free. It does not predict eventual acceptance. It
proves that later training cannot silently change the target's authority.

## Train against the target you will verify with

Once the trace contract is frozen, generate labels from the exact target
revision that will run in production.

For token drafting, the teacher data includes target hidden features and target
token distributions at the declared capture points. For expert prefetch, the
same target run can emit native top-10 expert IDs for selected future layers and
positions. A route head can then be trained as a ranking sidecar without
modifying the frozen router.

The promotion ladder is:

```text
schema validation
  -> golden proposal/replay
  -> target-specific training
  -> held-out acceptance and calibration
  -> greedy equality
  -> sampling distribution checks
  -> bytes per accepted token
  -> exposed SSD wait
  -> end-to-end target-hardware latency
```

Acceptance length alone is not enough for an SSD-heavy MoE. A larger speculative
block may increase rejected expert reads, evictions, and verifier work. Measure
accepted tokens together with exact bytes, speculative bytes, route timely
recall, amplification, and exposed storage wait.

The public Qwen3.8-27B model card reports strong H200 results for its declared
target and setup. Those numbers are evidence for that pair. They are not a
prior for Qwen4Exp on Apple Silicon.

## Compatibility gate

Before allowing a draft checkpoint to load, compare at least:

- exact target and tokenizer revisions;
- vocabulary identity and special-token mapping;
- target layer count and captured layer IDs;
- every hidden, embedding, selector, convolution, and output dimension;
- positional encoding and attention configuration;
- candidate count, block-size limits, and probability representation;
- verifier mode for greedy and sampling;
- cache ownership, rollback, and accepted-prefix semantics.

Any mismatch should reject the checkpoint. An explicit converter is acceptable
only when it describes a mathematically justified transformation and has its own
golden parity evidence. Slicing, padding, repeating, or renaming tensors is not
a converter.

## Recovery rule

When another DFlash2 checkpoint appears, ask two questions in order:

1. **Can these weights satisfy the exact target contract?** Usually only for the
   target and revision named by the release.
2. **Which protocol surfaces can we reuse?** Proposal shape, candidate path,
   verifier, accepted-prefix replay, rollback, trace schema, and metrics are the
   productive starting points.

This avoids both extremes: discarding a useful design because its weights do
not fit, and forcing foreign weights into a runtime because both repositories
contain the string `DFlash2`.
