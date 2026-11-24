/* The simulator's panel (prototype only): time, modes, scenes, the setup, simulated failures. Not ported. */
'use strict';
/* ---------- panel ---------- */
function setMode(m){ MODE = m; $('mFall').setAttribute('aria-pressed', m === 'fall'); $('mRoll').setAttribute('aria-pressed', m === 'roll'); }
$('bHap').onclick = () => { hapOn = !hapOn; $('bHap').setAttribute('aria-pressed', hapOn); if (hapOn){ unlockAudio(); haptic('confirm'); } };
$('bHours').onclick = () => { st.timeOff += 3 * 3600000; st.nightTest = false; $('tNight').setAttribute('aria-pressed', false); if (st.screen !== 'clock') go('clock'); };
$('bLow').onclick = () => { const low = st.batt >= 0.2; st.batt = low ? 0.14 : 0.82; $('bLow').setAttribute('aria-pressed', low); };
// test buttons: each one sets up the moment and plays it now
function toClock(){ if (st.screen !== 'clock') go('clock'); BR.clock.B.scene = null; }
$('tMinute').onclick = () => {
  toClock(); BR.clock.B.min = null; BR.clock.B.mode = 'life';
  const d = new Date(Date.now() + st.timeOff), cur = d.getSeconds() * 1000 + d.getMilliseconds();
  st.timeOff += (49000 - cur + 60000) % 60000;            // to second 49: he runs, waits on the battery, then the minute
  BR.clock.B.nextScene = clock + 20000;
};
$('tChase').onclick = () => {
  toClock(); BR.clock.B.min = null;
  if (new Date(Date.now() + st.timeOff).getSeconds() >= PRE_S - 6) st.timeOff -= 15000;
  BR.clock.forceChase(secAng(new Date(Date.now() + st.timeOff).getSeconds()) - 2.2);
  BR.clock.B.nextScene = clock + 20000;
};
$('tCollapse').onclick = () => { toClock(); COLLAPSE.t0 = clock; COLLAPSE.dur = 3600; haptic('heavy'); };
$('tPet').onclick = () => { toClock(); st.petT = clock; BR.clock.pet(clock); haptic('soft'); };
// night: two in the morning, and back to the real time
$('tNight').onclick = () => {
  const on = !st.nightTest; st.nightTest = on;
  if (on){ const d = new Date(Date.now() + st.timeOff), t = new Date(d); t.setHours(2); st.timeOff += t - d; } else st.timeOff = 0;
  $('tNight').setAttribute('aria-pressed', on); toClock();
};
function buildSceneButtons(){
  const box = $('sceneBtns'); box.innerHTML = '';
  for (const sc of window.PIP_SCENES){ const b = document.createElement('button'); b.className = 'b'; b.textContent = sc.name; b.onclick = () => { toClock(); BR.clock.B.min = null; const d = new Date(Date.now() + st.timeOff); if (d.getSeconds() >= 40) st.timeOff -= 25000; BR.clock.playScene(sc.id, clock); }; box.appendChild(b); }
  if (!window.PIP_SCENES.length) box.innerHTML = '<p class="note">Nessuna scena caricata.</p>';
}
addEventListener('load', buildSceneButtons);
function setType(t){ TYPE = t; $('tDot').setAttribute('aria-pressed', t === 'dot'); $('tMona').setAttribute('aria-pressed', t === 'mona'); }
$('tDot').onclick = () => setType('dot');
$('tMona').onclick = () => setType('mona');
$('mFall').onclick = () => setMode('fall');
$('mRoll').onclick = () => setMode('roll');
$('bBack').onclick = back;
// the side button: a short press goes back, a long one (≥ 0.6 s) goes to the clock
{ let t0 = 0; const sb = $('side');
  sb.addEventListener('pointerdown', e => { e.preventDefault(); t0 = performance.now(); });
  sb.addEventListener('pointerup', () => { if (!t0) return; const held = performance.now() - t0; t0 = 0; if (held > 600){ haptic('confirm'); if (st.screen !== 'clock') go('clock'); } else back(); });
  sb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ back(); e.preventDefault(); } }); }
