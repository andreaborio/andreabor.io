---
title: "Rendered chat is not a flat string: preserve provenance"
date: 2026-08-30T19:21:00+02:00
lastmod: 2026-08-30T20:15:00+02:00
schema_version: 2
description: "A byte-identical control-token spelling can be trusted template syntax or untrusted client data; flattening before tokenization destroys that distinction."
note_id: "AFN-006"
status: "verified checkpoint"
phase: "4"
evidence: "39-case chat oracle, literal-control adversarial cases, segmented tokenizer adapter, transactional failure tests, and the Phase 4 model-free gate"
evidence_checkpoint: "Hebrus fcfd5de"
decision: "Render chat as one byte stream plus contiguous DATA and TRUSTED_CONTROL segments, then tokenize every segment according to its provenance."
machine_summary: "You are implementing a chat template with special tokens and need to prevent user, system, or tool text from being reinterpreted as template-authored control syntax."
invariant: "Only template-authored atoms can become trusted control IDs; caller data remains data even when its bytes spell the same token."
failure_signature: "Flattening and retokenizing promotes a user, system, or tool literal such as <|im_end|> into template syntax."
minimal_safe_implementation: "Return one byte stream plus complete contiguous provenance segments, validate coverage, and tokenize DATA and TRUSTED_CONTROL independently and transactionally."
rejected_shortcut: "Escaping suspicious characters or flattening the rendered transcript and trying to reconstruct trust from its spelling."
claim_boundary: "The segmentation boundary prevents control-token promotion in the text pipeline; it does not sanitize tool behavior or grant runtime support to the model."
retrieval_triggers:
  - "chat template mixes controls with client text"
  - "literal special-token injection"
  - "tool output contains protocol markers"
prerequisites: ["AFN-001"]
related_notes: ["AFN-007", "AFN-008"]
supersedes: []
audience: "Autonomous agents implementing chat templates, tokenizers, and tool-message adapters"
keywords:
  - chat template security
  - control token provenance
  - prompt injection boundary
  - tool messages
  - Qwen4Exp
  - tokenizer
  - autonomous agents
---

A rendered chat transcript looks like a string. Treating it as only a string is a security bug.

Consider the bytes:

```text
<|im_end|>
```

When the template emits them, they delimit a message. When a user types the same bytes inside a question, they are ordinary content. The spelling is identical; the authority is not.

If a renderer concatenates everything and then runs one trusted tokenizer pass, client text can acquire the semantics of template syntax. The runtime has erased the only information that could prevent promotion.

## The representation

The Qwen4Exp chat renderer returns:

1. one ordered UTF-8 byte stream for inspection and logging;
2. a complete, gap-free sequence of segments over those bytes;
3. one kind for each segment: `DATA` or `TRUSTED_CONTROL`.

Adjacent segments of the same kind are merged. Every segment must be non-empty, begin exactly where the previous one ends, and collectively cover the full stream.

Template-authored markers such as these are controls:

```text
<|im_start|>
<|im_end|>
<think>
</think>
<tool_call>
</tool_call>
<tool_response>
</tool_response>
```

Conversation content remains data, even if it contains any of those literal spellings.

## Tokenize the segments, not the flattened bytes

The adapter validates the segment geometry first. It then tokenizes each contiguous segment independently:

- `DATA` goes through the ordinary NFC, pre-tokenizer, and BPE path;
- `TRUSTED_CONTROL` may resolve exact special-token atoms.

The resulting token arrays are appended transactionally. If a segment is malformed, a control is unknown, UTF-8 handling fails, or allocation fails, the caller's prior token output is preserved.

Flattening the bytes and tokenizing them again as trusted is forbidden. The rendered string is useful for observability; it is not a substitute for the provenance stream.

## Why escaping is the wrong abstraction

One possible response is to escape `<`, `>`, or the pipe character in client text. That changes user content, code snippets, shell output, and tool results. It also assumes every dangerous control can be recognized with a lexical filter.

Provenance is stronger because it does not depend on guessing whether data looks suspicious. Data stays data by construction.

This is especially important for tool output. A tool may legitimately return source code or model text containing closing tags and chat markers. The renderer must preserve the bytes without granting them template authority.

## Adversarial cases

The Phase 4 oracle includes literal controls in:

- user content;
- system content;
- tool results;
- structured text that spells a media token.

The tests assert that the client occurrence remains `DATA` while the actual template delimiter is `TRUSTED_CONTROL`. The tokenizer integration then proves that only the latter becomes a special ID.

Structured image, image-URL, and video parts are rejected before rendering because the current artifact is text-only. A literal `<|image_pad|>` inside normal text remains legal data; it does not smuggle a media part into the request.

## Transactionality matters here too

Chat rendering allocates a replacement output and commits only after full validation and rendering. An invalid request does not partially overwrite a previously valid transcript or segment array.

This turns errors such as a second system message, an unsupported role, malformed tool arguments, or structured media into clean failure states. Downstream code never receives a half-rendered trust map.

## General rule for agents

Whenever a protocol mixes control syntax and caller-controlled text:

- carry provenance beside bytes until semantic parsing is complete;
- do not recover provenance by rescanning the flattened representation;
- validate complete, contiguous ownership of the byte stream;
- make trust promotion an explicit API, not a tokenizer heuristic;
- preserve caller outputs on rejection;
- test identical spellings under both trusted and untrusted origins.

This is not a Qwen-specific trick. It is a general rule for structured prompts: syntax is not defined by appearance alone. It is defined by who was allowed to create it.
