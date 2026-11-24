/* Timer (CONTENT.md): one timer, nothing else. Same template as every screen (ui/kit.js); no buttons while you set it.
   The rim is the dial: while you set it (a finger along the rim) it shows the minutes; while it runs, the line is the
   time left. Tap the digits: start, pause, start again. Paused: "Azzera". At the end: tap or flip it; "+1 min".
   Dotto lives on that dial: he walks behind the time eating the line, sits and yawns at every full minute, sleeps on
   the end of the line when you pause, runs in the last ten seconds, and is the alarm when it ends.

   It runs in the background: tick() is called every frame by the host; on the clock face an arc on the rim shows the
   time left, and the menu line shows it too. When it ends the host brings the timer to the front.
   On the device: a FreeRTOS timer (esp_timer) keeps the time; the screen only reads it. Flip (QMI8658) stops the alarm. */
(function(global){
'use strict';
function create(H){
  const { C, INK, INK2, dot, haptic, wave, E, K } = H;
  const { clamp, sstep } = E;
  const TAU = Math.PI * 2, A0 = 0.75 * Math.PI, SPAN = 1.5 * Math.PI, NDOT = 41, YEL = [255, 211, 92];
  const W = E.world('timer'), pip = W.spawn({ p: H.PIP_P || 5, r: 2.2 });
  const scr = K.screen(), Y = K.Y, TT = H.makeText();
  const T = { mode: 'set', min: 5, total: 0, left: 0, ringT: 0, t0: 0, now: 0, lastMin: -1, sitT: 0, bangT: 0, zT: 0, runT: 0, init: false };
  const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const angOf = f => A0 + clamp(f, 0, 1) * SPAN;

  // the time is a deadline on a monotonic clock (performance.now here, esp_timer on the device), never the sum of frame
  // times: a slow or paused frame cannot slow the timer down. T.left is only read off the deadline
  const mono = () => performance.now();
  function start(min){
    T.total = T.left = min * 60000; T.end = mono() + T.total; T.mode = 'run'; T.t0 = T.now; T.lastMin = Math.ceil(T.left / 60000);
    H.resetText(TT, T.now); haptic('confirm'); wave(YEL, 0.8);
  }
  function stop(){ T.mode = 'set'; T.t0 = T.now; haptic('soft'); }
  function ring(){
    T.mode = 'ring'; T.ringT = T.now; T.t0 = T.now; T.bangT = 0;
    haptic('heavy'); wave(YEL, 1);
    if (H.onRing) H.onRing();
  }
  // called every frame, whatever is on screen
  function tick(dt){
    if (T.mode === 'run'){ T.left = Math.max(0, T.end - mono()); if (T.left <= 0) ring(); }
    if (T.mode === 'ring'){
      const t = T.now - T.ringT;
      if (Math.floor(t / 700) !== Math.floor((t - dt) / 700) && t < 20000) haptic(Math.floor(t / 700) % 2 ? 'confirm' : 'heavy');
      if (t > 20000){ T.mode = 'set'; T.t0 = T.now; }
    }
  }

  /* ---------- the dial on the rim ---------- */
  function dial(a, f, col, pulse){ K.arc({ f, a: a * (pulse ? 0.75 + 0.25 * Math.sin(T.now / 200) : 1), col }); return 1; }

  function geometry(){ W.ring('rim', { cx: C, cy: C, R: H.RF, ceil: false }); W.seg('stage', { x: C, y: Y.stage, hl: 70 }); }

  function run(a, now, dt){
    T.now = now;
    W.begin(now); geometry();
    if (!T.init){ T.init = true; pip.place('stage', 0); }
    const el = now - T.t0, f = T.total ? T.left / T.total : 0, calm = pip.ready() && !pip.cmd;
    let n = 0, pose = null, wear = [];
    const L = { title: 'Timer', pills: null };

    if (T.mode === 'set'){
      n += dial(a, T.min / 60, INK);
      H.setText(TT, fmt(T.min * 60000), now);
      n += H.drawText(TT, H.D, C, Y.hero, 9, 3.3, INK, now, { alpha: a, depth: true });
      L.body = 'Tocca per partire'; L.caption = 'Gira il bordo';
      if (pip.ready() && (!pip.surf || pip.surf.id !== 'stage')) pip.jumpTo({ surf: 'stage', s: 0 });
      pose = calm ? (now - (T.turnT || -1e9) < 500 ? (Math.floor(now / 120) % 2 ? 'tap' : 'idle') : E.blink(now) ? 'blink' : null) : null;
    } else if (T.mode === 'run' || T.mode === 'pause'){
      const run = T.mode === 'run', last10 = run && T.left < 10000;
      n += dial(a, f, INK, !run);
      H.setText(TT, fmt(T.left), now);
      n += H.drawText(TT, H.D, C, Y.hero, 9, 3.3, last10 ? H.rgb(YEL) : INK, now, { alpha: a * (run ? 1 : 0.55), depth: true });
      const head = angOf(f);
      L.body = run ? 'In corso' : 'In pausa'; L.caption = run ? 'Tocca per la pausa' : 'Tocca per ripartire';
      L.pills = run ? null : [K.OUT('Azzera', 'stop')];
      // Dotto: on the dial, at the head of the time left
      const onRim = pip.surf && pip.surf.id === 'rim' && !pip.air;
      if (!onRim){ if (pip.ready()) pip.jumpTo({ surf: 'rim', s: head + 0.05 }); }
      else if (!run){
        // paused: asleep against the last lit dot
        pose = 'sleep'; if (now - T.zT > 650){ T.zT = now; W.fx.zee(pip, 0); }
      } else if (last10){
        // the last ten seconds: he runs up and down the dial
        if (calm && now > T.runT){ T.runT = now + 700; pip.runTo(head + (Math.random() < 0.5 ? -0.35 : 0.35), { vmax: 260 }); }
      } else {
        const m = Math.ceil(T.left / 60000);
        if (m !== T.lastMin){ T.lastMin = m; T.sitT = now + 2200; pip.idle(); haptic('soft'); }
        if (now < T.sitT){ pose = now < T.sitT - 1200 ? 'sit' : 'yawn'; }
        else if (calm && Math.abs(E.normA(pip.s - (head + 0.05))) > 0.03) pip.walkTo(head + 0.05, { vmax: 30 });
        else if (calm) pose = E.blink(now) ? 'blink' : 'lookdown';
      }
      // switching the dot off: a small spark where the head just passed
      if (run && onRim && Math.floor(f * (NDOT - 1)) !== T.lastDot){ if (T.lastDot != null) W.fx.sparks(C + Math.cos(angOf((T.lastDot) / (NDOT - 1))) * 206, C + Math.sin(angOf((T.lastDot) / (NDOT - 1))) * 206, 3, { cols: ['#ffffff', '#fff3c4'], speed: 50 }); T.lastDot = Math.floor(f * (NDOT - 1)); }
    } else if (T.mode === 'ring'){
      const t = now - T.ringT, blink = Math.floor(t / 350) % 2 === 0;
      n += dial(a, blink ? 1 : 0, H.rgb(YEL));
      H.setText(TT, '00:00', now);
      n += H.drawText(TT, H.D, C, Y.hero, 9, 3.3, H.rgb(YEL), now, { alpha: a * (blink ? 1 : 0.35), depth: true });
      L.body = 'Tempo'; L.caption = 'Tocca o capovolgilo'; L.pills = [K.OUT('+1 min', 'plus')];
      // Dotto is the alarm: down on the floor, jumping with his arms up, "!"
      if (pip.ready() && (!pip.surf || pip.surf.id !== 'stage')) pip.jumpTo({ surf: 'stage', s: 0 });
      else if (calm && now - T.bangT > 700){ T.bangT = now; pip.hop(230); pip.play('arms', 420); pip.wobble(0.2, 400, 30); if (Math.floor(t / 700) % 2 === 0) W.fx.bang(pip, 380); }
    }
    pip.pose(pose); pip.wear(...wear);
    scr.titleT0 = T.t0 - 400;
    K.compose(scr, L, a, el, now);
    W.step(dt, now);
    n += W.draw(a, now);
    n += W.drawFront(a);
    return n;
  }

  const API = {
    W, pip, T, scr,
    tick, run,
    enter(now){ T.t0 = now; },
    active: () => T.mode === 'run' || T.mode === 'pause' || T.mode === 'ring',
    ringing: () => T.mode === 'ring',
    sub: () => T.mode === 'run' ? fmt(T.left) : T.mode === 'pause' ? `${fmt(T.left)} · in pausa` : T.mode === 'ring' ? 'Tempo!' : 'Pronto',
    tap(p, now){
      const act = K.hit(scr, p, now), inHero = Math.abs(p.x - C) < 160 && Math.abs(p.y - Y.hero) < 75;
      if (T.mode === 'set'){
        if (inHero) start(T.min);
        return;
      }
      if (T.mode === 'run' || T.mode === 'pause'){
        if (act === 'stop'){ stop(); return; }
        if (T.mode === 'run'){ T.left = Math.max(0, T.end - mono()); T.mode = 'pause'; } else { T.end = mono() + T.left; T.mode = 'run'; }
        haptic('confirm');
        if (T.mode === 'run') wave(YEL, 0.5); else wave(null, 0.4, true);
        return;
      }
      if (T.mode === 'ring'){
        if (act === 'plus'){ start(1); return; }
        stop();
      }
    },
    rotate(d){
      if (T.mode !== 'set') return;
      const step = T.min > 30 || (T.min === 30 && d < 0) ? 5 : 1, nm = clamp(T.min - d * step, 1, 60);
      if (nm !== T.min){ T.min = nm; haptic('detent'); T.turnT = T.now; }
    },
    flip(){ if (T.mode === 'ring'){ haptic('confirm'); stop(); return true; } return false; },
    // the clock's widget: a little yellow ring that empties and the time left in small dots; dim when paused, it blinks
    // when it rings. Tap it to open the timer
    widget(a, now, y){
      if (!API.active()) return 0;
      const ring = T.mode === 'ring', on = !ring || Math.floor((now - T.ringT) / 350) % 2 === 0, f = ring ? 1 : T.left / T.total;
      const str = ring ? '0:00' : fmt(T.left).replace(/^0/, ''), p = 2.6, tw = K.wordCols(str) * p, rw = 16, gap = 9, x0 = C - (rw + gap + tw) / 2;
      const al = a * (T.mode === 'pause' ? 0.5 : 1) * (on ? 1 : 0.25), col = H.rgb(YEL);
      for (let i = 0; i < 12; i++){ const an = -Math.PI / 2 + i / 12 * TAU, lit = i / 12 < f - 1e-6; dot(x0 + rw / 2 + Math.cos(an) * 7, y + Math.sin(an) * 7, lit ? 1.5 : 1, col, al * (lit ? 1 : 0.3)); }
      if (T.mode === 'pause'){ for (const sx of [-2, 2]) for (let r = -1; r <= 1; r++) dot(x0 + rw / 2 + sx, y + r * 2.2, 0.9, col, al); }
      K.word(str, x0 + rw + gap + tw / 2 - p / 2, y, p, col, al);
      return 13;
    },
    skip(ms){ if (T.mode === 'run' || T.mode === 'pause'){ T.left = Math.max(300, T.left - ms); T.end = mono() + T.left; } }
  };
  return API;
}
global.DottoTimer = { create };
})(window);
