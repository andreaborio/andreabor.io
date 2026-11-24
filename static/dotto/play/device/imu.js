/* The IMU and the case (prototype: simulated with a tilt pad, a yaw dial, shakes). Port: the QMI8658's gravity,
   low-passed, gives pitch and roll; shakes are peaks on the accelerometer. */
'use strict';
/* ---------- the IMU, simulated: tilt pad, yaw dial, a hand, shakes ---------- */
const imu = { pitch: 0, roll: 0, yaw: 0, yawV: 0, padP: 0, padR: 0, hand: false, tilt: null };
const DEV = { jx: 0, jy: 0, jUntil: 0, shakeT: -1e9, shakeK: 0, rot: 0 };
let suAcc = 0;                                   // the yaw dial's leftover, in detents
let padDrag = false, dialDrag = false, dialA = 0, dialT = 0, yawAcc = 0, yawSnap = 0;
function stepIMU(dt){
  const s = dt / 1000, rt = performance.now();
  if (imu.tilt){
    // "Inclina": hard over for two seconds, then let go
    const t = rt - imu.tilt.t0;
    if (t < 2000){ imu.padR = imu.tilt.dir * 28 * sstep(0, 180, t); imu.padP = 0; }
    else imu.tilt = null;
    drawPad();
  } else if (!padDrag && (imu.padP || imu.padR)){
    // let go of the pad: it eases back to flat
    const k = Math.exp(-s * 4); imu.padP *= k; imu.padR *= k;
    if (Math.abs(imu.padP) < 0.05 && Math.abs(imu.padR) < 0.05) imu.padP = imu.padR = 0;
    drawPad();
  }
  let p = imu.padP, r = imu.padR;
  if (PHONE.seen){
    // the phone's own tilt, from wherever it is held: the baseline follows the hand in ~3 s, so only movement counts
    const kb = 1 - Math.exp(-s / 3);
    PHONE.p0 += (PHONE.p - PHONE.p0) * kb; PHONE.r0 += (PHONE.r - PHONE.r0) * kb;
    p += clamp(PHONE.p - PHONE.p0, -40, 40); r += clamp(PHONE.r - PHONE.r0, -40, 40);
  }
  if (imu.hand){ const t = rt / 1000; p += Math.sin(t * 0.7) * 2.2 + Math.sin(t * 1.9 + 1) * 0.8; r += Math.sin(t * 0.55 + 2) * 2.6 + Math.sin(t * 2.3) * 0.7; }
  imu.pitch += (p - imu.pitch) * (1 - Math.exp(-s * 8));
  imu.roll += (r - imu.roll) * (1 - Math.exp(-s * 8));
  // gravity on the glass: roll turns it sideways, pitch makes it lighter or heavier
  const rr = imu.roll * Math.PI / 180, pp = imu.pitch * Math.PI / 180;
  PE.setGravity(Math.sin(rr) * 1.25, Math.cos(rr) + Math.sin(pp) * 0.8);
  // the dial spins on with friction when you let it go
  if (!dialDrag){ imu.yawV *= Math.exp(-s * 1.6); if (Math.abs(imu.yawV) < 2) imu.yawV = 0; applyYaw(imu.yawV * s); }
  if (Math.abs(imu.yawV) > 140) BR.spin(st.screen, imu.yawV);
  if (!dialDrag) DEV.rot *= Math.exp(-s * 2.5);                    // the case follows the dial a little, then settles back
  if (yawSnap && rt > yawSnap && !dialDrag && Math.abs(imu.yawV) < 40){ yawSnap = 0; if (st.screen === 'menu') st.scrollT = clamp(Math.round(st.scroll), 0, MENU.length - 1); }
  const txt = `Pitch ${Math.round(imu.pitch)}° · roll ${Math.round(imu.roll)}° · yaw ${Math.round(((imu.yaw % 360) + 540) % 360 - 180)}°`;
  if ($('imuOut').textContent !== txt) $('imuOut').textContent = txt;
  const vt = Math.abs(imu.padP) + Math.abs(imu.padR) < 1 ? 'piatto' : `pitch ${Math.round(imu.padP)}°, roll ${Math.round(imu.padR)}°`;
  if (vt !== stepIMU.vt){ stepIMU.vt = vt; pad.setAttribute('aria-valuetext', vt); }
}
function applyYaw(deg){
  if (!deg) return;
  imu.yaw += deg; DEV.rot = clamp(DEV.rot + deg * 0.12, -14, 14);
  $('dialMark').style.transform = `rotate(${imu.yaw}deg)`;
  if (st.screen === 'menu'){ st.scroll = clamp(st.scroll + deg / 32, -0.3, MENU.length - 0.7); st.scrollT = st.scroll; MSNAP.v = 0; yawSnap = performance.now() + 260; }
  else if (['setup', 'music', 'timer', 'settings'].includes(st.screen)){ suAcc += deg / 16; const k = Math.trunc(suAcc); if (k){ suAcc -= k; step(k); } }
  else if (st.screen === 'lights'){
    const z = ZONES[st.zone]; yawAcc += deg / 2.4; const k = Math.trunc(yawAcc);
    if (k){ yawAcc -= k; const nb = clamp(z.b + k, 0, 100); if (nb !== z.b){ setBright(nb); haptic('detent'); } }
  }
}
function applyDevice(){
  const el = $('device'), t = performance.now(); let x = 0, y = 0;
  if (t < DEV.jUntil){ x += DEV.jx; y += DEV.jy; }
  const sk = t - DEV.shakeT;
  if (sk < 460 && !RM){ const k = DEV.shakeK * (1 - sk / 460); x += Math.sin(sk / 17) * 7 * k; y += Math.cos(sk / 23) * 4 * k; }
  const tr = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${DEV.rot.toFixed(2)}deg)`;
  if (el.style.transform !== tr) el.style.transform = tr;
}
function doShake(k){ DEV.shakeT = performance.now(); DEV.shakeK = k; haptic(k >= 1 ? 'heavy' : 'confirm'); BR.shake(st.screen, k); }
function doTilt(dir){ imu.tilt = { dir, t0: performance.now() }; }
const pad = $('pad'), padDot = $('padDot');
function padSet(e){
  const r = pad.getBoundingClientRect();
  const x = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), y = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
  imu.padR = x * 30; imu.padP = y * 30; imu.tilt = null; drawPad();
}
function drawPad(){ padDot.style.left = `${50 + imu.padR / 30 * 42}%`; padDot.style.top = `${50 + imu.padP / 30 * 42}%`; }
pad.addEventListener('pointerdown', e => { padDrag = true; pad.setPointerCapture(e.pointerId); padSet(e); });
pad.addEventListener('pointermove', e => { if (padDrag) padSet(e); });
pad.addEventListener('pointerup', () => { padDrag = false; });
pad.addEventListener('pointercancel', () => { padDrag = false; });
pad.addEventListener('keydown', e => {
  const k = { ArrowLeft: [0, -3], ArrowRight: [0, 3], ArrowUp: [-3, 0], ArrowDown: [3, 0] }[e.key];
  if (k){ padDrag = true; imu.padP = clamp(imu.padP + k[0], -30, 30); imu.padR = clamp(imu.padR + k[1], -30, 30); drawPad(); e.preventDefault(); }
  if (e.key === '0'){ imu.padP = imu.padR = 0; drawPad(); }
});
pad.addEventListener('keyup', () => { padDrag = false; });
pad.addEventListener('blur', () => { padDrag = false; });
const dial = $('dial');
function dialAngle(e){ const r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; }
dial.addEventListener('pointerdown', e => { dialDrag = true; dial.setPointerCapture(e.pointerId); dialA = dialAngle(e); dialT = performance.now(); imu.yawV = 0; });
dial.addEventListener('pointermove', e => {
  if (!dialDrag) return;
  const an = dialAngle(e); let d = an - dialA; if (d > 180) d -= 360; if (d < -180) d += 360;
  const t = performance.now(), dts = Math.max(1, t - dialT) / 1000;
  imu.yawV = lerp(imu.yawV, d / dts, 0.5); dialA = an; dialT = t; applyYaw(d);
});
dial.addEventListener('pointerup', () => { dialDrag = false; });
dial.addEventListener('pointercancel', () => { dialDrag = false; });
dial.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp'){ applyYaw(8); e.preventDefault(); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown'){ applyYaw(-8); e.preventDefault(); } });
new ResizeObserver(() => dial.style.setProperty('--r', dial.clientWidth / 2 + 'px')).observe(dial);
$('bHand').onclick = () => { imu.hand = !imu.hand; $('bHand').setAttribute('aria-pressed', imu.hand); };
$('bShake').onclick = () => doShake(0.5);
$('bShakeHard').onclick = () => doShake(1);
$('bTiltL').onclick = () => doTilt(-1);
$('bTiltR').onclick = () => doTilt(1);

/* ---------- the phone as Dotto (prototype): its gyroscope tilts the picture and Dotto's gravity, a shake of the
   phone shakes him. iOS asks for permission on a tap; Android gives it on https. Inside a frame the page that hosts
   it must allow the sensors, otherwise no data arrives and the button says so. ---------- */
const PHONE = { on: false, seen: false, p: 0, r: 0, p0: 0, r0: 0, jerkT: 0 };
// beta: front–back, gamma: left–right, in the phone's portrait frame; turned with the screen in landscape
function phoneAxes(e){
  const ang = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) % 360;
  const b = e.beta || 0, g = e.gamma || 0;
  if (ang === 90) return [-g, b];
  if (ang === 270 || ang === -90) return [g, -b];
  if (ang === 180) return [-b, -g];
  return [b, g];
}
function onOrient(e){
  if (e.beta == null) return;
  const [p, r] = phoneAxes(e); PHONE.p = p; PHONE.r = r;
  if (!PHONE.seen){ PHONE.seen = true; PHONE.p0 = p; PHONE.r0 = r; gyroLabel('Giroscopio attivo', true); }
}
function onMotion(e){
  const q = e.acceleration; if (!q || q.x == null) return;
  const m = Math.hypot(q.x, q.y, q.z), t = performance.now();
  if (t - PHONE.jerkT < 800) return;
  if (m > 22){ PHONE.jerkT = t; doShake(1); } else if (m > 13){ PHONE.jerkT = t; doShake(0.5); }
}
function gyroLabel(t, on){ const b = $('bGyro'); b.textContent = t; b.setAttribute('aria-pressed', on); }
async function phoneOn(){
  if (PHONE.on){
    PHONE.on = PHONE.seen = false; removeEventListener('deviceorientation', onOrient); removeEventListener('devicemotion', onMotion);
    gyroLabel('Usa il giroscopio', false); return;
  }
  if (typeof DeviceOrientationEvent === 'undefined'){ gyroLabel('Niente giroscopio qui', false); return; }
  // iOS needs the permission (asked on this tap); other browsers may answer "prompt" and still send data: listen anyway
  let perm = 'granted';
  try { if (DeviceOrientationEvent.requestPermission) perm = await DeviceOrientationEvent.requestPermission(); } catch (err){ perm = 'denied'; }
  try { if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) await DeviceMotionEvent.requestPermission(); } catch (err){ /* shakes stay off */ }
  PHONE.on = true; addEventListener('deviceorientation', onOrient); addEventListener('devicemotion', onMotion);
  gyroLabel('Inclina il telefono…', true);
  setTimeout(() => { if (PHONE.on && !PHONE.seen) gyroLabel(perm === 'denied' ? 'Permesso negato' : 'Nessun dato: apri la pagina da sola', false); }, 2500);
}
$('bGyro').onclick = phoneOn;
