/* Wiring: the screen kit and the apps, each made from its own file, given only what it needs. */
'use strict';
/* ---------- the screen kit (ui/kit.js): one template for the setup and every app ---------- */
const KIT = DottoKit.create({ C, INK, INK2, E: PE, ctx, dot, label, labelW, rgb, smGlyph, depth: DEPTH });
/* ---------- the first setup, led by Dotto (setup/onboarding.js) ---------- */
const SU = DottoSetup.create({
  K: KIT, C, RF, INK, INK2, E: PE, ctx, dot, label, labelW, haptic, wave, rgb, mixc, st, smGlyph, D, makeText, setText, drawText,
  house: t => { $('suHouse').textContent = t; },
  exit: () => go(st.suReturn || 'clock'),
  finish: th => { go('clock'); BR.clock.forceChase(th); BR.clock.B.nextScene = clock + 30000; }
});
BR.setup = SU;
/* ---------- Musica (apps/music.js) ---------- */
const MU = DottoMusic.create({ depth: DEPTH, C, RF, INK, INK2, E: PE, K: KIT, ctx, dot, haptic, wave, rgb, makeText, setText, resetText, drawText, D,
  linked: () => SET.spotify, link: () => { SET.spotify = true; startSetup('spotify', true); } });
/* ---------- Timer (apps/timer.js) and Opzioni (apps/settings.js) ---------- */
const TM = DottoTimer.create({ C, RF, INK, INK2, E: PE, K: KIT, ctx, dot, haptic, wave, rgb, makeText, setText, resetText, drawText, D,
  onRing: () => { if (st.screen !== 'timer' && st.screen !== 'setup') go('timer'); } });
const SETT = DottoSettings.create({ C, RF, INK, INK2, E: PE, K: KIT, ctx, dot, haptic, wave, rgb, makeText, setText, resetText, drawText, D, ZONES,
  setupStep: step => startSetup(step, true), reset: () => startSetup('birth'), roomChanged: () => { setZone(SET.room); } });
const SET = SETT.SET;
window.DOTTO_OPT = SETT;
BR.timer = TM; BR.settings = SETT;
BR.music = MU;
