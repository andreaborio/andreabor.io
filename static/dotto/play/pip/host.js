/* Dotto's host: the engine instance (pip/engine.js), his skins and mood, the face as he sees it, the scenes v2 host and
   his brains (pip/brains.js). Port: the same split: engine in C, brains as small state machines. */
'use strict';
/* ---------- Pip: one engine for every place he shows up (pip/engine.js), and his brains (pip/brains.js) ---------- */
const RF = 208;                                   // where his feet touch: on the ring of dots
const PE = PipEngine.create({ ctx, dot, haptic, C, S, INK, INK2, RED, layerIn: () => DEPTH.push(DEPTH.P.pip), layerOut: () => DEPTH.pop() });
const SKIN = PE.SKINS;
const feetAt = (th, h = 0) => [C + Math.cos(th) * (RF - h), C + Math.sin(th) * (RF - h)];
const PRE_S = 52;                                  // from here on, he goes to wait for the minute on the battery
// skins and mood: each one has a reason to be on
function pipContext(d){
  const h = d.getHours();
  if (MU.playing() && !SETT.isNight(h) && !st.aod) return { skin: 'phones', why: 'suona la musica', mood: 'giocoso' };
  if (SETT.isNight(h) || st.batt < 0.05 || st.aod) return { skin: 'nightcap', why: st.aod ? 'lo schermo riposa' : st.batt < 0.05 ? 'batteria quasi a zero' : 'è notte', mood: 'dorme' };
  if (st.batt < 0.2) return { skin: 'none', why: 'batteria scarica', mood: 'pigro' };
  if (st.cdj) return { skin: 'phones', why: 'CDJ collegati', mood: 'energico' };
  if (st.scene === 1) return { skin: 'party', why: 'luci in scena Party', mood: 'giocoso' };
  if (st.scene === 2) return { skin: 'glasses', why: 'luci in scena Focus', mood: 'tranquillo' };
  if (h < 11) return { skin: 'bedhead', why: 'è mattina', mood: 'sveglio' };
  if (h < 16) return { skin: 'sun', why: 'è giorno pieno', mood: 'energico' };
  if (h < 20) return { skin: 'cap', why: 'è pomeriggio', mood: 'sveglio' };
  return { skin: 'none', why: 'è sera', mood: 'giocoso' };
}
const STATE_IT = { preMin: 'va ad aspettare il minuto sulla batteria', wait: 'si fa i fatti suoi', notice: 'si accorge che il tempo scappa', windup: 'carica la rincorsa',
  zoom: 'rincorre il secondo', brake: 'frena sgommando', air: 'salta', minute: 'fa il minuto', home: 'torna sul bordo', slide: 'scivola', hang: 'è appeso e dondola',
  climb: 'si arrampica', flung: 'vola via', roll: 'rotola sul bordo', stun: 'vede le stelle', shakeoff: 'si scrolla', spin: 'gira con la ghiera', drop: 'salta giù',
  idle: 'si guarda intorno', go: 'cammina', scene: 'è in scena' };
// the face as Pip sees it: what he stands on, what he may not enter. Measured while the face is drawn
const GEOM = { battTilt: 0, battPiv: [C, BATT_PIV], digitsTop: C - 50, digitsHl: 146, boxes: [], date: [C - 46, C + 87, C + 46, C + 111] };
const CUR = { s: 0, ms: 0, a: 1 };
const markerTh = () => secAng(CUR.s + (RM ? 0 : sstep(0, 0.25, CUR.ms / 1000)));
// the second: always where the time says; it may hop off the rim (lift, px inwards), squash, fade
function drawMarker(o = {}){ const { lift = 0, scale = 1, al = 1, dTh = 0 } = o, th = markerTh() + dTh, r = RF + 4 - lift; dot(C + Math.cos(th) * r, C + Math.sin(th) * r, 3.1 * scale, INK, CUR.a * al); }
function dropDigits(){ for (const sl of T.time.slots) if (sl.t0 > clock + 1e6) sl.t0 = clock; }
/* ---------- the chase: scenes v2 (see scenes/example.js). Each file registers itself in window.PIP_SCENES ---------- */
window.PIP_SCENES = window.PIP_SCENES || [];
function propCells(rows){ const out = []; rows.forEach((row, r) => [...row].forEach((v, c) => { if (v !== '.' && v !== ' ') out.push([c, r, v]); })); return { w: rows[0].length, h: rows.length, cells: out }; }
function sceneHost(W, pip){
  const s = {
    body: pip, effects: W.fx, C, RF, TAU, INK, INK2, RED: rgb(RED), PIP_P: pip.p,
    lerp, clamp, sstep, eoc, normA, hash, secAng, feetAt, markerDrawn: false,
    get a(){ return CUR.a; }, get now(){ return clock; }, get markerTh(){ return markerTh(); },
    up: th => [-Math.cos(th), -Math.sin(th)], tangent: th => [-Math.sin(th), Math.cos(th)],
    ceilingAt: th => W.ceilingAt(th, pip.height(), W.get('rim')),
    marker(o){ s.markerDrawn = true; drawMarker(o); },
    // props in real pixels (filled squares): palette maps a character to a colour
    sprite: (rows, x, y, o = {}) => PE.sprite(rows, x, y, Object.assign({}, o, { a: CUR.a * (o.a == null ? 1 : o.a) })),
    // props in dots on a 3 px pitch: '#' white, 'g' grey, 'r' red
    prop(rows, x, y, o = {}){
      const { p = 3, rot = 0, a: al = 1, r: rr = null, anchor = 'bottom', col = null } = o, g = propCells(rows);
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
      const x0 = -(g.w - 1) * p / 2, y0 = anchor === 'c' ? -(g.h - 1) * p / 2 : -(g.h - 1) * p;
      for (const [c, r0, v] of g.cells){ const cc = col || (v === 'r' ? rgb(RED) : v === 'g' ? INK2 : INK); dot(x0 + c * p, y0 + r0 * p, rr || p * 0.38, cc, CUR.a * al); }
      ctx.restore(); return g.cells.length;
    },
    dot: (x, y, r, col = INK, al = 1) => dot(x, y, r, col, CUR.a * al),
    line: (x1, y1, x2, y2, col = INK, al = 1, w = 1) => { ctx.strokeStyle = col; ctx.globalAlpha = CUR.a * al; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1; },
    haptic: k => haptic(k), wave: (col, str, dark) => wave(col, str, dark),
    collapse: (ms = 3600) => { COLLAPSE.t0 = clock; COLLAPSE.dur = ms; }
  };
  return s;
}
const BR = PipBrains.create(PE, {
  C, RF, RM, st, MENU, ZONES, INK, INK2, RED, W, rgb, mixc, haptic, dot, markerTh, dropDigits, sceneHost, menuPlay: (id, now) => menuPlay(id, now),
  levelY: () => ptr && ptr.mode === 'level' && st.scene !== 3 ? C + 198 - ZONES[st.zone].b / 100 * 396 : null,
  secAng: i => secAng(i), sec: () => CUR.s, syncTime: () => { const d = new Date(Date.now() + st.timeOff); CUR.s = d.getSeconds(); CUR.ms = d.getMilliseconds(); }, geom: () => GEOM, wordFeet: i => wordFeet(i), ptr: () => ptr, setLife: L0 => { st.life = L0; }
});
