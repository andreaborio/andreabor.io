/* The small dots of the clock face: the battery and its %, on a 3 px sub-grid of the 9 px grid. Loaded before Pip's
   host because his geometry (GEOM) stands on the battery. */
'use strict';
// the battery, on the same dots as everything else
function iconBattery(level){
  // like the menu's icons: a body with soft corners, a two-dot terminal, a fill that leaves one dot of air all round
  const cells = [], lit = Math.round(clamp(level, 0, 1) * 9);
  for (let c = 1; c < 12; c++){ cells.push([c, 0]); cells.push([c, 6]); }
  for (let r = 1; r < 6; r++){ cells.push([0, r]); cells.push([12, r]); }
  cells.push([13, 2]); cells.push([13, 3]); cells.push([13, 4]);
  const fill = [];
  for (let c = 0; c < lit; c++) for (let r = 2; r < 5; r++) fill.push([2 + c, r]);
  return { w: 14, h: 7, cells, fill };
}
// the small dots of the face (battery, its %) sit on a 3 px sub-grid of the main 9 px grid: they land exactly on dots
const SG = 3;
const sgx = v => C + Math.round((v - C) / SG) * SG;
function smCells(str, x0, y0, out, colTag){
  let xc = 0;
  for (const ch of String(str).toUpperCase()){ const g = smGlyph(ch); for (const [c, r] of g.cells) out.push([x0 + xc + c, y0 + r, colTag]); xc += g.w + 1; }
  return xc - 1;
}
function smWidth(str){ let w = 0; for (const ch of String(str).toUpperCase()) w += smGlyph(ch).w + 1; return w - 1; }
const BATT_PIV = C - 104;
function drawBattery(a, phi = 0, now = clock){
  // centred on its lit dots: body and terminal are 14 columns, so the body sits half a column left of the centre
  const batt = st.charging ? st.batt + (1 - st.batt) * ((now % 1600) / 1600) : st.batt, ic = iconBattery(batt), ox = sgx(C) - 6.5 * SG, oy = sgx(C - 117) - 3 * SG;
  if (phi){ ctx.save(); ctx.translate(C, BATT_PIV); ctx.rotate(phi); ctx.translate(-C, -BATT_PIV); }
  const fc = st.charging ? 'rgb(123,224,162)' : batt < 0.2 ? rgb(RED) : INK;
  for (const [c, r] of ic.cells) dot(ox + c * SG, oy + r * SG, 1.3, INK, a * 0.75);
  for (const [c, r] of ic.fill) dot(ox + c * SG, oy + r * SG, 1.35, fc, a);
  if (phi) ctx.restore();
  if (batt < 0.2 && !st.charging) drawPct(`${Math.round(batt * 100)}%`, a, now); else { PCT.state = 'whole'; PCT.parts = null; }
}
// the low-battery percentage, centred over the battery on the 3 px sub-grid (every glyph is an odd number of columns wide,
// so the middle column sits on the centre line). Pip never stands on it whole: when he gets there it shatters,
// and about a second after he leaves it comes back with the "Caduta", bottom rows first.
const PCT = { state: 'whole', t0: 0, parts: null, away: 0, key: '', cur: null };
function drawPct(pc, a, now){
  const w = smWidth(pc), cells = []; smCells(pc, 0, 0, cells);
  const px0 = sgx(C) - Math.floor(w / 2) * SG, py0 = sgx(C - 141) - 3 * SG, col = rgb(RED);
  const pts = cells.map(([c, r]) => [px0 + c * SG, py0 + r * SG, c, r]);
  if (PCT.key !== pc){ PCT.key = pc; PCT.state = 'whole'; PCT.parts = null; }
  const [bx, by, br] = BR.clock.bounds(), x0 = px0 - 2, x1 = px0 + (w - 1) * SG + 2, y0 = py0 - 2, y1 = py0 + 6 * SG + 2;
  const qx = clamp(bx, x0, x1), qy = clamp(by, y0, y1), near = Math.hypot(bx - qx, by - qy) < br || BR.clock.onBattery();
  const dt = Math.min(50, st.lastDt || 16) / 1000;
  if (near && PCT.state !== 'broken'){
    // it shatters: every dot flies off from where he hit it
    const from = PCT.state === 'back' && PCT.cur ? PCT.cur : pts.map(q => [q[0], q[1]]);
    PCT.parts = from.map(([x, y]) => { const dx = x - bx, dy = y - by, d = Math.hypot(dx, dy) || 1;
      return { x, y, vx: dx / d * (90 + Math.random() * 130) + (Math.random() - 0.5) * 70, vy: -110 - Math.random() * 170, b: 0 }; });
    PCT.state = 'broken'; PCT.t0 = now; PCT.away = 0; haptic('soft');
  }
  if (PCT.state === 'broken'){
    const t = now - PCT.t0, keep = FACE; FACE = false;
    PCT.away = near ? 0 : PCT.away + dt * 1000;
    for (const q of PCT.parts){
      q.vy += 1500 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const floor = Math.abs(q.x - C) < 22 ? C - 128 : C - 50;          // the battery's back, or the roof of the time
      if (q.y > floor && q.vy > 0 && q.b < 2){ q.y = floor; q.vy *= -0.38; q.vx *= 0.6; q.b++; }
      dot(q.x, q.y, 1.05, col, a * (1 - sstep(420, 1050, t)));
    }
    FACE = keep;
    if (PCT.away > 1000){ PCT.state = 'back'; PCT.t0 = now; PCT.parts = null; }
    return;
  }
  if (PCT.state === 'back'){
    const el = now - PCT.t0; PCT.cur = [];
    for (const [x, yT, c, r] of pts){
      const delay = (6 - r) * 26 + c * 9 + hash(c, r, 3) * 18, t = (el - delay) / 240;
      if (t < 0) continue;
      let y = yT, al = a;
      if (t < 1){ const D0 = 26 + r * SG * 0.6 + hash(c, r) * 14; y = yT - D0 * (1 - t * t); al *= clamp(t * 3, 0, 1); }
      else if (t < 1.45){ const u = (t - 1) / 0.45; y = yT - 2.2 * Math.sin(u * Math.PI) * (1 - u); }
      dot(x, y, 1.05, col, al, t < 1 ? 1 + 0.35 * t * t : 1); PCT.cur.push([x, y]);
    }
    if (el > 1300) PCT.state = 'whole';
    return;
  }
  for (const [x, y] of pts) dot(x, y, 1.05, col, a);
}
