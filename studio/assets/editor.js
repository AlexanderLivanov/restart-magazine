/* newmagazine/studio/assets/editor.js
   Редактор выпуска. Модель: выпуск → полосы → блоки (координаты в мм своей полосы).
   На столе — разворот (1 или 2 полосы) в ОДНОМ стеке слоёв: порядок по z общий для разворота,
   ровно как в экспорте. Разметку блоков и полос строит общий рендерер assets/render.js. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const R = window.MagRender;
const BOOT = JSON.parse($('#boot').textContent);
const PW = 210, PH = 297, MARGIN = 15;
const {FONTS, SHAPES, esc, num} = R;

/* ================= справочники ================= */
const SHAPE_NAMES = {rect:'Прямоугольник',circle:'Круг / овал',arch:'Арка',slant:'Срез',diamond:'Ромб',hex:'Шестигранник',star:'Звезда',ticket:'Билет'};
const KIND_NAMES = {cover:'Обложка', page:'Полоса', back:'Задняя обложка'};
const ACCENT = '#c32178';
const STIFF = [['auto','Авто'],['thin','Газетный'],['soft','Мягкий'],['stiff','Плотный'],['hard','Твёрдый']];
const MATERIALS = [
  ['auto','Авто','обложки глянцевые, полосы офсетные'],
  ['offset','Офсет','тёплая, с волокном'],
  ['white','Белая','мелованная, лёгкий сатин'],
  ['gloss','Глянец','лак и блик'],
  ['matte','Мат','мягкая, без блеска'],
  ['news','Газетная','серая, растр на фото'],
  ['holo','Голограмма','радужная плёнка'],
  ['foil','Фольга','металлизированная']
];
const FONT_CATS = {
  'Playfair Display':'антиква, журнальная', 'Yeseva One':'дисплейная антиква', 'Cormorant Garamond':'гарнитура, книжная',
  'Literata':'книжная, для текста', 'PT Serif':'антиква, для текста', 'Unbounded':'широкий гротеск', 'Oswald':'узкий гротеск',
  'Onest':'гротеск, интерфейсный', 'Manrope':'геометрический гротеск', 'Rubik Mono One':'моноширинный дисплей', 'IBM Plex Mono':'моноширинный'
};

const TYPES = {
  heading:{name:'Заголовок',w:170,h:40,ic:'H'}, lead:{name:'Лид',w:170,h:24,ic:'L'}, body:{name:'Текст',w:170,h:120,ic:'¶'},
  author:{name:'Автор',w:120,h:6,ic:'@'}, rubric:{name:'Рубрика',w:44,h:7,ic:'#'}, quote:{name:'Цитата',w:80,h:50,ic:'«'},
  caption:{name:'Подпись',w:80,h:10,ic:'c'}, masthead:{name:'Логотип',w:180,h:40,ic:'M'}, issue:{name:'Номер',w:80,h:6,ic:'№'},
  coverline:{name:'Анонс',w:70,h:26,ic:'A'}, badge:{name:'Плашка',w:32,h:32,ic:'◉'}, image:{name:'Картинка',w:90,h:110,ic:'▣'},
  shape:{name:'Фигура',w:40,h:40,ic:'●'}, rule:{name:'Линейка',w:80,h:0.6,ic:'—'}, barcode:{name:'Штрихкод',w:36,h:22,ic:'|'},
  game:{name:'Игра',w:120,h:80,ic:'▶'}
};
Object.keys(TYPES).forEach(t => TYPES[t].fam = R.FAMS[t]);

const TXT = {
  rubric:'Инди · репортаж',
  heading:'Пиксели на краю карты',
  lead:'Как студия из двух человек в Костроме выпустила игру, о которой спорят сильнее, чем о релизах больших издателей.',
  author:'Текст — Мария Ветрова · Иллюстрации — студия «Полынь»',
  body:[
    'Кострома, девять вечера. В бывшей мастерской по ремонту часов горят два монитора и настольная лампа с зелёным абажуром. Здесь работает «Полынь» — студия из двух человек, чья первая игра за месяц собрала больше отзывов, чем иные проекты больших издателей.',
    '«Мы начинали без плана и без денег, — рассказывает художница Вера Лапина. — Был ноутбук и тетрадь, куда мы рисовали карту. Карта получилась больше, чем игра, и в какой-то момент мы решили: пусть игра станет картой».',
    '«Северная тропа» — неторопливое путешествие по краю мира, собранное из тридцати восьми цветов. Палитру ограничили сознательно: каждый новый оттенок нужно было заслужить. Так появился закатный розовый, которого больше нет нигде в игре, кроме последней сцены.',
    'Код пишет Илья Сомов, днём — инженер на заводе. Движок он собрал сам, потому что готовые казались ему «слишком шумными». Вечерами он переписывает систему погоды, а по выходным отвечает игрокам в сообществе — каждому лично.',
    'Главная проблема маленькой студии — не деньги и не время, а тишина. Никто не видит игру, пока она не вышла, и никто не скажет, что уровень скучный. «Полынь» решила это просто: каждую пятницу выкладывала сборку для двадцати подписчиков и читала каждый отзыв вслух.',
    'Сейчас студия работает над продолжением. Карта снова нарисована в тетради, только тетрадей теперь три. И лампа всё та же — зелёная.'
  ].join('\n'),
  quote:'Мы выкладывали сборку каждую пятницу и читали каждый отзыв вслух. Это и был наш издатель.',
  caption:'Кадр из «Северной тропы». 38 цветов в палитре — ни одного лишнего.',
  masthead:'DUSTORE', issue:'№ 01 · Осень 2026',
  coverline:'Пиксели на краю карты\nКак студия из Костромы выпустила игру, о которой спорят все',
  badge:'Новый\nвыпуск'
};

function defaults(type) {
  const box = {bgOn:false,bg:'#ffffff',pad:0,radius:0,shape:'rect',bw:0,bc:'#111111',opacity:1,blend:'normal',
    r1:-1,r2:-1,r3:-1,r4:-1,rx:0,ry:0,persp:600,q:[0,0,0,0,0,0,0,0],lift:0,pop:false,holo:'none',holoA:.6,reveal:'none',revR:35,peel:false};
  const txt = {font:'Onest',size:10,weight:400,italic:false,upper:false,align:'left',valign:'top',lh:1.3,ls:0,color:'#141414',
    tfx:'none',tfxD:6,tfxA:45,tfxC:'#000000',bend:0};
  const m = {
    heading:{font:'Playfair Display',size:44,weight:900,lh:1,ls:-0.01},
    lead:{font:'Literata',size:12,italic:true,lh:1.35,color:'#222222'},
    body:{font:'Literata',size:9,lh:1.45,align:'justify',cols:2,gap:6,dropcap:true,indent:true,dc:ACCENT},
    author:{size:7.5,weight:600,upper:true,ls:0.08,color:'#6b6b6b'},
    rubric:{font:'IBM Plex Mono',size:7,weight:500,upper:true,ls:0.14,color:'#ffffff',bgOn:true,bg:ACCENT,pad:1.6,align:'center',valign:'middle',lh:1},
    quote:{font:'Playfair Display',size:17,italic:true,lh:1.2,dc:ACCENT,marks:true},
    caption:{font:'IBM Plex Mono',size:6.5,lh:1.4,color:'#555555'},
    masthead:{font:'Unbounded',size:78,weight:900,upper:true,ls:-0.04,lh:0.9},
    issue:{font:'IBM Plex Mono',size:8,weight:500,upper:true,ls:0.12},
    coverline:{size:10,lh:1.25,dc:ACCENT},
    badge:{font:'Oswald',size:13,weight:600,upper:true,lh:1,align:'center',valign:'middle',color:'#ffffff',bgOn:true,bg:ACCENT,shape:'circle'},
    image:{src:'',fit:'cover',fx:50,fy:50,zoom:1,gray:0,contrast:1,tintOn:false,tint:ACCENT,tintA:0.35,tintMode:'multiply'},
    shape:{bgOn:true,bg:ACCENT},
    rule:{bgOn:true,bg:'#141414'},
    barcode:{code:'460700123456',color:'#111111',bgOn:true,bg:'#ffffff',pad:1.5},
    game:{gameId:0,gameName:'',gameCover:'',label:'Играть',accent:ACCENT,showName:true,fit:'cover',bgOn:true,bg:'#0b0210',radius:2}
  }[type];
  return {...box, ...(TYPES[type].fam === 'text' ? txt : {}), ...m};
}

/* ================= утилиты ================= */
const r05 = v => Math.round(v * 2) / 2;
const uid = () => 'b' + Math.random().toString(36).slice(2, 11);
const fmtN = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }

// свои шрифты Google Fonts подгружаем в документ по требованию
const loadedFonts = new Set();
function ensureFont(name) {
  if (!R.isCustomFont(name) || loadedFonts.has(name)) return;
  loadedFonts.add(name);
  [false, true].forEach(bold => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = R.fontCssUrl(name, bold); document.head.appendChild(l);
  });
}

/* ================= состояние ================= */
const ISSUE = BOOT.issue;
let pages = BOOT.pages;             // [{id, kind, layout:{bg, density, material, blocks}}]
let si = 0;                         // индекс разворота
let activePage = pages[0] ? pages[0].id : null;
let sel = null, editing = null, k = 2, fitted = true, quadMode = false;
const stage = $('#stage'), clip = $('#clip'), overlay = $('#overlay'), desk = $('#desk');
const UI = {snap: true, preview: false};
R.customFonts(pages).forEach(ensureFont);

function spreads() {
  const n = pages.length, out = [];
  if (!n) return out;
  out.push([0]);
  for (let i = 1; i < n; i += 2) out.push(i + 1 < n ? [i, i + 1] : [i]);
  return out;
}
const curIdx = () => spreads()[si] || [];
const spreadOf = pageIndex => spreads().findIndex(s => s.includes(pageIndex));
const pageIndexById = id => pages.findIndex(p => p.id === id);
const offsetOf = pageIndex => curIdx().indexOf(pageIndex) * PW;
const spreadW = () => curIdx().length * PW;
function find(id) {
  for (let i = 0; i < pages.length; i++) {
    const b = pages[i].layout.blocks.find(x => x.id === id);
    if (b) return {b, pi: i};
  }
  return null;
}
const cur = () => sel && find(sel);
const elOf = id => clip.querySelector(`.blk[data-id="${id}"]`);
function toMM(e) { const r = stage.getBoundingClientRect(); return {x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k}; }
// все блоки разворота: [b, pi], снизу вверх — так же, как их сложит экспорт
function spreadItems() {
  const out = [];
  curIdx().forEach(pi => pages[pi].layout.blocks.forEach(b => out.push([b, pi])));
  return out.sort((a, c) => (a[0].z - c[0].z) || (a[1] - c[1]));
}
const spreadZ = () => spreadItems().map(([b]) => b.z);
const nextZ = () => Math.max(0, ...spreadZ()) + 1;

/* ================= стол ================= */
const blockHTML = (b, pi, plain = false) => R.renderBlockHTML(b, offsetOf(pi), {base: BOOT.base, ph: true, extra: ` data-id="${b.id}"`, salt: 's', plain});

