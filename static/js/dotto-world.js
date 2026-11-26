/* Dotto lives on this site. One Dotto, the real one: the Pip engine from the Dotto prototype (js/pip-engine.js) drives
   his body, poses, physics, accessories and effects. This file is only his host and his brains for a web page:
   - the floors are the top edges of the page's blocks (titles, cards, rows, figures, the header rail, the stage);
     when you scroll, his floor moves with the content; when it leaves the screen he falls and lands on the next one;
   - click an empty spot and he goes there (a walk, a run, a cartoon dash or a jump);
   - click him for hearts and a new hat; drag him and throw him; shake your phone;
   - he looks at your pointer, sits, yawns, waves, and falls asleep in a nightcap if you leave him alone;
   - he dresses for the time of day, like on the device.
   Progressive enhancement: without JS a static Dotto sits on the stage. Under prefers-reduced-motion he sits still. */
(() => {
  if (!window.PipEngine) return;
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const INK = '#ffffff', RED = [255, 122, 107];

  /* ---------- canvas over the page ---------- */
  const cv = document.createElement('canvas');
  cv.className = 'dotto-world'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let VW = innerWidth, VH = innerHeight, dpr = 1;
  const resize = () => {
    VW = innerWidth; VH = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
  };
  resize(); addEventListener('resize', resize);

  const dot = (x, y, r, col, a) => {
    if (a <= 0.01) return;
    ctx.globalAlpha = a > 1 ? 1 : a; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  };
  const haptic = k => { if (touch && navigator.vibrate && (k === 'confirm' || k === 'heavy')) navigator.vibrate(k === 'heavy' ? 30 : 12); };
  const E = PipEngine.create({ ctx, dot, haptic, C: 0, S: 4000, INK, INK2: '#c4c4c0', RED: [255, 59, 47] });
  const W = E.world('page');
  const P = W.spawn({ p: touch ? 5 : 7.4, r: touch ? 2 : 3 });
  window.__dotto = { P, W, E };   // for the console: __dotto.P.say("hearts")

  /* ---------- what he wears ---------- */
  const HATS = ['none', 'cap', 'sun', 'party', 'phones', 'glasses', 'bedhead'];
  const HAT_SAY = { none: 'just me', cap: 'cap on', sun: 'too bright', party: 'party!', phones: 'tunes', glasses: 'reading mode', bedhead: 'bed hair' };
  const dayHat = () => {
    const h = new Date().getHours();
    if (h < 6 || h >= 23) return 'nightcap';
    if (document.querySelector('.prose')) return 'glasses';
    if (h < 11) return 'bedhead';
    if (h < 16) return 'sun';
    if (h < 20) return 'cap';
    return 'phones';
  };
  let hat = sessionStorage.getItem('dotto-hat') || dayHat();
  P.wear(hat);

  /* ---------- speech bubble ---------- */
  const bub = document.createElement('div');
  bub.className = 'dotto-say'; bub.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bub);
  let bubUntil = 0;
  const say = (txt, ms = 1600) => { bub.textContent = txt; bub.classList.add('on'); bubUntil = performance.now() + ms; };

  /* ---------- floors: the top edges of the page's blocks, in viewport coordinates ---------- */
  const SEL = '[data-floor], .hero-title, .hero-stats, .section-heading, .project, .project-minor li, .post-list li, .home-agent-list li, .article-header h1, .page-header h1, .prose h2, .prose figure img, .prose pre, .series-pager a, .agent-featured-grid > li, .agent-note-list > li, .foot-floor';
  const ids = new WeakMap(); let nid = 0;
  let els = [], elsT = -1e9;
  const railEl = document.querySelector('.rail');
  let topLimit = 70;
  function buildFloors(now){
    if (now - elsT > 1500){ els = [...document.querySelectorAll(SEL)]; elsT = now; }
    topLimit = railEl ? railEl.getBoundingClientRect().bottom + 8 : 20;
    const list = [];
    for (const el of els){
      const r = el.getBoundingClientRect();
      if (r.width < 50 || r.bottom < topLimit || r.top > VH - 4 || r.top < topLimit) continue;
      let id = ids.get(el); if (!id){ id = 'f' + (++nid); ids.set(el, id); }
      const S = W.seg(id, { x: r.left + r.width / 2, y: r.top, hl: r.width / 2 - 2, ledges: true, slip: false });
      S.el = el; list.push(S);
    }
    if (railEl){
      const r = railEl.getBoundingClientRect();
      const S = W.seg('rail', { x: r.left + r.width / 2, y: r.bottom - 2, hl: r.width / 2 - 4, ledges: false, slip: false });
      S.rail = true; list.push(S);
    }
    const G = W.seg('ground', { x: VW / 2, y: VH - 3, hl: VW / 2 - 14, ledges: false, slip: false });
    G.ground = true; list.push(G);
    return list;
  }

  /* ---------- the pointer ---------- */
  const ptr = { x: -1e3, y: -1e3, t: -1e9 };
  let lastInput = performance.now(), drag = null, petT = 0, sleeping = false, zT = 0, next = 0;
  const near = (x, y, r) => { const c = P.center(); return Math.hypot(x - c[0], y - c[1]) < r; };
  const wake = (why) => {
    lastInput = performance.now();
    if (sleeping){ sleeping = false; P.idle(); P.wear(hat); P.hop(260); P.say('!'); say(why || 'huh? I\'m up', 1400); }
  };
  addEventListener('pointermove', e => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now();
    if (!touch) wake();
    if (drag){ drag.vx = (e.clientX - drag.lx) / Math.max(1, (e.timeStamp - drag.lt) / 1000); drag.vy = (e.clientY - drag.ly) / Math.max(1, (e.timeStamp - drag.lt) / 1000); drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = e.timeStamp; drag.moved = true; }
    if (!touch && !drag && near(e.clientX, e.clientY, 34 + P.p * 2) && performance.now() - petT > 2600 && P.ready()){
      petT = performance.now(); P.hop(200); P.say('hearts'); say(pick(['hehe', 'that tickles', 'hi!', ':)']));
    }
  }, { passive: true });
  addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    wake();
    if (near(e.clientX, e.clientY, 30 + P.p * 2.5)){
      drag = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0, moved: false, t0: performance.now() };
      e.preventDefault();
    }
  });
  addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    const v = Math.hypot(d.vx, d.vy);
    if (!d.moved || (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6 && performance.now() - d.t0 < 400)){
      // a tap on him: hearts and a new hat
      P.stopPlay(); P.fall({ v: [0, -120] });
      hat = HATS[(HATS.indexOf(hat) + 1) % HATS.length]; P.wear(hat); sessionStorage.setItem('dotto-hat', hat);
      P.say('hearts'); say(HAT_SAY[hat] || 'ta-da');
      return;
    }
    P.stopPlay();
    const vx = clamp(d.vx, -2600, 2600), vy = clamp(d.vy, -2600, 2600);
    P.fall({ v: [vx, vy], spin: v > 900 ? (vx > 0 ? 1 : -1) * rnd(9, 14) : 0, grab: true });
    if (v > 900){ P.reflex = 'flung'; P.until = performance.now() + 4000; say(pick(['wheee!', 'aaaa', 'yeet'])); }
    else say(pick(['careful', 'ok ok', 'put me down']));
  });
  // a click on an empty spot: he goes there
  addEventListener('click', e => {
    if (reduce || drag) return;
    if (e.target.closest('a, button, input, textarea, select, summary, label, pre, code')) return;
    goToward(e.clientX, e.clientY, true);
  });
  // fast scroll shakes his world
  let lastSY = scrollY, lastST = performance.now(), shakeT = 0;
  addEventListener('scroll', () => {
    const t = performance.now(), v = Math.abs(scrollY - lastSY) / Math.max(1, t - lastST) * 1000;
    lastSY = scrollY; lastST = t; lastInput = t;
    if (sleeping && v > 1500) wake('whoa, where are we going');
    if (t - shakeT > 3500 && P.surf && !P.surf.rail && !P.surf.ground){
      if (v > 7000){ shakeT = t; W.shake(1); say(pick(['whoa!', 'slow down!', 'aaah'])); }
      else if (v > 3200){ shakeT = t; W.shake(0.5); }
    }
  }, { passive: true });
  // a shaken phone
  let motionAsked = false;
  const onMotion = e => {
    const a = e.acceleration || {}; const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const t = performance.now();
    if (m > 22 && t - shakeT > 1500){ shakeT = t; W.shake(1); wake(); say(pick(['whoa!', 'stop shaking!', 'earthquake!'])); }
  };
  if (touch) addEventListener('touchend', () => {
    if (motionAsked) return; motionAsked = true;
    const D = window.DeviceMotionEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().then(s => { if (s === 'granted') addEventListener('devicemotion', onMotion); }).catch(() => {});
    else if (D) addEventListener('devicemotion', onMotion);
  }, { passive: true });

  /* ---------- going somewhere ---------- */
  let floors = [];
  function floorUnder(x, y){
    let best = null, bd = 1e9;
    for (const S of floors){
      if (x < S.x - S.hl - 10 || x > S.x + S.hl + 10) continue;
      const dy = S.y - y; const d = dy >= -12 ? dy : 400 - dy * 2;
      if (d < bd){ bd = d; best = S; }
    }
    return best;
  }
  function goToward(x, y, loud){
    const S = floorUnder(x, y) || floors[floors.length - 1]; if (!S) return;
    const s = clamp(x - S.x, -S.hl + 6, S.hl - 6);
    sleeping = false; P.wear(hat);
    if (!P.ready()){ return; }
    if (S === P.surf){
      const d = Math.abs(s - P.s);
      if (d > 260 && loud) P.dashTo(s, { dir: s > P.s ? 1 : -1 });
      else if (d > 60) P.runTo(s); else P.walkTo(s);
      P.face = s > P.s ? 1 : -1;
    } else {
      const dx = S.x + s - P.x, dy = S.y - P.y;
      if (Math.hypot(dx, dy) > 900){ P.runTo(clamp(dx, -P.surf.hl, P.surf.hl)); return; }
      P.face = dx > 0 ? 1 : -1;
      P.jumpTo({ surf: S.id, s }, { spin: Math.abs(dy) > 260 && Math.random() < 0.4 ? (dx > 0 ? 1 : -1) : 0 });
      if (loud && Math.random() < 0.4) say(pick(['on my way', 'hup!', 'coming!']), 1100);
    }
  }

  /* ---------- his brains ---------- */
  W.on('land', (_, S, vn) => { if (vn > 900) say(pick(['oof', 'ouch', 'nailed it'])); });
  W.on('grab', () => { if (Math.random() < 0.6) say(pick(['hup!', 'phew', 'almost!'])); });
  W.on('decide', () => 'climb');
  function brain(now){
    // lost: dropped off the world or thrown far away. He comes back from the top
    if (P.y > VH + 160 || P.x < -160 || P.x > VW + 160 || P.y < -400){
      const S = pick(floors.filter(f => !f.ground)) || floors[0];
      P.placeAt(clamp(S ? S.x : VW / 2, 40, VW - 40), -40); P.fall({ v: [0, 200] }); P.reflex = null; say('I\'m back', 1200);
      return;
    }
    if (drag || reduce){ return; }
    const idleMs = now - lastInput;
    if (!sleeping && idleMs > 28000 && P.idleNow()){
      sleeping = true; P.wear('nightcap'); P.sleep(); say('zzz', 1500);
    }
    if (sleeping){ if (now - zT > 1500){ zT = now; W.fx.zee(P, (zT / 1500 | 0) % 3); } return; }
    if (now - ptr.t < 4000 && P.idleNow()) P.lookAt(ptr.x, ptr.y); else if (P.idleNow()) P.lookAt(null);
    // his floor scrolled under the header: he hops onto the rail or the next floor down
    if (P.ready() && P.surf && !P.surf.rail && P.y < topLimit + 30){ goToward(P.x, P.y + 60, false); }
    if (now < next || !P.idleNow()) return;
    next = now + rnd(2200, 6200);
    const S = P.surf; if (!S) return;
    const roll = Math.random();
    const others = floors.filter(f => f !== S && !f.ground && Math.abs(f.x - P.x) < 520 && Math.abs(f.y - P.y) < 380 && Math.abs(f.y - P.y) > 18);
    if (S.ground && others.length && roll < 0.7){ const T = pick(others); P.jumpTo({ surf: T.id, s: rnd(-T.hl * .7, T.hl * .7) }); return; }
    if (roll < 0.3) P.walkTo(rnd(-S.hl * .85, S.hl * .85));
    else if (roll < 0.55 && others.length){
      // prefer floors near the pointer: he likes company
      others.sort((a, b) => Math.hypot(a.x - ptr.x, a.y - ptr.y) - Math.hypot(b.x - ptr.x, b.y - ptr.y));
      const T = now - ptr.t < 8000 ? others[0] : pick(others);
      P.jumpTo({ surf: T.id, s: clamp(rnd(-T.hl * .6, T.hl * .6), -T.hl, T.hl) });
    }
    else if (roll < 0.65) { P.runTo(rnd(-S.hl * .9, S.hl * .9)); }
    else if (roll < 0.75) { P.sit(); next = now + rnd(4000, 8000); }
    else if (roll < 0.82) { P.play('yawn', 1300); }
    else if (roll < 0.9) { P.play('arms', 900); say(pick(['hi!', 'hello', 'psst', 'drag me', 'click somewhere'])); }
    else { P.play('lookup', 1600); }
  }

  /* ---------- the stage on the home page: he drops in and says hi ---------- */
  const stage = document.querySelector('.stage');
  if (stage){ const h = new Date().getHours(); stage.classList.toggle('is-day', h >= 7 && h < 19); }
  const saved = JSON.parse(sessionStorage.getItem('dotto-at') || 'null');
  function enter(){
    floors = buildFloors(performance.now());
    if (stage){
      const top = stage.querySelector('[data-floor].plat-top') || stage.querySelector('[data-floor]');
      const r = top.getBoundingClientRect();
      if (reduce){ const S = floors.find(f => f.el === top); if (S) P.place(S, 0); P.sit(); return; }
      P.placeAt(r.left + r.width / 2, Math.max(topLimit + 6, r.top - 260)); P.fall({ v: [0, 120], ignore: floors.find(f => f.rail) });
      P.air.ignoreRail = true;
      next = performance.now() + 6500;
      setTimeout(() => { P.play('arms', 1400); P.say('hearts'); say('hi! I\'m Dotto', 2400); }, 900);
      setTimeout(() => { if (!sleeping) say('drag me around', 2000); }, 3800);
    } else {
      const x = saved ? clamp(saved.x, 30, VW - 30) : VW * 0.85;
      const S = floorUnder(x, topLimit + 40) || floors[0];
      if (reduce){ if (S) P.place(S, clamp(x - S.x, -S.hl, S.hl)); P.sit(); return; }
      P.placeAt(x, topLimit - 30); P.fall({ v: [0, 120] });
    }
  }

  /* ---------- the loop ---------- */
  let last = performance.now(), raf = 0, bx = -1, by = -1;
  function frame(now){
    const dt = Math.min(50, now - last); last = now;
    W.begin(now);
    floors = buildFloors(now);
    if (drag){
      P.surf = null; P.air = null; P.cmd = null; P.hang = null; P.climb = null;
      P.placeAt(drag.lx, drag.ly + P.p * 7, clamp(-drag.vx / 9000, -0.5, 0.5));
      if (!P.shot) P.play(t => Math.floor(t / 160) % 2 ? 'arms' : 'hang', 1e9);
    }
    brain(now);
    W.step(dt, now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    W.draw(1, now); W.drawFront(1);
    ctx.globalAlpha = 1;
    // the bubble follows his head
    const c = P.center();
    const hx = Math.round(c[0]), hy = Math.round(c[1] - P.p * 9);
    if (hx !== bx || hy !== by){ bub.style.transform = `translate(${hx}px, ${hy}px) translate(-50%, -100%)`; bx = hx; by = hy; }
    if (now > bubUntil && bub.classList.contains('on')) bub.classList.remove('on');
    raf = reduce ? 0 : requestAnimationFrame(frame);
  }
  const start = () => { doc.classList.add('dotto-alive'); enter(); last = performance.now(); frame(last); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden){ cancelAnimationFrame(raf); raf = 0; }
    else if (!raf){ last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  addEventListener('pagehide', () => sessionStorage.setItem('dotto-at', JSON.stringify({ x: P.x, y: P.y })));
  if (reduce) addEventListener('scroll', () => { requestAnimationFrame(frame); }, { passive: true });
})();
