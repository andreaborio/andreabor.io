/* The menu: one app big in the middle (its pixel icon, Dotto playing on it, its name, its live line), the others
   faded on the rings. */
'use strict';
/* the menu: the app in the middle is big (its icon in pixels in its colour, with Dotto standing on it; its name; its live
   line), the apps go by on a vertical belt as you turn the bezel; the previous and the next one sit on the rings, top
   and bottom, like the rooms and scenes in Luci. Tap the middle to open, a ring to move */
// Dotto + icon + name + line make one block centred in the glass; the other apps dissolve in and out (a short drift, a fade, a scale)
const MENU_IP = 8, MENU_BELT = 70, MENU_Y = { icon: C - 22, name: C + 46, line: C + 88 };
const MENU_ICON = {
  lights:   ['...###...', '..#...#..', '.#.....#.', '.#.....#.', '.#.....#.', '..#...#..', '...#.#...', '...###...', '...###...'],
  music:    ['.....###.', '.....#.##', '.....#..#', '.....#...', '.....#...', '..####...', '.#####...', '.#####...', '..###....'],
  timer:    ['#########', '.#.....#.', '..#...#..', '...#.#...', '....#....', '...#.#...', '..#.#.#..', '.#.###.#.', '#########'],
  settings: ['...#.#...', '.#######.', '.##...##.', '##.....##', '.#.....#.', '##.....##', '.##...##.', '.#######.', '...#.#...'],
  dj:       ['..#####..', '.#.....#.', '#..###..#', '#.#...#.#', '#.#.#.#.#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..']
};
const MENU_NAME = { lights: 'Luci', music: 'Musica', timer: 'Timer', settings: 'Opzioni', dj: 'DJ' };
const MENU_LINE = { settings: () => 'Schermo, suoni, rete' };
// each app plays with its icon, and Dotto plays along (pip/brains.js reads the cue): the icon's motion right now
function menuPlay(id, now){
  const r = { dx: 0, dy: 0, rot: 0, lit: 0, sand: -1, cue: 'idle', t: 0 };
  if (id === 'lights'){       // he stomps on the bulb, it lights up warm, he cheers; then it goes off
    const t = r.t = now % 3400; r.lit = t > 240 && t < 2300 ? clamp((t - 240) / 120, 0, 1) * (1 - sstep(1800, 2300, t)) : 0;
    r.cue = t < 80 ? 'stomp' : r.lit > 0.5 ? 'cheer' : 'sit';
  } else if (id === 'music'){ // the note bounces on the beat, a big jump every 8 beats (and he spins)
    const ph = (now % 476) / 476, bt = Math.floor(now / 476), big = bt % 8 === 7;
    r.dy = -Math.abs(Math.sin(ph * Math.PI)) * (big ? 14 : 5); r.cue = big && ph < 0.12 ? 'spin' : 'bob';
  } else if (id === 'timer'){ // sand runs, he watches; every 4 s he jumps, the hourglass flips under him, he lands
    const t = r.t = now % 4000; r.rot = sstep(3300, 3750, t) * Math.PI; r.sand = t < 3250 ? t / 3250 : -1;
    r.cue = t > 3180 && t < 3260 ? 'hop' : 'watch';
  } else if (id === 'settings'){ r.rot = now / 1300; r.cue = 'walk'; }      // the gear turns: he walks on it like a treadmill
  else if (id === 'dj'){ r.rot = now / 420 + Math.sin(now / 150) * 0.9; r.cue = 'scratch'; r.mark = true; }   // the record spins and he scratches it back and forth
  return r;
}
function scrMenu(a, now, b){
  let n = 0;
  const N = MENU.length, sel = clamp(Math.round(st.scroll), 0, N - 1);
  for (let i = 0; i < N; i++){
    const k = i - st.scroll; if (Math.abs(k) > 1) continue;
    const f = 1 - clamp(Math.abs(k), 0, 1), al = a * Math.pow(f, 2.6), dy = k * MENU_BELT, id = MENU[i].id, sc = lerp(0.72, 1, f);
    const hue = vivid(APP_HUE[id] || W), ic = MENU_ICON[id] || MENU_ICON.lights;
    // the icon, in pixels, in the app's colour, standing out of the glass
    DEPTH.at(DEPTH.P.hero, () => {
      const pl = f > 0.5 ? menuPlay(id, now) : { dx: 0, dy: 0, rot: 0, lit: 0, sand: -1 };
      const h = ic.length, w = ic[0].length, cx = C + pl.dx, cy = MENU_Y.icon + dy + pl.dy, cs = Math.cos(pl.rot), sn = Math.sin(pl.rot), ip = MENU_IP * sc;
      const at = (c, r) => { const lx = (c - (w - 1) / 2) * ip, ly = (r - (h - 1) / 2) * ip; return [cx + lx * cs - ly * sn, cy + lx * sn + ly * cs]; };
      if (pl.lit > 0){ const g = ctx.createRadialGradient(cx, cy - 6, 0, cx, cy - 6, 60); g.addColorStop(0, `rgba(255,214,150,${0.45 * pl.lit * al})`); g.addColorStop(1, 'rgba(255,214,150,0)'); ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.fillRect(cx - 60, cy - 66, 120, 120); }
      ic.forEach((row, r) => [...row].forEach((v, c) => {
        const [x, y] = at(c, r);
        if (v === '#'){ dot(x, y, 3.1 * sc, rgb(hue), al); n++; }
        else if (pl.lit > 0 && r >= 1 && r <= 5 && c >= 2 && c <= 6 && Math.abs(c - 4) <= (r === 1 || r === 5 ? 1 : 2)) dot(x, y, 2.9 * sc, 'rgb(255,226,170)', al * pl.lit);
      }));
      if (pl.mark){ for (const rr of [2.4, 3.2]){ const [x, y] = at(4 + rr, 4); dot(x, y, 2.4, INK, al); } }
      if (pl.sand >= 0){
        // the sand: the top chamber empties, a thin stream, the bottom one fills
        const top = Math.round((1 - pl.sand) * 3), bot = Math.round(pl.sand * 3);
        for (let k2 = 0; k2 < top; k2++) for (let c = 3 - (2 - k2) + 0; c <= 5 + (2 - k2) - 0; c++){ if (c < 2 || c > 6) continue; const [x, y] = at(c, 1 + k2 + (3 - top)); if (Math.abs(c - 4) <= 3 - (1 + k2 + (3 - top))) dot(x, y, 1.8, rgb(hue), al * 0.7); }
        for (let k2 = 0; k2 < bot; k2++){ const r = 7 - k2; for (let c = 4 - (k2 + 1); c <= 4 + (k2 + 1); c++){ const [x, y] = at(c, r); dot(x, y, 1.8, rgb(hue), al * 0.7); } }
        const fy = (now % 420) / 420; const [sx, sy] = at(4, 4 + fy * 2.5); dot(sx, sy, 1.6, rgb(hue), al);
      }
    });
    DEPTH.at(DEPTH.P.text, () => {
      label(MENU_NAME[id] || MENU[i].w, { y: MENU_Y.name + dy * 0.6, p: 40 * sc / 5.2, col: INK, a: al, caps: false, track: 0 });
      label((MENU_LINE[id] || MENU[i].sub)(), { y: MENU_Y.line + dy * 0.4, p: 25 / 5.2, col: rgb(hue), a: al, caps: false, track: 0, bold: 0.03 });
    });
  }
  // the neighbours on the rings: the previous app on top, the next one at the bottom
  DEPTH.at(DEPTH.P.title, () => {
    const sp = sel > 0 ? MENU[sel - 1] : null, sn = sel < N - 1 ? MENU[sel + 1] : null, still = 1 - clamp(Math.abs(st.scroll - sel) * 3, 0, 1);
    if (sp) label(MENU_NAME[sp.id], { arc: 'top', R: KIT.R_TITLE, p: 22 / 5.2, col: rgb(vivid(APP_HUE[sp.id] || W)), a: a * 0.5 * still, track: 0.04, bold: 0.05 });
    if (sn) label(MENU_NAME[sn.id], { arc: 'bottom', R: KIT.R_TITLE + 18, p: 22 / 5.2, col: rgb(vivid(APP_HUE[sn.id] || W)), a: a * 0.5 * still, track: 0.04, bold: 0.05 });
  });
  if (st.lastDetent !== undefined && sel !== st.lastDetent){ haptic('detent'); wave(APP_HUE[MENU[sel].id], 0.3); }
  st.lastDetent = sel;
  n += BR.menu.run(a, now, st.lastDt || 16, b);
  // where you are: a short column of dots at three o'clock
  for (let i = 0; i < N; i++){
    const ang = (i - (N - 1) / 2) * 0.075, x = C + Math.cos(ang) * 212, y = C + Math.sin(ang) * 212;
    const on = Math.abs(i - st.scroll) < 0.5;
    dot(x, y, on ? 3 : 1.6, on ? rgb(vivid(APP_HUE[MENU[i].id] || W)) : INK, a * (on ? 1 : 0.35));
  }
  return n;
}

// where Dotto stands in the menu: on top of each app's icon, on the vertical belt
function wordFeet(i){
  const k = i - st.scroll, ic = MENU_ICON[MENU[i].id] || MENU_ICON.lights;
  return { x: C, y: MENU_Y.icon - (ic.length - 1) / 2 * MENU_IP - 5 + k * MENU_BELT, half: 30, vis: 1 - Math.min(1, Math.abs(k)) };
}
