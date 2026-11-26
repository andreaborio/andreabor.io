# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Engineers and makers who read measured, reproducible work: people running or building local LLM inference (Apple Silicon, Metal, quantization, SSD streaming), contributors to open-source inference projects, and visitors who arrive through search or an LLM answer and need to decide in seconds whether Andrea's work is credible. The site is also the place where everything Andrea builds is meant to be found, not only the LLM work. Confirmed by the user: the reader is "everything I build", so the site must serve the inference reader and the visitor who came for another project.

## Product Purpose
andreabor.io is Andrea Borio's personal site and field notes: what ran, what stalled, and which promising idea got slower when measured properly. It holds the blog posts, a separate "Agents" knowledge base of inference-architecture decision records for the open-source Hebrus engine, About and Now pages, and (new) the Dotto making-of series with a live prototype. Success is a reader who trusts the claims, can reproduce them, and finds the project they came for.

## Positioning
Claims stay narrower than the evidence: every post keeps commands, measurements, failures and caveats together, and says what a result does not prove. The site is built to be read by humans and by retrieval systems alike (Markdown alternates, `llms.txt`, JSON manifest, RSS).

## Operating Context
Hugo static site deployed to Vercel from the generated `public/` directory. Content is Markdown. Publishing includes IndexNow notification for changed URLs. Outputs that must keep working: HTML, per-page Markdown, `/llms.txt`, `/llms-full.txt`, `/agents/index.json`, RSS, sitemap, robots. Posts are written in English; the Dotto prototype interface is in Italian.

## Capabilities and Constraints
- Sections: Posts, Agents (Hebrus field notes), About, Now, plus the Dotto series and `/dotto/play/` demo.
- Analytics: Vercel Web Analytics only (cookie-free, added 26 Nov 2026 at the owner's request). No other trackers. No external fonts: the typeface Doto (OFL, from Google Fonts) is downloaded and served from the site (confirmed by the user).
- JavaScript: the site has been no-JS. The first redesign pass is CSS-only; a small canvas for animation is an open, later decision. `/dotto/play/` already requires JS and loads Geist and Doto from Google Fonts; it is the one sanctioned exception.
- Body text of articles must stay clean and readable: the Agents notes contain dense tables and code.
- Open decision: which projects besides Hebrus and Dotto are linked prominently (forgequant, benchy, ds4 fork, abliterate, Velo and others exist).
- Open decision: a trademark check for the name "Dotto" before any public release; not done.

## Brand Commitments
Dotto (the pixel character that lives on the round dot-matrix display) is the mascot of the whole site, confirmed by the user. The visual identity of the redesign takes its dot-matrix, CRT and animation language from the latest Dotto prototype (`static/dotto/play/`). Voice: concrete setup first, measurable details, restrained humour, plain claims. Site name: Andrea Borio.

## Evidence on Hand
- Existing content: 3 posts, 22 Agents notes, About, Now; six Dotto making-of posts on the branch `dotto-making-of`.
- 19 screenshots under `static/img/dotto/`; the prototype source under `static/dotto/play/` (pip engine, CRT pass, depth engine, dot renderer, Doto typography).
- No testimonials, customers, download counts or benchmarks of the site itself exist; none are to be invented.

## Product Principles
1. Evidence before decoration: nothing on the page may make a measurement harder to read or a caveat easier to miss.
2. The character carries personality, the text carries truth: Dotto animates the chrome, never the argument.
3. Machine-readable parity: every visual change must leave the Markdown, `llms` and JSON outputs intact.
4. Small and fast: static, no trackers beyond Vercel Web Analytics, no runtime dependencies beyond what a page needs.

## Accessibility & Inclusion
Keep the current commitments: skip link, visible keyboard focus, semantic navigation, readable at narrow widths, long code lines scroll instead of breaking the layout. Respect `prefers-reduced-motion` for every animation, and keep body and functional text at a comfortable size (no functional text under 11px).
