<?php
// newmagazine/studio/index.php
// Полка: мои выпуски + все опубликованные. Создание и удаление выпусков.

declare(strict_types=1);
require_once __DIR__ . '/lib.php';

$pdo = db();
$me = owner_key();
$flash = '';

// POST — до любого вывода
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check($_POST['csrf'] ?? null);
    $act = $_POST['act'] ?? '';

    if ($act === 'create') {
        if (is_guest()) {
            $st = $pdo->prepare('SELECT COUNT(*) FROM mag_issues WHERE owner_key = ?');
            $st->execute([$me]);
            if ((int)$st->fetchColumn() >= (int)cfg('max_issues_guest')) {
                header('Location: ' . base_path() . '/?e=limit');
                exit;
            }
        }
        $title = mb_substr(trim((string)($_POST['title'] ?? '')), 0, 160) ?: 'Новый выпуск';
        $starter = !empty($_POST['starter']);
        $settings = sanitize_settings(['folios' => true, 'mag' => $title, 'starter' => $starter]);
        do { $slug = new_slug(); $chk = $pdo->prepare('SELECT 1 FROM mag_issues WHERE slug = ?'); $chk->execute([$slug]); } while ($chk->fetchColumn());

        $pdo->prepare('INSERT INTO mag_issues (slug, owner_key, title, settings, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$slug, $me, $title, json_encode($settings, JSON_UNESCAPED_UNICODE), 'draft', now(), now()]);
        $iid = (int)$pdo->lastInsertId();

        $kinds = $starter ? ['cover', 'page', 'page', 'back'] : ['cover', 'page', 'page'];
        $ins = $pdo->prepare('INSERT INTO mag_pages (issue_id, position, kind, layout, updated_at) VALUES (?, ?, ?, ?, ?)');
        foreach ($kinds as $i => $k) $ins->execute([$iid, $i, $k, json_encode(['bg' => '#ffffff', 'blocks' => []]), now()]);

        header('Location: ' . base_path() . '/editor.php?issue=' . $iid);
        exit;
    }

    if ($act === 'delete') {
        $issue = issue_owned((int)($_POST['issue'] ?? 0));
        rrmdir(STUDIO_DIR . '/issues/' . $issue['slug']);
        rrmdir(STUDIO_DIR . '/uploads/' . (int)$issue['id']);
        $pdo->prepare('DELETE FROM mag_pages WHERE issue_id = ?')->execute([$issue['id']]);
        $pdo->prepare('DELETE FROM mag_issues WHERE id = ?')->execute([$issue['id']]);
        header('Location: ' . base_path() . '/?e=deleted');
        exit;
    }
}

if (($_GET['e'] ?? '') === 'limit') $flash = 'Без аккаунта Dustore можно держать до ' . cfg('max_issues_guest') . ' выпусков. Войдите, чтобы создавать больше.';
if (($_GET['e'] ?? '') === 'deleted') $flash = 'Выпуск удалён.';

$st = $pdo->prepare('SELECT * FROM mag_issues WHERE owner_key = ? ORDER BY updated_at DESC');
$st->execute([$me]);
$mine = $st->fetchAll();

$pub = $pdo->query("SELECT * FROM mag_issues WHERE status = 'published' ORDER BY published_at DESC LIMIT 24")->fetchAll();

// обложка = первая полоса выпуска
function cover_html(array $issue): string
{
    $st = db()->prepare('SELECT id, kind, layout FROM mag_pages WHERE issue_id = ? ORDER BY position, id LIMIT 1');
    $st->execute([$issue['id']]);
    $r = $st->fetch();
    if (!$r) return '<div class="pg"></div>';
    $pages = [['id' => (int)$r['id'], 'kind' => $r['kind'], 'layout' => sanitize_layout(json_decode($r['layout'], true))]];
    return render_page($pages, 0, issue_settings($issue), base_path(), false, true);
}

function count_pages(int $id): int
{
    $st = db()->prepare('SELECT COUNT(*) FROM mag_pages WHERE issue_id = ?');
    $st->execute([$id]);
    return (int)$st->fetchColumn();
}

