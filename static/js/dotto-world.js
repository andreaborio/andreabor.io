/* Dotto lives on this site. One Dotto, the real one: the Pip engine from the Dotto prototype (js/pip-engine.js) drives
   his body, poses, physics, accessories and effects. This file is his host and his brains for a web page.
   - His home is the header rail: it covers nothing you are reading.
   - From there he pays visits: he jumps onto a title, a card or a row, the block tilts under his weight like a seesaw
     on a spring, he bounces and goes back up. Click a block and he visits that one.
   - Click him for hearts and a new hat. Drag him (mouse or finger) and throw him: he grabs edges, sees stars, climbs back.
   - He looks at your pointer, sits, yawns, waves; leave him alone and he sleeps in a nightcap. He dresses for the hour.
   Progressive enhancement: without JS there is no Dotto. Under prefers-reduced-motion he sits still on the rail. */
(() => {
  if (!window.PipEngine) return;
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const now_ = () => performance.now();

  /* ---------- canvas over the page ---------- */
  const cv = document.createElement('canvas');
  cv.className = 'dotto-world'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let VW = innerWidth, VH = innerHeight, dpr = 1;
  const resize = () => { VW = innerWidth; VH = innerHeight; dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr); };
  resize(); addEventListener('resize', resize);
  const dot = (x, y, r, col, a) => { if (a <= 0.01) return; ctx.globalAlpha = a > 1 ? 1 : a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); };
  const haptic = k => { if (touch && navigator.vibrate && (k === 'confirm' || k === 'heavy')) try { navigator.vibrate(k === 'heavy' ? 30 : 12); } catch (e) {} };
  const E = PipEngine.create({ ctx, dot, haptic, C: 0, S: 4000, INK: '#ffffff', INK2: '#c4c4c0', RED: [255, 59, 47] });
  const W = E.world('page');
  const P = W.spawn({ p: touch ? 4.4 : 6.2, r: touch ? 1.8 : 2.5 });
  window.__dotto = { P, W, E };

  /* ---------- hats ---------- */
  const HATS = ['none', 'cap', 'sun', 'party', 'phones', 'glasses', 'bedhead'];
  const HAT_SAY = { none: 'just me', cap: 'cap on', sun: 'too bright', party: 'party!', phones: 'tunes', glasses: 'reading mode', bedhead: 'bed hair' };
  const dayHat = () => {
    const h = new Date().getHours();
    if (h < 6 || h >= 23) return 'nightcap';
    if (document.querySelector('.prose')) return 'glasses';
    return h < 11 ? 'bedhead' : h < 16 ? 'sun' : h < 20 ? 'cap' : 'phones';
  };
  let hat = sessionStorage.getItem('dotto-hat') || dayHat();
  P.wear(hat);

  /* ---------- speech bubble ---------- */
  const bub = document.createElement('div');
  bub.className = 'dotto-say'; bub.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bub);
  let bubUntil = 0;
  const say = (txt, ms = 1600) => { bub.textContent = txt; bub.classList.add('on'); bubUntil = now_() + ms; };

  /* ---------- blocks that tilt under him: a damped spring per element ---------- */
  const tilt = new Map();       // el -> { a, v, y, vy }
  const T = el => { let t = tilt.get(el); if (!t){ t = { a: 0, v: 0, y: 0, vy: 0 }; tilt.set(el, t); el.classList.add('tilts'); } return t; };
  function stepTilts(dt){
    const s = dt / 1000;
    for (const [el, t] of tilt){
      const on = P.surf && P.surf.el === el && !P.air;
      const maxA = clamp(900 / Math.max(120, el.offsetWidth), 1.2, 4.5);       // small blocks tip more
      const targetA = on ? clamp(P.s / P.surf.hl, -1, 1) * maxA : 0;
      const targetY = on ? 2.5 : 0;
      t.v += ((targetA - t.a) * 120 - t.v * 9) * s; t.a += t.v * s;
      t.vy += ((targetY - t.y) * 260 - t.vy * 14) * s; t.y += t.vy * s;
      if (!on && Math.abs(t.a) < 0.01 && Math.abs(t.v) < 0.01 && Math.abs(t.y) < 0.02){ el.style.transform = ''; el.classList.remove('tilts'); tilt.delete(el); continue; }
      el.style.transform = `translateY(${t.y.toFixed(2)}px) rotate(${t.a.toFixed(3)}deg)`;
    }
  }

  /* ---------- floors ---------- */
  // only blocks with free space above them: he never stands on top of text you are reading
  const SEL = '.hero-title, .section-heading, .article-header h1, .page-header h1, .prose h2, .prose figure img, .series-pager a, .agent-hero, .agent-note-header h1';
  const ids = new WeakMap(); let nid = 0, els = [], elsT = -1e9;
  const railEl = document.querySelector('.rail');
  let topLimit = 70, floors = [], rail = null;
  function buildFloors(now){
    if (now - elsT > 1500){ els = [...document.querySelectorAll(SEL)]; elsT = now; }
    topLimit = railEl ? railEl.getBoundingClientRect().bottom + 10 : 20;
    const list = [];
    for (const el of els){
      // the layout box without our tilt: centre from the rect (rotation keeps it), size from the layout
      const r = el.getBoundingClientRect(), w = el.offsetWidth || r.width, h = el.offsetHeight || r.height;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, top = cy - h / 2;
      if (w < 60 || top < topLimit || top > VH - 30) continue;
      let id = ids.get(el); if (!id){ id = 'f' + (++nid); ids.set(el, id); }
      const t = tilt.get(el), a = t ? t.a * Math.PI / 180 : 0;
      const x = cx + Math.sin(a) * h / 2, y = cy - Math.cos(a) * h / 2;
      const S = W.seg(id, { x, y, ang: a, hl: w / 2 - 4, ledges: true, slip: false });
      S.el = el; list.push(S);
    }
    rail = null;
    if (railEl){
      const r = railEl.getBoundingClientRect();
      rail = W.seg('rail', { x: r.left + r.width / 2, y: r.bottom - 2, hl: r.width / 2 - 6, ledges: false, slip: false });
      rail.rail = true; list.push(rail);
    }
    return list;
  }
  const visible = () => floors.filter(f => !f.rail && f.y > topLimit + 40 && f.y < VH - 40);

  /* ---------- pointer, touch, drag ---------- */
  const ptr = { x: -1e3, y: -1e3, t: -1e9 };
  let lastInput = now_(), drag = null, petT = 0, sleeping = false, zT = 0, next = 0, visitUntil = 0, suppressClick = 0;
  const near = (x, y, r) => { const c = P.center(); return Math.hypot(x - c[0], y - c[1]) < r; };
  const HIT = touch ? 46 : 38;
  const wake = why => {
    lastInput = now_();
    if (sleeping){ sleeping = false; P.idle(); P.wear(hat); P.hop(260); P.say('!'); say(why || 'huh? I\'m up', 1400); }
  };
  const grab = (x, y, t) => { drag = { sx: x, sy: y, lx: x, ly: y, lt: t, vx: 0, vy: 0, moved: false, t0: now_() }; wake(); };
  const move = (x, y, t) => {
    if (!drag) return;
    const dt = Math.max(8, t - drag.lt) / 1000;
    drag.vx = drag.vx * 0.4 + (x - drag.lx) / dt * 0.6; drag.vy = drag.vy * 0.4 + (y - drag.ly) / dt * 0.6;
    drag.lx = x; drag.ly = y; drag.lt = t;
    if (Math.hypot(x - drag.sx, y - drag.sy) > 6) drag.moved = true;
  };
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null; suppressClick = now_() + 400;
    P.stopPlay();
    if (!d.moved){
      P.fall({ v: [0, -160] });
      hat = HATS[(HATS.indexOf(hat) + 1) % HATS.length]; P.wear(hat); sessionStorage.setItem('dotto-hat', hat);
      P.say('hearts'); say(HAT_SAY[hat] || 'ta-da');
      return;
    }
    const vx = clamp(d.vx, -2600, 2600), vy = clamp(d.vy, -2600, 2600), v = Math.hypot(vx, vy);
    P.fall({ v: [vx, vy], spin: v > 900 ? (vx > 0 ? 1 : -1) * rnd(9, 14) : 0, grab: true });
    if (v > 900){ P.reflex = 'flung'; P.until = now_() + 4000; say(pick(['wheee!', 'aaaa', 'yeet'])); }
    else say(pick(['careful', 'ok ok', 'put me down']));
    visitUntil = now_() + 3000;
  };
  // mouse and pen
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now_(); wake();
    move(e.clientX, e.clientY, e.timeStamp);
    if (!drag && near(e.clientX, e.clientY, HIT) && now_() - petT > 2600 && P.ready()){
      petT = now_(); P.hop(200); P.say('hearts'); say(pick(['hehe', 'that tickles', 'hi!', ':)']));
    }
  }, { passive: true });
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    wake();
    if (near(e.clientX, e.clientY, HIT)){ grab(e.clientX, e.clientY, e.timeStamp); e.preventDefault(); }
  });
  addEventListener('pointerup', e => { if (e.pointerType !== 'touch') release(); });
  addEventListener('blur', release);
  // fingers: the page must not scroll while you hold him
  addEventListener('touchstart', e => {
    const t = e.touches[0]; if (!t || e.touches.length > 1) return;
    ptr.x = t.clientX; ptr.y = t.clientY; ptr.t = now_(); wake();
    if (near(t.clientX, t.clientY, HIT)){ grab(t.clientX, t.clientY, e.timeStamp); e.preventDefault(); }
  }, { passive: false });
  addEventListener('touchmove', e => {
    if (!drag) return;
    const t = e.touches[0]; if (!t) return;
    e.preventDefault(); move(t.clientX, t.clientY, e.timeStamp);
  }, { passive: false });
  addEventListener('touchend', e => { if (drag){ e.preventDefault(); release(); } }, { passive: false });
  addEventListener('touchcancel', release);
  // a click on a block sends him there for a visit
  addEventListener('click', e => {
    if (reduce || drag || now_() < suppressClick || near(e.clientX, e.clientY, HIT)) return;
    if (e.target.closest('a, button, input, textarea, select, summary, label, pre, code')) return;
    const S = floorUnder(e.clientX, e.clientY);
    if (S && !S.rail) visit(S, clamp(e.clientX - S.x, -S.hl + 8, S.hl - 8), true);
    else if (rail && P.surf === rail) P.runTo(clamp(e.clientX - rail.x, -rail.hl, rail.hl));
  });
  // fast scroll, a shaken phone
  let lastSY = scrollY, lastST = now_(), shakeT = 0;
  addEventListener('scroll', () => {
    const t = now_(), v = Math.abs(scrollY - lastSY) / Math.max(1, t - lastST) * 1000;
    lastSY = scrollY; lastST = t; lastInput = t;
    if (sleeping && v > 1500) wake('whoa, where are we going');
    if (t - shakeT > 3500 && P.surf && !P.surf.rail && v > 3500){ shakeT = t; W.shake(v > 7000 ? 1 : 0.5); if (v > 7000) say(pick(['whoa!', 'slow down!'])); }
  }, { passive: true });
  let motionAsked = false;
  const onMotion = e => {
    const a = e.acceleration || {}, m = Math.hypot(a.x || 0, a.y || 0, a.z || 0), t = now_();
    if (m > 22 && t - shakeT > 1500){ shakeT = t; W.shake(1); wake(); say(pick(['whoa!', 'stop shaking!', 'earthquake!'])); }
  };
  if (touch) addEventListener('touchend', () => {
    if (motionAsked) return; motionAsked = true;
    const D = window.DeviceMotionEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().then(s => { if (s === 'granted') addEventListener('devicemotion', onMotion); }).catch(() => {});
    else if (D) addEventListener('devicemotion', onMotion);
  }, { passive: true });

  /* ---------- visits ---------- */
  function floorUnder(x, y){
    let best = null, bd = 1e9;
    for (const S of floors){
      if (x < S.x - S.hl - 10 || x > S.x + S.hl + 10) continue;
      const dy = S.y - y, d = dy >= -14 ? dy : 300 - dy * 3;
      if (d < bd){ bd = d; best = S; }
    }
    return best;
  }
  function visit(S, s, loud){
    if (!P.ready() || !S) return;
    sleeping = false; P.wear(hat);
    P.face = S.x + s > P.x ? 1 : -1;
    const dy = S.y - P.y;
    P.jumpTo({ surf: S.id, s }, { spin: dy > 250 && Math.random() < 0.35 ? P.face : 0 });
    visitUntil = now_() + rnd(1600, 2800);
    if (loud && Math.random() < 0.5) say(pick(['boing', 'coming!', 'hup!']), 1000);
  }
  function home(){
    if (!rail || !P.ready()) return;
    const s = clamp(P.x - rail.x + rnd(-120, 120), -rail.hl + 10, rail.hl - 10);
    P.jumpTo({ surf: 'rail', s }, { spin: Math.random() < 0.2 ? (s > 0 ? 1 : -1) : 0 });
  }

  /* ---------- brains ---------- */
  W.on('land', (_, S, vn) => {
    if (S.el){
      const t = T(S.el); t.v += clamp(vn / 60, 0, 30) * (P.s >= 0 ? 1 : -1); t.vy += clamp(vn / 40, 0, 40);
      if (vn > 500 && Math.random() < 0.5) say(pick(['boing', 'oops', 'wobbly']), 900);
    } else if (vn > 900) say(pick(['oof', 'nailed it']));
  });
  W.on('grab', () => { if (Math.random() < 0.6) say(pick(['hup!', 'phew', 'almost!'])); });
  W.on('decide', () => 'climb');
  function brain(now){
    // lost below or beside the screen: he comes back from the top, onto the rail
    if (P.y > VH + 120 || P.x < -140 || P.x > VW + 140 || P.y < -500){
      P.placeAt(clamp(P.x, 40, VW - 40), -50); P.fall({ v: [0, 200] }); P.reflex = null; say('I\'m back', 1200);
      return;
    }
    if (drag || reduce) return;
    if (!sleeping && now - lastInput > 28000 && P.idleNow() && P.surf === rail){ sleeping = true; P.wear('nightcap'); P.sleep(); say('zzz', 1500); }
    if (sleeping){ if (now - zT > 1500){ zT = now; W.fx.zee(P, (zT / 1500 | 0) % 3); } return; }
    if (now - ptr.t < 4000 && P.idleNow()) P.lookAt(ptr.x, ptr.y); else if (P.idleNow()) P.lookAt(null);
    if (!P.ready()) return;
    // on a block: a little bounce, then back home (a block scrolled under the header sends him home at once)
    if (P.surf !== rail){
      if (P.y < topLimit + 20 || now > visitUntil){
        if (P.idleNow()){
          const hop = Math.random() < 0.3 ? pick(visible().filter(f => f !== P.surf && Math.abs(f.y - P.y) < 300)) : null;
          if (hop) visit(hop, rnd(-hop.hl * .6, hop.hl * .6)); else home();
        }
      }
      else if (P.idleNow() && now > next){ next = now + 700; P.hop(rnd(160, 260)); }
      return;
    }
    if (now < next || !P.idleNow()) return;
    next = now + rnd(2500, 6500);
    const roll = Math.random(), v = visible();
    if (roll < 0.3 && v.length){
      // a visit, preferably near your pointer
      v.sort((a, b) => Math.hypot(a.x - ptr.x, a.y - ptr.y) - Math.hypot(b.x - ptr.x, b.y - ptr.y));
      const S = now - ptr.t < 8000 ? v[0] : pick(v.filter(f => Math.abs(f.x - P.x) < 600)) || v[0];
      visit(S, rnd(-S.hl * .7, S.hl * .7));
    }
    else if (roll < 0.55) P.walkTo(clamp(P.s + rnd(-260, 260), -rail.hl + 10, rail.hl - 10));
    else if (roll < 0.65) P.runTo(rnd(-rail.hl * .9, rail.hl * .9));
    else if (roll < 0.75){ P.sit(); next = now + rnd(4000, 8000); }
    else if (roll < 0.83) P.play('yawn', 1300);
    else if (roll < 0.92){ P.play('arms', 900); say(pick(['hi!', 'psst', 'drag me', 'click a title', 'hello'])); }
    else P.play('lookdown', 1600);
  }

  /* ---------- arrival ---------- */
  const saved = JSON.parse(sessionStorage.getItem('dotto-at') || 'null');
  function enter(now){
    floors = buildFloors(now);
    const title = document.querySelector('.hero-title');
    if (reduce){ if (rail) P.place(rail, saved ? clamp(saved.x - rail.x, -rail.hl, rail.hl) : rail.hl * .6); P.sit(); return; }
    if (title && !saved){
      const r = title.getBoundingClientRect();
      P.placeAt(r.left + Math.min(r.width * .55, 260), topLimit + 4); P.fall({ v: [0, 80] });
      visitUntil = now + 4200;
      setTimeout(() => { P.play('arms', 1400); P.say('hearts'); say('hi! I\'m Dotto', 2400); }, 900);
      setTimeout(() => { if (!sleeping && P.surf === rail) say('drag me, or click a title', 2200); }, 6500);
      return;
    }
    const x = saved ? clamp(saved.x, 30, VW - 30) : VW * 0.8;
    P.placeAt(x, -40); P.fall({ v: [0, 120] });
  }

  /* ---------- the loop ---------- */
  let last = now_(), raf = 0, bx = -1, by = -1;
  function frame(now){
    const dt = Math.min(50, now - last); last = now;
    W.begin(now);
    floors = buildFloors(now);
    if (drag){
      P.surf = null; P.air = null; P.cmd = null; P.hang = null; P.climb = null; P.reflex = null;
      P.placeAt(drag.lx, drag.ly + P.p * 7, clamp(-drag.vx / 9000, -0.5, 0.5));
      if (!P.shot) P.play(t => Math.floor(t / 160) % 2 ? 'arms' : 'hang', 1e9);
    }
    brain(now);
    W.step(dt, now);
    stepTilts(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    W.draw(1, now); W.drawFront(1);
    ctx.globalAlpha = 1;
    const c = P.center(), hx = Math.round(c[0]), hy = Math.round(c[1] - P.p * 9);
    if (hx !== bx || hy !== by){ bub.style.transform = `translate(${hx}px, ${hy}px) translate(-50%, -100%)`; bx = hx; by = hy; }
    if (now > bubUntil && bub.classList.contains('on')) bub.classList.remove('on');
    raf = reduce ? 0 : requestAnimationFrame(frame);
  }
  const start = () => { doc.classList.add('dotto-alive'); last = now_(); enter(last); frame(last); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden){ cancelAnimationFrame(raf); raf = 0; } else if (!raf){ last = now_(); raf = requestAnimationFrame(frame); }
  });
  addEventListener('pagehide', () => sessionStorage.setItem('dotto-at', JSON.stringify({ x: P.x, y: P.y })));
  if (reduce) addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true });
})();
