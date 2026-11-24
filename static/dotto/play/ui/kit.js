/* Dotto's screen kit: the one template every screen uses (born in the first setup).

   Type and space for a 466 px round glass, 44.5 mm across (≈10.5 px per mm), read on a desk.
   Three text styles only. Body is what to do (≈3 mm tall, ≤ 20 characters), caption is one detail (≈2 mm, ≤ 28),
   label is where you are (≈1.5 mm, capitals, spaced). Hero words and numbers are dots.

   Five blocks, the same gap between them:  title (top arc) · hero · body + caption · Dotto on his floor · pills.
   The title sits on a band 184 px from the centre; progress dots sit on the rim at 213 (top and bottom alike).
   Pills: flat, white for the way forward, grey for the way out.

   A screen keeps its own small state (scr): its pills for hit-testing, the pressed pill, a toast, when its title came in.
   On the device: one LVGL screen with six fixed slots; Mona Sans rasterised at 30, 21 and 16 px. */
(function(global){
'use strict';
function create(H){
  const { C, INK, INK2, dot, label, labelW, E } = H;
  const { clamp, lerp, sstep } = E;
  // Doto: a dot-matrix face, round dots, black (900). 0.6 em per character, so a body line holds ~22 characters.
  // No grey: secondary text, labels and grey pills take the colour of the app (the accent the host sets per screen)
  const TS = {
    body:    { size: 32, weight: 900, caps: false, track: 0, col: null, bold: 0 },
    caption: { size: 26, weight: 900, caps: false, track: 0, col: null, bold: 0.03 },
    label:   { size: 22, weight: 900, caps: true, track: 0.04, col: null, bold: 0.05 }
  };
  // read from 40–50 cm on a 44.5 mm glass. Hierarchy: the hero (numbers, cover) first; the body (32 px, plain dots, ≤ 20
  // characters) says what it is; the caption (26 px, slightly bolder so it holds up) and the label (22 px, capitals,
  // boldest) are small, so they get their dots grown by a thin stroke
  // sizes for a 44.5 mm glass touched by an 8–10 mm fingertip: pills 44 px (4 mm) tall, their touch area 68 px (6.5 mm)
  const Y = { hero: C - 80, body: C + 30, caption: C + 68, stage: C + 138 };
  const PILL = { y: C + 182, h: 48, pad: 18, gap: 8, size: 24, hitY: 10, hitX: 6 };
  const BAND = 184, R_TITLE = BAND - TS.label.size * 0.42, R_RIM = 213, HERO_P = 6;
  const MONA = "'Doto', ui-monospace, monospace";
  const fade = (el, d = 0, ms = 280) => sstep(d, d + ms, el);
  let ACC = [255, 255, 255];
  const W0 = [255, 255, 255], mixA = (k, base = W0) => H.rgb(base.map((v, i) => v + (ACC[i] - v) * k));
  // the accent is lifted to its brightest, most vivid version (a dark cover colour still reads on black)
  const vivid = c => { const m = Math.max(...c) || 1; return c.map(v => Math.max(90, Math.round(v / m * 255))); };
  const setAccent = c => { ACC = c ? vivid(c) : W0; };
  // body is white; caption is white leaning to the accent; label is the accent; grey pills are the accent, dark
  const colOf = style => style === 'body' ? INK : style === 'caption' ? mixA(0.85) : mixA(1);
  // the depth engine (ui/depth.js), if the host has one: each slot sits on its plane
  const DP = H.depth, at = (z, fn) => DP ? DP.at(DP.P[z], fn) : fn();

  function text(style, str, y, a, o = {}){
    if (!str || a <= 0.01) return;
    const t = TS[style];
    // dynamic text (names of rooms, songs, errors) never runs off the glass: it is cut with "…" to the chord at that height
    if (!o.arc){
      const half = Math.sqrt(Math.max(0, 222 * 222 - (y - C) * (y - C))), max = 2 * half - 44;
      str = String(str); if (textW(style, str) > max){ while (str.length > 1 && textW(style, str + '…') > max) str = str.slice(0, -1).trimEnd(); str += '…'; }
    }
    label(str, { y, arc: o.arc || null, R: o.R, p: t.size / 5.2, col: o.col || colOf(style), a, weight: t.weight, caps: t.caps, track: t.track, bold: t.bold });
  }
  const textW = (style, str) => { const t = TS[style]; return labelW(str, t.size / 5.2, t.weight, t.caps, t.track); };
  // the width of the lit dots of a text (no side bearings): what to centre a group on
  const inkW = (style, str) => { const t = TS[style], ctx = H.ctx; ctx.save(); ctx.font = `900 ${t.size}px ${MONA}`; const m = ctx.measureText(t.caps ? String(str).toUpperCase() : String(str)); ctx.restore(); return m.actualBoundingBoxLeft + m.actualBoundingBoxRight; };
  const screen = () => ({ pills: [], pressK: null, pressT: -1e9, msg: '', msgT: -1e9, titleT0: 0 });
  const toast = (scr, str, now) => { scr.msg = str; scr.msgT = now; };

  // L = { title, body, caption, pills }; el = ms since the screen (or its phase) came in
  function compose(scr, L, a, el, now){
    at('title', () => text('label', L.title, 0, a * fade(now - scr.titleT0, 0, 220), { arc: 'top', R: R_TITLE, col: L.titleCol }));
    at('text', () => {
      text('body', L.body, Y.body, a * fade(el, 80), { col: L.bodyCol });
      const mt = now - scr.msgT;
      if (mt < 1700) text('caption', scr.msg, Y.caption, a * (mt < 1400 ? fade(mt, 0, 150) : 1 - (mt - 1400) / 300), { col: INK });
      else text('caption', L.caption, Y.caption, a * fade(el, 220));
    });
    at('pill', () => pills(scr, L.pills, a, el, now));
  }
  const GO = (t, act = 'tap') => ({ t, main: true, act }), OUT = (t, act) => ({ t, act });
  function pills(scr, list, a, el, now){
    scr.pills = [];
    if (!list || !list.length || a <= 0.01) return;
    const ctx = H.ctx; ctx.save();
    ctx.font = `900 ${PILL.size}px ${MONA}`;
    const ws = list.map(b => Math.max(96, Math.round(ctx.measureText(b.t).width) + PILL.pad * 2));
    const tot = ws.reduce((x, y) => x + y, 0) + PILL.gap * (list.length - 1), al = a * fade(el, 450, 300);
    let x = C - tot / 2;
    list.forEach((b, i) => {
      const w = ws[i], pr = scr.pressK === b.act ? clamp(1 - (now - scr.pressT) / 200, 0, 1) : 0, sc = 1 - 0.06 * pr;
      const cx = x + w / 2, cy = PILL.y, ww = w * sc, hh = PILL.h * sc;
      // a capsule of fine dots: light with dark type for the way forward, the app's colour (dim) for the way out;
      // press and hold fills it from the left in the accent
      ctx.restore(); ctx.save();
      if (b.main) capsule(cx, cy, ww, hh, INK, clamp(al, 0, 1), { fill: 0.16, edge: 0.95, prog: b.prog > 0 ? b.prog : -1, progCol: mixA(1) });
      else capsule(cx, cy, ww, hh, mixA(0.8), clamp(al, 0, 1), { fill: 0.34, edge: 0.34, prog: b.prog > 0 ? b.prog : -1, progCol: INK });
      ctx.font = `900 ${PILL.size}px ${MONA}`; ctx.globalAlpha = clamp(al, 0, 1);
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const im = ctx.measureText(b.t), ix = (im.actualBoundingBoxLeft - im.actualBoundingBoxRight) / 2;
      ctx.strokeStyle = INK; ctx.lineWidth = PILL.size * 0.03; ctx.fillText(b.t, cx + ix, cy + PILL.size * 0.35); ctx.strokeText(b.t, cx + ix, cy + PILL.size * 0.35);
      scr.pills.push({ x0: cx - w / 2 - PILL.hitX, y0: cy - PILL.h / 2 - PILL.hitY, x1: cx + w / 2 + PILL.hitX, y1: cy + PILL.h / 2 + PILL.hitY, act: b.act });
      x += w + PILL.gap;
    });
    if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
    ctx.restore();
  }
  // a capsule made of fine dots (4.5 px): the material of buttons and of the scene selector
  const FP = 4.5;
  // fill: alpha of the inside; edge: alpha of the dots along the border (a ring of dots draws the outline)
  // The shape of a capsule only depends on its size: its cells (offsets from the top left, and whether each is on the
  // border) are found once per (w, h) and kept. Port: a pill is one small const table per size used.
  const CAPS = new Map();
  function capsCells(w, h){
    const key = w + '|' + h; let L = CAPS.get(key); if (L) return L;
    if (CAPS.size > 32) CAPS.clear();
    const r = h / 2; L = [];
    for (let y = -r + FP / 2; y < r; y += FP) for (let x = FP / 2; x < w; x += FP){
      const dx = x < r ? r - x : x > w - r ? x - (w - r) : 0;
      const inner = x > r && x < w - r ? r - Math.abs(y) : r - Math.hypot(dx, y);
      if (inner >= 0.8) L.push({ x, y, edge: inner < FP + 0.8 });
    }
    CAPS.set(key, L); return L;
  }
  function capsule(cx, cy, w, h, col, a, o = {}){
    if (a <= 0.01) return;
    const { fill = 0.25, edge = 0.25, prog = -1, progCol = null } = o, x0 = cx - w / 2, px = w * prog;
    for (const q of capsCells(w, h)){
      const filled = prog >= 0 && q.x < px;
      dot(x0 + q.x, cy + q.y, q.edge ? 1.5 : 1.35, filled && progCol ? progCol : col, a * (filled ? 0.85 : q.edge ? edge : fill));
    }
  }
  // which pill a tap landed on (and press it), or null
  function hit(scr, p, now){
    const b = scr.pills.find(q => p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1);
    if (b){ scr.pressK = b.act; scr.pressT = now; }
    return b ? b.act : null;
  }
  // hero words: the 5 × 7 dot letters (on the 3 px sub-grid at the hero pitch)
  const word = (...args) => at('hero', () => word0(...args));
  function word0(str, cx, cy, p, col, a){
    const gs = [...String(str).toUpperCase()].map(H.smGlyph); let cols = 0; gs.forEach((g, i) => cols += g.w + (i < gs.length - 1 ? 1 : 0));
    let x0 = cx - (cols - 1) * p / 2, y0 = cy - 3 * p; if (p === HERO_P){ x0 = C + Math.round((x0 - C) / 3) * 3; y0 = C + Math.round((y0 - C) / 3) * 3; }
    const r = p * 0.36; let xc = 0, n = 0;
    for (const g of gs){ for (const [c, rr] of g.cells){ dot(x0 + (xc + c) * p, y0 + rr * p, r, col, a); n++; } xc += g.w + 1; }
    return n;
  }
  const wordCols = str => [...String(str).toUpperCase()].reduce((w, ch) => w + H.smGlyph(ch).w + 1, -1);
  // a drum of words on the hero line: the chosen one big, its neighbours small above and below. colOf(i, f) may tint
  const drum = (...args) => at('hero', () => drum0(...args));
  function drum0(items, selF, a, colOf){
    let n = 0;
    for (let i = 0; i < items.length; i++){
      const k = i - selF; if (Math.abs(k) > 1.6) continue;
      const f = 1 - clamp(Math.abs(k), 0, 1), y = Y.hero + 2 + k * 50;
      const p = Math.min(lerp(3.3, HERO_P, f), 330 / wordCols(items[i]));
      const col = (colOf && colOf(i, f)) || (f > 0.5 ? INK : mixA(0.7));
      n += word(items[i], C, y, p, col, a * lerp(0.4, 1, f) * (1 - sstep(1, 1.6, Math.abs(k))));
    }
    return n;
  }
  // progress on the rim, top arc: N dots; colOf(i) gives a colour for done ones; cur pulses
  function rimArc(N, cur, colOf, a, now, span = 0.085){
    for (let i = 0; i < N; i++){
      const an = -Math.PI / 2 + (i - (N - 1) / 2) * span, x = C + Math.cos(an) * R_RIM, y = C + Math.sin(an) * R_RIM, c = colOf(i);
      if (c) dot(x, y, 2.6, H.rgb(c), a);
      else if (i === cur) dot(x, y, 2.4 + Math.sin(now / 160) * 0.5, INK, a);
      else dot(x, y, 1.8, INK, a * 0.22);
    }
    return N;
  }
  // a QR made of dots (setup/qr.js): lit dots with the code punched out, rising in row by row.
  // t = ms since it came in; out = ms since it started to fall apart (-1); sync > 0: rings run out from the centre
  const qr = (...args) => at('hero', () => qr0(...args));
  function qr0(str, cx, cy, pitch, a, t, out = -1, sync = 0, now = 0){
    const q = global.DottoQR.make(str), Q = 3, n = q.n + Q * 2, x0 = cx - (n - 1) * pitch / 2, y0 = cy - (n - 1) * pitch / 2, { eoc, hash } = E;
    let c = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){
      const mx = x - Q, my = y - Q;
      if (mx >= 0 && my >= 0 && mx < q.n && my < q.n && q.m[my][mx]) continue;
      const h = hash(x, y, 5), k = clamp((t - y * 14 - h * 120) / 260, 0, 1); if (k <= 0) continue;
      let px = x0 + x * pitch, py = y0 + y * pitch - (1 - eoc(k)) * 14, al = a * k, r = pitch * 0.5;
      if (out >= 0){ const u = Math.max(0, out - h * 220 - (n - y) * 6) / 1000; py += 0.5 * 1400 * u * u; px += (h - 0.5) * 60 * u; al *= 1 - sstep(0.15, 0.5, u); }
      if (sync){
        const d = Math.hypot(px - cx, py - cy), w = 0.5 + 0.5 * Math.sin(d / 10 - now / (sync > 1 ? 70 : 150));
        const kk = Math.min(1, sync * 0.5 + 0.3); r *= 1 - kk * 0.5 * (1 - w); al *= 1 - kk * 0.6 * (1 - w);
      }
      if (al > 0.01){ dot(px, py, r, INK, al); c++; }
    }
    return c;
  }
  function spinner(cx, cy, a, now){ for (let i = 0; i < 8; i++){ const an = i / 8 * Math.PI * 2 + now / 260, k = ((i / 8) + now / 2080) % 1; dot(cx + Math.cos(an) * 16, cy + Math.sin(an) * 16, 1.7 + k, INK, a * (0.25 + 0.75 * k)); } return 8; }
  // rings and sliders are made of the same matrix as the background: the grid points (9 px) that fall on the arc light
  // up. The empty part is faint, the filled part is lit in the colour, the knob is a small cluster of bigger dots.
  // o: f (0–1), r (radius), cy, a0 and span (radians; default: the dial open at the bottom), act (held: brighter knob)
  // The lattice cells on a ring never change: they are found once per (radius, centre) and kept, sorted as found, with
  // their angle. A frame then only walks the ring (~350 cells for r 206) instead of the square around it (~8 000), and
  // the knob's glow is only worked out near the knob. Port: one const table per ring in flash (x, y, angle as u16).
  const GP = 4.5, RINGS = new Map();
  function ringCells(r, cy){
    const key = r + '|' + cy; let L = RINGS.get(key); if (L) return L;
    if (RINGS.size > 16) RINGS.clear();
    const band = GP * 0.6, ox = C % GP, oy = C % GP, xs = [], ys = [], an = [];
    const y0 = Math.max(oy, Math.floor((cy - r - band - oy) / GP) * GP + oy), y1 = cy + r + band;
    for (let y = y0; y <= y1; y += GP){
      for (let x = Math.floor((C - r - band - ox) / GP) * GP + ox; x <= C + r + band; x += GP){
        const dx = x - C, dy = y - cy; if (Math.abs(Math.hypot(dx, dy) - r) > band) continue;
        xs.push(x); ys.push(y); an.push(Math.atan2(dy, dx));
      }
    }
    L = { n: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), an: Float64Array.from(an) };
    RINGS.set(key, L); return L;
  }
  const KNOB_D2 = 160 * 7;                      // past this squared distance the knob's glow is under 0.001
  function arc(o){
    const { f = 0, r = 206, cy = C, a0 = 0.75 * Math.PI, span = 1.5 * Math.PI, act = false, a = 1, col = INK, knob = true } = o;
    if (a <= 0.01) return 0;
    const fc = clamp(f, 0, 1), e = a0 + span * fc, kx = C + Math.cos(e) * r, ky = cy + Math.sin(e) * r, kg = act ? 1.8 : 1.3;
    const R = ringCells(r, cy), litTo = span * fc + 0.01, TAU = 2 * Math.PI; let n = 0;
    for (let i = 0; i < R.n; i++){
      let rel = R.an[i] - a0; rel = ((rel % TAU) + TAU) % TAU; if (rel > span + 0.02) continue;
      const x = R.x[i], y = R.y[i], lit = rel <= litTo;
      let kk = 0;
      if (knob){ const kd2 = (x - kx) * (x - kx) + (y - ky) * (y - ky); if (kd2 < KNOB_D2) kk = Math.exp(-kd2 / 160); }
      dot(x, y, (lit ? 1.7 : 0.95) + kk * kg, col, a * Math.min(1, (lit ? 1 : 0.22) + kk)); n++;
    }
    return n;
  }
  // a segmented control: words in capitals; a white capsule slides under the chosen one.
  // scr keeps the capsule's position; segHit(scr, p) gives the index touched (each target ≥ 7 mm)
  const SEG = { size: 22, h: 38, pad: 10, gap: 0 };
  const segFont = ctx => { ctx.font = `900 ${SEG.size}px ${MONA}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; };
  function segLayout(items){
    const ctx = H.ctx; ctx.save(); segFont(ctx); const ws = items.map(n => Math.round(ctx.measureText(n.toUpperCase()).width) + SEG.pad * 2); ctx.restore();
    const tot = ws.reduce((x, y) => x + y, 0) + SEG.gap * (ws.length - 1); let x = C - tot / 2;
    return items.map((n, i) => { const r = { n, i, w: ws[i], x0: x - SEG.gap / 2, x1: x + ws[i] + SEG.gap / 2, cx: x + ws[i] / 2 }; x += ws[i] + SEG.gap; return r; });
  }
  const segments = (...args) => at('pill', () => segments0(...args));
  function segments0(scr, items, sel, y, a, dt = 16){
    const row = segLayout(items), r0 = row[clamp(sel, 0, row.length - 1)], ctx = H.ctx;
    scr.seg = { row, y };
    if (scr.capX == null){ scr.capX = r0.cx; scr.capW = r0.w; }
    const k = 1 - Math.exp(-dt / 70); scr.capX += (r0.cx - scr.capX) * k; scr.capW += (r0.w - scr.capW) * k;
    if (a <= 0.01) return;
    capsule(scr.capX, y, scr.capW, SEG.h, INK, a, { fill: 0.16, edge: 0.95 });
    ctx.save(); ctx.globalAlpha = a;
    segFont(ctx); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const r of row){
      const over = Math.abs(r.cx - scr.capX) < scr.capW / 2 - 4;
      ctx.fillStyle = over ? INK : colOf('caption'); ctx.globalAlpha = a;
      const im = ctx.measureText(r.n.toUpperCase()); ctx.fillText(r.n.toUpperCase(), r.cx + (im.actualBoundingBoxLeft - im.actualBoundingBoxRight) / 2, y + SEG.size * 0.35);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
    ctx.restore();
  }
  function segHit(scr, p){ if (!scr.seg || Math.abs(p.y - scr.seg.y) > 30) return -1; const r = scr.seg.row.find(q => p.x >= q.x0 && p.x <= q.x1); return r ? r.i : -1; }
  return { inkW, setAccent, colOf, segments, segHit, arc, qr, spinner, TS, Y, PILL, BAND, R_TITLE, R_RIM, HERO_P, fade, text, textW, screen, toast, compose, pills, hit, word, wordCols, drum, rimArc, GO, OUT };
}
global.DottoKit = { create };
})(window);
