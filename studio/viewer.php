<?php
// newmagazine/studio/viewer.php?i=<slug>
// Просмотрщик: берёт экспортированные pageN.html выпуска и в цикле кладёт каждую в свой Shadow DOM
// (Declarative Shadow DOM — без fetch и без JS-сборки), затем page-flip превращает их в листаемую книгу.

declare(strict_types=1);
require_once __DIR__ . '/lib.php';

$slug = (string)($_GET['i'] ?? '');
if (!preg_match('/^[a-z0-9]{6,16}$/', $slug)) { http_response_code(404); exit('Выпуск не найден'); }

$st = db()->prepare("SELECT * FROM mag_issues WHERE slug = ? AND status = 'published'");
$st->execute([$slug]);
$issue = $st->fetch();
$dir = STUDIO_DIR . '/issues/' . $slug;
$manifest = is_file("$dir/pages.json") ? json_decode((string)file_get_contents("$dir/pages.json"), true) : null;
if (!$issue || !$manifest) { http_response_code(404); exit('Выпуск не найден или снят с публикации'); }

// Разбираем файл страницы: стили (кроме data-doc) + содержимое body.
// Для страниц, свёрстанных руками (как старые page0.html), html/body превращаются в :host — как в App.js.
function page_parts(string $file): array
{
    $html = (string)@file_get_contents($file);
    preg_match_all('~<style(\s[^>]*)?>(.*?)</style>~si', $html, $m, PREG_SET_ORDER);
    $css = '';
    foreach ($m as $s) {
        if (stripos($s[1] ?? '', 'data-doc') !== false) continue;
        $css .= $s[2] . "\n";
    }
    $css = preg_replace('/(^|[\s,}])(?:html|body)(?=[\s,{.:#\[])/', '$1:host', $css);
    $body = preg_match('~<body[^>]*>(.*)</body>~si', $html, $b) ? $b[1] : '';
    $body = preg_replace('~<script\b.*?</script>~si', '', $body);
    return [$css, $body];
}

$pages = [];
foreach ($manifest['pages'] as $p) {
    $file = basename((string)$p['file']);
    if (!preg_match('/^page\d+\.html$/', $file)) continue;
    [$css, $body] = page_parts("$dir/$file");
    $kind = $p['kind'] ?? 'page';
    // старые манифесты без поля density: обложки твёрдые
    $density = in_array($p['density'] ?? '', ['soft', 'hard'], true) ? $p['density'] : ($kind === 'page' ? 'soft' : 'hard');
    $stiff = in_array($p['stiff'] ?? '', MAG_STIFF, true) ? $p['stiff'] : ($density === 'hard' ? 'hard' : 'soft');
    $material = in_array($p['material'] ?? '', MAG_MATTER, true) ? $p['material'] : (($p['finish'] ?? '') === 'gloss' || $kind !== 'page' ? 'gloss' : 'matte');
    $pages[] = ['kind' => $kind, 'density' => $density, 'stiff' => $stiff, 'material' => $material, 'css' => $css, 'body' => $body];
}
$title = $issue['title'];

