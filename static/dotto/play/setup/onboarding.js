/* Dotto: the first setup, led by Dotto (SPEC.md, "Prima configurazione").
   One thing per screen. Dotto shows what to do: he mimes it, points at it, cheers when it is done.
   The phone is only for typing (WiFi password, Spotify login) and you get to it with a QR code made of dots.
   Every step can be skipped and done again later from Impostazioni. Errors are always told by Dotto, with a way out.

   Steps: birth → wifi → time → lights → rooms → spotify → gestures → done.
   The prototype pretends the house: the lamps, the Bridge button, the phone. The panel can make things go wrong.

   Every screen is the same template as Timer and Opzioni (ui/kit.js): a title on the top arc, one hero in the middle
   (a QR, the digits, a check, a drum, a small drawing of the thing to do), one line of body, one line of caption,
   Dotto on his floor, and at the bottom one or two flat pills (white outline: go on; the accent: skip).
   The same few signs mean the same thing on every step:
   - the rim sweep (a comet running along the dial) is "I am looking / waiting for the network";
   - the dial lit on the rim is time or a gesture's progress, as in Timer and Opzioni;
   - a green check that draws itself is "done";
   - the setup's progress is a row of dots on the bottom of the rim (accent: done; white: here; faint: to do).
   No grey: what is "off" (the Bridge not found, a lamp that does not answer, no signal) is the accent, dim.
   On the device that is one LVGL screen with six fixed slots; a step only fills them.

   On the ESP32-S3 (LVGL 9 + the dot renderer):
   - each step is a small state machine (step, phase, t0), ticked by the UI task; nothing here allocates per frame;
   - every fixed drawing (the Bridge, the check, the WiFi sign, the bulb, the rings of the gestures, the rim sweep, the
     birth paths) is a const table built once here; a frame only walks it (no hypot / atan2 / exp per dot);
   - the QR is computed once per screen (setup/qr.js, or the esp-idf `qrcode` component) and drawn as dots;
   - the WiFi page is the captive portal of Dotto's own AP (esp_http_server + a DNS catch-all), then STA mode;
   - Hue: the Bridge is found with mDNS (_hue._tcp), pairing is POST /api {devicetype} until the button is pressed (30 s);
   - WiZ: UDP broadcast on 38899 (getPilot); Govee: LAN API multicast 239.255.255.250:4001, needs "LAN Control" on;
   - the room game makes one lamp at a time blink (Hue alert "lselect", WiZ and Govee toggled by Dotto at 2 Hz);
   - Spotify: OAuth PKCE, the phone does the login on dotto.local/spotify, Dotto keeps the refresh token in NVS;
   - "flip" is the QMI8658 seeing gravity on +Z for 400 ms;
   - text: Doto rasterised at the three sizes of ui/kit.js (TS) into LVGL fonts; widths of fixed strings are kept. */
