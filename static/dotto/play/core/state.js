/* State: rooms, scenes, menu, the shared state (st), the animated text slots, navigation (go / back / toast).
   Port: one struct in RAM, saved to NVS where it says so in CONTENT.md. */
'use strict';
/* ---------- state ---------- */
const ZONES = [{ n: 'Sala', b: 64, lamps: 2 }, { n: 'Cucina', b: 80, lamps: 1 }, { n: 'Camera', b: 22, lamps: 1 }, { n: 'Studio', b: 40, lamps: 3 }, { n: 'Tutta casa', b: 50, lamps: 7, all: true }];
const DOTTO_ROOM = 3;                              // the room Dotto lives in (Opzioni): Luci opens here
const SCENES = ['Chill', 'Party', 'Focus', 'Spente'];
const MENU = [
  { id: 'lights', w: 'LUCI', sub: () => st.lightSync && st.cdj ? `${ZONES[st.zone].n} · a tempo` : st.scene === 3 ? `${ZONES[st.zone].n} · spente` : `${ZONES[st.zone].n} · ${ZONES[st.zone].b}% · ${SCENES[st.scene]}` },
  { id: 'music', w: 'MUSICA', sub: () => MU.sub() },
  { id: 'timer', w: 'TIMER', sub: () => TM.sub() },
  { id: 'settings', w: 'OPZIONI', sub: () => '' },
  { id: 'dj', w: 'DJ', sub: () => st.cdj ? `${fmt1(beat.bpm)} BPM · deck 2` : 'CDJ non collegati' }
];
const st = { petT: -1e9, petPos: [C, C], moodNudge: 0, life: null, batt: 0.82, cdj: false, lastTime: null, minFall: -1e9, secPos: null, fallFrom: null, screen: 'clock', prev: null, tScreen: -1e9, scroll: 0, scrollT: 0, zone: DOTTO_ROOM, scene: 0, lastScene: 0, zoneF: DOTTO_ROOM, zoneT: DOTTO_ROOM, sceneF: 0, levelT: -1e9, asking: false, lightsT0: 0, timeOff: 0, toast: '', toastT: -1e9, lastSec: null, dropAt: -1e9 };
const T = { time: makeText(), bpm: makeText(), count: makeText(), pct: makeText(), words: MENU.map(() => makeText()) };
function go(s){
  if (st.screen === s) return;
  st.prev = st.screen; st.screen = s; st.tScreen = clock;
  if (s === 'menu'){ MENU.forEach((m, i) => { setText(T.words[i], m.w, clock); resetText(T.words[i], clock + 120); }); BR.menu.enter(); }
  if (s === 'clock') resetText(T.time, clock);
  if (s === 'dj') resetText(T.bpm, clock + 80);
  if (st.prev === 'lights') st.lightsLeftT = clock;
  if (s === 'lights'){
    resetText(T.pct, clock + 80); st.lightsT0 = clock; st.asking = false;
    if (clock - (st.lightsLeftT || -1e9) > 60000) setZone(SET.room);
    st.zoneF = st.zoneT = st.zone; st.levelT = clock;
    if (st.moved) askRoom();
  }
  if (s === 'timer') TM.enter(clock);
  if (s === 'settings') SETT.enter(clock);
  if (s === 'music') MU.enter(clock);
}
function back(){ if (st.screen === 'setup'){ SU.swipe(); return; } if (st.screen === 'music' && MU.back()) return; if (st.screen === 'settings' && SETT.back()) return; if (st.screen !== 'clock') haptic('soft'); if (st.screen === 'menu') go('clock'); else if (st.screen !== 'clock') go('menu'); }
function toast(s){ st.toast = s; st.toastT = clock; }
