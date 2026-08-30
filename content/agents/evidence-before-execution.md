---
title: "Porting Qwen3.8-Flash-Next to Hebrus: evidence before execution"
date: 2026-08-30T18:20:00+02:00
lastmod: 2026-08-30T18:20:00+02:00
description: "Why the Qwen4Exp bring-up froze identity, math, artifact geometry, and failure semantics before the first Metal graph was allowed to exist."
note_id: "AFN-001"
status: "verified checkpoint"
phase: "0–3"
evidence: "Model-free, sanitizer, admission, CPU, Metal-regression, and build-isolation gates"
decision: "Freeze the source identity and executable contracts before implementing model execution."
machine_summary: "You are adding a new model family to an inference runtime and need an order of operations that prevents a plausible but incorrect graph from becoming the de facto specification."
claim_boundary: "The checkpoint is structurally admitted but remains pinned-not-supported; this note makes no throughput, quality, or runtime-support claim."
audience: "Autonomous coding agents implementing model runtimes"
keywords:
  - autonomous coding agents
  - Qwen3.8-Flash-Next
  - Qwen4Exp
  - Hebrus
  - model bring-up
  - Apple Silicon
  - inference architecture
---

The fastest way to make a new model family difficult to debug is to start with the graph.

Once tensors are flowing through kernels, every mismatch looks like a kernel problem. A shifted layer pattern looks like bad attention. A wrong norm convention looks like quantization damage. A tokenizer drift looks like incoherent logits. The implementation becomes a pile of plausible local fixes around an identity that was never closed.

For the Qwen3.8-Flash-Next integration, Hebrus took the opposite route: execution was forbidden until the source, equations, artifacts, and admission failures were independently testable.

## The object being integrated

The exact target is the public checkpoint [`Qwen/Qwen3.8-Flash-Next`](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) at revision `de4b8e4d43b917e7706784d8bb445c9af86a3540`.

The closed text profile has:

| Property | Exact value |
|---|---:|
| Architecture | `Qwen4ExpForConditionalGeneration` |
| Runtime family spelling | `qwen4exp` |
| Text layers | 48 |
| Hidden width | 2,560 |
| Residual streams | 4 |
| Layer pattern | GDN, GDN, GDN, QSA; repeated 12 times |
| Routed experts | 512 |
| Active experts/token | 10 |
| Expert width | 640 |
| Maximum context | 262,144 tokens |
| Source tensors | 1,658 |
| Source shards | 131 |
| Indexed source bytes | 359,999,963,128 |

These values are admission equalities, not hints. A model with a similar name or dimensions is a different model.

## Phase 0: make identity executable

The source revision, tokenizer, chat template, configuration, Transformers implementation, shard ownership, tensor inventory, license, and file digests were pinned first.

The important output was not prose. It was a contract that can reject mutations. If an agent changes one prime, one layer type, one dtype, one shard span, or one source hash, the validator must fail on that field.

This turns “we are implementing Qwen4Exp” into a finite statement:

```text
repository + revision
+ exact file digests
+ exact tensor inventory
+ exact configuration
+ exact exclusions
= one admissible source identity
```

The first artifact is text-only. The 333 vision tensors and 31 MTP tensors in the source are accounted for but excluded by named rules. They are not silently ignored, and the base runtime is not allowed to accept image/video input or execute MTP.

## Phase 1: separate math from acceleration

Allocation-free C references were added before Metal work for:

- zero-centred RMS normalization;
- four-stream gated residual mixing;
- Gated DeltaNet recurrence and convolution state;
- float32 router softmax and normalized top-10 selection;
- Qwen sparse-attention grouping and deterministic selection;
- PLE hashing, gating, convolution, and history transitions.

The fixtures are captured from a pinned Transformers commit, then cross-checked against an independent transcription. Contract-only cases—tie policy, integer wrap, reset/copy/rewind—are labelled as such rather than misrepresented as upstream output.

This matters because several operations are unusually easy to “optimize” into a different model. Examples include adding one to the wrong norm weight, reassociating the GDN recurrence, pooling physical cache slots rather than logical token groups, or changing tie order in sparse selection.

## Phase 2: freeze physical structure without choosing a winner

The artifact has three disjoint owners:

1. dense/non-routed tensors;
2. one embedded `ds4.expert_major.v2` routed-expert store;
3. one embedded `ds4.ple_rows.v1` row store.

ExpertMajor retained its v2 container. A new family ID closes the 48-layer, 512-expert, gate/up/down geometry without reviving an abandoned v3 format.

The PLE table is not disguised as experts. It has a different access pattern, checksum unit, cache policy, and future codec decision, so it received a separate fixed-page format.

Crucially, the structural phase did not pretend to have selected production quantization. MLX affine4 with group size 64 is sufficient to prove the ExpertMajor geometry, but it is explicitly marked `phase2-structural-not-release-qualified`. The PLE production codec remains open.

## Phase 3: reject before the GPU exists

The structural admission binary is deliberately CPU-only. It validates the family, profile, source hashes, model constants, layer array, tokenizer/template identity, exact tensor set, embedded store manifests, byte extents, ownership, and text-only policy.

Only after those checks may a future runtime allocate pipelines, graph state, or caches. Negative fixtures independently mutate fields and assert that rejection happens at the intended boundary.

This ordering makes the failure useful. “Wrong `ple.rows`” is actionable. “The model emitted nonsense after 40 seconds” is not.

## The implementation rule for other agents

When continuing this port:

1. Read the current contract, not the model name.
2. Preserve `pinned-not-supported` until execution, quality, memory, and performance gates pass.
3. Treat every new optimization as a hypothesis behind an oracle.
4. Keep one owner for every state buffer and physical byte range.
5. Never weaken existing model-family contracts to admit the new family.

The checkpoint through structural admission is recorded as Hebrus commit `6c3ae19`. The public repository is [`andreaborio/hebrus`](https://github.com/andreaborio/hebrus); the note keeps the exact checkpoint even when a working branch has not yet been published upstream.

The result is not yet a running model. It is something more useful at this stage: a model that cannot quietly become the wrong model while agents implement it.
