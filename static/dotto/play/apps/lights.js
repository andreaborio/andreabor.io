/* Luci: rooms on the top ring, scenes on the bottom ring, the % drawn by sliding a finger, the lamp count. */
'use strict';
/* Luci (CONTENT.md), on the screen template.
   The outer ring holds the rooms: spin it with a finger along the rim (or tap a name); the one at the top is the room
   you control. The light itself is the screen: the dots of the glass fill up from the bottom to the brightness, in the
   colour of the scene. Drag up and down anywhere inside to set it (rotating Dotto does the same); the number falls
   into place like the timer's. Tap the number: on/off. The scenes are a row of words; tap one.
   On the device: the fill is one precomputed layer of dots, revealed from a y; drags are LVGL indev events. */
const LK = KIT.screen();
const ROOM_SP = 0.62;                               // radians between two rooms on the ring, past the ends
// where each room sits on the ring (radians from the first), spaced by the real width of its name
function sceneAngles(){
  const R = KIT.R_TITLE + 10, ws = SCENES.map(n => KIT.textW('label', n)), pa = [0];
  for (let i = 1; i < SCENES.length; i++) pa.push(pa[i - 1] + ((ws[i - 1] + ws[i]) / 2 + 30) / R);
  return pa;
}
function roomAngles(){
  const R = KIT.R_TITLE + 8, ws = ZONES.map(z => KIT.textW('label', z.n)), pa = [0];
  for (let i = 1; i < ZONES.length; i++) pa.push(pa[i - 1] + ((ws[i - 1] + ws[i]) / 2 + 30) / R);
  return pa;
}
// the angle of a fractional room index, and back
function roomAt(pa, f){ const n = pa.length - 1; if (f <= 0) return pa[0] + f * ROOM_SP; if (f >= n) return pa[n] + (f - n) * ROOM_SP; const i = Math.floor(f); return lerp(pa[i], pa[i + 1], f - i); }
function roomIndex(pa, v){ const n = pa.length - 1; if (v <= pa[0]) return (v - pa[0]) / ROOM_SP; if (v >= pa[n]) return n + (v - pa[n]) / ROOM_SP; let i = 0; while (i < n - 1 && v > pa[i + 1]) i++; return i + (v - pa[i]) / (pa[i + 1] - pa[i]); }
// the two rings move in detents like the menu (core/snap.js): rooms on top, scenes at the bottom
const ZSNAP = makeSnap(st, 'zoneF', 'zoneT', () => ZONES.length), SSNAP = makeSnap(st, 'sceneF', 'sceneT', () => SCENES.length);
function setBright(nb){
  const z = ZONES[st.zone]; if (st.scene === 3) st.scene = st.lastScene || 0;
  z.b = nb; if (z.all) for (const q of ZONES) q.b = nb;
  st.levelT = clock;
}
function setScene(i){
  if (i === st.scene) return;
  if (i === 3) st.lastScene = st.scene;
  st.scene = i; haptic('confirm'); wave(SCENE_HUE[i], 1, i === 3);
  keepZone();
  // "Tutta casa" is an explicit scope: the scene goes to every room
  if (ZONES[st.zone].all) for (const q of ZONES){ q.scene = i; if (i !== 3) q.lastScene = i; }
}
// each room keeps its scene (and the one to go back to when you switch it on again); st.scene mirrors the current room
function keepZone(){ const z = ZONES[st.zone]; if (z){ z.scene = st.scene; z.lastScene = st.lastScene; } }
function setZone(i){
  keepZone(); st.zone = i;
  const z = ZONES[i]; st.scene = z.scene == null ? 0 : z.scene; st.lastScene = z.lastScene == null ? 0 : z.lastScene;
}
function selectZone(i){
  i = clamp(i, 0, ZONES.length - 1); st.zoneT = i;
  if (i !== st.zone){ setZone(i); haptic('confirm'); wave(SCENE_HUE[st.scene], 0.5, st.scene === 3); resetText(T.pct, clock); st.levelT = clock; }
}
// the IMU felt Dotto picked up and put down somewhere else: Luci asks, with the ring already on the room the WiFi suggests
// (no measurement yet: the question is neutral and the ring starts where Dotto was; a WiFi estimate would only pre-select)
function askRoom(){ st.moved = false; st.asking = true; st.suggest = SET.room; st.zoneT = st.suggest; setZone(st.suggest); st.lightsT0 = clock; }
// the row of scenes, in caption type: where each word sits
// the lamps of the room, at the bottom: a pixel bulb lit as much as the room, and how many there are
const BULB = ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..#.#..', '..###..', '..###..', '...#...'];
function lampCount(a, z, on){
  const n = z.lamps, dead = SU.SIM.deadLamp && z.n === 'Studio' ? 1 : 0, str = dead ? `${n - dead}/${n}` : String(n);
  const px = 3, bw = 6 * px, tw = (KIT.wordCols(str) - 1) * px, gap = 10, x0 = C - (bw + gap + tw) / 2, y0 = KIT.Y.body - 5 * px, lv = on ? z.b / 100 : 0;
  if (lv > 0){ const cx = x0 + 3 * px, cy = y0 + 3.5 * px, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26); g.addColorStop(0, `rgba(255,214,150,${0.4 * lv * a})`); g.addColorStop(1, 'rgba(255,214,150,0)'); ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.fillRect(cx - 26, cy - 26, 52, 52); }
  BULB.forEach((row, r) => [...row].forEach((v, c) => {
    const x = x0 + c * px, y = y0 + r * px;
    if (v === '#') dot(x, y, 1.15, r >= 7 ? INK2 : INK, a);
    else if (r >= 1 && r <= 5 && Math.abs(c - 3) <= (r === 1 || r === 5 ? 1 : 2)) dot(x, y, 1.15, 'rgb(255,214,150)', a * (0.12 + 0.88 * lv));
  }));
  KIT.word(str, x0 + bw + gap + tw / 2, y0 + 4.5 * px, px, dead ? INK2 : INK, a);
}
function scrLights(a, now){
  const dt = st.lastDt || 16, z = ZONES[st.zone], on = st.scene !== 3, el = now - st.lightsT0;
  snapTick(ZSNAP, dt);
  let n = 0;
  // the light: the glass fills from the bottom, brighter while you drag it, then it settles (behind the glass)
  DEPTH.push(DEPTH.P.glow);
  if (on){
    const lv = z.b / 100, top = C + 198 - lv * 396, act = clamp(1 - (now - (st.levelT || -1e9)) / 1100, 0, 1), k = 0.07 + 0.28 * act;
    const col = rgb(SCENE_HUE[st.scene] || W);
    for (let y = C % P; y < S; y += P){
      if (y < top - 1) continue;
      const dy = y - C, edge = clamp((y - top) / 27, 0, 1), crest = y - top < P ? 0.6 * act : 0;
      // the row's chord of the circle (r 198), straight from its half-width: no distance per dot
      if (Math.abs(dy) > 198) continue;
      const hw = Math.sqrt(198 * 198 - dy * dy), x1 = C + hw;
      for (let x = C % P + Math.ceil((C - hw - C % P) / P) * P; x <= x1; x += P){ dot(x, y, 1.15 + crest, col, a * (k * edge + crest * 0.5)); n++; }
    }
  }
  DEPTH.pop();
  // the rooms on the outer ring; the one at the top is the one you control, with a dot over it
  const RA = roomAngles();
  DEPTH.push(DEPTH.P.title);
  for (let i = 0; i < ZONES.length; i++){
    const off = RA[i] - roomAt(RA, st.zoneF); if (Math.abs(off) > 1.05) continue;
    const f = 1 - clamp(Math.abs(i - st.zoneF), 0, 1);
    label(ZONES[i].n, { arc: 'top', R: KIT.R_TITLE, p: 22 / 5.2, weight: 700, track: 0.06, bold: 0.05, off, col: f > 0.5 ? INK : KIT.colOf('label'), a: a * lerp(0.45, 1, f) * (1 - sstep(0.6, 1.05, Math.abs(off))) });
  }
  DEPTH.pop();
  dot(C, C - 207, 2.4, INK, a);
  // the brightness, in dots, falling into place
  setText(T.pct, `${z.b}%`, now);
  // a smaller pitch than the other heroes: "100%" has to stay clear of the ring of rooms
  n += drawText(T.pct, D, C, KIT.Y.hero + 20, 7, 2.75, on ? INK : INK2, now, { alpha: a * (on ? 1 : 0.45), depth: true, ink: true, doSnap: false });
  // the scenes: a row of words, the chosen one white with a dot under it
  if (!st.asking){
    DEPTH.at(DEPTH.P.text, () => lampCount(a * fade1(el, 300), z, on));
    // the scenes on the bottom ring (how), mirroring the rooms on the top one (where); the chosen one has a dot under it
    if (!SSNAP.held) st.sceneT = st.scene; snapTick(SSNAP, dt);
    const SA = sceneAngles(); DEPTH.push(DEPTH.P.title);
    for (let i = 0; i < SCENES.length; i++){
      const off = -(SA[i] - roomAt(SA, st.sceneF)); if (Math.abs(off) > 1.0) continue;
      const f = 1 - clamp(Math.abs(i - st.sceneF), 0, 1);
      label(SCENES[i], { arc: 'bottom', R: KIT.R_TITLE + 18, p: 22 / 5.2, weight: 900, track: 0.04, bold: 0.05, off, col: f > 0.5 ? INK : KIT.colOf('label'), a: a * lerp(0.45, 1, f) * (1 - sstep(0.55, 1.0, Math.abs(off))) });
    }
    DEPTH.pop(); dot(C, C + 210, 2.4, INK, a);
  }
  const cap = !on ? 'Tocca il numero' : st.lightSync && st.cdj ? 'A tempo coi CDJ' : SU.SIM.deadLamp && z.n === 'Studio' ? '1 non risponde' : '';
  LK.titleT0 = st.lightsT0;
  KIT.compose(LK, st.asking
    ? { body: 'Altra stanza?', caption: 'Gira e scegli quella giusta', pills: [KIT.OUT('No', 'stay'), KIT.GO('Sì, qui', 'here')] }
    : { caption: cap }, a, el, now);
  n += BR.lights.run(a, now, dt);
  return n;
}
const fade1 = (el, d) => sstep(d, d + 280, el);
