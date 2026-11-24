/* Input: the touch screen (taps, swipes, scroll, the touch bezel), keys and the wheel for the desktop. Port: the
   CST9217 touch through LVGL's indev; the gestures are the same thresholds in px. */
'use strict';
// every screen is a function (alpha, now, beat) → dots drawn
const SCREENS = { clock: scrClock, menu: scrMenu, dj: scrDJ, lights: scrLights, setup: (a, now) => SU.run(a, now, st.lastDt || 16), music: (a, now) => MU.run(a, now, st.lastDt || 16), timer: (a, now) => TM.run(a, now, st.lastDt || 16), settings: (a, now) => SETT.run(a, now, st.lastDt || 16) };

/* ---------- input ---------- */
let ptr = null, snapAt = 0;
// the menu moves in detents (core/snap.js): st.scroll is where it is, st.scrollT where it is going
const MSNAP = makeSnap(st, 'scroll', 'scrollT', () => MENU.length);
function loc(e){ const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * S / r.width, y: (e.clientY - r.top) * S / r.height }; }
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const p = loc(e); DEPTH.touch(p.x, p.y, clock); ptr = { x0: p.x, y0: p.y, s0: st.scroll, mode: null, r0: Math.hypot(p.x - C, p.y - C) }; if (st.screen === 'settings') SETT.down(p, clock); });
cv.addEventListener('pointermove', e => {
  if (!ptr) return;
  const p = loc(e), dx = p.x - ptr.x0, dy = p.y - ptr.y0;
  if (!ptr.mode && Math.hypot(dx, dy) > 7){
    if (st.screen === 'lights' && ptr.r0 > 160 && ptr.y0 < C + 60){ ptr.mode = 'rooms'; ptr.a0 = Math.atan2(ptr.y0 - C, ptr.x0 - C); ptr.z0 = st.zoneF; snapGrab(ZSNAP); }
    else if (st.screen === 'lights' && !st.asking && ptr.r0 > 160 && ptr.y0 > C + 100){ ptr.mode = 'scenes'; ptr.a0 = Math.atan2(ptr.y0 - C, ptr.x0 - C); ptr.s0 = st.sceneF; snapGrab(SSNAP); }
    else if (st.screen === 'lights' && Math.abs(dy) > Math.abs(dx)){ ptr.mode = 'level'; ptr.b0 = ZONES[st.zone].b; }
    else if (st.screen === 'music' && MU.grab({ x: ptr.x0, y: ptr.y0 })) ptr.mode = 'music';
    else if (bezelOn() && ptr.r0 > 165){ ptr.mode = 'bezel'; ptr.ba = Math.atan2(ptr.y0 - C, ptr.x0 - C); ptr.acc = 0; }
    else ptr.mode = st.screen === 'menu' && Math.abs(dy) > Math.abs(dx) ? (snapGrab(MSNAP), 'scroll') : (st.screen === 'setup' || (st.screen === 'music' && MU.picking()) || (st.screen === 'settings' && SETT.drumming())) && Math.abs(dy) > Math.abs(dx) ? 'drum' : 'swipe';
  }
  if (ptr.mode === 'scenes'){
    const SA = sceneAngles(), d = normA(Math.atan2(p.y - C, p.x - C) - ptr.a0), was = Math.round(st.sceneF);
    snapDrag(SSNAP, roomIndex(SA, roomAt(SA, ptr.s0) + d) - ptr.s0, performance.now());
    if (Math.round(st.sceneF) !== was) haptic('detent');
  }
  if (ptr.mode === 'rooms'){
    // the ring follows the finger; a detent at every room
    const RA = roomAngles(), d = normA(Math.atan2(p.y - C, p.x - C) - ptr.a0), was = Math.round(st.zoneF);
    snapDrag(ZSNAP, roomIndex(RA, roomAt(RA, ptr.z0) - d) - ptr.z0, performance.now());
    if (Math.round(st.zoneF) !== was) haptic('detent');
  }
  if (ptr.mode === 'level'){
    // up is brighter: the whole height of the glass is 0–100%
    const nb = clamp(Math.round(ptr.b0 - dy / 2.6), 0, 100), z = ZONES[st.zone];
    if (Math.floor(nb / 5) !== Math.floor(z.b / 5)) haptic('detent');
    if (nb !== z.b) setBright(nb); else st.levelT = clock;
  }
  if (ptr.mode === 'music') MU.drag(p);
  if (ptr.mode === 'bezel'){
    const an = Math.atan2(p.y - C, p.x - C); ptr.acc += normA(an - ptr.ba); ptr.ba = an;
    const k = Math.trunc(ptr.acc / BEZEL_STEP); if (k){ ptr.acc -= k * BEZEL_STEP; step(bezelDir() * k); }
  }
  if (ptr.mode === 'drum'){ const k = Math.trunc((dy - (ptr.dyUsed || 0)) / 34); if (k){ ptr.dyUsed = (ptr.dyUsed || 0) + k * 34; step(-k); } }
  if (ptr.mode === 'scroll') snapDrag(MSNAP, -dy / 88, performance.now());           // 88 px of finger = one app
});
// the end of a gesture, in one place: released (a tap or a swipe may fire) or cancelled by the system (nothing fires);
// either way every ring and drum snaps to the nearest choice and nothing stays half-held
function endGesture(p, cancelled){
  SETT.up();
  if (!ptr) return;
  const dx = p ? p.x - ptr.x0 : 0, dy = p ? p.y - ptr.y0 : 0;
  if (!cancelled && !ptr.mode) tap(p);
  else if (!cancelled && ptr.mode === 'swipe' && dx > 80 && Math.abs(dy) < 90) back();
  else if (ptr.mode === 'rooms') selectZone(snapRelease(ZSNAP, performance.now()));
  else if (ptr.mode === 'scenes') setScene(snapRelease(SSNAP, performance.now()));
  else if (ptr.mode === 'music') MU.release();
  else if (ptr.mode === 'scroll') snapRelease(MSNAP, performance.now());
  ptr = null;
}
cv.addEventListener('pointerup', e => endGesture(loc(e), false));
cv.addEventListener('pointercancel', () => endGesture(null, true));
cv.addEventListener('lostpointercapture', () => { if (ptr) endGesture(null, true); });
cv.addEventListener('wheel', e => { if (['setup', 'music', 'lights', 'timer', 'settings'].includes(st.screen)){ e.preventDefault(); step(Math.sign(e.deltaY)); return; } if (st.screen !== 'menu') return; e.preventDefault(); step(Math.sign(e.deltaY)); }, { passive: false });
cv.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown'){ step(1); e.preventDefault(); }
  else if (e.key === 'ArrowUp'){ step(-1); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' '){ tap({ x: C, y: C }); e.preventDefault(); }
  else if (e.key === 'Escape' || e.key === 'Backspace'){ back(); e.preventDefault(); }
});
function step(d){
  if (st.screen === 'setup'){ SU.rotate(d); return; }
  if (st.screen === 'menu') snapStep(MSNAP, d);
  else if (st.screen === 'music') MU.rotate(d);
  else if (st.screen === 'timer') TM.rotate(d);
  else if (st.screen === 'settings') SETT.rotate(d);
  else if (st.screen === 'lights'){
    setBright(clamp(ZONES[st.zone].b - d * 5, 0, 100)); haptic('detent');
  }
}
/* the touch bezel: a finger sliding along the rim (the outer 7 mm) works like the ring of a thermostat. One detent every
   ~9° (3 mm of finger travel). Clockwise = the next item in a list, or more of a value. It replaces rotating the object */
