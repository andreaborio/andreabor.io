---
title: "Dotto, part 8: the board arrived and the RAM ran out"
date: 2026-11-26T22:01:00+01:00
description: "First contact with the 1.43 inch board: a black screen with 6.9 KB of RAM left, a reboot caused by a script that never cleaned up, and the changes that took the clock from about 40 to about 53 fps."
series: "Dotto making-of"
slug: "dotto-8-the-board-arrived-and-the-ram-ran-out"
---

Part 6 ended with an estimate for a chip I did not have. This part has the chip. It also has a change of plan: the board on the desk is the Waveshare ESP32-S3-Touch-AMOLED-1.43, not the 1.75C. Same 466×466 round AMOLED, touch and IMU, but with an RTC, a microSD slot and a battery connector, and no microphone and no speaker. The firmware targets both, and the differences sit under one compile flag, `CONFIG_DOTTO_BOARD_143`.

A note on sources. The numbers below come from the commit messages of 26 November, which quote the board's own log (a line every 1.5 seconds with fps, record and paint time, and tiles redrawn). I did not re-measure them for this post.

## A checklist before the first boot

On 25 November a brief was written for whoever would plug the board in. It lists twelve checks, in order: boot and PSRAM, display ID and centring, fps screen by screen, touch, IMU orientation, the BOOT button, battery, first run, and so on. Two rules in it survived the day: the 1.75C build must keep compiling, and nothing in the shared `firmware/core` changes without a reason.

Some hardware facts were verified on the schematic first, and the list is short enough to quote: the display's tearing-effect line is GPIO42, touch interrupt is IO7, BOOT is IO0, the battery goes through a 200k/100k divider into IO4, the IMU is at address 0x6B. Nothing about a microphone, because there is none.

## Zero frames

The first real problem was not slow. It was black. The log said there were 6.9 KB of internal RAM left before the tasks were created, the paint and UI tasks did not start, and the screen drew nothing: 0 frames. The fix, commit `0f577ed`, is a list of small thefts returned:

- allocations under 4 KB went to internal RAM; now only those under 512 bytes do, the rest goes to PSRAM;
- the main task had a 16 KB stack and used 2; it now has 4 KB;
- the two HTTP tasks and the statistics task keep their stacks in PSRAM;
- WiFi buffers cut to 8 receive and 8 transmit, and WiFi code out of IRAM;
- one DMA strip per painter instead of two, 23 KB each.

Result: 55 KB of internal RAM free after the tasks, and the setup screens at 57 to 58 fps. A task that fails to start now says so in the log.

Eleven minutes later the same class of bug came back in another form. With the home WiFi connected, internal RAM fell to 4 KB and the hardware AES could not find its DMA buffer, so HTTPS requests failed. mDNS and the DNS task of Dotto's own network moved to PSRAM and AES went to software. About 24 KB stays free after connecting.

A third version of it showed up at 14:07 as reboots in the middle of the dynamite scene. Scripts of the form "wait until it arrives" reschedule themselves every 60 ms, and the scene never removed the events that had already run. Internal RAM drained to about 120 bytes and the board restarted. The fix is two lines of logic: delete executed events, cap the cache at 12 entries and free it at the end of the scene.

## From 40 to 53 fps

Then speed. The changes, in the order they landed:

- **IRAM for the three hot functions.** `paintTile`, `packTile` and `stampDot` touch every pixel. The rest of the code runs from PSRAM through a 32 KB cache that the rasteriser's loops kept missing. Putting those three in IRAM cut the time per tile from about 200 to 140 µs, roughly 30%.
- **The display bus at 80 MHz instead of 40.** Sending a strip takes half as long.
- **Our own SPI device for the panel.** The stock driver waited for the previous strip before queueing the next. Now the window and pixel data are three queued transactions that do not drain the queue per strip.
- **Fingerprints computed in parallel.** The 64-bit tile fingerprints (3.7 ms of a 6 ms bin step) are computed in chunks of 48 primitives on both cores right after recording. The grid carries a version number instead of a fingerprint of about 5,000 floats: 0.85 ms to 0.07 ms.
- **Smaller strips**, at most 6 tiles and two per painter: 37 KB instead of 46, and 9 KB of internal RAM back.

The reported outcome: frames that overran a refresh went from about 45% to about 13%, the clock face from about 40 to about 53 fps and Lights from 28 to 47.

## The cheap wins were in the design, not the code

Three more commits cut work by drawing less:

- the background rain used to change every frame and kept 5 to 10% of the screen dirty forever; it now advances 20 times a second, like an LED sign, and the frames in between are identical;
- parallax with hysteresis: the real IMU is noisy, a value sitting on the boundary between two 1/64 steps flipped back and forth every frame, and every flip moves every plane, so the whole screen was redrawn. The step now changes only when the tilt exceeds it by 0.9;
- the CRT effect (colour fringe, bloom, barrel bulge) is off by default on the 1.43. It was most of the drawing cost. With it off, Lights runs at 54 to 60 fps.

That last one is a design decision made by a profiler. The effect I spent an evening building in part 5 is the first thing the real hardware voted out.

## Bugs that only a real board has

- The Hue bridge closed some chunked responses badly ("Incomplete chunked data"). The full body had arrived and the status was 200, but the firmware discarded it, so the bridge was found and the lamps were not. Now the JSON parser decides.
- Spotify opened and closed an HTTPS connection per call, 1 to 3 seconds of handshake per command. Requests now go through one worker on a kept-alive connection, in order. The commit ends with "to be tried on the board", which is the honest form of an unmeasured claim.
- A swipe that starts at the edge of the glass was being read as the rim dial and never went back home.

What the board has not told me yet is battery life. [Part 10](/posts/dotto-10-sleep-a-battery-and-what-i-could-not-check/) is about that. First, [part 9](/posts/dotto-9-black-is-off-and-fingers-are-big/): the design rules that came out of holding the thing.
