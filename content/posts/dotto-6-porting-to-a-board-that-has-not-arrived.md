---
title: "Dotto, part 6: porting to a board that has not arrived"
date: 2026-11-24T09:05:00+01:00
description: "The firmware port to the ESP32-S3, a renderer that only paints what changed, the bugs the bit-exact check found, and every number I have, with what it does and does not prove."
series: "Dotto making-of"
slug: "dotto-6-porting-to-a-board-that-has-not-arrived"
---

The board is not here yet. Everything in this post was built and measured on a simulator and on QEMU, and I will say which is which every time a number appears. The estimate for the real chip at the end is exactly that: an estimate.

## The brief for the port

Early on Tuesday 24 November the request was to port the web prototype to the Waveshare ESP32-S3-Touch-AMOLED-1.75C: a 466×466 CO5300 panel on QSPI, 32 MB of flash, 8 MB of PSRAM. It had to feel fluid, natural and low-latency, and it needed an emulator because there was no board. The choices I made up front:

- a dot engine in C++, not LVGL (the original plan said LVGL 9);
- all the integrations;
- the CRT effect redone on dots;
- no haptics, with the click coming from the speaker.

The work is on a branch of the private repository. In order: the base of the port, the CRT on dots with strips written straight into RGB565, render, typography, depth and the Pip engine, then an SDL simulator that runs the clock, the menu, Lights, the DJ screen, Pip and the dynamite scene. Timer, Options and Music, then the first-run flow, with the home behind an interface that can be fake or real.

Then a platform layer for the ESP32-S3 (touch, IMU, power management, audio, non-volatile storage) with frames split over the two cores. The commit message claims about four times faster. I have no number behind that on hardware.

Then the real network: Hue through SSDP and the Bridge button, WiZ over UDP on port 38899, Govee's LAN API, Spotify with OAuth PKCE, Pro DJ Link beats on UDP port 50001, a WiFi captive portal, SNTP, `dotto.local` through mDNS, and over-the-air updates from GitHub Releases. Then the simulator and QEMU on macOS too.

## "The problem is algorithmic"

At that point it ran, and I could see it was slow. I said the problem was algorithmic, not a matter of tuning, and asked for an analysis and a plan before any optimisation. One surprise from the first look: the slowness I saw was the emulator's. QEMU had been slow with the previous version as well.

The design that came out of the analysis:

- **No full framebuffer.** 466×466×2 bytes is 434 KB. A display list of primitives is rasterised in strips and tiles, and each piece is painted while the DMA sends the previous one.
- **The CRT is applied per primitive**, not as a pass over the whole screen. The full-screen pass would have cost about 38 million instructions a frame.
- **Tiles of 32×24 pixels**, each with a 64-bit fingerprint, so only changed tiles are redrawn and sent.

The key discovery was a measurement. Counting changes by whole strips, 85% of the screen appeared to change every frame. By 32×24 tiles, only 21 to 47% did.

## What the bit-exact check found

Every optimisation was checked against one rule: incremental drawing must produce the same image as a full redraw. A flag in the simulator (`DOTTO_CHECK`) compares them, and a second test compares the cached dot stamps against direct computation. Three bugs came out of it:

1. **A fingerprint polluted by unused fields.** The digits were still but their fingerprint changed, because the canvas reuses cells and stale fields from earlier frames leaked into the hash.
2. **References to stamps that no longer existed**, when the cache was cleared twice in the same frame.
3. **99% of tiles marked dirty.** The parallax drift and the tilt of the lens were changing by ten-thousandths of a pixel, never stopping. They are now quantised to common steps of 1/64.

The direct computation uses the same quantisation as the stamps: radius to 1/16 px, centre to 1/8 px. The result is images identical to the bit with or without the cache, so the cache is purely a time saving. The glow was also made continuous. Before, it switched on as a step at the edge, and a difference of 1/30 px could flip a pixel.