function renderStage() {
  const s = curIdx(), two = s.length === 2;
  stage.style.width = `calc(${spreadW()}px * var(--k))`;
  stage.classList.toggle('has-spine', two);
  let h = '';
  s.forEach((pi, n) => h += `<div class="sheet" data-pi="${pi}" style="left:calc(${n * PW}px * var(--k));background:${pages[pi].layout.bg}"></div>`);
  // один контейнер на разворот: блоки обеих полос в общем стеке
  const blocks = spreadItems().map(([b, pi]) => blockHTML(b, pi)).join('');
  const folios = s.map(pi => R.folioHTML(pages, pi, ISSUE.settings)).join('');
  h += `<div class="pg spread${two ? ' two' : ''}" style="--folio:${ISSUE.settings.folioColor}">${blocks}${folios}</div>`;
  // бумага поверх, как ::before/::after в экспорте
  // (два слоя: у .pg есть container-type → свой контекст наложения, поэтому режим смешивания
  //  ставим на сам элемент: fxa — multiply с оттенком и волокном, fxb — лак/голограмма)
  s.forEach((pi, n) => ['fxa', 'fxb'].forEach(c => h += `<div class="pg pgfx ${c}"${R.paperAttrs(pages, pi)} style="left:calc(${n * PW}px * var(--k))"></div>`));
  if (two) h += `<div class="spine" style="left:calc(${PW}px * var(--k))"></div>`;
  let g = '';
  s.forEach((pi, n) => {
    const o = n * PW;
    g += `<i style="left:calc(${o + MARGIN}px * var(--k));top:calc(${MARGIN}px * var(--k));width:calc(${PW - 2 * MARGIN}px * var(--k));height:calc(${PH - 2 * MARGIN}px * var(--k))"></i>`;
    g += `<b style="left:calc(${o + PW / 2}px * var(--k))"></b>`;
  });
  h += `<div class="guides">${g}</div>`;
  clip.innerHTML = h;
  clip.querySelectorAll('.blk').forEach(el => el.classList.toggle('hid', !!find(el.dataset.id).b.hide));

  $('#labels').innerHTML = s.map((pi, n) => {
    const q = R.paper(pages, pi);
    return `<button class="plabel${pages[pi].id === activePage ? ' act' : ''}" data-pid="${pages[pi].id}" style="left:calc(${n * PW}px * var(--k))">${KIND_NAMES[pages[pi].kind]} · ${pi + 1} <em>${matName(q.material)} · ${stiffName(q.stiff)}</em></button>`;
  }).join('');
  let rh = '';
  s.forEach((pi, n) => { for (let m = 0; m <= 150; m += 50) rh += `<span style="left:calc(${n * PW + m}px * var(--k))">${m}</span>`; });
  $('#rulerH').innerHTML = rh;
  let rv = ''; for (let m = 0; m <= 250; m += 50) rv += `<span style="top:calc(${m}px * var(--k))">${m}</span>`;
  $('#rulerV').innerHTML = rv;

  afterPaint();
  placeSel();
  syncTplButtons();
}
const matName = m => (MATERIALS.find(x => x[0] === m) || [0, m])[1].toLowerCase();
const stiffName = s => (STIFF.find(x => x[0] === s) || [0, s])[1].toLowerCase();
function afterPaint(el) {
  requestAnimationFrame(() => {
    (el ? [el] : clip.querySelectorAll('.blk')).forEach(checkOverset);
    R.applyQuads(el ? el.parentNode : clip);
  });
}
function checkOverset(el) {
  if (!el || !el.isConnected) return;
  el.querySelector('.over')?.remove();
  const tx = el.querySelector('.tx'), c = el.querySelector('.ct');
  if (!tx || tx.classList.contains('bent')) return;
  const over = tx.scrollWidth > tx.clientWidth + 2 || c.scrollHeight > c.clientHeight + 2 ||
               (el.classList.contains('t-body') && tx.scrollHeight > tx.clientHeight + 2);
  if (over) { const o = document.createElement('div'); o.className = 'over'; o.textContent = '+'; o.title = 'Текст не помещается'; el.appendChild(o); }
}
function geom(b, pi) {
  const el = elOf(b.id); if (!el) return;
  if (pi === undefined) pi = find(b.id).pi;
  el.style.setProperty('--x', num(offsetOf(pi) + b.x)); el.style.setProperty('--y', num(b.y));
  el.style.setProperty('--w', num(b.w)); el.style.setProperty('--h', num(b.h));
  el.style.setProperty('--r', num(b.r)); el.style.setProperty('--z', b.z);
  el.classList.toggle('hid', !!b.hide);
}
function refreshBlock(b, plain = false) {
  const old = elOf(b.id); if (!old) return;
  const t = document.createElement('template');
  t.innerHTML = blockHTML(b, find(b.id).pi, plain);
  const nu = t.content.firstElementChild;
  nu.classList.toggle('hid', !!b.hide);
  old.replaceWith(nu);
  afterPaint(nu);
  return nu;
}

/* живые эффекты на столе: указатель → те же переменные, что ставит вьюер */
stage.addEventListener('pointermove', e => {
  const r = stage.getBoundingClientRect();
  const mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
  const st = clip.style;
  st.setProperty('--mx', mx.toFixed(3)); st.setProperty('--my', my.toFixed(3));
  const pr = e.clientX - r.left - (curIdx().length === 2 ? r.width / 2 : 0);
  const pw = curIdx().length === 2 ? r.width / 2 : r.width;
  st.setProperty('--px', ((mx * 2 - 1)).toFixed(3)); st.setProperty('--py', ((my * 2 - 1)).toFixed(3));
  st.setProperty('--gx', Math.round(Math.max(-20, Math.min(120, (pr / pw) * 100))) + '%');
  st.setProperty('--rvon', '1');
});
stage.addEventListener('pointerleave', () => clip.style.setProperty('--rvon', '0'));

/* ================= выделение ================= */
function placeSel() {
  overlay.querySelector('.selbox')?.remove();
  const f = cur();
  if (!f || f.b.hide || !curIdx().includes(f.pi)) return;
  const b = f.b, X = offsetOf(f.pi) + b.x;
  const s = document.createElement('div');
  s.className = 'selbox' + (b.lock ? ' locked' : '') + (quadMode ? ' quad' : '');
  s.style.cssText = `left:${X * k}px;top:${b.y * k}px;width:${b.w * k}px;height:${Math.max(b.h * k, 1)}px;transform:${b.r ? `rotate(${b.r}deg)` : 'none'}`;
  let h = `<div class="tag">${TYPES[b.type].name}${b.lock ? ' · закреплён' : ''} · ${fmtN(b.w)}×${fmtN(b.h)} мм${quadMode ? ' · искажение' : ''}</div>`;
  if (quadMode) {
    const q = b.p.q;
    const pts = [[q[0], q[1]], [1 + q[2], q[3]], [1 + q[4], 1 + q[5]], [q[6], 1 + q[7]]];
    h += `<svg class="qline" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${pts.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}"/></svg>`;
    pts.forEach(([x, y], i) => h += `<div class="qp" data-qp="${i}" style="left:${x * 100}%;top:${y * 100}%"></div>`);
  } else {
    const pos = {nw:[0,0],n:[50,0],ne:[100,0],e:[100,50],se:[100,100],s:[50,100],sw:[0,100],w:[0,50]};
    const thin = b.h * k < 14;
    for (const [d, [x, y]] of Object.entries(pos)) {
      if (thin && (d === 'n' || d === 's')) continue;
      h += `<div class="hd" data-h="${d}" style="left:${x}%;top:${y}%"></div>`;
    }
    h += '<div class="rot" data-rot="1" title="Повернуть"></div>';
  }
  s.innerHTML = h;
  overlay.appendChild(s);
}
function select(id) {
  if (editing && editing !== id) document.activeElement?.blur?.();
  if (sel !== id) quadMode = false;
  sel = id;
  const f = cur();
  if (f) setActivePage(pages[f.pi].id, false);
  placeSel(); renderLayers(); renderInspector();
}
function setActivePage(pid, rerender = true) {
  if (activePage === pid) return;
  activePage = pid;
  document.querySelectorAll('.plabel').forEach(l => l.classList.toggle('act', +l.dataset.pid === pid));
  syncTplButtons();
  if (rerender) { renderLayers(); renderInspector(); }
}

