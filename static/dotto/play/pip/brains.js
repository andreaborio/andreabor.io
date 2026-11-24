/* Pip's brains: what he does on each screen, written only with Pip Engine commands.
   Each brain owns one world (its floors, ledges and walls) and one Pip in it. The host (index.html) gives it the
   state of the Puck (time, menu, lights, beat) and a few drawing hooks; the brain registers the floors every frame,
   decides, steps the world and draws it.

   Behaviours kept from the prototype (and where they lived):
     clock   life on the rim: waits, sits, yawns, looks at the second, then the cartoon dash after it (simStep/simDraw);
             the time, battery and date are his ceiling (ceilingAt); a stroke makes him hop with hearts (petT);
             from second 52 he runs to the top, lets go and lands on the battery (preMinute); at the minute the second
             leaps onto the battery, it tips like a seesaw, he slides off onto the time, the digits fall as he hits them,
             he is out cold with stars, shakes it off and jumps back to the rim (scrClock); at night he sleeps, nightcap on;
             the scenes of the chase (makeApi, PIP_SCENES).
     menu    one costume and one personality per item, jumps from word to word as the drum turns, walks along long words,
             peeks over the edge, looks where the drum is going (menuPip, wordFeet).
     lights  the bulb on his head, and the scene you picked: Party dance, Focus reading, Chill sitting, Spente asleep;
             shades when it is too bright, looks up while you turn the ring (lightsPip).
     dj      headphones; a bounce on every beat, trembling in the build, a jump with his arms up at the drop (scrDJ);
             with no CDJ he taps his foot and waits (scrDJOff). */
