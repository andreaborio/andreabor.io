---
name: andreabor.io
description: Black glass, a dot grid and Doto dot-matrix display type; a plain system-sans reading column; Dotto the pixel mascot lives in the chrome.
colors:
  black-glass: "#000000"
  code-well: "#151515"
  hairline: "#2a2a2a"
  warm-ink: "#f2f2f0"
  muted-ink: "#a6a6a2"
  heat-red: "#ff7a6b"
  mint-agent: "#7fe0b0"
  mint-well: "#0e1713"
  selection-ember: "#3a1512"
typography:
  display:
    fontFamily: "Doto, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "4.4rem"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "0"
  headline:
    fontFamily: "Doto, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.7
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.88em"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "6px"
  lg: "9px"
  xl: "10px"
  full: "50%"
spacing:
  xs: ".35rem"
  sm: ".65rem"
  md: "1rem"
  lg: "1.6rem"
  xl: "2.75rem"
  section: "4rem"
components:
  nav-link:
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.lg}"
    padding: ".25rem .7rem"
  nav-link-current:
    textColor: "{colors.heat-red}"
  hero-link:
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.lg}"
    padding: ".45rem .75rem"
  hero-link-hover:
    backgroundColor: "#141414"
  code-block:
    backgroundColor: "{colors.code-well}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "1rem"
  agent-hero:
    backgroundColor: "{colors.mint-well}"
    textColor: "{colors.warm-ink}"
    padding: "1.45rem 1.6rem 1.25rem"
  machine-link:
    textColor: "{colors.mint-agent}"
    padding: ".34rem .55rem"
  agent-tag:
    backgroundColor: "{colors.mint-well}"
    textColor: "{colors.mint-agent}"
    padding: ".12rem .38rem"
  puck:
    width: "340px"
    height: "340px"
    rounded: "{rounded.full}"
---

# Design System: andreabor.io

## Overview

**Creative North Star: "The Device Under Glass"**

The site is a calm reading frame owned by a small object: Dotto's round dot-matrix display. Everything that is chrome (masthead, dates, section heads, rail, footer) is drawn as that device would draw it: dots, a CRT colour fringe, scanlines, a conic-metal bezel. Everything that is argument (articles, tables, code, Agents notes) is plain system-sans text on black glass. The frame carries personality, the column carries truth.

Density is low and rhythmic: one reading column at 820px, generous vertical gaps between sections (4rem), hairline rules instead of boxes. The world is dark only (`color-scheme: dark`), warm-white ink on near-black, with a single heat-red for links and dates and a mint reserved for the Agents section. The mascot is the only illustration: a 9-wide pixel creature drawn as SVG circles and animated purely with CSS `steps()`, so it moves like a display, never like a tween.

**Key Characteristics:**
- Black glass ground with a 14px dot grid at 5% white.
- Doto (self-hosted, weight 800) for display, dates, section heads and project names; system sans for reading; mono only for code.
- CRT fringe (cyan left, red right, soft white glow) on Doto text only.
- Hairline `#2a2a2a` rules; dotted rules for section breaks and quotes.
- Dotto in five poses (walk, idle, blink, sleep, dizzy) from one SVG sprite, stepped frame by frame.
- Mint Agents section inside the same frame, with square corners; its index and the home teaser are ruled single-column rows, never cards.
- No eyebrow labels above headings and no glyph arrows: headings stand alone and links are plain words.

## Colors

A near-monochrome ink-on-glass palette with one warm accent and one cool section accent; no gradients except the device's own bezel and glass.

