/* newmagazine/studio/assets/render.js
   Общий JS-рендерер полосы. Строка в строку повторяет render.php — это проверяет tests/parity.
   Используется редактором (разметка на столе и миниатюры) и вьюером (дисторсия, applyQuads).
   Меняешь вывод здесь — поменяй и в render.php, иначе тест паритета упадёт. */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.MagRender = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PW = 210, PH = 297, PT = 0.3528;

  const FONTS = {
    'Playfair Display': 'serif', 'Yeseva One': 'serif', 'Cormorant Garamond': 'serif', 'Literata': 'serif', 'PT Serif': 'serif',
    'Unbounded': 'sans-serif', 'Oswald': 'sans-serif', 'Onest': 'sans-serif', 'Manrope': 'sans-serif', 'Rubik Mono One': 'sans-serif',
    'IBM Plex Mono': 'monospace'
  };
  const SHAPES = {
    rect: 'none', circle: 'ellipse(50% 50% at 50% 50%)', arch: 'inset(0 round 9999px 9999px 0 0)',
    slant: 'polygon(0 0,100% 0,100% 86%,0 100%)', diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
    hex: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
    star: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
    ticket: 'polygon(0 0,100% 0,100% 40%,94% 50%,100% 60%,100% 100%,0 100%,0 60%,6% 50%,0 40%)'
  };
  const FAMS = {
    heading: 'text', lead: 'text', body: 'text', author: 'text', rubric: 'text', quote: 'text', caption: 'text',
    masthead: 'text', issue: 'text', coverline: 'text', badge: 'text',
    image: 'image', shape: 'box', rule: 'box', barcode: 'barcode', game: 'game'
  };
  const VA = {top: 'flex-start', middle: 'center', bottom: 'flex-end'};
  const STIFF_ORDER = ['thin', 'soft', 'stiff', 'hard'];

  /* ---------- числа и строки: одинаково с PHP ---------- */
  const r3 = v => { v = +v || 0; const s = v < 0 ? -1 : 1; return s * Math.floor(Math.abs(v) * 1000 + 0.5) / 1000; };
  const num = v => { const s = r3(v).toFixed(3).replace(/\.?0+$/, ''); return (s === '-0' || s === '') ? '0' : s; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[c]));
  const fontStack = f => `'${f}', ${FONTS[f] || 'sans-serif'}`;
  const isCustomFont = f => !FONTS[f];

  /* ---------- EAN-13 ---------- */
  function ean13(code) {
    let d = (String(code || '').replace(/\D/g, '') + '000000000000').slice(0, 12);
    let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * (i % 2 ? 3 : 1);
    d += (10 - s % 10) % 10;
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const R = L.map(p => p.replace(/./g, c => c === '0' ? '1' : '0'));
    const G = R.map(p => p.split('').reverse().join(''));
    const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    let bits = '101';
    for (let i = 1; i < 7; i++) bits += (PAR[+d[0]][i - 1] === 'L' ? L : G)[+d[i]];
    bits += '01010';
    for (let i = 7; i < 13; i++) bits += R[+d[i]];
    return {digits: d, bits: bits + '101'};
  }
  function barcodeSVG(bits) {
    let r = '';
    for (let i = 0; i < bits.length;) {
      if (bits[i] !== '1') { i++; continue; }
      let j = i; while (j < bits.length && bits[j] === '1') j++;
      r += `<rect x="${i}" width="${j - i}" height="1"/>`; i = j;
    }
    return `<svg viewBox="0 0 ${bits.length} 1" preserveAspectRatio="none" aria-hidden="true">${r}</svg>`;
  }

  /* ---------- эффекты текста (тиснение, выпуклость, WordArt) ---------- */
  function textFx(p) {
    const kind = p.tfx || 'none';
    if (kind === 'none') return [];
    const D = +p.tfxD || 0, k = D / 10, C = p.tfxC || '#000000';
    const a = (+p.tfxA || 0) * Math.PI / 180;
    const dx = r3(Math.cos(a)), dy = r3(Math.sin(a));
    const e = v => num(v) + 'em';
    switch (kind) {
      case 'emboss':
        return [['--tsh', `${e(-dx * k * .03)} ${e(-dy * k * .03)} 0 rgba(255,255,255,.75), ${e(dx * k * .03)} ${e(dy * k * .03)} 0 rgba(0,0,0,.45), ${e(dx * k * .07)} ${e(dy * k * .07)} ${e(k * .08)} rgba(0,0,0,.25)`]];
      case 'deboss':
        return [['--tsh', `${e(dx * k * .03)} ${e(dy * k * .03)} 0 rgba(255,255,255,.7), ${e(-dx * k * .03)} ${e(-dy * k * .03)} 0 rgba(0,0,0,.5)`]];
      case 'extrude': {
        const n = Math.max(1, Math.floor(D + 0.5));
        const parts = [];
        for (let i = 1; i <= n; i++) parts.push(`${e(dx * i * .012)} ${e(dy * i * .012)} 0 ${C}`);
        parts.push(`${e(dx * (n + 2) * .012)} ${e(dy * (n + 2) * .012)} ${e(.05 + n * .01)} rgba(0,0,0,.35)`);
        return [['--tsh', parts.join(', ')]];
      }
      case 'outline':
        return [['--tst', `${e(Math.max(.01, k * .03))} ${C}`]];
      case 'neon':
        return [['--tsh', `0 0 ${e(.04 * k)} #fff, 0 0 ${e(.18 * k)} ${C}, 0 0 ${e(.45 * k)} ${C}, 0 0 ${e(.9 * k)} ${C}`]];
      case 'foil':
        return [
          ['--tfill', `linear-gradient(115deg, color-mix(in srgb, ${C} 55%, #000) 0%, color-mix(in srgb, ${C} 35%, #fff) 28%, ${C} 46%, #fff 54%, color-mix(in srgb, ${C} 70%, #000) 74%, ${C} 100%)`],
          ['--tdrop', `drop-shadow(${e(dx * k * .02)} ${e(dy * k * .02)} ${e(k * .03)} rgba(0,0,0,.35))`]
        ];
    }
    return [];
  }

  /* ---------- CSS-переменные блока ---------- */
  function blockVars(b, dx) {
    const p = b.p, fam = FAMS[b.type];
    const v = [['--x', num(b.x + dx)], ['--y', num(b.y)], ['--w', num(b.w)], ['--h', num(b.h)], ['--r', num(b.r)], ['--z', String(b.z)],
      ['--op', num(p.opacity)], ['--bl', p.blend], ['--rad', num(p.radius)], ['--pad', num(p.pad)]];
    ['r1', 'r2', 'r3', 'r4'].forEach(k => { if (p[k] !== undefined && p[k] >= 0) v.push(['--' + k, num(p[k])]); });
    if (p.shape !== 'rect') v.push(['--clip', SHAPES[p.shape]]);
    if (p.bgOn) v.push(['--bg', p.bg]);
    if (p.bw > 0) v.push(['--bw', num(p.bw)], ['--bc', p.bc]);
    if (p.rx || p.ry) v.push(['--rx', num(p.rx)], ['--ry', num(p.ry)], ['--persp', num(p.persp)]);
    if (p.lift > 0) v.push(['--lift', num(p.lift)]);
    if (p.reveal === 'flashlight') v.push(['--revr', num(p.revR)]);
    if (p.holo && p.holo !== 'none') v.push(['--holoA', num(p.holoA)]);
    if (fam === 'text') {
      v.push(['--ff', fontStack(p.font)], ['--fs', num(p.size)], ['--fw', String(p.weight)],
        ['--fst', p.italic ? 'italic' : 'normal'], ['--tt', p.upper ? 'uppercase' : 'none'], ['--ta', p.align],
        ['--lh', num(p.lh)], ['--ls', num(p.ls)], ['--c', p.color], ['--va', VA[p.valign]]);
      if (p.dc !== undefined) v.push(['--dc', p.dc]);
      if (b.type === 'body') v.push(['--cols', num(p.cols)], ['--gap', num(p.gap)]);
      textFx(p).forEach(x => v.push(x));
    } else if (fam === 'image') {
      v.push(['--fit', p.fit], ['--fx', num(p.fx)], ['--fy', num(p.fy)], ['--zm', num(p.zoom)], ['--gr', num(p.gray)], ['--con', num(p.contrast)]);
      if (p.tintOn) v.push(['--tint', p.tint], ['--tA', num(p.tintA)], ['--tm', p.tintMode]);
    } else if (fam === 'barcode') {
      v.push(['--c', p.color]);
    } else if (fam === 'game') {
      v.push(['--fit', p.fit], ['--gac', p.accent]);
    }
    return v.map(([k, x]) => k + ':' + x + ';').join('');
  }

  const quadActive = q => Array.isArray(q) && q.length === 8 && q.some(x => x !== 0);

  function blockAttrs(b) {
    const p = b.p, fam = FAMS[b.type];
    let a = '';
    if (p.rx || p.ry) a += ' data-3d';
    if (p.lift > 0) a += ' data-lift';
    if (p.pop) a += ' data-pop';
    if (p.holo && p.holo !== 'none') a += (fam === 'text' ? ' data-holot="' : ' data-holo="') + p.holo + '"';
    if (fam === 'text' && p.tfx && p.tfx !== 'none') a += ' data-tfx="' + p.tfx + '"';
    if (p.reveal === 'flashlight') a += ' data-rv';
    if (p.peel) a += ' data-peel="' + b.id + '"';
    if (quadActive(p.q)) a += ' data-q="' + p.q.map(num).join(' ') + '"';
    return a;
  }

  /* ---------- изогнутый текст: SVG textPath, размеры в мм ---------- */
  function bendSVG(b, salt) {
    const p = b.p;
    const IW = r3(Math.max(1, b.w - 2 * p.pad)), IH = r3(Math.max(1, b.h - 2 * p.pad));
    const fs = r3(p.size * PT), LH = r3(fs * p.lh);
    const lines = String(b.text).split('\n');
    const T = lines.length * LH;
    const y0 = p.valign === 'middle' ? (IH - T) / 2 : p.valign === 'bottom' ? IH - T : 0;
    const apex = p.bend / 100 * IW * 0.25;
    const anchor = p.align === 'left' ? ['start', '0'] : p.align === 'right' ? ['end', '100'] : ['middle', '50'];
    let defs = '', texts = '';
    lines.forEach((line, i) => {
      const y = y0 + LH * i + LH * 0.5 + fs * 0.35;
      const id = `bp-${salt}${b.id}-${i}`;
      defs += `<path id="${id}" d="M0 ${num(y)} Q${num(IW / 2)} ${num(y - 2 * apex)} ${num(IW)} ${num(y)}"/>`;
      texts += `<text text-anchor="${anchor[0]}" style="font-size:${num(fs)}px;letter-spacing:${num(p.ls)}em"><textPath href="#${id}" startOffset="${anchor[1]}%">${esc(line)}</textPath></text>`;
    });
    return `<svg class="bend" viewBox="0 0 ${num(IW)} ${num(IH)}"><defs>${defs}</defs>${texts}</svg>`;
  }

  function blockInner(b, o) {
    const p = b.p, fam = FAMS[b.type];
    if (fam === 'text') {
      if (b.type === 'body') {
        const cls = 'tx' + (p.dropcap ? ' dc' : '') + (p.indent ? ' ind' : '');
        return `<div class="${cls}">` + String(b.text).split('\n').filter(s => s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '') !== '').map(s => `<p>${esc(s)}</p>`).join('') + '</div>';
      }
      if (p.bend && !o.plain) return `<div class="tx bent">${bendSVG(b, o.salt || '')}</div>`;
      return `<div class="tx${b.type === 'quote' && !p.marks ? ' nomark' : ''}">${esc(b.text)}</div>`;
    }
    if (fam === 'image') {
      if (p.src) return `<img src="${esc(o.base + '/' + p.src)}" alt="" decoding="async" draggable="false">` + (p.tintOn ? '<div class="tint"></div>' : '');
      return o.ph ? '<div class="ph">Перетащите фото<br>или выберите файл</div>' : '';
    }
    if (fam === 'game') {
      let h = p.gameCover ? `<img class="gm-cover" src="${esc(p.gameCover)}" alt="" loading="lazy" decoding="async" draggable="false">` : '';
      if (p.gameId > 0) {
        h += o.stat
          ? `<span class="gm-play"><i></i><span>${esc(p.label)}</span></span>`
          : `<button class="gm-play" type="button" data-game="${p.gameId}" data-name="${esc(p.gameName)}" aria-label="${esc(p.label + ': ' + p.gameName)}"><i></i><span>${esc(p.label)}</span></button>`;
      } else if (o.ph) h += '<div class="gm-empty">Укажите игру</div>';
      if (p.showName && p.gameName !== '') h += `<div class="gm-name">${esc(p.gameName)}</div>`;
      return h;
    }
    if (fam === 'barcode') {
      const {digits: d, bits} = ean13(p.code);
      return barcodeSVG(bits) + `<div class="bcn">${d[0]} ${d.slice(1, 7)} ${d.slice(7)}</div>`;
    }
    return '';
  }

  // o: {base, ph, stat, extra, salt, plain}
  function renderBlockHTML(b, dx, o) {
    o = Object.assign({base: '', ph: false, stat: false, extra: '', salt: '', plain: false}, o || {});
    return `<div class="blk t-${b.type}"${o.extra}${blockAttrs(b)} style="${esc(blockVars(b, dx || 0))}"><div class="ct">${blockInner(b, o)}</div></div>`;
  }

  /* ---------- полоса ---------- */
  function facing(i, count) {
    if (i === 0) return null;
    const f = i % 2 === 1 ? i + 1 : i - 1;
    return f >= 1 && f < count ? f : null;
  }
  const sheetPartner = (i, count) => { const p = i % 2 === 0 ? i + 1 : i - 1; return p >= 0 && p < count ? p : null; };

  function materialOf(pg) {
    let m = pg.layout.material || 'auto';
    if (m === 'auto') {
      const f = pg.layout.finish || 'auto';          // старые макеты: finish → material
      if (f === 'gloss' || f === 'matte') m = f;
    }
    if (m === 'auto') m = pg.kind === 'page' ? 'offset' : 'gloss';
    return m;
  }
  function stiffOf(pg) {
    const d = pg.layout.density || 'auto';
    if (d !== 'auto') return d;
    if (pg.kind !== 'page') return 'hard';
    const m = materialOf(pg);
    return m === 'news' ? 'thin' : (m === 'gloss' || m === 'holo' || m === 'foil') ? 'stiff' : 'soft';
  }
  // жёсткость — свойство листа (лицо + оборот), покрытие — свойство полосы
  function paper(pages, i) {
    let s = stiffOf(pages[i]);
    const q = sheetPartner(i, pages.length);
    if (q !== null) { const t = stiffOf(pages[q]); if (STIFF_ORDER.indexOf(t) > STIFF_ORDER.indexOf(s)) s = t; }
    return {density: s === 'hard' ? 'hard' : 'soft', stiff: s, material: materialOf(pages[i]), side: i % 2 === 0 ? 'R' : 'L'};
  }
  function paperAttrs(pages, i) {
    const q = paper(pages, i);
    return ` data-density="${q.density}" data-stiff="${q.stiff}" data-material="${q.material}" data-side="${q.side}"`;
  }
  function folioHTML(pages, i, s) {
    if (!s.folios || pages[i].kind !== 'page') return '';
    const side = i % 2 === 1 ? 'L' : 'R';
    const n = `<b>${i + 1}</b>`, m = `<span>${esc(s.mag)}</span>`;
    return `<div class="folio ${side}">${side === 'L' ? n + m : m + n}</div>`;
  }
  const pageStyle = (pages, i, s) => `--pg-bg:${pages[i].layout.bg};--folio:${s.folioColor}`;

  // блоки полосы + заходящие с соседней, по z; при равном z левая полоса ниже правой (как на столе)
  function pageItems(pages, i) {
    const items = [];
    const add = (pi, dx) => pages[pi].layout.blocks.forEach(b => {
      if (b.hide) return;
      if (dx !== 0 && !(b.x + dx < PW && b.x + dx + b.w > 0)) return;
      items.push([b, dx, pi]);
    });
    add(i, 0);
    const f = facing(i, pages.length);
    if (f !== null) add(f, i % 2 === 1 ? PW : -PW);
    items.sort((a, c) => (a[0].z - c[0].z) || (a[2] - c[2]));
    return items;
  }
  function renderPageHTML(pages, i, s, o) {
    o = o || {};
    const html = pageItems(pages, i).map(([b, dx, pi]) => renderBlockHTML(b, dx, Object.assign({}, o, {salt: (o.salt || '') + (pi === i ? '' : 'f')}))).join('');
    return `<div class="pg kind-${pages[i].kind}"${paperAttrs(pages, i)} style="${esc(pageStyle(pages, i, s))}">${html}${folioHTML(pages, i, s)}</div>`;
  }
  function customFonts(pages) {
    const out = new Set();
    pages.forEach(pg => pg.layout.blocks.forEach(b => { if (FAMS[b.type] === 'text' && isCustomFont(b.p.font)) out.add(b.p.font); }));
    return [...out];
  }
  const fontCssUrl = (name, bold) => 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + (bold ? ':wght@700' : '') + '&display=swap';

  /* ---------- свободная трансформация (4 угла) ----------
     matrix3d нужен в пикселях, а полоса масштабируется, поэтому считаем на месте по реальному размеру. */
  function quadMatrix(W, H, q) {
    const x0 = q[0] * W, y0 = q[1] * H, x1 = W + q[2] * W, y1 = q[3] * H;
    const x2 = W + q[4] * W, y2 = H + q[5] * H, x3 = q[6] * W, y3 = H + q[7] * H;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let a, bb, c = x0, d, e, f = y0, g = 0, h = 0;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
      a = x1 - x0; bb = x3 - x0; d = y1 - y0; e = y3 - y0;
    } else {
      const det = dx1 * dy2 - dx2 * dy1 || 1e-9;
      g = (dx3 * dy2 - dx2 * dy3) / det; h = (dx1 * dy3 - dx3 * dy1) / det;
      a = x1 - x0 + g * x1; bb = x3 - x0 + h * x3; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3;
    }
    return `matrix3d(${[a / W, d / W, 0, g / W, bb / H, e / H, 0, h / H, 0, 0, 1, 0, c, f, 0, 1].map(n => +n.toFixed(6)).join(',')})`;
  }
  function applyQuads(root) {
    (root || document).querySelectorAll('.blk[data-q]').forEach(el => {
      const ct = el.querySelector('.ct'); if (!ct) return;
      const W = ct.offsetWidth, H = ct.offsetHeight; if (!W || !H) return;
      const q = el.dataset.q.split(' ').map(Number);
      ct.style.transformOrigin = '0 0';
      ct.style.transform = quadMatrix(W, H, q);
    });
  }

  return {PW, PH, PT, FONTS, SHAPES, FAMS, VA, r3, num, esc, fontStack, isCustomFont, ean13, textFx, blockVars, blockAttrs,
    bendSVG, blockInner, renderBlockHTML, facing, sheetPartner, materialOf, stiffOf, paper, paperAttrs, folioHTML, pageStyle,
    pageItems, renderPageHTML, customFonts, fontCssUrl, quadMatrix, applyQuads};
});
