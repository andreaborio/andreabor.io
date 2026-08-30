---
title: "Close the text pipeline before asking the model"
date: 2026-08-30T19:23:00+02:00
lastmod: 2026-08-30T20:15:00+02:00
schema_version: 2
description: "Phase 4 used pinned captures, independent regeneration, native tests, and 153 contract mutations to close tokenizer and chat semantics before a runtime graph existed."
note_id: "AFN-008"
status: "verified checkpoint"
phase: "4"
evidence: "59 tokenizer cases, six decode controls, 39 chat cases, 153/153 contract mutations rejected, sanitizer and full model-free regression gates"
evidence_checkpoint: "Hebrus fcfd5de"
decision: "Make tokenizer and chat behavior independently executable and mutation-tested before using full-model output as the debugging oracle."
machine_summary: "You are sequencing a new model-family integration and need a test hierarchy that isolates text-pipeline failures before checkpoint-backed graph parity."
invariant: "Prompt bytes, token IDs, errors, and trust provenance are closed before layer or final-logit parity is allowed to diagnose the graph."
failure_signature: "One differing model response leaves tokenizer, template, graph, state, quantization, kernel, and sampler defects equally plausible."
minimal_safe_implementation: "Combine pinned upstream captures, independent offline regeneration, native parity tests, labelled contract controls, and fail-closed mutation testing."
rejected_shortcut: "Using a plausible full-model answer as the first oracle or letting a fixture generator approve its own implementation."
claim_boundary: "These model-free gates do not contain checkpoint weights or prove layer, logits, quality, Metal, SSD, memory, or performance parity."
retrieval_triggers:
  - "full-model mismatch has too many possible owners"
  - "tokenizer or template fixture design"
  - "mutation-testing a model contract"
prerequisites: ["AFN-001"]
related_notes: ["AFN-005", "AFN-006", "AFN-007", "AFN-009"]
supersedes: []
audience: "Autonomous agents planning staged LLM runtime bring-ups"
keywords:
  - tokenizer oracle
  - chat template oracle
  - mutation testing
  - model bring-up
  - Transformers parity
  - Qwen4Exp
  - autonomous agents
---

Full-model output is a terrible first oracle for a new runtime.

If the answer differs from Transformers, the cause may be tokenization, chat rendering, special IDs, graph math, state layout, quantization, kernels, cache transitions, or sampling. One failing string tells an agent almost nothing about which layer owns the defect.

Phase 4 of the Qwen4Exp bring-up closes the text pipeline while execution is still disabled.

## The evidence stack

The tokenizer gate contains:

```text
59 pinned text encode/decode cases
 6 explicit decode-boundary controls
33 exact added-token identities
 1 closed effective-vocabulary/physical-logits boundary
```

The chat gate contains:

```text
34 pinned Transformers render or error captures
 5 Hebrus text-only contract rejections
39 total cases
```

Together they cover default and explicit reasoning effort, disabled thinking, preservation of prior reasoning, system-role cardinality, tools, grouped tool results, insertion-ordered UTF-8 JSON, literal control tokens, structured-media rejection, Unicode trimming, invalid inputs, and transactional output preservation.

The wider frozen Qwen4Exp contract now rejects 153 out of 153 deliberate mutations. That total spans identity, source pins, inventory, tensor roles, layer types, derived constants, PLE geometry, expert-store geometry, graph facts, admission, tokenizer, chat, and licensing boundaries. It is not presented as “153 chat tests”; it is the mutation count for the complete contract after Phase 4.

## Four different authorities

The oracle hierarchy keeps four kinds of evidence distinct:

1. **Pinned upstream captures** establish what the selected public Transformers revision does.
2. **Independent regeneration** checks that the fixture is not merely a dump produced by the implementation under test.
3. **Native C tests** establish parity and failure semantics in Hebrus.
4. **Contract controls** define behavior that upstream does not own, such as trust provenance, text-only rejection, rollback, and deterministic boundaries.

A fixture records the origin of each case. Contract controls are not labelled as upstream output, and upstream behavior is not silently replaced because a native approximation is easier.

## Why model-free first

The tokenizer and renderer need no checkpoint allocation, Metal device, SSD cache, or 64 GB machine. Their gate is fast enough to run under sanitizers and in the normal regression suite.

This changes the debugging tree for the first resident graph:

```text
prompt bytes differ?       -> chat oracle
token IDs differ?          -> tokenizer oracle
embedding input differs?   -> graph boundary
layer output differs?      -> primitive or graph implementation
final logits differ?       -> graph, state, or numeric policy
sample differs only?       -> sampler boundary
```

Without the first two closed nodes, every later mismatch remains ambiguous.

## Mutation tests are stronger than happy paths

A positive fixture proves one accepted object works. A mutation battery proves the validator notices which facts make it that object.

Phase 4 adds mutations for tokenizer authority, normalization, regex, added-token mappings, valid vocabulary size, physical width, stop IDs, template defaults, trimming, segment kinds, structured-media policy, oracle counts, and fixture digests.

The important property is fail-closed behavior. A changed digest cannot be accepted because the visible cases still happen to pass. A changed count cannot be ignored because the array looks plausible. A flattened trust boundary cannot hide behind byte-identical rendering.

## What the checkpoint does not claim

No weights are loaded by these tests. They do not establish:

- BF16 or quantized layer parity;
- the resident Metal graph;
- sparse QSA kernels;
- PLE SSD streaming;
- expert codec quality;
- long-context state behavior;
- memory admission;
- tokens per second;
- product or server support.

The family remains `pinned-not-supported`. The value of Phase 4 is not that the model can answer. It is that, when the first graph answers incorrectly, two entire classes of causes have already been removed from the search space.

## General rule for agents

Before building a full-model oracle:

- close prompt rendering and tokenization independently;
- pin upstream implementations and serialized assets;
- preserve exact bytes, IDs, errors, and trust metadata;
- give policy decisions their own contract-labelled cases;
- regenerate fixtures independently and offline;
- mutate every identity field and semantic boundary;
- keep support status false until later gates earn it.

The fastest autonomous implementation is not the one that reaches a plausible answer first. It is the one that makes each wrong answer cheap to localize.
