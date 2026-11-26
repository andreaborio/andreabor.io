---
title: "Dotto, part 9: black is off and fingers are big"
date: 2026-11-26T22:02:00+01:00
description: "What changed in the design after the object was in a hand: pure black as a rule, seven concepts deleted, touch targets sized in millimetres, the rim as a dial, and a live preview that shows every change within seconds."
series: "Dotto making-of"
slug: "dotto-9-black-is-off-and-fingers-are-big"
---

Up to part 6 the design lived in a browser. On 26 November it moved to firmware that runs on glass. A lot of decisions that had looked like taste turned out to have a unit: millimetres, fps, or a percentage of black pixels.

## Black is not a colour on AMOLED

The rule in `AGENTS.md` is blunt: the background is always `BLACK`, `0,0,0`. No near-black fills, no vignettes, no tinted veil over the whole screen. A black pixel on an AMOLED is off. It hides the edge of the glass and costs no power, which is the reason the panel was chosen. Grey exists only as dots: the grid of unlit dots at 5% white, the relief of the big numbers, secondary text. The exceptions are flashes on purpose, like the white of an explosion, which last a moment.

The rule comes with a check you can run. I counted, on the 95 reference images the screen test compares against (`firmware/tests/golden`), the share of exact-black pixels inside the round glass, sampling every second pixel. It ranges from 74% on the DJ screen with the cover art to 97% on the lights setup, and averages 90.5%. The project notes say 71 to 93%, from a different set of images. Either way the point stands: a change that drops that number needs a reason.

![The DJ screen in the firmware: 126.0 BPM with a purple and orange cover disc behind it, four phrase dots, a title line, a small console with Dotto wearing headphones](/img/dotto/fw-dj.jpg "The DJ screen, the one with the least black: 74% on my count. The cover art is where the budget goes.")

## Seven concepts, deleted

At 09:31 the repository lost the abandoned directions from parts 2 and 3: mercury, iron, phosphor, drop, level, mass, step, plus the RG-01 emulator. Only the dot direction stays. The planning document was rewritten in the same minute to say what is true now: two boards, no Mercury, no LVGL, no earlier working names.

The browser prototype is frozen from 26 November. It stays as a record of how the design started. Nothing is ported back from it, and every design change is made in C++ and looked at in the simulator. I like this rule because it ends a duplicate: for two days there were two sources of truth and I was the one deciding which was right.

## Seeing a change in a second

The rule I care about most is not about the product. It is about how the work is done: the user must see changes almost in real time. The tool is `firmware/tools/live.sh`. It opens the simulator on a chosen screen and, every time a file under `core` or `sim` is saved, recompiles and reopens it, about a second later according to the commit. If the build fails it shows the error and keeps the previous version open. A second mode renders PNGs without a window, in under a second, for whoever is not looking at the simulator.

Two limits are written down so they are not negotiated each time. A step is one change you can see. Between two visible results there should be about ten minutes at most, and a task that needs longer is split. That applies to sub-agents too: their task ends with images, not with a summary.

## Fingers are big

The 1.43 has about 12.8 pixels per millimetre. Seen that way, the first touch targets were small. The pills were 68 px, about 5 mm. The two rows on the clock were 34 px tall, under 3 mm. The touch tolerance was 7 px, which is 0.55 mm and a lot less than a fingertip. The fix, commit `55c83ee`:

- targets at least about 96 px (7.5 mm), with 10 px between neighbours;
- the character is 96 px across instead of 72;
- previous and next on the cover are about 99 px wide;
- touch tolerance doubled to 14 px;
- the drawing did not change.

In the simulator `DOTTO_HITS=1` paints the touch zones, and every screen lists its zones in code, tested with the same routine the touch uses.

## The rim is the dial

The first idea was to turn the object. The IMU would read the rotation and use it as a knob. On the real board it was a bad idea: turning the object changed values and menus when you only meant to pick it up. It was removed on 26 November at 11:51. What replaced it is on the glass: run a finger along the rim and the value of the screen changes, clockwise for more. On Lights it is brightness in 5% steps, on Music volume, on Timer minutes, in Settings it moves sliders and lists, in the menu it scrolls. A three-dot mark follows the finger and a haptic click is reserved for every step, when the haptic motor exists. A swipe from the left edge toward the centre is always back.

![Lights with the rim dial turned up: the brightness number larger, a three-dot mark on the rim](/img/dotto/fw-rim-dial.jpg "Rim dial on Lights, from the screen test.")

Two quieter changes belong to the same family. A strong shake goes back one level, and a lift needs 0.35 g and 20° instead of 0.2 g and 8°, because a finger on the glass of an object on a table was enough to count as picking it up.

## The Lights screen, in section

For Lights I asked for four proposals and picked one, called "Room": a lamp hangs from the top, its cone of light reaches the floor in proportion to brightness, the furniture of the room (sofa, kitchen, bed) sits under it and Dotto stands beside. Off: no cone, Dotto sleeps. Party: a disco-ball shade and a checkered cone that changes on the beat. Focus: a narrow spot and Dotto reading with glasses.

![Lights, Studio: a lamp hanging over a cone of dots, a chair, a small Dotto, 80%, a candle icon and CHILL](/img/dotto/fw-lights-room.jpg "Studio at 80%, scene Chill.")

The reason it won is partly beauty and partly arithmetic. The previous layout was about 1,490 primitives and redrew about 36% of the tiles. The new one is about 714 and redraws 16%. That is the criterion the project uses for any effect: how many rectangles of the screen does it force you to redraw.

## The phone side, in the same language

The pages Dotto serves to a phone (WiFi setup, Spotify login, rooms, Govee) were rewritten twice in a day to look like the screens: black ground, a faint dot grid, titles in a 5×7 dot font as inline SVG, networks listed like a drum with one to four signal dots. All inline, because Dotto's own network is offline: no fonts or CDNs, each page under about 9 KB, forms that work without JavaScript. The Spotify app is Dotto's own, with the public Client ID in the firmware (PKCE, no secret), so the phone is only used to log in.

And a smaller, nicer fix: that morning, a pass on duplicates replaced near-identical colours (differences of 1 to 11 units per channel) with a single token in `tokens.h`. Colours and durations are written once, in one file.

Next, [part 10](/posts/dotto-10-sleep-a-battery-and-what-i-could-not-check/): what happens when nobody is touching it.
