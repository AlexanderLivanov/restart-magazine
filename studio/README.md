# newmagazine/studio — редактор журналов на PHP

Редактор обложек и разворотов A4, полка выпусков и просмотрщик. Чистый PHP 7.4+ / 8.x, без сборки фронтенда.

## Запуск на XAMPP

1. Папка уже лежит в `htdocs/newmagazine/studio` → открыть `http://localhost/newmagazine/studio/`.
2. БД: по умолчанию `db_driver = 'dustore'` — PDO берётся из `/swad/config.php` (`new Database()`).
   Таблицы `mag_issues` и `mag_pages` создаются сами при первом запросе (`install.sql`, маркер `data/.schema_v1`).
   Нет MySQL под рукой — поставьте `'sqlite'` в `config.php`.
3. Для перекодирования фото нужен GD (`extension=gd` в php.ini). Без него файлы сохраняются как есть после проверки `getimagesize`.

## Кто владелец

- Залогинен в Dustore (`$_SESSION['USERDATA']['id']`) → `owner_key = u:<id>`.
- Иначе гостевой токен в cookie `mag_guest` → `owner_key = g:<hex>`, лимит `max_issues_guest`.

## Файлы

| Файл | Что делает |
|---|---|
| `index.php` | полка: мои выпуски, опубликованные, создание/удаление |
| `editor.php` + `assets/editor.js` | редактор (развороты, обложки, шаблоны, автосохранение) |
| `api.php` | JSON API: `page.save`, `page.add`, `page.delete`, `page.move`, `page.kind`, `upload`, `publish`, `unpublish`, `issue.update` |
| `render.php` | санитайзер макета + серверный рендер полос + экспорт |
| `assets/page.css` | общий CSS полосы (редактор, миниатюры, экспорт) |
| `viewer.php` | просмотрщик: цикл по pageN.html → Declarative Shadow DOM → page-flip |

## Экспорт

«Опубликовать» собирает `issues/<slug>/page0.html … pageN.html` и `issues/<slug>/pages.json`.
Каждая страница — самостоятельный HTML-документ (как старые `public/pageN.html`).
Папка выпуска подменяется атомарно: `<slug>.tmp-*` → `<slug>`.

React-вьюер (`src/App.js`) тоже умеет их читать: `http://localhost:3000/?issue=<slug>`
(базовый путь студии — `REACT_APP_STUDIO_URL`, по умолчанию `/newmagazine/studio`).

## Игры в журнале (блок «Игра»)

- В редакторе: «Интерактив → Игра», вписать ID или ссылку `dustore.ru/g/123`. Берётся любая опубликованная игра с платформой `web` и `game_zip_url` (таблица `games`).
- На полосе рисуется только заглушка (обложка + кнопка). Плеер поднимает `viewer.php` по клику: один iframe поверх книги,
  выгружается при перелистывании. Состояние сборки — через `webplayer.php?id=N&status=1 / &prepare=1`, файлы — из `/webplayerdata/<id>/www/`.
- Пока открыт разворот с игрой, сервер заранее готовит сборку (prepare).
- COOP/COEP (`credentialless`) журнал получает, только если в нём есть готовая игра с `isolated: true` (Unity/Godot).
  Если сборка стала готовой уже после загрузки страницы — вьюер один раз перезагружается с `#play=<id>&iso=1` и сразу запускает игру.
- Пути настраиваются в `config.php`: `webplayer_url`, `webplayer_data_url`, `webplayer_data_dir`.

## Эффекты и бумага (v3)

Разметку полос строят два рендерера — `assets/render.js` (редактор, миниатюры) и `render.php` (экспорт, полка).
Их вывод обязан совпадать символ в символ: `node tests/parity.js 200` гоняет случайные макеты через оба.

- **Бумага полосы:** `layout.material` — offset, white, gloss, matte, news, holo, foil; `layout.density` — thin, soft, stiff, hard.
  Жёсткость считается на лист (лицо + оборот) и задаёт скорость листания и глубину тени во вьюере.
- **Блок:** `r1..r4` (углы), `rx/ry/persp` (3D-наклон), `q` (свободная трансформация, 8 долей), `lift` (подъём),
  `pop` (поп-ап), `holo`, `reveal: flashlight`, `peel` (наклейка).
- **Текст:** `tfx` — emboss, deboss, extrude, outline, neon, foil; `bend` (дуга через SVG textPath).
  `font` — любой шрифт Google Fonts: при публикации ссылки на него попадают в `pages.json → fonts`.
- **Вьюер:** колесо мыши, +/− и щипок масштабируют разворот; в масштабе страницы не листаются, разворот перетаскивается мышью, 0 — сброс.
