---
title: "Dotto, part 2: four materials and a drop of mercury"
date: 2026-11-24T09:01:00+01:00
description: "Four concepts from one brief, the one I picked, why I abandoned it the next morning, and the four directions I went through in under two hours."
series: "Dotto making-of"
slug: "dotto-2-four-materials-and-a-drop-of-mercury"
---

The [brief](/posts/dotto-1-the-first-screen-was-a-no/) went out and four concepts came back, committed at 17:27 on Sunday 22 November. Same six screens, four materials: Mercurio (liquid metal), Ferro (mineral grain, iron), Livello (liquid levels) and Massa (soft solids, in a glazed warm-stone shell).

![Mercurio clock: a brushed steel bezel, black glass, a heavy extended sans clock](/img/dotto/mercurio-clock.jpg "Mercurio")
![Ferro clock: dark glass, a thin tinted rim, a light-weight clock](/img/dotto/ferro-clock.jpg "Ferro")
![Livello clock](/img/dotto/livello-clock.jpg "Livello")
![Massa clock](/img/dotto/massa-clock.jpg "Massa")

*Mercurio, Ferro, Livello, Massa: the same clock screen, built from the same brief.*

Mercurio won the first round. The plan file records it as a decision: ultra-realistic liquid metal on AMOLED black, with a copper accent. It got two more revisions that evening. Version 2 made the tubes continuous, the DJ screen more readable and the cover art anodised. Version 3, at 21:31, added more credible physics, gyroscope input and a new launcher. By 22:06 it had its own typeface pairing, which the plan calls Fuso: Fraunces Soft for numbers, Instrument Sans for text.

## Why mercury died

Next morning, 07:11, a commit with this message: *Lab mercurio: physics and rendering (work interrupted, saved as it was)*. Nine minutes later, a new direction called **Una goccia**, one drop.

Its `DIRECTION.md` opens by diagnosing why the mercury looked cheap, and the diagnosis is the useful part:

1. **An inflated material.** Everything was mercury: icons, bars, sliders, menus. A precious material everywhere stops being precious.
2. **Realism spread over 60 objects.** One perfect drop convinces; sixty discrete drops look like a screensaver.
3. **Motion without a job.** Drops that shiver and explode draw attention to themselves instead of the information.
4. **No system.** Random spacing, overlapping text, a case drawn with CSS gradients.

The thesis fits in a sentence: the Puck contains a single drop of mercury, and the drop always has a job. It marks the seconds, the active menu entry, the position in the track, the value of the dial. Everything else is typography and thin engravings on black glass.

![Una goccia, menu: a serif word list on black, one drop sitting at the left edge](/img/dotto/goccia-menu.jpg "Una goccia. One drop, serif words, nothing else.")
![Una goccia, DJ screen: a large serif 124,0, "Build" in copper, "8 beat al drop"](/img/dotto/goccia-dj.jpg "The DJ screen, eight beats from the drop.")

It was also cheaper on the hardware, which mattered as much as the mood: one drop can be rendered offline on the Mac at photographic quality and shipped as sprites, around 1 to 2 MB of flash. On the chip that is a blit.

## Four directions before breakfast

Then it got fast. From the drop at 07:20 to the dots at 08:59, there were four directions:

- **07:20 Una goccia**, above.
- **07:53 Fosforo.** A beam of light draws everything and the glass remembers it for a moment. Only the DJ screen, from build to drop.
- **08:44 Step and Waveform.** The DJ screen in two variants, with the numbers as a dot matrix. This is the first appearance of a dot matrix in the repository.
- **08:59 Punti.** A hand-drawn dot font, a falling animation, a rolling animation, a drum menu.

![Fosforo in the build: a green radar-like rim and a scribbled trace](/img/dotto/fosforo-build.jpg "Fosforo, in the build.")
![Fosforo in the drop: the whole display flooded green](/img/dotto/fosforo-drop.jpg "Fosforo, in the drop. The whole display goes green.")
![Step and Waveform: a blue waveform ring, an orange playhead, a dot-matrix 124.0](/img/dotto/step-wave.jpg "Step and Waveform: the edge is for signal, the centre is for numbers.")

I cannot reconstruct from the repository why Step and Waveform led to the dots rather than somewhere else. The commit messages show the dot-matrix numbers appearing in Step at 08:44 and a complete dot-matrix concept fifteen minutes later. The rest is [part 3](/posts/dotto-3-everything-is-a-dot/).