/* ================= привязка ================= */
function snapLines(exId) {
  const xs = [], ys = [0, MARGIN, PH / 2, PH - MARGIN, PH];
  curIdx().forEach((pi, n) => {
    const o = n * PW; xs.push(o, o + MARGIN, o + PW / 2, o + PW - MARGIN, o + PW);
    pages[pi].layout.blocks.forEach(b => {
      if (b.id === exId || b.hide || b.r) return;
      xs.push(o + b.x, o + b.x + b.w / 2, o + b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    });
  });
  return {xs, ys};
}
function nearest(vals, lines) {
  const thr = 6 / k; let best = null;
  for (const [v, off] of vals) for (const L of lines) { const d = Math.abs(L - v); if (d < thr && (!best || d < best.d)) best = {d, L, off}; }
  return best;
}
function showSnaps(gx, gy) {
  overlay.querySelectorAll('.snap').forEach(e => e.remove());
  gx.forEach(x => { const e = document.createElement('div'); e.className = 'snap x'; e.style.left = x * k + 'px'; overlay.appendChild(e); });
  gy.forEach(y => { const e = document.createElement('div'); e.className = 'snap y'; e.style.top = y * k + 'px'; overlay.appendChild(e); });
}

/* ================= перетаскивание ================= */
function drag(move, up) {
  const mv = e => move(e);
  const u = e => { removeEventListener('pointermove', mv); removeEventListener('pointerup', u); removeEventListener('pointercancel', u); up(e); };
  addEventListener('pointermove', mv); addEventListener('pointerup', u); addEventListener('pointercancel', u);
}
function startMove(e, f) {
  const b = f.b, o = offsetOf(f.pi), s = {x: o + b.x, y: b.y}, p0 = toMM(e), L = snapLines(b.id);
  let moved = false;
  drag(ev => {
    const p = toMM(ev);
    if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) * k < 3) return;
    moved = true;
    let X = s.x + p.x - p0.x, Y = s.y + p.y - p0.y;
    const gx = [], gy = [];
    if (UI.snap && !ev.altKey) {
      const sx = nearest([[X, 0], [X + b.w / 2, b.w / 2], [X + b.w, b.w]], L.xs);
      const sy = nearest([[Y, 0], [Y + b.h / 2, b.h / 2], [Y + b.h, b.h]], L.ys);
      if (sx) { X = sx.L - sx.off; gx.push(sx.L); } else X = r05(X);
      if (sy) { Y = sy.L - sy.off; gy.push(sy.L); } else Y = r05(Y);
    }
    if (ev.shiftKey) { if (Math.abs(X - s.x) > Math.abs(Y - s.y)) Y = s.y; else X = s.x; }
    b.x = X - o; b.y = Y; geom(b, f.pi); placeSel(); showSnaps(gx, gy); syncGeom();
  }, () => {
    showSnaps([], []);
    if (!moved) return;
    // перенос через корешок: блок принадлежит той полосе, где его центр; z общий для разворота — не меняется
    const sp = curIdx();
    if (sp.length === 2) {
      const X = o + b.x, target = sp[(X + b.w / 2) < PW ? 0 : 1];
      if (target !== f.pi) {
        const arr = pages[f.pi].layout.blocks; arr.splice(arr.indexOf(b), 1);
        b.x = X - offsetOf(target);
        pages[target].layout.blocks.push(b);
        renderStage(); select(b.id);
      }
    }
    commit();
  });
}
function startResize(e, f, dir) {
  const b = f.b, o = offsetOf(f.pi), s = {x: o + b.x, y: b.y, w: b.w, h: b.h}, p0 = toMM(e), L = snapLines(b.id), ratio = s.w / (s.h || 1);
  drag(ev => {
    const p = toMM(ev), dx = p.x - p0.x, dy = p.y - p0.y;
    let {x, y, w, h} = s;
    const gx = [], gy = [], snap = UI.snap && !ev.altKey;
    const sn = (v, lines, arr) => { if (!snap) return v; const n = nearest([[v, 0]], lines); if (n) { arr.push(n.L); return n.L; } return r05(v); };
    if (dir.includes('e')) w = sn(s.x + s.w + dx, L.xs, gx) - x;
    if (dir.includes('w')) { x = sn(s.x + dx, L.xs, gx); w = s.x + s.w - x; }
    if (dir.includes('s')) h = sn(s.y + s.h + dy, L.ys, gy) - y;
    if (dir.includes('n')) { y = sn(s.y + dy, L.ys, gy); h = s.y + s.h - y; }
    const minH = b.type === 'rule' ? .2 : 3;
    if (w < 3) { if (dir.includes('w')) x = s.x + s.w - 3; w = 3; }
    if (h < minH) { if (dir.includes('n')) y = s.y + s.h - minH; h = minH; }
    if (ev.shiftKey && dir.length === 2) { const nh = w / ratio; if (dir.includes('n')) y = s.y + s.h - nh; h = nh; gy.length = 0; }
    b.x = x - o; b.y = y; b.w = w; b.h = h;
    geom(b, f.pi); placeSel(); showSnaps(gx, gy); syncGeom();
    R.applyQuads(elOf(b.id)?.parentNode);
  }, () => { showSnaps([], []); refreshBlock(b); commit(); });
}
function startRotate(e, f) {
  const b = f.b, r = stage.getBoundingClientRect();
  const cx = r.left + (offsetOf(f.pi) + b.x + b.w / 2) * k, cy = r.top + (b.y + b.h / 2) * k;
  drag(ev => {
    let a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90;
    if (a > 180) a -= 360;
    a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
    if (Math.abs(a) < 2) a = 0;
    b.r = a; geom(b, f.pi); placeSel(); syncGeom();
  }, () => commit());
}
// свободная трансформация: тянем угол, смещение хранится долями ширины/высоты блока
function startQuad(e, f, idx) {
  const b = f.b, q0 = b.p.q.slice(), x0 = e.clientX, y0 = e.clientY;
  const a = -b.r * Math.PI / 180;
  drag(ev => {
    let dx = ev.clientX - x0, dy = ev.clientY - y0;
    [dx, dy] = [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
    const clampQ = v => Math.max(-.5, Math.min(.5, Math.round(v * 1000) / 1000));
    b.p.q[idx * 2] = clampQ(q0[idx * 2] + dx / (b.w * k));
    b.p.q[idx * 2 + 1] = clampQ(q0[idx * 2 + 1] + dy / (b.h * k));
    refreshBlock(b); placeSel();
  }, () => { commit(); renderInspector(); });
}

clip.addEventListener('pointerdown', e => {
  const el = e.target.closest('.blk');
  if (!el) {
    const sh = e.target.closest('.sheet');
    if (sh) setActivePage(pages[+sh.dataset.pi].id);
    if (sel) select(null);
    return;
  }
  const f = find(el.dataset.id);
  if (editing === f.b.id) return;
  if (editing) document.activeElement?.blur?.();
  e.preventDefault();
  if (sel !== f.b.id) select(f.b.id);
  if (!f.b.lock && e.button === 0 && !quadMode) startMove(e, f);
});
clip.addEventListener('dblclick', e => {
  const el = e.target.closest('.blk'); if (!el) return;
  const f = find(el.dataset.id);
  if (f.b.lock) return;
  if (TYPES[f.b.type].fam === 'text') startEdit(f.b);
  else if (f.b.type === 'image') $('#file').click();
});
desk.addEventListener('pointerdown', e => { if (!e.target.closest('.stage') && sel) select(null); });
overlay.addEventListener('pointerdown', e => {
  const f = cur(); if (!f) return;
  e.preventDefault(); e.stopPropagation();
  if (e.target.dataset.h) startResize(e, f, e.target.dataset.h);
  else if (e.target.dataset.rot) startRotate(e, f);
  else if (e.target.dataset.qp) startQuad(e, f, +e.target.dataset.qp);
});
$('#labels').addEventListener('click', e => { const l = e.target.closest('.plabel'); if (l) { select(null); setActivePage(+l.dataset.pid); } });

/* ================= текст ================= */
function startEdit(b) {
  // изогнутый текст правим в обычном виде, дугу вернём после
  const el = b.p.bend ? refreshBlock(b, true) : elOf(b.id);
  const tx = el.querySelector('.tx');
  editing = b.id; el.classList.add('editing');
  try { tx.contentEditable = 'plaintext-only'; } catch (_) {}
  if (tx.contentEditable !== 'plaintext-only') tx.contentEditable = 'true';
  tx.focus();
  const r = document.createRange(); r.selectNodeContents(tx); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  tx.addEventListener('input', () => checkOverset(el));
  tx.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); tx.blur(); } ev.stopPropagation(); });
  tx.addEventListener('blur', () => {
    let t = tx.innerText.replace(/ /g, ' ');
    t = b.type === 'body' ? t.replace(/\n{2,}/g, '\n').trim() : t.replace(/\n$/, '');
    editing = null;
    b.text = t || TYPES[b.type].name;
    refreshBlock(b); commit(); renderLayers();
  }, {once: true});
}

/* ================= палитра ================= */
document.querySelectorAll('.palette').forEach(pal => pal.addEventListener('pointerdown', e => {
  const tile = e.target.closest('.tile'); if (!tile) return;
  e.preventDefault();
  const type = tile.dataset.type, T = TYPES[type], x0 = e.clientX, y0 = e.clientY;
  let ghost = null;
  drag(ev => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    if (!ghost) { ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = T.name; document.body.appendChild(ghost); }
    const w = T.w * k, h = Math.max(T.h * k, 18);
    ghost.style.cssText = `left:${ev.clientX - w / 2}px;top:${ev.clientY - h / 2}px;width:${w}px;height:${h}px`;
  }, ev => {
    if (!ghost) { addBlock(type); return; }
    ghost.remove();
    const r = stage.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
    const p = toMM(ev);
    addBlockAt(type, p.x, p.y);
  });
}));
function mk(type, x, y, w, h, p = {}, text) {
  const b = {id: uid(), type, x, y, w, h, r: 0, z: 1, lock: false, hide: false, p: {...defaults(type), ...p}};
  b.p.q = (p.q || b.p.q).slice();
  if (TYPES[type].fam === 'text') b.text = text ?? TXT[type] ?? TYPES[type].name;
  return b;
}
function addBlockAt(type, X, Y, p) {
  const T = TYPES[type], sp = curIdx();
  const pi = sp[Math.min(sp.length - 1, Math.max(0, Math.floor(X / PW)))];
  const o = offsetOf(pi);
  const b = mk(type, r05(X - o - T.w / 2), r05(Y - T.h / 2), T.w, T.h, p);
  b.z = nextZ();
  pages[pi].layout.blocks.push(b);
  renderStage(); select(b.id); commit();
  return b;
}
function addBlock(type, p) {
  let pi = pageIndexById(activePage);
  if (!curIdx().includes(pi)) pi = curIdx()[0];
  return addBlockAt(type, offsetOf(pi) + PW / 2, PH / 2, p);
}

