/* Pip Engine: one body, one way of moving, for every place Pip shows up on the RoomGroove Puck.

   Layers (see ENGINE.md):
     1. body and physics   a feet point on a surface (rim circle or segment), or in the air under the device's real gravity
     2. locomotion         idle, walkTo, runTo, dashTo, jumpTo, fall, hop, grab/hang, climbUp, letGo, roll, stun, shakeOff
     3. animation          poses (sprites) + a small pose machine + procedural modifiers (squash, lean, turn, look, breath, hat lag)
     4. FX                 one particle pool: dust, ghosts, speed lines, stars, hearts, "!", sweat, smoke, soot, z's, sparks, debris,
                           flash, fireball; plus sprite() for props in real pixels
     5. reflexes           the IMU: slopes, grabbing ledges, swinging, flying off on a hard shake, rolling, getting up
     6. scenes v2          a script of engine commands on a timeline

   How it maps to LVGL on the ESP32-S3 (one Pip, a few dozen particles, nothing per pixel):
   - Poses are tiny bitmaps (at most 11×10 cells): a const uint8_t mask per pose in flash. A cell is a dot: one pre-rendered
     A8 dot (6×6 px) blitted with lv_draw_image and a recolour, or lv_draw_arc for very small radii.
   - The transform (feet position, rotation from the surface normal + lean, squash, mirror) is a 2×2 matrix in Q16 fixed point,
     applied to ~70 cells per frame. Accessories (hats, glasses, headphones) are more cells in the same grid.
   - Physics is explicit Euler at the display rate (30–60 Hz) on floats (the S3 has an FPU). One body, a handful of surfaces
     per screen (one circle, ≤ 8 segments, ≤ 3 boxes): collision is point/segment, circle/box, ring radius. O(surfaces).
   - FX: a fixed pool (MAX_FX = 64) of structs {x, y, vx, vy, life, max, kind, size}. Dot FX use the dot blit, pixel FX use
     lv_draw_rect fills (one per horizontal run of equal colour).
   - sprite(): pixel props are run-length rows in flash, one lv_draw_rect per run; rotated props are pre-rotated at 16 angles.
   - The fireball is a ≤ 19×19 cell grid evaluated per frame from a distance + hash LUT; the flash is a single full-screen fill.
   - Haptics map engine events to DRV2605L effects: detent → 1 (strong click), soft → 7, confirm → 14, heavy → 47 (buzz).
   - The pose machine and the commands are plain enums + timers: no allocation per frame. */