const BEZEL_STEP = 0.16;
const bezelOn = () => ['menu', 'timer', 'settings', 'setup'].includes(st.screen) || (st.screen === 'music' && MU.picking());
const bezelDir = () => st.screen === 'timer' || (st.screen === 'settings' && !SETT.drumming()) ? -1 : 1;
function tap(p){
  if (st.screen === 'setup'){ SU.tap(p); return; }
  if (st.screen === 'timer'){ TM.tap(p, clock); return; }
  if (st.screen === 'settings'){ SETT.tap(p, clock); return; }
  if (st.screen === 'dj'){ if (KIT.hit(DJK, p, clock) === 'sync'){ st.lightSync = !st.lightSync; haptic('confirm'); wave(st.lightSync ? RED : null, 0.8, !st.lightSync); KIT.toast(DJK, st.lightSync ? 'Le luci seguono il beat' : 'Luci di nuovo normali', clock); } return; }
  if (st.screen === 'clock' && st.aod){ st.aod = false; $('bAod').setAttribute('aria-pressed', false); haptic('soft'); return; }
  if (st.screen === 'clock'){ const h = HOME_HIT.find(q => Math.abs(p.y - q.y) < 17 && p.x > q.x0 && p.x < q.x1); if (h){ haptic('confirm'); wave(h.go === 'timer' ? [255, 211, 92] : MU.accent(), 0.7); go(h.go); return; } }
  if (st.screen === 'clock'){
    const pc = BR.clock.center();
    if (Math.hypot(p.x - pc[0], p.y - pc[1]) < 36){ st.petT = clock; BR.clock.pet(clock); haptic('soft'); return; }
    haptic('confirm'); st.scroll = st.scrollT = 0; go('menu'); return;
  }
  if (st.screen === 'menu'){
    const i = clamp(Math.round(st.scroll), 0, MENU.length - 1);
    if (p.y < C - 140 || p.y > C + 125){ step(p.y > C ? 1 : -1); return; }
    const m = MENU[i];
    if (m.off){ haptic('soft'); toast(m.id === 'home' || m.id === 'timer' ? 'Presto' : 'Non in questo prototipo'); return; }
    haptic('confirm'); wave(APP_HUE[m.id], 1); go(m.id); return;
  }
  if (st.screen === 'music'){ MU.tap(p, clock); return; }
  if (st.screen === 'lights'){
    if (st.asking){
      const act0 = KIT.hit(LK, p, clock);
      if (act0 === 'stay'){ st.asking = false; selectZone(SET.room); st.lightsT0 = clock; return; }
      if (act0 === 'here'){ st.asking = false; selectZone(Math.round(st.zoneT)); if (!ZONES[st.zone].all){ SET.room = st.zone; KIT.toast(LK, `Ora Dotto sta in ${ZONES[st.zone].n.toLowerCase()}`, clock); } st.lightsT0 = clock; return; }
    }
    // a name on the ring: spin it there
    if (Math.hypot(p.x - C, p.y - C) > 160 && p.y < C + 60){ const RA = roomAngles(), want = roomAt(RA, st.zoneF) + normA(Math.atan2(p.y - C, p.x - C) + Math.PI / 2); let bi = 0; RA.forEach((v, i) => { if (Math.abs(v - want) < Math.abs(RA[bi] - want)) bi = i; }); selectZone(bi); return; }
    // a scene
    if (!st.asking && Math.hypot(p.x - C, p.y - C) > 160 && p.y > C + 100){ const SA = sceneAngles(), want = roomAt(SA, st.sceneF) - normA(Math.atan2(p.y - C, p.x - C) - Math.PI / 2); let bi = 0; SA.forEach((v, i) => { if (Math.abs(v - want) < Math.abs(SA[bi] - want)) bi = i; }); setScene(bi); return; }
    if (Math.abs(p.y - KIT.Y.hero) < 70 && Math.abs(p.x - C) < 120){
      haptic('confirm');
      setScene(st.scene === 3 ? (st.lastScene || 0) : 3);
    }
  }
}
