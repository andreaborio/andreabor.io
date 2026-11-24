---
title: "Dotto, part 5: the first run, the voice and the glass"
date: 2026-11-24T09:04:00+01:00
description: "The functional spec, a first-run flow told by the character, the copy rules, and the evening the prototype grew a CRT, a depth layer and a test that only passes in daylight."
series: "Dotto making-of"
slug: "dotto-5-the-first-run-the-voice-and-the-glass"
---

With the name settled at 13:06 on Monday 23 November, the next job was to say what Dotto is. Four minutes later, at 13:10, the first functional spec was committed.

## The spec

It is short on features and long on principles. Five of them, paraphrased from `SPEC.md`:

1. **The clock is home.** You always return to it, with a swipe right or the side button.
2. **Dotto is not decoration; he communicates state.** He sleeps at night, shows low battery, wears headphones when music plays, has a look for the Party scene.
3. **Every action has physical feedback**: animation, a colour wave, haptics. No touch without an answer.
4. **Colour arrives only with a meaning** (scenes, apps), then the screen goes back to black and white.
5. **It works offline.** Time, timers and animations do. Integrations degrade politely ("the lights do not answer") and never block.

The spec also says the device works on its own with the home WiFi. The Mac is only needed for extras: the voice assistant and advanced CDJ data.

At 13:17:23 a spec commit made a WPS button the first way to set up WiFi. At 13:17:57, thirty-four seconds later, another removed it: WiFi is configured only through a QR code. I wish all my design decisions were reversed that quickly.

## A first run told by the character

The first-run flow landed at 13:51: Dotto's birth, WiFi through a QR code, the time, the lights (Hue, WiZ, Govee), a room game, Spotify, gestures, the end. The QR codes are real, made of dots by `setup/qr.js`. The room game: you run a finger along the rim, or drag up and down, and tap to choose which room a lamp that just blinked belongs to. Errors are told by Dotto with a way out: wrong WiFi password, Hue Bridge not found, a lamp that does not answer.

![Six first-run screens: "Ciao, sono Dotto", a WiFi QR code, a connecting screen, a wrong-password error, a Bridge-not-found error with two buttons, and the room game](/img/dotto/setup-preview.jpg "Six first-run screens from the preview sheet in the repo. The error screens are written as carefully as the happy path.")

## How Dotto talks

The copy guide is one page. Informal, direct, a friend who knows music and technology, neither a manual nor a comedian. Short sentences, one thing at a time. Second person. The real DJ vocabulary left untranslated: drop, build, bar, beat, key, deck. Data first: "8 bar al drop", not a sentence about when the drop will arrive. Jokes near zero. Fake things are said to be fake without drama: "Brani finti, è una demo."

The interface is in Italian, which is why the screens in this series are.

## The evening: glass, depth and a CRT

From 17:26 the work turned to the apps. Lights, Music, Timer and Options got the same layout template as the first-run flow, then rings and drags instead of hidden gestures.

![Timer, Music and Lights screens in the dot style](/img/dotto/apps-preview.jpg "Timer, Music and Lights, in the layout they share.")

At 19:35 the depth engine arrived. Every drawing lives on a plane: negative behind the glass, zero on the glass, positive in front. When you tilt the device, each plane slides in proportion to its depth, like an eye moving over a window. At full tilt a plane moves 3.2 px per unit of depth, which makes about 20 px between the farthest and nearest thing: enough to read as depth on a 44.5 mm display, never enough to blur. The response is soft, a tanh, so a few degrees already show and past 35° it saturates rather than hitting a wall. At 19:41 the typeface became Doto, a dot-matrix font.

Then the glass. A digital-rain glitch background went in at 22:31 and was gone at 22:40, in the commit that also adds a CRT effect. At 22:43 the pass became what it is now, modelled on the look of Balatro: barrel curvature, red and blue slipping apart toward the edges, bloom, soft scanlines, a slow roll, a warm tint, a faint flicker. In the prototype it is a WebGL pass over the finished frame. The header comment says what it becomes on the chip: nearly free on dots, because the bulge is applied to each dot's position before it is drawn, the colour slip and bloom are a tinted halo around each dot, and the scanlines are a static mask.

![The menu drum: a bulb costume on the character, the word "Luci", "Studio · 40% · Chill", "Musica" below it](/img/dotto/final-menu.jpg "The menu with the CRT pass on.")
![The Lights screen: a bulb icon, "Luci", "Studio · 40% · Chill"](/img/dotto/final-lights.jpg "Lights.")

Shortly before midnight the prototype was reorganised into modules, each with a header saying what it becomes in the firmware: base, type, render, state, screens, apps, the Pip engine, UI kit, depth, CRT, device. Altogether about 5,400 lines of JavaScript, plus the HTML shell. After midnight: fixed geometry in tables, deeper parallax, input from the phone's gyroscope, and the snap scroll.

## Snap scroll and a test that sleeps

The snap module has four rules, stated in its header:

1. Under the finger it is magnetic. The list slows near an item and hurries between two, so you feel each item go by.
2. Past the ends it gives like rubber, at most about a third of an item, instead of a wall.
3. On release the finger's speed decides. A slow release returns to the nearest item; a flick carries on one or two items, with the landing projected 160 ms ahead, as iOS does.
4. It lands on a slightly underdamped spring that starts with the finger's speed, with a hint of overshoot, settled in about 250 ms.

At 00:17 there is a one-command test script: three suites run in parallel, each in its own browser, about a minute to a minute and a half in total. The script sets the timezone so the tests run at a daytime hour. The comment explains why: from 23:00 Dotto sleeps, and the chase checks cannot pass. A character that goes to bed on schedule is lovely until the test suite is a night owl.

Twenty minutes later the first-run flow was redesigned on the current aesthetic, and the prototype was done enough to port. That is [part 6](/posts/dotto-6-porting-to-a-board-that-has-not-arrived/).