/* ================= шаблоны ================= */
const SPREAD_TPL = {
  classic: () => [
    mk('image', 0, 0, 210, 297, {src: 'assets/demo/dusk.png'}),
    mk('caption', 15, 262, 110, 12, {color: '#ffffff'}),
    mk('rubric', 225, 20, 48, 7),
    mk('heading', 225, 32, 180, 50, {size: 46}),
    mk('lead', 225, 86, 172, 26),
    mk('author', 225, 116, 180, 6),
    mk('rule', 225, 125, 180, 0.4),
    mk('body', 225, 131, 180, 143),
  ],
  panorama: () => [
    mk('image', 0, 0, 420, 172, {src: 'assets/demo/teal-wide.png', fy: 60}),
    mk('rubric', 225, 98, 48, 7, {bg: '#ffffff', color: '#0e2530'}),
    mk('heading', 225, 110, 180, 52, {font: 'Unbounded', size: 30, weight: 900, upper: true, color: '#ffffff', lh: 1.02, ls: -0.02}),
    mk('lead', 15, 184, 180, 32, {font: 'Onest', italic: false, weight: 500, size: 13, lh: 1.3, color: '#0e2530'}),
    mk('author', 15, 220, 180, 6, {color: '#3f8f8a'}),
    mk('quote', 15, 236, 118, 48, {font: 'Onest', italic: false, weight: 600, size: 13, lh: 1.3, dc: '#3f8f8a', color: '#0e2530'}),
    mk('image', 145, 232, 50, 50, {src: 'assets/demo/ember.png', shape: 'circle', fy: 70, lift: 8}),
    mk('body', 225, 184, 180, 98, {font: 'PT Serif', size: 8.8, dc: '#3f8f8a'}),
  ],
  portrait: () => [
    mk('shape', 0, 0, 210, 297, {bg: '#1b1f3a'}),
    mk('rubric', 15, 20, 40, 7, {bg: '#e8662a', color: '#1b1f3a'}),
    mk('heading', 15, 34, 180, 104, {font: 'Yeseva One', weight: 400, size: 64, lh: .95, color: '#f2e8d5', tfx: 'emboss', tfxD: 5}),
    mk('image', 40, 146, 130, 136, {src: 'assets/demo/ember.png', shape: 'arch', fy: 55}),
    mk('caption', 225, 20, 90, 12, {color: '#6b6b6b'}),
    mk('lead', 225, 36, 180, 30, {font: 'Cormorant Garamond', size: 17, lh: 1.2, color: '#1b1f3a'}),
    mk('author', 225, 70, 180, 6, {color: '#e8662a'}),
    mk('body', 225, 82, 180, 130, {font: 'Cormorant Garamond', size: 11, lh: 1.3, dc: '#e8662a'}),
    mk('shape', 225, 220, 180, 62, {bg: '#f2e8d5', radius: 3}),
    mk('quote', 235, 228, 160, 46, {font: 'Yeseva One', italic: false, size: 16, lh: 1.25, color: '#1b1f3a', dc: '#e8662a'}),
  ]
};
const PAGE_TPL = {
  coverPhoto: () => ({bg: '#111111', blocks: [
    mk('image', 0, 0, 210, 297, {src: 'assets/demo/dusk.png', fy: 60}),
    mk('masthead', 12, 12, 186, 44, {color: '#ffffff', size: 84, align: 'center', tfx: 'foil', tfxC: '#ffd27a', tfxD: 4}),
    mk('issue', 12, 58, 186, 6, {color: '#ffffff', align: 'center'}),
    mk('coverline', 14, 150, 80, 34, {color: '#ffffff', dc: '#ffc27a', size: 11}),
    mk('coverline', 14, 192, 80, 26, {color: '#ffffff', dc: '#ffc27a', size: 9}, 'Бесплатно навсегда\nПочему игры с джемов не платят комиссию'),
    mk('badge', 160, 128, 34, 34, {bg: '#ffc27a', color: '#3b1d5a', lift: 6}),
    mk('barcode', 160, 262, 36, 22),
  ]}),
  coverType: () => ({bg: ACCENT, blocks: [
    mk('masthead', -62, 128, 250, 44, {color: '#16141c', size: 110, align: 'center', tfx: 'extrude', tfxC: '#ffe600', tfxD: 5, tfxA: 35}),
    mk('issue', 60, 14, 136, 6, {color: '#ffffff', align: 'right'}),
    mk('shape', 110, 70, 80, 80, {bg: '#ffe600', shape: 'circle', holo: 'holo', holoA: .7}),
    mk('heading', 70, 160, 126, 70, {font: 'Unbounded', size: 26, weight: 700, color: '#ffffff', lh: 1.05, ls: -0.02}, 'Пиксели на краю карты'),
    mk('coverline', 70, 234, 110, 20, {color: '#ffffff', dc: '#ffe600', size: 9}, 'И ещё 12 игр\nс осенних джемов'),
    mk('barcode', 160, 262, 36, 22),
  ]}),
  backCover: () => ({bg: '#16141c', blocks: [
    mk('image', 15, 15, 180, 150, {src: 'assets/demo/ember.png', fy: 50, radius: 3}),
    mk('rubric', 15, 178, 60, 7, {bg: '#e8662a', color: '#16141c'}, 'В следующем номере'),
    mk('heading', 15, 190, 180, 44, {font: 'Unbounded', size: 26, weight: 700, color: '#ffffff', lh: 1.05}, 'Угли: как делают игры, в которых ничего не объясняют'),
    mk('caption', 15, 240, 120, 14, {color: '#9a92a8', reveal: 'flashlight', revR: 30}, 'Промокод для читателей: УГЛИ-2026\nпосветите фонариком'),
    mk('barcode', 160, 262, 36, 22),
  ]})
};
function syncTplButtons() {
  const two = curIdx().length === 2;
  document.querySelectorAll('[data-tpl]').forEach(b => {
    if (SPREAD_TPL[b.dataset.tpl]) { b.disabled = !two; b.title = two ? '' : 'Нужен разворот из двух полос'; }
  });
}
function applySpreadTemplate(name) {
  const sp = curIdx(); if (sp.length !== 2) return;
  sp.forEach(pi => pages[pi].layout.blocks = []);
  SPREAD_TPL[name]().forEach((b, i) => {
    const pi = sp[(b.x + b.w / 2) < PW ? 0 : 1];
    b.x -= offsetOf(pi); b.z = i + 1;
    pages[pi].layout.blocks.push(b);
  });
}
function applyPageTemplate(name, pi) {
  const t = PAGE_TPL[name]();
  t.blocks.forEach((b, i) => b.z = i + 1);
  const old = pages[pi].layout;
  pages[pi].layout = {...old, bg: t.bg, blocks: t.blocks};
}
document.querySelectorAll('[data-tpl]').forEach(btn => btn.addEventListener('click', () => {
  const name = btn.dataset.tpl;
  if (SPREAD_TPL[name]) applySpreadTemplate(name);
  else {
    let pi = pageIndexById(activePage);
    if (!curIdx().includes(pi)) pi = curIdx()[0];
    applyPageTemplate(name, pi);
  }
  sel = null; renderStage(); renderLayers(); renderInspector(); commit(); renderStrip();
  toast('Шаблон применён — Ctrl+Z вернёт прежний макет');
}));

/* ================= фото ================= */
async function upload(file) {
  const fd = new FormData();
  fd.append('file', file); fd.append('issue', ISSUE.id); fd.append('csrf', BOOT.csrf);
  setSave('Загружаю фото…');
  const r = await fetch(`${BOOT.api}?a=upload`, {method: 'POST', body: fd, headers: {'X-CSRF': BOOT.csrf}});
  const j = await r.json().catch(() => ({ok: false, error: 'Сервер ответил не JSON'}));
  setSave(dirty.size ? 'Есть изменения' : 'Сохранено');
  if (!j.ok) throw new Error(j.error);
  return j;
}
$('#file').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  const f = cur(); if (!file || !f || f.b.type !== 'image') return;
  try { const j = await upload(file); f.b.p.src = j.src; refreshBlock(f.b); commit(); renderInspector(); toast('Фото заменено'); }
  catch (err) { toast(err.message); }
});
desk.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
desk.addEventListener('drop', async e => {
  e.preventDefault();
  const file = [...e.dataTransfer.files].find(x => x.type.startsWith('image/')); if (!file) return;
  const target = e.target.closest?.('.blk');
  const tf = target && find(target.dataset.id);
  const p = toMM(e);
  let j; try { j = await upload(file); } catch (err) { toast(err.message); return; }
  if (tf && tf.b.type === 'image') { tf.b.p.src = j.src; refreshBlock(tf.b); select(tf.b.id); commit(); toast('Фото заменено'); return; }
  const b = addBlockAt('image', p.x, p.y, {src: j.src});
  b.h = r05(b.w / (j.ratio || 1)); b.y = r05(p.y - b.h / 2);
  refreshBlock(b); geom(b); placeSel(); commit();
});

/* ================= слои: один список на разворот, сверху — то, что выше ================= */
const eye = on => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${on ? '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/>' : '<path d="M2 2l12 12M6.5 4Q7.2 3.5 8 3.5c4 0 6.5 4.5 6.5 4.5l-1.6 2M10 12.2q-1 .3-2 .3C4 12.5 1.5 8 1.5 8s.8-1.5 2.4-2.8"/>'}</svg>`;
const lockI = on => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="${on ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.8-1'}"/></svg>`;
function renderLayers() {
  const sp = curIdx(), items = spreadItems().reverse();
  const h = items.map(([b, pi]) => {
    const label = b.text ? b.text.split('\n')[0].slice(0, 40) : (b.type === 'game' && b.p.gameName ? '▶ ' + b.p.gameName : TYPES[b.type].name);
    const side = sp.length === 2 ? `<span class="side" title="${KIND_NAMES[pages[pi].kind]} ${pi + 1}">${sp.indexOf(pi) ? 'П' : 'Л'}</span>` : '<span></span>';
    return `<div class="lay${b.id === sel ? ' sel' : ''}${b.hide ? ' off' : ''}" data-id="${b.id}" draggable="true">
      <span class="ic">${TYPES[b.type].ic}</span><span class="lb" title="${esc(label)}">${esc(label)}</span>${side}
      <button data-a="hide" class="${b.hide ? 'act' : ''}" title="${b.hide ? 'Показать' : 'Скрыть'}">${eye(!b.hide)}</button>
      <button data-a="lock" class="${b.lock ? 'act' : ''}" title="${b.lock ? 'Открепить' : 'Закрепить'}">${lockI(b.lock)}</button></div>`;
  }).join('');
  $('#laycount').textContent = items.length || '';
  $('#layers').innerHTML = items.length ? h : '<div class="hint">Пусто. Перетащите блок из палитры или возьмите шаблон.</div>';
}
// перестановка слоёв перетаскиванием: переписываем z всему развороту по новому порядку
let dragLayer = null;
$('#layers').addEventListener('dragstart', e => { dragLayer = e.target.closest('.lay')?.dataset.id; e.dataTransfer.effectAllowed = 'move'; });
$('#layers').addEventListener('dragover', e => {
  const row = e.target.closest('.lay'); if (!row || !dragLayer) return;
  e.preventDefault();
  document.querySelectorAll('.lay.drop-above,.lay.drop-below').forEach(x => x.classList.remove('drop-above', 'drop-below'));
  const r = row.getBoundingClientRect();
  row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-above' : 'drop-below');
});
$('#layers').addEventListener('drop', e => {
  const row = e.target.closest('.lay'); if (!row || !dragLayer) return;
  e.preventDefault();
  const above = row.classList.contains('drop-above');
  const order = spreadItems().reverse().map(([b]) => b.id).filter(id => id !== dragLayer);
  let at = order.indexOf(row.dataset.id); if (!above) at++;
  order.splice(at, 0, dragLayer);
  order.reverse().forEach((id, i) => find(id).b.z = i + 1);
  dragLayer = null;
  renderStage(); renderLayers(); commit();
});
$('#layers').addEventListener('dragend', () => { dragLayer = null; document.querySelectorAll('.lay.drop-above,.lay.drop-below').forEach(x => x.classList.remove('drop-above', 'drop-below')); });
$('#layers').addEventListener('click', e => {
  const row = e.target.closest('.lay'); if (!row) return;
  const f = find(row.dataset.id), a = e.target.closest('button')?.dataset.a;
  if (a === 'hide') { f.b.hide = !f.b.hide; geom(f.b); commit(); placeSel(); renderLayers(); return; }
  if (a === 'lock') { f.b.lock = !f.b.lock; commit(); placeSel(); renderLayers(); renderInspector(); return; }
  select(f.b.id);
});

