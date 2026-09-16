<?php
// newmagazine/studio/api.php
// JSON API редактора. Все вызовы — POST, заголовок X-CSRF, действие в ?a=...

declare(strict_types=1);
require_once __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['ok' => false, 'error' => 'Только POST'], 405);

$a = (string)($_GET['a'] ?? '');
$in = [];
if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') === 0) {
    $raw = file_get_contents('php://input');
    if (strlen($raw) > 2 * 1024 * 1024) json_out(['ok' => false, 'error' => 'Слишком большой запрос'], 413);
    $in = json_decode($raw, true) ?: [];
} else {
    $in = $_POST;
}
// токен — в заголовке; sendBeacon при закрытии вкладки заголовки ставить не умеет, поэтому ещё и в теле
csrf_check($_SERVER['HTTP_X_CSRF'] ?? ($in['_csrf'] ?? ($_POST['csrf'] ?? null)));

$pdo = db();

function pages_brief(int $issueId): array
{
    return issue_pages($issueId, false);
}

function page_of_issue(int $issueId, int $pageId): array
{
    $st = db()->prepare('SELECT id, position, kind FROM mag_pages WHERE id = ? AND issue_id = ?');
    $st->execute([$pageId, $issueId]);
    $r = $st->fetch();
    if (!$r) json_out(['ok' => false, 'error' => 'Полоса не найдена'], 404);
    return $r;
}

