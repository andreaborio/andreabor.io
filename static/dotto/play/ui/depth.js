/* Dotto's depth engine: the glass is a window, with things behind it and things in front of it.

   Every drawing lives on a plane (a number: negative is behind the glass, 0 is the glass, positive is in front).
   When you tilt Dotto each plane slides by its depth: the ones behind go one way, the ones in front the other, as
   if your eye moved over a window: the grid far behind, Dotto floating in front.
   At full tilt a plane moves 3.2 px per unit of depth (the grid, at −4, ~13 px; Dotto, at 2.2, ~7 px the other way):
   ~20 px between the farthest and the nearest thing, enough to read as depth on 44.5 mm, never enough to blur.
   The response is soft (tanh): a few degrees already show, past ~35° it saturates instead of hitting a wall.
   Neutral is however Dotto is held: the host takes the tilt from a slow baseline, so only movement counts.
   The tilt follows through a spring (it settles with a hint of overshoot); when Dotto just sits on the desk a very
   slow drift keeps the picture alive. The glass itself answers too (ui/crt.js): its highlight slides against the
   tilt and the bulge leans a little.

   Same style as everything else: depth is made of dots. Extrusion = the same dots repeated behind, darker.

   Use:  D.push(z) … D.pop()   or   D.at(z, fn)     place a drawing on a plane
         D.off(z)                                     the offset of a plane, for hand-made layers
         D.extrude(draw, z)                           draw(col, isFront) is called for the layers behind, then the front
         D.field(dot, a, now, o)                      the living background: a faint rain + touch ripples, one pass
         D.touch(x, y, now)                           a finger on the glass: a ripple runs through the grid
   Planes in use (D.P): back -4 (the grid), glow -2 (auras, light), glass 0 (rim controls), title .6, text 1,
   pill 1.2, hero 1.6 (big numbers, cover, QR), pip 2.2 (Dotto and his effects).

   On the ESP32-S3: the tilt is the QMI8658's gravity, low-passed at ~8 Hz; each plane is an LVGL layer drawn with an
   offset. When it moves the whole frame changes, so it is a full redraw: 466 × 466 RGB565 from PSRAM over QSPI,
   ~11 ms, inside 30 fps. Flat and still (no drift on battery saver) it costs nothing. */
