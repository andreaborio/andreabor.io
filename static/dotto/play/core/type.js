/* Type: the hand-drawn dot font of the big numbers (D, L), the small dot font (SM), and label(): Doto set on a line
   or along an arc, centred on its ink. Port: the dot fonts are bitmaps in flash; Doto is rasterised once with the
   LVGL font converter at the sizes in ui/kit.js (TS). */
'use strict';
/* ---------- the dot font: drawn by hand, single-stroke ---------- */
const D = {
'0':['..###..','.#...#.','#.....#','#.....#','#.....#','#.....#','#.....#','#.....#','#.....#','.#...#.','..###..'],
'1':['...#...','..##...','.#.#...','...#...','...#...','...#...','...#...','...#...','...#...','...#...','.#####.'],
'2':['..###..','.#...#.','#.....#','......#','.....#.','....#..','...#...','..#....','.#.....','#......','#######'],
'3':['#######','.....#.','....#..','...#...','..###..','.....#.','......#','......#','#.....#','.#...#.','..###..'],
'4':['....##.','...#.#.','..#..#.','.#...#.','#....#.','#....#.','#######','.....#.','.....#.','.....#.','.....#.'],
'5':['#######','#......','#......','#.###..','##...#.','......#','......#','......#','#.....#','.#...#.','..###..'],
'6':['...##..','..#....','.#.....','#......','#.###..','##...#.','#.....#','#.....#','#.....#','.#...#.','..###..'],
'7':['#######','......#','.....#.','.....#.','....#..','....#..','...#...','...#...','..#....','..#....','..#....'],
'8':['..###..','.#...#.','#.....#','.#...#.','..###..','.#...#.','#.....#','#.....#','#.....#','.#...#.','..###..'],
'9':['..###..','.#...#.','#.....#','#.....#','#.....#','.#...##','..###.#','......#','.....#.','....#..','..##...'],
',':['..','..','..','..','..','..','..','..','.#','.#','#.'],
'-':['.......','.......','.......','.......','.......','.#####.','.......','.......','.......','.......','.......'],
':':['.','.','.','#','.','.','.','#','.','.','.'],
'%':['.......','##....#','##...#.','.....#.','....#..','...#...','..#....','.#.....','.#...##','#....##','.......'],
' ':['...','...','...','...','...','...','...','...','...','...','...']
};
const L = {
'A':['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
'C':['.###.','#...#','#....','#....','#....','#...#','.###.'],
'D':['####.','#...#','#...#','#...#','#...#','#...#','####.'],
'E':['#####','#....','#....','####.','#....','#....','#####'],
'I':['.###.','..#..','..#..','..#..','..#..','..#..','.###.'],
'J':['..###','...#.','...#.','...#.','#..#.','#..#.','.##..'],
'L':['#....','#....','#....','#....','#....','#....','#####'],
'M':['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
'O':['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
'R':['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
'S':['.####','#....','#....','.###.','....#','....#','####.'],
'T':['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
'U':['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
'V':['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
'N':['#...#','##..#','#.#.#','#.#.#','#..##','#...#','#...#'],
'P':['####.','#...#','#...#','####.','#....','#....','#....'],
'Z':['#####','....#','...#.','..#..','.#...','#....','#####'],
' ':['...','...','...','...','...','...','...']
};
const GC = new Map();
function glyph(font, ch){
  const key = (font === D ? 'd' : 'l') + ch;
  if (GC.has(key)) return GC.get(key);
  const rows = font[ch] || font[' '], cells = [];
  rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') cells.push([c, r]); }));
  const g = { w: rows[0].length, h: rows.length, cells, set: new Set(cells.map(([c, r]) => c + ',' + r)) };
  GC.set(key, g); return g;
}

/* ---------- the small dot font, for everything that is not a number ---------- */
const SM = {
A:['.###.','#...#','#...#','#####','#...#','#...#','#...#'],B:['####.','#...#','#...#','####.','#...#','#...#','####.'],
C:['.###.','#...#','#....','#....','#....','#...#','.###.'],D:['####.','#...#','#...#','#...#','#...#','#...#','####.'],
E:['#####','#....','#....','####.','#....','#....','#####'],F:['#####','#....','#....','####.','#....','#....','#....'],
G:['.###.','#...#','#....','#.###','#...#','#...#','.####'],H:['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
I:['###','.#.','.#.','.#.','.#.','.#.','###'],J:['..###','...#.','...#.','...#.','#..#.','#..#.','.##..'],
K:['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],L:['#....','#....','#....','#....','#....','#....','#####'],
M:['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],N:['#...#','##..#','#.#.#','#.#.#','#..##','#...#','#...#'],
O:['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],P:['####.','#...#','#...#','####.','#....','#....','#....'],
Q:['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],R:['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
S:['.####','#....','#....','.###.','....#','....#','####.'],T:['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
U:['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],V:['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
W:['#...#','#...#','#...#','#.#.#','#.#.#','#.#.#','.#.#.'],X:['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
Y:['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],Z:['#####','....#','...#.','..#..','.#...','#....','#####'],
'0':['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],'1':['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
'2':['.###.','#...#','....#','...#.','..#..','.#...','#####'],'3':['#####','...#.','..#..','...#.','....#','#...#','.###.'],
'4':['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],'5':['#####','#....','####.','....#','....#','#...#','.###.'],
'6':['..##.','.#...','#....','####.','#...#','#...#','.###.'],'7':['#####','....#','...#.','..#..','.#...','.#...','.#...'],
'8':['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],'9':['.###.','#...#','#...#','.####','....#','...#.','.##..'],
'·':['.','.','.','#','.','.','.'],',':['..','..','..','..','..','.#','#.'],':':['.','.','#','.','#','.','.'],'.':['.','.','.','.','.','.','#'],
'%':['##..#','##.#.','...#.','..#..','.#...','.#.##','#..##'],'-':['...','...','...','###','...','...','...'],'/':['....#','...#.','...#.','..#..','.#...','.#...','#....'],
"'":['#','#','.','.','.','.','.'],'°':['###','#.#','###','...','...','...','...'],' ':['..','..','..','..','..','..','..']
};
const ACCENT = { 'À':'A','È':'E','É':'E','Ì':'I','Ò':'O','Ù':'U' };
const SMC = new Map();
function smGlyph(ch){
  ch = ACCENT[ch] || ch; if (!SM[ch]) ch = ' ';
  if (SMC.has(ch)) return SMC.get(ch);
  const rows = SM[ch], cells = [];
  rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') cells.push([c, r]); }));
  const g = { w: rows[0].length, cells }; SMC.set(ch, g); return g;
}
let TYPE = 'mona';
const MONA = "'Doto', ui-monospace, monospace";   // the display's type: Doto, a dot-matrix face, round dots, black (900) (the name stays for history)
// one call for every secondary line: straight, or curved along the top or bottom of the glass
function label(str, o){
  let { y = C, arc = null, R = 150, p = 2.6, col = INK2, a = 1, weight = 500, off = 0, caps = true, track = 0.06, bold = 0 } = o;
  if (a <= 0.01) return { w: 0 };
  str = String(str); if (caps || TYPE === 'dot') str = str.toUpperCase();
  if (TYPE === 'dot'){
    p *= 0.8;
    const gs = [...str].map(smGlyph); let cols = 0; gs.forEach((g, i) => cols += g.w + (i < gs.length - 1 ? 1 : 0));
    const r = p * 0.38; let xc = 0;
    for (const g of gs){
      for (const [c, rr] of g.cells){
        const sAlong = (xc + c - (cols - 1) / 2) * p;
        if (!arc) dot(C + sAlong, y + (rr - 3) * p, r, col, a);
        else if (arc === 'top'){ const an = -Math.PI / 2 + off + sAlong / R, rad = R + (6 - rr) * p; dot(C + Math.cos(an) * rad, C + Math.sin(an) * rad, r, col, a); }
        else { const an = Math.PI / 2 + off - sAlong / R, rad = R - (6 - rr) * p; dot(C + Math.cos(an) * rad, C + Math.sin(an) * rad, r, col, a); }
      }
      xc += g.w + 1;
    }
    return { w: (cols - 1) * p };
  }
  // Doto (round dots), on the same centre lines
  const size = p * 5.2;
  ctx.font = `900 ${size}px ${MONA}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = (size * track) + 'px';
  if (TINT && WAVES.length){ const m = ctx.getTransform(), mx = (arc === 'top' ? C : C), my = arc === 'top' ? C - R : arc === 'bottom' ? C + R : y, wv = waveAt((m.a * mx + m.e) / DPR, (m.d * my + m.f) / DPR); if (wv){ if (wv.dark) a *= 1 - 0.82 * wv.w; else col = tinted(col, wv); } }
  // centred on the cap height (0.7 em in Doto): the alphabetic baseline sits 0.35 em under the centre line
  ctx.fillStyle = col; ctx.globalAlpha = clamp(a, 0, 1); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  // centred on the ink, not on the advance: in a monospace face the dots do not sit in the middle of their cell
  const mt = ctx.measureText(str), W = mt.width, by = size * 0.35, ix = (mt.actualBoundingBoxLeft - mt.actualBoundingBoxRight) / 2;
  // small text gets a thin stroke of its own colour: Doto's dots grow (it is already at its heaviest weight)
  ctx.strokeStyle = col; ctx.lineWidth = size * bold; ctx.lineJoin = 'round';
  if (!arc){ ctx.fillText(str, C + ix, y + by); if (bold) ctx.strokeText(str, C + ix, y + by); }
  else {
    let s0 = -W / 2;
    for (const ch of str){
      const w = ctx.measureText(ch).width, mid = s0 + w / 2;
      const an = arc === 'top' ? -Math.PI / 2 + off + mid / R : Math.PI / 2 + off - mid / R;
      const rad = arc === 'top' ? R + size * 0.42 : R - size * 0.42;
      ctx.save(); ctx.translate(C + Math.cos(an) * rad, C + Math.sin(an) * rad); ctx.rotate(arc === 'top' ? an + Math.PI / 2 : an - Math.PI / 2);
      ctx.fillText(ch, 0, by); if (bold) ctx.strokeText(ch, 0, by); ctx.restore(); s0 += w;
    }
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
  ctx.globalAlpha = 1;
  return { w: W };
}

function labelW(str, p = 2.6, weight = 500, caps = true, track = 0.06){
  str = String(str); if (caps || TYPE === 'dot') str = str.toUpperCase();
  if (TYPE === 'dot'){ const pp = p * 0.8; return ([...str].reduce((w, ch) => w + smGlyph(ch).w + 1, 0) - 2) * pp; }
  const size = p * 5.2; ctx.font = `900 ${size}px ${MONA}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = (size * track) + 'px';
  const w = ctx.measureText(str).width;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
  return w;
}
