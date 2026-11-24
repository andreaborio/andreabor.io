/* Musica (CONTENT.md): what is playing in the house, from Spotify, and the controls for it.
   Same template as every screen (ui/kit.js): title · hero (the cover, round, in coloured dots) · title of the song ·
   artist · Dotto with his headphones · a grey pill with the device it plays on.

   Made for a 44.5 mm glass and a fingertip: one continuous control per screen, on the rim, and big targets.
   - the outer ring is the volume: drag along it, like a touch bezel (rotating Dotto does the same);
   - the ring around the cover is the song: it only shows (too close to the volume to be a second slider);
   - tap the cover: play/pause; left or right of it (two zones of ~9 mm, with a dot arrow drawn in each): previous and
     next, the cover slides like a card;
   - the device pill opens the drum of Spotify Connect devices. Flip = pause (global).

   The tracks are fake (demo). On the device:
   - GET /v1/me/player every 3–5 s while this screen is open (every 15 s in the background, for the menu line);
   - the cover is the 64 px JPEG Spotify gives, decoded with esp_jpeg and averaged down to 21 × 21 dots, once per song;
   - no tempo from Spotify (audio-features is closed to new apps): Dotto dances to the beat the microphone hears. */
(function(global){
'use strict';
function create(H){
  const { C, INK, INK2, dot, haptic, wave, E, K } = H;
  const { clamp, lerp, sstep, eoc, hash } = E;
  const TAU = Math.PI * 2;
  const W = E.world('music'), pip = W.spawn({ p: H.PIP_P || 5, r: 2.2 });
  const scr = K.screen(), Y = K.Y;
  const TRACKS = [
    { t: 'Solar Tape', a: 'Nova Unit', dur: 214, bpm: 122, art: 'sun' },
    { t: 'Low Hum', a: 'Mira Vale', dur: 188, bpm: 96, art: 'waves' },
    { t: 'Glass Rooms', a: 'Kite Theory', dur: 251, bpm: 128, art: 'grid' },
    { t: 'Night Bus', a: 'Ottoboni', dur: 199, bpm: 110, art: 'moon' }
  ];
  const DEVICES = ['Echo sala', 'Echo camera', 'Mac', 'Telefono'];
  const M = { i: 0, pos: 37, playing: true, vol: 35, volT: -1e9, dev: 0, pick: false, sel: 0, selF: 0, pickT0: 0, swapT: -1e9, prevI: -1, silent: false, t0: 0, now: 0, beat: -1, init: false };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ---------- covers: made up, drawn as 21 × 21 coloured dots (the real ones come from Spotify's 64 px image) ---------- */
  // the pixelation is an EFFECT, not a limit: Spotify gives 64 px covers; we show them as 31 × 31 dots on purpose.
  // Port note: keep the cover as a dot matrix (31 × 31, pitch 4.4) when moving this to LVGL
  const N = 31, PITCH = 4.4, CACHE = {};
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * clamp(t, 0, 1));
  const ART = {
    sun(x, y){ let c = mix([255, 150, 70], [190, 50, 120], y * 1.2); const d = Math.hypot(x - 0.5, y - 0.58); if (d < 0.22) c = [255, 222, 120]; if (y > 0.7) c = (Math.floor(y * 30) % 2) ? [60, 20, 70] : mix(c, [40, 10, 60], 0.6); return c; },
    waves(x, y){ const w = Math.sin(x * 9 + Math.floor(y * 6) * 1.3) * 0.06; const band = Math.floor((y + w) * 6); return band % 2 ? [40, 200, 190] : mix([10, 30, 80], [20, 70, 140], y); },
    grid(x, y){ const cx = Math.floor(x * 5), cy = Math.floor(y * 5); if (cx === 3 && cy === 1) return [235, 60, 50]; return (cx + cy) % 2 ? [20, 20, 22] : [236, 232, 220]; },
    moon(x, y){ const d1 = Math.hypot(x - 0.55, y - 0.45), d2 = Math.hypot(x - 0.66, y - 0.38); if (d1 < 0.24 && d2 > 0.2) return [245, 238, 200]; if (hash(Math.floor(x * 21), Math.floor(y * 21), 3) > 0.96) return [200, 210, 255]; return mix([12, 18, 50], [40, 30, 90], y); }
  };
  function grid(ti){
    if (CACHE[ti]) return CACHE[ti];
    const g = [], fn = ART[TRACKS[ti].art]; let sum = [0, 0, 0];
    const raw = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const c = fn((x + 0.5) / N, (y + 0.5) / N); g.push(H.rgb(c)); raw.push(c); sum = sum.map((v, i) => v + c[i]); }
    const avg = sum.map(v => v / (N * N)), mx = Math.max(...avg) || 1, dom = avg.map(v => Math.min(255, v / mx * 255));
    return (CACHE[ti] = { g, raw, dom });
  }
  // the cover, round like a record: t = ms since it came in (rises row by row); dx = sideways slide (px), fa = its fade
  const CR = (N - 1) / 2 + 0.35, SEEK_R = 82, VOL_R = 206, A0 = 0.75 * Math.PI, SPAN = 1.5 * Math.PI;
  // the round mask and each cell's delay are fixed: one table (the cells inside the circle, with their arrival time)
  const DISC = (() => { const L = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - (N - 1) / 2, y - (N - 1) / 2) <= CR) L.push({ x, y, i: y * N + x, t0: y * 12 + hash(x, y, 11) * 100 }); return L; })();
  const COVER_IN = 240 + 12 * (N - 1) + 100;              // after this every cell has landed
  function cover(ti, a, t, dx = 0){
    const G = grid(ti).g, x0 = C - (N - 1) * PITCH / 2 + dx, y0 = Y.hero - (N - 1) * PITCH / 2, dim = M.playing || M.silent ? 1 : 0.4, r = PITCH * 0.42;
    const done = t >= COVER_IN; let n = 0;
    for (const q of DISC){
      let k = 1, py = y0 + q.y * PITCH;
      if (!done){ k = clamp((t - q.t0) / 240, 0, 1); if (k <= 0) continue; py -= (1 - eoc(k)) * 12; }
      const al = a * k * dim;
      if (al > 0.01){ dot(x0 + q.x * PITCH, py, r, M.silent ? INK2 : G[q.i], M.silent ? al * 0.35 : al); n++; }
    }
    return n;
  }
  // the song, around the cover: 60 dots from twelve o'clock, the head bigger; it grows while you hold it
  function seekRing(a){
    const T = TRACKS[M.i]; K.arc({ f: M.silent ? 0 : M.pos / T.dur, r: SEEK_R, cy: Y.hero, a0: -Math.PI / 2, span: TAU, w: 2, a }); return 1;
  }
  // the volume, on the outer ring: the same dial as everywhere, open at the bottom where the pills are
  function volRing(a){
    K.arc({ f: M.vol / 100, r: VOL_R, act: M.grab === 'vol' || M.now - M.volT < 900, a }); return 1;
  }
  // the cover spills out behind everything: blown up ×2.4 around the cover, in chunky pixels (7 × 7 steps of colour),
  // fading towards the bottom so the words stay readable; it breathes on the beat and crossfades with the song
  // where each grid dot of the aura sits never changes: one table of (x, y, the cover cell it shows, its fixed weight:
  // the fade to the bottom × the fade at the rim). A frame only mixes colours. Port: const table, ~700 entries.
  const AURA = (() => {
    const span = N * PITCH * 2.4, q = v => Math.floor(clamp(v, 0, 0.999) * 7) / 7 + 1 / 14, L = [];
    for (let y = C % 9; y < 466; y += 9){
      const gy = 1 - sstep(Y.hero + 30, C + 10, y); if (gy <= 0.01) continue;
      for (let x = C % 9; x < 466; x += 9){
        const d = Math.hypot(x - C, y - C), dc = Math.hypot(x - C, y - Y.hero); if (d > 190 || dc < 70) continue;
        L.push({ x, y, id: Math.floor(q((y - Y.hero) / span + 0.5) * N) * N + Math.floor(q((x - C) / span + 0.5) * N), w: gy * (1 - 0.7 * sstep(150, 204, d)) });
      }
    }
    return L;
  })();
  const mixed = [0, 0, 0];
  function aura(a){
    const sw = M.now - M.swapT, u = M.prevI >= 0 ? clamp(sw / 600, 0, 1) : 1, kick = M.playing ? Math.exp(-((M.pos * TRACKS[M.i].bpm / 60) % 1) * 4) : 0;
    const cur = grid(M.i).raw, cs = grid(M.i).g, old = M.prevI >= 0 && u < 1 ? grid(M.prevI).raw : null, k = a * (0.2 + 0.06 * kick) * (M.playing ? 1 : 0.5);
    for (const p of AURA){
      let col = cs[p.id];
      if (old){ const c = cur[p.id], o = old[p.id]; for (let i = 0; i < 3; i++) mixed[i] = c[i] + (o[i] - c[i]) * (1 - u); col = H.rgb(mixed); }
      dot(p.x, p.y, 2.4, col, k * p.w);
    }
    return AURA.length;
  }
  // previous / next: a chevron of dots on each side of the cover; it flashes when touched
  const ARX = 118;
  function arrows(a){
    for (const sd of [-1, 1]){
      // a bigger chevron (two rows of dots), white, that jumps out a little when touched
      const k = M.arrowSd === sd ? clamp(1 - (M.now - M.arrowT) / 300, 0, 1) : 0, cx = C + sd * (ARX + k * 6);
      for (let j = -3; j <= 3; j++) for (const w of [0, 1]) dot(cx + sd * ((3 - Math.abs(j)) * 4.5 - w * 4.5), Y.hero + j * 4.5, 1.7 + k * 0.6, INK, a * (w ? 0.45 : 0.95));
    }
  }
  function pauseGlyph(a, dx = 0){ for (const sx of [-1, 1]) for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) dot(C + dx + sx * 12 + (c - 0.5) * 6 * sx, Y.hero - 15 + r * 6, 2.4, INK, a); }

  /* ---------- Dotto ---------- */
  function geometry(){ W.ring('rim', { cx: C, cy: C, R: H.RF, ceil: false }); W.seg('stage', { x: C, y: Y.stage, hl: 70 }); }

  function run(a, now, dt){
    M.now = now;
    W.begin(now); geometry();
    if (!M.init){ M.init = true; pip.place('stage', 0); }
    const T = TRACKS[M.i], el = now - M.t0;
    let n = 0, pose = null;
    if (pip.ready() && (!pip.surf || pip.surf.id !== 'stage')) pip.jumpTo({ surf: 'stage', s: 0 });
    const calm = pip.ready() && !pip.cmd;

    if (M.pick){
      M.selF += (M.sel - M.selF) * (1 - Math.exp(-dt / 70));
      n += K.drum(DEVICES, M.selF, a, i => i === M.dev ? null : null);
      scr.titleT0 = M.pickT0;
      K.compose(scr, { title: 'Dove suona', caption: 'Gira il bordo e tocca' }, a, now - M.pickT0, now);
    } else {
      const sw = now - M.swapT, vt = now - M.volT, vk = M.grab === 'vol' || vt < 1100 ? 1 : 1 - sstep(1100, 1400, vt);
      // the aura sits behind the glass, the cover and its ring in front: tilt it and the cover floats
      const DP = H.depth, at = (z, fn) => DP ? DP.at(DP.P[z], fn) : fn();
      if (H.linked() && !M.silent) n += at('glow', () => aura(a));
      n += volRing(a);
      if (!H.linked()){ for (let i = 0; i < 20; i++){ const an = -Math.PI / 2 + i / 20 * TAU; dot(C + Math.cos(an) * 34, Y.hero + Math.sin(an) * 34, 1.7, INK, a * 0.25); } }
      else at('hero', () => {
        n += seekRing(a);
        // a new song slides in like a card, the old one slides out the other way
        const u = M.prevI >= 0 ? eoc(clamp(sw / 420, 0, 1)) : 1, dir = M.dir || 1;
        if (u < 1) n += cover(M.prevI, a * (1 - u), 9999, -dir * u * 140);
        n += cover(M.i, a * (M.prevI >= 0 ? u : 1), M.prevI >= 0 ? 9999 : el + 200, dir * (1 - u) * 140);
        if (!M.playing && !M.silent) pauseGlyph(a * u);
        if (!M.silent) arrows(a);
      });
      scr.titleT0 = M.t0;
      const L = !H.linked() ? { title: 'Musica', body: 'Spotify spento', caption: 'Serve Premium', pills: [K.GO('Collega', 'link')] } : M.silent
        ? { title: 'Musica', body: 'In silenzio', caption: `Ultimo: ${T.t}`, pills: [K.GO('Riprendi', 'resume'), K.OUT(DEVICES[M.dev], 'device')] }
        : { title: 'Musica', body: T.t, caption: vk > 0.5 ? `Volume ${M.vol}%` : M.grab === 'seek' ? `${mmss(M.pos)} di ${mmss(T.dur)}` : T.a, pills: [K.OUT(DEVICES[M.dev], 'device')] };
      K.compose(scr, L, a, M.prevI >= 0 ? Math.max(0, sw - 250) : el, now);
    }

    // Dotto: headphones on; with music he bounces on the beat (on the device: the beat the microphone hears)
    // Dotto, while it plays: a bounce on every beat, a spin every 16; loud: hands on his ears; quiet: he leans in;
    // a new song: he runs to meet the cover coming in; paused: he sits, and after a while he falls asleep
    const loud = M.vol >= 80, quiet = M.vol <= 15, volNow = now - M.volT < 1600;
    if (calm){
      if (M.playing && !M.silent && !M.pick && H.linked()){
        const b = Math.floor(M.pos * T.bpm / 60);
        if (Math.abs(pip.s) > 6 && now - M.swapT > 700){ pip.walkTo(0, { vmax: 90 }); }
        else if (b !== M.beat){ M.beat = b; if (b % 16 === 15) pip.jumpTo({ surf: 'stage', s: pip.s }, { T: 0.55, spin: M.dir || 1 }); else pip.hop(b % 4 === 0 ? 150 : 105); }
        pip.offset(Math.sin(M.pos * T.bpm / 60 * Math.PI) * 3, 0);
        if (loud) pose = 'ears'; else if (quiet && volNow) pose = 'lookdown';
      } else {
        pip.offset(0, 0);
        const still = now - (M.pauseT || now);
        pose = M.silent ? (Math.floor(now / 300) % 2 ? 'tap' : 'idle') : M.pick ? 'lookup' : still > 8000 ? 'sleep' : (E.blink(now) ? 'sitblink' : 'sit');
        if (pose === 'sleep' && now - (M.zT || 0) > 700){ M.zT = now; W.fx.zee(pip, 0); }
      }
    }
    if (!M.playing && !M.pauseT) M.pauseT = now; if (M.playing) M.pauseT = 0;
    pip.pose(pose); pip.eyes(M.pick ? 0 : 0); pip.wear('phones');
    W.step(dt, now);
    n += W.draw(a, now);
    n += W.drawFront(a);
    return n;
  }

  /* ---------- controls ---------- */
  function next(auto){
    M.prevI = M.i; M.i = (M.i + 1) % TRACKS.length; M.pos = 0; M.swapT = M.now; M.beat = -1; M.playing = true; M.dir = 1;
    wave(grid(M.i).dom, 0.6); if (!auto) haptic('confirm'); pip.eyes(1); if (pip.ready()) pip.runTo(48, { vmax: 320 });
  }
  function prev(){
    haptic('confirm');
    if (M.pos > 3){ M.pos = 0; K.toast(scr, 'Da capo', M.now); return; }
    M.prevI = M.i; M.i = (M.i + TRACKS.length - 1) % TRACKS.length; M.pos = 0; M.swapT = M.now; M.beat = -1; M.dir = -1;
    wave(grid(M.i).dom, 0.6); pip.eyes(-1); if (pip.ready()) pip.runTo(-48, { vmax: 320 });
  }
  const API = {
    W, pip, M, scr, TRACKS, DEVICES,
    enter(now){ M.t0 = now; M.prevI = -1; M.pick = false; M.volT = -1e9; },
    // the clock face wears the cover while music plays (see scrClock): fades in and out
    theme(){
      const on = H.linked() && M.playing && !M.silent;
      M.themeK = (M.themeK || 0) + ((on ? 1 : 0) - (M.themeK || 0)) * 0.05;
      if (M.themeK < 0.01) return null;
      const g = grid(M.i);
      return { k: M.themeK, dom: g.dom, title: TRACKS[M.i].t, raw: g.raw, css: g.g, at: (u, v) => g.raw[API.cellOf(u, v)] };
    },
    // which cover cell a point (u, v in 0–1) reads: callers with fixed points keep the index
    cellOf: (u, v) => clamp(Math.floor(v * N), 0, N - 1) * N + clamp(Math.floor(u * N), 0, N - 1),
    accent: () => grid(M.i).dom,
    // playback belongs to the player, not to this screen: the host ticks it every frame, whatever is on screen,
    // on a monotonic clock (on the device: the position Spotify reports, interpolated between polls)
    tick(){
      const t = performance.now(), d = M.lastT ? (t - M.lastT) / 1000 : 0; M.lastT = t;
      if (M.playing && !M.silent && H.linked()){ M.pos += d; if (M.pos >= TRACKS[M.i].dur) next(true); }
    },
    playing: () => H.linked() && M.playing && !M.silent,
    sub: () => !H.linked() ? 'Spotify non collegato' : M.silent ? 'Niente in riproduzione' : TRACKS[M.i].t,
    run,
    picking: () => M.pick,
    tap(p, now){
      if (M.pick){ M.dev = clamp(Math.round(M.sel), 0, DEVICES.length - 1); M.pick = false; M.t0 = now; M.prevI = -1; haptic('confirm'); wave([169, 139, 255], 0.6); K.toast(scr, `Ora suona su ${DEVICES[M.dev]}`, now); return; }
      const act = K.hit(scr, p, now);
      if (act === 'link'){ haptic('confirm'); H.link(); return; }
      if (!H.linked()) return;
      if (act === 'device'){ M.pick = true; M.sel = M.selF = M.dev; M.pickT0 = now; haptic('soft'); return; }
      if (act === 'resume'){ M.silent = false; M.playing = true; M.t0 = now; M.prevI = -1; haptic('confirm'); wave(grid(M.i).dom, 0.8); return; }
      // the zones: the cover in the middle, previous on its left, next on its right (inside the rim band)
      const dx = p.x - C, inHero = Math.abs(p.y - Y.hero) < 95 && Math.hypot(p.x - C, p.y - C) < 168;
      if (!M.silent && inHero && Math.abs(dx) > 62){ const sd = Math.sign(dx); M.arrowSd = sd; M.arrowT = now; if (sd > 0) next(false); else prev(); return; }
      if (!M.silent && inHero){
        M.playing = !M.playing; haptic('confirm');
        if (M.playing){ pip.hop(160); wave(grid(M.i).dom, 0.5); } else wave(null, 0.4, true);
      }
    },
    // dragging a ring: grab tells whether the finger went down on one; drag and release follow it
    grab(p){
      if (M.pick || M.silent || !H.linked()) return false;
      const rc = Math.hypot(p.x - C, p.y - Y.hero), rr = Math.hypot(p.x - C, p.y - C), an = Math.atan2(p.y - C, p.x - C);
      let rel = an - A0; while (rel < 0) rel += TAU;
      if (rr > 180 && rel <= SPAN + 0.12){ M.grab = 'vol'; return true; }
      return false;
    },
    drag(p){
      if (M.grab === 'seek'){
        let v = (Math.atan2(p.y - Y.hero, p.x - C) + Math.PI / 2) / TAU; v -= Math.floor(v);
        const T = TRACKS[M.i], np = v * T.dur; if (Math.floor(np / T.dur * 20) !== Math.floor(M.pos / T.dur * 20)) haptic('detent'); M.pos = np;
      } else if (M.grab === 'vol'){
        let rel = Math.atan2(p.y - C, p.x - C) - A0; while (rel < 0) rel += TAU; if (rel > SPAN) rel = rel > SPAN + (TAU - SPAN) / 2 ? 0 : SPAN;
        const nv = Math.round(rel / SPAN * 100); if (Math.floor(nv / 5) !== Math.floor(M.vol / 5)) haptic('detent'); M.vol = nv; M.volT = M.now;
      }
    },
    release(){ M.grab = null; },
    rotate(d){
      if (M.pick){ const ns = clamp(M.sel + d, 0, DEVICES.length - 1); if (ns !== M.sel){ M.sel = ns; haptic('detent'); } return; }
      if (M.silent) return;
      const nv = clamp(M.vol - d * 5, 0, 100); if (nv !== M.vol){ M.vol = nv; haptic('detent'); } M.volT = M.now;
    },
    next(){ if (!M.pick && !M.silent) next(false); },
    prev(){ if (!M.pick && !M.silent) prev(); },
    pause(){ if (M.playing){ M.playing = false; wave(null, 0.4, true); } },
    back(){ if (M.pick){ M.pick = false; M.t0 = M.now; M.prevI = -1; haptic('soft'); return true; } return false; },
    setSilent(v){ M.silent = v; M.t0 = M.now; M.prevI = -1; }
  };
  return API;
}
global.DottoMusic = { create };
})(window);
