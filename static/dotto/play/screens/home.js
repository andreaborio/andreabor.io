/* The home: the time, the date, the widgets (timer, music), the rim of seconds and Dotto's chase. */
'use strict';
/* ---------- screens ---------- */
const DAYS = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const SR = 212;
const secAng = i => -Math.PI / 2 + i / 60 * TAU;
// the clock's widget rows, under the date: the timer first, then the music
/* the home, with the menu's care: the time in the middle (dots, standing out of the glass); under it the date written out,
   in the home's colour; under that one row per thing that is going on (the timer, the music), each with its small pixel
   icon in its app's colour and its text. Everything centred on its lit dots. Tap a row: it opens its app */
// the time sits 3 grid steps above the centre: battery, time, date and the rows make one block in the middle of the glass
const TIME_Y = C - 27;
const HOME_Y = { date: TIME_Y + 74, row1: TIME_Y + 112, row2: TIME_Y + 146 };
const musicY = () => TM.active() ? HOME_Y.row2 : HOME_Y.row1;
const MINI = { timer: ['#####', '.#.#.', '..#..', '.#.#.', '#####'], music: ['..##.', '..#.#', '..#..', '###..', '###..'] };
function homeDate(d){ return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
// a row: icon + text, centred as one group on its ink; the text falls and fades with the face when it collapses
function homeRow(a, y, ic, col, text, textCol, bob = 0){
  const px = 3.5, iw = (ic[0].length - 1) * px, gap = 12, tw = KIT.inkW('caption', text), x0 = C - (iw + gap + tw) / 2;
  ic.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') dot(x0 + c * px, y + (r - 2) * px + bob, 1.45, col, a); }));
  const ck = collapseK();
  ctx.save(); ctx.translate(x0 + iw + gap + tw / 2 - C, ck ? ck.dy : 0); KIT.text('caption', text, y, a * (ck ? ck.a : 1), { col: textCol }); ctx.restore();
  return { x0: x0 - 10, x1: x0 + iw + gap + tw + 10 };
}
function homeWidgets(a, now, th){
  let n = 0; HOME_HIT.length = 0;
  if (TM.active()){
    const T0 = TM.T, ring = T0.mode === 'ring', on = !ring || Math.floor((now - T0.ringT) / 350) % 2 === 0;
    const s = Math.max(0, Math.ceil(T0.left / 1000)), txt = ring ? 'Tempo!' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${T0.mode === 'pause' ? ' · pausa' : ''}`;
    const r = homeRow(a * (on ? 1 : 0.3) * (T0.mode === 'pause' ? 0.6 : 1), HOME_Y.row1, MINI.timer, 'rgb(255,211,92)', txt, INK);
    HOME_HIT.push({ y: HOME_Y.row1, x0: r.x0, x1: r.x1, go: 'timer' }); n += 13;
  }
  if (th){
    const y = musicY(), bob = -Math.abs(Math.sin(((now % 476) / 476) * Math.PI)) * 2;
    const r = homeRow(a * th.k, y, MINI.music, rgb(vivid(th.dom)), th.title, INK, bob);
    HOME_HIT.push({ y, x0: r.x0, x1: r.x1, go: 'music' }); n += 9;
  }
  return n;
}
const HOME_HIT = [];
// the 60 dots of the rim: a fixed table (port: 60 × (x, y) in flash)
const RIM = Array.from({ length: 60 }, (_, i) => { const a = secAng(i); return { a, x: C + Math.cos(a) * SR, y: C + Math.sin(a) * SR }; });
// the halo's grid dots (a ring 148–204 px), with where each one reads the cover and its fade: fixed, so one table
const HALO = (() => {
  const L = [];
  for (let y = C % P; y < S; y += P) for (let x = C % P; x < S; x += P){
    const d = Math.hypot(x - C, y - C); if (d < 148 || d > 204) continue;
    const an = Math.atan2(y - C, x - C);
    L.push({ x, y, id: MU.cellOf(0.5 + 0.46 * Math.cos(an), 0.5 + 0.46 * Math.sin(an)), w: sstep(148, 200, d) });
  }
  return L;
})();
function scrClock(a, now){
  const d = new Date(Date.now() + st.timeOff);
  const str = st.noSync ? '--:--' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`, hr = d.getHours(), asleep = SETT.isNight(hr) || st.batt < 0.05 || !!st.aod;
  if (st.lastTime !== str){
    // a new minute: the new digits wait to be hit (Pip lands on them, or the second nudges him in his sleep)
    setText(T.time, str, now);
    // (losing or getting back the time from the internet is not a new minute: those digits just fall in)
    if (st.lastTime && !str.includes('-') && !st.lastTime.includes('-')){ for (const sl of T.time.slots) if (sl.t0 === now) sl.t0 = now + 1e7; BR.clock.newMinute(now, asleep); }
    st.lastTime = str;
  }
  const s = d.getSeconds(), ms = d.getMilliseconds();
  CUR.s = s; CUR.ms = ms; CUR.a = a;
  FACE = true;
  // music playing: the digits are a window onto the cover, the second takes its colour, the title sits under the date
  const th = MU.theme();
  if (th){
    // the cover wrapped around the rim: a halo in its colours, strongest at the edge (Musica spills it from the centre)
    DEPTH.push(DEPTH.P.glow);
    for (const q of HALO) dot(q.x, q.y, 1.7, th.css[q.id], a * th.k * 0.34 * q.w);
    DEPTH.pop();
  }
  if (th) PAINT = (x, y, col) => rgb(mixc(parseCol(col), th.at((x - (C - 150)) / 300, (y - (TIME_Y - 48)) / 96), th.k));
  let n = drawText(T.time, D, C, TIME_Y, P, 3.9, INK, now, { alpha: a, depth: true });
  PAINT = null;
  const secCol = th ? rgb(mixc(W, th.dom, th.k)) : INK;
  faceGeom(d);
  const pr = BR.clock.prepare(now); GEOM.battTilt = pr.battTilt;
  DEPTH.at(DEPTH.P.hero, () => drawBattery(a, pr.battTilt, now));
  // the rim: the lit dot keeps time and rings where it lands; under Pip's feet it glows a little
  const land = ms - 300, ring = asleep ? 0 : land > 0 ? Math.exp(-land / 260) : 0, under = BR.clock.underTh(), inScene = !!BR.clock.B.scene;
  for (let i = 0; i < 60; i++){
    const ai = RIM[i].a, x = RIM[i].x, y = RIM[i].y;
    const dist = Math.min((i - s + 60) % 60, (s - i + 60) % 60);
    const wave = ring * Math.exp(-dist * 0.85) * (dist === 0 ? 0 : 1);
    const und = under != null ? Math.exp(-Math.pow(normA(ai - under) * RF / 10, 2)) : 0;
    const cur = inScene || pr.hideMarker ? 0 : i === s ? 1 : (s - i + 60) % 60 === 1 ? (1 - sstep(0, 0.3, ms / 1000)) * 0.5 : 0;
    dot(x, y, (i % 5 ? 1.1 : 1.7) + wave * 1.4 + cur * 1.6 + und * 0.8, cur > 0.5 || wave > 0.3 ? secCol : INK, a * (0.14 + Math.max(wave * 0.8, cur * 0.86, und * 0.5)));
  }
  FACE = false;
  const r = BR.clock.run(a, now, st.lastDt || 16, { s, ms, asleep, ctxP: pipContext(d), d });
  n += r.n;
  if (BR.clock.B.scene && !r.markerDrawn) drawMarker();
  FACE = true;
  if (!st.noSync) DEPTH.at(DEPTH.P.text, () => { const ck = collapseK(); ctx.save(); ctx.translate(0, ck ? ck.dy : 0); KIT.text('caption', homeDate(d), HOME_Y.date, a * (ck ? ck.a : 1), { col: KIT.colOf('label') }); ctx.restore(); });
  n += homeWidgets(a, now, th);
  FACE = false;
  return n + 60;
}
// what the face is made of, for Pip: the roof of the digits, the battery, the date. He may stand on them, never enter them
function faceGeom(d){
  let cols = 0; const k = T.time.slots.length;
  for (let i = 0; i < k; i++) cols += glyph(D, T.time.slots[k - 1 - i].ch).w + (i < k - 1 ? 1 : 0);
  const half = (cols - 1) * P / 2, top = snap(TIME_Y - 10 * P / 2) - 3.3;
  GEOM.digitsHl = half + 2; GEOM.digitsTop = top - 2;
  { const w = KIT.textW('caption', homeDate(d)); GEOM.date = [C - w / 2 - 2, HOME_Y.date - 11, C + w / 2 + 2, HOME_Y.date + 11]; }
  GEOM.boxes = [[C - half - 4, top, C + half + 4, 2 * TIME_Y - top], [C - 19, C - 126, C + 22, C - 107], GEOM.date];
}
