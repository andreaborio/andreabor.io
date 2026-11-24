---
title: "Dotto, part 3: everything is a dot"
date: 2026-11-24T09:02:00+01:00
description: "One grid of dots for the whole screen, why a dot is a good unit for a chip without a GPU, and the first thirty minutes of the direction that stuck."
series: "Dotto making-of"
slug: "dotto-3-everything-is-a-dot"
---

By [08:59 on Monday 23 November](/posts/dotto-2-four-materials-and-a-drop-of-mercury/) the dot-matrix concept existed. In the next half hour it picked up most of what the final design still has.

![The first dots concept: a dot-matrix clock on black glass](/img/dotto/punti-first.jpg "The first Punti commit's emulator. The panel next to it was a column of buttons for forcing each state.")

## The rule

The prototype's own sidebar states the rule in two sentences, and I have not improved on it: one grid of dots for the whole screen, numbers change dot by dot, and only what changes moves. The CSS comment adds the colour logic: white light on black glass, one red for heat, the rim carries signal and the centre carries numbers, and every dot sits on the same grid.

Within the first half hour the commits add:

- **08:59** a hand-drawn dot font, a drum menu, and two animations called Caduta (fall) and Rullo (roll);
- **09:01** the seconds marker hops from dot to dot, and at the minute change it falls into the digits;
- **09:06** a menu with only the entries, no status line;
- **09:19** body text in Mona Sans, or small dot text, with the date and info curved along the rim, on a larger grid;
- **09:22** a layout with the battery at 12 o'clock and a small date window at 6;
- **09:28** the date pixel-perfect on a sub-grid, and simulated haptic feedback: a tick, a confirmation, a hit.

The haptics did not survive. The spec still asks for a linear resonant actuator, but when the firmware was ported the decision was no haptics at all, with clicks from the speaker instead ([part 6](/posts/dotto-6-porting-to-a-board-that-has-not-arrived/)).

## Why a dot is a good unit

The brief said the UI would run on a chip with no GPU, and a dot is about the cheapest thing such a chip can draw repeatedly. The engine header written later spells out the mapping: one pre-rendered dot sprite, blitted with a recolour, nothing per pixel. A character pose is at most 11×10 cells, a mask in flash. Text is cells. Even the CRT effect in [part 5](/posts/dotto-5-the-first-run-the-voice-and-the-glass/) is designed to be nearly free on dots: the barrel distortion moves each dot's position before it is drawn, instead of warping a full-screen image.

I want to be careful here. This is the design intent written in the code, and the later port measured it on an emulator only. Whether the dots are cheap on the real panel is a question for the day the board arrives.

## What it looks like now

This is the same clock after another day of work: the Doto typeface, a CRT pass, a depth layer, and the character from [part 4](/posts/dotto-4-a-character-that-lives-on-the-rim/).

![The current clock face: a battery icon at the top, a date in a pixel typeface with a CRT fringe, a small character on the rim](/img/dotto/final-clock.jpg "The current prototype, one frame of an animation, with the time still assembling out of dots.")

You can play with the prototype on this site: [open the live Dotto](/dotto/play/). The interface is in Italian, and the panel on the right lets you force the states that otherwise need patience: the minute change, the chase, the night.