(function(global){
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const eoc = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const normA = v => { v = (v + Math.PI) % TAU; if (v < 0) v += TAU; return v - Math.PI; };
const hash = (a, b, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
const sgn = v => v < 0 ? -1 : 1;
const upAngle = (ux, uy) => Math.atan2(ux, -uy);              // the rotation that turns the sprite's "up" into (ux, uy)

/* ---------- 3. poses: '#' body, 'e' eye (a hole), '.' nothing. Sprites face right; the feet are the bottom row ---------- */
const POSES = {
  idle:    ['...###...','.#######.','#########','##e###e##','##e###e##','#########','.#######.','..#...#..'],
  blink:   ['...###...','.#######.','#########','#########','##e###e##','#########','.#######.','..#...#..'],
  idle2:   ['...###...','.#######.','##e###e##','##e###e##','#########','.#######.','..#...#..'],
  crouch:  ['...#####...','.#########.','###e###e###','###########','###########','.##.....##.'],
  land:    ['..#######..','.#########.','###e###e###','###########','#.#######.#'],
  stretch: ['...#...','..###..','.#####.','##e#e##','##e#e##','#######','#######','#######','.#####.','..###..','..#.#..'],
  arms:    ['#.........#','.#..###..#.','..#######..','..#e###e#..','..#e###e#..','..#######..','...#####...','...#...#...'],
  sleep:   ['.........','...###...','.#######.','#########','#..###..#','#########','.#######.'],
  lookup:  ['...###...','.#######.','##e###e##','##e###e##','#########','#########','.#######.','..#...#..'],
  lookdown:['...###...','.#######.','#########','#########','##e###e##','##e###e##','.#######.','..#...#..'],
  talk:    ['...###...','.#######.','#########','##e###e##','##e###e##','###...###','.#######.','..#...#..'],
  tap:     ['...###...','.#######.','#########','##e###e##','##e###e##','#########','.#######.','..#......'],
  dizzy:   ['...###...','.#######.','#e#e#e#e#','##e###e##','#e#e#e#e#','#########','.#######.','..#...#..'],
  ball:    ['..###..','.#####.','#######','#######','#######','.#####.','..###..'],
  run1:    ['...###...','.#######.','#########','###e###e#','###e###e#','#########','.#######.','.#.....#.'],
  run2:    ['.........','...###...','.#######.','#########','###e###e#','###e###e#','#########','.#######.','...#.#...'],
  run3:    ['...###...','.#######.','#########','###e###e#','###e###e#','#########','.#######.','..#....#.'],
  run4:    ['.........','...###...','.#######.','#########','###e###e#','###e###e#','#########','.#######.','....##...'],
  fall:    ['...###...','.#######.','#########','##e###e##','##e###e##','#########','.#######.','.#.....#.'],
  dash:    ['.........','..#######.','.#########','###e###e##','###e###e##','.#########','..######..'],
  sit:     ['.........','...###...','.#######.','#########','##e###e##','##e###e##','#########','.#######.'],
  yawn:    ['.........','...###...','.#######.','#########','##e###e##','#########','###...###','.#######.'],
  // new for the engine
  sitblink:['.........','...###...','.#######.','#########','#########','##e###e##','#########','.#######.'],
  ears:    ['.##.###.##.','#..#####..#','#.#######.#','.#########.','.##e###e##.','.#########.','..#######..','...#...#...'],
  earsTight:['.##.###.##.','#..#####..#','#.#######.#','.##e###e##.','.#########.','..#######..','..##...##..'],
  hang:    ['..#...#..','..#...#..','..#####..','.#######.','#########','##e###e##','##e###e##','#########','.#######.','..#...#..'],
  hang2:   ['..#...#..','..#...#..','..#####..','.#######.','#########','##e###e##','##e###e##','#########','.#######.','.#.....#.'],
  climb1:  ['.##...##.','..#####..','.#######.','#########','##e###e##','##e###e##','#########','.#######.','..#...#..'],
  climb2:  ['.##...##.','.#######.','#########','##e###e##','##e###e##','#########','.#######.','.##......'],
  pull:    ['...###....','.#######..','#########.','##e###e###','##e###e#..','#########.','.#######..','.#....#...'],
  wide:    ['...###...','.#######.','##ee#ee##','##ee#ee##','#########','#########','.#######.','..#...#..'],
  // for the first setup: a shrug (hands up, eyes half shut) and a sad slump (eyes sloping down, a row lower)
  shrug:   ['.....###.....','...#######...','#.#########.#','.###########.','..##e###e##..','..#########..','...#######...','....#...#....'],
  sad:     ['.........','...###...','.#######.','#########','#e#####e#','##e###e##','.#######.','..#...#..']
};
const CELLS = {};
function cells(name){
  if (CELLS[name]) return CELLS[name];
  const rows = POSES[name] || POSES.idle, body = [], eyes = [];
  rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') body.push([c, r]); else if (v === 'e') eyes.push([c, r]); }));
  let top = 0; while (top < rows.length && !/[#e]/.test(rows[top])) top++;
  const tr = [...rows[top]].map((v, c) => v === '#' ? c : -1).filter(c => c >= 0);
  const topC = tr.length ? (tr[0] + tr[tr.length - 1]) / 2 : (rows[0].length - 1) / 2;
  let eyeC = null;
  if (eyes.length){ let sx = 0, sy = 0; for (const [c, r] of eyes){ sx += c; sy += r; } eyeC = [sx / eyes.length, sy / eyes.length]; }
  return (CELLS[name] = { w: rows[0].length, h: rows.length, body, eyes, top, topC, eyeC });
}
const BODYSET = {};
const bodySet = name => BODYSET[name] || (BODYSET[name] = new Set(cells(name).body.map(([c, r]) => c + ',' + r)));
const IDLE_TOP = [4, 0], IDLE_EYE = [4, 3.5];
// where the head starts, for poses whose top row is arms
const HEAD = { hang: [4, 2], hang2: [4, 2], climb1: [4, 1], climb2: [4, 1], arms: [5, 1] };

/* accessories, in the idle frame's grid (9×8): they follow the head or the eyes of whatever pose he is in.
   k = radius factor, c = colour key (i ink, k black, r red, w warm white) */
const ACC = {
  bedhead: { at: 'head', sway: 1, cells: [[2,-1],[3,-2],[4,-1],[5,-2],[6,-1],[1,0],[7,0]] },
  cap:     { at: 'head', sway: 0.4, cells: [[2,-2],[3,-2],[4,-2],[5,-2],[6,-2],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[7,-1],[8,-1],[9,-1]] },
  party:   { at: 'head', sway: 1, cells: [[4,-4],[3,-3],[5,-3],[3,-2],[5,-2],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[4,-5.2,1.6,'r']] },
  nightcap:{ at: 'head', sway: 1.2, cells: [[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[3,-2],[4,-2],[5,-2],[6,-2],[5,-3],[6,-3],[7,-3],[8,-2],[8,-1]] },
  roof:    { at: 'head', sway: 0.3, cells: [[4,-4],[3,-3],[5,-3],[2,-2],[6,-2],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[7,-1]] },
  phones:  { at: 'head', sway: 0, cells: [[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[7,-1],[0,0],[8,0],[-1,2,1.25],[-1,3,1.25],[-1,4,1.25],[9,2,1.25],[9,3,1.25],[9,4,1.25]] },
  sun:     { at: 'eyes', sway: 0, cells: [[1,3,1.25,'k'],[2,3,1.25,'k'],[3,3,1.25,'k'],[5,3,1.25,'k'],[6,3,1.25,'k'],[7,3,1.25,'k'],[1,4,1.25,'k'],[2,4,1.25,'k'],[3,4,1.25,'k'],[5,4,1.25,'k'],[6,4,1.25,'k'],[7,4,1.25,'k'],[4,3,1.25,'k'],[0,3,0.9],[8,3,0.9]] },
  glasses: { at: 'eyes', sway: 0, cells: [[1,3,1.2,'k'],[3,3,1.2,'k'],[1,4,1.2,'k'],[3,4,1.2,'k'],[5,3,1.2,'k'],[7,3,1.2,'k'],[5,4,1.2,'k'],[7,4,1.2,'k'],[4,3,1.2,'k'],[2,2,1.2,'k'],[6,2,1.2,'k'],[2,5,1.2,'k'],[6,5,1.2,'k']] },
  bulb:    { at: 'head', sway: 1.4, cells: [[4,-1],[4,-2]], bulb: true }
};
const SKINS = {
  none: { n: 'nessuna', acc: [] }, bedhead: { n: 'spettinato', acc: ['bedhead'] }, sun: { n: 'occhiali da sole', acc: ['sun'] },
  glasses: { n: 'occhiali da vista', acc: ['glasses'] }, cap: { n: 'cappellino', acc: ['cap'] }, party: { n: 'cappello da festa', acc: ['party'] },
  nightcap: { n: 'berretto da notte', acc: ['nightcap'] }, phones: { n: 'cuffie', acc: ['phones'] }
};
const blinkAt = now => { const t = (now + 1234) % 3900; return t < 120 || (t > 260 && t < 360 && (Math.floor(now / 3900) % 3 === 0)); };

/* z's for sleep, drawn in dots: small, medium, large */
const ZEE = [['####','..#.','.#..','####'], ['#####','...#.','..#..','.#...','#####'], ['#####','...#.','..#..','.#...','#####']];
const ZEE_P = [1.9, 2.3, 3.1];

/* ---------- the engine ---------- */
function create(host){
  const H = Object.assign({ C: 233, S: 466, INK: '#ffffff', INK2: '#c4c4c0', RED: [255, 59, 47] }, host);
  const { ctx } = H, C = H.C;
  const dot = (x, y, r, col, a) => H.dot(x, y, r, col, a);
  const haptic = k => { if (k && H.haptic) H.haptic(k); };
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const HEART = rgb([255 * 0.75 + 242 * 0.25, 59 * 0.75 + 242 * 0.25, 47 * 0.75 + 240 * 0.25]);
  const E = { G: 1400, g: [0, 1400], gu: [0, 1], TAU, clamp, lerp, sstep, normA, hash, eoc, POSES, SKINS, ACC, blink: blinkAt, now: 0, frameN: 0 };
  const worlds = {};

  // the device's real gravity, from the IMU: (gx, gy) in g's, in screen coordinates (y down)
  // how long a jump should take: short hops are quick, and he must arrive moving into the target floor
  E.planT = (dx, dy, ux, uy) => {
    let T = clamp(0.3 + Math.hypot(dx, dy) / 1100, 0.32, 0.62);
    if (ux == null) return T;
    const gx = E.g[0], gy = E.g[1], ok = T0 => (dx / T0 + 0.5 * gx * T0) * ux + (dy / T0 + 0.5 * gy * T0) * uy < -40;
    if (ok(T)) return T;
    for (let k = 1; k < 14; k++) for (const T1 of [T * Math.pow(1.12, k), T * Math.pow(0.88, k)]) if (T1 > 0.16 && T1 < 0.9 && ok(T1)) return T1;
    return T;
  };
  // where a planned arc is at f (0..1): the brains use it to check the way is clear
  E.arcAt = (x0, y0, x1, y1, T, f) => [x0 + (x1 - x0) * f + 0.5 * E.g[0] * T * T * f * (f - 1), y0 + (y1 - y0) * f + 0.5 * E.g[1] * T * T * f * (f - 1)];
  E.setGravity = (gx, gy) => { E.g[0] = gx * E.G; E.g[1] = gy * E.G; const m = Math.hypot(gx, gy) || 1; E.gu[0] = gx / m; E.gu[1] = gy / m; };

  /* ---------- pixel props: real filled squares, not dots ---------- */
  E.sprite = (rows, x, y, o = {}) => {
    const { px = 3, palette = {}, rot = 0, anchor = 'c', a = 1, mirror = false } = o;
    const w = rows[0].length, h = rows.length;
    const x0 = -w * px / 2, y0 = anchor === 'bottom' ? -h * px : -h * px / 2;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (mirror) ctx.scale(-1, 1);
    ctx.globalAlpha = clamp(a, 0, 1);
    const ov = rot ? 0.35 : 0;                          // a hair of overlap so rotated pixels do not show seams
    for (let r = 0; r < h; r++){
      const row = rows[r]; let c = 0;
      while (c < w){
        const ch = row[c]; if (ch === '.' || ch === ' ' || !palette[ch]){ c++; continue; }
        let e = c + 1; while (e < w && row[e] === ch) e++;  // one rect per run
        ctx.fillStyle = palette[ch]; ctx.fillRect(x0 + c * px - ov, y0 + r * px - ov, (e - c) * px + ov * 2, px + ov * 2);
        c = e;
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  };

  /* ---------- 3. the one draw: any pose, anywhere, with the full transform ---------- */
  function drawPose(pose, x, y, o = {}){
    const g = cells(pose), p = o.p || 5.2, r = o.r || 2, a = o.a == null ? 1 : o.a, col = o.col || H.INK;
    const rot = o.rot || 0, mir = o.mirror ? -1 : 1, sx = o.sx || 1, sy = o.sy || 1, eyeDx = o.eyeDx || 0;
    const ox = o.ox || 0, oy = o.oy || 0, cs = Math.cos(rot), sn = Math.sin(rot), cx = (g.w - 1) / 2, by = g.h - 1;
    const W = (c, rr) => { const lx = ((c - cx) * p * sx + ox) * mir, ly = (rr - by) * p * sy + oy; return [x + lx * cs - ly * sn, y + lx * sn + ly * cs]; };
    let n = 0;
    const holes = new Set(); for (const [c, rr] of g.eyes) holes.add((c + eyeDx) + ',' + rr);
    const soot = o.soot || 0, bodyCol = soot > 0 ? mixHex(col, '#3a3a38', soot) : col;
    for (const list of [g.body, g.eyes]) for (const [c, rr] of list){
      if (holes.has(c + ',' + rr)){
        if (soot > 0.5){ const [wx, wy] = W(c, rr); dot(wx, wy, r * 0.85, H.INK, a); n++; }   // blackened: only the eyes stay white
        continue;
      }
      const [wx, wy] = W(c, rr); dot(wx, wy, r, bodyCol, a); n++;
    }
    if (o.acc && o.acc.length && pose !== 'ball'){
      for (const name of o.acc){
        const A = ACC[name]; if (!A) continue;
        let dc, dr;
        if (A.at === 'eyes'){ if (!g.eyeC) continue; dc = g.eyeC[0] - IDLE_EYE[0]; dr = g.eyeC[1] - IDLE_EYE[1]; }
        else { const hd = HEAD[pose]; dc = (hd ? hd[0] : g.topC) - IDLE_TOP[0]; dr = (hd ? hd[1] : g.top) - IDLE_TOP[1]; }
        const lag = o.lag || [0, 0];
        for (const q of A.cells){
          const [c0, r0, k = 1, ck = 'i'] = q;
          const up = Math.max(0, -r0) / 4 * A.sway;                 // higher cells sway more
          const c = c0 + dc + lag[0] * up / p, rr = r0 + dr + lag[1] * up / p;
          if (Number.isInteger(c) && Number.isInteger(rr) && bodySet(pose).has(c + ',' + rr)) continue;   // never a dot on a dot
          const [wx, wy] = W(c, rr);
          dot(wx, wy, r * k, ck === 'k' ? '#000' : ck === 'r' ? rgb(H.RED) : ck === 'w' ? '#fff3dc' : bodyCol, a); n++;
        }
        if (A.bulb){
          const lvl = o.bulb == null ? 1 : o.bulb, [bx, byy] = W(4 + dc + lag[0] * 1.4 / p, -3.6 + dr + lag[1] * 1.4 / p);
          const pulse = 0.75 + 0.25 * Math.sin(E.now / 420), gr = ctx.createRadialGradient(bx, byy, 0, bx, byy, 22);
          gr.addColorStop(0, `rgba(255,236,200,${0.45 * lvl * pulse * a})`); gr.addColorStop(1, 'rgba(255,236,200,0)');
          ctx.fillStyle = gr; ctx.fillRect(bx - 22, byy - 22, 44, 44);
          dot(bx, byy, r * 1.8, '#fff3dc', a * (0.35 + 0.65 * lvl)); n++;
        }
      }
    }
    return n;
  }
  E.drawPose = drawPose;
  const HEXC = new Map();
  function mixHex(a, b, t){
    const pa = parseC(a), pb = parseC(b); return rgb([lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), lerp(pa[2], pb[2], t)]);
  }
  function parseC(c){
    if (HEXC.has(c)) return HEXC.get(c);
    let v; if (c[0] === '#'){ const n = parseInt(c.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; } else { const m = c.match(/[\d.]+/g); v = m ? m.slice(0, 3).map(Number) : [255, 255, 255]; }
    HEXC.set(c, v); return v;
  }

  /* little drawn shapes shared by the FX */
  function sparkle(x, y, size, spin, col, a){
    if (a <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 8; i++){ const an = i / 8 * TAU, rr = i % 2 ? size * 0.28 : size; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
  }
  function heart(x, y, sz, col, a){
    if (a <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(sz / 10, sz / 10); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-8, -3, -4, -10, 0, -5); ctx.bezierCurveTo(4, -10, 8, -3, 0, 3); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
  }
  E.sparkle = sparkle; E.heart = heart;

  /* ---------- 4. FX: one pool per world ---------- */
  function makeFx(W){
    const L = [], MAX = 64;
    const F = { list: L, flashN: 0, balls: [] };
    const add = q => { q.life = 0; if (L.length >= MAX) L.shift(); L.push(q); return q; };
    // dust off the feet, in the surface's frame: spread along the floor, up off it, back = pushed behind him
    F.puff = (P, n = 4, spread = 40, upv = 22, back = 0) => {
      const f = P.frame();
      for (let i = 0; i < n; i++){
        const tg = (Math.random() - 0.5) * spread - back * P.face, inw = upv * (0.4 + Math.random());
        add({ k: 'dust', x: f.x, y: f.y, vx: f.tx * tg + f.ux * inw, vy: f.ty * tg + f.uy * inw, max: 280 + Math.random() * 260, r: 1.2 + Math.random() * 1.2 });
      }
    };
    F.dustAt = (x, y, n = 6, speed = 60) => { for (let i = 0; i < n; i++){ const an = Math.random() * TAU, v = speed * (0.4 + Math.random()); add({ k: 'dust', x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, max: 300 + Math.random() * 300, r: 1.2 + Math.random() * 1.4 }); } };
    F.dust = (x, y, vx, vy, max = 320, r = 1.4) => add({ k: 'dust', x, y, vx, vy, max, r });
    F.ghost = (P, pose) => add({ k: 'ghost', x: P.x, y: P.y, rot: P.rot, mirror: P.mirror, pose, p: P.p, r: P.r, max: 220 });
    F.bang = (P, ms = 420) => add({ k: 'bang', P, max: ms });
    F.stars = (P, ms = 1000) => add({ k: 'stars', P, max: ms });
    F.hearts = (P) => add({ k: 'hearts', P, max: 1330 });
    F.sweat = (P, side = 1) => add({ k: 'sweat', P, side, max: 650 });
    F.drops = (P) => { const f = P.frame(), hx = f.x + f.ux * P.p * 5, hy = f.y + f.uy * P.p * 5;
      for (let i = 0; i < 6; i++){ const sd = i % 2 ? 1 : -1, v = 70 + Math.random() * 80; add({ k: 'dust', x: hx + f.tx * sd * P.p * 4, y: hy + f.ty * sd * P.p * 4, vx: f.tx * sd * v + f.ux * 40, vy: f.ty * sd * v + f.uy * 40, max: 260 + Math.random() * 160, r: 1.1 }); } };
    F.zee = (P, size = 0, big = false) => add({ k: 'zee', P, size, x: 0, y: 0, max: big ? 2000 : 1700, seed: Math.random() * 10, big });
    F.zeeAt = (x, y, ux, uy, size = 0) => add({ k: 'zee', P: null, size, x, y, ux, uy, max: 1700, seed: Math.random() * 10 });
    F.sparks = (x, y, n = 3, o = {}) => { const { speed = 90, cols = ['#fff6d0', '#ffd23f', '#ff8c1a'], g = 260, size = 2 } = o;
      for (let i = 0; i < n; i++){ const an = (o.dir != null ? o.dir + (Math.random() - 0.5) * (o.spread || 2) : Math.random() * TAU), v = speed * (0.4 + Math.random());
        add({ k: 'px', x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, g, max: 160 + Math.random() * 220, s: size, col: cols[(Math.random() * cols.length) | 0] }); } };
    F.debris = (x, y, n = 20, o = {}) => { const cols = o.cols || ['#ffffff', '#ffd23f', '#ff8c1a', '#ff3b2f', '#b3261e', '#6e6e6c'];
      for (let i = 0; i < n; i++){ const an = (o.dir != null ? o.dir + (Math.random() - 0.5) * (o.spread || 3.2) : Math.random() * TAU), v = (o.speed || 380) * (0.35 + Math.random() * 0.9);
        add({ k: 'px', x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, g: o.g == null ? 700 : o.g, max: 700 + Math.random() * 700, s: 2 + ((Math.random() * 3) | 0), col: cols[(Math.random() * cols.length) | 0], spin: true }); } };
    F.smoke = (x, y, n = 6, o = {}) => { for (let i = 0; i < n; i++) add({ k: 'smoke', x: x + (Math.random() - 0.5) * (o.spread || 30), y: y + (Math.random() - 0.5) * (o.spread || 30), vx: (Math.random() - 0.5) * 30 + (o.vx || 0), vy: (Math.random() - 0.5) * 30 + (o.vy || -26), max: 900 + Math.random() * 900, s: 4 + ((Math.random() * 3) | 0) }); };
    F.soot = (x, y, n = 8) => { for (let i = 0; i < n; i++){ const an = Math.random() * TAU, v = 30 + Math.random() * 60; add({ k: 'dust', x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, max: 500 + Math.random() * 400, r: 1.3, col: '#5d5d5a', g: 200 }); } };
    F.flash = (frames = 2) => { F.flashN = frames; };
    F.fireball = (x, y, o = {}) => { F.balls.push({ x, y, t: 0, R: o.R || 54, px: o.px || 6, seed: Math.random() * 100 }); };
    F.ring = (x, y, o = {}) => add({ k: 'ring', x, y, max: o.ms || 420, R: o.R || 90, col: o.col || '#ffd23f' });
    F.clear = () => { L.length = 0; F.balls.length = 0; F.flashN = 0; };

    F.step = dt => {
      const s = dt / 1000, drag = Math.pow(0.93, s * 60);
      for (const q of L){
        q.life += dt;
        if (q.k === 'dust' || q.k === 'px' || q.k === 'smoke'){
          q.x += q.vx * s; q.y += q.vy * s;
          if (q.k === 'dust'){ q.vx *= drag; q.vy *= drag; if (q.g) q.vy += q.g * s; }
          else if (q.k === 'px'){ q.vy += (q.g || 0) * s; q.vx *= Math.pow(0.99, s * 60); }
          else { q.vx *= Math.pow(0.97, s * 60); q.vy *= Math.pow(0.985, s * 60); }
        }
      }
      for (let i = L.length - 1; i >= 0; i--) if (L[i].life >= L[i].max || (L[i].P && L[i].P.gone)) L.splice(i, 1);
      for (const b of F.balls) b.t += dt;
      for (let i = F.balls.length - 1; i >= 0; i--) if (F.balls[i].t > 1500) F.balls.splice(i, 1);
    };
    F.draw = (a, layer) => {
      let n = 0;
      for (const q of L){
        const k = 1 - q.life / q.max;
        if (layer === 'back'){
          if (q.k === 'dust'){ dot(q.x, q.y, q.r * (0.6 + 0.4 * k), q.col || H.INK, a * 0.7 * k); n++; }
          else if (q.k === 'ghost'){ n += drawPose(q.pose, q.x, q.y, { p: q.p, r: q.r, rot: q.rot, mirror: q.mirror, eyeDx: 1, a: a * 0.32 * k }); }
          else if (q.k === 'smoke'){ const sz = q.s * (1 + q.life / q.max * 0.8); ctx.globalAlpha = clamp(a * 0.55 * k, 0, 1); ctx.fillStyle = q.life < 200 ? '#9a9a97' : '#5f5f5c'; ctx.fillRect(Math.round(q.x - sz / 2), Math.round(q.y - sz / 2), sz, sz); ctx.globalAlpha = 1; n++; }
          continue;
        }
        if (q.k === 'px'){ const sz = q.s; ctx.globalAlpha = clamp(a * Math.min(1, k * 2.5), 0, 1); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x - sz / 2), Math.round(q.y - sz / 2), sz, sz); ctx.globalAlpha = 1; n++; }
        else if (q.k === 'ring'){ const f = q.life / q.max, R = q.R * eoc(f); ctx.globalAlpha = clamp(a * (1 - f) * 0.8, 0, 1); ctx.strokeStyle = q.col; ctx.lineWidth = 3 * (1 - f) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; n += 12; }
        else if (q.k === 'bang'){
          const f = q.P.frame(), off = q.P.height() + 6, hx = f.x + f.ux * off, hy = f.y + f.uy * off;
          for (const j of [0, 1, 2, 4]) dot(hx + f.ux * (12 - j * 3.4), hy + f.uy * (12 - j * 3.4), 1.7, H.INK, a); n += 4;
        } else if (q.k === 'stars'){
          const f = q.P.frame(), lift = 8 * q.P.p + 8, cx = f.x + f.ux * lift, cy = f.y + f.uy * lift, fade = 1 - sstep(0.75, 1, q.life / q.max);
          for (let j = 0; j < 3; j++){
            const an = E.now / 260 + j * TAU / 3, ca = Math.cos(an) * 24, sa = Math.sin(an) * 7;
            const x = cx + f.tx * ca * q.P.face - f.ux * sa, y = cy + f.ty * ca * q.P.face - f.uy * sa;
            const front = Math.sin(an) > 0, tw = 0.8 + 0.2 * Math.sin(E.now / 70 + j * 2);
            sparkle(x, y, (front ? 6 : 4.6) * tw, E.now / 180 + j, front ? '#fff2c4' : '#c9b98a', a * fade * (front ? 1 : 0.6)); n += 3;
          }
        } else if (q.k === 'hearts'){
          const f = q.P.frame(), base = q.P.center();
          for (let j = 0; j < 3; j++){
            const z = clamp((q.life - j * 160) / 1000, 0, 1), side = (j - 1) * 14 + Math.sin(z * 8 + j) * 3, up = 30 + z * 40;
            heart(base[0] + f.tx * side + f.ux * up, base[1] + f.ty * side + f.uy * up, 8 + j, HEART, a * Math.sin(Math.PI * z));
          }
          n += 9;
        } else if (q.k === 'sweat'){
          const f = q.P.frame(), t = q.life / q.max, side = q.side * q.P.face;
          const hx = f.x + f.ux * q.P.p * 7 + f.tx * side * q.P.p * 4.2, hy = f.y + f.uy * q.P.p * 7 + f.ty * side * q.P.p * 4.2;
          const dx = f.tx * side * t * 6 - f.ux * t * t * 18, dy = f.ty * side * t * 6 - f.uy * t * t * 18, al = a * (1 - sstep(0.6, 1, t));
          dot(hx + dx, hy + dy, 1.9, '#bfe6ff', al); dot(hx + dx + f.ux * 2.4, hy + dy + f.uy * 2.4, 1.2, '#bfe6ff', al); dot(hx + dx + f.ux * 4.2, hy + dy + f.uy * 4.2, 0.7, '#bfe6ff', al); n += 3;
        } else if (q.k === 'zee'){
          let bx, by, ux, uy;
          if (q.P){ const f = q.P.frame(); ux = f.ux; uy = f.uy; bx = f.x + f.ux * (q.P.p * 7) + f.tx * q.P.face * q.P.p * 3; by = f.y + f.uy * (q.P.p * 7) + f.ty * q.P.face * q.P.p * 3; }
          else { bx = q.x; by = q.y; ux = q.ux; uy = q.uy; }
          const t = q.life / q.max, rise = t * (q.big ? 46 : 38), wob = Math.sin(t * 7 + q.seed) * 5;
          const x = bx + ux * rise - uy * (wob + t * 10), y = by + uy * rise + ux * (wob + t * 10);
          const rows = ZEE[q.size], zp = ZEE_P[q.size] * (q.big ? 1.25 : 1) * (0.7 + 0.3 * eoc(t * 4)), al = a * Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.95;
          const w = rows[0].length, h = rows.length;
          for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (rows[r][c] === '#'){ dot(x + (c - (w - 1) / 2) * zp, y + (r - (h - 1) / 2) * zp, zp * 0.36 + 0.2, H.INK, al); n++; }
        }
      }
      if (layer !== 'back'){
        for (const b of F.balls) n += drawFireball(b, a);
        if (F.flashN > 0){ ctx.globalAlpha = F.flashN > 1 ? 1 : 0.65; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, H.S, H.S); ctx.globalAlpha = 1; F.flashN--; }
      }
      return n;
    };
    // a pixel-art fireball: white core, yellow, orange, red rim, then grey smoke that rises and breaks up
    function drawFireball(b, a){
      const t = b.t, px = b.px, R = b.R * (0.25 + 0.75 * eoc(t / 300)) * (1 + sstep(500, 1500, t) * 0.35);
      const cells = Math.ceil(R / px), rise = sstep(350, 1500, t) * 34, ox = b.x - (b.x % px), oy = b.y - (b.y % px);
      let n = 0;
      for (let j = -cells; j <= cells; j++) for (let i = -cells; i <= cells; i++){
        const d = Math.hypot(i, j) * px; if (d > R) continue;
        const nz = hash(i, j, b.seed + Math.floor(t / 70)), heat = 1 - d / R + (nz - 0.5) * 0.45 - t / 900;
        const keep = hash(j, i, b.seed) > sstep(700, 1500, t) * 1.05; if (!keep) continue;
        let col;
        if (t < 90) col = heat > 0.35 ? '#ffffff' : '#fff2b0';
        else if (heat > 0.62) col = '#ffffff'; else if (heat > 0.42) col = '#ffd23f'; else if (heat > 0.22) col = '#ff8c1a';
        else if (heat > 0.04) col = '#ff3b2f'; else if (heat > -0.3) col = t < 420 ? '#b3261e' : '#6e6e6c'; else col = '#4a4a48';
        const yy = oy + j * px - rise * (1 - d / R * 0.5);
        ctx.globalAlpha = clamp(a * (t > 900 ? 1 - sstep(900, 1500, t) * 0.9 : 1), 0, 1); ctx.fillStyle = col;
        ctx.fillRect(ox + i * px, Math.round(yy), px, px); n++;
      }
      ctx.globalAlpha = 1; return n;
    }
    return F;
  }

  /* ---------- 1. worlds: the surfaces, ledges and obstacles of one screen ---------- */
  E.world = name => worlds[name] || (worlds[name] = makeWorld(name));
  function makeWorld(name){
    const W = { name, surfs: new Map(), boxes: [], stamp: 0, pips: [], dt: 16, ev: {} };
    W.fx = makeFx(W);
    W.begin = now => { W.stamp++; W.boxes.length = 0; if (now != null) E.now = now; };
    W.on = (e, fn) => { (W.ev[e] = W.ev[e] || []).push(fn); };
    W.emit = (e, ...args) => { let out; for (const fn of W.ev[e] || []){ const r = fn(...args); if (r !== undefined) out = r; } return out; };
    // a circle seen from inside: the rim. up points to the centre
    W.ring = (id, o) => { const S = upsert(id, 'ring', o); S.cx = o.cx; S.cy = o.cy; S.R = o.R; return S; };
    // a straight piece of floor: centre (x, y), direction ang, half length hl; up is to the left of the direction
    W.seg = (id, o) => {
      const S = upsert(id, 'seg', o), ang = o.ang || 0;
      if (S.stamp0 === W.stamp - 1){ S.dx = o.x - S.x; S.dy = o.y - S.y; } else { S.dx = 0; S.dy = 0; }
      S.x = o.x; S.y = o.y; S.tx = Math.cos(ang); S.ty = Math.sin(ang); S.hl = o.hl;
      S.ledges = o.ledges === true ? [-1, 1] : (o.ledges || []); S.slip = !!o.slip; S.mu = o.mu == null ? 0.22 : o.mu;
      S.stamp0 = W.stamp; return S;
    };
    // something solid he may not enter: [x0, y0, x1, y1]
    W.box = b => { W.boxes.push(b); };
    function upsert(id, kind, o){
      let S = W.surfs.get(id);
      if (!S){ S = { id, kind, dx: 0, dy: 0, ledges: [], stamp: -1 }; W.surfs.set(id, S); }
      S.kind = kind; S.stamp = W.stamp; S.tag = o.tag || id; S.ceil = o.ceil; return S;
    }
    W.get = id => { const S = typeof id === 'string' ? W.surfs.get(id) : id; return S && S.stamp === W.stamp ? S : null; };
    W.active = () => [...W.surfs.values()].filter(S => S.stamp === W.stamp);
    W.ledges = () => {
      const out = [];
      for (const S of W.surfs.values()){
        if (S.stamp !== W.stamp || S.kind !== 'seg') continue;
        for (const side of S.ledges){ const [x, y] = ledgePoint(S, side); out.push({ S, side, x, y }); }
      }
      return out;
    };
    // how far off the rim a body of height ph may go at angle th, without entering a box
    W.ceilingAt = (th, ph, ring) => {
      const R = ring ? ring.R : 208, cx = ring ? ring.cx : C, cy = ring ? ring.cy : C;
      const dx = Math.cos(th), dy = Math.sin(th); let far = 0;
      for (const [X0, Y0, X1, Y1] of W.boxes){
        const x0 = X0 - cx, y0 = Y0 - cy, x1 = X1 - cx, y1 = Y1 - cy;
        let tin = -1e9, tout = 1e9, hit = true;
        for (const [d, lo, hi] of [[dx, x0, x1], [dy, y0, y1]]){
          if (Math.abs(d) < 1e-6){ if (lo > 0 || hi < 0){ hit = false; break; } continue; }
          let ta = lo / d, tb = hi / d; if (ta > tb){ const q = ta; ta = tb; tb = q; }
          tin = Math.max(tin, ta); tout = Math.min(tout, tb);
        }
        if (hit && tin <= tout && tout > 0) far = Math.max(far, tout);
      }
      return Math.max(0, R - ph - far - 4);
    };
    W.spawn = o => { const P = makePip(W, o || {}); W.pips.push(P); return P; };
    W.step = (dt, now) => { E.now = now; W.dt = dt; for (const P of W.pips) if (P.on) P.step(dt, now); W.fx.step(dt); };
    // the host may put the world on a plane of its depth engine (layerIn / layerOut)
    W.draw = (a, now) => {
      if (H.layerIn) H.layerIn();
      E.now = now; let n = W.fx.draw(a, 'back');
      for (const P of W.pips) if (P.on) n += P.draw(a, now);
      if (H.layerOut) H.layerOut();
      return n;
    };
    W.drawFront = a => { if (H.layerIn) H.layerIn(); const n = W.fx.draw(a, 'front'); if (H.layerOut) H.layerOut(); return n; };
    // the IMU: a jolt of the whole device (k ≈ 0.5 a shake, 1 a hard one)
    W.shake = k => { for (const P of W.pips) if (P.on) P.jolt(k); };
    W.spin = rate => { for (const P of W.pips) if (P.on) P.spinInput(rate); };
    return W;
  }
  function sPos(S, s){ return S.kind === 'ring' ? [S.cx + Math.cos(s) * S.R, S.cy + Math.sin(s) * S.R] : [S.x + S.tx * s, S.y + S.ty * s]; }
  function sTan(S, s){ return S.kind === 'ring' ? [-Math.sin(s), Math.cos(s)] : [S.tx, S.ty]; }
  function sUp(S, s){ return S.kind === 'ring' ? [-Math.cos(s), -Math.sin(s)] : [S.ty, -S.tx]; }
  const pxPer = S => S.kind === 'ring' ? S.R : 1;
  function ledgePoint(S, side){ const [x, y] = sPos(S, side * S.hl); return [x + S.tx * side * 4 + S.ty * 1, y + S.ty * side * 4 - S.tx * 1]; }
  E.sPos = sPos; E.sUp = sUp; E.sTan = sTan;

  /* ---------- 1–3. Pip: one body ---------- */
  function makePip(W, o){
    const P = {
      W, on: true, p: o.p || 4.5, r: o.r || 2, col: null, a: 1,
      surf: null, s: 0, vs: 0, h: 0, vh: 0, x: C, y: C, vx: 0, vy: 0, rot: 0, face: 1, mirror: false,
      air: null, hang: null, climb: null, roll: null, cmd: null, reflex: null, until: 0, sliding: false, grip: true,
      hold: null, shot: null, eyeDx: 0, look: null, accs: [], bulb: 1, soot: 0, trem: 0, off: [0, 0], wob: null,
      sq: 1, sqV: 0, lean: 0, leanV: 0, lag: [0, 0], lagV: [0, 0], turn: null, landT: -1e9, runPh: 0, ghostT: 0, puffT: 0,
      lastV: [0, 0], spinT: 0, spinAcc: 0, mood: null
    };
    const emit = (e, ...a) => W.emit(e, P, ...a);
    P.height = () => 8 * P.p + 18;                                    // with a hat on
    // the frame at the feet: position, up, and the tangent (forward = +s for surfaces)
    P.frame = () => {
      const ux = Math.sin(P.rot), uy = -Math.cos(P.rot);
      let tx = -uy, ty = ux;
      if (P.surf){ const t = sTan(P.surf, P.s); tx = t[0]; ty = t[1]; }
      return { x: P.x, y: P.y, ux, uy, tx, ty };
    };
    P.center = () => { const ux = Math.sin(P.rot), uy = -Math.cos(P.rot); return [P.x + ux * 18 * P.p / 4.5, P.y + uy * 18 * P.p / 4.5]; };
    P.ready = () => !P.reflex && !P.sliding && !P.air && !P.hang && !P.climb && !P.roll && !!P.surf;
    P.idleNow = () => P.ready() && !P.cmd && P.h <= 0;
    P.state = () => P.reflex || (P.sliding ? 'slide' : P.hang ? 'hang' : P.climb ? 'climb' : P.roll ? 'roll' : P.air ? 'air' : P.cmd ? (P.cmd.phase || P.cmd.type) : P.h > 0 ? 'air' : 'idle');

    /* ----- placing ----- */
    function attach(S, s){
      P.surf = S; P.s = S.kind === 'ring' ? normA(s) : clamp(s, -S.hl, S.hl); P.h = 0; P.vh = 0; P.air = null; P.hang = null; P.climb = null;
      syncSurf();
    }
    function syncSurf(){
      const S = P.surf, [x, y] = sPos(S, P.s), [ux, uy] = sUp(S, P.s);
      P.x = x + ux * P.h; P.y = y + uy * P.h; P.rot = upAngle(ux, uy);
    }
    P.place = (S, s = 0) => { S = W.get(S) || (typeof S === 'object' ? S : null); if (!S) return P; attach(S, s); P.vs = 0; P.cmd = null; P.reflex = null; P.sliding = false; P.roll = null; P.lastV = [0, 0]; return P; };
    P.placeAt = (x, y, rot = 0) => { P.surf = null; P.x = x; P.y = y; P.rot = rot; P.air = null; P.hang = null; return P; };

    /* ----- 2. locomotion ----- */
    P.idle = () => { P.cmd = null; P.hold = null; return P; };
    P.goTo = (target, o = {}) => { if (!P.surf) return P; P.cmd = { type: 'go', target, vmax: o.vmax || 120, k: o.k || 4, acc: o.acc || 900, gait: o.gait || 'walk', done: o.done }; return P; };
    P.walkTo = (target, o = {}) => P.goTo(target, Object.assign({ vmax: 34, k: 6, acc: 420, gait: 'walk' }, o));
    P.runTo = (target, o = {}) => P.goTo(target, Object.assign({ vmax: 480, k: 4, acc: 2200, gait: 'run' }, o));
    // the cartoon dash: "!", the legs go round like a wheel, off like a rocket, skid to a stop
    P.dashTo = (target, o = {}) => {
      if (!P.surf) return P;
      P.cmd = { type: 'dash', target, dir: o.dir || 1, phase: o.notice === false ? 'windup' : 'notice', t0: E.now, notice: o.notice !== false, windup: o.windup || 620, done: o.done };
      P.face = P.cmd.dir;
      if (P.cmd.notice){ P.hop(170); W.fx.bang(P, 420); } else haptic('detent');
      return P;
    };
    P.hop = (v = 220) => { if (!P.surf || P.air) return P; if (P.h <= 0.01){ P.vh = v; P.h = 0.01; } return P; };
    P.sit = () => { P.cmd = null; P.hold = 'sit'; return P; };
    P.sleep = () => { P.cmd = null; P.hold = 'sleep'; return P; };
    P.pose = name => { P.hold = name; return P; };
    P.play = (pose, ms = 1e9) => { P.shot = { pose, until: E.now + ms }; return P; };
    P.stopPlay = () => { P.shot = null; return P; };
    P.eyes = dx => { P.eyeDx = dx; P.look = null; return P; };
    P.lookAt = (x, y) => { P.look = x == null ? null : [x, y]; return P; };
    P.wear = (...names) => { P.accs = names.flat().filter(Boolean).flatMap(n => SKINS[n] ? SKINS[n].acc : [n]); return P; };
    P.tremble = k => { P.trem = k; return P; };
    P.offset = (dx, dy) => { P.off[0] = dx; P.off[1] = dy; return P; };
    P.tint = col => { P.col = col; return P; };
    P.wobble = (amp = 0.12, ms = 500, rate = 55) => { P.wob = { t0: E.now, amp, ms, rate }; return P; };
    // a ballistic arc to a point on a surface ({surf, s}) or to a point in space ([x, y]); the arc honours the real gravity
    P.jumpTo = (target, o = {}) => {
      const tg = resolve(target); if (!tg) return P;
      const x0 = P.x, y0 = P.y, dx = tg.x - x0, dy = tg.y - y0;
      const T = o.T || E.planT(dx, dy, tg.S ? tg.ux : null, tg.S ? tg.uy : null);
      P.cmd = null; P.sliding = false;
      P.air = { kind: 'arc', t: -(o.antic == null ? 60 : o.antic) / 1000, T, x0, y0, rot0: P.rot, target, spin: o.spin || 0, pose: o.pose, from: P.surf, fromS: P.s, done: o.done };
      return P;
    };
    // let go: free fall under the device's gravity, with an optional kick
    P.fall = (o = {}) => {
      const [vx, vy] = o.v || P.lastV, from = P.surf;
      P.surf = null; P.hang = null; P.climb = null; P.cmd = null; P.sliding = false; P.roll = null;
      P.air = { kind: 'free', t: 0, vx, vy, spin: o.spin || 0, pose: o.pose, grab: !!o.grab, ignore: o.ignore || from, after: o.after || null };
      return P;
    };
    P.grab = (L) => { startHang(L.S, L.side, 0); return P; };
    P.letGo = () => { if (!P.hang) return P; const H0 = P.hang, v = hangVel(); P.hang = null; P.reflex = 'drop'; P.fall({ v, ignore: H0.S, after: 'shakeoff' }); P.reflex = 'drop'; return P; };
    P.climbUp = () => { if (!P.hang) return P; const H0 = P.hang; P.hang = null; P.climb = { t0: E.now, S: H0.S, side: H0.side, x0: P.x, y0: P.y, rot0: P.rot }; P.reflex = 'climb'; haptic('detent'); return P; };
    P.roll_ = v => { P.roll = { v }; P.reflex = 'roll'; return P; };
    P.stun = (ms = 1000, stars = true) => { P.reflex = 'stun'; P.until = E.now + ms; P.cmd = null; if (stars) W.fx.stars(P, ms + 200); return P; };
    P.shakeOff = () => { P.reflex = 'shakeoff'; P.until = E.now + 480; P.wobble(0.24, 460, 22); W.fx.drops(P); haptic('detent'); return P; };
    P.say = (what, o) => { if (what === '!') W.fx.bang(P, o || 600); else if (what === 'sweat') W.fx.sweat(P, o || 1); else if (what === 'hearts') W.fx.hearts(P); else if (what === 'stars') W.fx.stars(P, o || 1000); else if (what === 'zee') W.fx.zee(P, o || 0); return P; };

    function resolve(target){
      const t = typeof target === 'function' ? target() : target;
      if (!t) return null;
      if (Array.isArray(t)) return { x: t[0], y: t[1], S: null, ux: 0, uy: -1 };
      const S = W.get(t.surf); if (!S) return null;
      let s = typeof t.s === 'function' ? t.s() : (t.s || 0); if (S.kind === 'seg') s = clamp(s, -S.hl, S.hl);
      const [x, y] = sPos(S, s), [ux, uy] = sUp(S, s);
      return { x, y, S, s, ux, uy };
    }

    /* ----- landing, grabbing ----- */
    function land(S, s, vx, vy){
      const [ux, uy] = sUp(S, s), [tx, ty] = sTan(S, s), vn = -(vx * ux + vy * uy), vt = vx * tx + vy * ty;
      const was = P.reflex, after = P.air && P.air.after;
      attach(S, s); P.vs = S.kind === 'ring' ? 0 : clamp(vt * 0.5, -260, 260);
      P.landT = E.now; P.sqV -= clamp(vn / 240, 0.6, 5.5);
      W.fx.puff(P, vn > 500 ? 6 : 4, 40, 22);
      if (was === 'flung'){
        if (S.kind === 'ring' && Math.abs(vt) > 150) P.roll_(vt);
        else { P.vs = 0; P.stun(900); }
      } else if (after === 'shakeoff') P.shakeOff();
      else if (was === 'drop') P.reflex = null;
      const hk = emit('land', S, vn);
      haptic(hk !== undefined ? hk : vn > 620 ? 'confirm' : vn > 140 ? 'soft' : null);
    }
    function startHang(S, side, av){
      const [lx, ly] = ledgePoint(S, side), ux = Math.sin(P.rot), uy = -Math.cos(P.rot);
      P.surf = null; P.air = null; P.cmd = null; P.sliding = false;
      P.hang = { S, side, a: Math.atan2(-ux, -uy), av, calm: 0, t0: E.now };
      P.reflex = 'hang'; P.sqV -= 1.5;
      W.fx.dustAt(lx, ly, 3, 40); haptic('soft'); emit('grab', S, side);
    }
    const hangLen = () => (cells('hang').h - 1) * P.p;
    function hangVel(){ const H0 = P.hang, l = hangLen() * 0.6; return [Math.cos(H0.a) * H0.av * l, -Math.sin(H0.a) * H0.av * l]; }

    /* ----- 5. the IMU, as Pip feels it ----- */
    P.jolt = k => {
      if (P.hang){ if (k >= 1){ const v = hangVel(); P.hang = null; flung([v[0] + (Math.random() - 0.5) * 500, v[1] - 260]); } else P.hang.av += (Math.random() < 0.5 ? -1 : 1) * 4.5 * k; return; }
      if (P.air){ if (P.air.kind === 'free'){ P.air.vx += (Math.random() - 0.5) * 500 * k; P.air.vy += (Math.random() - 0.5) * 500 * k; } return; }
      if (!P.surf) return;
      const f = P.frame();
      if (k >= 1){
        // a hard shake: he loses his grip and goes flying, mostly off the floor
        const side = Math.random() < 0.5 ? -1 : 1, up = 380 + Math.random() * 240, tan = side * (160 + Math.random() * 260);
        let vx = f.ux * up + f.tx * tan, vy = f.uy * up + f.ty * tan;
        if (P.surf.kind === 'seg'){ const sd = P.s ? sgn(P.s) : side, sp = clamp((P.surf.hl - sd * P.s) / 0.3, 220, 620); vx = f.tx * sd * sp + f.ux * 160; vy = f.ty * sd * sp + f.uy * 160; }  // off a word: towards its nearest end
        flung([vx, vy]);
      } else {
        // a shake: a startled hop, a drop of sweat, and a nudge on slippery ground
        P.hop(200 + Math.random() * 80); W.fx.sweat(P, Math.random() < 0.5 ? -1 : 1);
        if (P.surf.slip) P.vs += (Math.random() < 0.5 ? -1 : 1) * 90;
        P.wobble(0.18, 420, 40);
      }
    };
    function flung(v){
      const from = P.surf;
      P.fall({ v, spin: (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 6), grab: true, ignore: from });
      P.reflex = 'flung'; P.until = E.now + 4000; haptic('confirm'); W.fx.bang(P, 380);
    }
    // the dial (yaw): spin it fast and the rim slides under his feet
    P.spinInput = rate => {
      if (!P.surf || P.surf.kind !== 'ring' || P.air || Math.abs(rate) < 140) return;
      P.spinT = E.now; P.spinAcc += Math.abs(rate) * W.dt / 1000;
      P.s = normA(P.s - rate * Math.PI / 180 * W.dt / 1000 * 0.45); if (P.reflex !== 'spin'){ P.reflex = 'spin'; P.cmd = null; }
    };

    /* ----- stepping ----- */
    P.step = (dt, now) => {
      const s = Math.min(0.05, dt / 1000), x0 = P.x, y0 = P.y;
      if (P.surf && P.surf.stamp !== W.stamp && !P.air){ P.surf = null; P.fall({ v: [0, 0] }); }   // the floor is gone
      if (P.hang) stepHang(s, now);
      else if (P.climb) stepClimb(s, now);
      else if (P.air) stepAir(s, now);
      else if (P.surf) stepSurf(s, now);
      // reflex timers
      if (P.reflex === 'stun' && now > P.until) P.shakeOff();
      else if (P.reflex === 'shakeoff' && now > P.until){ P.reflex = null; emit('recovered'); }
      else if (P.reflex === 'spin' && now - P.spinT > 220){ const k = P.spinAcc; P.spinAcc = 0; if (k > 60) P.stun(900); else P.reflex = null; }
      else if (P.reflex === 'flung' && !P.air && !P.hang && !P.roll && now > P.until) P.reflex = null;
      // what the eye sees: velocity, acceleration → squash, lean, the hat lagging behind
      const vx = (P.x - x0) / s, vy = (P.y - y0) / s, jump = Math.hypot(vx - P.lastV[0], vy - P.lastV[1]) > 6000;
      const ax = jump ? 0 : (vx - P.lastV[0]) / s, ay = jump ? 0 : (vy - P.lastV[1]) / s;
      P.lastV = jump ? [0, 0] : [vx, vy]; P.vx = vx; P.vy = vy;
      const ux = Math.sin(P.rot), uy = -Math.cos(P.rot), lxA = ax * -uy + ay * ux, lyA = -(ax * ux + ay * uy);
      const vUp = vx * ux + vy * uy, airborne = P.air || P.h > 0.5;
      const sqT = airborne ? 1 + clamp(Math.abs(vUp) / 2400, 0, 0.09) : 1;          // the stretch pose already stretches: the spring only adds a hair
      P.sqV += ((sqT - P.sq) * 900 - P.sqV * 26) * s; P.sq = clamp(P.sq + P.sqV * s, 0.55, 1.35);
      const onFloor = P.surf && !P.air && P.h <= 0.5 && !P.cmd;
      const leanT = onFloor ? clamp(lxA / 9000, -0.16, 0.16) : 0;
      P.leanV += ((leanT - P.lean) * 260 - P.leanV * 22) * s; P.lean += P.leanV * s;
      for (let i = 0; i < 2; i++){
        const tgt = clamp(-(i ? lyA : lxA) * 0.0016, -3, 3);
        P.lagV[i] += ((tgt - P.lag[i]) * 240 - P.lagV[i] * 9) * s; P.lag[i] = clamp(P.lag[i] + P.lagV[i] * s, -4, 4);
      }
    };
    function stepSurf(s, now){
      const S = P.surf, k = pxPer(S);
      if (S.kind === 'seg' && S.slip && P.h <= 0 && !P.climb){
        const gt = E.g[0] * S.tx + E.g[1] * S.ty, lim = S.mu * E.G;
        if (!P.sliding && Math.abs(gt) > lim && P.reflex !== 'stun'){ P.sliding = true; P.cmd = null; emit('slip', S); }
        if (P.sliding){
          P.vs += (gt - sgn(P.vs || gt) * 0.1 * E.G) * s;
          if (now - P.puffT > 70){ P.puffT = now; W.fx.puff(P, 1, 20, 14, 30); }
          if (Math.abs(gt) < lim * 0.8 && Math.abs(P.vs) < 25){ P.sliding = false; P.vs = 0; emit('stopslip'); }
        }
      }
      if (!P.sliding && !P.roll){
        if (P.cmd) runCmd(s, now, S, k);
        else if (P.vs){ const d = 900 * s; P.vs = Math.abs(P.vs) <= d ? 0 : P.vs - sgn(P.vs) * d; }
      }
      if (P.roll){
        const R = P.roll; R.v -= sgn(R.v) * Math.min(Math.abs(R.v), 380 * s); P.vs = R.v;
        if (now - P.puffT > 90){ P.puffT = now; W.fx.puff(P, 1, 20, 12); }
        if (Math.abs(R.v) < 22){ P.roll = null; P.vs = 0; P.stun(1000); }
      }
      P.s += P.vs / k * s;
      if (S.kind === 'ring') P.s = normA(P.s);
      else if (Math.abs(P.s) > S.hl){
        const side = sgn(P.s);
        if (P.grip && S.ledges.includes(side) && P.h <= 0.5){ P.s = side * S.hl; syncSurf(); startHang(S, side, side * clamp(P.vs / 30, -6, 6)); return; }
        P.s = side * S.hl; syncSurf();
        const [tx, ty] = sTan(S, P.s), dt = W.dt / 1000 || 0.016;
        P.fall({ v: [tx * P.vs + S.dx / dt, ty * P.vs + S.dy / dt], ignore: S });
        if (!P.grip) P.air.noGrab = true;
        return;
      }
      if (P.h > 0 || P.vh > 0){
        P.vh -= 1150 * s; P.h += P.vh * s;
        const ceil = S.kind === 'ring' ? (S.ceil === false ? 1e9 : W.ceilingAt(P.s, P.height(), S)) : 1e9;
        if (P.h > ceil){ P.h = ceil; if (P.vh > 0){ P.vh = -P.vh * 0.25; W.fx.puff(P, 2, 30, -10); } }
        if (P.h <= 0){ P.h = 0; P.vh = 0; P.landT = now; P.sqV -= 1.6; W.fx.puff(P, 4, 40, 22); emit('land', S, 0, true); }
      }
      syncSurf();
    }
    function runCmd(s, now, S, k){
      const c = P.cmd;
      if (c.type === 'go'){
        let tgt = typeof c.target === 'function' ? c.target() : c.target;
        if (S.kind === 'seg') tgt = clamp(tgt, -S.hl + 2, S.hl - 2);
        const rem = (S.kind === 'ring' ? normA(tgt - P.s) : tgt - P.s) * k;
        const want = sgn(rem) * Math.min(c.vmax, Math.abs(rem) * c.k);
        P.vs += clamp(want - P.vs, -c.acc * s, c.acc * s);
        P.runPh += Math.abs(P.vs) * s / 14;
        if (c.gait === 'run' && Math.random() < Math.abs(P.vs) / 900) W.fx.puff(P, 1, 20, 12);
        if (Math.abs(rem) < 2 && Math.abs(P.vs) < 40){ P.s = tgt; P.vs = 0; P.cmd = null; emit('arrive'); if (c.done) c.done(); }
        return;
      }
      if (c.type === 'dash'){
        const tgt = typeof c.target === 'function' ? c.target() : c.target;
        let d = (S.kind === 'ring' ? ((tgt - P.s) * c.dir % TAU + TAU) % TAU : (tgt - P.s) * c.dir) * k;
        const t = now - c.t0;
        if (c.phase === 'notice' && t > 420){ c.phase = 'windup'; c.t0 = now; haptic('detent'); }
        else if (c.phase === 'windup'){
          if (Math.floor(t / 70) !== Math.floor((t - W.dt) / 70)) W.fx.puff(P, 2, 30, 14, 40);
          if (t > c.windup){ c.phase = 'zoom'; c.t0 = now; P.vs = 380 * c.dir; W.fx.puff(P, 8, 60, 30, 80); haptic('confirm'); }
        } else if (c.phase === 'zoom'){
          const maxV = clamp(d * 2.2, 420, 980), v = Math.abs(P.vs);
          if (d < v * v / (2 * 2600) - 12 || d > TAU * k - 6) c.phase = 'brake';
          else P.vs = c.dir * Math.min(maxV, v + 2400 * s);
          if (now - P.ghostT > 22){ P.ghostT = now; W.fx.ghost(P, 'dash'); }
        } else if (c.phase === 'brake'){
          P.vs = c.dir * Math.max(0, Math.abs(P.vs) - 2600 * s);
          if (now - P.puffT > 24){ P.puffT = now; W.fx.puff(P, 1, 30, 22, -30); }
          if (P.vs === 0){ P.landT = now; P.wobble(0.12, 500, 55); W.fx.puff(P, 5, 40, 20); P.cmd = null; emit('arrive'); if (c.done) c.done(); }
        }
        if (Math.abs(P.vs) > 2) P.face = c.dir;
      }
    }
    function stepAir(s, now){
      const A = P.air;
      if (A.kind === 'arc'){
        if (A.t < 0){ A.t += s; if (A.from && A.from.stamp === W.stamp){ attachKeep(A.from, A.fromS); } if (A.t >= 0){ W.fx.puff(P, 3, 30, 16); } return; }
        A.t += s;
        const tg = resolve(A.target); if (!tg){ P.fall({ v: P.lastV }); return; }
        const f = Math.min(1, A.t / A.T), T = A.T, gx = E.g[0], gy = E.g[1];
        P.surf = null;
        P.x = A.x0 + (tg.x - A.x0) * f + 0.5 * gx * T * T * f * (f - 1);
        P.y = A.y0 + (tg.y - A.y0) * f + 0.5 * gy * T * T * f * (f - 1);
        const e = sstep(0, 1, f), r1 = tg.S ? upAngle(tg.ux, tg.uy) : 0;
        P.rot = A.rot0 + normA(r1 - A.rot0) * e + A.spin * TAU * e;
        A.f = f;
        if (f >= 1){
          const vx = (tg.x - A.x0) / T + 0.5 * gx * T, vy = (tg.y - A.y0) / T + 0.5 * gy * T, done = A.done;
          if (tg.S) land(tg.S, tg.s, vx, vy); else P.fall({ v: [vx, vy] });
          if (done) done();
        }
        return;
      }
      // free flight under the device's gravity
      const px = P.x, py = P.y; A.t += s;
      A.vx += E.g[0] * s; A.vy += E.g[1] * s;
      const hx = P.x + Math.sin(P.rot) * P.p * 8, hy = P.y - Math.cos(P.rot) * P.p * 8;     // his hands, up there
      let ledges = null;
      if (A.grab && !A.noGrab){
        ledges = W.ledges();
        for (const L of ledges){
          if (L.S === A.ignore && A.t < 0.12) continue;
          const dx = L.x - hx, dy = L.y - hy, d = Math.hypot(dx, dy);
          if (d < 46 && d > 1 && dx * A.vx + dy * A.vy > 0){ A.vx += dx / d * 1500 * s; A.vy += dy / d * 1500 * s; }   // he reaches for it
        }
      }
      P.x += A.vx * s; P.y += A.vy * s;
      if (A.spin){ P.rot += A.spin * s; A.spin *= Math.pow(0.6, s); }
      else { const tr = upAngle(-E.gu[0], -E.gu[1]); P.rot += normA(tr - P.rot) * Math.min(1, s * 9); }
      // grab a ledge
      if (ledges){
        const hx2 = P.x + Math.sin(P.rot) * P.p * 8, hy2 = P.y - Math.cos(P.rot) * P.p * 8;
        for (const L of ledges){
          if (L.S === A.ignore && A.t < 0.12) continue;
          if (Math.hypot(L.x - hx2, L.y - hy2) < 20 && Math.hypot(A.vx, A.vy) < 1300){
            P.rot = upAngle(...norm(L.x - P.x, L.y - P.y));
            startHang(L.S, L.side, clamp((A.vx * L.S.tx + A.vy * L.S.ty) / 40, -6, 6)); return;
          }
        }
      }
      // land on a floor segment (one way: from its up side only)
      for (const S of W.surfs.values()){
        if (S.stamp !== W.stamp || S.kind !== 'seg' || (S === A.ignore && (A.t < 0.2 || P.reflex === 'flung'))) continue;
        const ux = S.ty, uy = -S.tx, d0 = (px - (S.x - S.dx)) * ux + (py - (S.y - S.dy)) * uy, d1 = (P.x - S.x) * ux + (P.y - S.y) * uy;
        const along = (P.x - S.x) * S.tx + (P.y - S.y) * S.ty;
        if (d0 >= -2 && d1 < 0 && Math.abs(along) <= S.hl + 3 && A.vx * ux + A.vy * uy < 0){ land(S, clamp(along, -S.hl, S.hl), A.vx, A.vy); return; }
      }
      // bounce off the boxes (the time, the battery, the date): he never goes in
      const cxB = P.x + Math.sin(P.rot) * P.p * 3.5, cyB = P.y - Math.cos(P.rot) * P.p * 3.5, rb = P.p * 2.2;
      for (const [x0, y0, x1, y1] of W.boxes){
        if (cxB < x0 - rb || cxB > x1 + rb || cyB < y0 - rb || cyB > y1 + rb) continue;
        const pen = [[cxB - (x0 - rb), -1, 0], [(x1 + rb) - cxB, 1, 0], [cyB - (y0 - rb), 0, -1], [(y1 + rb) - cyB, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        P.x += pen[1] * pen[0]; P.y += pen[2] * pen[0];
        const vn = A.vx * pen[1] + A.vy * pen[2];
        if (vn < 0){ A.vx -= 1.4 * vn * pen[1]; A.vy -= 1.4 * vn * pen[2]; A.vx *= 0.85; A.vy *= 0.85;
          if (-vn > 120){ haptic(-vn > 600 ? 'confirm' : 'soft'); W.fx.dustAt(cxB - pen[1] * rb, cyB - pen[2] * rb, 4, 50); if (A.spin) A.spin = -A.spin * 0.7; emit('bonk', -vn); } }
      }
      // the rim catches everything
      for (const S of W.surfs.values()){
        if (S.stamp !== W.stamp || S.kind !== 'ring' || (S === A.ignore && A.t < 0.25)) continue;
        const bx = P.x + Math.sin(P.rot) * P.p * 3.5 - S.cx, by = P.y - Math.cos(P.rot) * P.p * 3.5 - S.cy, d = Math.hypot(bx, by), lim = S.R - P.p * 3.5;
        if (d > lim && (A.vx * bx + A.vy * by) > 0){ land(S, Math.atan2(by, bx), A.vx, A.vy); return; }   // only on the way out: he can fall in from beyond the glass
      }
    }
    function attachKeep(S, s){ P.surf = S; P.s = s; syncSurf(); P.surf = null; }
    const norm = (x, y) => { const m = Math.hypot(x, y) || 1; return [x / m, y / m]; };
    function stepHang(s, now){
      const H0 = P.hang, S = W.get(H0.S);
      if (!S){ P.hang = null; P.fall({ v: [0, 0] }); return; }
      const [lx, ly] = hangPivot(S, H0.side), l = hangLen() * 0.6 * 1.7, gm = Math.hypot(E.g[0], E.g[1]) || 1, gam = Math.atan2(E.g[0], E.g[1]);
      H0.av += (-(gm / l) * Math.sin(H0.a - gam) - 1.3 * H0.av) * s; H0.a += H0.av * s;
      // never swing into the thing he holds: phi is the angle from "straight below the edge", positive outwards
      const bx = -S.ty, by = S.tx, ox = H0.side * S.tx, oy = H0.side * S.ty, ab = Math.atan2(bx, by), sg = (by * ox - bx * oy) >= 0 ? 1 : -1;
      const phi = normA(H0.a - ab) * sg;
      if (phi < 0.22){ H0.a = ab + 0.22 * sg; if (H0.av * sg < 0) H0.av = -H0.av * 0.3; }
      else if (phi > 1.7){ H0.a = ab + 1.7 * sg; if (H0.av * sg > 0) H0.av = -H0.av * 0.3; }
      const dx = Math.sin(H0.a), dy = Math.cos(H0.a), len = hangLen();
      P.rot = upAngle(-dx, -dy); P.x = lx + dx * len; P.y = ly + dy * len;
      // calm, and the floor up there is not too steep: climb up (or, sometimes, drop)
      const gt = Math.abs(E.g[0] * S.tx + E.g[1] * S.ty), steep = gt > S.mu * E.G * 0.9 && S.slip;
      if (Math.abs(H0.av) < 0.6 && !steep) H0.calm += s; else H0.calm = 0;
      if (now - H0.t0 > 3000 && Math.floor((now - H0.t0) / 2500) !== Math.floor((now - H0.t0 - W.dt) / 2500)) W.fx.sweat(P, Math.random() < 0.5 ? -1 : 1);
      if (H0.calm > 0.75 && P.reflex === 'hang' && !H0.decided){
        H0.decided = true;
        const d = W.emit('decide', 'hang', S);
        if (d === 'drop' || (d !== 'climb' && Math.random() < 0.2)) P.letGo(); else P.climbUp();
      }
    }
    // he holds the edge with his inner hand: the pivot is a little outside the corner
    function hangPivot(S, side){ const [x, y] = ledgePoint(S, side); return [x + S.tx * side * 3.4 * P.p, y + S.ty * side * 3.4 * P.p]; }
    function stepClimb(s, now){
      const K = P.climb, S = W.get(K.S); if (!S){ P.climb = null; P.reflex = null; P.fall({ v: [0, 0] }); return; }
      const f = clamp((now - K.t0) / 460, 0, 1), sT = K.side * Math.max(0, S.hl - 3 * P.p), [tx, ty] = sPos(S, sT), [ux, uy] = sUp(S, sT);
      const e1 = sstep(0, 0.6, f), e2 = sstep(0.4, 1, f), lift = Math.sin(Math.PI * f) * P.p * 2;
      P.x = lerp(K.x0, tx, e2) + ux * lift; P.y = lerp(K.y0, ty, e2) + uy * lift + (1 - e2) * 0;
      P.x = lerp(P.x, lerp(K.x0, tx, 0.5) + ux * P.p * 4, (1 - e2) * e1 * 0.6);
      P.y = lerp(P.y, lerp(K.y0, ty, 0.5) + uy * P.p * 4, (1 - e2) * e1 * 0.6);
      P.rot = K.rot0 + normA(upAngle(ux, uy) - K.rot0) * e1;
      if (f >= 1){ P.climb = null; attach(S, sT); P.vs = 0; P.landT = now; P.sqV -= 1.2; P.shakeOff(); emit('land', S, 0); }
    }

    /* ----- 3. the pose machine ----- */
    function poseOf(now){
      if (P.shot && now < P.shot.until) return typeof P.shot.pose === 'function' ? P.shot.pose(now) : P.shot.pose;
      if (P.hang) return Math.abs(P.hang.av) > 2.2 ? 'hang2' : 'hang';
      if (P.climb) return Math.floor((now - P.climb.t0) / 115) % 2 ? 'climb2' : 'climb1';
      if (P.roll) return 'ball';
      if (P.reflex === 'stun') return 'dizzy';
      if (P.reflex === 'shakeoff'){ const t = 480 - (P.until - now); return t < 220 ? (Math.floor(t / 45) % 2 ? 'dizzy' : 'idle') : 'blink'; }
      if (P.reflex === 'spin') return 'fall';
      if (P.air){
        const A = P.air;
        if (A.kind === 'arc' && A.t < 0) return 'crouch';
        if (A.pose) return typeof A.pose === 'function' ? A.pose(A.f || 0) : A.pose;
        if (P.reflex === 'flung') return Math.abs(A.spin) > 5 ? 'ball' : 'fall';
        const vUp = P.vx * Math.sin(P.rot) - P.vy * Math.cos(P.rot);
        return vUp > 0 ? 'stretch' : 'fall';
      }
      if (P.sliding) return 'fall';
      const c = P.cmd;
      if (c && c.type === 'dash'){
        if (c.phase === 'notice') return P.h > 0.5 ? 'stretch' : 'land';
        if (P.h > 0.5) return P.vh > 0 ? 'stretch' : 'fall';
        if (now - P.landT < 110) return 'land';
        if (c.phase === 'windup') return Math.floor(now / 60) % 2 ? 'crouch' : 'dash';
        if (c.phase === 'zoom') return 'dash';
        return 'land';
      }
      if (P.h > 0.5) return P.vh > 0 ? 'stretch' : 'fall';
      if (now - P.landT < 110) return 'land';
      if (c && c.type === 'go' && Math.abs(P.vs) > 12){
        if (c.gait === 'run') return ['run1', 'run2', 'run3', 'run4'][Math.floor(P.runPh) % 4];
        return Math.floor(now / 150) % 2 ? 'tap' : 'idle';
      }
      const h = P.hold;
      if (h === 'sit') return blinkAt(now) ? 'sitblink' : 'sit';
      if (h && h !== 'idle') return h;
      return blinkAt(now) ? 'blink' : (now % 2600) < 340 ? 'idle2' : 'idle';
    }
    P.poseNow = () => poseOf(E.now);

    /* ----- 3. draw: one transform for everything ----- */
    P.draw = (a, now) => {
      const pose = poseOf(now), al = a * P.a;
      let rot = P.rot, sx = 1, sy = 1;
      const c = P.cmd, f = P.frame();
      // the facing: on a surface it follows the motion; turning takes a beat (squash through zero, then flip)
      let want = P.mirror;
      if (P.surf && !P.air){ const lx = Math.cos(P.rot) * f.tx + Math.sin(P.rot) * f.ty; want = lx * P.face < 0; }
      if (want !== P.mirror && !P.turn) P.turn = { t0: now, to: want };
      if (P.turn){ const k = (now - P.turn.t0) / 120; if (k >= 1){ P.mirror = P.turn.to; P.turn = null; } else { sx *= Math.max(0.18, Math.abs(Math.cos(Math.PI * k))); sy *= 1 - 0.06 * Math.sin(Math.PI * k); if (k >= 0.5) P.mirror = P.turn.to; } }
      let mirror = P.mirror;
      if (P.sliding || P.reflex === 'spin') mirror = Math.floor(now / 90) % 2 === 0;
      // squash & stretch from the spring, and a breath when he is still
      sy *= P.sq; sx *= 1 + (1 - P.sq) * 0.6;
      if (!P.air && !P.cmd && !P.hang && P.h <= 0 && pose !== 'sleep') sy *= 1 + 0.018 * Math.sin(now / 640);
      if (pose === 'sleep') sy *= 1 + 0.04 * Math.sin(now / 900);
      // leans: the dash has its own, everything else leans into its acceleration
      if (c && c.type === 'dash') rot += c.phase === 'windup' ? -0.22 * c.dir : c.phase === 'zoom' ? 0.12 * c.dir : c.phase === 'brake' ? -0.28 * c.dir : 0;
      rot += P.lean;
      if (P.wob){ const t = now - P.wob.t0; if (t < P.wob.ms) rot += Math.sin(t / P.wob.rate) * P.wob.amp * (1 - t / P.wob.ms); else P.wob = null; }
      if (P.roll && P.surf) rot += P.s * pxPer(P.surf) / (P.p * 3.5);
      // tremble and offsets, in his own frame
      let ox = P.off[0], oy = -P.off[1];
      if (P.trem > 0){ ox += (hash(Math.floor(now / 40), 1) - 0.5) * P.trem * 2; oy += (hash(Math.floor(now / 40), 2) - 0.5) * P.trem; }
      // eyes: forward while moving, else where he was told to look
      let eye = P.eyeDx;
      if (c && (c.type === 'dash' || (c.type === 'go' && Math.abs(P.vs) > 12))) eye = 1;
      if (P.look){ const dx = P.look[0] - P.x, dy = P.look[1] - P.y, lx = (dx * Math.cos(P.rot) + dy * Math.sin(P.rot)) * (mirror ? -1 : 1); eye = Math.abs(lx) > 10 ? sgn(lx) : 0; }
      let n = 0;
      // the legs go round like a wheel before the dash
      if (c && c.type === 'dash' && c.phase === 'windup'){
        const ph = now / 22, cxl = P.x + f.ux * 4, cyl = P.y + f.uy * 4, tx = f.tx * c.dir, ty = f.ty * c.dir;
        for (let k = 0; k < 9; k++){ const an = ph + k / 9 * TAU, ex = Math.cos(an) * 10, ey = Math.sin(an) * 3.2; dot(cxl + tx * ex + f.ux * ey, cyl + ty * ex + f.uy * ey, 1.5, H.INK, al * (0.35 + 0.65 * (Math.sin(an) * 0.5 + 0.5))); n++; }
      }
      // speed lines behind him
      if (c && c.type === 'dash' && c.phase === 'zoom'){
        const tx = f.tx * c.dir, ty = f.ty * c.dir;
        ctx.strokeStyle = H.INK; ctx.lineWidth = 1; ctx.lineCap = 'round';
        for (let j = 0; j < 3; j++){
          const off = 8 + j * 9, len = 14 + j * 8, bx = P.x - tx * (18 + j * 6) + f.ux * off, by = P.y - ty * (18 + j * 6) + f.uy * off;
          ctx.globalAlpha = al * 0.5 * (1 - j * 0.25); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - tx * len, by - ty * len); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      n += drawPose(pose, P.x, P.y, { p: P.p, r: P.r, a: al, col: P.col || H.INK, rot, mirror, sx, sy, eyeDx: eye, ox, oy, acc: P.accs, lag: P.lag, bulb: P.bulb, soot: P.soot });
      return n;
    };
    return P;
  }

  /* ---------- 6. scenes v2: a script of engine commands on a timeline ----------
     A scene is { id, name, dur, script(s) }. script() runs once, at the start, and fills the timeline:
       s.at(ms, action)        action: a deferred command (s.pip.runTo(th), s.fx.flash()) or a function (pip, fx, s) => {}
       s.during(t0, t1, fn)    fn(f, t, s) every frame between t0 and t1 (props), f in 0..1
       s.frame(fn, layer)      fn(t, s) every frame; layer 'back' (behind Pip), 'front' (over Pip) or 'top' (over the FX)
     Everything else on s: see makeSceneApi. */
  const CMDS = ['place', 'idle', 'walkTo', 'runTo', 'dashTo', 'jumpTo', 'fall', 'hop', 'sit', 'sleep', 'pose', 'play', 'stopPlay', 'eyes', 'lookAt', 'wear', 'tremble', 'offset', 'tint', 'wobble', 'stun', 'shakeOff', 'say', 'climbUp', 'letGo'];
  const FXC = ['puff', 'dustAt', 'sparks', 'debris', 'smoke', 'soot', 'flash', 'fireball', 'ring', 'stars', 'hearts', 'sweat', 'zee', 'bang'];
  E.runScene = (def, sh) => {
    const R = { def, t: 0, items: [], frames: [], done: false, s: null };
    const s = R.s = sh;                                  // the host fills in the world-facing bits (marker, collapse, ...)
    const P = sh.body, F = sh.effects;
    s.at = (ms, action) => { R.items.push({ t: ms, action, fired: false }); return s; };
    s.during = (t0, t1, fn, layer = 'back') => { R.frames.push({ t0, t1, fn, layer }); return s; };
    s.frame = (fn, layer = 'back') => { R.frames.push({ t0: -1, t1: 1e9, fn, layer }); return s; };
    s.end = () => { R.done = true; };
    s.pip = {}; for (const k of CMDS) s.pip[k] = (...a) => () => P[k](...a);
    s.fx = {}; for (const k of FXC) s.fx[k] = (...a) => () => (k === 'puff' || k === 'stars' || k === 'hearts' || k === 'sweat' || k === 'zee' || k === 'bang' ? F[k](P, ...a) : F[k](...a));
    s.state = {};
    s.dur = def.dur;
    def.script(s);
    R.items.sort((a, b) => a.t - b.t);
    R.step = dt => {
      R.t += dt; s.t = R.t;
      for (const it of R.items) if (!it.fired && R.t >= it.t){ it.fired = true; try { it.action(P, F, s); } catch (e){ console.error('scena', def.id, e); R.done = true; } }
      if (R.t > def.dur) R.done = true;
    };
    R.draw = layer => {
      let n = 0;
      for (const fr of R.frames){
        if (fr.layer !== layer || R.t < fr.t0 || R.t > fr.t1) continue;
        try { n += (fr.t0 < 0 ? fr.fn(R.t, s) : fr.fn(clamp((R.t - fr.t0) / (fr.t1 - fr.t0), 0, 1), R.t, s)) || 0; } catch (e){ console.error('scena', def.id, e); R.done = true; }
      }
      return n;
    };
    return R;
  };
  return E;
}

global.PipEngine = { create, POSES, SKINS, ACC, cells };
})(window);