// Ленивая изоляция. Unity/Godot из webplayer'а просят SharedArrayBuffer, а он появляется в iframe,
// только если сам журнал отдан с COOP/COEP. Включаем заголовки, лишь когда в выпуске есть такая
// уже подготовленная игра; `credentialless` (а не require-corp) не ломает Google Fonts и обложки с S3.
$needIso = false;
foreach ((array)($manifest['games'] ?? []) as $gid) {
    $m = webplayer_meta((int)$gid);
    if (($m['state'] ?? '') === 'ready' && !empty($m['isolated'])) { $needIso = true; break; }
}
if ($needIso) {
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Embedder-Policy: credentialless');
}
$wp = ['url' => cfg('webplayer_url'), 'data' => cfg('webplayer_data_url')];
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($title) ?></title>
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:type" content="book">
<link rel="stylesheet" href="<?= e(cfg('fonts_css')) ?>">
<?php foreach ((array)($manifest['fonts'] ?? []) as $fu): if (strpos((string)$fu, 'https://fonts.googleapis.com/') === 0): ?>
<link rel="stylesheet" href="<?= e($fu) ?>">
<?php endif; endforeach; ?>
<style>
  /* регистрируем --gx, чтобы блик глянца плавно ехал через transition (и внутри Shadow DOM тоже) */
  @property --gx{syntax:'<percentage>';inherits:true;initial-value:28%}
  @property --pe{syntax:'<number>';inherits:true;initial-value:9}
  html,body{height:100%}
  body{margin:0;background:#0d0118;color:#ece8f2;font:13px/1.4 Onest,system-ui,sans-serif;overflow:hidden}
  .vw-bar{position:fixed;inset:0 0 auto 0;height:52px;display:flex;align-items:center;gap:10px;padding:0 16px;padding-top:env(safe-area-inset-top,0px);z-index:10;
    background:linear-gradient(#0d0118 60%,rgba(13,1,24,0))}
  .vw-bar a,.vw-bar button{color:inherit;text-decoration:none;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:7px;height:32px;min-width:32px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:inherit}
  .vw-bar a:hover,.vw-bar button:hover{background:rgba(255,255,255,.12)}
  .vw-title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .vw-grow{flex:1}
  .vw-count{font:12px "IBM Plex Mono",monospace;color:#9a92a8;min-width:64px;text-align:center}
  .vw-stage{position:fixed;inset:52px 0 0 0;display:flex;align-items:center;justify-content:center;padding:12px 16px 24px;overflow:hidden;touch-action:none}
  .vw-zoom{width:100%;display:flex;transform-origin:0 0}
  .vw-stage.is-zoomed{cursor:grab}
  .vw-stage.is-panning{cursor:grabbing}
  .vw-stage.is-panning .vw-zoom{will-change:transform}
  .vw-zoomctl{display:flex;align-items:center;gap:2px}
  .vw-zoomctl output{font:12px "IBM Plex Mono",monospace;color:#9a92a8;min-width:44px;text-align:center}
  .vw-hint{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(20,10,28,.85);border:1px solid rgba(255,255,255,.12);color:#cfc8da;font-size:12px;padding:6px 12px;border-radius:99px;pointer-events:none;opacity:0;transition:opacity .25s;z-index:20}
  .vw-hint.show{opacity:1}
  .vw-fit{width:min(100%, calc((100vh - 100px) * 2 * 595 / 842), calc((100dvh - 100px) * 2 * 595 / 842));margin:auto}
  .vw-book{width:100%}
  .vw-page{background:#fff;overflow:hidden}
  /* page-flip перезаписывает style у .vw-page каждый кадр, поэтому блик живёт на .host */
  .vw-page .host{--gx:28%;--rvon:0;transition:--gx .25s ease-out}
  .vw-book.is-flipping .host{transition:--gx .7s ease-in-out}
  /* твёрдый лист: чуть скруглённый картон с гранью */
  .vw-page[data-density="hard"]{border-radius:2px}
  .vw-page[data-density="hard"].--right{box-shadow:inset 1px 0 0 rgba(0,0,0,.25), inset -1px 0 0 rgba(255,255,255,.35)}
  .vw-page[data-density="hard"].--left{box-shadow:inset -1px 0 0 rgba(0,0,0,.25), inset 1px 0 0 rgba(255,255,255,.35)}
  .vw-page .host{width:100%;height:100%}
  .vw-page.--left{box-shadow:inset -12px 0 18px -12px rgba(0,0,0,.35)}
  .vw-page.--right{box-shadow:inset 12px 0 18px -12px rgba(0,0,0,.35)}
  :focus-visible{outline:2px solid #e0489a;outline-offset:2px}

  /* плеер: один на весь журнал, живёт поверх книги, а не внутри страницы */
  .gp{position:fixed;z-index:50;background:#000;box-shadow:0 0 0 1px rgba(255,255,255,.14),0 24px 70px rgba(0,0,0,.65)}
  .gp.is-max{inset:104px 16px 16px!important;width:auto!important;height:auto!important}
  .gp-screen,.gp-screen iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#000}
  .gp-bar{position:absolute;left:0;right:0;bottom:100%;height:34px;display:flex;align-items:center;gap:4px;padding-bottom:4px}
  .gp.is-max .gp-bar{bottom:auto;top:-40px}
  .gp-title{background:#c32178;color:#fff;font-weight:600;font-size:12px;padding:6px 10px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
  .gp-bar a,.gp-bar button{margin-left:auto;color:#fff;text-decoration:none;background:rgba(20,10,28,.85);border:1px solid rgba(255,255,255,.14);border-radius:6px;height:28px;min-width:28px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:inherit}
  .gp-bar a~a,.gp-bar a~button,.gp-bar button~button{margin-left:0}
  .gp-bar a:hover,.gp-bar button:hover{background:#c32178}
  .gp-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;
    background:radial-gradient(420px 260px at 50% 35%,rgba(195,33,120,.25),transparent 70%),#0b0210}
  .gp-veil[hidden],.gp-err[hidden]{display:none}
  .gp-veil p{margin:0;max-width:40ch;color:rgba(236,232,242,.75);font-size:13px;line-height:1.5}
  .gp-step{font:11px "IBM Plex Mono",monospace;color:#9a92a8;letter-spacing:.05em}
  .gp-err{font:12px "IBM Plex Mono",monospace;color:#ff8fa8;background:rgba(255,95,122,.1);padding:8px 12px;max-width:46ch;word-break:break-word}
  .gp-spin{width:28px;height:28px;border:3px solid rgba(255,255,255,.14);border-top-color:#c32178;border-radius:50%;animation:gpspin .8s linear infinite}
  @keyframes gpspin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.gp-spin{animation-duration:3s}}
</style>
</head>
<body>
<header class="vw-bar">
  <a href="<?= e(base_path()) ?>/" title="Все выпуски">←</a>
  <span class="vw-title"><?= e($title) ?></span>
  <span class="vw-grow"></span>
  <button id="prev" aria-label="Назад">‹</button>
  <span class="vw-count" id="count">1 / <?= count($pages) ?></span>
  <button id="next" aria-label="Вперёд">›</button>
  <span class="vw-zoomctl"><button id="zout" title="Отдалить (−)">−</button><output id="zval" title="Сбросить масштаб (0)">100%</output><button id="zin" title="Приблизить (+ или колесо мыши)">+</button></span>
  <button id="fs" title="Во весь экран">⤢</button>
</header>
<main class="vw-stage" id="stage">
  <div class="vw-zoom" id="zoom"><div class="vw-fit"><div class="vw-book" id="book">
    <?php foreach ($pages as $i => $p): ?>
    <div class="vw-page" data-density="<?= $p['density'] ?>" data-stiff="<?= $p['stiff'] ?>" data-material="<?= $p['material'] ?>">
      <div class="host"><template shadowrootmode="open" shadowrootclonable><style>:host{display:block;width:100%;height:100%;overflow:hidden}.pg{width:100%!important;height:100%}</style><style><?= $p['css'] ?></style><?= $p['body'] ?></template></div>
    </div>
    <?php endforeach; ?>
  </div></div></div>
</main>
<div class="vw-hint" id="hint">Масштаб: перетаскивайте разворот мышью · 0 — вернуть</div>
<div class="gp" id="gp" hidden>
  <div class="gp-bar">
    <span class="gp-title" id="gpTitle"></span>
    <a id="gpOpen" target="_blank" rel="noopener" title="Открыть в отдельном плеере">↗</a>
    <button id="gpMax" type="button" title="Развернуть над журналом">⤢</button>
    <button id="gpFull" type="button" title="Во весь экран">⛶</button>
    <button id="gpClose" type="button" title="Закрыть (Esc)">✕</button>
  </div>
  <div class="gp-screen" id="gpScreen"></div>
  <div class="gp-veil" id="gpVeil"><div class="gp-spin"></div><p id="gpText"></p><div class="gp-step" id="gpStep"></div><div class="gp-err" id="gpErr" hidden></div></div>
</div>
<script src="<?= e(asset_v('assets/vendor/page-flip.browser.js')) ?>"></script>
<script src="<?= e(asset_v('assets/render.js')) ?>"></script>
<script>
(() => {
  // полифил Declarative Shadow DOM для старых браузеров
  if (!HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')) {
    document.querySelectorAll('template[shadowrootmode]').forEach(t => {
      const root = t.parentNode.attachShadow({mode: t.getAttribute('shadowrootmode'), clonable: true});
      root.appendChild(t.content); t.remove();
    });
  }
  const book = document.getElementById('book');
  const pages = book.querySelectorAll('.vw-page');
  const hosts = book.querySelectorAll('.vw-page .host');
  const pf = new St.PageFlip(book, {
    width: 595, height: 842, size: 'stretch',
    minWidth: 240, maxWidth: 1400, minHeight: 340, maxHeight: 1980,
    showCover: true, maxShadowOpacity: 0.55, flippingTime: 700, mobileScrollSupport: false, usePortrait: true
  });
  pf.loadFromHTML(pages);

  // page-flip 2.0.7: (1) при showCover насильно делает твёрдыми первую и последнюю одиночную полосу,
  // (2) если у листа разная жёсткость сторон, переключает обе в hard и больше не возвращает.
  // Поэтому после загрузки и после каждого перелистывания возвращаем плотность из data-density.
  function syncDensity() {
    pf.getPageCollection().getPages().forEach(p => {
      const d = p.getElement().dataset.density === 'hard' ? 'hard' : 'soft';
      if (p.getDensity() !== d) p.setDensity(d);
      if (p.getDrawingDensity() !== d || !p.getElement().classList.contains('--' + d)) p.setDrawingDensity(d);
    });
  }
  syncDensity();

  // Жёсткость листа → скорость и глубина тени. Настройки page-flip читаются на лету,
  // поэтому меняем их прямо перед анимацией конкретного листа.
  const STIFF = {thin: [520, .3], soft: [700, .5], stiff: [950, .68], hard: [820, .6]};
  function tuneFor(page) {
    const st = page?.getElement?.()?.dataset.stiff || 'soft';
    const [t, o] = STIFF[st] || STIFF.soft;
    const S = pf.getSettings(); S.flippingTime = t; S.maxShadowOpacity = o;
  }
  pf.on('changeState', e => {
    if (e.data === 'flipping' || e.data === 'user_fold' || e.data === 'fold_corner') {
      tuneFor(pf.getFlipController().flippingPage);
      requestAnimationFrame(() => tuneFor(pf.getFlipController().flippingPage));
    }
  });
  pf.on('changeState', e => {
    const flipping = e.data === 'flipping' || e.data === 'user_fold';
    book.classList.toggle('is-flipping', flipping);
    if (e.data === 'flipping') hosts.forEach(h => h.style.setProperty('--gx', '115%'));   // блик пробегает по листу
    if (e.data === 'read') { syncDensity(); hosts.forEach(h => h.style.setProperty('--gx', '28%')); }
  });
  pf.on('changeOrientation', syncDensity);

  const count = document.getElementById('count');
  const total = pf.getPageCount();
  const upd = () => { count.textContent = (pf.getCurrentPageIndex() + 1) + ' / ' + total; };
  pf.on('flip', upd);
  pf.on('changeOrientation', upd);
  document.getElementById('prev').onclick = () => pf.flipPrev();
  document.getElementById('next').onclick = () => pf.flipNext();
  document.getElementById('fs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  addEventListener('keydown', e => {
    if (player.active()) { if (e.key === 'Escape') player.close(); return; }
    if (e.key === '+' || e.key === '=') return centerZoom(1.4);
    if (e.key === '-' || e.key === '_') return centerZoom(1 / 1.4);
    if (e.key === '0') { Z.s = 1; return applyZ(); }
    if (zoomed() && e.key.startsWith('Arrow')) {
      const st = 60; Z.x += e.key === 'ArrowLeft' ? st : e.key === 'ArrowRight' ? -st : 0; Z.y += e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0;
      return applyZ();
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') pf.flipNext();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') pf.flipPrev();
  });
  // #p=5 в адресе — открыть сразу нужную полосу
  const m = location.hash.match(/p=(\d+)/);
  if (m) pf.turnToPage(Math.max(0, Math.min(total - 1, +m[1] - 1)));
  pf.on('flip', e => history.replaceState(null, '', '#p=' + (e.data + 1)));
  upd();

  /* ================= живые эффекты: указатель, поп-ап, наклейки, искажение ================= */
  const SLUG = <?= json_encode($slug) ?>;
  const visiblePages = () => [...pages].filter(p => p.style.display === 'block');
  let liveEv = null, liveRaf = 0;
  function applyLive() {
    liveRaf = 0;
    const e = liveEv; if (!e || pf.getState() === 'flipping') return;
    visiblePages().forEach(p => {
      const h = p.querySelector('.host'), r = h.getBoundingClientRect();
      if (!r.width) return;
      const mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
      const st = h.style;
      st.setProperty('--mx', mx.toFixed(3)); st.setProperty('--my', my.toFixed(3));
      st.setProperty('--px', Math.max(-1.5, Math.min(1.5, mx * 2 - 1)).toFixed(3));
      st.setProperty('--py', Math.max(-1.5, Math.min(1.5, my * 2 - 1)).toFixed(3));
      st.setProperty('--rvon', '1');
      if (p.dataset.material !== 'offset' && p.dataset.material !== 'news') {
        const t = ((e.clientX - r.left) + (e.clientY - r.top) * 0.4) / (r.width + r.height * 0.4);
        st.setProperty('--gx', Math.round(Math.max(-20, Math.min(120, t * 100))) + '%');
      }
    });
  }
  const stageEl = document.getElementById('stage');
  stageEl.addEventListener('pointermove', e => { liveEv = e; if (!liveRaf) liveRaf = requestAnimationFrame(applyLive); });
  stageEl.addEventListener('pointerleave', () => hosts.forEach(h => { h.style.setProperty('--gx', '28%'); h.style.setProperty('--rvon', '0'); }));

  function popVisible() {
    visiblePages().forEach(p => {
      const h = p.querySelector('.host');
      if (!h.shadowRoot || !h.shadowRoot.querySelector('[data-pop]')) return;
      h.classList.remove('opening'); void h.offsetWidth; h.classList.add('opening');
    });
  }
  const quads = () => visiblePages().forEach(p => { const r = p.querySelector('.host').shadowRoot; if (r) MagRender.applyQuads(r); });
  pf.on('changeState', e => { if (e.data === 'read') { popVisible(); quads(); } });
  pf.on('changeOrientation', () => setTimeout(quads, 50));
  let rsT = 0; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(quads, 120); });
  setTimeout(() => { popVisible(); quads(); }, 60);

  // наклейки: отклеенные помним в этом браузере
  const peelKey = id => `mag-peel:${SLUG}:${id}`;
  const store = {get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} }};
  hosts.forEach(h => h.shadowRoot && h.shadowRoot.querySelectorAll('[data-peel]').forEach(el => { if (store.get(peelKey(el.dataset.peel))) el.classList.add('gone-now'); }));
  const peelOf = e => e.composedPath().find(n => n.dataset && n.dataset.peel && !n.classList.contains('gone'));
  book.addEventListener('mousedown', e => { if (peelOf(e)) e.stopPropagation(); }, true);
  book.addEventListener('touchstart', e => { if (peelOf(e)) e.stopPropagation(); }, {capture: true, passive: true});
  book.addEventListener('click', e => { const el = peelOf(e); if (el) { el.classList.add('gone'); store.set(peelKey(el.dataset.peel), '1'); } });

  /* ================= зум и перемещение разворота ================= */
  const zoomEl = document.getElementById('zoom'), zval = document.getElementById('zval'), hint = document.getElementById('hint');
  const Z = {s: 1, x: 0, y: 0};
  const zoomed = () => Z.s > 1.001;
  function clampZ() {
    const W = zoomEl.offsetWidth, H = zoomEl.offsetHeight, sw = stageEl.clientWidth, sh = stageEl.clientHeight;
    const padX = sw * .35, padY = sh * .35;
    const ox = zoomEl.offsetLeft, oy = zoomEl.offsetTop;
    Z.x = Math.min(padX - ox, Math.max(sw - padX - ox - W * Z.s, Z.x));
    Z.y = Math.min(padY - oy, Math.max(sh - padY - oy - H * Z.s, Z.y));
  }
  function applyZ() {
    if (!zoomed()) { Z.s = 1; Z.x = 0; Z.y = 0; }
    else clampZ();
    zoomEl.style.transform = zoomed() ? `translate(${Z.x}px, ${Z.y}px) scale(${Z.s})` : '';
    stageEl.classList.toggle('is-zoomed', zoomed());
    zval.textContent = Math.round(Z.s * 100) + '%';
    player.place();
  }
  function zoomAt(cx, cy, ns) {
    ns = Math.max(1, Math.min(6, ns));
    const r = stageEl.getBoundingClientRect();
    const ox = r.left + zoomEl.offsetLeft, oy = r.top + zoomEl.offsetTop;
    const lx = (cx - ox - Z.x) / Z.s, ly = (cy - oy - Z.y) / Z.s;
    const was = zoomed();
    Z.s = ns; Z.x = cx - ox - ns * lx; Z.y = cy - oy - ns * ly;
    applyZ();
    if (!was && zoomed()) { hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 2200); }
  }
  const centerZoom = f => { const r = stageEl.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, Z.s * f); };
  stageEl.addEventListener('wheel', e => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX, e.clientY, Z.s * Math.exp(-d * (e.ctrlKey ? .01 : .0018)));
  }, {passive: false});
  document.getElementById('zin').onclick = () => centerZoom(1.4);
  document.getElementById('zout').onclick = () => centerZoom(1 / 1.4);
  zval.onclick = () => { Z.s = 1; applyZ(); };
  stageEl.addEventListener('dblclick', e => { if (zoomed()) { Z.s = 1; applyZ(); } });

  // пока разворот увеличен, page-flip не должен ничего листать: глушим его мышь и тач
  const guard = e => { if (zoomed() || pinch) e.stopPropagation(); };
  book.addEventListener('mousedown', guard, true);
  book.addEventListener('touchstart', guard, {capture: true, passive: true});
  addEventListener('mousemove', e => { if (zoomed()) e.stopPropagation(); }, true);
  addEventListener('touchmove', guard, {capture: true, passive: true});
  addEventListener('touchend', guard, {capture: true, passive: true});

  // перетаскивание и щипок
  const ptrs = new Map();
  let pan = null, pinch = null, dragged = false;
  stageEl.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), s: Z.s};
      pan = null;
    } else if (zoomed() && e.button === 0 && !e.target.closest('.gp')) {
      pan = {x: e.clientX, y: e.clientY, zx: Z.x, zy: Z.y};
      dragged = false;
      stageEl.setPointerCapture(e.pointerId);
    }
  });
  stageEl.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
    } else if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!dragged && Math.hypot(dx, dy) > 4) { dragged = true; stageEl.classList.add('is-panning'); }
      if (dragged) { Z.x = pan.zx + dx; Z.y = pan.zy + dy; applyZ(); }
    }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (pan && !ptrs.size) { pan = null; stageEl.classList.remove('is-panning'); }
  };
  stageEl.addEventListener('pointerup', endPtr);
  stageEl.addEventListener('pointercancel', endPtr);
  // клик после перетаскивания не должен отклеивать наклейку или запускать игру
  stageEl.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);

  /* ================= веб-плеер =================
     Оптимизации:
     1) на полосе только фасад (обложка + кнопка) — до клика ноль запросов к игре;
     2) iframe один на журнал и живёт поверх книги: page-flip не клонирует его при перелистывании
        (cloneNode перезапустил бы игру) и не крутит WebGL в 3D-трансформах;
     3) перелистнули — iframe выгружается (about:blank), память GPU освобождается;
     4) пока читатель смотрит на разворот с игрой, сервер заранее распаковывает сборку (prepare);
     5) COOP/COEP включаются только для выпусков, где это нужно (см. PHP выше). */
  const WP = <?= json_encode($wp, JSON_UNESCAPED_SLASHES) ?>;
  const player = (() => {
    const gp = document.getElementById('gp'), screen = document.getElementById('gpScreen');
    const veil = document.getElementById('gpVeil'), text = document.getElementById('gpText');
    const step = document.getElementById('gpStep'), err = document.getElementById('gpErr');
    let cur = null;
    const q = (id, k) => fetch(`${WP.url}?id=${id}&${k}=1`, {credentials: 'same-origin', cache: 'no-store'}).then(r => r.json());
    const entryUrl = (id, entry) => `${WP.data}/${id}/www/` + String(entry).split('/').map(encodeURIComponent).join('/');
    const STEPS = {download: 'скачиваем архив…', unzip: 'распаковываем…'};

    function say(msg, stepText = '') { veil.hidden = false; err.hidden = true; text.textContent = msg; step.textContent = stepText; veil.querySelector('.gp-spin').hidden = false; }
    function fail(me, msg) {
      if (me !== cur) return;
      clearInterval(me.poll);
      veil.hidden = false; veil.querySelector('.gp-spin').hidden = true;
      text.textContent = 'Не получилось запустить игру здесь. Откройте её в отдельном плеере ↗';
      step.textContent = ''; err.hidden = false; err.textContent = msg || 'Неизвестная ошибка';
    }
    function place() {
      if (!cur) return;
      const r = cur.blk.getBoundingClientRect();
      // крошечный блок или игра шире экрана телефона — сразу разворачиваем
      if (r.width < 280 || r.height < 180) gp.classList.add('is-max');
      Object.assign(gp.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'});
    }
    function close() {
      if (!cur) return;
      const me = cur; cur = null;
      me.aborted = true; clearInterval(me.poll);
      if (me.frame) { me.frame.src = 'about:blank'; me.frame.remove(); }   // освобождаем WebGL-контекст
      me.blk.classList.remove('is-playing');
      if (document.fullscreenElement === gp) document.exitFullscreen();
      gp.hidden = true; gp.classList.remove('is-max');
    }
    function waitReady(me) {
      return new Promise(res => {
        let n = 0;
        me.poll = setInterval(async () => {
          if (me.aborted) { clearInterval(me.poll); return res(null); }
          if (++n > 480) { fail(me, 'Сборка готовится слишком долго'); return res(null); }
          try {
            const d = await q(me.id, 'status');
            step.textContent = STEPS[d.step] || 'готовим…';
            if (d.state === 'ready') { clearInterval(me.poll); res(d); }
            // старое «error» из прошлой попытки игнорируем, пока prepare не ответил сам
            else if (d.state === 'error' && me.prepDone) { fail(me, d.error); res(null); }
          } catch (_) {}
        }, 1500);
      });
    }
    async function play(btn) {
      const id = +btn.dataset.game;
      if (cur && cur.id === id) return;
      close();
      const me = cur = {id, blk: btn.closest('.blk'), aborted: false, poll: null, prepDone: false, frame: null};
      me.blk.classList.add('is-playing');
      document.getElementById('gpTitle').textContent = btn.dataset.name || 'Игра';
      document.getElementById('gpOpen').href = `${WP.url}?id=${id}`;
      gp.hidden = false; place();
      say('Проверяем сборку…');

      let st;
      try { st = await q(id, 'status'); } catch (_) { return fail(me, 'Плеер не отвечает'); }
      if (me.aborted) return;
      if (st.state !== 'ready') {
        say('Готовим игру. Первый запуск дольше — архив распаковывается на сервере, дальше игра стартует сразу.', 'готовим…');
        q(id, 'prepare').then(d => { me.prepDone = true; if (d.state === 'error') fail(me, d.error); }).catch(() => { me.prepDone = true; });
        st = await waitReady(me);
        if (!st) return;
      }
      if (st.isolated && !self.crossOriginIsolated && !/iso=1/.test(location.hash)) {
        // игре нужен SharedArrayBuffer: перезагружаемся — PHP теперь отдаст COOP/COEP — и запускаем её сразу
        location.hash = `p=${pf.getCurrentPageIndex() + 1}&play=${id}&iso=1`;
        return location.reload();
      }
      const f = document.createElement('iframe');
      f.allow = 'autoplay; fullscreen; gamepad; accelerometer; gyroscope; xr-spatial-tracking; clipboard-write';
      f.allowFullscreen = true;
      f.title = btn.dataset.name || 'Игра';
      if (self.crossOriginIsolated && !st.isolated) {
        // журнал изолирован ради другой игры, а у этой нет COEP — пускаем её как credentialless iframe
        if ('credentialless' in HTMLIFrameElement.prototype) f.credentialless = true;
        else return fail(me, 'Браузер не поддерживает credentialless iframe');
      }
      f.addEventListener('load', () => { if (!me.aborted) { veil.hidden = true; f.focus(); } }, {once: true});
      say('Запускаем…');
      f.src = entryUrl(id, st.entry);
      screen.appendChild(f);
      me.frame = f;
    }

    // прогрев: пока открыт разворот с игрой, сервер распаковывает её заранее
    const warmed = new Set();
    let warmTimer = 0;
    function visibleButtons() {
      const out = [];
      pages.forEach(p => {
        if (p.style.display !== 'block') return;
        const root = p.querySelector('.host').shadowRoot;
        if (root) out.push(...root.querySelectorAll('[data-game]'));
      });
      return out;
    }
    function warm() {
      clearTimeout(warmTimer);
      warmTimer = setTimeout(() => visibleButtons().forEach(b => {
        const id = +b.dataset.game;
        if (warmed.has(id)) return;
        warmed.add(id);
        q(id, 'status').then(s => { if (s.state !== 'ready') q(id, 'prepare').catch(() => {}); }).catch(() => {});
      }), 1500);
    }

    // клики по кнопке внутри Shadow DOM: page-flip видит только host и начал бы листать — гасим в capture
    const isGame = e => e.composedPath().find(n => n.dataset && n.dataset.game);
    book.addEventListener('mousedown', e => { if (isGame(e)) e.stopPropagation(); }, true);
    book.addEventListener('touchstart', e => { if (isGame(e)) e.stopPropagation(); }, {capture: true, passive: true});
    book.addEventListener('click', e => { const b = isGame(e); if (b) { e.preventDefault(); play(b); } });

    pf.on('changeState', e => { if (e.data === 'flipping' || e.data === 'user_fold') close(); if (e.data === 'read') warm(); });
    pf.on('flip', () => { close(); warm(); });
    pf.on('changeOrientation', place);
    addEventListener('resize', place);
    document.getElementById('gpClose').onclick = close;
    document.getElementById('gpMax').onclick = () => { gp.classList.toggle('is-max'); if (!gp.classList.contains('is-max')) place(); };
    document.getElementById('gpFull').onclick = () => document.fullscreenElement ? document.exitFullscreen() : gp.requestFullscreen?.();
    document.addEventListener('visibilitychange', () => { if (document.hidden && cur && !cur.frame) close(); });

    warm();
    const pm = location.hash.match(/play=(\d+)/);
    if (pm) setTimeout(() => { const b = visibleButtons().find(x => x.dataset.game === pm[1]); if (b) play(b); }, 500);

    return {close, place, active: () => !!cur};
  })();
})();
</script>
</body>
</html>