try {
    switch ($a) {

        case 'issue.update': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $title = isset($in['title']) ? mb_substr(trim((string)$in['title']), 0, 160) : $issue['title'];
            if ($title === '') $title = 'Без названия';
            $settings = issue_settings($issue);
            if (isset($in['settings']) && is_array($in['settings'])) {
                $settings = sanitize_settings(array_merge($settings, $in['settings']));
            }
            $pdo->prepare('UPDATE mag_issues SET title = ?, settings = ?, updated_at = ? WHERE id = ?')
                ->execute([$title, json_encode($settings, JSON_UNESCAPED_UNICODE), now(), $issue['id']]);
            json_out(['ok' => true, 'title' => $title, 'settings' => $settings]);
        }

        case 'page.save': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $saved = [];
            foreach (array_slice((array)($in['pages'] ?? []), 0, 50) as $item) {
                $pid = (int)($item['id'] ?? 0);
                page_of_issue((int)$issue['id'], $pid);
                $layout = sanitize_layout($item['layout'] ?? []);
                $pdo->prepare('UPDATE mag_pages SET layout = ?, updated_at = ? WHERE id = ?')
                    ->execute([json_encode($layout, JSON_UNESCAPED_UNICODE), now(), $pid]);
                $saved[] = $pid;
            }
            touch_issue((int)$issue['id']);
            json_out(['ok' => true, 'saved' => $saved]);
        }

        case 'page.add': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $iid = (int)$issue['id'];
            $pages = pages_brief($iid);
            $count = max(1, min(4, (int)($in['count'] ?? 1)));
            if (count($pages) + $count > (int)cfg('max_pages')) json_out(['ok' => false, 'error' => 'В выпуске максимум ' . cfg('max_pages') . ' полос'], 400);
            $kind = in_array($in['kind'] ?? '', ['page', 'cover', 'back'], true) ? $in['kind'] : 'page';
            $at = max(0, min(count($pages), (int)($in['at'] ?? count($pages))));
            $empty = json_encode(['bg' => '#ffffff', 'blocks' => []]);
            $ids = array_column($pages, 'id');
            $new = [];
            $ins = $pdo->prepare('INSERT INTO mag_pages (issue_id, position, kind, layout, updated_at) VALUES (?, ?, ?, ?, ?)');
            for ($k = 0; $k < $count; $k++) {
                $ins->execute([$iid, 0, $kind, $empty, now()]);
                $new[] = (int)$pdo->lastInsertId();
            }
            array_splice($ids, $at, 0, $new);
            renumber_pages($iid, $ids);
            touch_issue($iid);
            json_out(['ok' => true, 'pages' => pages_brief($iid), 'added' => $new]);
        }

        case 'page.delete': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $iid = (int)$issue['id'];
            $pages = pages_brief($iid);
            if (count($pages) <= 1) json_out(['ok' => false, 'error' => 'В выпуске должна остаться хотя бы одна полоса'], 400);
            $pid = (int)page_of_issue($iid, (int)($in['page'] ?? 0))['id'];
            $pdo->prepare('DELETE FROM mag_pages WHERE id = ?')->execute([$pid]);
            renumber_pages($iid, array_values(array_filter(array_column($pages, 'id'), function ($x) use ($pid) { return $x !== $pid; })));
            touch_issue($iid);
            json_out(['ok' => true, 'pages' => pages_brief($iid)]);
        }

        case 'page.move': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $iid = (int)$issue['id'];
            $pid = (int)page_of_issue($iid, (int)($in['page'] ?? 0))['id'];
            $ids = array_column(pages_brief($iid), 'id');
            $from = array_search($pid, $ids, true);
            $to = max(0, min(count($ids) - 1, (int)($in['to'] ?? $from)));
            array_splice($ids, $from, 1);
            array_splice($ids, $to, 0, [$pid]);
            renumber_pages($iid, $ids);
            touch_issue($iid);
            json_out(['ok' => true, 'pages' => pages_brief($iid)]);
        }

        case 'page.kind': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $iid = (int)$issue['id'];
            $pid = (int)page_of_issue($iid, (int)($in['page'] ?? 0))['id'];
            $kind = in_array($in['kind'] ?? '', ['page', 'cover', 'back'], true) ? $in['kind'] : 'page';
            $pdo->prepare('UPDATE mag_pages SET kind = ? WHERE id = ?')->execute([$kind, $pid]);
            json_out(['ok' => true, 'pages' => pages_brief($iid)]);
        }

        case 'upload': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $f = $_FILES['file'] ?? null;
            if (!$f || $f['error'] !== UPLOAD_ERR_OK) json_out(['ok' => false, 'error' => 'Файл не дошёл — попробуйте ещё раз'], 400);
            if ($f['size'] > cfg('max_upload_mb') * 1024 * 1024) json_out(['ok' => false, 'error' => 'Файл больше ' . cfg('max_upload_mb') . ' МБ'], 400);
            $info = @getimagesize($f['tmp_name']);
            $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
            if (!$info || !isset($types[$info[2]])) json_out(['ok' => false, 'error' => 'Нужен JPG, PNG, WebP или GIF'], 400);

            $ext = $types[$info[2]];
            $data = (string)file_get_contents($f['tmp_name']);
            $max = (int)cfg('max_image_side');
            // Перекодируем через GD: убирает всё, что не пиксели, и ужимает гигантские фото.
            if ($ext !== 'gif' && function_exists('imagecreatefromstring') && ($im = @imagecreatefromstring($data))) {
                $w = imagesx($im); $h = imagesy($im);
                $s = min(1, $max / max($w, $h));
                if ($s < 1) {
                    $nw = (int)round($w * $s); $nh = (int)round($h * $s);
                    $dst = imagecreatetruecolor($nw, $nh);
                    imagealphablending($dst, false); imagesavealpha($dst, true);
                    imagecopyresampled($dst, $im, 0, 0, 0, 0, $nw, $nh, $w, $h);
                    imagedestroy($im);
                    $im = $dst;
                }
                ob_start();
                if ($ext === 'png') { imagesavealpha($im, true); imagepng($im, null, 7); }
                elseif ($ext === 'webp' && function_exists('imagewebp')) imagewebp($im, null, 86);
                else { $ext = 'jpg'; imagejpeg($im, null, 86); }
                $data = (string)ob_get_clean();
                imagedestroy($im);
            }
            $dir = STUDIO_DIR . '/uploads/' . (int)$issue['id'];
            if (!is_dir($dir)) mkdir($dir, 0775, true);
            $name = sha1($data) . '.' . $ext;
            if (!is_file("$dir/$name")) file_put_contents("$dir/$name", $data);
            json_out(['ok' => true, 'src' => 'uploads/' . (int)$issue['id'] . '/' . $name, 'ratio' => $info[0] / max(1, $info[1])]);
        }

        case 'game.lookup': {
            // Принимаем id, /g/123, /webplayer?id=123 — что угодно с числом внутри
            issue_owned((int)($in['issue'] ?? 0));
            $q = (string)($in['q'] ?? '');
            $gid = preg_match('~(?:[?&]id=|/g/)(\d+)~', $q, $m) ? (int)$m[1] : (preg_match('~^\s*(\d+)\s*$~', $q, $m) ? (int)$m[1] : 0);
            if ($gid <= 0) json_out(['ok' => false, 'error' => 'Нужен ID игры или ссылка вида dustore.ru/g/123'], 400);
            try {
                $st = $pdo->prepare('SELECT id, name, path_to_cover, platforms, game_zip_url, status FROM games WHERE id = ?');
                $st->execute([$gid]);
                $g = $st->fetch();
            } catch (Throwable $e) {
                json_out(['ok' => false, 'error' => 'Каталог игр Dustore недоступен из этой базы (db_driver)'], 400);
            }
            if (!$g || strtolower((string)$g['status']) !== 'published') json_out(['ok' => false, 'error' => "Игра #$gid не найдена или не опубликована"], 404);
            $plats = array_map(function ($x) { return strtolower(trim($x)); }, explode(',', (string)$g['platforms']));
            if (!in_array('web', $plats, true) || trim((string)$g['game_zip_url']) === '') {
                json_out(['ok' => false, 'error' => "У игры «{$g['name']}» нет веб-сборки — её нельзя запустить в журнале"], 400);
            }
            $meta = webplayer_meta($gid);
            json_out(['ok' => true, 'game' => [
                'id'       => $gid,
                'name'     => mb_substr((string)$g['name'], 0, 120),
                'cover'    => preg_match('~^(https?:)?/~i', (string)$g['path_to_cover']) ? (string)$g['path_to_cover'] : '/' . ltrim((string)$g['path_to_cover'], '/'),
                'state'    => $meta['state'] ?? 'absent',
                'engine'   => $meta['engine'] ?? null,
                'isolated' => !empty($meta['isolated']),
            ]]);
        }

        case 'publish': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            $m = export_issue($issue);
            $pdo->prepare("UPDATE mag_issues SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?")
                ->execute([now(), now(), $issue['id']]);
            json_out(['ok' => true, 'viewer' => $m['viewer'], 'manifest' => base_path() . '/issues/' . $issue['slug'] . '/pages.json', 'count' => count($m['pages'])]);
        }

        case 'unpublish': {
            $issue = issue_owned((int)($in['issue'] ?? 0));
            rrmdir(STUDIO_DIR . '/issues/' . $issue['slug']);
            $pdo->prepare("UPDATE mag_issues SET status = 'draft', published_at = NULL WHERE id = ?")->execute([$issue['id']]);
            json_out(['ok' => true]);
        }

        default:
            json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);
    }
} catch (Throwable $e) {
    error_log('[studio/api] ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'Ошибка сервера — подробности в error_log'], 500);
}
