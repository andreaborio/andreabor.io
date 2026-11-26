---
title: "Dotto, part 10: sleep, a battery and what I could not check"
date: 2026-11-26T22:03:00+01:00
description: "Two levels of standby on the 1.43, the display command that was never actually sent, the sensor interrupt that is not wired, the numbers measured on USB and a list of what is still unverified."
series: "Dotto making-of"
slug: "dotto-10-sleep-a-battery-and-what-i-could-not-check"
---

A desk object that is awake all day is a small heater with a clock face. The last work of 26 November, commit `65e5a01` at 20:08, is standby. It is also the part where the gap between "built" and "verified" is widest, so this post keeps them separate.

## First attempts, and a revision the same day

The first version (14:59) turned the screen off after a period without touches while still, woke on touch, movement, lift, two knocks on the table or the BOOT button, and never slept with a timer, a live DJ deck, lights-to-the-beat or setup running. A lift fired at 0.2 g and 8°, which a finger on the glass could trigger, and a put-down returned to the clock from any screen. By 15:06 both were tightened. At 19:14 another bug showed in the sensor: Dotto's gravity followed the IMU noise and a fake "in the hand" tremble, so he got lighter and heavier and hopped in place, even asleep. He now reads only the real tilt, with a 4° dead zone and 1° steps. The tremble stays only in the parallax.

## The tiers

After this commit:

- **Dim** after 30 s without touches, on every screen, to 40% brightness.
- **Standby** at about 60 s, with exceptions: a timer running or ringing, a DJ deck that is playing, setup. The panel goes to sleep with commands 0x28 and 0x10, the touch controller goes to monitor mode, the IMU runs accelerometer-only at 21 Hz with wake-on-motion at 80 mg, the UI task blocks instead of polling at 50 Hz, Spotify polling pauses, the network ticks at 4 Hz. The CPU drops from 240 to 40 MHz with automatic light sleep, and WiFi goes to max-modem power save.
- **Deep standby** after 10 minutes of standby, on battery only, with no timer, deck or lights-to-the-beat. Wake is by touch or BOOT.

## A bug that had been there all along

While wiring this up, the agent found that the display off/on commands (0x28 and 0x29) had never reached the panel. The SPI driver rejected them with "trans tx_buffer should be NULL…", so what looked like display off was just the screen going black through the app. Fixed in `qCmd`. It is the kind of bug the simulator cannot have.

## A wire that is not there

The plan was to wake from deep sleep by movement. It cannot work on this board. The IMU's interrupt pins do not reach any GPIO on the 1.43: every free pin was scanned with the interrupt forced to toggle and nothing was seen. The wake-on-motion flag can only be read over I2C, so movement wakes the light standby, which polls, but not the deep one. Deep sleep wakes on touch or BOOT. The same goes for the RTC on the board: the firmware does not use it, and time survived deep sleep on the chip's own timer, not tested across a full power loss.

## The numbers, and what they are

All measured on USB, with a debug override, because USB changes the rules: with a host connected, light sleep kills the USB serial port and the chip cannot be flashed until it wakes. By default the app holds a power lock while USB is attached and skips deep sleep. So the power figures below came from running without that protection, over WiFi.

- Light sleep over a 30 s window with the 4 Hz network tick: 85 to 87% of the time asleep and about 10.5% at 240 MHz. At 10 Hz the first version managed 79% and 17%. About 24 light-sleep entries a second.
- Awake: 99% of the time at maximum CPU, no light sleep, and the same ~57 fps as before.
- Wake from standby by lift: hardware back in 64 ms, screen on 43 ms later.
- Deep wake to a clock on the glass: 416 to 826 ms after the app starts, 1.12 to 1.53 s after the wake event, over four wakes. About 700 ms of it is the bootloader and copying code to PSRAM. Two switches I tried to shorten it (skipping the memory test and the validation) gave nothing and were removed.
- While WiFi is in max-modem, ping averages 100 to 180 ms. The lamps' own state replies and mDNS arrive late, while control, which is outbound UDP, is not affected.
- A debug endpoint on the board serves a 16 KB log ring buffer from PSRAM.

## What I could not check

- **The battery.** On USB the cell is charging: 4.109 to 4.118 V, flat over about ten minutes. There is no trend and no figure in milliamps. I cannot say how many hours Dotto lasts, and I will not estimate it.
- **Waking by touch, by the motion flag or by BOOT**, on the board. Nobody was holding it. The only wake tested in deep sleep was the timer.
- **That the panel shows an image after Sleep Out.** I saw the tearing-effect pulses and the fps come back, not the glass.
- **Lights-to-the-beat on real music.** I used a fake toggle. With it on the board stayed out of light sleep and deep standby for a minute and went in as soon as it was off. No CDJ or Spotify was playing.
- **A double knock** only works awake. In standby any movement above 80 mg wakes the board, which may mean waking on desk bumps.

A test file, `standby.sh`, has 19 cases in the simulator (each screen awake at 40 s and asleep at 70 s, the exceptions, a touch restarting the count) and they pass, with 94 screen images matching. That says the logic is right. It does not say the glass wakes up.

## Where it stands

At the end of 26 November the clock runs at about 57 fps awake, the build for both boards compiles, and the repository has a CI job that builds the 1.43, the 1.75C and the simulator and compares the screens on every push. What is left is in the plan: haptics, more precise lights, the advanced DJ features, voice on the 1.75C, and the first honest battery curve. The open question at the end of the day is a product one, not a technical one: keep deep standby with wake on touch, or drop it so the object always wakes on movement.

The previous nine parts were written from commits. This one ends on a list of things I did not see happen, and I think that is the right ending for 26 November.
