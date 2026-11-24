/* Haptics: simulated in the browser (a click, a jolt of the case, a light in the panel). Port: the speaker's short
   clicks through I2S (the board has no motor): same names, same strengths. */
'use strict';
/* ---------- haptics (simulated: a short click, a tiny jolt of the case, a light in the panel) ---------- */
let actx = null, hapOn = true, hapLast = 0;
function unlockAudio(){ if (!actx){ try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e){ actx = null; } } if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); }
addEventListener('pointerdown', unlockAudio, { capture: true });
addEventListener('keydown', unlockAudio, { capture: true });
const HAP = { detent: { f: 2400, d: 0.012, g: 0.16, jolt: 0.6, name: 'scatto' }, soft: { f: 900, d: 0.03, g: 0.09, jolt: 0.4, name: 'tocco' },
              confirm: { f: 1500, d: 0.022, g: 0.22, jolt: 1, name: 'conferma' }, heavy: { f: 140, d: 0.16, g: 0.5, jolt: 2.4, name: 'colpo' } };
function haptic(kind){
  const h = HAP[kind], t = performance.now();
  if (!h || t - hapLast < 28) return; hapLast = t;
  const dotEl = document.getElementById('hapDot'), txt = document.getElementById('hapTxt');
  if (dotEl){ dotEl.classList.add('on'); setTimeout(() => dotEl.classList.remove('on'), 90); txt.textContent = h.name; }
  const O = window.DOTTO_OPT, vib = O ? O.SET.vib / 100 : 1;
  if (!RM && vib > 0){ const j = h.jolt * vib; DEV.jx = (Math.random() - 0.5) * j; DEV.jy = j * 0.5; DEV.jUntil = performance.now() + (kind === 'heavy' ? 120 : 50); }
  const vol = !O ? 1 : (O.SET.mute ? 0 : O.SET.sound / 40) * (O.isNight(new Date(Date.now() + st.timeOff).getHours()) ? 0 : 1);
  if (!hapOn || !actx || vol <= 0) return;
  const now = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = kind === 'heavy' ? 'sine' : 'triangle'; o.frequency.setValueAtTime(h.f, now);
  if (kind === 'heavy') o.frequency.exponentialRampToValueAtTime(55, now + h.d);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, h.g * Math.min(2.5, vol)), now + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, now + h.d);
  o.connect(g).connect(actx.destination); o.start(now); o.stop(now + h.d + 0.02);
}
