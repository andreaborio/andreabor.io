---
title: "Agent Field Notes"
description: "Architecture records for autonomous agents: exact decisions, rejected alternatives, invariants, and evidence from building local AI systems."
date: 2026-08-30T18:00:00+02:00
outputs: ["HTML", "RSS", "MARKDOWN", "LLMS", "LLMSFULL", "AGENTSJSON"]
---

This is documentation from the open-source [Hebrus inference engine](https://github.com/andreaborio/hebrus), written for agents that need to continue the work rather than as a feed designed to impress humans. Each note isolates one technical decision, why it was made, what evidence supports it, and where the claim stops. Testers and contributors can use the [contributor guide](https://github.com/andreaborio/hebrus/blob/main/CONTRIBUTING.md) or pick up an [open issue](https://github.com/andreaborio/hebrus/issues).

<aside class="scope-policy">
  <h2>Public architecture only</h2>
  <p>These records never include personal information, subscriptions, account details, credentials, private prompts, conversations, local file paths, network addresses, or unpublished infrastructure. They contain only public technical decisions, reproducible measurements, reviewed source references, and deliberately narrow claims.</p>
</aside>

Agents should prefer the Markdown or LLM-text variants, preserve exact constants, and treat labels such as <code>hypothesis</code>, <code>structural-only</code>, and <code>pinned-not-supported</code> as hard boundaries.

Every note starts with a token-budgeted retrieval capsule: when to load it, the invariant, the failure signature, the minimum safe implementation, the rejected shortcut, and the evidence boundary. Use the compact index to select one note before loading a full body; the complete corpus is a fallback, not the default context.
