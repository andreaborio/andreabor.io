---
title: "Dotto, part 7: this site stopped being only about inference"
date: 2026-11-26T22:00:00+01:00
description: "How andreabor.io went from text-only field notes on local LLM inference to the home of a dot-matrix character, in two commits, and what I kept plain on purpose."
series: "Dotto making-of"
slug: "dotto-7-this-site-stopped-being-only-about-inference"
---

Parts 1 to 6 told the story of the object. This one is about the page you are reading, because it changed too, and the order of events is worth writing down.

## What the site was in August

The first commit in this repository is from 30 August. The site was a Hugo project with no JavaScript, no trackers and no external fonts. Its content was three kinds of thing:

- a few posts about local inference: running a large model on a 64 GB Mac, re-quantizing a local model, and a post saying why the blog exists ("the useful part of an experiment usually happens after the screenshot");
- an `agents/` section: about twenty short decision records about the Hebrus inference engine, written so that an autonomous agent can pick up a project without the whole history;
- About and Now pages, in the same flat tone.

Between 30 and 31 August there are fourteen commits, almost all of them agent notes. After that, nothing for almost three months. The site was a notebook and I treated it as one.

## Two commits on 24 November

On 24 November the history changes subject. Commit `29f3b8d` adds the six making-of posts, nineteen screenshots and a copy of the browser prototype under `/dotto/play/`. A few hours later, at 23:37, commit `2908a39` redesigns the whole site around the character. It touches 20 files: 817 lines added, 336 removed.

What changed, from the commit message and the design notes:

- **The ground is black glass**, `#0a0a0a`, with a dot grid, the same idea as the device.
- **Doto**, the dot-matrix typeface the device uses, is served from the site: two woff2 files, about 3.9 KB and 5.4 KB. No request to Google.
- **Dotto lives in the chrome.** He walks the rim of a round masthead on the home page, sits on the header rail, sleeps in the footer and is dizzy on the 404 page.
- **The animation is CSS only**, with `steps()` timing so it moves like a sprite and not like a tween, and it is switched off under `prefers-reduced-motion`.

## What I did not touch

The reading column is plain system sans. The agent notes keep their structure: ruled rows instead of cards, no decorative labels, nothing functional under 11 px. The design notes put it as a principle: the character carries the personality, the text carries the truth, and Dotto animates the chrome, never the argument.

That is a constraint I wrote down because I could feel the temptation. A site that is mostly dense tables of benchmark notes does not need a mascot in the middle of a table.

The rules that existed before still hold, with one sanctioned exception. The site has no JavaScript, apart from `/dotto/play/`, which runs the prototype and loads Geist and Doto from Google Fonts. It is a demo, it says so, and nothing else on the site depends on it.

The machine-readable outputs (per-page Markdown, `llms.txt`, the JSON manifest, RSS, sitemap) were part of the brief as a parity requirement: a visual change must leave them intact.

## An honest inconsistency

The site's black is `#0a0a0a`. The device's black, as part 9 explains, is `0,0,0` and nothing else. On a monitor the difference is invisible. On an AMOLED panel one is a pixel that is off and the other is a pixel that is glowing a little. The site borrowed the look, not the physics.

## Still open

The name. "Dotto" is a pun between *dot* and the Italian *dotto*, and the project notes say plainly that a trademark check is needed before any public release. It has not been done. The site was published on 24 November and the series is live, but the name is a working name until that check happens.

Next, [part 8](/posts/dotto-8-the-board-arrived-and-the-ram-ran-out/): the board.
