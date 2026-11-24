/* Rendering: the canvas, the depth engine instance, the grid, the colour waves, the face collapse, dot() (the only
   primitive everything draws with) and the animated dot text. Port: dot() is a filled circle on the LVGL canvas
   (or a pre-rendered sprite per radius), alpha blended in RGB565. */
'use strict';
/* ---------- canvas and the grid of unlit dots ---------- */
const cv = $('screen'), ctx = cv.getContext('2d');
/* the depth engine (ui/depth.js): every drawing on a plane, sliding a little as Dotto tilts */
const DEPTH = DottoDepth.create({ ctx, C });
let DPR = 1;
const ghost = document.createElement('canvas');
function fit(){
  DPR = Math.min(window.devicePixelRatio || 1, 3); cv.width = cv.height = S * DPR;
  ghost.width = ghost.height = S * DPR; const g = ghost.getContext('2d'); g.scale(DPR, DPR);
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let y = C % P; y < S; y += P) for (let x = C % P; x < S; x += P){
    if (Math.hypot(x - C, y - C) > 200) continue;
    g.beginPath(); g.arc(x, y, 0.9, 0, TAU); g.fill();
  }
}
addEventListener('resize', fit);
/* ---------- colour waves: colour only arrives with a meaning, crosses the grid from the centre, and leaves ---------- */
const WAVES = [];
let TINT = false;
const APP_HUE = { dj: [255, 59, 47], lights: [255, 176, 102], music: [169, 139, 255], voice: [89, 216, 255], home: [123, 224, 162], timer: [255, 211, 92], settings: [123, 224, 162] };
const SCENE_HUE = [[255, 170, 90], [255, 79, 163], [188, 214, 255], null];
function wave(col, str = 1, dark = false){ WAVES.push({ t0: clock, col: col || [255, 255, 255], str, dark }); if (WAVES.length > 4) WAVES.shift(); }
const COLC = new Map();
function parseCol(c){
  if (COLC.has(c)) return COLC.get(c);
  let v; if (c[0] === '#'){ const n = parseInt(c.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; } else { const m = c.match(/[\d.]+/g); v = m ? m.slice(0, 3).map(Number) : [255, 255, 255]; }
  COLC.set(c, v); return v;
}
const WAVE_R = t => RM ? 999 : 300 * (1 - Math.pow(1 - clamp(t / 720, 0, 1), 3));
// a colour wave drawn as a ring of brighter dots running out from the centre (the dark ones only dim the screen)
function drawWaves(now){
  // a wave is over after 1.9 s: drop it, so dot() stops looking it up
  while (WAVES.length && now - WAVES[0].t0 > 1900) WAVES.shift();
  for (const w0 of WAVES){
    const t = now - w0.t0; if (w0.dark || RM || t < 0 || t > 850) continue;
    const R = WAVE_R(t), k = w0.str * (1 - sstep(450, 850, t)), col = `rgb(${w0.col.join(',')})`;
    for (let y = C % P; y < S; y += P){
      const dy = y - C; if (Math.abs(dy) > R + 12) continue;
      for (let x = C % P; x < S; x += P){
        const d = Math.hypot(x - C, dy); if (d > 200 || Math.abs(d - R) > 22) continue;
        const bump = Math.exp(-Math.pow((d - R) / 11, 2));
        ctx.globalAlpha = clamp(0.6 * bump * k, 0, 1); ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, 0.9 + bump * 1.3 * k, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
function waveAt(x, y){
  let res = null;
  for (const w0 of WAVES){
    const t = clock - w0.t0; if (t < 0 || t > 1900) continue;
    const d = Math.hypot(x - C, y - C), R = WAVE_R(t);
    const behind = sstep(R + 10, R - 34, d), fade = 1 - sstep(850, 1900, t);
    const w = w0.str * behind * fade, bump = RM ? 0 : w0.str * Math.exp(-Math.pow((d - R) / 13, 2)) * (1 - sstep(450, 850, t));
    if (w > 0.01 || bump > 0.01) res = { w, bump, col: w0.col, dark: w0.dark };     // the latest wave wins
  }
  return res;
}
function tinted(col, wv){
  const c0 = parseCol(col), k = clamp(wv.w * 0.92 + wv.bump * 0.5, 0, 1);
  return `rgb(${lerp(c0[0], wv.col[0], k) | 0},${lerp(c0[1], wv.col[1], k) | 0},${lerp(c0[2], wv.col[2], k) | 0})`;
}
const COLLAPSE = { t0: -1e9, dur: 3600 };
let FACE = false;            // true while the face itself (time, rim, battery, date) is being drawn
// for what is not dots (type): how far it has fallen and how visible it is while the face is down
function collapseK(){
  const t = clock - COLLAPSE.t0; if (t < 0 || t > COLLAPSE.dur) return null;
  const tf = clamp((t - 150) / 1000, 0, 1.6), back = sstep(COLLAPSE.dur - 1000, COLLAPSE.dur - 80, t);
  return { dy: 0.5 * 1500 * tf * tf * (1 - back), a: Math.max(back, 1 - sstep(150, 650, t)) };
}
function collapseOffset(x, y){
  const t = clock - COLLAPSE.t0; if (t < 0 || t > COLLAPSE.dur) return null;
  const h1 = hash(Math.round(x * 3), Math.round(y * 3), 17), h2 = hash(Math.round(y * 3), Math.round(x * 3), 29);
  const delay = h1 * 260 + Math.max(0, (C - y)) * 0.6;           // the top lets go a moment later
  const tf = clamp((t - delay) / 1000, 0, 1.6);                   // seconds of fall
  const vx = (h2 - 0.5) * 140 + (x - C) * 0.6, vy = -60 - h1 * 120;
  let fx = x + vx * tf, fy = y + vy * tf + 0.5 * 1500 * tf * tf;
  // land on the curved bottom of the glass, in a little heap
  const R = 222 - h2 * 26, dx = fx - C, dy = fy - C, d = Math.hypot(dx, dy);
  if (d > R){ fx = C + dx / d * R; fy = C + dy / d * R; }
  // fly home
  const back = sstep(COLLAPSE.dur - 1000 + h1 * 200, COLLAPSE.dur - 80, t);
  return [lerp(fx, x, back), lerp(fy, y, back), back];
}
let PAINT = null;            // a colour for each dot by where it is (the clock wearing the cover)
function dot(x, y, r, col, a = 1, sy = 1, rot = 0, sx = 1){
  if (a <= 0.01 || r <= 0.05) return;
  if (PAINT) col = PAINT(x, y, col);
  if (FACE && clock - COLLAPSE.t0 < COLLAPSE.dur){ const o = collapseOffset(x, y); if (o){ x = o[0]; y = o[1]; } }
  if (TINT && WAVES.length){
    const m = ctx.getTransform(), X = (m.a * x + m.c * y + m.e) / DPR, Y = (m.b * x + m.d * y + m.f) / DPR, wv = waveAt(X, Y);
    if (wv){
      if (wv.dark) a *= 1 - 0.82 * wv.w;
      else { col = tinted(col, wv); a = Math.min(1, a + wv.bump * 0.45); }
      r += wv.bump * 0.9;
    }
  }
  ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = col;
  ctx.beginPath();
  if (sy === 1 && sx === 1) ctx.arc(x, y, r, 0, TAU); else ctx.ellipse(x, y, Math.max(0.2, r * sx), Math.max(0.2, r * sy), rot, 0, TAU);
  ctx.fill();
}
const snap = v => C + Math.round((v - C) / P) * P;

/* ---------- animated dot text: one slot per character, compared cell by cell ---------- */
function makeText(){ return { slots: [] }; }
function setText(T, str, now){
  const ch = [...str], n = ch.length;
  while (T.slots.length > n) T.slots.pop();
  for (let j = 0; j < n; j++){
    const c = ch[n - 1 - j];                  // slots are counted from the right, like an odometer
    let s = T.slots[j];
    if (!s){ s = T.slots[j] = { ch: c, prev: ' ', t0: now, dir: 1 }; continue; }
    if (s.ch !== c){ s.dir = (parseInt(c, 10) >= parseInt(s.ch, 10) || isNaN(parseInt(s.ch, 10))) ? 1 : -1; s.prev = s.ch; s.ch = c; s.t0 = now; }
  }
}
function resetText(T, now){ for (const s of T.slots){ s.prev = ' '; s.t0 = now; } }
// draw: cx,cy centre; p pitch; r dot radius; sq vertical squash (for the menu drum)
function drawText(T, font, cx, cy, p, r, col, now, o = {}){
  if (o.depth && !o._ext){
    // big numbers stand out of the glass: the depth engine repeats their dots behind, darker (no theme on those)
    const pp = PAINT, oo = Object.assign({}, o, { _ext: true });
    const res = DEPTH.extrude((c, front) => { PAINT = front ? pp : null; return drawText(T, font, cx, cy, p, r, c || col, now, oo); }, o.depth === true ? DEPTH.P.hero : o.depth);
    PAINT = pp; return res;
  }
  const { alpha = 1, sq = 1, gap = 1, stag = 55, doSnap = true } = o;
  const n = T.slots.length; if (!n) return 0;
  const gs = []; let cols = 0;
  for (let i = 0; i < n; i++){ const s = T.slots[n - 1 - i]; const g = glyph(font, s.ch); gs.push(g); cols += g.w + (i < n - 1 ? gap : 0); }
  const rows = gs[0].h;
  let x0 = cx - (cols - 1) * p / 2, y0 = cy - (rows - 1) * p * sq / 2;
  if (doSnap){ x0 = snap(x0); y0 = snap(y0); }
  if (o.ink){
    // centre on the lit dots, not on the cells (a "1" has an empty column on its left): half a pitch at most
    let lo = 1e9, hi = -1e9, xcI = 0;
    for (let i = 0; i < n; i++){ const g = gs[i]; for (const [c] of g.cells){ lo = Math.min(lo, xcI + c); hi = Math.max(hi, xcI + c); } xcI += g.w + gap; }
    if (hi >= lo) x0 -= ((lo + hi) / 2 - (cols - 1) / 2) * p;
  }
  let xc = 0, count = 0;
  for (let i = 0; i < n; i++){
    const s = T.slots[n - 1 - i], g = gs[i], pg = glyph(font, s.prev || ' ');
    const sx = x0 + xc * p;
    const el = now - s.t0 - (MODE === 'roll' ? (n - 1 - i) * stag : i * stag);
    if (RM || el > 1400 || s.prev === s.ch){
      for (const [c, rr] of g.cells){ dot(sx + c * p, y0 + rr * p * sq, r, col, alpha, sq); count++; }
    } else if (MODE === 'fall') count += drawFall(s, g, pg, sx, y0, p, r, col, alpha, sq, el, rows);
    else count += drawRoll(s, g, pg, sx, y0, p, r, col, alpha, sq, el, rows);
    xc += g.w + gap;
  }
  return count;
}
// caduta: what stays, stays; what leaves slides down and fades; what arrives falls from above, bottom rows first, and settles
function drawFall(s, g, pg, sx, y0, p, r, col, alpha, sq, el, rows){
  let n = 0;
  for (const [c, rr] of g.cells){
    const x = sx + c * p, yT = y0 + rr * p * sq;
    if (pg.set.has(c + ',' + rr)){ dot(x, yT, r, col, alpha, sq); n++; continue; }
    const delay = (rows - 1 - rr) * 26 + c * 9 + hash(c, rr, 3) * 18;
    const t = (el - delay) / 240;
    if (t < 0) continue;
    let y = yT, a = alpha;
    if (t < 1){ const D0 = 26 + rr * p * 0.6 + hash(c, rr) * 14; y = yT - D0 * (1 - t * t); a *= clamp(t * 3, 0, 1); }
    else if (t < 1.45){ const u = (t - 1) / 0.45; y = yT - 2.2 * Math.sin(u * Math.PI) * (1 - u); }
    const st = t < 1 ? 1 + 0.35 * t * t : 1;           // a falling dot stretches a hair
    dot(x, y, r, col, a, sq * (t < 1 ? st : 1)); n++;
  }
  for (const [c, rr] of pg.cells){
    if (g.set.has(c + ',' + rr)) continue;
    const delay = rr * 9 + hash(c, rr, 7) * 40;
    const t = (el - delay) / 200;
    if (t >= 1) continue;
    const x = sx + c * p, y = y0 + rr * p * sq + Math.max(0, t) * Math.max(0, t) * 44;
    dot(x, y, r * (1 - Math.max(0, t) * 0.4), col, alpha * (1 - Math.max(0, t)), sq); n++;
  }
  return n;
}
// rullo: each digit is printed on a drum; the old one rolls away, the new one rolls in
function drawRoll(s, g, pg, sx, y0, p, r, col, alpha, sq, el, rows){
  const e = eoc(el / 460), k = 0.8, h = rows * p * sq, R = h / (2 * k), cy = y0 + (rows - 1) * p * sq / 2;
  const amax = Math.asin(k), span = Math.PI / 2 + amax;
  let n = 0;
  const pass = (gl, phi) => {
    for (const [c, rr] of gl.cells){
      const yl = (rr - (rows - 1) / 2) / rows, a = Math.asin(clamp(2 * k * yl, -0.99, 0.99)) + phi;
      const cs = Math.cos(a); if (cs <= 0.02) continue;
      dot(sx + c * p, cy + R * Math.sin(a), r, col, alpha * Math.pow(cs, 1.3), sq * cs); n++;
    }
  };
  pass(pg, -s.dir * span * e);
  pass(g, s.dir * span * (1 - e));
  return n;
}