function plural(int $n, string $one, string $few, string $many): string
{
    $m10 = $n % 10; $m100 = $n % 100;
    if ($m10 === 1 && $m100 !== 11) return $one;
    if ($m10 >= 2 && $m10 <= 4 && ($m100 < 10 || $m100 >= 20)) return $few;
    return $many;
}
$csrf = csrf_token();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Журналы — Dustore Studio</title>
<link rel="stylesheet" href="<?= e(cfg('fonts_css')) ?>">
<link rel="stylesheet" href="<?= e(asset_v('assets/page.css')) ?>">
<link rel="stylesheet" href="<?= e(asset_v('assets/app.css')) ?>">
</head>
<body class="shelf-page">
<header class="bar">
  <a class="brand" href="<?= e(base_path()) ?>/"><span class="cmyk"><i></i><i></i><i></i><i></i></span>Журналы <small>studio</small></a>
  <span class="grow"></span>
  <span class="who"><?= is_guest() ? 'Гость · черновики живут в этом браузере' : 'Аккаунт Dustore' ?></span>
</header>

<main class="shelf">
  <?php if ($flash): ?><div class="flash"><?= e($flash) ?></div><?php endif; ?>

  <section class="create">
    <div>
      <h1>Соберите свой журнал</h1>
      <p>Обложка, развороты A4, свои шрифты и фото. Опубликованный выпуск превращается в набор HTML-страниц и листается как настоящий.</p>
    </div>
    <form method="post" class="create-form">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <input type="hidden" name="act" value="create">
      <label class="fld"><span>Название</span><input name="title" id="new-title" maxlength="160" placeholder="Например, RE:START №1" required></label>
      <label class="chk"><input type="checkbox" name="starter" value="1" checked> Начать с примера: обложка, статья, задняя обложка</label>
      <button class="btn primary">Создать выпуск</button>
    </form>
  </section>

  <section>
    <h2>Мои выпуски <span><?= count($mine) ?></span></h2>
    <?php if (!$mine): ?>
      <p class="empty">Пока пусто. Создайте первый выпуск — пример сразу откроется в редакторе.</p>
    <?php else: ?>
    <div class="grid">
      <?php foreach ($mine as $is): $n = count_pages((int)$is['id']); ?>
      <article class="card">
        <a class="cover" href="<?= e(base_path()) ?>/editor.php?issue=<?= (int)$is['id'] ?>" aria-label="Редактировать «<?= e($is['title']) ?>»"><?= cover_html($is) ?></a>
        <div class="meta">
          <div class="t"><?= e($is['title']) ?></div>
          <div class="s">
            <span class="pill <?= $is['status'] === 'published' ? 'on' : '' ?>"><?= $is['status'] === 'published' ? 'Опубликован' : 'Черновик' ?></span>
            <?= $n ?> <?= plural($n, 'полоса', 'полосы', 'полос') ?>
          </div>
          <div class="acts">
            <a class="btn sm" href="<?= e(base_path()) ?>/editor.php?issue=<?= (int)$is['id'] ?>">Редактировать</a>
            <?php if ($is['status'] === 'published'): ?><a class="btn sm" href="<?= e(base_path()) ?>/viewer.php?i=<?= e($is['slug']) ?>">Читать</a><?php endif; ?>
            <form method="post" onsubmit="return confirm('Удалить выпуск «<?= e(addslashes($is['title'])) ?>» вместе с фото? Это не отменить.')">
              <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
              <input type="hidden" name="act" value="delete">
              <input type="hidden" name="issue" value="<?= (int)$is['id'] ?>">
              <button class="btn sm ghost danger">Удалить</button>
            </form>
          </div>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </section>

  <section>
    <h2>Читают сейчас <span><?= count($pub) ?></span></h2>
    <?php if (!$pub): ?>
      <p class="empty">Опубликованных выпусков ещё нет.</p>
    <?php else: ?>
    <div class="grid">
      <?php foreach ($pub as $is): ?>
      <article class="card">
        <a class="cover" href="<?= e(base_path()) ?>/viewer.php?i=<?= e($is['slug']) ?>" aria-label="Читать «<?= e($is['title']) ?>»"><?= cover_html($is) ?></a>
        <div class="meta">
          <div class="t"><?= e($is['title']) ?></div>
          <div class="s"><?= e(date('d.m.Y', strtotime((string)$is['published_at']))) ?></div>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </section>
</main>
</body>
</html>