$('bMenu').onclick = () => { st.scroll = st.scrollT = 0; go('menu'); };
$('bClock').onclick = () => go('clock');
$('bUp').onclick = () => step(-1);
$('bDown').onclick = () => step(1);
$('bMin').onclick = () => { st.timeOff += 60000; if (st.screen !== 'clock') go('clock'); };
$('bPre').onclick = () => { setCdj(true); jumpBar(22); if (st.screen !== 'dj') go('dj'); };
function setCdj(v){ st.cdj = v; $('bCdj').setAttribute('aria-pressed', v); }
$('bCdj').onclick = () => setCdj(!st.cdj);
$('bpm').oninput = e => { setBpm(parseFloat(e.target.value)); $('bpmOut').value = fmt1(beat.bpm); };
$('bReal').onclick = () => { const on = !document.body.classList.contains('real'); document.body.classList.toggle('real', on); $('bReal').setAttribute('aria-pressed', on); };
$('bCrt').onclick = () => { CRT.on = !CRT.on; $('bCrt').setAttribute('aria-pressed', CRT.on); if (!CRT.on) document.body.classList.remove('crt'); };
$('bDepth').onclick = () => { DEPTH.on = !DEPTH.on; $('bDepth').setAttribute('aria-pressed', DEPTH.on); };
$('bSlow').onclick = () => { slow = !slow; $('bSlow').setAttribute('aria-pressed', slow); };

/* ---------- panel: the first setup ---------- */
const SU_STEPS = [['birth', 'Nascita'], ['wifi', 'WiFi'], ['time', 'Ora'], ['lights', 'Luci'], ['rooms', 'Stanze'], ['spotify', 'Spotify'], ['gestures', 'Gesti'], ['done', 'Fine']];
function startSetup(step, only){ st.suReturn = only ? st.screen : null; st.scroll = st.scrollT = 0; SU.start(step, { only: !!only }); if (st.screen !== 'setup') go('setup'); else st.tScreen = clock; }
$('suStart').onclick = () => startSetup('birth');
$('suExit').onclick = () => { if (st.screen === 'setup') go('clock'); };
for (const [id, name] of SU_STEPS.slice(1)){ const b = document.createElement('button'); b.className = 'b'; b.textContent = name; b.onclick = () => startSetup(id); $('suSteps').appendChild(b); }
$('suPhone').onclick = () => SU.phone();
$('suBridge').onclick = () => SU.bridge();
// flip: silence. It stops the timer alarm first; otherwise it pauses the music (and in the setup it is the last gesture)
function flip(){ DEV.shakeT = performance.now(); DEV.shakeK = 0.3; if (TM.flip()) return; SU.flip(); MU.pause(); }
$('suFlip').onclick = flip;
$('bFlip').onclick = flip;
const togg = (id, key, on) => { $(id).onclick = () => { st[key] = !st[key]; $(id).setAttribute('aria-pressed', st[key]); if (on) on(st[key]); }; };
togg('bCharge', 'charging', v => { if (v){ haptic('confirm'); wave([123, 224, 162], 0.7); if (st.screen === 'clock'){ st.petT = clock; BR.clock.pet(clock); } } });
togg('bSync', 'noSync');
togg('bAod', 'aod', v => { if (v && st.screen !== 'clock') go('clock'); });
$('bCrit').onclick = () => { const v = st.batt >= 0.05; st.batt = v ? 0.04 : 0.82; $('bCrit').setAttribute('aria-pressed', v); $('bLow').setAttribute('aria-pressed', false); };
$('bMoved').onclick = () => { st.moved = true; haptic('soft'); if (st.screen === 'lights') askRoom(); };
$('bTmMin').onclick = () => TM.skip(60000);
$('bTmEnd').onclick = () => TM.skip(TM.T.left - 4000);
$('bSilent').onclick = () => { const v = !MU.M.silent; MU.setSilent(v); $('bSilent').setAttribute('aria-pressed', v); };
for (const [id, key] of [['simWifi', 'wifiFail'], ['simBridge', 'bridgeOff'], ['simGovee', 'goveeOff'], ['simLamp', 'deadLamp'], ['simSilent', 'silent']])
  $(id).onclick = () => { SU.SIM[key] = !SU.SIM[key]; $(id).setAttribute('aria-pressed', SU.SIM[key]); };
