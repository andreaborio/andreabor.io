/* The beat: a 124 BPM clock and the structure of a track, for the DJ screen. Port: fed by the CDJ link (Pro DJ
   Link beat packets) instead of being simulated. */
'use strict';
/* ---------- beat engine ---------- */
const STRUCT = [['Intro', 16], ['Build', 8], ['Drop', 16], ['Break', 8], ['Build', 8], ['Drop', 16], ['Outro', 8]];
const SECT = []; { let a = 0; for (const [n, b] of STRUCT){ SECT.push({ name: n, start: a, bars: b }); a += b; } }
const TOTAL = SECT.reduce((s, x) => s + x.bars, 0) * 4;
const beat = { bpm: 124, t0: 0 };
const bd = () => 60000 / beat.bpm;
const absB = () => (clock - beat.t0) / bd();
const posB = () => ((absB() % TOTAL) + TOTAL) % TOTAL;
function setBpm(v){ const p = absB(); beat.bpm = v; beat.t0 = clock - p * bd(); }
function jumpBar(b){ beat.t0 = clock - b * 4 * bd(); }
function info(){
  const p = posB(), bar = Math.floor(p / 4); let si = 0;
  for (let i = 0; i < SECT.length; i++) if (bar >= SECT[i].start) si = i;
  const sec = SECT[si]; let next = null;
  for (const x of SECT) if (x.name === 'Drop' && x.start * 4 > p){ next = x.start * 4 - p; break; }
  return { p, bar, beat: Math.floor(p) % 4, frac: p - Math.floor(p), sec, barIn: bar - sec.start, prog: (p - sec.start * 4) / (sec.bars * 4), toEnd: (sec.start + sec.bars) * 4 - p, next };
}
