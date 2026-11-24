/* Scene: "La dinamite", on the Pip Engine (scenes v2).
   Pip drags a stick of TNT along the rim to where the second is going to be, lights the fuse, runs to the far side of
   the ring and covers his ears, crouched and shaking. The second hops over the stick; the fuse reaches the end.
   A real pixel explosion: a white flash, a fireball that cools into smoke, flying debris, a red wave, and the whole face
   comes down. The second goes on, untouched. Pip uncovers his ears, looks at the rubble, then at us.

   Timeline (ms):  0 pulls the TNT out and drags it · arrival +200 crouches, lights the fuse · +650 "!" and off he runs
                   ~2.5 s ears covered, trembling · 5000 the second hops over · 5400 BOOM · +1100 hands down, looks
                   · +1700 the take · +2500 walks back while the face puts itself together · 9000 end */
(function(){
  const PX = 2, OMEGA = Math.PI * 2 / 60000;                 // the second moves 6° a second
  const CROSS = 5000, BOOM = 5400, ROPE = 0.16;
  const PAL = { h: '#ff7a6b', R: '#e0322b', r: '#8f1b16', W: '#f1e9d6', k: '#262626', e: '#c8bc9f', f: '#8c7a63' };
  // the stick lying down: 23 × 9 pixels, a label with TNT in the middle; the fuse is built every frame on the right
  const T3 = ['###', '.#.', '.#.', '.#.', '.#.'], N5 = ['#...#', '##..#', '#.#.#', '#..##', '#...#'];
  const LABEL = []; for (let r = 0; r < 7; r++){
    if (r === 0 || r === 6){ LABEL.push('W'.repeat(15)); continue; }
    const q = r - 1, line = 'W' + T3[q] + 'W' + N5[q] + 'W' + T3[q] + 'W';
    LABEL.push(line.replace(/#/g, 'k').replace(/\./g, 'W'));
  }
  const STICK = ['.' + 'h'.repeat(21) + '.'];
  for (let r = 0; r < 7; r++) STICK.push('eRRR' + LABEL[r] + 'RRRe');
  STICK.push('.' + 'r'.repeat(21) + '.');
  const FUSE = [[23, 4], [24, 4], [25, 3], [26, 2], [26, 1], [27, 0], [28, 0], [29, -1]];   // cells right of the stick, row -1 = above it
  function tntRows(burnt, mirror){
    // a 39 × 11 grid, the stick centred, two rows above it for the fuse; mirrored, the fuse goes left but the label still reads
    const left = 8, top = 2, rows = [];
    for (let r = 0; r < 11; r++) rows.push(new Array(39).fill('.'));
    STICK.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') rows[top + r][left + c] = ch; }));
    const keep = Math.max(0, Math.ceil(FUSE.length * (1 - burnt)));
    for (let i = 0; i < keep; i++){ const [c, r] = FUSE[i]; rows[top + r][left + c] = 'f'; }
    if (mirror) for (const row of rows){ row.reverse(); const lab = row.slice(left + 4, left + 19).reverse(); row.splice(left + 4, 15, ...lab); }
    const tip = keep ? FUSE[keep - 1] : [22, 4];
    return { rows: rows.map(r => r.join('')), tip: mirror ? [38 - 2 * left - tip[0], tip[1]] : tip, left, top };
  }
  const RUBBLE = ['..k.....', '.kgk..k.', 'kgrgkkgk'];

  window.PIP_SCENES.push({
    id: 'dinamite', name: 'La dinamite', dur: 9000,
    script(s){
      const { at, pip } = s, P = s.body, st = s.state;
      const m0 = s.markerTh, S = m0 + CROSS * OMEGA;            // where the second will be at 5 s
      const dir = Math.sign(s.normA(S + ROPE - P.s)) || 1;      // he comes the short way round
      const A = S + dir * ROPE;                                 // he stops one rope ahead of the stick
      Object.assign(st, { dir, S, tnt: P.s - dir * ROPE, drag: true, lit: -1, burnt: 0, boomed: false, wob: 0 });

      // where a cell of the TNT grid is, in the world (for sparks off the fuse)
      const cellAt = (th, c, r) => {
        const [x, y] = s.feetAt(th), rot = th - Math.PI / 2, lx = (c + 0.5 - 19.5) * PX, ly = (r + 0.5 - 11) * PX;
        return [x + lx * Math.cos(rot) - ly * Math.sin(rot), y + lx * Math.sin(rot) + ly * Math.cos(rot)];
      };

      // 1. he pulls the stick out of nowhere and drags it along the rim, by its fuse
      at(0, (p, f) => { const [x, y] = s.feetAt(st.tnt); f.dustAt(x, y, 8, 70); s.haptic('soft'); });
      at(0, pip.runTo(A, { vmax: 300, acc: 1400, done: () => { st.arrive = s.t; } }));
      at(0, pip.eyes(1));

      // the props, every frame
      s.frame(t => {
        let n = 0;
        if (st.drag){
          const want = P.s - st.dir * ROPE;
          st.tnt += s.normA(want - st.tnt) * 0.3;
          if (Math.abs(P.vs) > 40 && Math.floor(t / 90) !== Math.floor((t - 16) / 90)){ const [x, y] = s.feetAt(st.tnt - st.dir * 0.08); s.effects.dust(x, y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 260, 1.2); }
          st.wob = Math.abs(P.vs) > 40 ? Math.sin(t / 45) * 0.06 : st.wob * 0.9;
        } else if (st.arrive != null) st.tnt += s.normA(st.S - st.tnt) * 0.2;
        if (st.boomed){
          // the rubble where the stick was
          const [x, y] = s.feetAt(st.S); s.sprite(RUBBLE, x, y, { px: PX, palette: { k: '#3a3a38', g: '#6e6e6c', r: '#8f1b16' }, rot: st.S - Math.PI / 2, anchor: 'bottom', a: 1 - s.sstep(8200, 9000, t) });
          return 8;
        }
        const mirror = st.dir > 0, burnt = st.lit < 0 ? 0 : s.clamp((t - st.lit) / (BOOM - st.lit), 0, 1);
        const g = tntRows(burnt, mirror), [x, y] = s.feetAt(st.tnt), [ux, uy] = s.up(st.tnt), lift = st.drag ? Math.abs(Math.sin(t / 70)) * 1.5 * (Math.abs(P.vs) > 40 ? 1 : 0) : 0;
        s.sprite(g.rows, x + ux * lift, y + uy * lift, { px: PX, palette: PAL, rot: st.tnt - Math.PI / 2 + st.wob, anchor: 'bottom' });
        n += 40;
        if (st.drag){
          // the rope: from the fuse to his hand
          const [ex, ey] = cellAt(st.tnt, g.left + g.tip[0], g.top + g.tip[1]), [cx, cy] = P.center();
          s.line(ex, ey, cx - ux * 4, cy - uy * 4, '#8c7a63', 0.9, 1);
        }
        if (st.lit >= 0 && burnt < 1){
          // the spark runs down the fuse: orange and yellow pixels, the odd white one
          const [sx, sy] = cellAt(st.tnt, g.left + g.tip[0], g.top + g.tip[1]), k = Math.floor(t / 40);
          s.sprite([k % 2 ? '.y.' : 'w.y', 'yow', k % 3 ? '.o.' : 'o.y'], sx, sy, { px: PX, palette: { y: '#ffd23f', o: '#ff8c1a', w: '#ffffff' } });
          if (k !== st.k){ st.k = k; s.effects.sparks(sx, sy, 2, { speed: 110, g: 300 }); }
          n += 6;
        }
        return n;
      }, 'back');

      // the second: always on time, it hops clean over the stick
      s.frame(t => {
        const d = s.normA(s.markerTh - st.S), hop = Math.abs(d) < 0.11 && !st.boomed ? Math.cos(d / 0.11 * Math.PI / 2) * 30 : 0;
        const shock = st.boomed ? Math.max(0, 1 - (t - BOOM) / 300) * 4 : 0;
        s.marker({ lift: hop + shock, scale: hop > 4 ? 1.15 : 1 });
        return 1;
      }, 'top');

      // 2. there: he turns to the stick, crouches, lights it
      const after = (dt, fn) => (p, f, sc) => { const go = () => { if (st.arrive == null) return sc.at(sc.t + 60, go); sc.at(Math.max(sc.t, st.arrive + dt), fn); }; go(); };
      at(100, after(0, p => { st.drag = false; p.face = -st.dir; p.eyes(0); }));
      at(100, after(220, p => { p.play('crouch', 320); s.haptic('detent'); }));
      at(100, after(420, (p, f) => { st.lit = s.t; const [x, y] = s.feetAt(st.tnt); f.sparks(x, y - 4, 6, { speed: 140 }); s.haptic('detent'); }));
      at(100, after(700, (p, f) => { p.face = st.dir; f.bang(p, 420); p.play('wide', 300); }));
      // 3. and off he goes, as far as the ring allows
      at(100, after(1000, p => { p.stopPlay(); p.dashTo(st.S + Math.PI, { notice: false, windup: 240, dir: st.dir, done: () => { st.safe = s.t; } }); }));
      // he gets there: he turns round, crouches, hands on his ears, trembling
      s.frame(() => {
        if (st.safe != null && !st.hid){ st.hid = true; P.face = -st.dir; P.play('earsTight'); P.tremble(1.1); P.eyes(0); }
        return 0;
      }, 'back');
      // 4. BOOM
      at(BOOM, (p, f) => {
        st.boomed = true;
        const [x, y] = s.feetAt(st.S, 24);
        f.flash(2); f.fireball(x, y, { R: 56, px: 6 });
        f.debris(x, y, 26, { speed: 420, dir: Math.atan2(233 - y, 233 - x), spread: 3.6 });
        f.smoke(x, y, 8, { spread: 36 }); f.ring(x, y, { R: 110, ms: 420, col: '#ffd23f' });
        s.wave([255, 59, 47], 1); s.haptic('heavy'); s.collapse(3600);
        if (!st.hid){ st.hid = true; P.play('earsTight'); P.tremble(1.1); }
      });
      // the blast reaches him: a jolt, ears still covered
      at(BOOM + 260, p => { p.hop(160); p.wobble(0.2, 500, 40); p.tremble(2.2); });
      at(BOOM + 700, p => p.tremble(1.2));
      // 5–6. hands down, a look at the rubble, the take, and back he goes
      at(BOOM + 1100, p => { p.tremble(0); p.stopPlay(); p.pose('lookdown'); p.lookAt(...s.feetAt(st.S)); });
      at(BOOM + 1300, (p, f) => f.smoke(...s.feetAt(st.S, 10), 4, { spread: 16 }));
      at(BOOM + 1700, p => { p.lookAt(null); p.eyes(0); p.pose('idle'); });
      at(BOOM + 1900, p => p.play('blink', 110));
      at(BOOM + 2150, p => p.play('blink', 110));
      at(BOOM + 2500, p => { p.pose(null); p.walkTo(p.s - st.dir * 0.4, { vmax: 70 }); });
    }
  });
})();
