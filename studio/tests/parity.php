<?php
// tests/parity.php — PHP-половина теста паритета: читает JSON из stdin, санитизирует, рендерит полосы.
declare(strict_types=1);
define('STUDIO_DIR', dirname(__DIR__));
function cfg($k) { return null; }
function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function valid_color($v, string $def): string { return (is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v)) ? strtolower($v) : $def; }
require STUDIO_DIR . '/render.php';
$in = json_decode(stream_get_contents(STDIN), true);
$pages = [];
foreach ($in['pages'] as $pg) $pages[] = ['id' => $pg['id'], 'kind' => $pg['kind'], 'layout' => sanitize_layout($pg['layout'])];
$html = [];
foreach ($pages as $i => $_) $html[] = render_page($pages, $i, $in['settings'], $in['base']);
echo json_encode(['pages' => $pages, 'html' => $html], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
