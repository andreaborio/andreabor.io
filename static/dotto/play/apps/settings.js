/* Opzioni (CONTENT.md "Impostazioni"): a drum of items; each one opens one screen with one value or one action.
   Same template as every screen (ui/kit.js). Long things (names, scene colours, night hours in detail) live on
   dotto.local; here there is a QR to get there.

   Items: Schermo, Suoni, Vibrazione, Notte, Stanza, WiFi, Spotify, Luci, Pagina web, Versione, Ripristina.
   The values are real in the prototype: the host reads SET (brightness of the glass, volume of the ticks, strength of
   the haptics, night hours for Dotto, the room Luci opens on, Spotify linked or not).
   On the device: SET lives in NVS; dotto.local reads and writes the same keys. */
(function(global){
'use strict';
function create(H){
  const { C, INK, INK2, dot, haptic, wave, E, K } = H;
  const { clamp, sstep } = E;
  const TAU = Math.PI * 2, A0 = 0.75 * Math.PI, SPAN = 1.5 * Math.PI;
  const W = E.world('settings'), pip = W.spawn({ p: H.PIP_P || 5, r: 2.2 });
  const scr = K.screen(), Y = K.Y, VT = H.makeText();
  const SET = { bright: 100, sound: 40, mute: false, vib: 70, nightFrom: 23, nightTo: 7, room: 3, wifi: 'Casa', spotify: true, version: '0.1.0' };
  const rooms = () => H.ZONES.filter(z => !z.all);
  const ITEMS = [
    { id: 'screen', w: 'Schermo', sum: () => `Luminosità ${SET.bright}%`, wear: ['sun'] },
    { id: 'sound', w: 'Suoni', sum: () => SET.mute ? 'Muti' : `Volume ${SET.sound}%`, wear: ['phones'] },
    { id: 'vib', w: 'Vibrazione', sum: () => SET.vib ? `Intensità ${SET.vib}%` : 'Spenta' },
    { id: 'night', w: 'Notte', sum: () => `Dalle ${SET.nightFrom} alle ${SET.nightTo}`, wear: ['nightcap'] },
    { id: 'room', w: 'Stanza', sum: () => `Dotto sta in ${rooms()[SET.room].n}`, wear: ['bulb'] },
    { id: 'wifi', w: 'WiFi', sum: () => `Rete ${SET.wifi}` },
    { id: 'spotify', w: 'Spotify', sum: () => SET.spotify ? 'Collegato' : 'Non collegato', wear: ['phones'] },
    { id: 'lights', w: 'Luci', sum: () => '7 luci in 4 stanze', wear: ['bulb'] },
    { id: 'page', w: 'Pagina web', sum: () => 'dotto.local', wear: ['glasses'] },
    { id: 'version', w: 'Versione', sum: () => `${SET.version}, aggiornato`, wear: ['glasses'] },
    { id: 'reset', w: 'Ripristina', sum: () => 'Torna come nuovo' }
  ];
  const S = { lvl: 1, sel: 0, selF: 0, item: null, t0: 0, now: 0, nightSel: 'from', roomSel: 0, roomF: 0, checkT: -1e9, hold: null, holdT: 0, resetT: 0, init: false, vibT: 0 };

  /* ---------- small heroes ---------- */
  function dial(a, f){ K.arc({ f, a }); }
  function wifiSign(cx, cy, a){
    for (let k = 1; k <= 3; k++){ const R = k * 15, m = 3 + k * 2; for (let j = 0; j < m; j++){ const an = -Math.PI / 2 + (j / (m - 1) - 0.5) * 1.6; dot(cx + Math.cos(an) * R, cy + 18 + Math.sin(an) * R, 2, INK, a); } }
    dot(cx, cy + 18, 3, INK, a);
  }
  function ringOf(cx, cy, R, n, f, a){ for (let i = 0; i < n; i++){ const an = -Math.PI / 2 + i / n * TAU; dot(cx + Math.cos(an) * R, cy + Math.sin(an) * R, i / n < f ? 2.6 : 1.7, INK, a * (i / n < f ? 1 : 0.25)); } }
  function value(a, now, v, unit = '%'){ H.setText(VT, `${v}${unit}`, now); return H.drawText(VT, H.D, C, Y.hero, 9, 3.3, INK, now, { alpha: a, depth: true, ink: true }); }

  function geometry(){ W.ring('rim', { cx: C, cy: C, R: H.RF, ceil: false }); W.seg('stage', { x: C, y: Y.stage, hl: 70 }); }

  function run(a, now, dt){
    S.now = now;
    W.begin(now); geometry();
    if (!S.init){ S.init = true; pip.place('stage', 0); }
    if (pip.ready() && (!pip.surf || pip.surf.id !== 'stage')) pip.jumpTo({ surf: 'stage', s: 0 });
    const el = now - S.t0, calm = pip.ready() && !pip.cmd;
    let n = 0, pose = null, wear = [];
    const L = { title: 'Opzioni', pills: null };

    if (S.lvl === 1){
      S.selF += (S.sel - S.selF) * (1 - Math.exp(-dt / 70));
      n += K.drum(ITEMS.map(i => i.w), S.selF, a);
      const it = ITEMS[Math.round(S.selF)] || ITEMS[0];
      L.caption = it.sum(); wear = it.wear || [];
      pose = calm ? (Math.abs(S.sel - S.selF) > 0.06 ? (S.sel > S.selF ? 'lookdown' : 'lookup') : E.blink(now) ? 'blink' : null) : null;
    } else {
      const it = S.item; L.title = it.w; wear = it.wear || [];
      switch (it.id){
        case 'screen': dial(a, (SET.bright - 20) / 80); n += value(a, now, SET.bright); L.body = 'Luminosità'; L.caption = 'Gira il bordo'; break;
        case 'sound':
          dial(a, SET.mute ? 0 : SET.sound / 100); n += value(a * (SET.mute ? 0.4 : 1), now, SET.sound);
          L.body = SET.mute ? 'Muti' : 'Volume'; L.caption = 'Tick, passi, sveglia'; L.pills = [K.OUT(SET.mute ? 'Riattiva' : 'Muto', 'mute')]; break;
        case 'vib':
          dial(a, SET.vib / 100); n += value(a, now, SET.vib); L.body = SET.vib ? 'Intensità' : 'Spenta'; L.caption = 'Gira il bordo';
          if (now - S.vibT < 300) pip.offset((Math.random() - 0.5) * SET.vib / 25, 0); else pip.offset(0, 0);
          break;
        case 'night': {
          const h = S.nightSel === 'from' ? SET.nightFrom : SET.nightTo;
          n += value(a, now, String(h).padStart(2, '0') + ':00', '');
          L.body = S.nightSel === 'from' ? 'Inizio della notte' : 'Fine della notte'; L.caption = `Dalle ${SET.nightFrom} alle ${SET.nightTo}`;
          L.pills = [{ t: 'Inizio', main: S.nightSel === 'from', act: 'from' }, { t: 'Fine', main: S.nightSel === 'to', act: 'to' }];
          pose = 'sleep'; if (now % 900 < dt) W.fx.zee(pip, 0); break;
        }
        case 'room':
          S.roomF += (S.roomSel - S.roomF) * (1 - Math.exp(-dt / 70));
          n += K.drum(rooms().map(z => z.n), S.roomF, a, i => i === SET.room ? null : null);
          L.body = 'Dove sta Dotto?'; L.caption = 'Luci si apre qui'; break;
        case 'wifi': wifiSign(C, Y.hero - 18, a); L.body = SET.wifi; L.caption = 'Segnale buono'; L.pills = [K.GO('Cambia rete', 'wifi')]; pose = calm ? 'lookup' : null; break;
        case 'spotify':
          ringOf(C, Y.hero, 34, 20, SET.spotify ? 1 : 0, a);
          L.body = SET.spotify ? 'Collegato' : 'Non collegato'; L.caption = SET.spotify ? 'Account Premium' : 'Serve Spotify Premium';
          L.pills = [SET.spotify ? K.OUT('Scollega', 'unlink') : K.GO('Collega', 'link')]; break;
        case 'lights': {
          H.setText(VT, '7', now); n += H.drawText(VT, H.D, C, Y.hero, 9, 3.3, INK, now, { alpha: a, depth: true });
          L.body = 'Luci in 4 stanze'; L.caption = 'Hue 3, WiZ 2, Govee 2'; L.pills = [K.OUT('Cerca nuove', 'scan'), K.GO('Stanze', 'rooms')]; break;
        }
        case 'page': n += K.qr('http://dotto.local', C, Y.hero, 4.1, a, el); L.body = 'Inquadra il QR'; L.caption = 'dotto.local'; break;
        case 'version': {
          const t = now - S.checkT, checking = t < 1600;
          if (checking) K.spinner(C, Y.hero, a, now); else K.word(SET.version, C, Y.hero, K.HERO_P, INK, a);
          L.body = checking ? 'Controllo' : 'Aggiornato'; L.caption = checking ? 'Un attimo' : t < 6000 ? "È l'ultima versione" : 'Si aggiorna di notte';
          L.pills = checking ? null : [K.OUT('Controlla', 'check')]; break;
        }
        case 'reset': {
          const hp = S.hold === 'reset' ? clamp((now - S.holdT) / 3000, 0, 1) : 0;
          ringOf(C, Y.hero, 40, 30, hp, a);
          L.body = S.resetT ? 'Ciao' : 'Ripristina'; L.caption = S.resetT ? 'Si riparte da capo' : 'Cancella tutto';
          L.pills = S.resetT ? null : [{ t: 'Tieni premuto', main: true, act: 'reset', prog: hp }];
          pose = calm ? (hp > 0 ? 'sad' : 'idle') : null;
          if (hp > 0 && Math.floor(now / 500) !== Math.floor((now - dt) / 500)){ W.fx.sweat(pip, 1); haptic('detent'); }
          if (hp >= 1 && !S.resetT){ S.resetT = now; S.hold = null; haptic('heavy'); wave(null, 1, true); pip.play('sad', 1500); setTimeout(() => { S.resetT = 0; if (H.reset) H.reset(); }, 1500); }
          break;
        }
      }
    }
    // Dotto lives the value you are changing: sunglasses when it is bright, a yawn when it is dim, hands on his ears when
    // it is loud, a little dance at a normal volume, asleep when muted, pacing up and down while it checks for updates
    if (S.lvl === 2 && calm && !pose){
      const id = S.item.id;
      if (id === 'screen'){ wear = SET.bright >= 85 ? ['sun'] : []; if (SET.bright <= 35) pose = (now % 3000) < 900 ? 'yawn' : 'sitblink'; }
      else if (id === 'sound'){ if (SET.mute) pose = 'sleep'; else if (SET.sound >= 80) pose = 'ears'; else if (now - (S.turnT || -1e9) < 900 && Math.floor(now / 260) !== Math.floor((now - dt) / 260)) pip.hop(110); }
      else if (id === 'version' && now - S.checkT < 1600){ pip.walkTo(pip.s > 0 ? -40 : 40, { vmax: 120 }); }
    }
    pip.pose(pose); pip.wear(...wear);
    scr.titleT0 = S.t0 - (S.lvl === 1 ? 0 : 300);
    K.compose(scr, L, a, el, now);
    W.step(dt, now);
    n += W.draw(a, now);
    n += W.drawFront(a);
    return n;
  }

  function open(it){ S.item = it; S.lvl = 2; S.t0 = S.now; haptic('confirm'); if (it.id === 'room'){ S.roomSel = S.roomF = SET.room; } H.resetText(VT, S.now); }
  const API = {
    W, pip, SET, S, ITEMS, scr, run,
    enter(now){ S.lvl = 1; S.t0 = now; },
    drumming: () => S.lvl === 1 || (S.item && S.item.id === 'room'),
    tap(p, now){
      if (S.lvl === 1){ open(ITEMS[clamp(Math.round(S.sel), 0, ITEMS.length - 1)]); return; }
      const act = K.hit(scr, p, now), id = S.item.id;
      if (id === 'sound' && act === 'mute'){ SET.mute = !SET.mute; haptic('confirm'); return; }
      if (id === 'night' && (act === 'from' || act === 'to')){ S.nightSel = act; H.resetText(VT, now); haptic('soft'); return; }
      if (id === 'room'){ SET.room = clamp(Math.round(S.roomSel), 0, rooms().length - 1); haptic('confirm'); K.toast(scr, `Dotto sta in ${rooms()[SET.room].n.toLowerCase()}`, now); if (H.roomChanged) H.roomChanged(); S.lvl = 1; S.t0 = now; return; }
      if (id === 'wifi' && act === 'wifi'){ H.setupStep('wifi'); return; }
      if (id === 'spotify' && act === 'unlink'){ SET.spotify = false; haptic('confirm'); wave(null, 0.5, true); return; }
      if (id === 'spotify' && act === 'link'){ SET.spotify = true; H.setupStep('spotify'); return; }
      if (id === 'lights' && act === 'scan'){ H.setupStep('lights'); return; }
      if (id === 'lights' && act === 'rooms'){ H.setupStep('rooms'); return; }
      if (id === 'version' && act === 'check'){ S.checkT = now; haptic('soft'); return; }
      haptic('soft');
    },
    rotate(d){
      if (S.lvl === 1){ const ns = clamp(S.sel + d, 0, ITEMS.length - 1); if (ns !== S.sel){ S.sel = ns; haptic('detent'); } return; }
      const id = S.item.id;
      if (id === 'screen'){ SET.bright = clamp(SET.bright - d * 5, 20, 100); haptic('detent'); }
      else if (id === 'sound'){ SET.mute = false; SET.sound = clamp(SET.sound - d * 10, 0, 100); S.turnT = S.now; haptic('detent'); }
      else if (id === 'vib'){ SET.vib = clamp(SET.vib - d * 10, 0, 100); S.vibT = S.now; haptic('confirm'); }
      else if (id === 'night'){ const k = S.nightSel === 'from' ? 'nightFrom' : 'nightTo'; SET[k] = (SET[k] - d + 24) % 24; haptic('detent'); }
      else if (id === 'room'){ const ns = clamp(S.roomSel + d, 0, rooms().length - 1); if (ns !== S.roomSel){ S.roomSel = ns; haptic('detent'); } }
    },
    back(){ if (S.lvl === 2){ S.lvl = 1; S.t0 = S.now; haptic('soft'); return true; } return false; },
    // press and hold (Ripristina): the host tells when a finger goes down on a pill and when it lifts
    down(p, now){ if (S.lvl === 2 && S.item.id === 'reset'){ const b = scr.pills.find(q => p.x >= q.x0 && p.x <= q.x1 && p.y >= q.y0 && p.y <= q.y1); if (b && b.act === 'reset'){ S.hold = 'reset'; S.holdT = now; } } },
    up(){ S.hold = null; },
    isNight(h){ const a = SET.nightFrom, b = SET.nightTo; return a > b ? (h >= a || h < b) : (h >= a && h < b); }
  };
  return API;
}
global.DottoSettings = { create };
})(window);