/* ================= инспектор ================= */
const ICON = {
  left:'<svg viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h12M2 6.5h8M2 9.5h12M2 12.5h7"/></svg>',
  center:'<svg viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h12M4 6.5h8M2 9.5h12M4.5 12.5h7"/></svg>',
  right:'<svg viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h12M6 6.5h8M2 9.5h12M7 12.5h7"/></svg>',
  justify:'<svg viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5h12M2 6.5h12M2 9.5h12M2 12.5h7"/></svg>',
  vtop:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2.5h12"/><rect x="5" y="5" width="6" height="5"/></svg>',
  vmid:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8h3M11 8h3"/><rect x="5" y="5.5" width="6" height="5"/></svg>',
  vbot:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13.5h12"/><rect x="5" y="6" width="6" height="5"/></svg>',
  dup:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>',
  del:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4"/></svg>',
  up:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="9" height="9" rx="1" fill="currentColor"/><path d="M2 5v9h9"/></svg>',
  down:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="9" height="9" rx="1"/><path d="M5 2h9v9"/></svg>',
  prev:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3 5 8l5 5"/></svg>',
  next:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 3 5 5-5 5"/></svg>',
  link:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6.5 9.5l3-3M5 8 3.8 9.2a2.3 2.3 0 0 0 3.2 3.2L8 11.3M11 8l1.2-1.2A2.3 2.3 0 0 0 9 3.6L8 4.7"/></svg>'
};
const fmtV = (v, step) => step < 0.1 ? (+v).toFixed(2) : step < 1 ? (+v).toFixed(1) : String(Math.round(v));
const sec = (title, body, id = '') => `<div class="sec"${id ? ` data-sec="${id}"` : ''}><h3>${title}</h3><div class="stack">${body}</div></div>`;
// ползунок + поле ввода: оба с одним data-ключом, меняются синхронно
const fRange = (key, label, min, max, step, unit, v, attr = 'k') =>
  `<div class="row"><span>${label}${unit ? `<i class="u">${unit.trim()}</i>` : ''}</span><input type="range" id="f-${attr}-${key}" data-${attr}="${key}" data-t="n" min="${min}" max="${max}" step="${step}" value="${v}"><input type="number" class="vnum" id="n-${attr}-${key}" data-${attr}="${key}" data-t="n" min="${min}" max="${max}" step="${step}" value="${fmtV(v, step)}" aria-label="${label}"></div>`;
const fColor = (key, label, v, attr = 'k') =>
  `<div class="row"><span>${label}</span><input type="color" id="f-${attr}-${key}" data-${attr}="${key}" value="${v}"><input class="vnum hex" id="h-${attr}-${key}" data-${attr}="${key}" data-t="hex" value="${v.toUpperCase()}" maxlength="7" spellcheck="false" aria-label="${label}"></div>`;
const fToggle = (key, label, v, attr = 'k') =>
  `<label class="row"><span>${label}</span><span class="sw"><input type="checkbox" id="f-${attr}-${key}" data-${attr}="${key}" ${v ? 'checked' : ''}><i></i></span><span></span></label>`;
