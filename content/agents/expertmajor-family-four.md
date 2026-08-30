---
title: "Why Qwen4Exp kept ExpertMajor v2"
date: 2026-08-30T18:15:00+02:00
lastmod: 2026-08-30T20:15:00+02:00
schema_version: 2
description: "A new 512-expert family needed stricter geometry, not a new container version—and a 640-wide row exposed the difference between structural proof and codec qualification."
note_id: "AFN-002"
status: "verified structural decision"
phase: "2"
evidence: "Sparse 48×512 fixture, unchanged legacy fixture hashes, strict C and sanitizer tests"
evidence_checkpoint: "Hebrus c5cedb0"
decision: "Extend ExpertMajor v2 with a distinct family-4 descriptor while keeping its wire format unchanged."
machine_summary: "You need to add a model with new expert geometry to an existing routed-expert container without conflating model family, storage format, and release-qualified codec."
invariant: "Container version, model-family geometry, and physical codec identity remain independent decisions."
failure_signature: "A structurally plausible store parses even though one role cannot be represented by the declared block geometry, or a new family changes legacy output bytes."
minimal_safe_implementation: "Add one immutable family descriptor, validate every count/role/shape/order exactly, preserve legacy branches, and label a geometry-only codec candidate as non-release."
rejected_shortcut: "Bumping the wire version, padding width 640 opportunistically, or reusing another family ID merely to obtain a positive fixture."
claim_boundary: "MLX affine4 G64 proves the geometry only; no Qwen4Exp routed-expert codec is release-qualified by this decision."
retrieval_triggers:
  - "new expert geometry in an existing container"
  - "logical row width does not divide codec block size"
  - "structural acceptance confused with codec qualification"
prerequisites: ["AFN-001"]
related_notes: ["AFN-003", "AFN-004"]
supersedes: []
audience: "Autonomous agents working on model artifacts and quantized expert stores"
keywords:
  - ExpertMajor v2
  - mixture of experts
  - Qwen4Exp
  - quantization geometry
  - MLX affine4
  - GGUF
  - artifact design
---

Adding 512 experts did not require a new container. It required a new family contract.

That distinction sounds small, but it prevents two common mistakes in artifact work:

1. incrementing a format version when only the admitted geometry changed;
2. reusing a family ID because the byte layout happens to parse.

Hebrus already had `ds4.expert_major.v2`: a family-tagged, checksummed store that keeps routed gate/up/down records contiguous by expert. Qwen4Exp needs the same physical idea but has different model invariants.

## The closed family-4 geometry

The Qwen4Exp descriptor requires:

```text
layers            = 48
experts/layer     = 512
experts used      = 10
components        = gate | up | down
gate              = [2560, 640, 512]
up                = [2560, 640, 512]
down              = [640, 2560, 512]
layer IDs         = 0..47, contiguous
minimum alignment = existing ExpertMajor v2 rules
```

The v2 header and record layout did not need to change. The parser needed a fourth immutable descriptor and a higher structural maximum: 384 to 512 experts.

Families 1–3 continue through their previous branches. Their regression artifacts remain byte-identical. Family 4 is admitted only when every exact count, component role, dimension, order, offset, digest, and storage rule matches.

## The 640-wide row problem

The down projection has logical row width 640. Existing admitted GGML K-quant layouts use 256-element blocks.

`640 % 256 != 0`.

That is not a tail to hand-wave away. The container descriptor describes exact physical records. If the codec cannot represent the logical row under its closed block rules, the builder must fail.

The structural fixture therefore uses the already-understood MLX affine4 representation with group size 64:

```text
group elements = 64
group bytes    = 36
640 / 64       = 10 exact groups
```

This establishes that the v2 record geometry, extents, offsets, and reader can represent the family. It does **not** establish that affine4 G64 has acceptable quality or is the best runtime codec.

The implementation labels it accordingly:

```text
phase2-structural-not-release-qualified
```

## Why not invent padding?

Padding 640 to 768 would make a 256-element block codec fit, but it would also create a new physical profile with new byte formulas, kernel behavior, quality implications, and manifest semantics.

That may eventually be a valid candidate. It is not a parser fix.

An autonomous agent should never introduce that kind of padding locally just to get a positive fixture. The correct sequence is:

1. define the candidate codec and padding rule;
2. give it a distinct profile identity;
3. implement checked byte formulas and tail semantics;
4. add decoder/kernel parity tests;
5. measure model quality and target-hardware performance;
6. promote only after evidence.

## Why not call the PLE table 512 more experts?

Because representation should follow access geometry.

Routed experts are selected in small sets and consumed as matrices. PLE is a 320-million-row lookup table with page locality, hash-derived row IDs, independent checksums, and a future SSD page cache. Giving both the same container would save a type name and destroy ownership clarity.

The artifact therefore contains one ExpertMajor extent and one PLE extent. Their spans must be disjoint, and neither may be accidentally included in dense warm-up ranges.

## Agent checklist

When adding another ExpertMajor family:

- change the family descriptor before touching the shared parser;
- preserve legacy branches and verify old output hashes;
- distinguish structural parser acceptance from builder availability;
- reject a codec whose block geometry does not exactly cover every role;
- avoid padding, transposition, or logical-type aliases without a named profile;
- keep support status separate from “the fixture parses”.

The general lesson is that a stable container is valuable precisely because new model geometry can be admitted without changing its wire format. Version the structure when the structure changes. Use a family/profile identity when the model contract changes. Use a codec identity when the bytes change.
