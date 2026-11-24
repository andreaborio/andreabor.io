/* A real QR code, drawn with Dotto's dots: version 3 (29 × 29), error correction L, byte mode, mask 0.
   It holds up to 53 bytes: enough for the WiFi string of Dotto's own network or a dotto.local address.
   On the device the same matrix comes from the esp-idf `qrcode` component (or these ~80 lines in C); it is computed once
   per screen and kept as a bitmap, so drawing it costs what drawing 841 dots costs.

   Polarity: the light modules are lit dots and the dark modules are holes, with a lit quiet zone around it.
   A field of dots with the code punched out of it: phones read it like a printed code, black on white. */
(function(global){
'use strict';
const V = 3, N = 17 + 4 * V, DATA = 55, ECC = 15, MAX = 53;
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
function gen(n){
  let g = [1];
  for (let i = 0; i < n; i++){ const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++){ ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; }
  return g;
}
const GEN = gen(ECC);
function ecc(data){
  const r = new Array(ECC).fill(0);
  for (const d of data){ const f = d ^ r.shift(); r.push(0); for (let i = 0; i < ECC; i++) r[i] ^= mul(GEN[i + 1], f); }
  return r;
}
const CACHE = new Map();
function make(str){
  if (CACHE.has(str)) return CACHE.get(str);
  const bytes = [...new TextEncoder().encode(str)].slice(0, MAX), bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(bytes.length, 8); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, DATA * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const cw = []; for (let i = 0; i < bits.length; i += 8){ let v = 0; for (let j = 0; j < 8; j++) v = v << 1 | bits[i + j]; cw.push(v); }
  for (let k = 0; cw.length < DATA; k++) cw.push(k % 2 ? 0x11 : 0xec);
  const all = cw.concat(ecc(cw)), stream = [];
  for (const b of all) for (let i = 7; i >= 0; i--) stream.push((b >>> i) & 1);

  const m = Array.from({ length: N }, () => new Array(N).fill(0)), fn = Array.from({ length: N }, () => new Array(N).fill(false));
  const set = (x, y, dark) => { if (x < 0 || y < 0 || x >= N || y >= N) return; m[y][x] = dark ? 1 : 0; fn[y][x] = true; };
  for (let i = 0; i < N; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [N - 4, 3], [3, N - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){ const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  // format: level L (01), mask 0
  const fd = 1 << 3 | 0; let rem = fd; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fb = (fd << 10 | rem) ^ 0x5412, bit = i => ((fb >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(N - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, N - 15 + i, bit(i));
  set(8, N - 8, true);
  // the data, in the zigzag, masked with (x + y) % 2 === 0
  let k = 0;
  for (let right = N - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let v = 0; v < N; v++) for (let j = 0; j < 2; j++){
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? N - 1 - v : v;
      if (fn[y][x]) continue;
      let b = k < stream.length ? stream[k] : 0; k++;
      if ((x + y) % 2 === 0) b ^= 1;
      m[y][x] = b;
    }
  }
  const out = { n: N, m };
  CACHE.set(str, out); return out;
}
global.DottoQR = { make, N };
})(window);
