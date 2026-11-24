---
title: "Dotto, part 1: the first screen was a no"
date: 2026-11-24T09:00:00+01:00
description: "A round 466×466 display, one written brief, and a first interface I rejected before the real work started."
series: "Dotto making-of"
slug: "dotto-1-the-first-screen-was-a-no"
---

This is the making-of of Dotto, a round desk object with a dot-matrix display and a small character living inside it. I am writing it from the git history, which is the one witness that does not remember things better than they were.

The numbers first. The repository has 101 commits across three branches, from Sunday 22 November, 17:05 UTC to Tuesday 24 November, 10:04 UTC. About 41 hours, most of them not spent typing. The code was written with Claude: the commits carry its co-author line. My part was the briefs, the screenshots, and saying no.

## The hardware

The target is a Waveshare ESP32-S3-Touch-AMOLED-1.75C: a round 466×466 AMOLED, capacitive touch, a six-axis IMU, a microphone, a speaker and a battery. It was meant to be a control surface for my home setup: lights (Hue, WiZ, Govee), music, and a beat display for CDJ-2000NXS2 decks. At this point it was still called the RoomGroove Puck, RG-01. The name Dotto arrives in part 4.

The board had not arrived yet. Everything in the first two days is a browser emulator.

## The screen that got a no

The first commit is a plan and an emulator, version 0.1. This is its clock screen.

![The first emulator screen: black face, white tick marks, a huge monospace clock, orange accents](/img/dotto/te-clock.jpg "Emulator v0.1. Flat, mono, uppercase labels, orange chips on black. It works. I did not want it.")

It borrowed the look of Teenage Engineering: flat, uppercase mono labels everywhere, orange chips on black. I rejected it, in words I will not reprint, and the next document in the repo says so in one line: do not propose that style again.

## The brief

What replaced it is a shared brief, `concepts/BRIEF.md`. The parts that mattered:

- **Material.** "Liquid, fluid and solid": matter with mass and weight, surfaces that flow. Not flat design with animation stuck on top.
- **The accelerometer as feedback.** When the object is in your hand, tilting it should move the UI (specular light, liquid levels, parallax, inertia) without being intrusive. Small amplitudes, damped springs, readability never compromised. On the desk the UI must be still and calm.
- **The same six screens in every concept**: clock, launcher, DJ, lights, music, voice. Same content, different material, so the concepts can be compared side by side.
- **A real budget.** The final UI would run on a 240 MHz dual-core ESP32-S3 with 8 MB of PSRAM, an RGB565 framebuffer, around 30 fps, no GPU and no shaders. Going beyond that for a bit of wow was allowed, as long as the concept marked what would be expensive.
- **Working rules for the builders.** One self-contained HTML file, no remote assets, UI text in Italian. At most one automated check, then fix and stop: no endless polish loops.

That last rule is the one I would keep on every project. A polish loop has no stopping condition except being tired.

Twenty-two minutes after the first commit, there were four concepts. That is [part 2](/posts/dotto-2-four-materials-and-a-drop-of-mercury/).
