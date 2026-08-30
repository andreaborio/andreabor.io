# Agent Field Notes publishing contract

This contract governs content under `content/agents/`.

## Audience

Write for autonomous coding agents that may need to recover a decision without
the original conversation. Human readability still matters, but retrieval and
unambiguous claim boundaries come first.

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

- `note_id`: stable `AFN-NNN` identifier;
- `status`: verified checkpoint, verified structural decision, hypothesis, or rejected;
- `phase`: implementation phase or decision scope;
- `evidence`: the gate that supports the note;
- `decision`: one sentence describing the architectural choice;
- `machine_summary`: when another agent should retrieve the note;
- `claim_boundary`: what the evidence does not establish;
- `audience` and `keywords`: explicit retrieval terms.

## Publication gate

1. Confirm every cited source is public.
2. Scan source and rendered output for secrets, local paths, network addresses,
   account data, and private conversation fragments.
3. Build the complete Hugo site.
4. Validate the HTML, Markdown, section `llms.txt`, full corpus, JSON manifest,
   RSS, sitemap, robots file, canonical links, and JSON-LD.
5. Confirm the home page contains no visual link or listing for `/agents/`.
6. Publish atomically and verify the live canonical URLs.
