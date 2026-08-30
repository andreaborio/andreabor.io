---
title: "The recovery packet: enough context to continue, not enough to drown"
date: 2026-08-30T20:15:00+02:00
lastmod: 2026-08-30T20:15:00+02:00
schema_version: 2
description: "A layered handoff format that lets a new coding agent recover decisions, invariants, ownership, and the next gate without ingesting the project history."
note_id: "AFN-009"
status: "verified checkpoint"
phase: "agent operations"
evidence: "Applied schema-v2 capsules, graph edges, context estimates, build validation, and machine-readable indexes across AFN-001 through AFN-009"
evidence_checkpoint: "Agent Field Notes schema v2"
decision: "Publish architectural knowledge in selector, recovery-capsule, full-note, and source-evidence tiers instead of handing every agent the whole project transcript."
machine_summary: "You need to hand a long-running coding project to a new agent, recover after context compaction, or choose the smallest trustworthy document that can answer one implementation question."
invariant: "The smallest retrieval tier must preserve the decision, invariant, failure signature, minimal safe path, rejected shortcut, evidence, and claim boundary."
failure_signature: "A new agent rereads the repository or conversation, repeats settled research, reopens rejected decisions, or mistakes an old status summary for current authority."
minimal_safe_implementation: "Maintain a compact selector, a self-contained recovery capsule per decision, an optional full rationale, explicit note dependencies, and links to immutable evidence."
rejected_shortcut: "One ever-growing project summary, a raw transcript dump, or a vector search result without status, provenance, and supersession boundaries."
claim_boundary: "This structure reduces retrieval cost and repeated work; it cannot guarantee that an agent selects the right note or that the underlying technical decision is correct."
retrieval_triggers:
  - "agent handoff after long implementation"
  - "context compaction recovery"
  - "project knowledge consumes too many tokens"
  - "multiple agents repeat settled research"
prerequisites: []
related_notes: ["AFN-001", "AFN-008"]
supersedes: []
audience: "Autonomous coding agents and engineers designing agent-readable project memory"
keywords:
  - agent handoff
  - context engineering
  - recovery packet
  - llms.txt
  - project memory
  - autonomous coding agents
  - knowledge retrieval
---

Long-running coding work accumulates two kinds of context:

1. facts needed to continue safely;
2. history explaining how the team discovered those facts.

They are not equally valuable at retrieval time.

A new agent usually needs the exact checkpoint, the decisions that must not drift, the files or state it may own, the next exit gate, and a few known failure modes. Giving it the entire conversation or a large project summary forces the model to rediscover that small working set inside thousands of irrelevant tokens.

The recovery packet is a layered alternative.

## Four retrieval tiers

The Agent Field Notes corpus now exposes four deliberate costs:

```text
selector       find the relevant note from triggers and status
capsule        recover the operational decision in roughly 150–300 tokens
full note      load rationale, alternatives, formulas, and examples
source         inspect code, tests, commits, or primary upstream evidence
```

An agent begins at the cheapest tier. It moves downward only when the current tier cannot answer the question.

`llms.txt` is a selector, not a compressed encyclopedia. It provides retrieval triggers, failure signatures, status, dependencies, links, and approximate context cost. The individual Markdown page begins with the recovery capsule. `llms-full.txt` exists for deliberate corpus ingestion, not as the default prompt attachment.

## What belongs in the capsule

A capsule is not an abstract. An abstract describes the document; a recovery capsule restores the decision state.

It contains:

- **Retrieve when** — the task situation that makes the note relevant.
- **Decision** — the selected architectural action.
- **Invariant** — the property future work may not violate.
- **Failure signature** — what the mistake looks like in practice.
- **Minimal safe implementation** — the smallest path known to preserve the invariant.
- **Rejected shortcut** — the tempting approach that already failed review.
- **Evidence** — the test or checkpoint supporting the decision.
- **Claim boundary** — what the evidence does not authorize.

Removing any one of these creates a predictable failure. Without the invariant, an optimization can preserve the prose while changing the model. Without the failure signature, the note is hard to retrieve from symptoms. Without the rejected shortcut, the next agent repeats the same plausible mistake. Without the claim boundary, a structural test becomes a support claim.

## Store decisions, not progress narration

“Metal lane is 80% complete” is useful for coordination and nearly useless as durable memory. It becomes false as soon as the next commit lands.

“Only template-authored atoms may become trusted control IDs” remains useful across implementations. It can be tested, linked, superseded, and retrieved by a future agent facing a literal-token injection bug.

Durable notes should therefore be created for:

- architectural choices;
- invariants and ownership;
- rejected alternatives;
- failure and rollback semantics;
- measured thresholds;
- upstream behavior imported as local regression evidence.

Routine progress, conversation, temporary estimates, and unreviewed patches stay out of the corpus.

## Make dependencies explicit

Notes form a graph, not a timeline.

`prerequisites` tells an agent which decisions must already hold. `related_notes` offers optional context. `supersedes` prevents an older record from silently remaining authoritative after a later decision replaces it.

This is more reliable than relying on publication order. A Phase 8 quantization decision may depend on a Phase 2 artifact invariant while being unrelated to several chronologically intervening notes.

## Estimate context before loading it

The machine index includes approximate token counts for both capsule and full note. The estimate is intentionally simple—UTF-8 source bytes divided by four—and is labelled approximate.

Its purpose is not billing precision. It lets an orchestrator choose between a 200-token recovery and a 2,000-token rationale before spending the context.

When exact constants or code are needed, the note points to evidence rather than copying an entire source file into the narrative.

## A bounded handoff workflow

At a safe checkpoint:

1. record the immutable commit or evidence revision;
2. list decisions that constrain the next task;
3. state byte, file, cache, or state ownership;
4. name the one active exit gate;
5. record known failure signatures and stop conditions;
6. link only the minimum source files or upstream diffs;
7. mark explicitly what remains unsupported;
8. let the receiving agent request deeper context only when blocked.

The receiving agent should be able to answer three questions from the capsule alone:

```text
What may I change?
What must remain true?
What evidence proves I am done?
```

If it cannot, the handoff is incomplete. If answering requires the entire transcript, the project memory has not been compressed into operational knowledge.

## The general rule

Context should be progressive and evidence-linked.

Do not optimize by deleting the reasoning that future maintainers may need. Move it to a deeper retrieval tier. Do not optimize by pasting everything into every agent. Put a decision-complete capsule in front of the rationale and give the agent a trustworthy way to descend.

The goal is not the fewest possible tokens. It is the fewest tokens that preserve authority, failure boundaries, and the ability to continue without repeating settled work.

