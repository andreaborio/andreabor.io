/* Snap: things that move in detents, like the crown of a watch: the menu, the rooms and scenes rings of Luci.
   Four rules, so it feels natural and never sloppy:
   1. Under the finger it is magnetic: the list slows down as it nears an item and hurries between two, so you
      feel each item go by (x = n + f − m·sin(2πf)/2π: monotonic, continuous, sticky at the items).
   2. Past the ends it gives like rubber (at most ~0.35 of an item) instead of hitting a wall.
   3. On release the finger's speed decides: a slow release goes back to the nearest item, a flick carries on to
      the next one or two (the landing is projected 160 ms ahead, as on iOS), never more than 2 from where it was.
   4. It lands on a spring that starts with the finger's speed (no jolt between the drag and the landing), slightly
      underdamped: a hint of overshoot, settled in ~250 ms.
   The state lives where the screen already reads it (e.g. st.scroll / st.scrollT): a snap only adds speed and the
   last few finger samples. Port: a struct of floats and a 4-entry ring buffer; sin is the shared table. */
'use strict';
const SNAP_MAG = 0.55, SNAP_RUB = 0.35, SNAP_PROJ = 0.16, SNAP_W = 20, SNAP_Z = 0.8;
// o: the object holding the values, kx: key of the position, kt: key of the target, n(): how many items
function makeSnap(o, kx, kt, n){ return { o, kx, kt, n, v: 0, held: false, from: 0, base: 0, T: [0, 0, 0, 0], X: [0, 0, 0, 0], k: 0 }; }
const snapMagnet = raw => { const i = Math.round(raw), f = raw - i; return i + f - SNAP_MAG * Math.sin(TAU * f) / TAU; };
function snapRubber(S, x){
  const hi = S.n() - 1, rb = d => (1 - 1 / (d / SNAP_RUB + 1)) * SNAP_RUB;
  return x < 0 ? -rb(-x) : x > hi ? hi + rb(x - hi) : x;
}
// the way back (grabbing it while it moves must not make it jump): rubber, then magnet, by Newton (3 steps)
function snapUnshow(S, x){
  const hi = S.n() - 1, R = SNAP_RUB, un = y => R * y / (R - Math.min(y, R * 0.999));
  if (x < 0) x = -un(-x); else if (x > hi) x = hi + un(x - hi);
  let r = x; for (let i = 0; i < 3; i++){ const f = r - Math.round(r); r -= (snapMagnet(r) - x) / (1 - SNAP_MAG * Math.cos(TAU * f)); }
  return r;
}
function snapGrab(S){ S.held = true; S.v = 0; S.k = 0; S.from = Math.round(S.o[S.kx]); S.base = snapUnshow(S, S.o[S.kx]); }
// d: how far the finger has moved since the grab, in items (1:1); returns the shown position
function snapDrag(S, d, now){
  const raw = S.base + d, x = snapRubber(S, snapMagnet(raw));
  S.T[S.k & 3] = now; S.X[S.k & 3] = raw; S.k++;
  S.o[S.kx] = S.o[S.kt] = x;
  return x;
}
// the finger's speed over its last moves (up to 4, within 120 ms of the last one), in items per second; a finger that
// stopped before lifting (no move for 90 ms) has no speed. Times: the real clock of the touch events
function snapSpeed(S, now){
  if (S.k < 2) return 0;
  const j = (S.k - 1) & 3; let i = j;
  if (now - S.T[j] > 90) return 0;
  for (let c = 1; c < Math.min(S.k, 4); c++){ const q = (S.k - 1 - c) & 3; if (S.T[j] - S.T[q] > 120) break; i = q; }
  const dt = S.T[j] - S.T[i]; return dt > 8 ? (S.X[j] - S.X[i]) / dt * 1000 : 0;
}
// let go: returns the item it will land on (the caller may act on it: select a room, a scene…)
function snapRelease(S, now){
  S.held = false;
  const x = S.o[S.kx], v = snapSpeed(S, now);
  let t = Math.round(x + v * SNAP_PROJ);
  t = clamp(clamp(t, S.from - 2, S.from + 2), 0, S.n() - 1);
  S.v = v; S.o[S.kt] = t;
  return t;
}
// one detent from where it is heading (bezel, wheel, keys)
function snapStep(S, d){ S.o[S.kt] = clamp(Math.round(S.o[S.kt]) + d, 0, S.n() - 1); }
// put it somewhere at once (opening a screen)
function snapJump(S, i){ S.o[S.kx] = S.o[S.kt] = i; S.v = 0; }
// the spring, in steps of ≤ 8 ms (semi-implicit Euler: stable, two multiply-adds per step)
function snapTick(S, dt){
  if (S.held) return;
  const o = S.o; let x = o[S.kx];
  const t = o[S.kt];
  if (Math.abs(t - x) < 1e-4 && Math.abs(S.v) < 1e-3){ o[S.kx] = t; S.v = 0; return; }
  for (let left = Math.min(dt, 64); left > 0; left -= 8){
    const h = Math.min(8, left) / 1000;
    S.v += (SNAP_W * SNAP_W * (t - x) - 2 * SNAP_Z * SNAP_W * S.v) * h; x += S.v * h;
  }
  o[S.kx] = x;
}
