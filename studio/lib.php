<?php
// newmagazine/studio/lib.php
// Общий бутстрап: конфиг, PDO, схема, владелец (Dustore-сессия или гость), CSRF, хелперы.

declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

const STUDIO_DIR = __DIR__;

function cfg(string $key)
{
    static $c = null;
    if ($c === null) $c = require STUDIO_DIR . '/config.php';
    return $c[$key] ?? null;
}

/* ---------- БД ---------- */

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;

    $driver = cfg('db_driver');
    if ($driver === 'dustore') {
        $dcfg = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\') . '/swad/config.php';
        if (!is_file($dcfg)) {
            throw new RuntimeException('swad/config.php не найден — поменяйте db_driver в studio/config.php');
        }
        require_once $dcfg;
        $pdo = (new Database())->connect();
    } elseif ($driver === 'sqlite') {
        $pdo = new PDO('sqlite:' . STUDIO_DIR . '/data/studio.sqlite');
        $pdo->exec('PRAGMA foreign_keys = ON');
    } else {
        $m = cfg('mysql');
        $pdo = new PDO($m['dsn'], $m['user'], $m['pass']);
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    ensure_schema($pdo, $driver === 'sqlite');
    return $pdo;
}

function ensure_schema(PDO $pdo, bool $sqlite): void
{
    $marker = STUDIO_DIR . '/data/.schema_v1';
    if (is_file($marker)) return;

    if ($sqlite) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS mag_issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            owner_key TEXT NOT NULL,
            title TEXT NOT NULL,
            settings TEXT NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'draft',
            published_at TEXT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS mag_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_id INTEGER NOT NULL REFERENCES mag_issues(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            kind TEXT NOT NULL DEFAULT 'page',
            layout TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    } else {
        $sql = preg_replace('/^--.*$/m', '', (string)file_get_contents(STUDIO_DIR . '/install.sql'));
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) $pdo->exec($stmt);
    }
    @file_put_contents($marker, date('c'));
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

/* ---------- владелец ---------- */

// Dustore-аккаунт → "u:<id>", иначе гостевой токен в cookie → "g:<hex>".
function owner_key(): string
{
    static $key = null;
    if ($key !== null) return $key;

    if (!empty($_SESSION['USERDATA']['id'])) {
        return $key = 'u:' . (int)$_SESSION['USERDATA']['id'];
    }
    $tok = $_COOKIE['mag_guest'] ?? '';
    if (!preg_match('/^[a-f0-9]{32}$/', $tok)) {
        $tok = bin2hex(random_bytes(16));
        setcookie('mag_guest', $tok, [
            'expires'  => time() + 86400 * 365,
            'path'     => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        $_COOKIE['mag_guest'] = $tok;
    }
    return $key = 'g:' . $tok;
}

function is_guest(): bool
{
    return strncmp(owner_key(), 'g:', 2) === 0;
}

function issue_owned(int $id): array
{
    $st = db()->prepare('SELECT * FROM mag_issues WHERE id = ? AND owner_key = ?');
    $st->execute([$id, owner_key()]);
    $row = $st->fetch();
    if (!$row) {
        http_response_code(404);
        if (is_api()) json_out(['ok' => false, 'error' => 'Выпуск не найден или принадлежит другому автору'], 404);
        exit('Выпуск не найден');
    }
    return $row;
}

function issue_pages(int $issueId, bool $withLayout = true): array
{
    $cols = $withLayout ? 'id, position, kind, layout' : 'id, position, kind';
    $st = db()->prepare("SELECT $cols FROM mag_pages WHERE issue_id = ? ORDER BY position, id");
    $st->execute([$issueId]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $p = ['id' => (int)$r['id'], 'kind' => $r['kind']];
        if ($withLayout) $p['layout'] = json_decode($r['layout'], true) ?: ['bg' => '#ffffff', 'blocks' => []];
        $out[] = $p;
    }
    return $out;
}

function renumber_pages(int $issueId, array $orderedIds): void
{
    $st = db()->prepare('UPDATE mag_pages SET position = ? WHERE id = ? AND issue_id = ?');
    foreach (array_values($orderedIds) as $i => $pid) $st->execute([$i, $pid, $issueId]);
}

function touch_issue(int $id): void
{
    db()->prepare('UPDATE mag_issues SET updated_at = ? WHERE id = ?')->execute([now(), $id]);
}

function issue_settings(array $issue): array
{
    $s = json_decode((string)$issue['settings'], true) ?: [];
    return sanitize_settings($s);
}

function sanitize_settings(array $s): array
{
    return [
        'folios'     => !empty($s['folios']),
        'mag'        => mb_substr(trim((string)($s['mag'] ?? '')), 0, 60),
        'folioColor' => valid_color($s['folioColor'] ?? '', '#1a1a1a'),
        'starter'    => !empty($s['starter']),
    ];
}

function valid_color($v, string $def): string
{
    return (is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v)) ? strtolower($v) : $def;
}

function new_slug(): string
{
    $abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    $s = '';
    for ($i = 0; $i < 10; $i++) $s .= $abc[random_int(0, strlen($abc) - 1)];
    return $s;
}

/* ---------- CSRF ---------- */

function csrf_token(): string
{
    if (empty($_SESSION['mag_csrf'])) $_SESSION['mag_csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['mag_csrf'];
}

function csrf_check(?string $tok): void
{
    if (!$tok || !hash_equals(csrf_token(), $tok)) {
        if (is_api()) json_out(['ok' => false, 'error' => 'Сессия устарела — обновите страницу'], 419);
        http_response_code(419);
        exit('Сессия устарела — обновите страницу');
    }
}

/* ---------- вывод ---------- */

function is_api(): bool
{
    return basename($_SERVER['SCRIPT_NAME'] ?? '') === 'api.php';
}

function json_out(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function e($s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

// URL-путь до папки studio от корня сайта: "/newmagazine/studio"
function base_path(): string
{
    $p = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    return rtrim($p, '/');
}

// Полный URL (нужен экспортированным страницам — их грузят из других мест, в т.ч. React-вьюер)
function base_url(): string
{
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $host  = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return ($https ? 'https' : 'http') . '://' . $host . base_path();
}

function asset_v(string $rel): string
{
    $f = STUDIO_DIR . '/' . $rel;
    return base_path() . '/' . $rel . '?v=' . (is_file($f) ? filemtime($f) : 0);
}

function rrmdir(string $dir): void
{
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') continue;
        $p = $dir . '/' . $f;
        is_dir($p) ? rrmdir($p) : @unlink($p);
    }
    @rmdir($dir);
}

require_once STUDIO_DIR . '/render.php';
