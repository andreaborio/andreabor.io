---
title: "Unicode is part of the model contract"
date: 2026-08-30T19:22:00+02:00
lastmod: 2026-08-30T19:22:00+02:00
description: "A tokenizer-class reconstruction dropped combining marks, while Jinja trimming followed Python semantics beyond common C whitespace helpers."
note_id: "AFN-007"
status: "verified checkpoint"
phase: "4"
evidence: "Pinned tokenizer.json backend, Devanagari divergence capture, Unicode trimming fixture, independent offline regeneration, and C99 parity tests"
decision: "Treat tokenizer.json and the captured Python/Jinja Unicode behavior as executable authority instead of approximating them with tokenizer-class defaults or locale-dependent C helpers."
machine_summary: "You are porting a Python tokenizer or chat template into a native runtime and need to identify Unicode behaviors that disappear under reconstructed regexes, ASCII trimming, or locale-sensitive functions."
claim_boundary: "The oracle closes the tested tokenizer and template semantics for the pinned revision; it is not a general Unicode library or a promise about future upstream revisions."
audience: "Autonomous agents porting tokenizers and templates from Python to native runtimes"
keywords:
  - Unicode tokenizer
  - combining marks
  - tokenizer.json
  - Jinja trim
  - Python str.strip
  - native runtime parity
  - Qwen4Exp
---

Unicode bugs in an LLM runtime rarely announce themselves as Unicode bugs. They appear as different token IDs, a shifted prompt boundary, or a model that is inexplicably worse in one language.

Qwen4Exp exposed two separate traps during the model-free text bring-up.

## The tokenizer class was not authoritative

The checkpoint ships an exact `tokenizer.json`. Loading that file through the pinned Transformers `TokenizersBackend` produces a pre-tokenizer expression that includes combining marks:

```text
[\p{L}\p{M}]+
```

Reconstructing the tokenizer through the pinned Qwen2 `AutoTokenizer` path omitted `\p{M}` from the relevant expression. That changes how Devanagari letters and their combining marks are grouped before BPE.

Both paths look official. Both load the same repository. Only one matches the serialized tokenizer artifact.

Hebrus therefore freezes the file-backed backend as authority and records the reconstruction divergence as a negative fact:

```text
authority                    = tokenizer.json
AutoTokenizer authoritative = false
normalization                = NFC
```

The runtime implements the exact expression rather than a nearby “GPT-style” regex.

## Trimming was wider than C whitespace

The chat template uses Jinja trimming, which delegates to Python string behavior. Python's `str.strip()` covers Unicode whitespace and also removes the ASCII information separators U+001C through U+001F at the edges.

Common native approximations are insufficient:

- `isspace()` is locale-sensitive and operates on byte-sized values;
- trimming only ASCII space, tab, CR, and LF misses valid cases;
- a Unicode White_Space table alone misses Python's information separators;
- byte-wise reverse scanning can split a multibyte code point.

The native renderer decodes UTF-8 boundaries, applies an explicit Python-compatible predicate, and trims only complete code points from the two edges.

The fixture combines Unicode whitespace and information separators in one case so that replacing the predicate with a conventional helper changes the rendered bytes.

## Why “valid UTF-8” is not enough

Two runtimes can accept the same input as valid UTF-8 and still disagree about:

- normalization;
- pre-tokenizer grouping;
- which code points count as leading or trailing whitespace;
- replacement behavior for invalid sequences;
- byte fallback;
- embedded NUL handling.

Every disagreement can change the prompt token sequence. Full-model parity cannot repair a text pipeline that feeds different IDs into layer zero.

The tokenizer oracle therefore includes multilingual text, combining marks, invalid UTF-8 replacement, embedded NUL, special-token literals, and raw-versus-trusted control behavior. The chat oracle separately freezes trimming and serialized output bytes.

## Capture upstream, check offline

The golden vectors are captured with pinned versions of Python, Transformers, tokenizers, Jinja, and the checkpoint files. Provenance records the public source hashes and package versions.

Normal testing does not depend on the network or those packages. An independent standard-library transcription regenerates the canonical fixture offline, and the C implementation must match the frozen outputs.

This gives two useful failure modes:

- upstream capture drift says the external authority changed;
- offline or C drift says the local transcription changed.

Conflating the two would make a fixture refresh capable of approving its own bug.

## General rule for agents

When porting a tokenizer or template across languages:

1. identify the serialized artifact that actually defines behavior;
2. record any disagreement with convenience constructors;
3. freeze normalization, regex, trimming, and invalid-byte behavior explicitly;
4. include scripts and languages that require combining marks;
5. include code points at the edge of each host language's whitespace rules;
6. compare token IDs and exact rendered bytes, not only decoded text;
7. keep the upstream capture path separate from the offline checker.

“Unicode support” is not one checkbox. For an LLM, Unicode preprocessing is part of the numerical function because it decides which integers enter the graph.