Dead ends, for the record: dot stamps alone did not shorten the frame, because the real cost was blending in RGB565 (unpack and repack on every write) and redrawing everything. Tiles of 16, 48 and 64 px were within noise, so I kept 32. A global `-freciprocal-math` would break the bit-exactness. A memory of already-recorded dots would live in PSRAM, where a random access costs as much as recomputing. SIMD through the S3's PIE instructions was not needed yet.

One QEMU curiosity: during global constructors the S3's floating-point unit was off in the emulator, and the first float instruction raised a coprocessor exception. The fix was to enable it from an early system init function; a constructor with priority 101 was not early enough because of the ordering of `.ctors`.

## The numbers

Two caveats before the list. QEMU ran with `-icount shift=0`, where 1 µs of virtual time is about 1000 instructions: these are not real cycles. And the host figures come from an x86 machine, not from the chip.

- **QEMU, before optimisation:** a frame took 17,655 to 19,052 virtual µs, recording took 1,519 to 3,024 µs, and painting took about 0.6 s per core every 1.5 s.
- **QEMU, after the stamps:** about 15.5 ms of virtual time per frame; painting per core went from 630,646 and 598,350 µs to 505,230 and 476,404 µs every 1.5 s.
- **QEMU, final, steady state** (recording plus painting on core 0 and core 1, per frame, virtual µs): clock 1,601 + 1,362 and 668, with 12% of tiles redrawn; menu 972 to 1,113 + 1,160 to 1,225 and 1,011 to 1,150, 10%; Lights 1,599 + 1,198 and 1,146, 7%; music 1,403 to 1,421 + 853 to 950 and 759 to 780, 6 to 7%; timer 1,441 + 872 and 561, 5%. Transition frames reach about 3.6 million instructions per core.
- **Simulator on x86, steady state, averaged over 3 s:** rasterising one frame takes 0.265 to 0.395 ms for the clock, 0.43 to 0.52 ms for music and 0.13 to 0.15 ms for the menu, against 1.94, 2.32 and 1.48 ms before. Tiles redrawn: 7 to 21%. Transitions: 0.45 to 0.75 ms, from 0.5 to 1.2.
- **Pixels converted per frame:** clock from 27.8 k to 16.4 k, menu from 21 k to 9.4 k, music from 49 k to 41 k.
- **Stamps created per frame:** from 250 to 320 down to between 1 and 33 (timer and music).
- **The link to the panel:** 434 KB at 40 MHz QSPI takes 21.7 ms, a ceiling of about 46 fps. At 80 MHz it is about 11 ms. The board's TE pin on GPIO13 and the 80 MHz bus come from an open-source watch project, and the official repository confirmed the other pins (reset 1, chip select 12, clock 38, data 4 to 7, touch interrupt 11 and reset 2). Note that the 1.75 without the "C" has different pins.
- **Free internal RAM in QEMU:** 107 KB, then 88 KB with the lookup tables and buffers, then 69 KB with the screens open. That is why small allocations moved to PSRAM. I have not re-measured since.
- **Firmware image:** 0x18e4f0 bytes, about 1.56 MB, leaving 74% of a 6 MB partition free. Measured before the full network stack went in, and not re-measured.

## What these numbers do not say

They do not say how fast it runs on the chip. The QEMU figures are virtual and instruction-counted; the host figures are an x86 desktop; neither includes the real display bus, the real caches, or PSRAM latency.

My estimate for the real chip at 240 MHz is about 8 to 10 ms per frame in steady state, which would be 60 Hz, and about 25 ms in transitions, which would be 30 Hz. It is not verified. The board has not arrived.

The home-made profiler is the part I like best. QEMU's monitor can print registers, so the script samples the program counter of both cores through `info registers` and symbolises it, ROM included. One surprising 10% in the exception vector turned out to be an interrupt, not an exception.

When the board arrives, the first thing I will measure is whether the 8 to 10 ms is true. If it is not, this post gets corrected.
