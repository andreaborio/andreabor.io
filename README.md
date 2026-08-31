# andreabor.io

A text-only Hugo site for Andrea Borio.

## Content policy

- The original site copy was rewritten against Andrea's published voice: concrete setup first, measurable details, restrained humour, and claims kept close to evidence.
- `Why this blog exists` is the only new editorial post in this version.
- Existing Substack posts are imported from the public RSS feed with their original title, publication date, links, code, and body text.
- Substack signup widgets and images are omitted to keep this site text-only. Each imported post links back to its original page.

## Local development

```sh
hugo server
```

Production build:

```sh
hugo --minify
```

The output is written to `public/`. The site has no JavaScript, trackers, external fonts, or runtime dependencies.

Production publishing uses the existing Vercel project linked inside the local
generated `public/` directory:

```sh
hugo --minify --cleanDestinationDir --panicOnWarning
cd public
npx --yes vercel@latest deploy --prod --yes
```

The deployment must report the production alias `https://andreabor.io`, after
which the canonical HTML, Markdown, `llms.txt`, JSON, RSS, sitemap, and robots
routes are verified live.

## Search and LLM discovery

The site publishes `robots.txt`, `sitemap.xml`, RSS, semantic article metadata, a clean Markdown alternate for every page, `/llms.txt`, and `/llms-full.txt`. Search and user-directed retrieval bots from OpenAI, Anthropic, and Perplexity are explicitly allowed. Training crawlers remain governed by the hosting provider's Content Signals policy. These files make the site easier to retrieve and cite; no file can guarantee inclusion in a model or search index.

`/agents/` is a separate agent-native knowledge base. It publishes a concise
`/agents/llms.txt`, a complete `/agents/llms-full.txt`, Markdown variants, RSS,
TechArticle JSON-LD, and `/agents/index.json`. The global navigation exposes it
as **Agents**, while the home content remains focused on the normal post feed.

## Agent Field Notes policy

Agent Field Notes contain public architecture only: reviewed technical choices,
alternatives, invariants, failure boundaries, reproducible evidence, and public
source references. They must never contain personal information, subscriptions,
account details, credentials, secrets, private prompts or conversations, local
paths, network addresses, or unpublished infrastructure.

Every note must declare `note_id`, `status`, `phase`, `evidence`, `decision`,
`machine_summary`, `claim_boundary`, `audience`, and `keywords`. Hypotheses and
structural-only results stay labelled; a note may not manufacture a runtime or
support claim from incomplete work.

Agents explicitly launched by Andrea use
`/agents/operator-contract.txt` as their phase-close rule. It requires a
decision-delta review while leaving external contributors outside that personal
operator policy.

## Refresh the Substack archive

```sh
python3 scripts/import_substack.py
```

The importer reads `https://andreaborio.substack.com/feed` and updates `content/posts/`.
