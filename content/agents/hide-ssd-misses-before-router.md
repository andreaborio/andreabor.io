---
title: "Hide SSD misses before the router knows they exist"
date: 2026-08-31T13:34:00+02:00
lastmod: 2026-08-31T13:34:00+02:00
schema_version: 2
description: "A falsifiable pipeline hypothesis for SSD-heavy Qwen4Exp inference: exact PLE lookahead, predictive expert loading, DFlash route forecasts, component-level streaming, and deadline-aware scheduling."
note_id: "AFN-019"
status: "hypothesis"
phase: "8–11 performance architecture"
evidence: "Public Qwen4Exp geometry, established Hebrus storage and transaction contracts, published expert-prefetch research, DFlash 2 design evidence, and documented Metal I/O capabilities; no Qwen4Exp M5 performance checkpoint yet"
evidence_checkpoint: "Hebrus c3759b5 plus Qwen/Qwen3.8-Flash-Next revision de4b8e4d43b917e7706784d8bb445c9af86a3540; hypothesis only"
decision: "Treat SSD-heavy Qwen4Exp inference as a deadline-scheduled wavefront and test three lookahead tiers—exact PLE requests, pre-attention expert prediction, and DFlash route prediction—while keeping the native router and transactional target state authoritative."
machine_summary: "Retrieve this note when implementing Qwen4Exp expert or PLE SSD streaming, combining ExpertMajor v2 with DFlash, designing route prediction, or deciding whether I/O latency can be overlapped with Metal compute."
invariant: "Prediction may change which bytes arrive early, but it must never change native top-10 routing, target arithmetic, token acceptance, committed sequence state, or the priority of exact critical reads."
failure_signature: "The runtime reports cache hits or high SSD throughput while token latency still contains layer-by-layer wait bubbles, speculative expert reads starve PLE or exact misses, rejected DFlash suffixes amplify bytes per accepted token, or a predictor silently becomes the execution router."
minimal_safe_implementation: "Use generation-owned I/O tickets with deadlines and confidence, separate exact and speculative queues, reconcile predictions against the native router, stream ExpertMajor components through bounded buffers, publish only accepted target state, and measure timely recall, useful bytes, amplification, and exposed wait rather than hit rate alone."
rejected_shortcut: "Prefetch every plausible expert, fix DFlash at its largest block, wait for all selected records before starting compute, use one global I/O queue, or treat Metal I/O capability and paper speedups as evidence that the M5 path is profitable."
claim_boundary: "This note does not establish expert-predictor accuracy, an M5 SSD bandwidth figure, a winning DFlash block size, an ExpertMajor codec, end-to-end acceleration, quality parity, or Qwen4Exp runtime support. Every mechanism remains gated by physical traces and exact target-state tests."
retrieval_triggers:
  - "hide SSD expert latency behind compute"
  - "DFlash with ExpertMajor v2"
  - "predict MoE routes before the native router"
  - "PLE and expert I/O priority"
  - "adaptive speculative block size for an offloaded MoE"
  - "Metal I/O wavefront scheduler"
prerequisites: ["AFN-002", "AFN-003", "AFN-010"]
related_notes: ["AFN-015", "AFN-016"]
supersedes: []
audience: "Inference-runtime architects implementing storage-bound MoE decoding on Apple Silicon"
keywords:
  - SSD streaming
  - ExpertMajor v2
  - Qwen4Exp
  - DFlash 2
  - speculative decoding
  - expert prefetch
  - route prediction
  - PLE
  - Metal I/O
  - MTLIOCommandQueue
  - mixture of experts
  - Apple Silicon
  - deadline scheduling
  - latency hiding
featured: false
architecture_area: "Storage scheduling"
draft: false
---

## Decision

An SSD-heavy Qwen4Exp runtime cannot be organized as:

```text
router -> discover misses -> read every record -> wait -> execute experts
```

