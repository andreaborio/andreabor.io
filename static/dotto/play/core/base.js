/* Dotto, the prototype's core: the screen, the maths, the colours, the clock. Every file below shares these names
   (classic scripts, one global scope, loaded in order by index.html: like the C units of the firmware sharing one header).
   Port: config.h + a small maths header. Colours are RGB888 here, RGB565 on the panel. */
'use strict';
const S = 466, C = S / 2, TAU = Math.PI * 2;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const eoc = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const normA = v => { while (v <= -Math.PI) v += Math.PI * 2; while (v > Math.PI) v -= Math.PI * 2; return v; };
const fmt1 = v => v.toFixed(1).replace('.', ',');
const pad2 = n => String(n).padStart(2, '0');
const hash = (a, b, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
// pure white for ink (a grey white reads dull through the CRT pass), a light secondary instead of a mid grey
const W = [255, 255, 255], RED = [255, 59, 47], INK = '#ffffff', INK2 = '#c4c4c0';
const P = 9;                                    // the grid pitch, in screen px
let MODE = 'fall';

let clock = 0, slow = false;
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const mixc = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const vivid = c => { const m = Math.max(...c) || 1; return c.map(v => Math.max(90, Math.round(v / m * 255))); };
