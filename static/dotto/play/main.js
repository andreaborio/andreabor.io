/* The loop: one frame = services ticked, background, the screen (cross-fading from the previous one), the toast, the
   CRT pass. Port: the LVGL UI task at 30 fps; Timer and Music keep ticking whatever is on screen. */
'use strict';
// the colour of each screen: secondary text, labels and grey pills take it (no grey anywhere)
function accentOf(s){
  if (s === 'lights') return SCENE_HUE[st.scene] || [150, 165, 230];
  if (s === 'music') return MU.accent();
  if (s === 'timer') return [255, 211, 92];
  if (s === 'settings') return [123, 224, 162];
  if (s === 'setup') return [140, 205, 255];
  if (s === 'dj') return RED;
  if (s === 'menu') return APP_HUE[MENU[clamp(Math.round(st.scroll), 0, MENU.length - 1)].id] || [255, 214, 170];
  const th = MU.theme(); return th ? th.dom : [255, 214, 170];
}
function frame(real){
  const rdt = Math.min(50, real - (frame.t || real)); frame.t = real;
  const dt = rdt * (slow ? 0.25 : 1);
  clock += dt;
  const now = clock, b = info();
  st.lastDt = dt;
  stepIMU(dt);
  DEPTH.step(dt, imu.roll, imu.pitch, real);
  TM.tick(dt);
  MU.tick();
  if (imu.hand && st.aod){ st.aod = false; $('bAod').setAttribute('aria-pressed', false); }
  // the panel's brightness (Opzioni, always-on): on the device it is the AMOLED's own brightness register
  { const f = `brightness(${(SET.bright / 100 * (st.aod ? 0.4 : 1)).toFixed(2)})`; if (cv.style.filter !== f){ cv.style.filter = f; crtCv.style.filter = f; } }
  if (b.sec.name === 'Drop' && st.lastSec && st.lastSec !== 'Drop'){ st.dropAt = now; if (st.screen === 'dj' && st.cdj) haptic('heavy'); }
  st.lastSec = b.sec.name;
  snapTick(MSNAP, dt);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  ctx.save(); ctx.beginPath(); ctx.arc(C, C, C, 0, TAU); ctx.clip();
  DEPTH.push(DEPTH.P.back);
  ctx.drawImage(ghost, 0, 0, S, S);
  // the living background (ui/depth.js), then the colour waves crossing it
  const acc = accentOf(st.screen);
  if (!st.aod) DEPTH.field(dot, 1, now, { P, col: rgb(vivid(acc)), head: rgb(mixc(W, acc, 0.25)), glass: 190 });
  drawWaves(now);
  DEPTH.pop();
  KIT.setAccent(acc);
  TINT = true;
  const t = RM ? 1 : clamp((now - st.tScreen) / 200, 0, 1);
  if (t < 1 && st.prev) SCREENS[st.prev](1 - t, now, b);
  SCREENS[st.screen](RM ? 1 : sstep(0.3, 1, t), now, b);
  if (st.life && (frame.n = (frame.n || 0) + 1) % 20 === 0){
    const L0 = st.life, what = L0.move === 'scene' && L0.scene ? `è in scena (${L0.scene})` : STATE_IT[L0.move] || STATE_IT.idle;
    const txt = L0.mood === 'dorme' ? `Dorme, con il ${SKIN[L0.skin].n} (${L0.why}).` : `Umore ${L0.mood}, adesso ${what}. Skin: ${SKIN[L0.skin].n}, perché ${L0.why}.`;
    const el = $('lifeOut'); if (el.textContent !== txt) el.textContent = txt;
  }
  TINT = false;
  const te = now - st.toastT;
  if (te < 1400) label(st.toast, { arc: 'bottom', R: 150, p: 26 / 5.2, bold: 0.03, col: INK2, a: te < 1100 ? 1 : 1 - (te - 1100) / 300 });
  ctx.restore();
  if (CRT.on) crtGL(now);
  applyDevice();
  requestAnimationFrame(frame);
}
window.__puck = { DEPTH, homeRows: () => HOME_HIT.slice(), go, back: () => back(), SU, MU, TM, SETT, SET, DJK, flip, KIT, LK, ZONES, startSetup, selectZone, scenePoint: i => { const SA = sceneAngles(), an = Math.PI / 2 - (SA[i] - roomAt(SA, st.sceneF)), R = KIT.R_TITLE + 18; return [C + Math.cos(an) * R, C + Math.sin(an) * R]; }, tap: p => tap(p), jumpBar, setMode, st, step, setType: t => setType(t), collapse: () => { COLLAPSE.t0 = clock; }, playScene: id => { go('clock'); BR.clock.B.min = null; return BR.clock.playScene(id, clock); }, BR, PE, imu, PCT, shake: k => doShake(k), tilt: dir => doTilt(dir), clock: () => clock };
fit();
if (location.hash === '#setup') startSetup('birth');
const start = () => requestAnimationFrame(frame);
if (document.fonts && document.fonts.load) Promise.all(["400 16px Geist", "500 16px Geist", "900 22px 'Doto'"].map(f => document.fonts.load(f))).then(start, start); else start();
