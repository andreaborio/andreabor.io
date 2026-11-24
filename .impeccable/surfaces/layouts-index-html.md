---
version: 1
slug: "layouts-index-html"
primary_target: "layouts/index.html"
related_targets: ["static/css/style.css","layouts/_default/baseof.html"]
---

# Surface brief: andreabor.io home and site frame

## Scope and mode
Mode: Read. Surfaces: the home page and the site-wide frame (header, footer, 404, article shell, Agents shell). Article and Agents reading columns stay calm; only the frame carries the world.

## Audience, job, proof, constraints
Readers of local-LLM inference notes and visitors looking for anything Andrea builds (Hebrus, Dotto, forgequant, benchy, ds4 fork). Job: trust the work, find the project. Proof on hand: real posts, 22 Agents notes, the Dotto series and live demo. No JS in this pass; CSS-only animation; fonts self-hosted; machine-readable outputs untouched.

## Chosen direction and memorable moment
World pinned by the user: the latest Dotto prototype (black glass, dot grid, Doto typeface, CRT fringe, scanlines, the pixel mascot). Structure chosen by the user from the roll: the Puck as masthead. Memorable moment: a round dot-matrix display on the home page where Dotto walks the rim one dot per second, like the second hand in the prototype.

## Unresolved
Whether a small canvas (JS) layer adds the Pip engine later. Which extra projects get prominent links. Trademark check for "Dotto".

## Direction contract
THESIS: The site is a calm reading frame owned by Dotto's device; ruled lists, never a grid of cards, on the home and in the Agents index: dot-matrix and CRT live in the masthead, dates and section heads; the article column is plain text on black glass. It refuses the stock dev blog: monospace body, cream paper, a grid of cards.
OWN-WORLD: Black glass ground #0a0a0a, warm white ink, one heat red (#ff7a6b) for links and the date glow, a mint for the Agents section. Doto dot-matrix for display, dates and labels; a system sans for reading; mono only for code. Components are dot grids, round bezels, hairline #272727 rules, Dotto's 9x8 pixel poses drawn as SVG dots; scanlines and a red/cyan fringe only on chrome.
STORY: The visitor sees a living object, understands this is a person who builds hardware and inference engines and writes down what ran and what stalled, and reaches Posts, Agents, Dotto or a project in one move.
FIRST VIEWPORT: Left: the H1 "I play with LLMs." in Doto at display size, three lines of plain intro (the column is about 40 characters wide beside the Puck), and a row of four links: Posts, Agents, Dotto series, Live Dotto. Right: a 340px round Puck, bezel in conic grey, a dot grid inside, the latest post title and date in Doto, Dotto stepping around the rim once a second. Mobile: the Puck first at 260px, then the text.
FORM: Puck as masthead, structure 7 on my ordered list of 7, dealt by the roll and locked by the user; seed:fa3643e8568fcc13.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
