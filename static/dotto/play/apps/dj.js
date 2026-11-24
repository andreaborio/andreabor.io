/* DJ: the BPM, the track's structure on the rim, the drop; without CDJs, a plain screen that says so. */
'use strict';
function scrDJ(a, now, b){
  if (!st.cdj) return scrDJOff(a, now);
  const build = b.sec.name === 'Build', drop = b.sec.name === 'Drop', tension = build ? b.prog : 0;
  const since = now - st.dropAt, flash = RM ? 0 : clamp(1 - since / 260, 0, 1);
  let n = 0;
  // rim: 32 dots = 8 bars of 4 beats; in the build a red roll that speeds up; in the drop every kick bursts
  const N = 32, cur = Math.floor(b.p) % N, rate = build ? (b.toEnd > 16 ? 1 : b.toEnd > 8 ? 2 : 4) : 1;
  const chase = Math.floor(b.p * rate) % N, kick = drop ? Math.exp(-b.frac * 5) : 0;
  for (let i = 0; i < N; i++){
    const ang = -Math.PI / 2 + i / N * TAU, x = C + Math.cos(ang) * 206, y = C + Math.sin(ang) * 206;
    let lvl, col = W, rr = i % 4 === 0 ? 3.4 : 2.6;
    if (build){
      const back = (chase - i + N) % N;
      lvl = back === 0 ? 1 : back < 6 * rate ? Math.pow(0.66, back / rate) * 0.85 : 0.1;
      col = mixc(W, RED, sstep(0.15, 0.85, tension));
      if (b.toEnd <= 1) lvl = 0.08;
    } else if (drop){
      const dist = Math.min((i - cur + N) % N, (cur - i + N) % N);
      lvl = Math.max(0.16, kick * Math.exp(-dist * 0.32));
      col = mixc(RED, W, clamp(kick * Math.exp(-dist * 0.32) * 1.3, 0, 1));
    } else lvl = i === cur ? 1 : i < cur ? 0.36 : 0.12;
    if (flash > 0){ lvl = Math.max(lvl, flash); col = mixc(col, W, flash); }
    dot(x, y, rr * (i === cur && !build ? 1.25 : 1), rgb(col), a * lvl); n++;
  }
  const secCol = drop ? rgb(RED) : tension > 0.05 ? rgb(mixc(W, RED, sstep(0.2, 1, tension))) : INK;
  const countdown = build && b.next != null && b.next <= 8;
  let body;
  if (countdown){
    setText(T.count, String(Math.ceil(b.next)), now);
    n += drawText(T.count, D, C, KIT.Y.hero, 11, 4, rgb(RED), now, { alpha: a, doSnap: false, depth: true });
    body = 'beat al drop';
  } else {
    setText(T.bpm, fmt1(beat.bpm), now);
    n += drawText(T.bpm, D, C, KIT.Y.hero, P, 3.3, drop && flash > 0 ? rgb(mixc(W, RED, flash)) : INK, now, { alpha: a, depth: true });
    body = drop ? `Drop · ${Math.ceil(b.toEnd / 4)} bar` : b.next != null ? `${Math.ceil(b.next / 4)} bar al drop` : 'Fine del pezzo';
  }
  DJK.titleT0 = st.tScreen;
  KIT.compose(DJK, { title: b.sec.name, titleCol: secCol, body, bodyCol: countdown ? rgb(RED) : null, caption: 'Solar Tape · 8A', pills: [djPill()] }, a, 9999, now);
  // Pip dances: a bounce on every beat; in the build he trembles; at the drop he jumps with his arms up
  n += BR.dj.run(a, now, st.lastDt || 16, b);
  return n;
}

// no CDJ on the network: say so plainly, and Pip waits with his headphones on
const DJK = KIT.screen();
const djPill = () => ({ t: 'Luci a tempo', main: !!st.lightSync, act: 'sync' });
function scrDJOff(a, now){
  let n = 0;
  for (let i = 0; i < 32; i++){
    const ang = -Math.PI / 2 + i / 32 * TAU;
    dot(C + Math.cos(ang) * 206, C + Math.sin(ang) * 206, i % 4 === 0 ? 3 : 2.3, INK, a * 0.12); n++;
  }
  setText(T.bpm, '---,-', now);
  n += drawText(T.bpm, D, C, KIT.Y.hero, P, 3.3, INK2, now, { alpha: a * 0.35 });
  DJK.titleT0 = st.tScreen;
  KIT.compose(DJK, { title: 'DJ', body: 'CDJ non collegati', caption: 'Stessa rete di Dotto', pills: [djPill()] }, a, now - st.tScreen, now);
  n += BR.dj.run(a, now, st.lastDt || 16, info());
  return n;
}