const fSelect = (key, label, opts, v, attr = 'k', cls = '') =>
  `<label class="row wide"><span>${label}</span><select id="f-${attr}-${key}" class="${cls}" data-${attr}="${key}" data-t="${typeof v === 'number' ? 'n' : 's'}">${opts.map(([o, t]) => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
const fSeg = (key, label, opts, v) =>
  `<div class="row wide"><span>${label}</span><div class="seg">${opts.map(([o, t, ti]) => `<button type="button" data-seg="${key}" data-v="${o}" class="${String(v).split(' ').includes(String(o)) ? 'on' : ''}" title="${ti || ''}">${t}</button>`).join('')}</div></div>`;
const fontButton = p => `<div class="row wide"><span>Гарнитура</span><button type="button" class="fontbtn" id="fontBtn" style="font-family:${esc(R.fontStack(p.font))}">${esc(p.font)}<i>▾</i></button></div>`;

function renderInspector() {
  const box = $('#insp'), f = cur();
  const scroll = box.scrollTop;
  if (!f) { box.innerHTML = pagePanel(); box.scrollTop = scroll; return; }
  const b = f.b, T = TYPES[b.type], p = b.p;
  let h = `<div class="ihead"><div><div class="eyebrow">${KIND_NAMES[pages[f.pi].kind]} ${f.pi + 1}</div><div class="iname">${T.name}</div></div>
    <div class="iacts">
      <button class="ib" data-act="front" title="На передний план ( ] )">${ICON.up}</button>
      <button class="ib" data-act="back" title="На задний план ( [ )">${ICON.down}</button>
      <button class="ib" data-act="dup" title="Дублировать (Ctrl+D)">${ICON.dup}</button>
      <button class="ib danger" data-act="del" title="Удалить (Delete)">${ICON.del}</button></div></div>`;

  h += sec('Положение и размер <span>мм от края полосы</span>',
    `<div class="geo">${['x', 'y', 'w', 'h'].map(g => `<label>${g.toUpperCase()}<input class="num" type="number" step="0.5" id="g-${g}" data-g="${g}" value="${fmtV(b[g], .1)}"></label>`).join('')}</div>` +
    fRange('r', 'Поворот', -180, 180, 1, '°', b.r, 'g') +
    `<div class="btnrow" style="margin-top:4px"><button class="btn sm" data-act="fitM">По полям</button><button class="btn sm" data-act="fitS">Под обрез</button>${curIdx().length === 2 ? '<button class="btn sm" data-act="fitSpread">На разворот</button>' : ''}</div>`);

  h += sec('Перспектива и искажение',
    fRange('rx', 'Наклон X', -80, 80, 1, '°', p.rx) +
    fRange('ry', 'Наклон Y', -80, 80, 1, '°', p.ry) +
    fRange('persp', 'Глубина', 50, 3000, 10, 'мм', p.persp) +
    `<div class="btnrow"><button class="btn sm${quadMode ? ' on' : ''}" data-act="quad">${quadMode ? 'Готово' : 'Свободная трансформация'}</button>` +
    `${p.q.some(x => x) || p.rx || p.ry ? '<button class="btn sm ghost" data-act="resetT">Сбросить</button>' : ''}</div>` +
    `<div class="hint">Как Transform → Distort в Photoshop: включите и тяните углы блока. Меньше глубина — сильнее перспектива.</div>`);

  if (b.type === 'image') {
    h += sec('Изображение',
      `<div class="btnrow"><button class="btn sm" data-act="upload">Загрузить фото…</button>
        <select id="f-demo" data-act-sel="demo" style="flex:1;min-width:110px"><option value="">Пример…</option><option value="assets/demo/dusk.png">Сумерки</option><option value="assets/demo/teal.png">Бирюза</option><option value="assets/demo/ember.png">Угли</option><option value="assets/demo/teal-wide.png">Бирюза, широкая</option></select></div>` +
      fSeg('fit', 'Вписать', [['cover', 'Заполнить'], ['contain', 'Целиком']], p.fit) +
      fRange('zoom', 'Масштаб', 1, 4, .05, '×', p.zoom) +
      fRange('fx', 'Фокус X', 0, 100, 1, '%', p.fx) +
      fRange('fy', 'Фокус Y', 0, 100, 1, '%', p.fy) +
      fRange('gray', 'Ч/б', 0, 1, .05, '', p.gray) +
      fRange('contrast', 'Контраст', .3, 2, .05, '', p.contrast));
    h += sec('Тонирование',
      fToggle('tintOn', 'Включить', p.tintOn) + fColor('tint', 'Цвет', p.tint) +
      fRange('tintA', 'Сила', 0, 1, .05, '', p.tintA) +
      fSelect('tintMode', 'Режим', [['multiply', 'Умножение'], ['color', 'Цвет (дуотон)'], ['screen', 'Осветление'], ['overlay', 'Перекрытие']], p.tintMode));
  }

  if (b.type === 'barcode') {
    h += sec('Штрихкод EAN-13',
      `<label class="row wide"><span>12 цифр</span><input class="num" id="f-k-code" data-k="code" data-t="s" inputmode="numeric" maxlength="12" value="${esc(p.code)}"></label>` +
      `<div class="hint">Контрольная 13-я цифра считается сама. Для журналов обычно код ISSN с префиксом 977.</div>` +
      fColor('color', 'Цвет штрихов', p.color));
  }

  if (b.type === 'game') {
    const g = p.gameId > 0;
    h += sec('Игра из каталога Dustore',
      `<label class="row wide"><span>ID / ссылка</span><input class="num" id="f-game-q" data-gameq="1" placeholder="123 или dustore.ru/g/123" value="${g ? p.gameId : ''}"></label>` +
      `<div class="hint" id="gameState">${g ? `«${esc(p.gameName)}» · #${p.gameId}` : 'Подойдёт любая опубликованная игра с веб-сборкой. Нажмите Enter, чтобы найти.'}</div>` +
      (g ? `<div class="btnrow"><a class="btn sm" href="${esc(BOOT.webplayer)}?id=${p.gameId}" target="_blank" rel="noopener">Проверить в плеере ↗</a></div>` : '') +
      `<label class="row wide"><span>Кнопка</span><input class="num" id="f-k-label" data-k="label" data-t="s" maxlength="40" value="${esc(p.label)}" style="font-family:Onest"></label>` +
      fColor('accent', 'Цвет кнопки', p.accent) +
      fToggle('showName', 'Название', p.showName) +
      fSeg('fit', 'Обложка', [['cover', 'Заполнить'], ['contain', 'Целиком']], p.fit) +
      `<div class="hint">В журнале это лёгкая заглушка: игра грузится только после нажатия «Играть», и одновременно работает не больше одной.</div>`);
  }

  if (T.fam === 'text') {
    h += sec('Типографика',
      `<button class="btn" data-act="edit">Редактировать текст</button>` +
      fontButton(p) +
      fRange('size', 'Кегль', 4, 300, .5, 'pt', p.size) +
      fSelect('weight', 'Начертание', [[300, 'Светлое'], [400, 'Нормальное'], [500, 'Среднее'], [600, 'Полужирное'], [700, 'Жирное'], [800, 'Сверхжирное'], [900, 'Чёрное']], +p.weight) +
      fSeg('align', 'Выключка', [['left', ICON.left, 'Влево'], ['center', ICON.center, 'По центру'], ['right', ICON.right, 'Вправо'], ['justify', ICON.justify, 'По формату']], p.align) +
      (b.type !== 'body' ? fSeg('valign', 'По высоте', [['top', ICON.vtop, 'Сверху'], ['middle', ICON.vmid, 'По центру'], ['bottom', ICON.vbot, 'Снизу']], p.valign) : '') +
      fSeg('style', 'Стиль', [['italic', '<i style="font-family:serif">К</i>', 'Курсив'], ['upper', 'АА', 'Прописные']], [p.italic ? 'italic' : '', p.upper ? 'upper' : ''].join(' ')) +
      fRange('lh', 'Интерлиньяж', .6, 3, .01, '', p.lh) +
      fRange('ls', 'Трекинг', -.2, 1, .005, 'em', p.ls) +
      fColor('color', 'Цвет', p.color));
    const TFX = [['none', 'Нет'], ['emboss', 'Выпуклый'], ['deboss', 'Тиснение'], ['extrude', 'Объём 3D'], ['outline', 'Контур'], ['neon', 'Неон'], ['foil', 'Фольга']];
    h += sec('Эффект текста <span>как WordArt</span>',
      `<div class="fxgrid">${TFX.map(([v, t]) => `<button type="button" data-seg="tfx" data-v="${v}" class="fxb fx-${v}${p.tfx === v ? ' on' : ''}"><b>Аа</b><span>${t}</span></button>`).join('')}</div>` +
      (p.tfx !== 'none' ? fRange('tfxD', 'Глубина', 0, 20, .5, '', p.tfxD) +
        (['emboss', 'deboss', 'extrude', 'foil'].includes(p.tfx) ? fRange('tfxA', 'Свет, угол', 0, 360, 5, '°', p.tfxA) : '') +
        (['extrude', 'outline', 'neon', 'foil'].includes(p.tfx) ? fColor('tfxC', p.tfx === 'foil' ? 'Металл' : 'Цвет эффекта', p.tfxC) : '') : '') +
      (b.type !== 'body' ? fRange('bend', 'Изгиб', -100, 100, 1, '', p.bend) + (p.bend ? '<div class="hint">Изогнутая строка — векторная: каждая строка ложится на свою дугу. Двойной клик — правка в обычном виде.</div>' : '') : ''));
    if (b.type === 'body') {
      h += sec('Колонки и абзацы',
        fSeg('cols', 'Колонки', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], p.cols) +
        fRange('gap', 'Средник', 0, 15, .5, 'мм', p.gap) +
        fToggle('dropcap', 'Буквица', p.dropcap) +
        fToggle('indent', 'Абз. отступ', p.indent) +
        fColor('dc', 'Акцент', p.dc));
    }
    if (b.type === 'quote') h += sec('Цитата', fToggle('marks', 'Кавычка', p.marks) + fColor('dc', 'Акцент', p.dc));
    if (b.type === 'coverline') h += sec('Анонс', `<div class="hint">Первая строка — заголовок анонса, выделяется цветом и размером. Перенос строки — Enter.</div>` + fColor('dc', 'Цвет заголовка', p.dc));
  }

  const corners = p.r1 >= 0 || p.r2 >= 0 || p.r3 >= 0 || p.r4 >= 0;
  h += sec('Форма и заливка',
    `<div class="shapes">${Object.keys(SHAPES).map(s => `<button type="button" data-seg="shape" data-v="${s}" class="${p.shape === s ? 'on' : ''}" title="${SHAPE_NAMES[s]}"><i style="clip-path:${SHAPES[s]};${s === 'rect' ? 'border-radius:2px' : ''}"></i></button>`).join('')}</div>` +
    fToggle('bgOn', 'Заливка', p.bgOn) + fColor('bg', 'Цвет фона', p.bg) +
    fRange('pad', 'Поля', 0, 25, .5, 'мм', p.pad) +
    fRange('radius', 'Скругление', 0, 150, .5, 'мм', p.radius) +
    `<div class="corners${corners ? ' on' : ''}">
      <button type="button" class="ib" data-act="corners" title="${corners ? 'Все углы одинаково' : 'Каждый угол отдельно'}">${ICON.link}</button>
      ${corners ? ['r1', 'r2', 'r4', 'r3'].map((c, i) => `<label class="c${i}"><input class="num" type="number" min="0" max="150" step="0.5" data-k="${c}" data-t="n" value="${p[c] >= 0 ? p[c] : p.radius}"></label>`).join('') : '<span class="hint">Углы по отдельности — для «капли», вкладки, листа</span>'}
    </div>` +
    fRange('bw', 'Обводка', 0, 12, .25, 'pt', p.bw) + fColor('bc', 'Цвет обводки', p.bc));

  const HOLO = [['none', 'Нет'], ['silver', 'Серебро'], ['gold', 'Золото'], ['holo', 'Голограмма'], ['chameleon', 'Хамелеон'], ['glitter', 'Блёстки']];
  h += sec('Объём и спецэффекты',
    fRange('lift', 'Подъём', 0, 30, .5, 'мм', p.lift) +
    fToggle('pop', 'Поп-ап', p.pop) +
    (p.pop ? '<div class="btnrow"><button class="btn sm" data-act="popTest">▶ Проверить раскрытие</button></div>' : '') +
    `<div class="row wide"><span>Покрытие</span><div class="holos">${HOLO.map(([v, t]) => `<button type="button" data-seg="holo" data-v="${v}" class="hb h-${v}${p.holo === v ? ' on' : ''}" title="${t}"><i></i><span>${t}</span></button>`).join('')}</div></div>` +
    (p.holo !== 'none' ? fRange('holoA', 'Сила', 0, 1, .05, '', p.holoA) : '') +
    fToggle('peel', 'Наклейка', p.peel) +
    `<label class="row"><span>Фонарик</span><span class="sw"><input type="checkbox" id="f-k-reveal" data-k="reveal" data-t="rv" ${p.reveal === 'flashlight' ? 'checked' : ''}><i></i></span><span></span></label>` +
    (p.reveal === 'flashlight' ? fRange('revR', 'Луч', 10, 120, 1, 'мм', p.revR) : '') +
    `<div class="hint"><b>Подъём</b> — блок парит над бумагой: тень и параллакс за курсором. <b>Поп-ап</b> — встаёт со страницы, когда её открыли. <b>Наклейка</b> — уголок отгибается, по клику отклеивается и открывает то, что под ней. <b>Фонарик</b> — блок виден только в луче курсора (включите «Просмотр», чтобы проверить).</div>`);

  h += sec('Наложение',
    fRange('opacity', 'Непрозрачн.', 0, 1, .05, '', p.opacity) +
    fSelect('blend', 'Режим', [['normal', 'Обычный'], ['multiply', 'Умножение'], ['screen', 'Осветление'], ['overlay', 'Перекрытие'], ['difference', 'Разница'], ['luminosity', 'Яркость']], p.blend) +
    `<div class="btnrow"><button class="btn sm" data-act="lock">${b.lock ? 'Открепить' : 'Закрепить'}</button></div>`);
  box.innerHTML = h;
  box.scrollTop = scroll;
}

function pagePanel() {
  let pi = pageIndexById(activePage);
  if (!curIdx().includes(pi)) pi = curIdx()[0];
  const pg = pages[pi], s = ISSUE.settings;
  if (!pg) return '';
  const pub = ISSUE.status === 'published';
  return `<div class="ihead"><div><div class="eyebrow">Выбрана полоса</div><div class="iname">${KIND_NAMES[pg.kind]} · ${pi + 1}</div></div>
    <div class="iacts">
      <button class="ib" data-pact="left" title="Сдвинуть полосу левее" ${pi === 0 ? 'disabled' : ''}>${ICON.prev}</button>
      <button class="ib" data-pact="right" title="Сдвинуть полосу правее" ${pi === pages.length - 1 ? 'disabled' : ''}>${ICON.next}</button>
      <button class="ib danger" data-pact="delete" title="Удалить полосу" ${pages.length < 2 ? 'disabled' : ''}>${ICON.del}</button></div></div>` +
    paperSection(pi) +
    sec('Полоса',
      fSelect('kind', 'Тип', [['cover', 'Обложка'], ['page', 'Полоса'], ['back', 'Задняя обложка']], pg.kind, 'pg') +
      fColor('bg', 'Фон', pg.layout.bg, 'pg') +
      `<div class="hint">A4, 210 × 297 мм, поля ${MARGIN} мм. Блок можно протянуть через корешок — он появится на обеих полосах, как фото на разворот.</div>`) +
    sec('Выпуск',
      fToggle('folios', 'Колонтитулы', s.folios, 'd') +
      `<label class="row wide"><span>Издание</span><input class="num" type="text" id="f-d-mag" data-d="mag" maxlength="60" value="${esc(s.mag)}" style="font-family:Onest"></label>` +
      fColor('folioColor', 'Цвет колонт.', s.folioColor, 'd') +
      fToggle('snap', 'Привязка', UI.snap, 'ui') +
      `<div class="btnrow">${pub ? `<a class="btn sm" href="${esc(BOOT.viewer)}" target="_blank" rel="noopener">Читать ↗</a><button class="btn sm ghost danger" data-pact="unpublish">Снять с публикации</button>` : '<span class="hint">Черновик. Нажмите «Опубликовать», чтобы собрать HTML-страницы.</span>'}</div>`) +
    sec('Подсказка', `<div class="hint">Выберите блок, чтобы менять шрифт, форму, эффекты. Красный <b style="color:var(--danger)">+</b> в углу — текст не влез в рамку.</div>`);
}

function paperSection(pi) {
  const L = pages[pi].layout, q = R.paper(pages, pi), partner = R.sheetPartner(pi, pages.length);
  const d = L.density || 'auto', m = L.material || 'auto';
  return sec('Бумага <span>на ощупь и при листании</span>',
    `<div class="lbl">Жёсткость листа</div><div class="seg stiff">${STIFF.map(([v, t]) => `<button type="button" data-paper="density" data-v="${v}" class="${v === d ? 'on' : ''}">${t}</button>`).join('')}</div>` +
    `<div class="lbl">Материал</div>` +
    `<div class="mats">${MATERIALS.map(([v, t, hint]) => `<button type="button" data-paper="material" data-v="${v}" class="mat${v === m ? ' on' : ''}" title="${hint}"><i class="sw-${v}"></i><b>${t}</b><span>${hint}</span></button>`).join('')}</div>` +
    `<div class="hint">Сейчас: <b>${matName(q.material)}</b>, лист <b>${stiffName(q.stiff)}</b>${q.density === 'hard' ? ' — переворачивается целиком, как картон' : ''}. ` +
    (partner !== null ? `Жёсткость общая для листа: полосы ${Math.min(pi, partner) + 1} и ${Math.max(pi, partner) + 1}. ` : '') +
    `Газетный лист листается быстро и легко, плотный — медленнее, с глубокой тенью.</div>` +
    `<div class="btnrow"><button class="btn sm" data-pact="paperAll">Как у этой — на все внутренние полосы</button></div>`, 'paper');
}

/* ----- выбор шрифта: превью при наведении, как в Word ----- */
let fontPop = null;
function openFontPicker(btn) {
  closeFontPicker();
  const f = cur(); if (!f) return;
  const orig = f.b.p.font;
  const used = R.customFonts(pages).filter(n => !FONTS[n]);
  const list = [...Object.keys(FONTS), ...used];
  fontPop = document.createElement('div');
  fontPop.className = 'fontpop';
  fontPop.innerHTML = `<input class="num" id="fontSearch" placeholder="Поиск или любой шрифт Google Fonts" spellcheck="false">
    <div class="fl">${list.map(n => { ensureFont(n); return `<button type="button" data-font="${esc(n)}" class="${n === orig ? 'on' : ''}" style="font-family:${esc(R.fontStack(n))}"><b>${esc(n)}</b><span>Съешь же ещё этих мягких булок</span><em>${FONT_CATS[n] || 'Google Fonts'}</em></button>`; }).join('')}</div>
    <div class="fcustom" hidden><button type="button" class="btn sm" id="fontAdd"></button><span class="hint">Название как на fonts.google.com, латиницей. Кириллица есть не у всех шрифтов.</span></div>`;
  document.body.appendChild(fontPop);
  const r = btn.getBoundingClientRect();
  fontPop.style.top = Math.min(r.bottom + 4, innerHeight - 440) + 'px';
  fontPop.style.left = Math.max(8, r.right - 320) + 'px';
  const preview = name => { f.b.p.font = name; refreshBlock(f.b); btn.style.fontFamily = R.fontStack(name); };
  let committed = false;
  fontPop.addEventListener('pointerover', e => { const it = e.target.closest('[data-font]'); if (it) preview(it.dataset.font); });
  fontPop.querySelector('.fl').addEventListener('pointerleave', () => { if (!committed) preview(orig); });
  const choose = name => { committed = true; ensureFont(name); preview(name); commit(); closeFontPicker(); renderInspector(); };
  fontPop.addEventListener('click', e => { const it = e.target.closest('[data-font]'); if (it) choose(it.dataset.font); });
  const search = fontPop.querySelector('#fontSearch'), custom = fontPop.querySelector('.fcustom'), add = fontPop.querySelector('#fontAdd');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    fontPop.querySelectorAll('[data-font]').forEach(it => it.hidden = q && !it.dataset.font.toLowerCase().includes(q));
    const name = search.value.trim().replace(/\s+/g, ' ');
    const ok = /^[A-Za-z][A-Za-z0-9 ]{1,39}$/.test(name) && !list.some(n => n.toLowerCase() === name.toLowerCase());
    custom.hidden = !ok;
    if (ok) { add.textContent = `Подключить «${name}»`; add.dataset.name = name; ensureFont(name); add.style.fontFamily = R.fontStack(name); }
  });
  search.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { preview(orig); closeFontPicker(); }
    if (e.key === 'Enter') { const vis = [...fontPop.querySelectorAll('[data-font]')].find(x => !x.hidden); if (vis) choose(vis.dataset.font); else if (!custom.hidden) choose(add.dataset.name); }
  });
  add.addEventListener('pointerenter', () => preview(add.dataset.name));
  add.addEventListener('click', () => choose(add.dataset.name));
  fontPop._cancel = () => { if (!committed) preview(orig); };
  search.focus();
}
function closeFontPicker() { if (fontPop) { fontPop._cancel?.(); fontPop.remove(); fontPop = null; } }
addEventListener('pointerdown', e => { if (fontPop && !e.target.closest('.fontpop') && !e.target.closest('#fontBtn')) closeFontPicker(); }, true);

/* ----- чтение/синхронизация полей ----- */
function readVal(t) {
  if (t.type === 'checkbox') return t.dataset.t === 'rv' ? (t.checked ? 'flashlight' : 'none') : t.checked;
  if (t.dataset.t === 'hex') return /^#?[0-9a-f]{6}$/i.test(t.value.trim()) ? ('#' + t.value.trim().replace('#', '')).toLowerCase() : null;
  if (t.dataset.t === 'n' || t.type === 'range') { const v = parseFloat(t.value); return isNaN(v) ? null : Math.max(+t.min || -Infinity, Math.min(t.max === '' ? Infinity : +t.max, v)); }
  return t.value;
}
function syncTwins(t, v) {
  const row = t.closest('.row'); if (!row) return;
  const key = t.dataset.k || t.dataset.g || t.dataset.d || t.dataset.pg;
  row.querySelectorAll('input').forEach(x => {
    if (x === t || (x.dataset.k || x.dataset.g || x.dataset.d || x.dataset.pg) !== key) return;
    if (x.type === 'color') x.value = v;
    else if (x.classList.contains('hex')) x.value = String(v).toUpperCase();
    else if (x.classList.contains('vnum')) x.value = fmtV(v, +x.step || 1);
    else x.value = v;
  });
}
function syncGeom() {
  const f = cur(); if (!f) return;
  ['x', 'y', 'w', 'h'].forEach(g => { const i = $('#g-' + g); if (i && document.activeElement !== i) i.value = fmtV(f.b[g], .1); });
  const r = $('#f-g-r'); if (r) { r.value = f.b.r; syncTwins(r, f.b.r); }
}
const insp = $('#insp');
// поля, после которых меняется сам набор контролов
const RERENDER_KEYS = new Set(['tfx', 'reveal', 'holo', 'pop']);
insp.addEventListener('input', e => {
  const t = e.target, f = cur();
  if (t.dataset.k && f) {
    let v = readVal(t);
    if (v === null) return;
    if (t.dataset.k === 'code') { v = String(v).replace(/\D/g, ''); if (v.length < 12) return; }
    f.b.p[t.dataset.k] = v; syncTwins(t, v); refreshBlock(f.b);
    if (['rx', 'ry', 'bend', 'lift'].includes(t.dataset.k)) placeSel();
  } else if (t.dataset.g && f) {
    const v = parseFloat(t.value); if (isNaN(v)) return;
    f.b[t.dataset.g] = (t.dataset.g === 'w' || t.dataset.g === 'h') ? Math.max(.2, v) : v;
    syncTwins(t, v); geom(f.b); placeSel();
    if (t.dataset.g !== 'r') refreshBlock(f.b);
  } else if (t.dataset.pg) {
    const pi = pageIndexById(activePage);
    if (t.dataset.pg === 'bg') { const v = readVal(t); if (!v) return; pages[pi].layout.bg = v; syncTwins(t, v); renderStage(); }
  } else if (t.dataset.d) {
    const v = readVal(t); if (v === null) return;
    ISSUE.settings[t.dataset.d] = v; syncTwins(t, v); renderStage();
  } else if (t.dataset.ui) {
    UI[t.dataset.ui] = readVal(t);
  }
});
async function lookupGame(q) {
  const f = cur(); if (!f || f.b.type !== 'game') return;
  const st = $('#gameState'); if (st) st.textContent = 'Ищу игру…';
  try {
    const {game} = await api('game.lookup', {q});
    Object.assign(f.b.p, {gameId: game.id, gameName: game.name, gameCover: game.cover || ''});
    refreshBlock(f.b); commit(); renderInspector(); renderLayers();
    toast(`«${game.name}» в журнале` + (game.state === 'ready' ? '' : ' — сборка подготовится при первом запуске'));
  } catch (err) { if ($('#gameState')) $('#gameState').textContent = err.message; }
}
insp.addEventListener('keydown', e => {
  if (e.target.dataset.gameq && e.key === 'Enter') { e.preventDefault(); lookupGame(e.target.value); }
  if (e.key === 'Enter' && e.target.classList.contains('vnum')) e.target.blur();
});
insp.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.gameq) { lookupGame(t.value); return; }
  if (t.dataset.actSel === 'demo' && t.value) { const f = cur(); f.b.p.src = t.value; refreshBlock(f.b); commit(); return; }
  if (t.dataset.k || t.dataset.g) { commit(); if (RERENDER_KEYS.has(t.dataset.k)) renderInspector(); }
  if (t.dataset.pg === 'bg') commit();
  if (t.dataset.pg === 'kind') structural('page.kind', {page: activePage, kind: t.value});
  if (t.dataset.d) saveSettings();
});
insp.addEventListener('click', e => {
  const f = cur();
  if (e.target.closest('#fontBtn')) { fontPop ? closeFontPicker() : openFontPicker(e.target.closest('#fontBtn')); return; }
  const sg = e.target.closest('[data-seg]');
  if (sg && f) {
    const key = sg.dataset.seg, v = sg.dataset.v;
    if (key === 'style') f.b.p[v] = !f.b.p[v];
    else f.b.p[key] = key === 'cols' ? +v : v;
    refreshBlock(f.b); commit(); renderInspector(); return;
  }
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (a) return act(a);
  const pp = e.target.closest('[data-paper]');
  if (pp) {
    const pi = pageIndexById(activePage), key = pp.dataset.paper, v = pp.dataset.v;
    pages[pi].layout[key] = v;
    if (key === 'material') pages[pi].layout.finish = 'auto';
    // жёсткость — свойство листа: лицо и оборот одинаковые, иначе page-flip сам сделает оба твёрдыми
    if (key === 'density') { const q = R.sheetPartner(pi, pages.length); if (q !== null) pages[q].layout.density = v; }
    renderStage(); renderStrip(); commit(); renderInspector();
    return;
  }
  const pa = e.target.closest('[data-pact]')?.dataset.pact;
  if (pa) return pageAct(pa);
});

function act(a) {
  const f = cur(); if (!f) return;
  const b = f.b, arr = pages[f.pi].layout.blocks;
  const zs = spreadZ(), top = Math.max(...zs), bot = Math.min(...zs);
  const o = offsetOf(f.pi);
  switch (a) {
    case 'del': arr.splice(arr.indexOf(b), 1); sel = null; renderStage(); renderLayers(); renderInspector(); commit(); toast('Блок удалён'); return;
    case 'dup': {
      const c = JSON.parse(JSON.stringify(b)); c.id = uid(); c.x += 5; c.y += 5; c.z = top + 1; c.lock = false;
      arr.push(c); renderStage(); select(c.id); commit(); return;
    }
    case 'front': b.z = top + 1; break;
    case 'back': spreadItems().forEach(([x]) => { if (x !== b) x.z += 1; }); b.z = bot; break;
    case 'lock': b.lock = !b.lock; placeSel(); renderLayers(); renderInspector(); commit(); return;
    case 'upload': $('#file').click(); return;
    case 'edit': if (!b.lock) startEdit(b); return;
    case 'quad': quadMode = !quadMode; placeSel(); renderInspector(); return;
    case 'resetT': b.p.q = [0, 0, 0, 0, 0, 0, 0, 0]; b.p.rx = 0; b.p.ry = 0; refreshBlock(b); placeSel(); commit(); renderInspector(); return;
    case 'corners': {
      const on = b.p.r1 >= 0 || b.p.r2 >= 0 || b.p.r3 >= 0 || b.p.r4 >= 0;
      ['r1', 'r2', 'r3', 'r4'].forEach(c => b.p[c] = on ? -1 : b.p.radius);
      refreshBlock(b); commit(); renderInspector(); return;
    }
    case 'popTest': {
      const el = elOf(b.id)?.parentNode; if (!el) return;
      clip.classList.remove('opening'); void clip.offsetWidth; clip.classList.add('opening');
      setTimeout(() => clip.classList.remove('opening'), 1600);
      return;
    }
    case 'fitM': Object.assign(b, {x: MARGIN, y: MARGIN, w: PW - 2 * MARGIN, h: PH - 2 * MARGIN, r: 0}); break;
    case 'fitS': Object.assign(b, {x: 0, y: 0, w: PW, h: PH, r: 0}); break;
    case 'fitSpread': Object.assign(b, {x: -o, y: 0, w: 2 * PW, h: PH, r: 0}); break;
  }
  renderStage(); syncGeom(); renderLayers(); commit();
}

/* ================= история и сохранение ================= */
let lastMap = new Map(pages.map(p => [p.id, JSON.stringify(p.layout)]));
let hist = [], fut = [];
const dirty = new Set();
let saveTimer = null, saving = false;

function commit() {
  const now = new Map(pages.map(p => [p.id, JSON.stringify(p.layout)]));
  let changed = false;
  now.forEach((v, id) => { if (lastMap.get(id) !== v) { dirty.add(id); changed = true; } });
  if (!changed) return;
  hist.push(lastMap); if (hist.length > 100) hist.shift();
  fut = [];
  lastMap = now;
  updateHistBtns(); scheduleSave(); renderStripSoon();
  if (sel) placeSel();
}
function restore(map) {
  pages.forEach(p => {
    const v = map.get(p.id);
    if (v !== undefined && v !== JSON.stringify(p.layout)) { p.layout = JSON.parse(v); dirty.add(p.id); }
  });
  lastMap = new Map(pages.map(p => [p.id, JSON.stringify(p.layout)]));
  if (sel && !find(sel)) sel = null;
  renderAll(); scheduleSave();
}
function undo() { if (!hist.length) return; fut.push(lastMap); restore(hist.pop()); }
function redo() { if (!fut.length) return; hist.push(lastMap); restore(fut.pop()); }
function updateHistBtns() { $('#undo').disabled = !hist.length; $('#redo').disabled = !fut.length; }
$('#undo').onclick = undo; $('#redo').onclick = redo;

function setSave(text, err = false) { const s = $('#saveState'); s.textContent = text; s.classList.toggle('err', err); }
function scheduleSave() { setSave('Есть изменения'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700); }

async function api(action, body = {}) {
  const r = await fetch(`${BOOT.api}?a=${action}`, {
    method: 'POST', headers: {'Content-Type': 'application/json', 'X-CSRF': BOOT.csrf},
    body: JSON.stringify({issue: ISSUE.id, ...body})
  });
  const j = await r.json().catch(() => ({ok: false, error: `Сервер ответил ${r.status}`}));
  if (!j.ok) throw new Error(j.error || 'Ошибка');
  return j;
}
async function flush() {
  clearTimeout(saveTimer);
  if (saving) { saveTimer = setTimeout(flush, 400); return; }
  if (!dirty.size) { setSave('Сохранено'); return; }
  const ids = [...dirty]; dirty.clear();
  const payload = ids.map(id => pages.find(p => p.id === id)).filter(Boolean).map(p => ({id: p.id, layout: p.layout}));
  saving = true; setSave('Сохраняю…');
  try {
    await api('page.save', {pages: payload});
    setSave(dirty.size ? 'Есть изменения' : 'Сохранено');
  } catch (err) {
    ids.forEach(id => dirty.add(id));
    setSave('Не сохранено — повтор через 5 с', true);
    saveTimer = setTimeout(flush, 5000);
  } finally { saving = false; }
}
addEventListener('beforeunload', () => {
  if (!dirty.size) return;
  const payload = [...dirty].map(id => pages.find(p => p.id === id)).filter(Boolean).map(p => ({id: p.id, layout: p.layout}));
  navigator.sendBeacon?.(`${BOOT.api}?a=page.save`, new Blob([JSON.stringify({issue: ISSUE.id, _csrf: BOOT.csrf, pages: payload})], {type: 'application/json'}));
});
let settingsTimer = null;
function saveSettings() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => api('issue.update', {settings: ISSUE.settings}).catch(err => toast(err.message)), 300);
}
const titleIn = $('#issueTitle');
titleIn.value = ISSUE.title;
titleIn.addEventListener('change', async () => {
  try { const j = await api('issue.update', {title: titleIn.value}); ISSUE.title = titleIn.value = j.title; document.title = j.title + ' — редактор'; toast('Название сохранено'); }
  catch (err) { toast(err.message); }
});
titleIn.addEventListener('keydown', e => { if (e.key === 'Enter') titleIn.blur(); e.stopPropagation(); });

/* ================= полосы: структура ================= */
async function structural(action, body, after) {
  await flush();
  try {
    const j = await api(action, body);
    const old = new Map(pages.map(p => [p.id, p]));
    pages = j.pages.map(b => ({id: b.id, kind: b.kind, layout: old.get(b.id)?.layout || {bg: '#ffffff', density: 'auto', material: 'auto', finish: 'auto', blocks: []}}));
    // структура поменялась — старая история к ней не применима
    hist = []; fut = []; lastMap = new Map(pages.map(p => [p.id, JSON.stringify(p.layout)])); updateHistBtns();
    if (sel && !find(sel)) sel = null;
    if (after) after(j);
    if (!pages.some(p => p.id === activePage)) activePage = pages[0].id;
    const want = spreadOf(pageIndexById(activePage));
    si = want >= 0 ? want : Math.min(si, spreads().length - 1);
    renderAll();
    return j;
  } catch (err) { toast(err.message); }
}
function insertAt() {
  // после текущего разворота, но перед задней обложкой в конце
  let at = Math.max(...curIdx()) + 1;
  if (at === pages.length && pages[pages.length - 1].kind === 'back' && pages.length > 1) at = pages.length - 1;
  return at;
}
$('#addSpread').onclick = () => structural('page.add', {count: 2, at: insertAt()}, j => { activePage = j.added[0]; toast('Разворот добавлен'); });
$('#addPage').onclick = () => structural('page.add', {count: 1, at: insertAt()}, j => { activePage = j.added[0]; toast('Полоса добавлена'); });
async function pageAct(a) {
  const pi = pageIndexById(activePage);
  if (a === 'delete') {
    if (!confirm(`Удалить полосу ${pi + 1} со всеми блоками? Отменить будет нельзя.`)) return;
    return structural('page.delete', {page: activePage}, () => toast('Полоса удалена'));
  }
  if (a === 'left' || a === 'right') return structural('page.move', {page: activePage, to: pi + (a === 'left' ? -1 : 1)});
  if (a === 'paperAll') {
    const {density, material} = pages[pi].layout;
    pages.forEach(p => { if (p.kind === 'page') { p.layout.density = density || 'auto'; p.layout.material = material || 'auto'; p.layout.finish = 'auto'; } });
    renderStage(); renderStrip(); commit(); renderInspector();
    return toast('Бумага применена ко всем внутренним полосам');
  }
  if (a === 'unpublish') {
    try { await api('unpublish'); ISSUE.status = 'draft'; syncPublish(); renderInspector(); toast('Выпуск снят с публикации'); } catch (err) { toast(err.message); }
  }
}

/* ================= лента разворотов ================= */
function renderStrip() {
  $('#spreads').innerHTML = spreads().map((sp, n) => {
    const solo = sp.length === 1 && sp[0] === 0 ? ' solo-r' : '';
    const label = sp.length === 2 ? `${sp[0] + 1}–${sp[1] + 1}` : `${sp[0] + 1}`;
    const thumbs = sp.map(i => R.renderPageHTML(pages, i, ISSUE.settings, {base: BOOT.base, stat: true, salt: 't' + n})).join('');
    return `<button class="spr${n === si ? ' cur' : ''}" data-si="${n}" title="${sp.map(i => KIND_NAMES[pages[i].kind]).join(' + ')}"><span class="pp${solo}">${thumbs}</span><small>${label}</small></button>`;
  }).join('');
  $('#spreads .cur')?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  R.applyQuads($('#spreads'));
}
let stripTimer = null;
function renderStripSoon() { clearTimeout(stripTimer); stripTimer = setTimeout(renderStrip, 400); }
$('#spreads').addEventListener('click', e => { const b = e.target.closest('.spr'); if (b) goSpread(+b.dataset.si); });
function goSpread(n) {
  n = Math.max(0, Math.min(spreads().length - 1, n));
  if (n === si) return;
  if (editing) document.activeElement?.blur?.();
  si = n; sel = null; quadMode = false; activePage = pages[curIdx()[0]].id;
  renderAll();
}

/* ================= публикация ================= */
function syncPublish() {
  const pub = ISSUE.status === 'published';
  $('#bPublish').textContent = pub ? 'Обновить выпуск' : 'Опубликовать';
  const r = $('#bRead'); r.hidden = !pub; r.href = BOOT.viewer;
}
$('#bPublish').onclick = async () => {
  const btn = $('#bPublish'); btn.disabled = true;
  await flush();
  try {
    const j = await api('publish');
    ISSUE.status = 'published'; syncPublish(); renderInspector();
    toast(`Собрано ${j.count} HTML-страниц — выпуск доступен читателям`);
  } catch (err) { toast(err.message); }
  btn.disabled = false;
};

/* ================= зум, просмотр, клавиатура ================= */
function setK(v) {
  k = Math.max(.5, Math.min(8, v));
  document.documentElement.style.setProperty('--k', k);
  $('#zfit').textContent = Math.round(k / 3.7795 * 100) + '%';
  placeSel();
  afterPaint();
}
function fit() {
  const r = desk.getBoundingClientRect();
  setK(Math.min((r.width - 110) / spreadW(), (r.height - 120) / PH));
}
$('#zin').onclick = () => { fitted = false; setK(k * 1.2); };
$('#zout').onclick = () => { fitted = false; setK(k / 1.2); };
$('#zfit').onclick = () => { fitted = true; fit(); };
desk.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); fitted = false; setK(k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } }, {passive: false});
new ResizeObserver(() => { if (fitted) fit(); }).observe(desk);
$('#bPreview').onclick = () => {
  UI.preview = document.body.classList.toggle('preview');
  $('#bPreview').classList.toggle('on', UI.preview);
  if (UI.preview && editing) document.activeElement.blur();
  if (UI.preview) { quadMode = false; placeSel(); }
};

addEventListener('keydown', e => {
  if (editing || e.target.closest?.('input,select,textarea')) return;
  const mod = e.ctrlKey || e.metaKey, f = cur();
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); flush(); return; }
  if (e.key === 'PageDown') { e.preventDefault(); goSpread(si + 1); return; }
  if (e.key === 'PageUp') { e.preventDefault(); goSpread(si - 1); return; }
  if (e.key.toLowerCase() === 'p' && !mod) { $('#bPreview').click(); return; }
  if (!f) return;
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); act('dup'); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('del'); return; }
  if (e.key === 'Escape') { if (quadMode) { quadMode = false; placeSel(); renderInspector(); } else select(null); return; }
  if (e.key === 'Enter' && TYPES[f.b.type].fam === 'text' && !f.b.lock) { e.preventDefault(); startEdit(f.b); return; }
  if (e.key === ']') { act('front'); return; }
  if (e.key === '[') { act('back'); return; }
  if (e.key.toLowerCase() === 't' && !mod) { act('quad'); return; }
  const d = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
  if (d && !f.b.lock) {
    e.preventDefault(); const s = e.shiftKey ? 5 : 1;
    f.b.x += d[0] * s; f.b.y += d[1] * s; geom(f.b); placeSel(); syncGeom();
    clearTimeout(act._t); act._t = setTimeout(commit, 300);
  }
});

/* ================= старт ================= */
function renderAll() {
  renderStage(); renderLayers(); renderInspector(); renderStrip(); updateHistBtns(); syncPublish();
  if (fitted) fit();
}

// новый выпуск «с примером»: раскладываем шаблоны один раз и сохраняем
if (ISSUE.settings.starter) {
  if (pages[0]) applyPageTemplate('coverPhoto', 0);
  if (pages[1] && pages[2]) {
    const keep = si; si = 1; applySpreadTemplate('classic'); si = keep;
  }
  const last = pages.length - 1;
  if (last >= 3 && pages[last].kind === 'back') applyPageTemplate('backCover', last);
  pages.forEach(p => dirty.add(p.id));
  lastMap = new Map(pages.map(p => [p.id, JSON.stringify(p.layout)]));
  ISSUE.settings.starter = false;
  api('issue.update', {settings: ISSUE.settings}).catch(() => {});
  setTimeout(flush, 50);
}

setK(2);
renderAll();
document.fonts?.ready.then(() => clip.querySelectorAll('.blk').forEach(checkOverset));
})();
