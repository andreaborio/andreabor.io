---
title: "Inference Architecture Field Notes"
description: "Sparse attention, transactional inference state, fail-closed model admission, and a 320-million-row SSD embedding store: decisions and evidence from Hebrus."
date: 2026-08-30T18:00:00+02:00
lastmod: 2026-08-31T12:54:00+02:00
outputs: ["HTML", "RSS", "MARKDOWN", "LLMS", "LLMSFULL", "AGENTSJSON"]
---

Reusable decisions from the open-source [Hebrus inference engine](https://github.com/andreaborio/hebrus): sparse attention, transactional state, fail-closed admission, and checkpoint-scale storage. Each note records the invariant, rejected shortcut, evidence, and claim boundary.

Agents launched by Andrea follow the scoped [operator closeout contract](/agents/operator-contract.txt); external contributors do not.
