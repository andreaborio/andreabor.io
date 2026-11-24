/* Scene: "Il retino" — the model for every other scene, on the Pip Engine (scenes v2).
   Pip runs ahead of the second, waits with a net, swings as it arrives: the second hops over the net and goes on.

   A scene is { id, name, dur, script(s) }. script(s) runs ONCE, at the start, and fills a timeline.
   Pip is the real Pip, with his physics: you give him commands, the engine moves and animates him
   (acceleration, braking, anticipation, landing squash, dust, blinking all come for free).

   The timeline
     s.at(ms, action)          action is a deferred command, or a function (pip, fx, s) => {} run at that moment
     s.during(t0, t1, fn)      fn(f, t, s) every frame between t0 and t1, f from 0 to 1 (props)
     s.frame(fn, layer)        fn(t, s) every frame; layer 'back' (behind Pip), 'front' (over him), 'top' (over the FX)
     s.end()                   finish now (otherwise the scene ends at dur)
   Deferred commands (for s.at)
     s.pip.runTo(th) walkTo dashTo(th, {dir, notice, windup}) jumpTo({surf: 'rim', s: th}) hop(v) fall() sit() sleep()
           pose(name) play(name, ms) stopPlay() eyes(dx) lookAt(x, y) wear(skin) tremble(k) wobble(amp, ms) stun(ms)
           shakeOff() say('!' | 'sweat' | 'hearts' | 'stars' | 'zee') place('rim', th) idle()
     s.fx.puff(n) dustAt(x, y, n) sparks(x, y, n) debris(x, y, n, o) smoke(x, y, n) soot(x, y, n) flash(frames)
          fireball(x, y, {R, px}) ring(x, y) stars() hearts() sweat() bang()
   Live objects (inside functions): s.body is Pip (s.body.s is his angle on the rim, s.body.face +1 clockwise),
     s.effects is the FX pool (same methods as s.fx, called now)
   The world
     s.t ms since the start · s.dur · s.markerTh the angle of the second now · s.secAng(i)
     s.feetAt(th, h) a point on the rim floor (h px towards the centre) · s.up(th) · s.tangent(th) · s.ceilingAt(th)
     s.marker({lift, scale, al}) draw the second (always on time) · s.prop(rows, x, y, {p, rot, anchor}) props in dots
     s.sprite(rows, x, y, {px, palette, rot, anchor, mirror}) props in real pixels · s.dot · s.line
     s.haptic('detent'|'soft'|'confirm'|'heavy') · s.wave(rgb, strength, dark) · s.collapse(ms)
     s.state a scratch object · s.lerp clamp sstep normA hash
   Pip's poses: idle idle2 blink crouch land stretch fall dash run1..run4 sit sitblink yawn sleep dizzy lookup lookdown
     talk tap arms ball wide ears earsTight hang hang2 climb1 climb2 pull */
(function(){
  const NET = [
    '..ggggg..',
    '.g.g.g.g.',
    'g.g.g.g.g',
    '.g.g.g.g.',
    '..ggggg..',
    '....#....',
    '....#....',
    '....#....',
    '....#....'
  ];
  const SWING = 2700, OMEGA = Math.PI * 2 / 60000;           // the second moves 6° a second
  window.PIP_SCENES.push({
    id: 'retino', name: 'Il retino', dur: 5400,
    script(s){
      const { at, pip } = s, st = s.state;
      st.spot = s.markerTh + (SWING + 200) * OMEGA;              // the second will be there just after the swing starts
      st.net = 0;                                                // where the net is: 0 up, 1 swung down
      // he hurries ahead of it, then turns to face it, net up, a sly blink
      at(0, pip.runTo(st.spot, { vmax: 420 }));
      at(1000, p => { p.face = -1; p.eyes(1); });
      at(1600, pip.play('blink', 120));
      // the swing: a crouch, the net comes down
      at(SWING, (p) => { p.play('crouch', 260); s.haptic('detent'); });
      // the take: he looks into the empty net, then at us
      at(SWING + 260, (p) => { p.pose('lookdown'); s.haptic('soft'); });
      at(3900, p => { p.pose(null); p.eyes(0); });
      at(4100, pip.play('blink', 120));
      at(4700, p => { p.face = 1; p.runTo(st.spot + 0.18, { vmax: 160 }); });
      s.frame(t => {
        const f = s.sstep(SWING, SWING + 260, t), P = s.body, [ux, uy] = s.up(P.s), r = s.lerp(46, 14, f);
        if (t < 900) return 0;
        return s.prop(NET, P.x + ux * r, P.y + uy * r, { rot: P.s + Math.PI / 2 - s.lerp(0.5, -1.4, f), anchor: 'c' });
      }, 'front');
      // the second: on time, but it hops clean over the net as it goes by
      s.frame(t => {
        const d = s.normA(s.markerTh - st.spot), hop = Math.abs(d) < 0.09 && t > SWING - 300 ? Math.cos(d / 0.09 * Math.PI / 2) * 36 : 0;
        s.marker({ lift: hop, scale: hop > 4 ? 1.15 : 1 });
        return 1;
      }, 'top');
    }
  });
})();