(function(global){
'use strict';
function create(E, H){
  const { C, RF, TAU = Math.PI * 2 } = H, { clamp, lerp, sstep, normA, hash } = E;
  const PIP_P = H.PIP_P || 5;                // one Dotto, the same size on every screen
  const brains = {};

  /* ======================= the clock ======================= */
  {
    const W = E.world('clock'), pip = W.spawn({ p: PIP_P, r: 2.2 });
    const TOP = -Math.PI / 2, PRE_S = 52;
    const B = { mode: 'life', until: 0, sit: false, yawn: 0, init: false, pre: null, min: null, night: null, scene: null, nextScene: 12000 + Math.random() * 8000, homeAt: 0, zT: 0, zK: 0, mood: 'sveglio' };
    const WAITS = { pigro: [12, 45], tranquillo: [8, 28], sveglio: [5, 22], energico: [3, 14], giocoso: [3, 18] };
    function startWait(now){
      const [lo, hi] = WAITS[B.mood] || WAITS.sveglio;
      let w = lo + Math.random() * (hi - lo); if (Math.random() < 0.15) w = Math.min(50, w * 1.8);
      B.until = now + w * 1000; B.sit = w > 9 && Math.random() < 0.55; B.yawn = now + 2500 + Math.random() * 4000;
    }
    // the face, as floors and walls: rim, battery (it can tip), the roof of the digits, the date
    function geometry(){
      const g = H.geom();
      W.ring('rim', { cx: C, cy: C, R: RF });
      for (const b of g.boxes) W.box(b);
      const phi = g.battTilt, bp = g.battPiv;
      W.seg('batt', { x: bp[0] + 23 * Math.sin(phi), y: bp[1] - 23 * Math.cos(phi), ang: phi, hl: 19, ledges: true, slip: true });
      W.seg('digits', { x: C, y: g.digitsTop, hl: g.digitsHl, ledges: true, slip: true });
      const [dx0, dy0, dx1, dy1] = g.date;
      W.seg('date', { x: C, y: dy0 - 2, hl: (dx1 - dx0) / 2, ledges: true, slip: true });
      W.seg('dateL', { x: dx0 - 2, y: (dy0 + dy1) / 2, ang: -Math.PI / 2, hl: (dy1 - dy0) / 2 });
      W.seg('dateR', { x: dx1 + 2, y: (dy0 + dy1) / 2, ang: Math.PI / 2, hl: (dy1 - dy0) / 2 });
    }
    // a jump back to the rim along a clear arc, as close as possible to th
    function rimJump(th, o = {}){
      const S = W.get('rim'); if (!S) return false;
      const boxes = W.boxes;
      for (let k = 0; k < 40; k++){
        for (const sg of k ? [1, -1] : [1]){
          const t1 = th + sg * k * 0.07, [x1, y1] = E.sPos(S, t1), [ux, uy] = E.sUp(S, t1), T = E.planT(x1 - pip.x, y1 - pip.y, ux, uy);
          let clear = true;
          for (let f = 0.08; f < 0.96 && clear; f += 0.08){
            const [x, y] = E.arcAt(pip.x, pip.y, x1, y1, T, f), cx = x + (C - x) * 0.07, cy = y + (C - y) * 0.07;
            for (const [a0, b0, a1, b1] of boxes) if (cx > a0 - 12 && cx < a1 + 12 && cy > b0 - 12 && cy < b1 + 12){ clear = false; break; }
          }
          if (clear){ pip.jumpTo({ surf: 'rim', s: t1 }, Object.assign({ T }, o)); return t1; }
        }
      }
      pip.jumpTo({ surf: 'rim', s: th }, o); return th;
    }
    const onRim = () => pip.surf && pip.surf.id === 'rim' && !pip.air;
    const onBatt = () => (pip.surf && pip.surf.id === 'batt' && !pip.air) || (pip.hang && pip.hang.S.id === 'batt');

    // engine events: the landings that matter to the story
    W.on('land', (P, S, vn, hop) => {
      if (hop) return;
      if (B.mode === 'minute' && B.min && !B.min.dropped && S.id === 'digits'){
        B.min.dropped = true; B.min.hitT = E.now; H.dropDigits();
        for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) W.fx.dust(P.x + sd * 12, P.y - 4, sd * (60 + i * 30), -30 - i * 20, 300, 1.5);
        P.stun(840);
        return 'confirm';
      }
      if (B.mode === 'minute' && S.id === 'rim') B.min.home = true;
      if (B.mode === 'night' && S.id === 'batt'){ B.night.on = true; return 'soft'; }
      if (S.id === 'batt' && (B.mode === 'pre')){ B.pre.phase = 'on'; return 'soft'; }
    });
    W.on('recovered', () => { if (B.mode === 'life') startWait(E.now + 600); });
    W.on('decide', (P, what, S) => (S && S.id !== 'rim' && Math.random() < 0.35 ? 'drop' : 'climb'));

    const C_ = brains.clock = {
      W, pip, B,
      // the minute's choreography of the face (the battery tilt, the hidden second): asked before the face is drawn
      prepare(now){
        const M = B.min; let tilt = 0, hide = false;
        if (M){
          const m0 = now - M.t0, T = m0 - M.off;
          if (M.night) tilt = T < 300 || T > 1800 ? 0 : T < 420 ? -0.12 * sstep(300, 420, T) : -0.12 * Math.exp(-(T - 420) / 240) * Math.cos((T - 420) / 95);
          else tilt = T < 300 || T > 3200 ? 0 : T < 520 ? -0.38 * sstep(300, 520, T) : T < 900 ? -0.38 : -0.38 * Math.exp(-(T - 900) / 260) * Math.cos((T - 900) / 95);
          hide = m0 >= M.off && m0 < M.off + 700;
        }
        return { battTilt: tilt, hideMarker: hide };
      },
      newMinute(now, asleep){
        if (B.scene){ B.scene = null; }
        const there = onBatt() && pip.ready();
        B.min = { t0: now, off: there || asleep ? 0 : 450, night: asleep, dropped: false, hop: false, home: false, hitT: 0, scramble: false, rolled: false };
        B.mode = 'minute'; B.pre = null;
      },
      pet(now){
        W.fx.hearts(pip);
        if (onRim() && pip.ready() && pip.h <= 0) pip.hop(330);
        else if (B.mode === 'night'){ W.fx.zee(pip, 0); pip.wobble(0.08, 400, 60); }
      },
      shake(k){
        if (B.scene){ B.scene = null; B.mode = 'life'; B.nextScene = E.now + 20000; }
        W.shake(k);
      },
      forceChase(th){ B.mode = 'life'; B.scene = null; B.min = null; B.pre = null; pip.place('rim', th); pip.idle(); pip.eyes(0); B.until = 0; B.sit = false; B.init = true; },
      playScene(id, now){
        const list = global.PIP_SCENES || []; if (!list.length) return false;
        const def = id ? list.find(x => x.id === id) : list[Math.floor(Math.random() * list.length)];
        if (!def) return false;
        if (H.syncTime) H.syncTime();
        if (!onRim() || !pip.ready()){ const S = W.get('rim'); if (S) pip.place(S, normA(H.markerTh() - 0.35)); }
        pip.idle(); pip.eyes(0); pip.grip = true;
        B.scene = E.runScene(def, H.sceneHost(W, pip)); B.mode = 'scene'; B.min = null; B.pre = null;
        return true;
      },
      underTh: () => (onRim() && pip.h < 1 ? pip.s : null),
      onBattery: () => onBatt(),
      center: () => pip.center(),
      bounds: () => { const c = pip.center(); return [c[0], c[1], pip.p * 4.6]; },

      run(a, now, dt, o){
        const { s, asleep, ctxP } = o;
        B.mood = ctxP.mood;
        W.begin(now); geometry();
        pip.wear(ctxP.skin); pip.soot = Math.max(0, pip.soot - dt / 2600);
        if (!B.init){ B.init = true; pip.place('rim', H.markerTh() - 0.35); startWait(now); }
        // what mode are we in
        if (B.mode === 'minute' && !B.min) B.mode = 'life';
        if (B.mode === 'scene' && !B.scene) B.mode = 'life';
        if (B.mode !== 'minute' && B.mode !== 'scene'){
          if (asleep) { if (B.mode !== 'night'){ B.mode = 'night'; B.night = { phase: 'go', on: false }; B.pre = null; } }
          else if (B.mode === 'night'){ B.mode = 'life'; B.night = null; pip.idle(); if (onBatt()) B.homeAt = now + 300; }
          if (!asleep && s >= PRE_S && !H.RM && B.mode === 'life'){ B.mode = 'pre'; B.pre = { phase: 'go', t0: now }; }
          if (B.mode === 'pre' && s < PRE_S && !B.min){ B.mode = 'life'; B.pre = null; }
        }
        let move = pip.state(), n = 0;
        if (B.mode === 'scene'){
          const R = B.scene; R.s.markerDrawn = false; R.step(dt);
          if (R.done || pip.reflex){ B.scene = null; B.mode = 'life'; B.nextScene = now + 25000 + Math.random() * 20000; if (!pip.reflex){ pip.idle(); pip.stopPlay(); pip.eyes(0); pip.tremble(0); pip.offset(0, 0); if (!onRim() && pip.ready()) rimJump(pip.s || 0); startWait(now); } }
          move = 'scene';
        }
        else if (B.mode === 'minute') move = minute(now, o);
        else if (B.mode === 'pre') move = preMinute(now);
        else if (B.mode === 'night') move = night(now);
        else move = life(now, o);
        W.step(dt, now);
        // draw: scene props behind, Pip and his dust, then whatever flies in front
        if (B.mode === 'scene' && B.scene) n += B.scene.draw('back');
        n += W.draw(a, now);
        if (B.mode === 'minute' && B.min) n += minuteMarker(a, now, o);
        if (B.mode === 'scene' && B.scene) n += B.scene.draw('front');
        n += W.drawFront(a);
        if (B.mode === 'scene' && B.scene) n += B.scene.draw('top');
        const sc = B.scene;
        H.setLife(asleep ? { skin: 'nightcap', why: 'è notte', mood: 'dorme', move: 'sleep' } : Object.assign({}, ctxP, { move, scene: sc && sc.def.name }));
        return { n, markerDrawn: sc ? sc.s.markerDrawn : false };
      }
    };

    // his own life on the rim: waits, then the dash after the second
    function life(now, o){
      if (pip.reflex || pip.air || pip.hang || pip.climb) return pip.state();
      if (!onRim()){
        // somewhere else (the battery, the time, the date): back down to the rim
        if (pip.ready() && now > B.homeAt){ pip.grip = true; pip.idle(); rimJump(pip.surf ? Math.atan2(pip.y - C, pip.x - C) : 0); }
        return 'home';
      }
      pip.grip = true;
      if (pip.sliding) return 'slide';
      if (pip.cmd) return pip.state();
      const target = H.secAng(o.s);
      const d = ((target - pip.s) % TAU + TAU) % TAU * RF;
      // scenes start from here, when he is just waiting
      if (!B.scene && !H.RM && now > B.nextScene && o.s < 40 && (global.PIP_SCENES || []).length && pip.h <= 0){
        if (C_.playScene(null, now)) return 'scene';
      }
      if (now > B.until && d > 24 && d < TAU * RF - 24){
        pip.hold = null;
        pip.dashTo(() => H.secAng(H.sec()), { done: () => startWait(E.now) });
        return 'notice';
      }
      // waiting: sit or stand, yawn now and then, look at the second, then look around
      const lookMarker = !B.sit && Math.floor(now / 2300) % 3 === 0;
      if (B.sit) pip.pose(now > B.yawn && now < B.yawn + 800 ? 'yawn' : 'sit');
      else pip.pose(null);
      // a strong tilt: he leans into it and looks down the slope
      const gt = E.gu[0] * Math.cos(pip.s + Math.PI / 2) + E.gu[1] * Math.sin(pip.s + Math.PI / 2);
      if (Math.abs(gt) > 0.35 && !B.sit) pip.eyes(gt > 0 ? 1 : -1);
      else pip.eyes(lookMarker ? 1 : (Math.floor(now / 1700) % 3) - 1);
      return 'wait';
    }

    // from second 52: run to the top, look up, let go, half a flip, land on the battery and wait there
    function preMinute(now){
      const P0 = B.pre;
      if (pip.reflex){ P0.phase = 'go'; return pip.state(); }
      if (P0.phase === 'go'){
        if (!onRim()){ if (pip.ready()) rimJump(TOP + 0.4); return 'home'; }
        if (!pip.cmd && pip.ready()){
          if (Math.abs(normA(TOP - pip.s)) * RF < 2){ P0.phase = 'look'; P0.t0 = now; pip.idle(); pip.pose('lookup'); }
          else pip.runTo(TOP);
        }
      } else if (P0.phase === 'look'){
        pip.pose('lookup');
        if (now - P0.t0 > 280){ P0.phase = 'drop'; P0.t0 = now; pip.pose(null); pip.fall({ v: [0, 0], pose: () => (pip.air && pip.air.t < 0.2 ? 'ball' : 'fall') }); }
      } else if (P0.phase === 'drop'){
        if (!pip.air && pip.ready()){ P0.phase = onBatt() ? 'on' : 'go'; P0.t0 = now; }
      } else if (P0.phase === 'on'){
        if (!onBatt()){ P0.phase = 'go'; return 'preMin'; }
        pip.pose(Math.floor(now / 300) % 2 ? 'tap' : 'idle'); pip.eyes(-1);
      }
      return 'preMin';
    }

    // the minute: see the header. Day: the seesaw. Night: a nudge, and he turns over in his sleep
    function minute(now, o){
      const M = B.min, T = now - M.t0 - M.off;
      if (M.night){
        if (T >= 300 && !M.dropped){
          M.dropped = true; H.dropDigits(); H.haptic('soft');
          if (onBatt() && pip.ready()){ pip.face = -pip.face; pip.wobble(0.3, 700, 90); pip.sqV -= 1; W.fx.zee(pip, 2, true); }
        }
        if (onBatt()){ pip.pose('sleep'); }
        if (T > 1400){ B.min = null; B.mode = 'night'; }
        return 'minute';
      }
      if (T < 0){
        if (!M.scramble && pip.ready()){ M.scramble = true; pip.grip = true; pip.jumpTo({ surf: 'batt', s: 0 }, { T: M.off / 1000, antic: 0 }); }
        return 'minute';
      }
      if (T < 300){ if (onBatt() && pip.ready()){ pip.pose(Math.floor(now / 300) % 2 ? 'tap' : 'idle'); pip.eyes(-1); } }
      else if (!M.hop){
        M.hop = true; pip.pose(null); pip.eyes(0);
        if (onBatt() && pip.ready()){ H.haptic('detent'); pip.grip = false; pip.hop(150); }
      }
      if (!M.dropped && T > 1450){ M.dropped = true; H.dropDigits(); }
      // after the stars and the shake: a beat, then back to the rim three seconds ahead
      if (M.hop && pip.ready() && !pip.cmd && !onBatt()){
        pip.grip = true;
        if (onRim()){ if (!M.home || T > 400){ B.min = null; B.mode = 'life'; startWait(now); } }
        else if (!M.jumped && (M.dropped || !onBatt()) && T > 700 && (!M.hitT || now - M.hitT > 1400)){ M.jumped = true; rimJump(H.secAng(o.s + 3)); }
      }
      if (T > 5200){ B.min = null; B.mode = 'life'; pip.grip = true; startWait(now); }
      return 'minute';
    }
    // the second leaving the rim for the battery's end and coming back on time
    function minuteMarker(a, now, o){
      const M = B.min, T = now - M.t0 - M.off; if (T < 0 || T >= 700) return 0;
      const g = H.geom(), phi = g.battTilt, bp = g.battPiv, on = u => [bp[0] + u * Math.cos(phi) + 23 * Math.sin(phi), bp[1] + u * Math.sin(phi) - 23 * Math.cos(phi)];
      const top = [C, C - (RF + 4)], [lx, ly] = on(-20), k = M.night ? 0.6 : 1;
      if (T < 300){ const f = T / 300; H.dot(lerp(top[0], lx, f), lerp(top[1], ly - 4, f * f) - Math.sin(Math.PI * f) * 14 * k, 3.1, H.INK, a); }
      else { const f = (T - 300) / 400, th = H.markerTh(), tx = C + Math.cos(th) * (RF + 4), ty = C + Math.sin(th) * (RF + 4);
        H.dot(lerp(lx, tx, f), lerp(ly - 4, ty, f) - Math.sin(Math.PI * f) * 30 * k, 3.1 * (T < 340 ? 0.8 : 1), H.INK, a); }
      return 1;
    }

    // night: he goes to bed on the battery and sleeps there, z's rising
    function night(now){
      const N = B.night || (B.night = { phase: 'go', on: false });
      if (pip.reflex || pip.air || pip.hang || pip.climb) return 'sleep';
      if (onBatt()){
        pip.pose('sleep'); pip.eyes(0);
        if (now - B.zT > 560){ B.zT = now; W.fx.zee(pip, B.zK % 3); B.zK++; }
        return 'sleep';
      }
      if (!onRim()){ if (pip.ready()) rimJump(TOP); return 'home'; }
      if (N.phase === 'go'){
        if (!pip.cmd && pip.ready()){
          if (Math.abs(normA(TOP - pip.s)) * RF < 2){ N.phase = 'look'; N.t0 = now; pip.pose('yawn'); }
          else { pip.pose(null); pip.walkTo(TOP, { vmax: 160, acc: 600 }); }
        }
      } else if (N.phase === 'look'){
        if (now - N.t0 > 700){ N.phase = 'drop'; pip.pose(null); pip.fall({ v: [0, 0], pose: () => (pip.air && pip.air.t < 0.2 ? 'ball' : 'fall') }); }
      } else if (N.phase === 'drop' && pip.ready()) N.phase = 'go';
      return 'sleep';
    }
  }

  /* ======================= the menu ======================= */
  {
    const W = E.world('menu'), pip = W.spawn({ p: PIP_P, r: 2.2 });
    let M = null;
    W.on('land', (P, S) => { if (M && S.id === 'w' + M.on){ M.wGo = E.now + 1200 + hash(E.now, 3) * 1200; M.landed = E.now; return 'soft'; } });
    const COST = { dj: 'phones', music: 'phones', settings: 'glasses', home: 'roof' };
    brains.menu = {
      W, pip,
      enter(){ M = null; },
      run(a, now, dt, b){
        const st = H.st, N = H.MENU.length, sel = clamp(Math.round(st.scroll), 0, N - 1);
        W.begin(now);
        W.ring('glass', { cx: C, cy: C, R: RF + 2, ceil: false });
        for (let i = 0; i < N; i++){ const wf = H.wordFeet(i); if (wf.vis > 0.25) W.seg('w' + i, { x: wf.x, y: wf.y, hl: wf.half, ledges: true, slip: true }); }
        if (!M){
          M = { on: sel, prev: sel, still: now, wGo: now + 2600, peek: -1e9, pend: null, jumpT: -1e9 };
          pip.placeAt(C, C - 230, 0); pip.fall({ v: [0, 0], pose: 'stretch' }); pip.idle(); pip.grip = true;
        }
        const cur = H.MENU[M.on].id;
        const scrolling = Math.abs(st.scrollT - st.scroll) > 0.02 || (H.ptr() && H.ptr().mode === 'scroll');
        if (scrolling) M.still = now;
        // a new word under the focus: jump to it, from wherever he is
        if (sel !== M.on){
          if (now - M.jumpT > 120 || !pip.air) M.prev = M.on;
          M.on = sel;
          if (!pip.reflex && !pip.hang && !pip.climb) jump(now);
        }
        const tgtS = W.get('w' + M.on), onWord = pip.surf === tgtS && !pip.air;
        let pose = null, eye = 0, dx = 0, dy = 0;
        if (!pip.reflex && !pip.air && !pip.hang && !pip.climb && !pip.sliding){
          if (!onWord){ if (pip.ready()) jump(now); }
          else if (now - pip.landT >= 110){
            // left alone, he lives: walks along long words, peeks over the edge, then does his thing
            const room = Math.max(0, tgtS.hl - 26), idle = now - M.still > 1500;
            if (!idle && pip.cmd){ pip.idle(); M.pend = null; }
            if (room > 10 && idle && !pip.cmd && !M.pend && now > M.wGo){
              if (Math.abs(pip.s) > room - 6 && now - M.peek > 2500) M.peek = now;
              M.pend = (hash(Math.floor(now / 997), 5) * 2 - 1) * room;
              M.wGo = now + 1600 + hash(now, 6) * 2600;
            }
            const peeking = now - M.peek < 900;
            if (M.pend != null && !peeking){ pip.walkTo(M.pend); M.pend = null; }
            if (peeking){ pose = 'lookdown'; eye = Math.sign(pip.s) || 1; }
            else if (!pip.cmd){
              pose = E.blink(now) ? 'blink' : 'idle';
              // each app has its game with its icon (index.html menuPlay): the icon moves, he follows the cue
              const pl = H.menuPlay ? H.menuPlay(cur, now) : null, cue = pl ? pl.cue : '';
              if (cue === 'stomp' && now - (M.cueT || 0) > 500){ M.cueT = now; pip.hop(150); }
              else if (cue === 'cheer') pose = 'arms';
              else if (cue === 'sit') pose = E.blink(now) ? 'sitblink' : 'sit';
              else if (cue === 'spin' && now - (M.cueT || 0) > 1000){ M.cueT = now; pip.jumpTo({ surf: 'w' + M.on, s: pip.s }, { T: 0.5, spin: 1 }); }
              else if (cue === 'hop' && now - (M.cueT || 0) > 1000){ M.cueT = now; pip.hop(330); }
              else if (cue === 'watch') pose = 'lookdown';
              else if (cue === 'walk') pose = ['run1', 'run2', 'run3', 'run4'][Math.floor(now / 120) % 4];
              else if (cue === 'scratch'){ const k = Math.cos(now / 150); dx = k * 5; pose = k > 0.3 ? 'crouch' : k < -0.3 ? 'lookdown' : 'tap'; eye = k > 0 ? 1 : -1; }
              else if (cur === 'voice'){ if ((now % 2000) < 1300 && Math.floor(now / 140) % 2) pose = 'talk'; }
              else if (cur === 'home'){ pose = (now % 2400) < 1300 ? 'blink' : pose; }
              if ((now % 2600) < 300 && pose === 'idle') pose = 'idle2';
            }
          }
          // while the drum is turning under him, he looks where it is going
          if (onWord && Math.abs(st.scrollT - st.scroll) > 0.06) pose = st.scrollT > st.scroll ? 'lookdown' : 'lookup';
        }
        pip.pose(pose); pip.eyes(eye); pip.offset(dx, dy);
        // the costume: the old one for the first half of a jump
        const wear = pip.air && pip.air.kind === 'arc' && (pip.air.f || 0) < 0.5 ? H.MENU[M.prev].id : cur;
        pip.wear(COST[wear]); pip.bulb = st.scene === 3 ? 0.08 : H.ZONES[st.zone].b / 100;
        W.step(dt, now);
        let n = W.draw(a, now);
        // his props, by the voice he stands on
        if (onWord && !pip.cmd && !pip.reflex){
          const fx = pip.x, fy = pip.y;
          if (cur === 'music'){
            for (let k = 0; k < 3; k++){
              const z = ((now / 1900) + k / 3) % 1, nx = fx + 34 + z * 20 + Math.sin(z * 6 + k) * 4, ny = fy - 52 - z * 40, al = a * Math.sin(Math.PI * z);
              H.dot(nx, ny, 2, H.INK, al); H.dot(nx + 3.2, ny - 3.5, 1.3, H.INK, al); H.dot(nx + 3.2, ny - 7, 1.3, H.INK, al); n += 3;
            }
          } else if (cur === 'voice' && (now % 2000) < 1300){
            const w = (now % 400) / 400;
            for (const sd of [-1, 1]) for (let j = -1; j <= 1; j++){ const rr = 40 + w * 12, an = (sd < 0 ? Math.PI : 0) + j * 0.32; H.dot(fx + Math.cos(an) * rr, fy - 22 + Math.sin(an) * rr, 1.8, H.INK, a * (1 - w)); n++; }
          } else if (cur === 'timer'){
            const sec = new Date().getSeconds(), an = -Math.PI / 2 + sec / 60 * TAU; H.dot(fx + Math.cos(an) * 40, fy - 22 + Math.sin(an) * 40, 2.4, H.INK, a); n++;
          }
        }
        n += W.drawFront(a);
        return n;
      }
    };
    function jump(now){
      const to = W.get('w' + M.on); if (!to) return;
      const dy = Math.abs(pip.y - to.y), down = to.y > pip.y;
      M.jumpT = now; pip.idle(); M.pend = null;
      pip.jumpTo({ surf: 'w' + M.on, s: 0 }, { T: (380 + Math.min(160, dy * 1.2)) / 1000, antic: 50, pose: f => (f < 0.5 ? 'stretch' : down ? 'lookdown' : 'idle') });
    }
  }

  /* ======================= the lights ======================= */
  {
    const W = E.world('lights'), pip = W.spawn({ p: PIP_P, r: 2.2 });
    let init = false, lastK = -1, zT = 0, zK = 0, lastZone = null;
    brains.lights = {
      W, pip,
      run(a, now, dt){
        const st = H.st, z = H.ZONES[st.zone], lvl = st.scene === 3 ? 0 : z.b / 100;
        W.begin(now);
        W.ring('glass', { cx: C, cy: C, R: RF + 2, ceil: false });
        W.seg('stage', { x: C, y: C + 140, hl: 34 });
        if (!init){ init = true; pip.place('stage', 0); }
        // while you drag the light, he rides its surface (a floor that moves with the brightness), right of the number
        const ly = H.levelY ? H.levelY() : null;
        if (ly != null) W.seg('light', { x: C + 150, y: clamp(ly, C - 78, C + 128), hl: 16 });
        // a new room: a hop, looking where the ring went
        if (lastZone !== st.zone){ if (lastZone != null && pip.ready()){ pip.hop(170); pip.eyes(st.zone > lastZone ? 1 : -1); } lastZone = st.zone; }
        if (st.lightsB !== z.b){ st.lightsLook = now; st.lightsB = z.b; }
        const looking = now - (st.lightsLook || -1e9) < 900, home = pip.surf && pip.surf.id === 'stage' && !pip.air;
        let skin = null, pose = null, dx = 0;
        const onLight = pip.surf && pip.surf.id === 'light' && !pip.air;
        if (ly != null){ if (!onLight && pip.ready()) pip.jumpTo({ surf: 'light', s: 0 }); else if (onLight) pose = ly < C - 40 ? 'arms' : ly > C + 90 ? 'crouch' : 'idle'; }
        else if (!home){ if (pip.ready()) pip.jumpTo({ surf: 'stage', s: 0 }); }
        else if (!pip.reflex && !pip.sliding){
          if (st.scene === 3){ pose = 'sleep'; skin = 'nightcap'; if (now - zT > 560){ zT = now; W.fx.zee(pip, zK % 3); zK++; } }
          else if (st.scene === 1){
            // Party: he dances, a hop on every beat, arms up on every other one
            const k = Math.floor(now / 484); dx = Math.sin(now / 242) * 3; skin = 'party';
            if (k !== lastK){ lastK = k; pip.hop(127); if (k % 2) pip.play('arms', 470); }
          } else if (st.scene === 2){ pose = (now % 4200) < 3600 ? 'lookdown' : 'blink'; skin = 'glasses'; }
          else pose = (now % 3200) < 260 ? 'sitblink' : 'sit';
          if (lvl > 0.85 && st.scene !== 2 && st.scene !== 3) skin = 'sun';
          if (looking && st.scene !== 3){ pose = st.scene === 0 ? 'sit' : 'lookup'; pip.stopPlay(); }
        }
        pip.pose(pose); pip.offset(dx, 0); pip.eyes(0); pip.wear('bulb', skin); pip.bulb = lvl;
        W.step(dt, now);
        let n = W.draw(a, now);
        if (st.scene === 2 && home && !pip.reflex){ const bx = pip.x, by = pip.y - 6; for (let c = -3; c <= 3; c++) for (let r = 0; r < 3; r++) if (c !== 0){ H.dot(bx + c * 3, by - r * 3, 1, H.INK2, a); n++; } }
        n += W.drawFront(a);
        return n;
      }
    };
  }

  /* ======================= the DJ ======================= */
  {
    const W = E.world('dj'), pip = W.spawn({ p: PIP_P, r: 2.2 });
    let init = false, lastB = -1, dropT = -1e9;
    brains.dj = {
      W, pip,
      run(a, now, dt, b){
        const st = H.st, off = !st.cdj;
        W.begin(now);
        W.ring('glass', { cx: C, cy: C, R: RF + 2, ceil: false });
        W.seg('stage', { x: C, y: C + 140, hl: 34 });
        if (!init){ init = true; pip.place('stage', 0); }
        const home = pip.surf && pip.surf.id === 'stage' && !pip.air;
        let pose = null, eye = 0, trem = 0;
        if (!home){ if (pip.ready()) pip.jumpTo({ surf: 'stage', s: 0 }); }
        else if (!pip.reflex && !pip.sliding){
          if (off){
            // no CDJ: he waits, tapping his foot, looking around
            const t = now % 4200; pose = t < 1400 ? (Math.floor(now / 300) % 2 ? 'tap' : 'idle') : E.blink(now) ? 'blink' : 'idle';
            eye = Math.floor(now / 1300) % 3 - 1;
          } else {
            const build = b.sec.name === 'Build', drop = b.sec.name === 'Drop', since = now - st.dropAt, bi = Math.floor(b.p);
            if (build){
              // the build: he trembles more and more, crouches on the beat, stretches up in the last four beats
              trem = sstep(0.3, 1, b.prog) * 2.2;
              pose = b.next != null && b.next <= 4 ? 'stretch' : b.frac < 0.12 ? 'crouch' : 'idle';
            } else if (since >= 0 && since < 700){
              // the drop: a big jump, arms up
              if (dropT !== st.dropAt){ dropT = st.dropAt; pip.hop(290); pip.play('arms', 600); }
            } else if (bi !== lastB){
              // a bounce on every beat; in the drop, arms up on every other one
              pip.hop(drop ? 166 : 117);
              if (drop && b.beat % 2 === 0) pip.play('arms', 300);
            }
            lastB = bi;
          }
        }
        pip.pose(pose); pip.eyes(eye); pip.tremble(trem); pip.wear('phones');
        pip.tint(!off && b.sec.name === 'Drop' ? H.rgb(H.mixc(H.W, H.RED, 0.25)) : null);
        W.step(dt, now);
        let n = W.draw(a, now);
        n += W.drawFront(a);
        return n;
      }
    };
  }

  // the IMU: the hand that holds the Puck, felt by whichever Pip is on screen
  brains.shake = (screen, k) => { if (screen === 'clock') brains.clock.shake(k); else { const b = brains[screen]; if (b) b.W.shake(k); } };
  brains.spin = (screen, rate) => { const b = brains[screen]; if (b) b.W.spin(rate); };
  return brains;
}
global.PipBrains = { create };
})(window);
