---
title: "Dotto, part 4: a character that lives on the rim"
date: 2026-11-24T09:03:00+01:00
description: "How the seconds marker turned into a character with physics, why one engine replaced many hand-written animations, and the 46 seconds in which the project was named twice."
series: "Dotto making-of"
slug: "dotto-4-a-character-that-lives-on-the-rim"
---

Nine minutes after the dots concept started, at 09:09 on Monday 23 November, the seconds marker became a character. The commit message: *Pip, the dot mascot who does the seconds, falls into the minute and dances in the DJ screen*. At that point he was called Pip.

## Four hours of Pip

The commits between 09:09 and 12:59 read like a character sheet being written in public:

- **09:13** not cropped any more, more idle animations, a personality and a costume for every menu entry;
- **09:16** in the menu he jumps from word to word and strolls along the long ones;
- **09:29** at the minute change he lands on the battery, falls onto the hour digits and slides across them;
- **09:30** after the fall he is dazed: X eyes, little stars, then he shakes it off;
- **09:37** seven ways of moving, with mood and skin decided by context, and petting him gives hearts;
- **09:42** platformer physics on the rim: run, jump, dash, dust, trails. He no longer moves every second;
- **09:58** a scene system for the fight between Pip and the second, with one model scene;
- **10:07** from second 52 he waits on the battery, and the second tips it like a seesaw.

![An early platformer version of the dots screen](/img/dotto/pip-platformer.jpg "The platformer commit, before the engine. Pip is the small figure on the rim.")

## One body, one way of moving

By noon the problem was visible in the code. Pip was animated in many separate places: the rim simulation, the pre-minute run, the minute scene, the menu, the lights screen, the DJ screen, the night and the chase scenes. Each moved and drew him its own way, with duplicated timings, poses and effects. The design note for what came next says it plainly: it reads as sloppy. I wanted one centralised way of moving.

The note, `pip/ENGINE.md`, asks for a single engine that every appearance goes through. The header of `engine.js` lists its six layers:

1. **Body and physics.** A feet point on a surface (the rim, a segment), or in the air under the device's real gravity, which comes from the IMU.
2. **Locomotion.** Idle, walk, run, dash, jump, fall, hop, grab, hang, climb, roll, stun, shake off.
3. **Animation.** Poses plus a small pose machine and procedural modifiers: squash, lean, turn, look, breathing.
4. **FX.** One particle pool: dust, ghosts, speed lines, stars, hearts, sweat, smoke, sparks, debris, a flash, a fireball.
5. **Reflexes** from the IMU: slopes, grabbing ledges, swinging, flying off on a hard shake, rolling, getting up.
6. **Scenes.** A script of engine commands on a timeline.

Commit f5843cd at 12:45 moved the clock, the minute, the night, the menu, the lights and the DJ screen onto it. At 12:47 the IMU reflexes arrived: he slides on slopes, grabs a ledge, swings, and flies off with a hard shake. At 12:57, regression tests over every screen and every button.

The header also says how it maps to the chip: one Pip and a few dozen particles, nothing per pixel. A pose is at most 11×10 cells. The transform is a 2×2 matrix in Q16 fixed point over about 70 cells per frame. Physics is explicit Euler at the display rate on floats, since the S3 has an FPU. The particle pool is a fixed 64 structs. It is a design written in JavaScript for a C implementation that did not yet exist.

## The dynamite

The scene I would show first is *La dinamite* (12:53), the first one written on the new engine. Pip drags a stick of TNT along the rim to where the second will be, lights the fuse, runs to the far side and covers his ears. The second hops over the stick. The fuse reaches the end. The explosion is a pixel one: a white flash, a fireball that cools into smoke, flying debris, a red wave, and the whole face comes down. The second carries on, untouched. Pip uncovers his ears, looks at the rubble, then at us.

The timeline in the file header is exact: 0 ms he pulls the TNT out; about 2.5 s with ears covered, trembling; at 5000 ms the second hops over; at 5400 ms, boom; 9000 ms, the end.

![Pip dragging a stick of TNT along the rim, fuse trailing](/img/dotto/final-dynamite-run.jpg "La dinamite, a frame from the current prototype: Pip dragging the stick toward the second.")
![Pip and the TNT near the bottom of the rim](/img/dotto/final-dynamite-walk.jpg "Another frame, a few seconds on.")

These are single frames of a nine-second scene. They do not show the explosion; I could not catch that frame reliably when capturing. The scene runs in the [live prototype](/dotto/play/) if you wait; the spec asks for a chase scene every 25 to 45 seconds, and the panel has a button for each one.

## Forty-six seconds

At 13:06:02 a commit says: *the project becomes Pip, README and plan updated*. At 13:06:48, forty-six seconds later: *the project is called Dotto*.

The plan file records the final decision. Dotto is both the product and the mascot, a pun between *dot* and the Italian *dotto*. It is also, by then, a project of its own, no longer tied to RoomGroove. In the code the engine is still called `pip`. The same file adds a note I will repeat because it is true: before any public release this needs a trademark check, and I have not done one.

Next: [the spec, the first run, the voice and the glass](/posts/dotto-5-the-first-run-the-voice-and-the-glass/).
