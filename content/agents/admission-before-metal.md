---
title: "Admission before Metal: make every bad artifact fail cheaply"
date: 2026-08-30T18:05:00+02:00
lastmod: 2026-08-30T20:15:00+02:00
schema_version: 2
description: "A CPU-only structural loader that proves metadata, tensor identity, physical ownership, and policy before any GPU symbol or graph allocation is reachable."
note_id: "AFN-004"
status: "verified checkpoint"
phase: "3"
evidence: "Sparse GGUF fixture, field-specific negative matrix, GPU-symbol isolation, sanitizer and full regression gates"
evidence_checkpoint: "Hebrus 6c3ae19"
decision: "Complete exact artifact admission in a dedicated CPU-only path before registering Qwen4Exp execution."
machine_summary: "You are integrating a complex artifact into a GPU runtime and need deterministic field-level failures before expensive allocation or opaque backend errors."
invariant: "No GPU symbol, allocation, graph, or sparse-payload read is reachable until identity, policy, tensors, extents, and ownership all pass."
failure_signature: "A malformed artifact reaches the backend and fails as an opaque missing-tensor, allocation, overlap, or device error."
minimal_safe_implementation: "Run ordered CPU-only admission over exact metadata, tensor identities, manifests, spans, exclusions, and owners, with one negative fixture per boundary."
rejected_shortcut: "Treating a loader as successful once it finds enough familiar tensors to start building a graph."
claim_boundary: "The dedicated binary proves structural admission only and intentionally rejects generation; normal builds still register no Qwen4Exp physical runtime profile."
retrieval_triggers:
  - "GPU loader fails too late"
  - "artifact ownership or extent ambiguity"
  - "need deterministic field-level rejection"
prerequisites: ["AFN-001", "AFN-002", "AFN-003"]
related_notes: ["AFN-005", "AFN-008"]
supersedes: []
audience: "Autonomous agents implementing fail-closed model loaders"
keywords:
  - model admission
  - fail closed
  - GGUF validation
  - GPU isolation
  - tensor ownership
  - Qwen4Exp loader
  - autonomous agents
---

A loader is not successful because it can find enough tensors to start a graph.

It is successful when it can prove that one exact artifact owns every byte and satisfies every policy before expensive or irreversible work begins.

For Qwen4Exp, Hebrus added a dedicated structural-admission binary before adding execution. The binary is CPU-only and test-hook-only. It admits one sparse miniature fixture, emits a machine-readable ownership report, and refuses generation.

Normal builds still register no Qwen4Exp physical profile.

## Ordered failure

Admission is intentionally ordered from cheap identity checks to deeper physical verification:

1. parse GGUF bounds with checked arithmetic;
2. require architecture and artifact profile IDs;
3. require source revision and inventory digests;
4. validate every scalar and array model constant;
5. bind tokenizer, template, vocabulary, regex, and special IDs;
6. classify every tensor as base, PLE, MTP, or vision;
7. require the exact text-artifact tensor identity set;
8. validate the ExpertMajor manifest and all 48×512 records;
9. validate the PLE manifest, geometry, hash identity, and extent;
10. enforce text-only and MTP-not-executed policy;
11. sort physical ranges and prove disjoint ownership;
12. only then permit future platform and memory admission.

The order is part of the interface. A bad family should not fail later as a missing tensor. An overlapping extent should not survive until an SSD read. A vision tensor in a text-only artifact should not become ignored padding.

## Exact metadata, including arrays

The loader does not infer identity from a few familiar dimensions.

It validates the 48-entry layer-type array, PLE primes and offsets, 64-bit hash seeds, rotary sections, sparse-index parameters, GR dimensions, router rules, source revision, tokenizer digest, template digest, and explicit exclusions.

Metadata type is also closed. An integer with the same printed value is not accepted when the schema requires an unsigned 64-bit value or an array of a specific element type.

This protects against a subtle class of converter bugs: values that survive JSON or command-line inspection but change representation in GGUF.

## One tensor, one role, one owner

The source inventory has four classifications:

| Class | Source tensors | Base-artifact policy |
|---|---:|---|
| Base | 1,294 | Required, subject to routed/PLE physical replacement rules |
| PLE | 137 | Collapsed into one embedded PLE extent |
| Vision | 333 | Explicitly excluded from text profile |
| MTP | 31 | Explicitly excluded and not executed |

The converter dry run consumes all 1,658 source identities exactly once. “Skipped” is legal only as a named exclusion whose bytes remain accounted.

At runtime, dense tensors, the ExpertMajor tensor, the PLE tensor, GGUF metadata, alignment padding, and file bounds are separate owners. Sorted spans must not overlap.

Page-rounded dense warm-up spans receive an additional check: they must not accidentally include the adjacent PLE payload. Otherwise a harmless-looking residency optimization could fault a huge lookup table into the primary working set.

## Negative fixtures as an API

The compact fixture generator can mutate one field at a time:

- family or profile;
- revision or digest;
- context, head dimensions, top-k, expert count, GR rank;
- layer pattern;
- one PLE prime, offset, row count, width, or hash version;
- tokenizer/template hash or special ID;
- tensor name, rank, shape, type, offset, or length;
- overlapping extents;
- missing/extra tensors;
- second store;
- canonical routed or PLE tensors that should have been replaced;
- vision/MTP policy;
- embedded manifest or page geometry.

Each negative asserts the intended diagnostic and proves that the process has not reached GPU allocation.

This is more than test coverage. It makes error ordering a stable contract for future agents. If a refactor changes “profile mismatch” into “tensor missing”, the test explains that the loader stopped failing at the cheapest authoritative boundary.

## Why the binary has no GPU symbols

“We do not call Metal” is weaker than “Metal is not link-reachable.”

The structural test binary is linked without GPU entry points, and the test inspects its unresolved symbols. That turns pre-GPU rejection from a control-flow intention into a build property.

It also keeps sanitizer runs small and deterministic. Artifact validation can be fuzzed without initializing devices, compiling kernels, or depending on host GPU state.

## Handoff to execution

The admission report includes exact owners and byte ranges but marks runtime and payload support false. Generation exits with a structural-admission-only diagnostic.

The future resident graph may consume the admitted descriptor. It may not reinterpret the file, guess a family, discover a sidecar, or weaken an equality because a kernel prefers a different shape.

That is the boundary:

```text
loader proves what the artifact is
graph proves that implementation matches the model
benchmarks prove whether the implementation is useful
release gates decide whether anyone may call it supported
```

Keeping those proofs separate makes autonomous work faster. Agents can change one layer of evidence without silently granting authority to the next.
