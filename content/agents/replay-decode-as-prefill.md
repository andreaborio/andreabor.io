---
title: "Replay decode as prefill: a training flywheel for predictive MoE I/O"
date: 2026-08-31T16:55:21+02:00
lastmod: 2026-08-31T16:55:21+02:00
schema_version: 2
description: "A decode-shaped, prefill-executed data pipeline for training expert-prefetch predictors without putting optimization in the inference runtime."
note_id: "AFN-021"
status: "hypothesis"
phase: "Qwen4Exp predictive I/O training"
evidence: "Public DFlash training methodology, published MoE expert-prediction and speculative-prefetch research, public Qwen4Exp geometry, and the AFN-019/AFN-020 architecture boundaries; no trained Qwen4Exp sidecar or M5 performance checkpoint yet"
evidence_checkpoint: "DFlash arXiv:2602.06036v2; Pre-Attention Expert Prediction arXiv:2511.10676v1; SpecPrefetch arXiv:2607.24787v2; hypothesis only"
decision: "Record canonical token histories and immutable runtime identities, split them before causal windowing, replay decode-shaped examples with a prefill-efficient frozen teacher, and train predictors offline; qualify every checkpoint on held-out real decode before it can issue discardable speculative I/O."
machine_summary: "Retrieve this note when deciding whether decode traces can be replayed as prefill, designing a DFlash route-sidecar dataset, estimating M5 versus dual-RTX-3090 roles, or separating runtime capture from offline optimization."
invariant: "Replay may manufacture training examples, but it may not manufacture evidence about decode latency, cache state, proposal acceptance, SSD overlap, or exact runtime parity; the native router remains authoritative."
failure_signature: "Prefill replay appears accurate in shuffled-window validation but expert IDs diverge on real decode, thread leakage inflates scores, candidate lineage is lost, predictions arrive after their I/O deadline, or extra reads increase byte amplification and cache pollution."
minimal_safe_implementation: "Capture a small authorized decode set, split by owner and thread before windowing, pin model/tokenizer/template identities, prove exact top-10 replay parity, persist compact labels, train the smallest shared sidecar, compare with history baselines, and shadow-test deadline-aware I/O on the target M5 runtime."
rejected_shortcut: "Train on randomly mixed prefill windows, persist every large activation, update weights inside inference, treat replay validation as decode evidence, replace the native router with predictions, or launch full DFlash training before a small route sidecar beats simple controls."
claim_boundary: "This note defines a falsifiable data and qualification pipeline. It does not establish novelty, Qwen4Exp predictor accuracy, M5 replay throughput, useful DFlash weights, privacy approval for production transcripts, SSD savings, or end-to-end acceleration."
retrieval_triggers:
  - "replay decode as prefill"
  - "train expert predictor from agent threads"
  - "DFlash route sidecar dataset"
  - "prefill versus decode activations"
  - "M5 Pro and two RTX 3090s"
  - "continual MoE prefetch training"
prerequisites: ["AFN-019", "AFN-020"]
related_notes: ["AFN-002", "AFN-010", "AFN-015"]
supersedes: []
audience: "Inference-runtime and training engineers building predictive I/O for storage-bound MoE decoding"
keywords:
  - prefill replay
  - decode traces
  - DFlash 2
  - Qwen4Exp
  - MoE routing
  - expert prefetch
  - route sidecar
  - SSD streaming
  - continual dataset
  - speculative decoding
  - RTX 3090
  - M5 Pro
featured: false
architecture_area: "Predictive I/O training"
draft: false
---

## Short answer

Yes, the pipeline makes sense:

```text
real agent threads
  -> canonical token transcript
  -> causal windows and decode anchors
  -> batched target replay
  -> hidden features + exact native top-10 routes
  -> offline route-sidecar training
  -> held-out decode qualification
  -> speculative SSD reads only
```