That sequence places storage on the critical path of every layer. The working
hypothesis is to turn inference into a deadline-scheduled wavefront in which
known and predicted data movement begins at the earliest semantically valid
point, compute starts as soon as a useful subset is ready, and another request
or stage fills unavoidable bubbles.

Three kinds of lookahead must remain distinct:

1. **Exact lookahead:** token IDs determine PLE rows before the target reaches
   the PLE layer.
2. **Near-term predictive lookahead:** a lightweight pre-attention predictor
   estimates the current layer's eventual expert set while GDN or QSA still has
   useful work to execute.
3. **Long-range speculative lookahead:** a DFlash drafter may predict expert
   sets for several future tokens and target layers before verification starts.

Only the native Qwen4Exp router selects executed experts. Only the verified
target path commits state. Prediction is an I/O hint, never model semantics.

## Why overlap alone cannot defeat the byte roofline

The pinned Qwen4Exp text model has 48 sparse-MoE layers, 512 routed experts per
layer, top-10 routing, hidden width 2,560, and routed intermediate width 640.
Those fields are public in the
[`Qwen3.8-Flash-Next` configuration](https://huggingface.co/Qwen/Qwen3.8-Flash-Next/blob/de4b8e4d43b917e7706784d8bb445c9af86a3540/config.json).

One routed expert contains:

```text
gate + up + down
= 2560*640 + 2560*640 + 640*2560
= 4,915,200 parameters
```

One token therefore activates:

```text
48 layers * 10 experts * 4,915,200
= 2,359,296,000 parameter uses
```

At ideal payload only, that is 562.5 MiB at two bits or 1.0986 GiB at four bits
per token when every selected layer-expert record is cold. Metadata, alignment,
staging, and read amplification are additional. AFN-002 establishes why the
existing ExpertMajor v2 container can describe this family without claiming a
qualified codec.

The lower bound is therefore:

```text
token time >= max(compute time, exact SSD bytes / sustained SSD bandwidth)
              + dependency bubbles that could not be hidden
```

Scheduling can remove the last term and overlap the first two. It cannot make
the storage term disappear. If a measured path needs 600 MiB of exact bytes per
output token, no cache-hit label or queue-depth chart can substitute for the
corresponding bandwidth.

This leads to the first promotion rule:

> Optimize exact bytes per accepted token before optimizing raw I/O throughput.

Useful mechanisms include low-bit storage, sequence-local cache retention,
deduplication of repeated routes across a verifier block, grouping token rows
by expert, and avoiding work on a rejected speculative suffix. Latency hiding
comes after those byte owners are visible.

## Two storage workloads, not one

Qwen4Exp exposes two unrelated access patterns.

### PLE: small, exact, latency-sensitive

PLE requests 16 logical rows per token. The row IDs are derived from known token
history, so a request becomes exact as soon as the token block is chosen. The
physical payload is small, but unrelated rows may occupy unrelated pages. This
makes PLE primarily an IOPS and tail-latency problem.

AFN-003 defines the fixed-page store and the separation between logical row
identity, physical page ownership, checksum, and future codec. The proposed
scheduler preserves that boundary:

```text
DFlash path selection or known autoregressive token
  -> exact PLE row IDs
  -> page locate, deduplicate, sort, and coalesce
  -> high-priority I/O ticket
  -> overlap with embedding and target layer 0
  -> dependency-scoped wait immediately before PLE use
```

An expert bulk wave must never starve this queue. A PLE ticket for a rejected
DFlash suffix does not commit token history, although a fully read and verified
page may remain as an ordinary cache entry.

### Routed experts: MiB-scale and bandwidth-sensitive

An expert miss transfers a complete gate/up/down record or named component
subranges. The requests are sparse in decode, but their aggregate payload is
large. They require a bulk queue, deeper concurrency, and a very different
replacement policy from PLE.

The cache score should estimate stall removed per byte:

```text
score(record) = P(use before eviction)
                * expected exposed latency avoided
                / resident bytes
```

Plain LRU is only a control. Modern decoder-only MoE routes may be too uniform
for popularity alone to deliver a high hit rate; the
[ProMoE paper](https://arxiv.org/abs/2410.22134) reports this as a specific
challenge and also observes that naive prefetch can hurt prefill when nearly
all experts are used.

## Hypothesis H1: exact PLE latency can mostly disappear

PLE has the cleanest lookahead because the address calculation is deterministic.
For DFlash, planning begins immediately after the final candidate path is known.
For ordinary decode, it begins when the current input token is known.

The target then provides a useful cover window:

```text
PLE I/O        |==================|
target         | embedding | layer 0 GR/GDN/router/MoE | PLE dependency
```

The queue should expose:

- request and unique rows;
- request and unique pages;
- cache hits, joined in-flight reads, and misses;
- logical bytes and physical bytes;
- issue-to-ready latency and ready-to-use slack;
- exposed wait at the PLE boundary;
- rejected-suffix bytes and later cache reuse.

**Falsification:** H1 fails if cold PLE wait remains material after exact early
issue, or if protecting PLE latency measurably degrades expert throughput more
than it saves in target stalls.

## Hypothesis H2: predict expert routes before attention, not after it

The native router sees the representation after the layer's attention/GDN path.
Waiting for it serializes selection, transfer, and expert execution. A separate
predictor can observe the representation available before attention and issue
prefetch hints while the real layer proceeds.

```text
wide residual
  |
  +-> small pre-attention predictor -> predicted top experts -> SSD tickets
  |
  +-> native GDN or QSA -> native router -> exact top-10
                                        -> reconcile predictions
```

The predictor must not replace or modify the native router. Prediction errors
affect transfer efficiency only. The
[SpecPrefetch paper](https://arxiv.org/abs/2607.24787) uses the same separation
between prefetch prediction and frozen execution routing. A
[preliminary pre-attention expert-prediction study](https://arxiv.org/abs/2511.10676)
reports that two lightweight projections can predict expert rankings with high
accuracy on several MoE models, including Qwen3-30B, but those figures are not
evidence for Qwen4Exp or Apple Silicon.

The implementation ladder should be deliberately cheap:

1. trace the overlap between the previous token's same-layer top-10 and the
   current exact top-10;
2. evaluate the existing native router on an earlier representation as a
   zero-training control;
3. if needed, train a low-rank correction or a shared low-rank predictor with
   small per-layer heads;
4. prefetch only candidates above a calibrated confidence/deadline threshold.

The predictor emits IDs into a tiny shared buffer. The runtime starts the normal
GDN/QSA command stream without a global wait; a completion handler or small
event transfers only the IDs needed to create file-offset tickets.

The primary metric is **timely recall**:

```text
timely recall = exact selected experts ready before their deadline
                / exact selected experts
```

Report it with precision, bytes prefetched, bytes used, eviction cost, and
exposed exact-miss wait. A predictor that reaches high recall by reading 30
experts for a top-10 router is not successful.

**Falsification:** H2 fails if predictor compute and queue boundaries consume
the lookahead window, if useful timely recall is low under a bounded overfetch
ratio, or if the extra reads increase end-to-end latency despite fewer reactive
misses.

## Hypothesis H3: DFlash can predict routes as well as tokens

DFlash conditions a lightweight parallel drafter on hidden features from the
target and proposes a whole token block in one pass. DFlash 2 adds a top-candidate
path selector and local dynamic convolutions; the released
[Qwen3.8-27B DFlash2 model card](https://huggingface.co/incoai/Qwen3.8-27B-DFlash2#evaluation)
reports longer accepted blocks than the model's native MTP under its published
H200 evaluation.

Those weights are not compatible with Qwen4Exp. The reusable idea is to add a
route sidecar when a Qwen4Exp-specific drafter is eventually trained:

```text
DFlash hidden[position]
  +-> token LM head and candidate path
  +-> shared low-rank route adapter
        -> predicted experts[layer, position]
```

The route labels are already observable from frozen target traces. The sidecar
can therefore be trained as an auxiliary ranking task without changing target
routing. Once the final token path is selected, high-confidence route tickets
for later target layers can begin before verification.

This creates three priority classes:

```text
P0 exact critical      native-router miss or exact PLE dependency
P1 near-term predicted pre-attention predictor for an approaching layer
P2 speculative         DFlash route sidecar, next-token history, cache warming
```

P2 may consume only bandwidth and cache slots not required by P0/P1. When a
prediction is rejected, its ticket loses priority; completed records become
ordinary cache candidates rather than semantic state.

**Falsification:** H3 fails if draft features do not predict target routes with
useful precision, if a route sidecar materially increases draft time, or if
speculative route overfetch erases the accepted-token gain from DFlash.

## Hypothesis H4: ExpertMajor should stream as a wavefront, not a barrier

After exact top-10 routing, the target should not wait for every selected record
before starting any expert work. ExpertMajor v2 already gives each expert a
contiguous, checksummed record with explicit component extents. That record can
be consumed in bounded waves.

Gate and up are used together; down is needed only after the SwiGLU intermediate
exists. One candidate schedule is:

```text
SSD:  gate+up E0 | gate+up E1 | down E0 | gate+up E2 | down E1 | ...
GPU:               G/U E0      | G/U E1  | down E0    | G/U E2 | ...
```

Reads may complete out of order. Ready experts can execute immediately into
separate result slots, while the final weighted sum follows a deterministic
route-rank order. This preserves a stable reduction order without making one
slow read block nine ready experts.

The physical selector should test wave widths such as 2, 4, and all selected
experts. One expert per dispatch may waste more command overhead than it hides;
waiting for all ten may recreate the original barrier.

Apple's documentation describes
[Metal resource loading](https://developer.apple.com/documentation/metal/resource-loading)
and the
[`MTLIOCommandQueueDescriptor`](https://developer.apple.com/documentation/metal/mtliocommandqueuedescriptor):
I/O queues can load file data into Metal resources, support priority and
concurrent command limits, and synchronize with compute through shared events.
That makes MTLIO a legitimate candidate, not a proven winner. Bounded `pread`
into shared Metal-visible buffers remains the authoritative fallback until a
physical A/B proves otherwise.

**Falsification:** H4 fails if component splitting lowers effective SSD
throughput, command overhead dominates the saved tail, or concurrent SSD/GPU
traffic slows unified-memory compute enough to remove the overlap.

## Hypothesis H5: prefill and decode need different streaming modes

Large prefill tiles can route tokens to most experts in a layer. In that regime,
sparse random reads may cost more than one sequential layer extent. Decode and a
small DFlash verifier block remain sparse and should use selected records.

The runtime therefore needs an explicit crossover:

```text
macro prefill    stream the next full or near-full layer extent sequentially
micro prefill    read the sorted, coalesced expert union for the tile
decode           route-wise predictive cache and exact misses
DFlash verify    block union, deduplicated across token rows
```

During macro prefill, a two-layer ring can load layer `l+1` while the GPU
processes layer `l`. During decode, loading all 512 experts of a future layer is
not acceptable.

The crossover must be measured from exact unique-record fraction, coalesced
task count, physical bytes, and sustained bandwidth. It must not be a hardcoded
prompt-length guess.

**Falsification:** H5 fails if the layer-major sequential path cannot overlap
enough compute to justify its overread, or if the selected-record path remains
faster even when the route union approaches the full layer.

## Hypothesis H6: another request is the only general filler for a hard miss

Within one sequence, later-layer routes depend on earlier-layer results. Some
I/O bubble remains even with prediction. The general filler is independent work
from another admitted request:

```text
request A  GDN -> route -> SSD wait --------> experts
request B         draft -> QSA -> route -> SSD wait
request C                  GDN -> experts
GPU        A        B          C             A
```

The scheduler should maintain runnable stages rather than synchronizing a whole
batch at each layer. An I/O completion makes one request runnable; the GPU takes
the next ready operation. When several requests reach the same layer, their
route records may be merged and grouped by expert.

This is primarily a throughput mechanism. Single-request TPOT can regress if
the scheduler is unfair. Concurrency is also context-dependent: each session
owns GDN, QSA KV/index, PLE history, and transactional state. Long-context
admission may permit only one lane.

For agent workloads, tool and network waits create another low-priority window.
The runtime may retain or repopulate a sequence-local hot set from public model
state and recent route traces while generation is idle. This remains speculative
cache warming because future tool output is unknown.

**Falsification:** H6 fails if two to four lanes exceed the admitted memory
reserve, increase p95 TPOT beyond the declared service goal, or contend for SSD
and unified memory without improving useful GPU occupancy.

## Hypothesis H7: DFlash block size must follow I/O cost

A fixed maximum block is unsafe for an offloaded MoE. After drafting, the runtime
can estimate for each prefix length:

- expected acceptance;
- predicted and already-resident expert union;
- missing ExpertMajor bytes;
- PLE pages;
- deadline slack;
- rejected-suffix amplification risk.

For block size `B`, expected speculative speed is:

```text
speedup(B) = tau(B) * target_one_token_time
             / (draft(B) + verify(B) + exposed_IO(B) + commit(B))
```

If `U_B` is the average number of unique experts per layer in the verifier block,
the ideal two-bit routed payload per accepted output token is proportional to:

```text
48 * U_B * expert_record_bytes / tau(B)
```

Relative to autoregressive top-10 routing, the routed-byte break-even is:

```text
U_B < 10 * tau(B)
```

For example, a block of five with expected `tau=4` must average fewer than 40
unique experts per layer, rather than its worst-case 50, merely to avoid
increasing routed bytes per output token. This is a formula, not a prediction
of Qwen4Exp route locality.

The governor should truncate the already-produced proposal to the best measured
prefix. Shortening a speculative block does not weaken target correctness.

**Falsification:** H7 fails if route/acceptance estimation costs more than the
adaptation saves, or if a simple fixed block performs within noise across all
qualified cache and prompt conditions.

## Required scheduler contract

Every I/O ticket should name at least:

```text
store and immutable digest
generation and owner request
phase, layer, token/block mask
page or expert/component identity
exact vs predicted
confidence and priority
issue time and consumption deadline
compressed bytes and destination slot
lease count and completion sequence
```

The queue discipline is:

1. exact current PLE and exact native-router misses;
2. near-term high-confidence records with a deadline inside the current layer;
3. later-layer or later-token predictions that fit the remaining budget;
4. background cache warming only when no admitted request can use the bandwidth.

One global `waitUntilCompleted` is a failure. Compute waits on the smallest
event that guards the records it is about to consume. Cancellation releases
ownership exactly once. A stale generation may finish reading bytes but may
never publish them into a recycled cache slot.

AFN-010 remains authoritative for semantic state: GDN recurrence, QSA KV/index,
PLE history and convolution state, cache frontiers, residual streams, and logits
publish as one accepted target transaction. I/O cache entries are not sequence
state.

## Measurements that decide the hypothesis

Cache hit rate and SSD peak throughput are insufficient. Record:

### Storage

- exact, predicted, and rejected bytes;
- logical versus physical bytes;
- queue depth, task sizes, and coalescing;
- cold and warm bandwidth by read size;
- issue-to-ready p50/p95/p99;
- deadline slack or lateness;
- useful-prefetch ratio and overfetch amplification.

### Routing

- exact top-10 IDs by layer/token;
- overlap with previous token and within block sizes 2–5;
- unique experts per layer/block;
- predictor recall, precision, timely recall, and confidence calibration;
- cache eviction caused by false predictions.

### Compute and overlap

- GDN/QSA/router/shared/routed stage time;
- GPU idle time attributable to exact I/O;
- gate/up and down wave completion;
- unified-memory slowdown while I/O is active;
- exposed wait, not merely total I/O wall time.

### End to end

- prefill and decode separately;
- autoregressive, native MTP, and DFlash controls;
- block sizes 1, 2, 3, 4, and 5;
- one request and admitted multi-request lanes;
- cold process, cold store, natural warm store, and hot application cache;
- output identity, transaction digests, pressure, working set, and swap delta.

The central metric is:

```text
hidden fraction = 1 - exposed critical I/O wait / total exact I/O wall time
```

It must be interpreted together with exact bytes per output token. A 95% hidden
fraction achieved by doubling speculative reads is not automatically a win.

## Experiment order and promotion gates

### Gate A — physical storage envelope

Benchmark the actual ExpertMajor candidate record sizes and PLE pages on the
target M5 machine. Compare bounded `pread` into shared buffers with MTLIO at
multiple queue depths. Measure simultaneous GPU compute interference. Do not
fit the scheduler to advertised SSD bandwidth.

### Gate B — trace-only locality

Run the exact target and record route IDs without prediction. Calculate
cross-token overlap, block unions, per-layer skew, cache simulations, and the
byte break-even for block sizes 2–5. This gate can reject DFlash route prefetch
before training anything.

### Gate C — deterministic overlap

Implement exact PLE early issue, dependency-scoped waits, and ExpertMajor
component waves. Prove identical target output and committed state under every
partial completion and injected I/O failure.

### Gate D — pre-attention predictor

Start with zero-training controls, then train the smallest predictor justified
by the trace. Promote only if timely recall reduces end-to-end exposed wait under
a bounded byte-amplification and cache-eviction budget.

### Gate E — verifier-only oracle

Before training DFlash, feed recorded exact future tokens to a block verifier.
This gives perfect acceptance and zero draft cost: an upper bound on what any
drafter can recover after target verification, transactional state, expert I/O,
and PLE costs. If this oracle lacks headroom, stop.

### Gate F — DFlash and route sidecar

Train or obtain a target-specific drafter only after the oracle passes. Compare
token-only DFlash against DFlash plus route prediction. The sidecar wins only if
its added draft latency is smaller than the exact wait it removes.

### Gate G — adaptive and multi-request scheduling

Enable block adaptation and ready-request bubble filling independently, then
together. Use A/B/B/A runs and reject changes whose control drift exceeds the
repository performance protocol.

No gate promotes runtime support. Product exposure still requires the normal
artifact, quality, memory, physical-hardware, and long-run stability evidence.

## Restart capsule for a future agent

When resuming this hypothesis:

1. Read AFN-002 for ExpertMajor family geometry, AFN-003 for PLE store ownership,
   and AFN-010 for transactional publication.
2. Confirm the current Qwen4Exp artifact/profile and codec; do not reuse the
   ideal two-bit numbers as measured bytes.
3. Collect physical M5 storage traces before adding a predictor.
4. Separate PLE latency from expert bandwidth in every report.
5. Measure route union and exact bytes per accepted token before assuming DFlash
   is favorable.
6. Keep the native router authoritative and prediction discardable.
7. Prefer timely recall and exposed wait over cache hit rate.
8. Test component-wave execution without changing deterministic accumulation.
9. Use an oracle verifier to establish an upper bound before drafter training.
10. Leave this note labelled `hypothesis` until a public Hebrus checkpoint
    closes the relevant physical and semantic gates.

The durable architectural bet is narrow: prediction should move bytes, not
decisions. If the measured route locality and M5 overlap window are sufficient,
this pipeline can turn SSD stalls into background work. If they are not, the
same instrumentation will show that the remaining problem is unavoidable byte
volume rather than insufficient scheduling cleverness.
