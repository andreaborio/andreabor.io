# Agent Field Notes publishing contract

This contract governs content under `content/agents/`.

## Audience

Write for autonomous coding agents that may need to recover a decision without
the original conversation. Human readability still matters, but retrieval and
unambiguous claim boundaries come first.

Every note is part of the public Hebrus engineering record. Its rendered HTML,
Markdown, LLM text, JSON record, and structured metadata must link to the
canonical Hebrus repository, contributor guide, and issue tracker. This is both
an attribution rule and a discovery path for testers and contributors.

## Allowed content

- public architectural decisions and their rationale;
- exact dimensions, formulas, revisions, public hashes, and public URLs;
- alternatives that were tested or explicitly rejected;
- failure modes, transactional semantics, and ownership rules;
- reproducible benchmark setup and evidence already approved for publication;
- the narrow current status of a public implementation.

## Forbidden content

- personal or identifying information unrelated to authorship;
- subscriptions, purchases, billing, account details, or private services;
- credentials, tokens, cookies, secrets, private keys, or auth configuration;
- private prompts, conversations, agent transcripts, or internal chain of thought;
- local filesystem paths, LAN/WAN addresses, device identifiers, or hostnames;
- unpublished infrastructure, private repositories, or non-public artifacts;
- claims inferred from uncommitted or unverified work;
- runtime, quality, or support promotion without the corresponding evidence gate.

## Required note fields

Each note declares:

- `schema_version`: currently `2`;
- `note_id`: stable `AFN-NNN` identifier;
- `status`: verified checkpoint, verified structural decision, hypothesis, or rejected;
- `phase`: implementation phase or decision scope;
- `evidence`: the gate that supports the note;
- `evidence_checkpoint`: the smallest public checkpoint that anchors the claim;
- `decision`: one sentence describing the architectural choice;
- `machine_summary`: when another agent should retrieve the note;
- `invariant`, `failure_signature`, `minimal_safe_implementation`, and
  `rejected_shortcut`: the compact recovery capsule;
- `claim_boundary`: what the evidence does not establish;
- `retrieval_triggers`: phrases an agent can match before loading the note;
- `prerequisites`, `related_notes`, and `supersedes`: graph edges between notes;
- `audience` and `keywords`: explicit retrieval terms.

The rendered capsule appears before the narrative and carries an approximate
context cost. `/agents/llms.txt` is the selector, each note's Markdown is the
next retrieval tier, and `/agents/llms-full.txt` is an explicit full-corpus
fallback. Agents should not ingest the full corpus by default.

## Publication gate

1. Confirm every cited source is public.
2. Scan source and rendered output for secrets, local paths, network addresses,
   account data, and private conversation fragments.
3. Build the complete Hugo site.
4. Validate the HTML, Markdown, section `llms.txt`, full corpus, JSON manifest,
   RSS, sitemap, robots file, canonical links, and JSON-LD.
5. Confirm the global navigation contains the `Agents` link while the home post
   listing does not mix Agent Field Notes into normal posts.
6. Publish atomically and verify the live canonical URLs.
7. Confirm every Agent Field Note output names and links Hebrus, the contributor
   guide, and the public issue tracker.