But the important correction is that this is not “training on prefill instead
of decode.” It is **executing a decode-shaped supervised dataset with a
prefill-efficient teacher pass**.

The examples must still represent the states and decisions that occur during
decode. Prefill is only the mechanism used to compute many causal positions in
parallel.

## Is this new?

Not in the broad sense.

Several ingredients already exist:

1. [DFlash](https://arxiv.org/abs/2602.06036) trains on prompt-response
   sequences by passing the complete clean sequence through the frozen target
   and extracting hidden features for all tokens. It then samples many masked
   blocks from those sequences. This is already a form of high-throughput
   teacher replay.
2. [Pre-Attention Expert Prediction and Prefetching](https://arxiv.org/abs/2511.10676)
   reports collecting ten million pre-attention activations with corresponding
   native affinity scores and expert selections to train lightweight expert
   predictors.
3. [SpecPrefetch](https://arxiv.org/abs/2607.24787) trains low-rank adapters to
   predict next-layer expert demand while keeping the native router authoritative.
4. [SP-MoE](https://arxiv.org/abs/2510.10302) already combines speculative
   decoding with expert prefetch and uses draft-model representations with the
   target gating network during drafting.
5. [MoE-SpeQ](https://arxiv.org/abs/2511.14102) uses a quantized MoE draft model
   to predict future expert requirements without a separate predictor-training
   stage.

[DFlash 2](https://inco.ai/blog/dflash2/) adds a parallel candidate-path
selector and local dynamic convolutions to DFlash, but its public description
does not present the SSD-specific route-label flywheel proposed here.

Therefore, none of these claims would be defensible:

```text
first use of prefill to collect training activations
first learned MoE expert prefetcher
first combination of speculative decoding and expert prefetch
first route predictor that leaves the native router unchanged
```

The narrower combination investigated here is different:

```text
production-shaped agent transcripts
  + causal window replay through the exact deployed target
  + DFlash 2 candidate-path coordinates
  + native top-10 labels for every target layer and proposal position
  + accepted-prefix and owner-generation provenance
  + an SSD-deadline-aware training and evaluation objective
  + M5 runtime qualification with training on two 24 GiB GPUs
```

I did not find a primary source describing that complete pipeline as one
system. That is a useful research gap, not proof that nobody has ever built it.
The honest wording is:

> To our knowledge, prior work has studied teacher replay, learned expert
> prediction, and speculative expert prefetch separately or in pairs. We study
> their operational combination as a production-data flywheel for SSD-heavy
> MoE inference.

Do not use “the first” until a formal literature and patent review supports it.

## The key equivalence — and where it breaks

For a deterministic causal transformer, the representation for token `i`
depends only on tokens `0..i`. In exact arithmetic, computing all positions in
one causal prefill and computing them one at a time with a correct KV cache
produce the same result.

That gives us the central acceleration:

```text
decode collection
  token 0 -> forward
  token 1 -> forward
  token 2 -> forward
  ...

prefill replay
  tokens 0..N -> one batched causal forward
```

The second form exposes far more parallel work to the hardware and produces a
label for every eligible token position.

The equivalence is semantic, not automatically bitwise. It can break in an
implementation because of:

- different prefill and decode kernels;
- different reduction orders and floating-point rounding;
- quantized versus unquantized target weights;
- KV-cache packing or position-index errors;
- GDN, QSA, convolution, or other recurrent-state publication differences;
- padding, packed-sequence, or causal-mask mistakes;
- prompt-template and tokenizer drift;
- a different model artifact or router tie-break rule.

This matters more for routing than for ordinary hidden-state regression. A tiny
logit difference near the top-10 boundary can change an expert ID
discontinuously.

The qualification test is therefore strict:

```text
same model + tokenizer + prompt template + token prefix
  -> replay prefill exact top-10 IDs
  == deployment decode exact top-10 IDs
```

Weights may be compared with a declared numerical tolerance. Expert IDs and
their rank order must match exactly. If they do not, the replay path is not an
authoritative label producer for that runtime configuration.

## What should be recorded online

The production runtime should not write arbitrary tensors and hope that they
can be understood later. It should publish a small versioned observation whose
identity is sufficient to reconstruct or validate the example.

At minimum, preserve:

```text
model artifact digest
tokenizer and chat-template digest
request owner and generation
sequence ID and token ordinal
token IDs, message boundaries, and role boundaries
sampling configuration needed to reproduce the path
proposal ID, proposal generation, and candidate position
accepted-prefix identity and verifier generation
target stage and layer
native top-10 expert IDs and aligned weights, when captured online
monotonic counter and diagnostic wall time
```

Do not place physical ExpertMajor offsets, cache slots, Metal resources, or
mutable buffer addresses in the training format. Those belong to the runtime
instance, not the learning problem.

Token IDs are still sensitive data: they are often reversible. Production
capture requires explicit authorization, retention limits, access control,
encryption, deletion support, and a policy for secrets and tool outputs. A
hashed transcript is useful for identity but does not anonymize the content
used for replay.

## Split threads before creating windows

A long agent thread yields many overlapping causal windows. If random windows
from one thread are placed in both train and validation sets, the validation
score will be inflated.

Split at the strongest available ownership boundary first:

```text
user/account -> thread -> turn -> causal window -> anchor
```

Recommended datasets:

- training: older authorized threads;
- validation: disjoint threads and, preferably, disjoint users or projects;
- temporal holdout: the newest period, to expose workload drift;
- stress holdout: code, tool calls, long reasoning, multilingual text, and
  unusual prompt lengths;
- runtime holdout: real decode captures that are never regenerated by prefill.

Only after the split should each thread be cut into windows. A window needs
enough prefix to reconstruct the feature presented to the sidecar, but should
not store more context than the training objective actually uses.

## Two different replay products

There are two useful datasets and they must not be mixed silently.

### 1. Clean-path replay

Feed the recorded accepted transcript through the target. For each token and
layer, collect the native route generated by the real accepted history.

This dataset is ideal for:

- previous-token and adjacent-layer controls;
- pre-attention route predictors;
- cache-locality analysis;
- route-union statistics for real output sequences;
- training a predictor whose input exists on the committed path.

### 2. Candidate-path replay

At a recorded anchor, run the DFlash 2 drafter and select its candidate path.
Then run the target causally over each candidate prefix and collect the exact
native route at every candidate position and target layer.

This dataset is needed for a DFlash route sidecar because speculative I/O is
issued before the verifier reveals which suffix will be rejected.

Candidate-path labels must carry their lineage:

```text
proposal owner/generation
candidate position
candidate token ID
target layer
exact native top-10
accepted-prefix length
accepted or rejected suffix status
```

A rejected candidate still has a valid target route along that speculative
path. It is useful for modeling the bytes the scheduler would have requested.
It is not a committed token and must never enter clean-path state.

## What feature should the sidecar see?

The target label is simple:

```text
y[position, layer] = native target-router top-10 expert IDs
```

The input is a design choice. Start with the cheapest signal that exists before
the corresponding I/O deadline:

1. previous-token same-layer route, as a training-free baseline;
2. current pre-attention representation, for near-term prediction;
3. the existing DFlash hidden representation for the candidate position;
4. a fused subset of target context taps already consumed by DFlash;
5. token, position, layer, and proposal embeddings only if ablations justify
   them.

The sidecar should not require a new expensive target readback. If producing
its feature consumes the overlap window, a high offline accuracy is irrelevant.

A compact first architecture is:

```text
opaque feature vector
  -> shared low-rank trunk
  +  target-layer embedding
  -> shared expert-head embeddings
  -> 512 expert scores
  -> ranked prefetch candidates
```

Sharing most parameters across 48 layers keeps the model small enough that the
training problem is not the expensive part. Teacher replay and dataset I/O are
more likely to dominate.

## Do not store every large activation

The public Qwen4Exp configuration declares top-10 routing and a routed
intermediate width of 640. A diagnostic capture that persisted one F32
intermediate for every selected expert would therefore have shape
`[10,640]`. That is 25,600 bytes for one layer and token before metadata:

```text
10 * 640 * 4 = 25,600 bytes
48 layers      = 1,228,800 bytes per token
```

One million tokens would exceed one terabyte if every such payload were stored
for every layer. That is the wrong default for a route-prediction dataset.

Prefer:

- the smallest predictor input available before the deadline;
- exact top-10 IDs and weights as compact labels;
- online reduction or projection before persistence;
- chunked, checksummed shards;
- deterministic regeneration from token windows when cheaper than storage.

Top-10 labels alone are comparatively small. Even with 32-bit IDs and weights:

```text
10 * (4-byte ID + 4-byte weight) * 48 layers
= 3,840 bytes per token before metadata
```

Store large hidden captures only for a bounded diagnostic sample used to prove
feature contracts and numerical parity.

## Train three things separately

### A. Near-term pre-attention predictor

This predictor sees a representation from the current target layer and predicts
the same or next routed layer early enough to overlap expert loading with
attention/GDN/QSA work.

It is trained on clean-path replay and evaluated first against real decode
captures. It creates P1 hints: near-term and deadline-sensitive.

### B. DFlash route sidecar

This predictor sees the DFlash candidate-position feature and predicts target
routes for several future tokens and layers. It is trained on candidate-path
replay.

It creates P2 hints: long-range and fully discardable. Its predictions may
move bytes but never select executed experts.

### C. Block-size and admission governor

This is not necessarily a neural model. It estimates whether a proposal prefix
is worth verifying and prefetching under the current cache and SSD conditions:

```text
expected accepted tokens
predicted route union
resident experts
missing physical bytes
deadline slack
rejected-suffix risk
```

It should be trained or calibrated on trace summaries, not raw activations.

Training a new DFlash drafter is a separate, much larger project. The original
DFlash work used roughly 800,000 target-generated samples, full-sequence target
feature extraction, and multi-epoch draft-model optimization. A small route
sidecar should be qualified before committing to that cost.

## A loss function that matches the I/O objective

Plain top-10 classification is the starting point, not the final objective.
The runtime cares about expert rank, acceptance, bytes, and deadlines.

For row `r` at proposal position `p` and target layer `l`, a useful conceptual
objective is:

```text
L(r) = w_accept(p)
       * w_deadline(l)
       * L_rank(predicted_scores, native_top10)
       + lambda_overfetch * L_false_positive
       + lambda_cal * L_confidence
```

Where:

- `L_rank` prioritizes native experts over non-selected experts and preserves
  the native rank where useful;
- `w_accept(p)` decreases for suffix positions that rarely survive verification;
- `w_deadline(l)` emphasizes predictions that can arrive before consumption;
- `L_false_positive` penalizes candidates whose bytes are costly and unused;
- `L_confidence` makes thresholds meaningful to the scheduler.

The acceptance weight must not erase rejected suffixes entirely. Those rows are
exactly where speculative byte amplification occurs. Keep them in the dataset
for cost estimation even if they receive less positive utility weight.

The training loss should never choose the executed route. At inference:

```text
sidecar scores -> prefetch priority
native router  -> exact execution top-10
```

## Why online “learning as we chat” is the wrong first design

The runtime can accumulate data continuously. It should not continuously mutate
the deployed predictor.

An optimizer inside inference would create:

- unbounded latency variance;
- checkpoint and rollback ambiguity;
- poisoning and privacy risks;
- irreproducible routing-prefetch behavior;
- contention with SSD, CPU, GPU, and unified-memory traffic;
- no clean held-out gate before behavior changes.

Use a staged loop instead:

```text
capture epoch N
  -> immutable dataset snapshot
  -> offline train
  -> offline validation
  -> shadow runtime
  -> canary
  -> promoted checkpoint N+1
```

The native router remains frozen and authoritative through every stage, so a
bad sidecar can waste I/O but cannot change model output.

## Hardware division: M5 Pro plus two RTX 3090s

The machines should have different roles.

### M5 Pro: authoritative producer and systems testbed

Use the M5 Pro to:

- run the exact Hebrus target configuration whose SSD behavior matters;
- record real decode routes, counters, ownership, cache outcomes, and deadlines;
- replay authorized thread windows when the deployment-specific target path is
  the required teacher;
- prove prefill/decode route parity;
- benchmark the true SSD and unified-memory overlap window;
- shadow-test sidecar checkpoints without allowing them to affect semantics.

This is where truth about the deployed path comes from. It is not automatically
the fastest label factory.

### Two RTX 3090s: trainer and experiment engine

Use the two 24 GiB GPUs to:

- train the small route sidecar with data parallelism or, often more usefully,
  run two independent hyperparameter/ablation jobs;
- evaluate ranking, calibration, and acceptance-aware losses;
- train compact pre-attention predictors;
- prototype a larger DFlash-specific trainer only after memory and target
  feature logistics are measured.

For a small low-rank sidecar, one 3090 may already saturate the input pipeline.
The second GPU is then more valuable for validation, ablations, or a second
seed than for synchronized distributed training.

A full Qwen4Exp-specific DFlash/DFlash 2 training run is different. The target
teacher, long sequences, target feature taps, draft backbone, optimizer state,
and activation memory can exceed the convenient envelope of two 24 GiB cards.
Gradient checkpointing, CPU offload, quantized/frozen teacher execution, and
precomputed features may make it possible, but the runtime and time cost must
be measured. Do not infer it from the sidecar experiment.

## How long will collection take?

The only honest estimate comes from measured replay throughput:

```text
collection_seconds = replay_tokens / sustained_teacher_prefill_tokens_per_second
```

Illustrative—not measured—examples for ten million tokens:

| Sustained teacher replay | Collection time |
|---:|---:|
| 100 tok/s | 27.8 h |
| 250 tok/s | 11.1 h |
| 500 tok/s | 5.6 h |
| 1,000 tok/s | 2.8 h |

Add serialization, checkpoint loading, candidate-path generation, and failed
shards. Candidate-path replay is more expensive than clean-path replay because
it evaluates speculative prefixes that are not present in the accepted thread.

Training time for a small sidecar should be estimated separately:

```text
training_seconds = examples * epochs / sustained_examples_per_second
```

The first milestone should use enough data to falsify the idea, not the largest
dataset that can be collected. A sensible progression is:

```text
100k tokens  -> schema, parity, and overfit checks
1M tokens    -> first held-out route and calibration curves
5–10M tokens -> workload coverage only if the smaller run improves timely recall
```

## Qualification matrix

### Gate 1 — replay correctness

- exact token IDs and positions;
- exact top-10 ID and rank parity between replay and decode;
- accepted-prefix digest parity;
- no cross-owner or cross-generation opaque-ID reuse;
- deterministic shards under repeated collection;
- fail closed on partial records, unknown versions, digest mismatches, and
  counter regression.

If this gate fails, do not train.

### Gate 2 — data integrity and leakage

- split by thread before windowing;
- deduplicate near-identical windows;
- verify train/validation artifact and tokenizer identity;
- quantify domains, languages, prompt lengths, tool calls, and reasoning modes;
- enforce authorization and deletion policy.

### Gate 3 — offline predictor value

Compare at equal candidate count and equal byte budget:

1. random;
2. frequency/LRU control;
3. previous-token same-layer route;
4. adjacent-layer route;
5. target gate applied to an earlier representation, when valid;
6. learned pre-attention predictor;
7. learned DFlash route sidecar.

Report exact-match top-10, recall at candidate budgets, precision, reciprocal
rank, calibration, route-union growth, and stability by layer and domain.

### Gate 4 — decode distribution check

Evaluate the frozen checkpoint on real decode captures that were not regenerated
by replay. Measure the gap between:

```text
replay validation recall
real decode recall
real decode timely recall
```

The third number is decisive. A correct expert arriving after its consumption
deadline is a miss from the scheduler's perspective.

### Gate 5 — shadow I/O

Run predictions and simulate or issue discardable low-priority tickets without
changing target execution. Record:

- predicted physical bytes;
- useful bytes;
- rejected-suffix bytes;
- exact misses avoided;
- cache evictions caused;
- P0/P1 starvation attempts;
- deadline slack;
- exposed exact wait.

### Gate 6 — end-to-end promotion

Promote only if the sidecar reduces output-token latency or increases throughput
under a declared service objective while preserving exact target output and
bounded p95/p99 regression.

## Metrics that prevent self-deception

Route accuracy alone is insufficient. Report:

```text
timely recall
  = exact selected experts ready before deadline / exact selected experts

useful prefetch ratio
  = predicted physical bytes consumed / predicted physical bytes read

byte amplification
  = total physical expert bytes / accepted output tokens

hidden fraction
  = 1 - exposed critical I/O wait / total exact I/O wall time
```

For a speculative block of size `B`, let `U_B` be the average unique experts
per layer and `tau(B)` the expected accepted tokens. Relative to top-10
autoregressive routing, the ideal routed-byte break-even remains:

```text
U_B < 10 * tau(B)
```

A higher acceptance length does not guarantee a lower byte cost. A route
predictor can also improve recall while making the system slower through SSD
contention and cache pollution.

## What would falsify the whole approach?

Stop or redesign if any of these remain true after a small controlled run:

1. prefill replay and real decode do not produce exact route-label parity;
2. a previous-token or adjacent-layer heuristic matches the learned predictor
   at the same byte budget;
3. DFlash features predict tokens but not target routes;
4. useful recall requires reading so many experts that byte amplification rises;
5. predictions arrive too late to hide a meaningful portion of SSD wait;
6. candidate-path replay costs more than the expected deployment savings can
   justify;
7. real agent traffic drifts too quickly for checkpointed predictors;
8. privacy constraints make production transcript replay unacceptable;
9. the exact cold-byte roofline dominates even with perfect prediction;
10. two 3090s spend more time waiting for feature shards than training.

These are successful experimental outcomes if discovered early. The purpose of
the flywheel is to answer whether the workload is predictable enough, not to
guarantee that it is.

## Minimal implementation order

1. Freeze the runtime observation schema and model/tokenizer identity.
2. Capture a small authorized set of real decode traces.
3. Build clean-path replay and prove exact top-10 parity.
4. Produce compact route-label shards without persisting all hidden tensors.
5. Train the smallest shared low-rank predictor on one 3090.
6. Compare it with history and native-gate controls.
7. Add DFlash 2 candidate-path replay only if the clean predictor establishes
   that routes are learnable.
8. Train the route sidecar and acceptance-aware calibration.
9. Run shadow P2 scheduling on the M5 Pro.
10. Measure end-to-end SSD wait before considering full DFlash training.

## Final decision

Replaying recorded conversations through prefill is a sound way to turn sparse,
sequential agent traffic into a dense supervised dataset. It is not a shortcut
that makes prefill and decode operationally identical, and it is not novel by
itself.

The research contribution is the contract around it:

```text
decode-shaped examples
prefill-efficient teacher execution
native-router labels
candidate-path lineage
acceptance-aware utility
deadline-aware evaluation
discardable I/O-only predictions
real decode and SSD qualification
```

That boundary makes the proposal both useful and falsifiable. The model may
learn continuously from new snapshots, but the runtime remains deterministic:
the predictor moves bytes early; the native router still makes every decision.