(function(global){
'use strict';
function create(H){
  const { ctx, C } = H, TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const D = { x: 0, y: 0, vx: 0, vy: 0, on: true, drift: true, PX: 3.2, depthN: 0,
    P: { back: -4, glow: -2, glass: 0, title: 0.6, text: 1, pill: 1.2, hero: 1.6, pip: 2.2 } };

  // the tilt (degrees, from neutral) pulls the picture through a spring; the drift is a slow figure of eight.
  // Port: tanh is a 64-entry table; the spring is two multiply-adds per axis.
  D.step = (dt, roll, pitch, t) => {
    const s = Math.min(dt, 50) / 1000;
    let tx = Math.tanh(roll / 22), ty = Math.tanh(pitch / 22);
    if (D.drift){ tx += 0.09 * Math.sin(t / 3100); ty += 0.07 * Math.sin(t / 2300 + 1); }
    if (!D.on){ tx = 0; ty = 0; }
    const k = 70, c = 13;
    D.vx += (k * (tx - D.x) - c * D.vx) * s; D.vy += (k * (ty - D.y) - c * D.vy) * s;
    D.x += D.vx * s; D.y += D.vy * s;
  };
  D.off = z => [D.x * z * D.PX, D.y * z * D.PX];
  D.push = z => { ctx.save(); const [ox, oy] = D.off(z); ctx.translate(ox, oy); D.depthN++; };
  D.pop = () => { if (D.depthN > 0){ D.depthN--; ctx.restore(); } };
  D.at = (z, fn) => { D.push(z); try { return fn(); } finally { D.pop(); } };

  // extrusion: three layers of the same dots behind the front one, darker as they go back, a pixel lower each
  // (light from above); they spread apart only when Dotto tilts or drifts
  const EXT = ['#161615', '#222221', '#30302e'];
  D.extrude = (draw, z = D.P.hero) => {
    for (let l = 3; l >= 1; l--){
      ctx.save(); const [ox, oy] = D.off(z - l * 0.6); ctx.translate(ox, oy + l * 0.9);
      draw(EXT[3 - l], false); ctx.restore();
    }
    D.push(z); const r = draw(null, true); D.pop(); return r;
  };

  // the living background (≈1 600 grid dots inside the glass):
  // - rain: a faint digital rain in the app's colour on the grid's own dots: half the columns carry one drop with a
  //   brighter head; quiet behind the words and away from the rim. The CRT pass on top (ui/crt.js) gives it the
  //   old-monitor feel;
  // - ripples: where a finger touches, a ring runs through the dots.
  // Everything that does not move is worked out once (the table below): which grid dots are inside the glass, their
  // weight (rim fade × the quiet band behind the words), each column's drop (speed, trail, phase).
  // A frame without ripples then visits only the drops: ~25 columns × a ≤10-dot trail, no square roots.
  // With a ripple it walks the table once, and only dots on the ripple's band take a square root and an exp.
  // Port: the table is const (u8 row, u8 col, u8 weight); the drop head is a fixed-point counter per column.
  const RIP = [];
  D.touch = (x, y, now) => { RIP.push({ x, y, t0: now }); if (RIP.length > 3) RIP.shift(); };
  const h1 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const FIELD = new Map();                                   // "pitch|glass" → the table
  function fieldTable(P, G){
    const key = P + '|' + G; let F = FIELD.get(key); if (F) return F;
    const ox = C % P, ROWS = Math.ceil(2 * C / P) + 20, cols = Math.ceil((2 * C - ox) / P), rows = cols;
    const xs = [], ys = [], row = [], col = [], w = [], idx = new Int16Array(rows * cols).fill(-1);
    for (let y = ox, r = 0; y < 2 * C; y += P, r++){
      const words = 1 - 0.9 * sstep(C - 5, C + 25, y) * (1 - sstep(C + 95, C + 125, y));
      for (let x = ox, c = 0; x < 2 * C; x += P, c++){
        const dc = Math.hypot(x - C, y - C); if (dc > G) continue;
        idx[r * cols + c] = xs.length; xs.push(x); ys.push(y); row.push(r); col.push(c);
        w.push(0.24 * (1 - 0.8 * sstep(G - 50, G, dc)) * words);
      }
    }
    const drops = [];
    for (let c = 0; c < cols; c++) drops.push(h1(c, 14) > 0.5 ? { sp: 2.5 + h1(c, 11) * 5, tr: 4 + Math.floor(h1(c, 12) * 7), ph: h1(c, 13) * ROWS } : null);
    F = { n: xs.length, x: xs, y: ys, row, col, w, idx, rows, cols, ROWS, drops, head: new Float64Array(cols) };
    FIELD.set(key, F); return F;
  }
  const RIP_LIFE = 1400, RIP_V = 0.42, RIP_W = 11, RIP_REACH = 3 * RIP_W;   // past 3 widths a ripple adds < 0.0002
  D.field = (dot, a, now, o = {}) => {
    const P = o.P || 9, col = o.col || '#ffffff', head = o.head || '#ffffff', G = o.glass || 202, t = now / 1000;
    const F = fieldTable(P, G);
    while (RIP.length && now - RIP[0].t0 >= RIP_LIFE) RIP.shift();
    for (let c = 0; c < F.cols; c++){ const q = F.drops[c]; F.head[c] = q ? (t * q.sp + q.ph) % F.ROWS : -1e9; }
    // one grid dot: rain (from its column's head) + ripples
    const draw = (i, bump) => {
      const q = F.drops[F.col[i]]; let k = 0, isHead = false;
      if (q){ const d = F.head[F.col[i]] - F.row[i]; if (d >= 0 && d < q.tr){ k = Math.pow(1 - d / q.tr, 1.8); isHead = d < 1; } }
      k = k * F.w[i] + bump * 0.5;
      if (k < 0.02) return 0;
      dot(F.x[i], F.y[i], 0.95 + (isHead ? 0.5 : 0) + bump * 0.8, isHead ? head : col, a * Math.min(0.8, k * (isHead ? 1.7 : 1)));
      return 1;
    };
    let n = 0;
    if (!RIP.length){
      // only the drops: each column's trail, rows (head − trail, head]
      for (let c = 0; c < F.cols; c++){
        const q = F.drops[c]; if (!q) continue;
        const hd = F.head[c], r1 = Math.min(F.rows - 1, Math.floor(hd));
        for (let r = Math.max(0, Math.floor(hd - q.tr)); r <= r1; r++){ const i = F.idx[r * F.cols + c]; if (i >= 0) n += draw(i, 0); }
      }
      return n;
    }
    const rings = RIP.map(r => { const rt = now - r.t0, R = rt * RIP_V, lo = Math.max(0, R - RIP_REACH); return { x: r.x, y: r.y, R, k: 1 - rt / RIP_LIFE, lo2: lo * lo, hi2: (R + RIP_REACH) * (R + RIP_REACH) }; });
    for (let i = 0; i < F.n; i++){
      let bump = 0;
      for (const g of rings){
        const dx = F.x[i] - g.x, dy = F.y[i] - g.y, d2 = dx * dx + dy * dy; if (d2 < g.lo2 || d2 > g.hi2) continue;
        const q = (Math.sqrt(d2) - g.R) / RIP_W; bump += Math.exp(-q * q) * g.k;
      }
      n += draw(i, bump);
    }
    return n;
  };
  return D;
}
global.DottoDepth = { create };
})(window);
