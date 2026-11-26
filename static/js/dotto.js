/* andreabor.io: Dotto, alive. Progressive enhancement only: without this file the site is complete.
   - the puck on the home page becomes a dot-matrix display (clock and latest post, a colour wave between them, Dotto on the rim);
   - Dotto lives on the header rail: follows the pointer, jumps on click, falls asleep, walks with your reading on articles;
   - the background dots light up under the pointer, a click sends a ring of light;
   - titles power on, sections reveal, cards tilt.
   Everything stops under prefers-reduced-motion. */
(() => {
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  let sprites = {};
  try { sprites = JSON.parse(document.getElementById('dotto-data').textContent); } catch (e) {}
  doc.classList.add('js');
  if (reduce) doc.classList.add('still');

  const ACCENT = [255, 122, 107];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => performance.now();

  /* sprite rows -> list of [x, y] dots, feet on the bottom row of a 9x9 cell */
  const poses = {};
  for (const k in sprites) {
    const rows = sprites[k], off = 9 - rows.length, pts = [];
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') pts.push([x, y + off]); }));
    poses[k] = pts;
  }
  const RUN = ['run1', 'run2', 'run3', 'run4'];
  /* 5x7 dot font, as on the device for small text: one dot per cell */
  const F5 = {"A": "01110100011000111111100011000110001", "B": "11110100011000111110100011000111110", "C": "01110100011000010000100001000101110", "D": "11110100011000110001100011000111110", "E": "11111100001000011110100001000011111", "F": "11111100001000011110100001000010000", "G": "01110100011000010111100011000101111", "H": "10001100011000111111100011000110001", "I": "01110001000010000100001000010001110", "J": "00111000100001000010000101001001100", "K": "10001100101010011000101001001010001", "L": "10000100001000010000100001000011111", "M": "10001110111010110101100011000110001", "N": "10001100011100110101100111000110001", "O": "01110100011000110001100011000101110", "P": "11110100011000111110100001000010000", "Q": "01110100011000110001101011001001101", "R": "11110100011000111110101001001010001", "S": "01111100001000001110000010000111110", "T": "11111001000010000100001000010000100", "U": "10001100011000110001100011000101110", "V": "10001100011000110001100010101000100", "W": "10001100011000110101101011010101010", "X": "10001100010101000100010101000110001", "Y": "10001100011000101010001000010000100", "Z": "11111000010001000100010001000011111", "0": "01110100011001110101110011000101110", "1": "00100011000010000100001000010001110", "2": "01110100010000100010001000100011111", "3": "11111000100010000010000011000101110", "4": "00010001100101010010111110001000010", "5": "11111100001111000001000011000101110", "6": "00110010001000011110100011000101110", "7": "11111000010001000100010000100001000", "8": "01110100011000101110100011000101110", "9": "01110100011000101111000010001001100", ":": "00000011000110000000011000110000000", ".": "00000000000000000000000000110001100", ",": "00000000000000000000011000010001000", "-": "00000000000000011111000000000000000", "'": "01100001000100000000000000000000000", "!": "00100001000010000100001000000000100", "?": "01110100010000100010001000000000100", "/": "00001000010001000100010001000010000", "(": "00010001000100001000010000010000010", ")": "01000001000001000010000100010001000", "&": "01100100101010001000101011001001101", "·": "00000000000000001100011000000000000"};
  const glyph = ch => {
    const g = F5[ch.toUpperCase()]; if (!g) return { w: 3, on: () => false };
    let a = 5, b = -1; for (let x = 0; x < 5; x++) for (let y = 0; y < 7; y++) if (g[y * 5 + x] === '1') { a = Math.min(a, x); b = Math.max(b, x); }
    const narrow = !/[A-Z0-9&?]/i.test(ch); const x0 = narrow ? a : 0, w = narrow ? b - a + 1 : 5;
    return { w, on: (x, y) => g[y * 5 + x + x0] === '1' };
  };
  const textWidth = (str, k) => [...str].reduce((t, ch) => t + (glyph(ch).w + 1) * k, -k);

  /* ---------------- titles power on, letter by letter ---------------- */
  function powerOn(el, step) {
    if (!el || reduce) return;
    const walk = n => {
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const wd = document.createElement('span'); wd.className = 'pw';
            [...part].forEach(ch => {
              const s = document.createElement('span');
              s.className = 'po'; s.textContent = ch;
              s.style.setProperty('--i', powerOn.i++);
              wd.appendChild(s);
            });
            frag.appendChild(wd);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && !c.classList.contains('cursor')) walk(c);
      });
    };
    powerOn.i = 0;
    el.style.setProperty('--step', step + 'ms');
    walk(el);
    el.classList.add('powering');
  }
  powerOn(document.querySelector('.hero-title'), 55);
  powerOn(document.querySelector('.article-header h1, .page-header h1, .lost h1'), 22);

  /* ---------------- reveal on scroll ---------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    const sel = '.section-heading, .project, .project-minor li, .post-list li, .home-agent-list li, .hero-stats, .prose figure, .prose h2, .series-pager a, .agent-featured-grid > li, .agent-note-list > li';
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    const groups = new Map();
    document.querySelectorAll(sel).forEach(el => {
      const p = el.parentElement, n = groups.get(p) || 0;
      groups.set(p, n + 1);
      el.style.setProperty('--d', Math.min(n, 6) * 70 + 'ms');
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  /* ---------------- background dots that light under the pointer ---------------- */
  if (fine && !reduce) {
    const light = document.createElement('div');
    light.className = 'dot-light'; light.setAttribute('aria-hidden', 'true');
    document.body.appendChild(light);
    let tx = -999, ty = -999, x = -999, y = -999, raf = 0;
    const tick = () => {
      x = lerp(x, tx, .18); y = lerp(y, ty, .18);
      light.style.setProperty('--mx', x + 'px'); light.style.setProperty('--my', y + 'px');
      raf = (Math.abs(x - tx) + Math.abs(y - ty) > .5) ? requestAnimationFrame(tick) : 0;
    };
    addEventListener('pointermove', e => {
      if (x < -900) { x = e.clientX; y = e.clientY; }
      tx = e.clientX; ty = e.clientY; light.classList.add('on');
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    document.addEventListener('pointerleave', () => light.classList.remove('on'));
    addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const r = document.createElement('div');
      r.className = 'dot-ripple'; r.setAttribute('aria-hidden', 'true');
      r.style.setProperty('--x', e.clientX + 'px'); r.style.setProperty('--y', e.clientY + 'px');
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 1100);
    });
  }

  /* ---------------- cards tilt toward the pointer ---------------- */
  if (fine && !reduce) {
    document.querySelectorAll('.project, .series-pager a').forEach(card => {
      card.addEventListener('pointermove', e => {
        const b = card.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
        card.style.setProperty('--ry', ((px - .5) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((.5 - py) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        card.classList.add('tilt');
      });
      card.addEventListener('pointerleave', () => { card.classList.remove('tilt'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---------------- Dotto on the rail ---------------- */
  const rail = document.querySelector('.rail');
  const walker = rail && rail.querySelector('.walker');
  if (rail && walker && poses.idle) {
    const S = 18, NS = 'http://www.w3.org/2000/svg';
    walker.innerHTML = '';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 9 9'); svg.setAttribute('width', S); svg.setAttribute('height', S);
    svg.setAttribute('class', 'dotto'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use'); svg.appendChild(use); walker.appendChild(svg);
    const zzz = document.createElement('span'); zzz.className = 'zzz rail-zzz'; zzz.innerHTML = '<i></i><i></i><i></i>'; walker.appendChild(zzz);
    const trail = document.createElement('span'); trail.className = 'rail-trail'; rail.appendChild(trail);
    walker.classList.add('alive');
    const article = document.querySelector('.prose') && document.querySelector('.article-header');

    let w = rail.clientWidth - S;
    let x = parseFloat(sessionStorage.getItem('dotto-x'));
    if (!isFinite(x)) x = article ? 0 : w * .1;
    let vx = 0, y = 0, vy = 0, face = 1, target = x, last = now(), lastInput = now(), frame = 0, ft = 0, pose = '', done = false;
    const setPose = p => { if (p !== pose) { use.setAttribute('href', '#d-' + p); pose = p; } };
    addEventListener('resize', () => { w = rail.clientWidth - S; });
    const jump = (v) => { if (y === 0) { vy = v; } };
    if (!article) addEventListener('pointermove', e => {
      const b = rail.getBoundingClientRect();
      target = clamp(e.clientX - b.left - S / 2, 0, w); lastInput = now();
    }, { passive: true });
    addEventListener('pointerdown', () => { lastInput = now(); jump(150); });
    let lastScroll = scrollY;
    addEventListener('scroll', () => {
      lastInput = now();
      if (Math.abs(scrollY - lastScroll) > 120 && !article) jump(90);
      lastScroll = scrollY;
    }, { passive: true });
    addEventListener('keydown', () => { lastInput = now(); });
    const progress = () => {
      const b = article.parentElement.getBoundingClientRect();
      const total = b.height - innerHeight * .6;
      return clamp(-b.top / Math.max(1, total), 0, 1);
    };
    const step = t => {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      if (article) {
        const p = progress(); target = p * w;
        trail.style.width = (x + S / 2) + 'px';
        if (p > .995 && !done) { done = true; jump(170); setTimeout(() => jump(150), 450); }
        if (p < .9) done = false;
      }
      if (reduce) { x = target; } else {
        const dx = target - x, ax = clamp(dx * 18, -900, 900) - vx * 7;
        vx += ax * dt; x += vx * dt;
        if (Math.abs(vx) > 6) face = vx > 0 ? 1 : -1;
        vy -= 520 * dt; y = Math.max(0, y + vy * dt); if (y === 0 && vy < 0) vy = 0;
      }
      x = clamp(x, 0, w);
      const asleep = !article && t - lastInput > 9000 && Math.abs(vx) < 4;
      if (y > 0) setPose('run2');
      else if (asleep) setPose('sleep');
      else if (Math.abs(vx) > 6) {
        ft += dt * clamp(Math.abs(vx) / 9, 4, 16);
        setPose(RUN[Math.floor(ft) % 4]);
      } else setPose(((t / 1000) % 4.2) > 4.05 ? 'blink' : 'idle');
      walker.classList.toggle('asleep', asleep);
      walker.style.transform = `translate(${x.toFixed(1)}px, ${(-y).toFixed(1)}px)`;
      svg.style.transform = `scaleX(${face})`;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    addEventListener('pagehide', () => sessionStorage.setItem('dotto-x', x));
  }

  /* ---------------- the puck: a dot-matrix display ---------------- */
  const puck = document.querySelector('.puck');
  const glass = puck && puck.querySelector('.puck-glass');
  if (glass && poses.run1) {
    const cv = document.createElement('canvas');
    cv.className = 'puck-canvas'; cv.setAttribute('aria-hidden', 'true');
    glass.insertBefore(cv, glass.querySelector('.puck-glare'));
    const ctx = cv.getContext('2d');
    const N = 64, SS = 6;
    const off = document.createElement('canvas'); off.width = off.height = N * SS;
    const octx = off.getContext('2d', { willReadFrequently: true });
    const title = ((puck.querySelector('.puck-title') || {}).textContent || '').trim();
    const dateTxt = ((puck.querySelector('.puck-date') || {}).textContent || '').trim();
    const cells = [], grid = new Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const cx = i + .5 - N / 2, cy = j + .5 - N / 2, d = Math.hypot(cx, cy);
      if (d < N / 2 - .6) { const c = { i, j, d, r: 0, g: 0, b: 0, a: 0, tr: 0, tg: 0, tb: 0, ta: 0, nr: 0, ng: 0, nb: 0, na: 0 }; cells.push(c); grid[j * N + i] = c; }
    }
    let size = 0, dpr = 1, scene = 'clock', waveT = -1e9, mx = -99, my = -99, hover = false, tiltX = 0, tiltY = 0, ttx = 0, tty = 0;
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1); size = glass.clientWidth;
      cv.width = cv.height = Math.round(size * dpr);
    };
    resize(); addEventListener('resize', resize);

    const wrap = (txt, maxW) => {
      const words = txt.split(' '), lines = []; let cur = '';
      words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (octx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; });
      if (cur) lines.push(cur); return lines;
    };
    const put = (i, j, col) => { if (i < 0 || j < 0 || i >= N || j >= N) return; const c = grid[j * N + i]; if (c) { c.nr = col[0]; c.ng = col[1]; c.nb = col[2]; c.na = 1; } };
    const text5 = (str, x, y, k, col) => {
      for (const ch of str) {
        const g = glyph(ch);
        for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < g.w; gx++) if (g.on(gx, gy))
          for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) put(x + gx * k + a, y + gy * k + b, col);
        x += (g.w + 1) * k;
      }
    };
    const center5 = (str, y, k, col) => text5(str, Math.round((N - textWidth(str, k)) / 2), y, k, col);
    let marquee = 0, marqueeW = 0;
    const paint = () => {
      const W = N * SS;
      cells.forEach(c => { c.na = 0; });
      const d = new Date();
      if (scene === 'clock') {
        octx.clearRect(0, 0, W, W);
        octx.textAlign = 'center'; octx.textBaseline = 'middle';
        const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
        octx.fillStyle = '#fff'; octx.font = `900 ${W * .3}px Doto`;
        octx.fillText(hh + (d.getSeconds() % 2 ? ' ' : ':') + mm, W / 2, W * .47);
        const img = octx.getImageData(0, 0, W, W).data;
        cells.forEach(c => {
          let a = 0;
          for (let y = 0; y < SS; y += 2) for (let x = 0; x < SS; x += 2) a += img[((c.j * SS + y) * W + c.i * SS + x) * 4 + 3];
          { const v = a / 255 / 9; c.na = v < .18 ? 0 : clamp(v * 3, 0, 1); } c.nr = c.ng = c.nb = 255;
        });
        center5(d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase() + ' ' + d.getDate(), 43, 1, ACCENT);
      } else {
        center5('LATEST', 13, 1, ACCENT);
        const k = 2, y = 25, tw = textWidth(title, k);
        marqueeW = tw + N;
        text5(title, Math.round(N - marquee), y, k, [255, 255, 255]);
        center5(dateTxt.split(' ').slice(0, 2).join(' ').toUpperCase(), 45, 1, [160, 160, 160]);
      }
    };
    let sceneT = now();
    const swap = (to) => { if (to === scene) return; scene = to; waveT = sceneT = now(); marquee = 0; paint(); };
    let lastSec = -1, frameN = 0;
    const ready = () => {
      paint(); cells.forEach(c => { c.tr = c.nr; c.tg = c.ng; c.tb = c.nb; c.ta = c.na; if (reduce) { c.r = c.tr; c.g = c.tg; c.b = c.tb; c.a = c.ta; } });
      doc.classList.add('puck-live');
      if (!reduce) setInterval(() => { if (hover) return; if (scene === 'clock' && now() - sceneT > 8000) swap('latest'); else if (scene === 'latest' && marquee > marqueeW) swap('clock'); }, 250);
      requestAnimationFrame(draw);
    };
    (document.fonts ? document.fonts.load('800 40px Doto').then(ready, ready) : ready());

    puck.addEventListener('pointerenter', () => { hover = true; swap('latest'); });
    puck.addEventListener('pointerleave', () => { hover = false; mx = my = -99; ttx = tty = 0; });
    puck.addEventListener('pointermove', e => {
      const b = glass.getBoundingClientRect();
      mx = (e.clientX - b.left) / b.width * N; my = (e.clientY - b.top) / b.height * N;
      ttx = ((e.clientY - b.top) / b.height - .5) * -14; tty = ((e.clientX - b.left) / b.width - .5) * 14;
    });
    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) requestAnimationFrame(draw); }).observe(puck);

    const draw = t => {
      if (!visible) return;
      const sec = new Date().getSeconds();
      if (scene === 'latest') { const m = Math.floor((t - sceneT) / 1000 * 26); if (m !== marquee) { marquee = hover && marquee > marqueeW ? 0 : m; if (marquee > marqueeW && hover) sceneT = t; paint(); } }
      else if (sec !== lastSec) { lastSec = sec; paint(); }
      tiltX = lerp(tiltX, ttx, .08); tiltY = lerp(tiltY, tty, .08);
      puck.style.setProperty('--tx', tiltX.toFixed(2) + 'deg'); puck.style.setProperty('--ty', tiltY.toFixed(2) + 'deg');
      const p = size / N * dpr, front = (t - waveT) / 1000 * 34, px = -tiltY * .12 * dpr, py = tiltX * .12 * dpr;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const c of cells) {
        if (front > c.d && c.ta !== c.na) { c.tr = c.nr; c.tg = c.ng; c.tb = c.nb; c.ta = c.na; }
        const k = reduce ? 1 : (scene === 'latest' && front > N ? .55 : .2);
        c.r = lerp(c.r, c.tr, k); c.g = lerp(c.g, c.tg, k); c.b = lerp(c.b, c.tb, k); c.a = lerp(c.a, c.ta, k);
        const wv = Math.exp(-Math.pow((front - c.d) / 2.2, 2)) * (front < N ? 1 : 0);
        const md = Math.hypot(c.i + .5 - mx, c.j + .5 - my), glow = Math.max(0, 1 - md / 6) * .35;
        const base = .07;
        let a = Math.max(base, c.a), r = c.r, g = c.g, b = c.b;
        if (c.a < .08) { r = g = b = 255; }
        const mix = clamp(wv + glow, 0, 1);
        r = lerp(r, ACCENT[0], mix * (1 - c.a * .6)); g = lerp(g, ACCENT[1], mix * (1 - c.a * .6)); b = lerp(b, ACCENT[2], mix * (1 - c.a * .6));
        a = clamp(a + wv * .9 + glow, 0, 1);
        const lit = c.a > .08;
        const ox = lit ? px : 0, oy = lit ? py : 0;
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc((c.i + .5) * p + ox, (c.j + .5) * p + oy, p * (lit ? .4 : .3), 0, 6.283); ctx.fill();
      }
      /* sixty minute dots on the rim, the current second lit in the accent colour */
      {
        const R0 = size * dpr / 2, rt = R0 - p * 1.1, sNow = new Date().getSeconds();
        for (let k = 0; k < 60; k++) {
          const a = k / 60 * Math.PI * 2 - Math.PI / 2, big = k % 5 === 0, cur = k === sNow;
          ctx.fillStyle = cur ? `rgba(${ACCENT},1)` : `rgba(255,255,255,${big ? .7 : .22})`;
          ctx.beginPath(); ctx.arc(R0 + Math.cos(a) * rt, R0 + Math.sin(a) * rt, p * (cur ? .38 : big ? .3 : .2), 0, 6.283); ctx.fill();
        }
      }
      /* Dotto runs the rim, one lap a minute, rotated so his feet touch the glass edge */
      const ms = Date.now() % 60000, ang = ms / 60000 * Math.PI * 2 + Math.PI / 2;
      const R = size * dpr / 2, rr = R - p * 1.7, pose = poses[RUN[Math.floor(t / 140) % 4]];
      ctx.save(); ctx.translate(R + Math.cos(ang) * rr, R + Math.sin(ang) * rr); ctx.rotate(ang - Math.PI / 2);
      const u = p * .5;
      ctx.fillStyle = '#fff';
      for (const [x, y] of pose) { ctx.beginPath(); ctx.arc((x - 4) * u, (y - 8.5) * u, u * .4, 0, 6.283); ctx.fill(); }
      ctx.restore();
      if (!reduce) requestAnimationFrame(draw);
    };
  }
})();