(function(global){
'use strict';
function create(H){
  const { C, RF, INK, dot, haptic, wave, E } = H;
  const { clamp, lerp, sstep, eoc, hash } = E;
  const TAU = Math.PI * 2;
  const W = E.world('setup'), pip = W.spawn({ p: H.PIP_P || 5, r: 2.2 });

  // the screen template (ui/kit.js): text styles, slots, pills, hero words, drum, rings
  const K = H.K || global.DottoKit.create(H);
  const { TS, Y, HERO_P, fade, text, word, GO } = K;
  const SKIP = K.OUT('Salta', 'skip');
  const STAGE = Y.stage, MID = C - 56, DIGY = Y.hero;
  const DOTS = ['wifi', 'time', 'lights', 'rooms', 'spotify', 'gestures'];
  // colour with meaning only: the setup's accent (set by the host for this screen), green for "done"
  const ACC = () => K.colOf('label');
  const OK_RGB = [123, 224, 162], OK = H.rgb(OK_RGB);
  const QR_P = 4.1;                                   // every QR of the setup at the same pitch (as in Opzioni)

  // the house the prototype pretends, and what can go wrong (the panel flips these)
  const SIM = { wifiFail: false, bridgeOff: false, goveeOff: false, deadLamp: false, silent: false };
  const LAMPS = [
    { brand: 'Hue', name: 'la lampada del divano', room: 'Sala' },
    { brand: 'Hue', name: 'la striscia dietro la TV', room: 'Sala' },
    { brand: 'Hue', name: 'la lampada sul comodino', room: 'Camera' },
    { brand: 'WiZ', name: 'la plafoniera', room: 'Cucina' },
    { brand: 'WiZ', name: 'la lampada della scrivania', room: 'Studio' },
    { brand: 'Govee', name: 'il faretto GU10 a sinistra', room: 'Studio' },
    { brand: 'Govee', name: 'il faretto GU10 a destra', room: 'Studio' }
  ];
  const DEAD = 5;                                     // with "Una lampada muta", this one never answers
  const ROOM_HUE = { Sala: [255, 170, 90], Cucina: [255, 211, 92], Camera: [196, 160, 255], Studio: [110, 200, 255], Bagno: [110, 230, 210], Ingresso: [140, 225, 150] };
  const NEW_ROOM = 'Nuova stanza';
  const hueOf = room => ROOM_HUE[room] || [255, 255, 255];

  const S = { pills: [], pressK: null, pressT: -1e9, msg: '', msgT: -1e9, titleT0: 0, step: 'birth', ph: '', t0: 0, stepT0: 0, now: 0, dt: 16, where: { surf: 'mid', s: 0 }, free: false, pend: [], hopT: 0, btnT: -1e9, last: '' };
  // from Opzioni a single step can be done again (S.only): when the flow wants to move on, it goes back instead
  const to = (step, ph = '') => { if (S.only && step !== S.only){ S.only = null; S.pend.length = 0; if (H.exit) H.exit(); return; } if (step !== S.step) S.stepT0 = S.now; S.step = step; S.ph = ph; S.t0 = S.now; enter(); };
  const phase = ph => { S.ph = ph; S.t0 = S.now; enter(); };
  const later = (ms, f) => S.pend.push({ t: S.now + ms, f });
  const toast = str => K.toast(S, str, S.now);

  const compose = (L, a, el) => { S.titleT0 = S.stepT0; K.compose(S, L, a, el, S.now); };
  const drawQR = (str, cx, cy, pitch, a, t, out = -1, sync = 0) => K.qr(str, cx, cy, pitch, a, t, out, sync, S.now);

  /* ---------- fixed tables (built once; on the device: const arrays in flash) ---------- */
  // a unit circle of n points starting at twelve o'clock, clockwise
  function unit(n){ const c = new Float32Array(n), s = new Float32Array(n); for (let i = 0; i < n; i++){ const an = -Math.PI / 2 + i / n * TAU; c[i] = Math.cos(an); s[i] = Math.sin(an); } return { n, c, s }; }
  const U16 = unit(16), U24 = unit(24);
  // the width of the lit dots of a fixed string, measured once (on the device: a table next to the font)
  const INKW = new Map();
  const inkOf = (style, str) => { const k = style + '|' + str; let w = INKW.get(k); if (w == null){ w = K.inkW(style, str); INKW.set(k, w); } return w; };
  // a line of text whose ink starts at x (the kit centres every line on the glass; lists are set flush left as a block)
  function textAt(style, str, x, y, a, col){ const ctx = H.ctx; ctx.save(); ctx.translate(x + inkOf(style, str) / 2 - C, 0); text(style, str, y, a, { col }); ctx.restore(); }

  // the rim sweep: the lattice cells (4.5 px, the pitch of rings and pills) on the dial of Timer and Opzioni (r 206,
  // open at the bottom), with their angle along the dial. "Looking for something": a comet runs along it, start to end.
  const SW_R = 206, SW_A0 = 0.75 * Math.PI, SW_SPAN = 1.5 * Math.PI, SW_TAIL = 1.3, SW_MS = 2300;
  const SWEEP = (() => {
    const GP = 4.5, band = GP * 0.6, o = C % GP, xs = [], ys = [], rel = [];
    for (let y = o; y < 2 * C; y += GP) for (let x = o; x < 2 * C; x += GP){
      const dx = x - C, dy = y - C; if (Math.abs(Math.hypot(dx, dy) - SW_R) > band) continue;
      const r = (((Math.atan2(dy, dx) - SW_A0) % TAU) + TAU) % TAU; if (r > SW_SPAN + 0.02) continue;
      xs.push(x); ys.push(y); rel.push(r);
    }
    return { n: xs.length, x: Float32Array.from(xs), y: Float32Array.from(ys), rel: Float32Array.from(rel) };
  })();
  function sweep(a, el){
    // the head goes from the start of the dial past its end, so the tail leaves too; then it starts again
    const head = ((el % SW_MS) / SW_MS) * (SW_SPAN + SW_TAIL), acc = ACC(); let n = 0;
    for (let i = 0; i < SWEEP.n; i++){
      const d = head - SWEEP.rel[i];
      if (d >= 0 && d < SW_TAIL){ const k = 1 - d / SW_TAIL; dot(SWEEP.x[i], SWEEP.y[i], 0.95 + 0.8 * k, k > 0.85 ? INK : acc, a * (0.2 + 0.8 * k * k)); }
      else dot(SWEEP.x[i], SWEEP.y[i], 0.95, acc, a * 0.2);
      n++;
    }
    return n;
  }
  // a row of dots on the rim, centred on twelve (top) or six (bottom) o'clock; positions kept per (N, side)
  const ROWS = new Map();
  function rimRow(N, top, span){
    const key = N + '|' + top + '|' + span; let R = ROWS.get(key); if (R) return R;
    const x = new Float32Array(N), y = new Float32Array(N);
    for (let i = 0; i < N; i++){ const an = top ? -Math.PI / 2 + (i - (N - 1) / 2) * span : Math.PI / 2 - (i - (N - 1) / 2) * span; x[i] = C + Math.cos(an) * K.R_RIM; y[i] = C + Math.sin(an) * K.R_RIM; }
    R = { x, y }; ROWS.set(key, R); return R;
  }
  // progress on the rim: colOf(i) gives the colour of a done dot (or null); cur breathes in white; the rest is faint accent
  function rimDots(N, cur, colOf, a, top = true, span = 0.085){
    const R = rimRow(N, top, span), acc = ACC(), br = 0.5 + 0.5 * Math.sin(S.now / 380);
    for (let i = 0; i < N; i++){
      const c = colOf(i);
      if (c) dot(R.x[i], R.y[i], 2.4, c, a);
      else if (i === cur) dot(R.x[i], R.y[i], 2.5 + br * 0.4, INK, a);
      else dot(R.x[i], R.y[i], 1.6, acc, a * 0.35);
    }
    return N;
  }
  // the steps of the setup, on the bottom of the rim, under the pills
  function stepDots(a){
    if (S.step === 'birth') return 0;
    const i0 = DOTS.indexOf(S.step), acc = ACC(), all = S.step === 'done';
    return rimDots(DOTS.length, i0, i => all || i < i0 ? acc : null, a, false, 0.06);
  }

  // props Dotto holds: drawn as pixels next to his "hand", on the side he faces
  const ANTENNA = ['.o.', 'ooo', '.o.', '.k.', '.k.', '.k.', '.k.', '.k.'];
  const LENS = ['.###..', '#ggg#.', '#ggg#.', '#ggg#.', '.###..', '....#.', '.....#'];
  const hand = (dx = 15, dy = -16) => { const f = pip.face || 1; return [pip.x + dx * f, pip.y + dy]; };
  // the waves out of the antenna: five directions around "up", kept
  const AW = (() => { const c = [], s = []; for (let j = -2; j <= 2; j++){ const an = -Math.PI / 2 + j * 0.3; c.push(Math.cos(an)); s.push(Math.sin(an)); } return { c, s }; })();
  function antenna(a, fast){
    const [x, y] = hand(14, -6); let n = 0;
    E.sprite(ANTENNA, x, y, { px: 2.2, anchor: 'bottom', palette: { o: INK, k: ACC() }, a });
    const tipY = y - 8 * 2.2 + 3, per = fast ? 520 : 1300;
    for (let k = 0; k < 3; k++){
      const u = ((S.now / per) + k / 3) % 1, R = 6 + u * 20, al = a * (1 - u) * 0.9;
      for (let j = 0; j < 5; j++){ dot(x + AW.c[j] * R, tipY + AW.s[j] * R, 1.3, INK, al); n++; }
    }
    return n;
  }
  function lens(a){ const [x, y] = hand(17, -20); E.sprite(LENS, x, y, { px: 2.2, palette: { '#': INK, g: 'rgba(190,225,255,0.28)' }, a, mirror: (pip.face || 1) < 0 }); }

  // the Hue Bridge, front view: a rounded square of fine dots (the material of the pills: a white dotted outline, a
  // faint fill) with its round button in the middle. Cells are found once. Dotto stands on it.
  const BRX = C, BR_P = 4.5, BR_W = 15, BR_H = 12, BR_BOT = C - 32;
  const BR_CY = BR_BOT - (BR_H - 1) * BR_P / 2, BR_TOP = BR_BOT - (BR_H - 1) * BR_P - 3;
  const BRIDGE = (() => {
    const L = [], hw = (BR_W - 1) * BR_P / 2, hh = (BR_H - 1) * BR_P / 2, rc = 2.2 * BR_P;
    const inside = (x, y) => { const dx = Math.max(0, Math.abs(x) - (hw - rc)), dy = Math.max(0, Math.abs(y) - (hh - rc)); return dx * dx + dy * dy <= rc * rc + 0.5; };
    for (let r = 0; r < BR_H; r++) for (let c = 0; c < BR_W; c++){
      const x = (c - (BR_W - 1) / 2) * BR_P, y = (r - (BR_H - 1) / 2) * BR_P;
      if (!inside(x, y) || x * x + y * y < 15 * 15) continue;
      const edge = !inside(x - BR_P, y) || !inside(x + BR_P, y) || !inside(x, y - BR_P) || !inside(x, y + BR_P);
      L.push({ x, y, edge });
    }
    return L;
  })();
  // glow: 0–1 once paired (the body fills with the accent); dim: not found (all in the accent, faint)
  function bridge(a, glow = 0, dim = false){
    let n = 0; const acc = ACC();
    const push = clamp(1 - (S.now - S.btnT) / 260, 0, 1), wait = !dim && glow <= 0 ? 0.5 + 0.5 * Math.sin(S.now / 420) : 1;
    for (const q of BRIDGE){
      if (q.edge) dot(BRX + q.x, BR_CY + q.y, 1.5, dim ? acc : INK, a * (dim ? 0.45 : 0.95));
      else dot(BRX + q.x, BR_CY + q.y, 1.35, acc, a * (dim ? 0.12 : 0.26 + 0.5 * glow));
      n++;
    }
    // the button: a ring of dots and its centre; while Dotto waits for it, it breathes
    const bc = dim ? acc : glow > 0 ? acc : INK, ba = dim ? 0.45 : 0.55 + 0.45 * Math.max(wait, push, glow);
    for (let i = 0; i < U16.n; i++){ dot(BRX + U16.c[i] * 10, BR_CY + U16.s[i] * 10, 1.6, bc, a * ba); n++; }
    dot(BRX, BR_CY, 2.4 + push, bc, a * (dim ? 0.45 : 1)); n++;
    // pressed: two rings of dots run out of the button (no gradient: dots only)
    const pt = S.now - S.btnT;
    if (!dim && pt >= 0 && pt < 900) for (let k = 0; k < 2; k++){
      const u = clamp((pt - k * 180) / 700, 0, 1); if (u <= 0 || u >= 1) continue;
      const R = 14 + u * 34;
      for (let i = 0; i < U24.n; i++){ dot(BRX + U24.c[i] * R, BR_CY + U24.s[i] * R, 1.5, acc, a * (1 - u) * 0.9); n++; }
    }
    return n;
  }

  // "done": a check that draws itself, stroke by stroke, in green (10 × 7 on the 9 px pitch of the digits)
  const CHECK = [[0, 3], [1, 4], [2, 5], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [8, 1], [9, 0]];
  function check(cx, cy, a, t){
    let n = 0;
    for (let i = 0; i < CHECK.length; i++){
      const k = clamp((t - i * 30) / 200, 0, 1); if (k <= 0) break;
      const [c, r] = CHECK[i];
      dot(cx + (c - 4.5) * 9, cy + (r - 3) * 9, 3.3 * (0.6 + 0.4 * eoc(k)), OK, a * k); n++;
    }
    return n;
  }
  // the WiFi sign: three arcs and a dot (arcs of 5, 9, 13 dots, radius 18, 36, 54), kept as offsets from the dot.
  // No signal: the arcs are the accent, faint, and only the dot is lit
  const WIFI = (() => { const L = []; for (let k = 1; k <= 3; k++){ const R = k * 18, m = 1 + k * 4; for (let j = 0; j < m; j++){ const an = -Math.PI / 2 + (j / (m - 1) - 0.5) * 1.5; L.push([Math.cos(an) * R, Math.sin(an) * R]); } } return L; })();
  function wifiSign(cx, cy, a, off){
    const by = cy + 27, acc = ACC(), br = 0.6 + 0.4 * Math.sin(S.now / 500);
    for (const [x, y] of WIFI) dot(cx + x, by + y, 2.1, off ? acc : INK, a * (off ? 0.3 : 1));
    dot(cx, by, 3.3, INK, a * (off ? br : 1));
    return WIFI.length + 1;
  }
  // the bulb of the menu's Luci icon (screens/menu.js), in the accent and faint: a lamp that does not answer
  const BULB = ['...###...', '..#...#..', '.#.....#.', '.#.....#.', '.#.....#.', '..#...#..', '...#.#...', '...###...', '...###...'];
  const BULB_CELLS = (() => { const L = []; BULB.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') L.push([c - 4, r - 4]); })); return L; })();
  function deadBulb(cx, cy, a){ const acc = ACC(); for (const [c, r] of BULB_CELLS) dot(cx + c * 8, cy + r * 8, 3.1, acc, a * 0.45); return BULB_CELLS.length; }
  // music: 11 columns of 8 dots on the beat (lit: white; the rest of the column: the accent, faint)
  function eq(cx, cy, a, live){
    let n = 0; const b = (S.now % 476) / 476, kick = (1 - b) * (1 - b), acc = ACC();     // a square for the decay: no exp
    for (let c = 0; c < 11; c++){
      const h = live ? 1 + Math.round((0.35 + 0.65 * Math.abs(Math.sin(S.now / (260 + c * 37) + c * 1.7))) * 6 * (0.55 + 0.45 * kick)) : 1;
      for (let r = 0; r < 8; r++){ const on = r < h; dot(cx + (c - 5) * 9, cy + 31.5 - r * 9, on ? 2.7 : 1.2, on ? INK : acc, a * (on ? 1 : 0.3)); n++; }
    }
    return n;
  }
  // a list as a block: flush left, centred on the glass by its widest line; each line has a dot in front of it.
  // rows: [{ s, col (the dot), a, right (an optional number, flush right) }]
  function list(rows, cy, pitch, a){
    let wl = 0, wr = 0;
    for (const q of rows){ wl = Math.max(wl, inkOf('caption', q.s)); if (q.right) wr = Math.max(wr, inkOf('caption', q.right)); }
    const BUL = 18, GAP = wr ? 26 : 0, tot = BUL + wl + GAP + wr, x0 = C - tot / 2, y0 = cy - (rows.length - 1) * pitch / 2;
    rows.forEach((q, i) => {
      const al = a * (q.a == null ? 1 : q.a), y = y0 + i * pitch; if (al <= 0.01) return;
      dot(x0 + 3, y, q.r || 3, q.col, al);
      textAt('caption', q.s, x0 + BUL, y, al, INK);
      if (q.right) textAt('caption', q.right, x0 + tot - inkOf('caption', q.right), y, al, K.colOf('caption'));
    });
    return rows.length;
  }

  /* ---------- birth: the dots of the glass gather into Dotto ---------- */
  // each particle's path is fixed: start, end, delay and the side it bends to are worked out once
  let BIRTH = null;
  function makeBirth(){
    const rows = E.POSES.idle, p = pip.p, tg = [];
    rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') tg.push([C + (c - 4) * p, MID + (r - 7) * p]); }));
    const src = []; for (let y = C % 9; y < 466; y += 9) for (let x = C % 9; x < 466; x += 9) if (Math.hypot(x - C, y - C) < 196) src.push([x, y]);
    const parts = [];
    for (let i = 0; i < tg.length + 26; i++){
      const s = src[Math.floor(hash(i, 3, 9) * src.length)], t = tg[i % tg.length], extra = i >= tg.length;
      const nx = -(t[1] - s[1]), ny = t[0] - s[0], L = Math.hypot(nx, ny) || 1;
      parts.push({ x0: s[0], y0: s[1], x1: t[0], y1: t[1], nx: nx / L * 26, ny: ny / L * 26, d: hash(i, 7) * 520 + Math.hypot(s[0] - C, s[1] - C) * 0.9, extra });
    }
    return parts;
  }
  function drawBirth(a, el){
    let n = 0; const out = 1 - sstep(1350, 1650, el);
    if (out <= 0.01) return 0;
    for (const q of BIRTH){
      const k = clamp((el - q.d) / 820, 0, 1), e = eoc(k), bend = Math.sin(k * Math.PI);
      const x = lerp(q.x0, q.x1, e) + q.nx * bend, y = lerp(q.y0, q.y1, e) + q.ny * bend;
      const al = (k > 0 ? 1 : 0.35) * (q.extra ? 1 - sstep(0.5, 1, k) : 1) * out;
      dot(x, y, lerp(0.9, 2, e), INK, a * al); n++;
    }
    return n;
  }

  /* ---------- the room game ---------- */
  const G = { rooms: [], sel: 0, selF: 0, queue: [], i: 0, assign: {}, newN: 0 };
  function lampsConnected(){ return LAMPS.map((L, i) => i).filter(i => (LAMPS[i].brand === 'Hue' && S.hue) || LAMPS[i].brand === 'WiZ' || (LAMPS[i].brand === 'Govee' && S.govee)); }
  function counts(){ const n = { Hue: 0, WiZ: 0, Govee: 0 }; for (const i of lampsConnected()) n[LAMPS[i].brand]++; return n; }
  const lampNow = () => G.queue[G.i];
  function nextLamp(){
    G.i++;
    if (G.i >= G.queue.length){ phase('recap'); return; }
    phase(SIM.deadLamp && lampNow() === DEAD ? 'dead' : 'blink');
  }
  // the drum of rooms: the chosen one in hero dots; the confirmed one flashes in its room's colour
  function drum(a){
    G.selF += (G.sel - G.selF) * (1 - Math.exp(-S.dt / 70));
    return K.drum(G.rooms, G.selF, a, i => {
      const fl = S.ph === 'assigned' && i === G.sel ? 1 - sstep(200, 900, S.now - S.t0) : 0;
      return fl > 0 ? H.rgb(H.mixc([255, 255, 255], hueOf(G.rooms[i]), fl)) : null;
    });
  }

  /* ---------- gestures ---------- */
  const GEST = [
    { k: 'rotate', t: 'Gira il bordo', t2: 'come una ghiera' },
    { k: 'tap', t: 'Tocca', t2: 'per aprire' },
    { k: 'swipe', t: 'Scorri a destra', t2: 'per tornare indietro' },
    { k: 'flip', t: 'Capovolgilo', t2: 'per la pausa' }
  ];
  const GS = { i: 0, ok: -1e9, rot: 0, rotF: 0, flipT: 0, runT: 0, turnT: -1e9 };
  function gestureOk(){
    if (S.now - GS.ok < 1000) return;
    GS.ok = S.now; haptic('confirm'); pip.play('arms', 700); pip.hop(200);
    later(1000, () => { GS.i++; if (GS.i >= GEST.length) to('done'); else { GS.ok = -1e9; GS.rot = 0; GS.rotF = 0; S.t0 = S.now; } });
  }
  // the gesture to try, drawn small in the hero, each with its own fixed table
  const ROT_TURNS = 4;                                 // detents to complete "turn the bezel"
  function gestRotate(cy, a){
    // a small dial that fills as you turn (the same dial lights on the right of the rim, where the finger goes)
    const f = clamp(Math.abs(GS.rotF) / ROT_TURNS, 0, 1), neg = GS.rotF < 0, acc = ACC(), lit = Math.round(f * U24.n);
    let n = 0;
    for (let i = 0; i < U24.n; i++){
      const j = neg ? (U24.n - i) % U24.n : i, on = i < lit;
      dot(C + U24.c[j] * 44, cy + U24.s[j] * 44, on ? 2.4 : 1.5, on ? INK : acc, a * (on ? 1 : 0.4)); n++;
    }
    const kj = neg ? (U24.n - lit) % U24.n : lit % U24.n;
    dot(C + U24.c[kj] * 44, cy + U24.s[kj] * 44, 3.8, INK, a); n++;
    const turning = S.now - GS.turnT < 400;
    K.arc({ f, r: 206, a0: -0.3 * Math.PI, span: 0.6 * Math.PI, a: a * (0.75 + 0.25 * (turning ? 1 : Math.sin(S.now / 420))), act: turning });
    return n;
  }
  function gestTap(cy, a){
    // a finger's tap: two calm ripples out of a dot
    let n = 0; const acc = ACC();
    for (let k = 0; k < 2; k++){
      const u = ((S.now / 1600) + k / 2) % 1, R = 12 + u * 38;
      for (let i = 0; i < U24.n; i++){ dot(C + U24.c[i] * R, cy + U24.s[i] * R, 1.5, u < 0.35 ? INK : acc, a * (1 - u) * 0.9); n++; }
    }
    dot(C, cy, 4.6 + 0.6 * Math.sin(S.now / 260), INK, a); return n + 1;
  }
  function gestSwipe(cy, a){
    // a track left to right: a light runs along it and ends in an arrowhead
    let n = 0; const u = (S.now % 1600) / 1600, head = u * 13, acc = ACC();
    for (let i = 0; i < 11; i++){
      const x = C - 66 + i * 12, d = head - i, on = d >= 0 && d < 1;
      dot(x, cy, on ? 3.2 : 1.8, d >= 0 && d < 4 ? INK : acc, a * (d >= 0 ? Math.max(0.35, 1 - d / 5) : 0.35)); n++;
    }
    const tip = head >= 11 ? 1 : 0.5;
    for (let k = 1; k <= 3; k++){ dot(C + 66 - k * 8, cy - k * 8, 2, INK, a * tip); dot(C + 66 - k * 8, cy + k * 8, 2, INK, a * tip); n += 2; }
    return n;
  }
  function gestFlip(cy, a){
    // a disc that turns over (the device upside down): the face is white with a dot, the back is the accent
    // over, a pause, back again, a pause: in step with Dotto's own flip (every 2.1 s)
    let n = 0; const t = S.now % 2100, k = t < 1050 ? eoc(clamp(t / 700, 0, 1)) : 1 + eoc(clamp((t - 1050) / 700, 0, 1));
    const sy = Math.cos(k * Math.PI), back = sy < 0;
    const col = back ? ACC() : INK, ry = 40 * Math.max(0.08, Math.abs(sy));
    for (let i = 0; i < U24.n; i++){ dot(C + U24.c[i] * 40, cy + U24.s[i] * ry, 1.9, col, a * (back ? 0.7 : 1)); n++; }
    if (!back) { dot(C, cy, 4 * Math.abs(sy) + 0.5, INK, a); n++; }
    return n;
  }

  /* ---------- entering a phase: what Dotto does, once ---------- */
  function enter(){
    const k = S.step + '.' + S.ph;
    S.free = false; S.where = { surf: 'stage', s: 0 };
    pip.stopPlay(); pip.pose(null); pip.eyes(0); pip.wear();
    switch (k){
      case 'birth.':
        BIRTH = makeBirth(); S.where = { surf: 'mid', s: 0 }; S.hue = S.govee = false;
        W.begin(S.now); geometry(); pip.place('mid', 0); pip.idle();
        G.assign = {}; GS.i = 0; GS.ok = -1e9;
        break;
      case 'wifi.qr': S.where = { surf: 'stage', s: -40 }; break;
      case 'wifi.ok': pip.play('arms', 900); pip.hop(260); W.fx.sparks(pip.x, pip.y - 30, 8); wave(OK_RGB, 0.9); haptic('confirm'); later(1900, () => { if (S.step === 'wifi') to('time', 'sync'); }); break;
      case 'wifi.fail': W.fx.sweat(pip, 1); haptic('heavy'); break;
      // the digits wait as dashes; when the time comes they fall in place (the Caduta of the clock)
      case 'time.sync': S.T = H.makeText(); H.setText(S.T, '--:--', S.now); break;
      case 'time.show': if (!S.T) S.T = H.makeText(); H.setText(S.T, clockStr(), S.now); S.date = dateStr(); break;
      case 'lights.search': S.hue = false; S.govee = false; break;
      case 'lights.hue': S.btnT = -1e9; S.hopT = S.now + 600; S.where = { surf: 'bridge', s: 0 }; break;
      case 'lights.paired': S.hue = true; S.where = { surf: 'bridge', s: 0 }; pip.play('arms', 900); W.fx.sparks(BRX, BR_TOP + 20, 10, { cols: ['#ffffff', '#cfe6ff', '#96cdff'] }); wave([150, 205, 255], 0.8); haptic('confirm'); later(1700, () => { if (S.step === 'lights') afterHue(); }); break;
      case 'lights.huefail': case 'lights.nobridge': haptic('soft'); S.where = { surf: 'stage', s: -50 }; break;
      case 'lights.govee': S.where = { surf: 'stage', s: -62 }; break;
      case 'lights.found': S.govee = S.govee || !SIM.goveeOff; pip.hop(200); pip.play('arms', 600); haptic('confirm'); S.N = H.makeText(); H.setText(S.N, String(lampsConnected().length), S.now); break;
      // Dotto wears the blinking bulb: he stands at the far end of his floor, clear of the caption
      case 'rooms.blink': S.blinkT0 = S.now; S.where = { surf: 'stage', s: -80 }; break;
      case 'rooms.assigned': case 'rooms.dead': S.where = { surf: 'stage', s: -80 }; break;
      case 'rooms.recap': {
        let k2 = 0; for (const [room] of recap()){ const c = hueOf(room); later(k2 * 260, () => wave(c, 0.75)); k2++; }
        pip.hop(220); pip.play('arms', 800); haptic('confirm'); break;
      }
      case 'spotify.qr': S.where = { surf: 'stage', s: -46 }; break;
      case 'spotify.playing': wave([169, 139, 255], 0.9); haptic('confirm'); pip.play('arms', 700); break;
      case 'gestures.': GS.i = 0; GS.ok = -1e9; GS.rot = 0; GS.rotF = 0; GS.flipT = S.now + 900; GS.runT = 0; break;
      case 'done.': S.free = true; wave([255, 255, 255], 0.6); haptic('confirm');
        later(700, () => { pip.jumpTo({ surf: 'rim', s: Math.PI / 2 + 0.55 }, { T: 0.5, done: () => pip.runTo(-Math.PI / 2 - 0.5, { vmax: 260 }) }); });
        later(3300, () => { if (S.step === 'done' && H.finish) H.finish(pip.s); });
        break;
    }
  }
  function afterHue(){ phase(SIM.goveeOff ? 'govee' : 'found'); }
  function recap(){
    const m = new Map();
    for (const i of G.queue){ const r = G.assign[i]; if (r) m.set(r, (m.get(r) || 0) + 1); }
    return [...m.entries()];
  }
  const nowDate = () => new Date(Date.now() + (H.st.timeOff || 0));
  function clockStr(){ const d = nowDate(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  // the date came with the time: it is the caption of the time step
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function dateStr(){ const d = nowDate(), g = GIORNI[d.getDay()]; return `${g[0].toUpperCase() + g.slice(1)} ${d.getDate()} ${MESI[d.getMonth()]}`; }

  /* ---------- the floors of this world ---------- */
  function geometry(){
    W.ring('rim', { cx: C, cy: C, R: RF, ceil: false });
    W.seg('stage', { x: C, y: STAGE, hl: 82 });
    if (S.step === 'birth') W.seg('mid', { x: C, y: MID, hl: 30 });
    if (S.step === 'time' && S.ph === 'show') W.seg('digits', { x: C, y: DIGY - 52, hl: 120 });
    if (S.step === 'lights' && /^(hue|paired)$/.test(S.ph)) W.seg('bridge', { x: BRX, y: BR_TOP, hl: 26 });
  }
  W.on('land', (P, Sf) => { if (Sf.id === 'bridge'){ S.btnT = S.now; return 'soft'; } });

  /* ---------- every frame: each step fills the template ---------- */
  function run(a, now, dt){
    S.now = now; S.dt = dt;
    for (let i = S.pend.length - 1; i >= 0; i--) if (now >= S.pend[i].t){ const f = S.pend[i].f; S.pend.splice(i, 1); f(); }
    W.begin(now); geometry();
    const el = now - S.t0, ph = S.ph;
    let n = 0, pipA = 1, pose = null, wear = [], eye = 0, prop = null;
    const L = { title: '', body: '', caption: '', pills: null };
    house();

    // Dotto goes where the step wants him: jumps there, then walks along the floor
    if (!S.free && pip.ready()){
      const tgt = S.where, here = pip.surf && pip.surf.id === tgt.surf;
      if (!here && W.get(tgt.surf)) pip.jumpTo(tgt, { T: tgt.surf === 'digits' ? 0.62 : undefined });
      else if (here && !pip.cmd && Math.abs(pip.s - tgt.s) > 4 && !(S.step === 'lights' && /search/.test(ph)) && S.step !== 'gestures') pip.walkTo(tgt.s, { vmax: 70 });
    }
    const calm = pip.ready() && !pip.cmd;

    switch (S.step){
      case 'birth': {
        pipA = sstep(1350, 1600, el);
        n += drawBirth(a, el);
        if (el > 1600){
          eye = el < 2200 ? -1 : el < 2800 ? 1 : 0;
          if (el > 2800 && !S.waved){ S.waved = true; pip.play('arms', 800); pip.hop(180); haptic('soft'); }
          pose = E.blink(now) ? 'blink' : null;
        }
        if (el > 3000){ L.body = 'Ciao, sono Dotto'; L.caption = 'Facciamo conoscenza'; S.t0b = S.t0b || now; }
        if (el > 3800) L.pills = [GO('Inizia')];
        break;
      }
      case 'wifi': {
        L.title = 'WiFi'; prop = 'antenna';
        // the QR stays on screen the whole time the phone is busy: while it syncs, rings run out of its centre
        const WQ = 'WIFI:T:nopass;S:Dotto-4F2A;;', sinceSync = ph === 'phone' || ph === 'join' ? el : 0;
        if (ph === 'qr') n += drawQR(WQ, C, Y.hero, QR_P, a, el);
        else if (ph === 'phone' || ph === 'join') n += drawQR(WQ, C, Y.hero, QR_P, a, 9999, -1, ph === 'join' ? 2 : sstep(0, 600, sinceSync));
        else if (ph === 'ok' && el < 1200) n += drawQR(WQ, C, Y.hero, QR_P, a, 9999, el, 2);
        if (ph === 'qr'){
          L.body = 'Inquadra il QR'; L.caption = 'con il telefono'; L.pills = [SKIP];
          pose = calm ? (Math.floor(now / 1400) % 3 === 0 ? 'lookup' : E.blink(now) ? 'blink' : null) : null;
          if (el > 7000) phase('phone');
        } else if (ph === 'phone'){
          L.body = 'Ti vedo'; L.caption = 'Ora scegli il WiFi';
          pose = calm ? (Math.floor(now / 900) % 2 ? 'tap' : 'idle') : null;
          if (el > 5200) phase('join');
        } else if (ph === 'join'){
          L.body = 'Mi collego'; L.caption = 'Un attimo';
          pose = calm ? 'lookup' : null;
          if (el > 2200) phase(SIM.wifiFail ? 'fail' : 'ok');
        } else if (ph === 'ok'){
          n += check(C, Y.hero, a, el - 450);
          L.body = 'Ci sono'; L.caption = 'Sono sul WiFi di casa';
        } else if (ph === 'fail'){
          n += wifiSign(C, Y.hero, a * fade(el, 0, 300), true);
          L.body = 'Password sbagliata?'; L.caption = 'Riprova dal telefono'; L.pills = [SKIP, GO('Riprova')];
          pose = calm ? 'sad' : null;
          if (calm && (el % 2600) < S.dt) W.fx.sweat(pip, 1);
        }
        break;
      }
      case 'time': {
        L.title = 'Ora';
        if (ph === 'sync'){
          // dashes where the digits will be, breathing in the accent; the rim sweep says it is asking the network
          n += H.drawText(S.T, H.D, C, DIGY, 9, 3.3, ACC(), now, { alpha: a * (0.45 + 0.2 * Math.sin(now / 300)), ink: true });
          n += sweep(a * fade(el, 0, 300), el);
          L.body = 'Che ore sono?'; L.caption = 'Chiedo a internet';
          pose = calm ? 'lookup' : null;
          if (el > 1300) phase('show');
        } else {
          H.setText(S.T, clockStr(), now);
          n += H.drawText(S.T, H.D, C, DIGY, 9, 3.3, INK, now, { alpha: a, depth: true, ink: true });
          if (el > 700){ L.body = 'Ora italiana'; L.caption = S.date; }
          pose = calm ? (el < 2500 ? 'lookup' : E.blink(now) ? 'blink' : null) : null;
          if (el > 5200) to('lights', 'search');
        }
        break;
      }
      case 'lights': {
        L.title = 'Luci';
        if (ph === 'search' || ph === 'govsearch'){
          prop = 'lens';
          if (calm) pip.walkTo(pip.s > 0 ? -58 : 58, { vmax: 52 });
          n += sweep(a * fade(el, 0, 300), el);
          if (ph === 'search'){
            // what answers shows up as a list, one line at a time (the block is laid out for all of them at once)
            const found = [];
            if (!SIM.bridgeOff) found.push([1200, 'Bridge Hue']);
            found.push([2000, 'WiZ · 2 lampade']);
            if (!SIM.goveeOff) found.push([2700, 'Govee · 2 faretti']);
            for (const [t] of found) if (el >= t && el - t < S.dt) haptic('detent');
            n += list(found.map(([t, s]) => ({ s, col: ACC(), a: fade(el, t, 300) })), Y.hero, 36, a);
            L.body = 'Cerco le luci'; L.caption = 'Hue, WiZ e Govee';
            if (el > 3600){ S.govee = !SIM.goveeOff; phase(SIM.bridgeOff ? 'nobridge' : 'hue'); }
          } else {
            n += list([{ s: 'Govee', col: ACC(), r: 2.4 + 0.8 * (0.5 + 0.5 * Math.sin(now / 200)) }], Y.hero, 36, a * fade(el, 0, 250));
            L.body = 'Cerco i Govee'; L.caption = 'Con LAN Control';
            if (el > 1600){ if (SIM.goveeOff){ phase('govee'); toast('Ancora niente'); } else { S.govee = true; phase('found'); } }
          }
        } else if (ph === 'nobridge'){
          n += bridge(a, 0, true);
          L.body = 'Bridge non trovato'; L.caption = 'È acceso e collegato?'; L.pills = [SKIP, GO('Riprova')];
          prop = 'lens'; pose = calm ? (el % 3000 < 1500 ? 'shrug' : null) : null; eye = Math.floor(now / 900) % 2 ? 1 : -1;
        } else if (ph === 'hue' || ph === 'paired'){
          n += bridge(a, ph === 'paired' ? 1 - sstep(1000, 1700, el) * 0.4 : 0);
          if (ph === 'hue'){
            L.body = 'Premi il pulsante'; L.caption = 'sul Bridge Hue';
            // 30 seconds to press it: the dial on the rim runs out, as in Timer
            K.arc({ f: clamp(1 - el / 30000, 0, 1), a: a * fade(el, 0, 400) });
            if (pip.surf && pip.surf.id === 'bridge' && calm && now > S.hopT){ S.hopT = now + 760; pip.hop(150); }
            pose = calm ? 'lookdown' : null;
            if (el > 30000) phase('huefail');
          } else { const c = counts(); L.body = 'Hue collegato'; L.caption = `${c.Hue} ${c.Hue === 1 ? 'lampada' : 'lampade'} Hue`; }
        } else if (ph === 'huefail'){
          n += bridge(a, 0, true);
          L.body = "Non l'ho sentito"; L.caption = 'Quello tondo in mezzo'; L.pills = [SKIP, GO('Riprova')];
          pose = calm ? 'shrug' : null;
        } else if (ph === 'govee'){
          n += drawQR('http://dotto.local/govee', C, Y.hero, QR_P, a, el);
          L.body = 'Attiva LAN Control'; L.caption = "nell'app Govee Home"; L.pills = [SKIP, GO('Fatto')];
          pose = calm && el < 1600 ? 'shrug' : null;
        } else if (ph === 'found'){
          const c = counts(), parts = [];
          if (c.Hue) parts.push(`Hue ${c.Hue}`); if (c.WiZ) parts.push(`WiZ ${c.WiZ}`); if (c.Govee) parts.push(`Govee ${c.Govee}`);
          n += H.drawText(S.N, H.D, C, Y.hero, 9, 3.3, INK, now, { alpha: a, depth: true, ink: true });
          L.body = 'Luci trovate'; L.caption = parts.join(', '); L.pills = [GO('Continua')];
        }
        break;
      }
      case 'rooms': {
        const N = G.queue.length;
        n += rimDots(N, G.i, i => i < G.i || (i === G.i && ph === 'assigned') ? (G.assign[G.queue[i]] ? H.rgb(hueOf(G.assign[G.queue[i]])) : null) : null, a);
        L.title = 'Stanze';
        if (ph === 'blink' || ph === 'assigned'){
          // the caption is short (the brand is on the panel, the rim has a dot per lamp): Dotto's bulb stays clear of it
          const bl = now - S.blinkT0, on = bl < 4200 ? (Math.floor(bl / 420) % 2 === 0 ? 1 : 0) : 0.35;
          n += drum(a);
          L.body = 'Dove si è accesa?'; L.caption = `${G.i + 1} di ${N}`; L.pills = ph === 'blink' ? [{ t: "Non l'ho vista", act: 'again' }] : null;
          wear = ['bulb']; pip.bulb = ph === 'assigned' ? 1 : on;
          pose = calm ? (bl < 4200 ? 'lookup' : E.blink(now) ? 'blink' : null) : null;
          if (ph === 'assigned' && el > 950) nextLamp();
        } else if (ph === 'dead'){
          n += deadBulb(C, Y.hero, a * fade(el, 0, 300));
          L.body = 'Non risponde'; L.caption = 'La salto per ora';
          pose = calm ? 'shrug' : null;
          if (el > 2800) nextLamp();
        } else if (ph === 'recap'){
          // room → lamps, as a block: the room's colour, its name, the count flush right
          const rows = recap().slice(0, 4).map(([room, k2], i) => ({ s: room, right: String(k2), col: H.rgb(hueOf(room)), a: fade(el, 150 + i * 160) }));
          n += list(rows, Y.hero, 34, a);
          L.body = 'Scene pronte'; L.caption = 'In ogni stanza'; L.pills = [GO('Continua')];
          if (calm && (el % 1800) < S.dt) pip.hop(140);
        }
        break;
      }
      case 'spotify': {
        L.title = 'Spotify'; wear = ['phones'];
        const SQ = 'http://dotto.local/spotify';
        if (ph === 'qr'){
          n += drawQR(SQ, C, Y.hero, QR_P, a, el);
          L.body = 'Inquadra il QR'; L.caption = 'e fai login su Spotify'; L.pills = [SKIP];
          pose = calm ? (E.blink(now) ? 'blink' : null) : null;
          if (el > 7000) phase('wait');
        } else if (ph === 'wait'){
          n += drawQR(SQ, C, Y.hero, QR_P, a, 9999, -1, 2);
          L.body = 'Un attimo'; L.caption = 'Ascolto cosa suona';
          pose = calm ? 'lookup' : null;
          if (el > 1600) phase(SIM.silent ? 'silent' : 'playing');
        } else if (ph === 'silent'){
          if (el < 1200) n += drawQR(SQ, C, Y.hero, QR_P, a, 9999, el);
          n += eq(C, Y.hero, a * fade(el, 500), false);
          L.body = 'Collegato'; L.caption = 'Metti una canzone'; L.pills = [SKIP];
          pose = calm ? (Math.floor(now / 300) % 2 ? 'tap' : 'idle') : null; eye = Math.floor(now / 1300) % 3 - 1;
          if (!SIM.silent && el > 600) phase('playing');
        } else if (ph === 'playing'){
          if (el < 1200) n += drawQR(SQ, C, Y.hero, QR_P, a, 9999, el);
          n += eq(C, Y.hero, a * fade(el, 500), true);
          L.body = 'Sento Solar Tape'; L.caption = "sull'Echo della sala"; L.pills = [GO('Continua')];
          // he dances on the beat with his feet on the floor (a hop would stretch him into the caption)
          if (calm) pose = Math.floor(now / 476) % 2 ? 'tap' : 'idle';
        }
        break;
      }
      case 'gestures': {
        L.title = 'Gesti';
        const g = GEST[GS.i] || GEST[GEST.length - 1], ok = now - GS.ok < 1000, cy = Y.hero, ga = a * fade(now - S.t0, 0, 300);
        n += rimDots(GEST.length, GS.i, i => i < GS.i || (i === GS.i && ok) ? ACC() : null, a);
        if (ok) n += check(C, cy, a, now - GS.ok);
        else if (g.k === 'rotate'){
          GS.rotF += (GS.rot - GS.rotF) * (1 - Math.exp(-S.dt / 90));
          n += gestRotate(cy, ga);
          eye = GS.rot > GS.rotF + 0.05 ? 1 : GS.rot < GS.rotF - 0.05 ? -1 : 0;
          if (Math.abs(GS.rot) >= ROT_TURNS) gestureOk();
        } else if (g.k === 'tap'){
          n += gestTap(cy, ga);
          pose = calm ? 'lookup' : null;
        } else if (g.k === 'swipe'){
          n += gestSwipe(cy, ga);
          if (calm){ if (pip.s > 0) pip.walkTo(-60, { vmax: 120 }); else if (now > GS.runT){ GS.runT = now + 1600; pip.runTo(60, { vmax: 300 }); } }
        } else if (g.k === 'flip'){
          n += gestFlip(cy, ga);
          if (calm && pip.surf && pip.surf.id === 'stage' && now > GS.flipT){ GS.flipT = now + 2100; pip.jumpTo({ surf: 'stage', s: pip.s }, { T: 0.42, spin: 1 }); }   // a lower flip: he stays under the caption
        }
        if (!ok){ L.body = g.t; L.caption = g.t2; } else { L.body = 'Perfetto'; }
        L.pills = [{ t: 'Salta', act: 'skipAll' }];
        break;
      }
      case 'done': {
        n += word('Fatto', C, Y.hero, HERO_P, INK, a * fade(el, 100));
        L.body = 'Ci vediamo'; L.caption = 'sul quadrante';
        break;
      }
    }
    // the body and caption come in with the phase; in the gestures the pill stays put from one gesture to the next
    compose(L, a, S.step === 'birth' ? now - (S.t0b || now) : S.step === 'gestures' ? now - S.stepT0 : el);
    if (S.step !== 'rooms') pip.bulb = 0;
    pip.pose(pose); pip.eyes(eye); pip.wear(...wear);
    n += stepDots(a);
    W.step(dt, now);
    n += W.draw(a * pipA, now);
    if (prop === 'antenna') n += antenna(a * (pip.ready() ? 1 : 0.6), ph === 'join');
    if (prop === 'lens') lens(a);
    n += W.drawFront(a * pipA);
    return n;
  }

  /* ---------- what is happening in the (pretend) house, for the panel ---------- */
  function house(){
    let t = '';
    const k = S.step + '.' + S.ph;
    if (k === 'wifi.qr') t = 'Il telefono vede la rete "Dotto-4F2A". Inquadra il QR o premi "Telefono: fatto".';
    else if (k === 'wifi.phone') t = 'Sul telefono si è aperta la pagina di Dotto: scegli il WiFi e scrivi la password.';
    else if (k === 'lights.hue') t = 'Dotto aspetta il pulsante del Bridge. Premi "Pulsante del Bridge" o tocca il Bridge disegnato.';
    else if (S.step === 'rooms' && (S.ph === 'blink' || S.ph === 'assigned')){ const Lm = LAMPS[lampNow()]; t = `In casa lampeggia ${Lm.name} (${Lm.brand}), che sta in ${Lm.room.toLowerCase()}.`; }
    else if (k === 'rooms.dead') t = `${LAMPS[DEAD].name[0].toUpperCase() + LAMPS[DEAD].name.slice(1)} non risponde.`;
    else if (k === 'spotify.qr') t = 'Sul telefono: login Spotify. Premi "Telefono: fatto" per saltare l\'attesa.';
    else if (S.step === 'gestures') t = GEST[GS.i] && GEST[GS.i].k === 'flip' ? 'Premi "Capovolgi" nel pannello.' : 'Prova il gesto sul display: per "Gira il bordo" fai scorrere il dito lungo il bordo.';
    if (t !== S.last){ S.last = t; if (H.house) H.house(t); }
  }

  /* ---------- input ---------- */
  const API = {
    W, pip, SIM, S, LAMPS, TS,
    start(step = 'birth', o = {}){
      S.only = o.only ? step : null;
      S.pend.length = 0; S.waved = false; S.t0b = 0; S.msgT = -1e9; S.hue = !SIM.bridgeOff; S.govee = !SIM.goveeOff; G.assign = {}; G.i = 0;
      S.stepT0 = S.now;
      if (step === 'birth'){ S.step = ''; to('birth'); return; }
      W.begin(S.now); S.step = step; geometry(); pip.place('stage', 0); pip.idle();
      if (step === 'rooms'){ startRooms(); return; }
      to(step, { wifi: 'qr', time: 'sync', lights: 'search', spotify: 'qr', gestures: '', done: '' }[step]);
    },
    state: () => ({ step: S.step, ph: S.ph }),
    wantsDrum: () => S.step === 'rooms' && S.ph === 'blink',
    tap(p){
      const hit = K.hit(S, p, S.now);
      if (hit){
        if (hit === 'skip'){ API.swipe(); return; }
        if (hit === 'again'){ haptic('soft'); S.blinkT0 = S.now; pip.hop(120); toast('La faccio lampeggiare ancora'); return; }
        if (hit === 'skipAll'){ haptic('soft'); toast('Li ritrovi in Impostazioni'); to('done'); return; }
        p = { x: C, y: C };
      }
      const el = S.now - S.t0, k = S.step + '.' + S.ph;
      if (S.step === 'gestures'){
        if (GEST[GS.i] && GEST[GS.i].k === 'tap') gestureOk(); else haptic('soft');
        return;
      }
      switch (k){
        case 'birth.': if (el > 1500){ haptic('confirm'); to('wifi', 'qr'); } return;
        case 'wifi.fail': haptic('confirm'); phase('qr'); return;
        case 'time.show': haptic('confirm'); to('lights', 'search'); return;
        case 'lights.nobridge': haptic('confirm'); phase('search'); return;
        case 'lights.huefail': haptic('confirm'); phase('hue'); return;
        case 'lights.hue': if (Math.hypot(p.x - BRX, p.y - (BR_BOT - 24)) < 46) API.bridge(); else haptic('soft'); return;
        case 'lights.govee': haptic('confirm'); phase('govsearch'); return;
        case 'lights.found': haptic('confirm'); startRooms(); return;
        case 'rooms.blink':
          assign(); return;
        case 'rooms.recap': haptic('confirm'); to('spotify', 'qr'); return;
        case 'spotify.playing': haptic('confirm'); to('gestures'); return;
      }
      haptic('soft');
    },
    rotate(d){
      if (S.step === 'rooms' && S.ph === 'blink'){
        const ns = clamp(G.sel + d, 0, G.rooms.length - 1);
        if (ns !== G.sel){ G.sel = ns; haptic('detent'); }
        return true;
      }
      if (S.step === 'gestures' && GEST[GS.i] && GEST[GS.i].k === 'rotate' && S.now - GS.ok > 1000){ GS.rot += d; GS.turnT = S.now; haptic('detent'); return true; }
      return false;
    },
    swipe(){
      const k = S.step + '.' + S.ph;
      if (S.step === 'gestures'){ if (GEST[GS.i] && GEST[GS.i].k === 'swipe') gestureOk(); return; }
      if (k === 'rooms.blink'){ haptic('soft'); toast('Saltata'); nextLamp(); return; }
      if (k === 'lights.nobridge' || k === 'lights.huefail'){ haptic('soft'); S.hue = false; afterHue(); return; }
      if (k === 'lights.govee'){ haptic('soft'); S.govee = false; phase('found'); return; }
      if (S.step === 'spotify'){ haptic('soft'); toast('Lo colleghi da Impostazioni'); to('gestures'); return; }
      if (S.step === 'wifi'){ haptic('soft'); toast('Senza WiFi faccio solo l\'ora'); to('done'); return; }
      haptic('soft');
    },
    flip(){ if (S.step === 'gestures' && GEST[GS.i] && GEST[GS.i].k === 'flip') gestureOk(); },
    phone(){
      const k = S.step + '.' + S.ph;
      if (k === 'wifi.qr') phase('phone'); else if (k === 'wifi.phone') phase('join');
      else if (k === 'spotify.qr') phase('wait'); else if (k === 'spotify.silent') SIM.silent = false;
    },
    bridge(){ if (S.step === 'lights' && S.ph === 'hue'){ S.btnT = S.now; phase('paired'); } }
  };
  function startRooms(){
    G.queue = lampsConnected(); G.i = 0; G.assign = {}; G.newN = 0;
    G.rooms = ['Sala', 'Cucina', 'Camera', 'Studio', 'Bagno', 'Ingresso', NEW_ROOM]; G.sel = G.selF = 0;
    to('rooms', G.queue.length ? (SIM.deadLamp && G.queue[0] === DEAD ? 'dead' : 'blink') : 'recap');
  }
  function assign(){
    let room = G.rooms[G.sel];
    if (room === NEW_ROOM){ G.newN++; room = `Stanza ${G.newN}`; G.rooms.splice(G.rooms.length - 1, 0, room); toast('Il nome lo cambi da dotto.local'); }
    G.assign[lampNow()] = room; phase('assigned');
    haptic('confirm'); pip.play('arms', 700); pip.hop(200); wave(hueOf(room), 0.8);
  }
  API.run = run;
  return API;
}
global.DottoSetup = { create };
})(window);