### Primary
- **Heat Red** (#ff7a6b): all links, the current-nav state, post and Puck dates, focus rings, the text caret. The only accent on the open web of the site; it also colours the hover state of Agents row titles.

### Secondary
- **Agent Mint** (#7fe0b0): Agents content only (the section and its home teaser). Borders, labels, machine-readable links, tags, status chips, row meta lines, the dotted well texture (`rgba(127,224,176,.1)` grid lines, `.22` dots).
- **Mint Well** (#0e1713): fill behind Agents hero, briefing, Hebrus project block, tags and table heads.

### Neutral
- **Black Glass** (#0a0a0a): page ground and the knockout fill of featured grids.
- **Code Well** (#151515): code blocks, inline code, the Agents archive guide (blended at 30%).
- **Hairline** (#2a2a2a): the standard 1px rule: list rows (posts, projects, Agents), tables, bordered images, scope policy, nav hover.
- **Warm Ink** (#f2f2f0): text, headings, mascot fill.
- **Muted Ink** (#a6a6a2): ledes, meta, captions, inactive nav, "zzz".
- **Selection Ember** (#3a1512): text selection background.

Unnamed one-off greys are used for dotted rules and lifts (#444, #555, #666, #4a4a4a, #141414, #3a3a3a rail dots and scrollbar); they are texture, not tokens.

### Named Rules
**The Two-Accent Rule.** Heat red for the open site, mint for Agents; the two never share a component. The Hebrus project block is mint on all four sides (1px border on Mint Well), with no red edge.
**The Glass-Not-Paper Rule.** Surfaces are black or a near-black well. No white or cream panels, ever.

## Typography

**Display Font:** Doto (weights 100-900 variable, self-hosted woff2, latin and latin-ext), with ui-monospace fallback
**Body Font:** system sans (ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial)
**Label/Mono Font:** ui-monospace stack, code only

**Character:** a dot-matrix display voice for what the device says (names, dates, headings), set against an unremarkable system sans so long measurements stay readable. Root size is 18px (16px under 700px).

### Hierarchy
- **Display** (Doto 800, clamp(2.6rem, 8.5vw, 4.4rem), 1.02, 0 tracking): home H1, 9ch max, with fringe.
- **Headline** (Doto 800, 1.5rem, 1.15, -0.02em): section headings and page H1 (clamp 2.2-3.4rem, 22ch), with fringe. The Agents hero H1 (clamp 2.1-3.2rem, 13ch) and the Agents note H1 (clamp 2-3.2rem, 20ch) are also Doto 800 with fringe and no tracking. Headings stand alone: no kicker or eyebrow line sits above them.
- **Title** (system sans, 650, 1.15-1.25rem, 1.15): post links, card H3, article h3; h2 inside prose is 1.5rem.
- **Body** (system sans, 400, 1rem at 18px, 1.7): reading column capped at 68ch; ledes 1.1rem muted at 60ch; tabular numerals on.
- **Label** (system sans, 0.75-0.95rem, 400-700, no case transform): meta, nav, Agents status and facts, never below 0.75rem (13.5px).
- **Date** (Doto 800, 1rem, heat red): post-list dates; project names are Doto 1.15rem.

### Named Rules
**The Doto-Is-Chrome Rule.** Doto sets short strings (names, dates, headings, project names). Paragraphs, table cells and code never use it.
**The Fringe-On-Doto Rule.** The `--fringe` text-shadow belongs to Doto text only, never to sans body.

## Layout

A single centred column: `min(100% - 2rem, 820px)`. Home hero is a two-track grid (text `1fr`, Puck auto) with a clamp(1.5rem, 5vw, 3.5rem) gap; post and project rows use an 8.2rem date column and a flexible title column. Agents lists (featured, all records, and the home teaser) are single-column ruled rows with 1.1rem vertical padding and a hairline floor; each row's meta line is a flex-wrap line (note id, nowrap status chip, nowrap date) that wraps whole items. Agents fact tables are 2 columns (3 on a note). Vertical rhythm steps through .35 / .65 / 1 / 1.6 / 2.75 / 4rem; section blocks on home end at 4-4.5rem. Under 700px: root drops to 16px, header stacks, the Puck moves first at min(250px, 68vw) and the hero centres, hero pills tighten (`.4rem .55rem`, .85rem), post and project rows collapse to one column (date, title, blurb), and the Agents fact grids become one column.

## Elevation & Depth

Flat by default. Depth exists only as the physical device: the Puck's bezel carries a deep ground shadow (`0 50px 90px -30px #000`, `0 16px 28px -12px rgba(0,0,0,.7)`, a 1px inner top highlight) and the glass is vignetted and scanlined. Everywhere else depth is hairlines and tonal wells. Light is emitted, not cast: a 3px white drop-shadow glow on Dotto and the fringe glow on Doto text.

### Shadow Vocabulary
- **Fringe** (`text-shadow: -1px 0 rgba(80,200,255,.45), 1px 0 rgba(255,80,60,.45), 0 0 12px rgba(255,255,255,.16)`): Doto headings, dates, project names.
- **Phosphor glow** (`text-shadow: var(--fringe), 0 0 10px rgba(255,255,255,.3)`): the Puck title only, a brighter bloom than the standard fringe.
- **Dotto glow** (`filter: drop-shadow(0 0 3px rgba(255,255,255,.3))`): the mascot.
- **Bezel** (see above): the Puck only.

### Named Rules
**The Chrome-Only Scanline Rule.** Scanlines (`repeating-linear-gradient` 1px in 3px at .38 black) and the fringe appear on the Puck glass and Doto chrome text. The reading column, tables and code get neither.

## Shapes

Small, honest radii on controls and media (9px links and nav, 10px images, 6px code blocks, 4px inline code), a perfect circle for the device (Puck bezel and glass, 50%), and square 0-radius for the Agents section (hero, wells, briefing, Hebrus block, tags, machine links), with one exception in the build: the status chip carries a 6px radius. Bordered blocks (scope policy, Hebrus project) are full 1px boxes, not side bars. Rules are 1px solid hairlines, or 1px dotted (#444-#666) for section breaks, quote edges and the header rail. The dot is the recurring motif: 14px page grid, 8px rail dots, 11px Puck dots, 16px mint grid.

## Components

### Navigation
Doto site name at 1.5rem with fringe; plain nav links at .95rem, muted, 9px-radius with a transparent border. Hover shows the hairline border and full ink; current page shows the hairline and heat red. Under it, the **rail**: a 30px dotted strip with a hairline floor where a 22px walking Dotto strolls across over 36s in 90 steps, flipping at the midpoint.

### Hero links (buttons)
Outlined, not filled: 1px hairline, 9px radius, `.45rem .75rem` at .92rem (`.4rem .55rem` at .85rem under 700px), warm ink, no underline, no glyph arrow. Hover lifts the border to #4a4a4a and the fill to #141414 in .15s. There is no filled primary button.

### The Puck (signature)
A 340px round masthead: conic-grey metal bezel, 3px black inner ring, black glass with an 11px dot grid, vignette, scanlines and a faint red rim. It shows the latest post title (Doto with a phosphor-glow text-shadow, container-query sized, clamped to 5 lines) and its date in heat red; the title turns red on hover. Dotto sits on the rim inside an orbit layer that rotates once in 60s in 60 steps (one dot per second).

### Dotto (signature)
Nine-column pixel sprite from `data/dotto.json`, rendered as SVG circles (r=.43 on a 9x9 grid), shared via one `<use>` sprite sheet. Poses: walk (4 frames, .64s cycle), idle (blink every 5s), sleep (breathes 1px, 3s, footer with drifting stepped "z"), dizzy (sways +-3deg, 404). All motion uses `steps()`; reduced motion shows the first frame still.

### Post and project lists
Rows separated by 1px hairlines, `1.1rem` vertical padding; date in Doto heat red on the left, title in 650-weight ink that turns red on hover, blurb in muted .92rem. Project names are Doto with fringe. Agents rows (featured, all records, home teaser) use the same ruled single-column pattern without the date column: title in 650 ink, muted blurb, then a flex-wrap mint meta line (note id, nowrap bordered status chip, nowrap muted date) and optional mint tags.

### Prose, code and tables
68ch column, blockquote with a 2px dotted #666 left edge, code on Code Well with hairline border and 6px radius, tables with hairline cell borders, images in 10px hairline frames (single images capped at 560px, adjacent images form an auto-fit gallery).

### Agents shell
Mint-bordered square wells on Mint Well with a dotted mint texture (hero); a scope policy boxed in a full 1px hairline; the Hebrus project block (an h2 reading "Built in the open with Hebrus", a paragraph, a link row) boxed in a full 1px mint border on Mint Well; definition-table fact grids with mint hairlines (a note's id and status sit in this facts list, not above the heading); the retrieval capsule well; ruled single-column index rows (see lists); mint tag chips and bordered status chips; outlined machine links in mint; a dashed-mint note footer; and a collapsible archive guide.

### Footer
A hairline-dotted top border, Dotto asleep with stepped "zzz", then muted text and wrapping links.

## Do's and Don'ts

### Do:
- **Do** keep reading text in the system sans on #0a0a0a at 68ch; keep Doto to short strings.
- **Do** use heat red (#ff7a6b) for links, dates and focus (2px outline, 4px offset) outside Agents, and mint (#7fe0b0) inside Agents only.
- **Do** animate with `steps()` only (rail walk, walk cycle, orbit, breathe, sway, drift), and add every new animation to the reduced-motion block.
- **Do** use hairline `#2a2a2a` 1px rules and dotted rules for breaks; build depth from wells and the device, not from shadows.
- **Do** give any new dot texture a pitch from the existing set (8, 11, 14, 16px).
- **Do** keep body and functional text at or above 13.5px.

### Don't:
- **Don't** put scanlines or the colour fringe on article body, tables or code.
- **Don't** use cream or white panels, light mode, or card-grid blog layouts on the open site.
- **Don't** set body copy, tables or long strings in Doto, or body copy in monospace.
- **Don't** round Agents components, and don't use mint outside Agents content (its home teaser included).
- **Don't** render Agents or post indexes as cards: they are ruled single-column rows.
- **Don't** tween Dotto smoothly or add JavaScript for animation without a decision to add the canvas layer.
- **Don't** add eyebrow or kicker labels above headings, or glyph arrows on links. The build has none; the one small mint label that remains (the "Retrieval capsule" caption in the briefing heading row) is a caption beside a cost figure, not a pattern for new surfaces.
