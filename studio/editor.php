<?php
// newmagazine/studio/editor.php
// Редактор выпуска: обложки и развороты A4. Логика — assets/editor.js, данные — через api.php.

declare(strict_types=1);
require_once __DIR__ . '/lib.php';

$issue = issue_owned((int)($_GET['issue'] ?? 0));
$pages = issue_pages((int)$issue['id']);
foreach ($pages as &$pg) $pg['layout'] = sanitize_layout($pg['layout']);
unset($pg);

$boot = [
    'issue' => [
        'id'       => (int)$issue['id'],
        'slug'     => $issue['slug'],
        'title'    => $issue['title'],
        'status'   => $issue['status'],
        'settings' => issue_settings($issue),
    ],
    'pages'  => $pages,
    'csrf'   => csrf_token(),
    'base'   => base_path(),
    'api'    => base_path() . '/api.php',
    'viewer' => base_path() . '/viewer.php?i=' . $issue['slug'],
    'guest'  => is_guest(),
    'webplayer' => cfg('webplayer_url'),
];
$json = json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($issue['title']) ?> — редактор</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="<?= e(cfg('fonts_css')) ?>">
<link rel="stylesheet" href="<?= e(asset_v('assets/page.css')) ?>">
<link rel="stylesheet" href="<?= e(asset_v('assets/app.css')) ?>">
<link rel="stylesheet" href="<?= e(asset_v('assets/editor.css')) ?>">
<style>@property --pe{syntax:'<number>';inherits:true;initial-value:9}@property --gx{syntax:'<percentage>';inherits:true;initial-value:28%}</style>
</head>
<body class="ed">
<div class="app">
  <header class="top">
    <a class="brand" href="<?= e(base_path()) ?>/" title="Ко всем выпускам"><span class="cmyk"><i></i><i></i><i></i><i></i></span></a>
    <input class="title-in" id="issueTitle" maxlength="160" aria-label="Название выпуска">
    <span class="savestate" id="saveState">Сохранено</span>
    <span class="sep"></span>
    <button class="tb" id="undo" title="Отменить (Ctrl+Z)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 3 2 6l3 3"/><path d="M2 6h7.5a4 4 0 0 1 0 8H7"/></svg></button>
    <button class="tb" id="redo" title="Повторить (Ctrl+Shift+Z)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m11 3 3 3-3 3"/><path d="M14 6H6.5a4 4 0 0 0 0 8H9"/></svg></button>
    <span class="sep"></span>
    <button class="tb" id="zout" title="Уменьшить">−</button>
    <button class="tb zoomval" id="zfit" title="Вписать в окно">100%</button>
    <button class="tb" id="zin" title="Увеличить">+</button>
    <span class="grow"></span>
    <button class="tb" id="bPreview" title="Скрыть служебные линии (P)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg><span class="lbl">Просмотр</span></button>
    <a class="tb" id="bRead" target="_blank" rel="noopener" hidden><span class="lbl">Читать</span> ↗</a>
    <button class="tb primary" id="bPublish">Опубликовать</button>
  </header>

  <aside class="side left">
    <div class="sec">
      <h3>Статья <span>тяните на полосу</span></h3>
      <div class="palette" data-group="article">
        <div class="tile" data-type="heading"><div class="pv" style="font:900 22px/1 'Playfair Display',serif">Аа</div><div class="nm">Заголовок</div></div>
        <div class="tile" data-type="lead"><div class="pv" style="font:italic 13px/1 Literata,serif">Лид-абзац</div><div class="nm">Лид</div></div>
        <div class="tile" data-type="body"><div class="pv"><div class="cols2"><div class="lines"><i></i><i></i><i></i><i style="width:60%"></i></div><div class="lines"><i></i><i></i><i></i><i></i></div></div></div><div class="nm">Текст</div></div>
        <div class="tile" data-type="image"><div class="pv" style="background:#2b1d4a"><svg viewBox="0 0 30 20" width="40" height="27" shape-rendering="crispEdges"><rect width="30" height="20" fill="#7a2e6e"/><rect width="30" height="5" fill="#3b1d5a"/><rect x="19" y="4" width="5" height="5" fill="#ffc27a"/><path d="M0 14h4v-3h3v-3h3v3h3v2h4v-4h3v-2h3v3h3v2h4v8H0z" fill="#24142f"/></svg></div><div class="nm">Картинка</div></div>
        <div class="tile" data-type="author"><div class="pv" style="font:600 8px/1 Onest,sans-serif;letter-spacing:.1em">ТЕКСТ — ИМЯ</div><div class="nm">Автор</div></div>
        <div class="tile" data-type="rubric"><div class="pv"><span style="background:#c32178;color:#fff;font:500 8px/1 'IBM Plex Mono',monospace;letter-spacing:.14em;padding:4px 6px">РУБРИКА</span></div><div class="nm">Рубрика</div></div>
        <div class="tile" data-type="quote"><div class="pv" style="font:italic 700 26px/1 'Playfair Display',serif;color:#c32178;padding-top:10px">«</div><div class="nm">Цитата</div></div>
        <div class="tile" data-type="caption"><div class="pv"><div class="lines" style="width:50%"><i style="height:1.5px"></i><i style="height:1.5px;width:70%"></i></div></div><div class="nm">Подпись</div></div>
        <div class="tile" data-type="shape"><div class="pv" style="gap:5px"><i style="width:16px;height:16px;border-radius:50%;background:#c32178"></i><i style="width:14px;height:14px;background:#16161a"></i></div><div class="nm">Фигура</div></div>
        <div class="tile" data-type="rule"><div class="pv"><i style="width:60%;height:2px;background:#16161a"></i></div><div class="nm">Линейка</div></div>
      </div>
    </div>
    <div class="sec">
      <h3>Обложка</h3>
      <div class="palette" data-group="cover">
        <div class="tile" data-type="masthead"><div class="pv" style="font:900 15px/1 Unbounded,sans-serif;letter-spacing:-.04em">DUST</div><div class="nm">Логотип</div></div>
        <div class="tile" data-type="issue"><div class="pv" style="font:500 8px/1 'IBM Plex Mono',monospace;letter-spacing:.12em">№ 01 · 2026</div><div class="nm">Номер</div></div>
        <div class="tile" data-type="coverline"><div class="pv"><div style="font:800 10px/1.1 Onest,sans-serif;color:#c32178;text-align:left">Анонс<br><span style="font-weight:400;color:#16161a;font-size:8px">подзаголовок</span></div></div><div class="nm">Анонс</div></div>
        <div class="tile" data-type="badge"><div class="pv"><span style="width:26px;height:26px;border-radius:50%;background:#c32178;color:#fff;font:600 7px/1 Oswald,sans-serif;display:grid;place-items:center">NEW</span></div><div class="nm">Плашка</div></div>
        <div class="tile" data-type="barcode"><div class="pv"><i style="width:34px;height:18px;background:repeating-linear-gradient(90deg,#16161a 0 1px,transparent 1px 3px,#16161a 3px 5px,transparent 5px 6px)"></i></div><div class="nm">Штрихкод</div></div>
      </div>
    </div>
    <div class="sec">
      <h3>Интерактив</h3>
      <div class="palette" data-group="play">
        <div class="tile" data-type="game"><div class="pv" style="background:#0b0210"><span style="display:inline-flex;align-items:center;gap:4px;background:#c32178;color:#fff;border-radius:99px;padding:3px 8px 3px 6px;font:700 8px/1 Onest,sans-serif"><i style="width:0;height:0;border-left:6px solid #fff;border-top:4px solid transparent;border-bottom:4px solid transparent"></i>Играть</span></div><div class="nm">Игра</div></div>
      </div>
    </div>
    <div class="sec">
      <h3>Шаблоны</h3>
      <div class="tpls">
        <div class="tplhead">Разворот статьи</div>
        <button class="tpl" data-tpl="classic"><svg viewBox="0 0 54 38"><rect width="54" height="38" fill="#fff"/><rect width="27" height="38" fill="#5a2a5e"/><rect x="30" y="4" width="8" height="2" fill="#c32178"/><rect x="30" y="8" width="20" height="4" fill="#16161a"/><rect x="30" y="15" width="10" height="18" fill="#bbb"/><rect x="41" y="15" width="10" height="18" fill="#bbb"/></svg><span><b>Классика</b>Фото на полосу, текст справа</span></button>
        <button class="tpl" data-tpl="panorama"><svg viewBox="0 0 54 38"><rect width="54" height="38" fill="#fff"/><rect width="54" height="21" fill="#10354a"/><rect x="30" y="12" width="20" height="5" fill="#fff"/><rect x="3" y="24" width="20" height="3" fill="#16161a"/><circle cx="21" cy="33" r="3.5" fill="#e8662a"/><rect x="30" y="24" width="10" height="12" fill="#bbb"/><rect x="41" y="24" width="10" height="12" fill="#bbb"/></svg><span><b>Панорама</b>Кадр через весь разворот</span></button>
        <button class="tpl" data-tpl="portrait"><svg viewBox="0 0 54 38"><rect width="54" height="38" fill="#fff"/><rect width="27" height="38" fill="#1B1F3A"/><rect x="3" y="3" width="18" height="10" fill="#F2E8D5"/><path d="M7 36V24a6 6 0 0 1 12 0v12z" fill="#e8662a"/><rect x="30" y="4" width="20" height="6" fill="#16161a"/><rect x="30" y="13" width="10" height="21" fill="#bbb"/><rect x="41" y="13" width="10" height="21" fill="#bbb"/></svg><span><b>Портрет</b>Тёмная полоса, арка</span></button>
        <div class="tplhead">На выбранную полосу</div>
        <button class="tpl" data-tpl="coverPhoto"><svg viewBox="0 0 54 38"><rect width="54" height="38" fill="#e9e9ee"/><rect x="14" width="27" height="38" fill="#3b1d5a"/><rect x="16" y="2" width="23" height="6" fill="#fff"/><rect x="16" y="14" width="10" height="2" fill="#ffc27a"/><rect x="16" y="18" width="8" height="1.5" fill="#fff"/><rect x="33" y="31" width="6" height="5" fill="#fff"/></svg><span><b>Обложка с фото</b>Логотип, анонсы, штрихкод</span></button>
        <button class="tpl" data-tpl="coverType"><svg viewBox="0 0 54 38"><rect width="54" height="38" fill="#e9e9ee"/><rect x="14" width="27" height="38" fill="#c32178"/><rect x="17" y="4" width="4" height="30" fill="#16141c"/><circle cx="32" cy="16" r="6" fill="#ffe600"/><rect x="24" y="28" width="14" height="2" fill="#fff"/></svg><span><b>Шрифтовая обложка</b>Цвет и крупный логотип</span></button>
        <button class="tpl" data-tpl="backCover"><svg viewBox="0 0 54 38"><rect width="54" height="38" fill="#e9e9ee"/><rect x="14" width="27" height="38" fill="#16141c"/><rect x="18" y="6" width="19" height="16" fill="#e8662a"/><rect x="18" y="26" width="12" height="2" fill="#fff"/><rect x="31" y="30" width="7" height="5" fill="#fff"/></svg><span><b>Задняя обложка</b>Анонс следующего номера</span></button>
      </div>
    </div>
    <div class="sec">
      <h3>Слои <span id="laycount"></span></h3>
      <div class="layers" id="layers"></div>
    </div>
    <div class="sec hint">
      Двойной клик — править текст. <kbd>Alt</kbd> при перетаскивании — без привязки, <kbd>Shift</kbd> — пропорции и шаг 15°. <kbd>T</kbd> — свободная трансформация. <kbd>PgUp</kbd>/<kbd>PgDn</kbd> — развороты. Слои можно перетаскивать. Фото можно бросить прямо из папки на полосу.
    </div>
  </aside>

  <main class="deskcol">
    <div class="desk" id="desk">
      <div class="wrap">
        <div class="stage" id="stage" lang="ru">
          <div id="labels"></div>
          <div class="ruler h" id="rulerH"></div>
          <div class="ruler v" id="rulerV"></div>
          <div class="clip" id="clip"></div>
          <div id="overlay"></div>
        </div>
      </div>
    </div>
    <div class="strip">
      <div class="spreads" id="spreads"></div>
      <div class="stripacts">
        <button class="btn sm" id="addSpread" title="Два новых листа после текущего разворота">+ Разворот</button>
        <button class="btn sm" id="addPage" title="Один лист после текущего разворота">+ Полоса</button>
      </div>
    </div>
  </main>

  <aside class="side right" id="insp"></aside>
</div>
<input type="file" id="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
<div class="toast" id="toast" role="status"></div>
<script type="application/json" id="boot"><?= $json ?></script>
<script src="<?= e(asset_v('assets/render.js')) ?>"></script>
<script src="<?= e(asset_v('assets/editor.js')) ?>"></script>
</body>
</html>
