/* andreabor.io: Dotto, alive. Progressive enhancement only: without this file the site is complete.
   (Dotto himself lives in js/dotto-world.js, on the Pip engine.)
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
    const sel = '.section-heading, .project-minor li, .post-list li, .home-agent-list li, .hero-stats, .prose figure, .prose h2, .series-pager a, .agent-featured-grid > li, .agent-note-list > li';
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

})();
