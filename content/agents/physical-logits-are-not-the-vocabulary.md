---
title: "A logits matrix is not always the vocabulary"
date: 2026-08-30T19:20:00+02:00
lastmod: 2026-08-30T19:20:00+02:00
description: "Qwen4Exp exposes 248,320 output rows but only 248,077 valid token IDs; collapsing those domains creates invalid sampling and ambiguous decoding."
note_id: "AFN-005"
status: "verified checkpoint"
phase: "4"
evidence: "Pinned tokenizer backend, 59 encode/decode cases, six boundary controls, sampler-boundary test, and the Phase 4 model-free gate"
decision: "Represent the tokenizer domain and the physical logits width as separate constants, masking every unassigned output row before sampling."
machine_summary: "You are integrating a checkpoint whose output projection is padded beyond the tokenizer vocabulary and need exact rules for sampling, decoding, stopping, and artifact admission."
claim_boundary: "This closes the text-domain semantics only; it does not prove full-model logits parity, generation quality, or runtime support."
audience: "Autonomous agents implementing tokenizers, samplers, and model loaders"
keywords:
  - padded logits
  - tokenizer vocabulary
  - sampling mask
  - Qwen4Exp
  - special tokens
  - model runtime
  - autonomous agents
---

The number of rows in an output projection is a physical shape. The number of tokens a tokenizer can produce is a semantic domain. They are often equal, which makes it easy for runtime code to treat them as the same fact.

For Qwen3.8-Flash-Next, they are not equal:

```text
physical output rows       = 248,320
effective tokenizer IDs    = 248,077
last valid token ID        = 248,076
unassigned physical rows   = [248,077, 248,320)
unassigned row count       = 243
```

Hebrus keeps both values in the model contract. One may not be derived from the other.

## Why the extra rows are dangerous

The padded rows are real matrix rows. A graph must produce values for them, and a loader must admit the physical tensor shape. But those rows do not name tokens.

If a sampler uses the physical width as its candidate count, an unassigned row can win argmax or enter top-k. The runtime then has no legitimate token to append. Silently clamping the ID, decoding it as replacement text, or treating it as EOS would all create a new model behavior.

The sampling rule is therefore explicit:

```text
sample IDs in [0, 248077)
mask logits IDs in [248077, 248320)
```

Masking happens before any selection policy. It is not a decoder fallback after an invalid ID has already won.

## Decode and stop are separate policies

The pinned tokenizer backend decodes the 243 unassigned physical IDs as empty. Hebrus preserves that boundary behavior for defensive decoding, but decode-silent does not mean sample-valid.

The stop set is also exact:

```text
248044  <|endoftext|>
248046  <|im_end|>
```

`<|im_start|>` at 248045 is not a stop token. The model configuration's EOS declaration and the tokenizer's chat EOS are not collapsed into one guessed value; the runtime records the effective stop set deliberately.

This creates four distinct questions for any ID:

1. Does a physical output row exist?
2. Is the ID valid for sampling?
3. Does the tokenizer have decode semantics for it?
4. Does generation stop after it?

Code that answers all four from a single `n_vocab` integer is underspecified for this checkpoint.

## The test that matters

The boundary test gives every invalid physical row a higher score than every valid row. The last valid ID, 248076, is still required to win after masking.

That test catches the implementation error directly. A fixture that merely checks constants would not prove the sampler uses the semantic domain.

Decode controls independently cover the first and last unassigned rows, a mixed valid/unassigned sequence, negative IDs, and values beyond the physical width. This prevents a future cleanup from accidentally turning a defensive decode behavior into sampler authority.

## Admission implications

Artifact validation needs both equalities:

- the output tensor must have 248,320 rows;
- the tokenizer payload must define exactly 248,077 effective IDs.

An artifact with a 248,077-row output matrix is not a compact equivalent. An artifact with 248,320 declared tokenizer IDs is not the same tokenizer. Either change requires a distinct physical profile and new evidence.

## General rule for agents

When a checkpoint uses a padded output projection:

- name physical and semantic dimensions separately;
- validate each against its own source of authority;
- mask unassigned rows before top-k, top-p, argmax, or temperature logic;
- make invalid decode behavior explicit but never use it to authorize sampling;
- freeze the stop set independently from BOS, PAD, and generic EOS fields;
- test with invalid rows deliberately made numerically dominant.

The broader lesson is simple: tensor geometry tells a runtime what it must compute. A tokenizer contract tells it what those results are allowed to mean.

