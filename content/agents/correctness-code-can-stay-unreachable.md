---
title: "Correctness code can exist without becoming a product feature"
date: 2026-08-30T20:56:00+02:00
lastmod: 2026-08-30T20:56:00+02:00
schema_version: 2
description: "Phase 5 links a resident graph coordinator and real Metal correctness kernels, yet normal Hebrus execution still rejects Qwen4Exp at physical-profile admission."
note_id: "AFN-013"
status: "verified checkpoint"
phase: "5"
evidence: "The host coordinator and Metal partition compile and pass model-free gates while remaining unselected; normal builds expose no physical profile, server route, downloader entry, or support claim"
evidence_checkpoint: "Hebrus 0626603"
decision: "Link the reviewed correctness implementation behind an unreachable test seam, while keeping product admission fail-closed until artifact, memory, quality, and performance gates qualify an execution route."
machine_summary: "You need realistic integration and hardware tests for a new backend or model family without accidentally advertising, auto-selecting, or accepting it in production."
invariant: "Passing private host or accelerator correctness tests cannot make the model selectable through normal loader, server, downloader, or support metadata."
failure_signature: "A test-only kernel is linked, generic dispatch discovers it, and users can reach an unqualified artifact or backend because compiled code was mistaken for a support contract."
minimal_safe_implementation: "Separate correctness symbols from product registration, require an absent physical profile or capability selector to reject normal execution, and test both the positive private seam and negative public route."
rejected_shortcut: "Using a hidden command-line flag, undocumented alias, or optimistic architecture match to expose code before the release evidence exists."
claim_boundary: "Phase 5 proves tiny model-free host and physical-Metal semantics only; real checkpoint parity, codec choice, SSD streaming, memory fit, throughput, server, downloader, and release support remain disabled."
retrieval_triggers:
  - "test backend accidentally exposed in production"
  - "compiled code mistaken for supported feature"
  - "staged model-family rollout"
  - "fail-closed product registration"
prerequisites: ["AFN-004", "AFN-008"]
related_notes: ["AFN-001", "AFN-010", "AFN-011"]
supersedes: []
audience: "Autonomous coding agents and maintainers staging new runtime capabilities"
keywords:
  - Hebrus
  - staged rollout
  - capability admission
  - Metal correctness
  - pinned not supported
  - product safety
  - Qwen4Exp
draft: false
---

## Decision

Compilation is not capability.

Hebrus Phase 5 links a resident Qwen4Exp graph coordinator and a dedicated Metal correctness partition. They can be exercised by focused tests on a real device. Normal execution still has no Qwen4Exp physical profile and therefore fails during admission before graph allocation.

The same separation applies above the runtime: there is no server alias, downloader entry, release artifact, or support-table promotion.

## Why linking the code is useful

Keeping all correctness work in an isolated prototype delays integration defects. The code needs to encounter the real build, symbol boundaries, Metal source assembly, ownership conventions, and regression suite before artifact choices are frozen.

But integration creates a second risk: generic architecture dispatch or fallback matching may discover a half-qualified path. A plausible output is especially dangerous because it can turn a research implementation into an undocumented public API.

## Two independent gates

The safe structure has both:

1. a private positive seam proving that the host coordinator and Metal primitives work;
2. a public negative seam proving that ordinary product selection cannot reach them.

The second test is not redundant. It verifies the absence of capability, not the correctness of implementation.

In Hebrus the missing production physical profile is the fail-closed boundary. Later phases must deliberately add artifact identity, codec bindings, memory policy, quality and performance evidence, and product metadata before that boundary changes.

## Language matters

Status labels should describe the reachable contract:

- **implemented** can mean code exists;
- **correctness fixture** means a bounded test seam passes;
- **pinned-not-supported** means normal users still cannot select it;
- **supported** requires the declared product and hardware gates.

Collapsing these states into “works” makes documentation itself a release bug.

## Agent checklist

When staging a new model family or accelerator path:

1. name the private entry point used by correctness tests;
2. name the public selector that must remain absent or rejecting;
3. test both independently;
4. keep server, downloader, aliases, and support tables unchanged;
5. state exactly which later evidence authorizes promotion;
6. rerun established families whenever shared dispatch changes.

## Failure boundary

The Phase 5 Metal fixture uses deterministic small F32 arrays. It does not load the production checkpoint or prove that a release artifact fits, runs quickly, survives long sessions, or matches expected quality.
