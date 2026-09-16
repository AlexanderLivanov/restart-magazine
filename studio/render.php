<?php
// newmagazine/studio/render.php
// Серверный рендерер полос: санитайзер JSON-макета, HTML блоков, экспорт выпуска в pageN.html + pages.json.
// Зеркало assets/render.js (строка в строку, проверяется tests/parity.js). CSS у них общий: assets/page.css.

declare(strict_types=1);

const MAG_PW = 210;   // мм
const MAG_PH = 297;
const MAG_PT = 0.3528;

function mag_fonts(): array
{
    return [
        'Playfair Display' => 'serif', 'Yeseva One' => 'serif', 'Cormorant Garamond' => 'serif',
        'Literata' => 'serif', 'PT Serif' => 'serif', 'Unbounded' => 'sans-serif', 'Oswald' => 'sans-serif',
        'Onest' => 'sans-serif', 'Manrope' => 'sans-serif', 'Rubik Mono One' => 'sans-serif', 'IBM Plex Mono' => 'monospace',
    ];
}

function mag_shapes(): array
{
    return [
        'rect'    => 'none',
        'circle'  => 'ellipse(50% 50% at 50% 50%)',
        'arch'    => 'inset(0 round 9999px 9999px 0 0)',
        'slant'   => 'polygon(0 0,100% 0,100% 86%,0 100%)',
        'diamond' => 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
        'hex'     => 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
        'star'    => 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
        'ticket'  => 'polygon(0 0,100% 0,100% 40%,94% 50%,100% 60%,100% 100%,0 100%,0 60%,6% 50%,0 40%)',
    ];
}

// тип блока => семейство свойств
function mag_types(): array
{
    return [
        'heading' => 'text', 'lead' => 'text', 'body' => 'text', 'author' => 'text', 'rubric' => 'text',
        'quote' => 'text', 'caption' => 'text', 'masthead' => 'text', 'issue' => 'text',
        'coverline' => 'text', 'badge' => 'text',
        'image' => 'image', 'shape' => 'box', 'rule' => 'box', 'barcode' => 'barcode',
        'game' => 'game',
    ];
}

const MAG_HOLO   = ['none', 'silver', 'gold', 'holo', 'chameleon', 'glitter'];
const MAG_TFX    = ['none', 'emboss', 'deboss', 'extrude', 'outline', 'neon', 'foil'];
const MAG_STIFF  = ['thin', 'soft', 'stiff', 'hard'];
const MAG_MATTER = ['offset', 'white', 'gloss', 'matte', 'news', 'holo', 'foil'];

function mag_rules(string $type): array
{
    $box = [
        'bgOn' => ['b', false], 'bg' => ['c', '#ffffff'], 'pad' => ['n', 0, 40, 0], 'radius' => ['n', 0, 150, 0],
        'shape' => ['e', array_keys(mag_shapes()), 'rect'], 'bw' => ['n', 0, 20, 0], 'bc' => ['c', '#111111'],
        'opacity' => ['n', 0, 1, 1],
        'blend' => ['e', ['normal', 'multiply', 'screen', 'overlay', 'difference', 'luminosity'], 'normal'],
        // углы по отдельности (-1 = как radius), 3D-наклон, свободная трансформация
        'r1' => ['n', -1, 150, -1], 'r2' => ['n', -1, 150, -1], 'r3' => ['n', -1, 150, -1], 'r4' => ['n', -1, 150, -1],
        'rx' => ['n', -80, 80, 0], 'ry' => ['n', -80, 80, 0], 'persp' => ['n', 50, 3000, 600],
        'q' => ['quad'],
        // объём и спецэффекты
        'lift' => ['n', 0, 30, 0], 'pop' => ['b', false],
        'holo' => ['e', MAG_HOLO, 'none'], 'holoA' => ['n', 0, 1, 0.6],
        'reveal' => ['e', ['none', 'flashlight'], 'none'], 'revR' => ['n', 10, 120, 35],
        'peel' => ['b', false],
    ];
    $text = [
        'font' => ['font', 'Onest'], 'size' => ['n', 4, 300, 10],
        'weight' => ['e', [300, 400, 500, 600, 700, 800, 900], 400], 'italic' => ['b', false], 'upper' => ['b', false],
        'align' => ['e', ['left', 'center', 'right', 'justify'], 'left'],
        'valign' => ['e', ['top', 'middle', 'bottom'], 'top'],
        'lh' => ['n', 0.6, 3, 1.3], 'ls' => ['n', -0.2, 1, 0], 'color' => ['c', '#141414'],
        'tfx' => ['e', MAG_TFX, 'none'], 'tfxD' => ['n', 0, 20, 6], 'tfxA' => ['n', 0, 360, 45], 'tfxC' => ['c', '#000000'],
        'bend' => ['n', -100, 100, 0],
    ];
    $fam = mag_types()[$type] ?? 'box';
    $r = $box;
    if ($fam === 'text') $r += $text;
    if ($type === 'body') $r += ['cols' => ['n', 1, 4, 2], 'gap' => ['n', 0, 30, 6], 'dropcap' => ['b', false], 'indent' => ['b', true], 'dc' => ['c', '#c32178']];
    if ($type === 'quote') $r += ['marks' => ['b', true], 'dc' => ['c', '#c32178']];
    if ($type === 'coverline') $r += ['dc' => ['c', '#c32178']];
    if ($fam === 'image') $r += [
        'src' => ['src', ''], 'fit' => ['e', ['cover', 'contain'], 'cover'],
        'fx' => ['n', 0, 100, 50], 'fy' => ['n', 0, 100, 50], 'zoom' => ['n', 1, 4, 1],
        'gray' => ['n', 0, 1, 0], 'contrast' => ['n', 0.3, 2, 1],
        'tintOn' => ['b', false], 'tint' => ['c', '#c32178'], 'tintA' => ['n', 0, 1, 0.35],
        'tintMode' => ['e', ['multiply', 'color', 'screen', 'overlay'], 'multiply'],
    ];
    if ($fam === 'barcode') $r += ['code' => ['code', '460700123456'], 'color' => ['c', '#111111']];
    if ($fam === 'game') $r += [
        'gameId' => ['int', 0], 'gameName' => ['str', 120, ''], 'gameCover' => ['url', ''],
        'label' => ['str', 40, 'Играть'], 'accent' => ['c', '#c32178'], 'showName' => ['b', true],
        'fit' => ['e', ['cover', 'contain'], 'cover'],
    ];
    return $r;
}

function mag_clamp($v, float $min, float $max, float $def): float
{
    if (!is_numeric($v)) return $def;
    $v = (float)$v;
    if (!is_finite($v)) return $def;
    return max($min, min($max, mag_r3($v)));
}

// Шрифт: из списка или любое семейство Google Fonts (латиница, цифры, пробелы)
function mag_font_ok($v): bool
{
    return is_string($v) && (isset(mag_fonts()[$v]) || preg_match('/^[A-Za-z][A-Za-z0-9 ]{1,39}$/', $v));
}

function sanitize_props(string $type, $p): array
{
    $p = is_array($p) ? $p : [];
    $out = [];
    foreach (mag_rules($type) as $k => $rule) {
        $v = $p[$k] ?? null;
        switch ($rule[0]) {
            case 'n':
                $out[$k] = mag_clamp($v, $rule[1], $rule[2], $rule[3]);
                break;
            case 'b':
                $out[$k] = $v === null ? $rule[1] : (bool)$v;
                break;
            case 'c':
                $out[$k] = valid_color($v, $rule[1]);
                break;
            case 'e':
                $out[$k] = in_array($v, $rule[1], false) ? $rule[1][array_search($v, $rule[1], false)] : $rule[2];
                break;
            case 'font':
                $out[$k] = mag_font_ok($v) ? trim($v) : $rule[1];
                break;
            case 'quad':
                $q = [0, 0, 0, 0, 0, 0, 0, 0];
                if (is_array($v) && count($v) === 8) {
                    foreach (array_values($v) as $i => $x) $q[$i] = mag_clamp($x, -0.5, 0.5, 0);
                }
                $out[$k] = $q;
                break;
            case 'src':
                $out[$k] = (is_string($v) && preg_match('~^(uploads/\d+/[a-f0-9]{40}\.(jpg|png|webp|gif)|assets/demo/[a-z\-]+\.png)$~', $v)) ? $v : '';
                break;
            case 'int':
                $out[$k] = (is_numeric($v) && (int)$v > 0) ? min((int)$v, 2147483647) : $rule[1];
                break;
            case 'str':
                $t = is_string($v) ? trim(preg_replace('/[\p{C}]/u', ' ', $v) ?? '') : '';
                $out[$k] = $t === '' ? $rule[2] : mb_substr($t, 0, $rule[1]);
                break;
            case 'url':
                // http(s)://… или путь от корня сайта; без пробелов, кавычек, угловых скобок и обратных слешей
                $ok = is_string($v) && strlen($v) <= 500 && strpbrk($v, " \t\r\n\"'<>\\") === false
                    && preg_match('~^(https?://|/(?!/))~i', $v);
                $out[$k] = $ok ? $v : $rule[1];
                break;
            case 'code':
                $d = preg_replace('/\D/', '', (string)$v);
                $out[$k] = strlen($d) >= 12 ? substr($d, 0, 12) : $rule[1];
                break;
        }
    }
    return $out;
}

function sanitize_block($b): ?array
{
    if (!is_array($b)) return null;
    $type = $b['type'] ?? '';
    if (!isset(mag_types()[$type])) return null;
    $id = (is_string($b['id'] ?? null) && preg_match('/^[a-z0-9]{1,24}$/', $b['id'])) ? $b['id'] : 'b' . bin2hex(random_bytes(5));
    $o = [
        'id' => $id, 'type' => $type,
        'x' => mag_clamp($b['x'] ?? 0, -420, 630, 0),
        'y' => mag_clamp($b['y'] ?? 0, -297, 594, 0),
        'w' => mag_clamp($b['w'] ?? 50, 0.2, 840, 50),
        'h' => mag_clamp($b['h'] ?? 20, 0.2, 600, 20),
        'r' => mag_clamp($b['r'] ?? 0, -180, 180, 0),
        'z' => (int)mag_clamp($b['z'] ?? 1, 0, 99999, 1),
        'lock' => !empty($b['lock']),
        'hide' => !empty($b['hide']),
        'p' => sanitize_props($type, $b['p'] ?? []),
    ];
    if (mag_types()[$type] === 'text') {
        $t = (string)($b['text'] ?? '');
        $t = preg_replace('/[^\P{C}\n]/u', '', str_replace(["\r\n", "\r"], "\n", $t)) ?? '';
        $o['text'] = mb_substr($t, 0, 20000);
    }
    return $o;
}

function sanitize_layout($l): array
{
    $l = is_array($l) ? $l : [];
    $blocks = [];
    foreach (array_slice(is_array($l['blocks'] ?? null) ? $l['blocks'] : [], 0, 300) as $b) {
        $s = sanitize_block($b);
        if ($s) $blocks[] = $s;
    }
    return [
        'bg'       => valid_color($l['bg'] ?? '', '#ffffff'),
        'density'  => in_array($l['density'] ?? '', MAG_STIFF, true) ? $l['density'] : 'auto',
        'material' => in_array($l['material'] ?? '', MAG_MATTER, true) ? $l['material'] : 'auto',
        'finish'   => in_array($l['finish'] ?? '', ['matte', 'gloss'], true) ? $l['finish'] : 'auto',   // старое поле
        'blocks'   => $blocks,
    ];
}

/* ---------- числа: одинаково с render.js ---------- */

function mag_r3($v): float
{
    $v = (float)$v;
    $s = $v < 0 ? -1 : 1;
    return $s * floor(abs($v) * 1000 + 0.5) / 1000;
}

function mag_num($v): string
{
    $s = preg_replace('/\.?0+$/', '', sprintf('%.3F', mag_r3($v)));
    return ($s === '-0' || $s === '') ? '0' : $s;
}

/* ---------- бумага ---------- */

// Физический лист = полоса и её оборот. При showCover в page-flip: (0,1), (2,3), (4,5)…
function mag_sheet_partner(int $i, int $count): ?int
{
    $p = ($i % 2 === 0) ? $i + 1 : $i - 1;
    return ($p >= 0 && $p < $count) ? $p : null;
}

function mag_material_of(array $pg): string
{
    $m = $pg['layout']['material'] ?? 'auto';
    if ($m === 'auto') {
        $f = $pg['layout']['finish'] ?? 'auto';
        if ($f === 'gloss' || $f === 'matte') $m = $f;
    }
    if ($m === 'auto') $m = $pg['kind'] === 'page' ? 'offset' : 'gloss';
    return $m;
}

function mag_stiff_of(array $pg): string
{
    $d = $pg['layout']['density'] ?? 'auto';
    if ($d !== 'auto') return $d;
    if ($pg['kind'] !== 'page') return 'hard';
    $m = mag_material_of($pg);
    return $m === 'news' ? 'thin' : (in_array($m, ['gloss', 'holo', 'foil'], true) ? 'stiff' : 'soft');
}

// page-flip рисует лист целиком: жёсткость — на лист (самая жёсткая из сторон), материал — на полосу.
function mag_paper(array $pages, int $i): array
{
    $s = mag_stiff_of($pages[$i]);
    $q = mag_sheet_partner($i, count($pages));
    if ($q !== null) {
        $t = mag_stiff_of($pages[$q]);
        if (array_search($t, MAG_STIFF, true) > array_search($s, MAG_STIFF, true)) $s = $t;
    }
    return ['density' => $s === 'hard' ? 'hard' : 'soft', 'stiff' => $s, 'material' => mag_material_of($pages[$i]), 'side' => $i % 2 === 0 ? 'R' : 'L'];
}

/* ---------- штрихкод ---------- */

// EAN-13: 12 цифр → [13 цифр, строка модулей из 0/1]
function mag_ean13(string $code): array
{
    $d = substr(str_pad(preg_replace('/\D/', '', $code), 12, '0'), 0, 12);
    $sum = 0;
    for ($i = 0; $i < 12; $i++) $sum += (int)$d[$i] * ($i % 2 ? 3 : 1);
    $d .= (string)((10 - $sum % 10) % 10);
    $L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    $R = array_map(function ($p) { return strtr($p, '01', '10'); }, $L);
    $G = array_map('strrev', $R);
    $par = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    $bits = '101';
    for ($i = 1; $i < 7; $i++) $bits .= ($par[(int)$d[0]][$i - 1] === 'L' ? $L : $G)[(int)$d[$i]];
    $bits .= '01010';
    for ($i = 7; $i < 13; $i++) $bits .= $R[(int)$d[$i]];
    $bits .= '101';
    return [$d, $bits];
}

function mag_barcode_svg(string $bits): string
{
    $rects = '';
    $n = strlen($bits);
    for ($i = 0; $i < $n;) {
        if ($bits[$i] !== '1') { $i++; continue; }
        $j = $i;
        while ($j < $n && $bits[$j] === '1') $j++;
        $rects .= '<rect x="' . $i . '" width="' . ($j - $i) . '" height="1"/>';
        $i = $j;
    }
    return '<svg viewBox="0 0 ' . $n . ' 1" preserveAspectRatio="none" aria-hidden="true">' . $rects . '</svg>';
}

/* ---------- эффекты текста ---------- */

function mag_text_fx(array $p): array
{
    $kind = $p['tfx'] ?? 'none';
    if ($kind === 'none') return [];
    $D = (float)$p['tfxD'];
    $k = $D / 10;
    $C = $p['tfxC'];
    $a = (float)$p['tfxA'] * M_PI / 180;
    $dx = mag_r3(cos($a));
    $dy = mag_r3(sin($a));
    $e = function ($v) { return mag_num($v) . 'em'; };
    switch ($kind) {
        case 'emboss':
            return ['--tsh' => $e(-$dx * $k * .03) . ' ' . $e(-$dy * $k * .03) . ' 0 rgba(255,255,255,.75), '
                . $e($dx * $k * .03) . ' ' . $e($dy * $k * .03) . ' 0 rgba(0,0,0,.45), '
                . $e($dx * $k * .07) . ' ' . $e($dy * $k * .07) . ' ' . $e($k * .08) . ' rgba(0,0,0,.25)'];
        case 'deboss':
            return ['--tsh' => $e($dx * $k * .03) . ' ' . $e($dy * $k * .03) . ' 0 rgba(255,255,255,.7), '
                . $e(-$dx * $k * .03) . ' ' . $e(-$dy * $k * .03) . ' 0 rgba(0,0,0,.5)'];
        case 'extrude':
            $n = max(1, (int)floor($D + 0.5));
            $parts = [];
            for ($i = 1; $i <= $n; $i++) $parts[] = $e($dx * $i * .012) . ' ' . $e($dy * $i * .012) . ' 0 ' . $C;
            $parts[] = $e($dx * ($n + 2) * .012) . ' ' . $e($dy * ($n + 2) * .012) . ' ' . $e(.05 + $n * .01) . ' rgba(0,0,0,.35)';
            return ['--tsh' => implode(', ', $parts)];
        case 'outline':
            return ['--tst' => $e(max(.01, $k * .03)) . ' ' . $C];
        case 'neon':
            return ['--tsh' => '0 0 ' . $e(.04 * $k) . ' #fff, 0 0 ' . $e(.18 * $k) . ' ' . $C . ', 0 0 ' . $e(.45 * $k) . ' ' . $C . ', 0 0 ' . $e(.9 * $k) . ' ' . $C];
        case 'foil':
            return [
                '--tfill' => "linear-gradient(115deg, color-mix(in srgb, $C 55%, #000) 0%, color-mix(in srgb, $C 35%, #fff) 28%, $C 46%, #fff 54%, color-mix(in srgb, $C 70%, #000) 74%, $C 100%)",
                '--tdrop' => 'drop-shadow(' . $e($dx * $k * .02) . ' ' . $e($dy * $k * .02) . ' ' . $e($k * .03) . ' rgba(0,0,0,.35))',
            ];
    }
    return [];
}

/* ---------- блок ---------- */

function mag_font_stack(string $f): string
{
    return "'" . $f . "', " . (mag_fonts()[$f] ?? 'sans-serif');
}

function mag_block_vars(array $b, float $dx): string
{
    $p = $b['p'];
    $fam = mag_types()[$b['type']];
    $v = [
        '--x' => mag_num($b['x'] + $dx), '--y' => mag_num($b['y']), '--w' => mag_num($b['w']), '--h' => mag_num($b['h']),
        '--r' => mag_num($b['r']), '--z' => (string)$b['z'],
        '--op' => mag_num($p['opacity']), '--bl' => $p['blend'],
        '--rad' => mag_num($p['radius']), '--pad' => mag_num($p['pad']),
    ];
    foreach (['r1', 'r2', 'r3', 'r4'] as $rk) {
        if ($p[$rk] >= 0) $v['--' . $rk] = mag_num($p[$rk]);
    }
    if ($p['shape'] !== 'rect') $v['--clip'] = mag_shapes()[$p['shape']];
    if ($p['bgOn']) $v['--bg'] = $p['bg'];
    if ($p['bw'] > 0) { $v['--bw'] = mag_num($p['bw']); $v['--bc'] = $p['bc']; }
    if ($p['rx'] != 0 || $p['ry'] != 0) { $v['--rx'] = mag_num($p['rx']); $v['--ry'] = mag_num($p['ry']); $v['--persp'] = mag_num($p['persp']); }
    if ($p['lift'] > 0) $v['--lift'] = mag_num($p['lift']);
    if ($p['reveal'] === 'flashlight') $v['--revr'] = mag_num($p['revR']);
    if ($p['holo'] !== 'none') $v['--holoA'] = mag_num($p['holoA']);
    if ($fam === 'text') {
        $v += [
            '--ff' => mag_font_stack($p['font']),
            '--fs' => mag_num($p['size']), '--fw' => (string)$p['weight'],
            '--fst' => $p['italic'] ? 'italic' : 'normal', '--tt' => $p['upper'] ? 'uppercase' : 'none',
            '--ta' => $p['align'], '--lh' => mag_num($p['lh']), '--ls' => mag_num($p['ls']), '--c' => $p['color'],
            '--va' => ['top' => 'flex-start', 'middle' => 'center', 'bottom' => 'flex-end'][$p['valign']],
        ];
        if (isset($p['dc'])) $v['--dc'] = $p['dc'];
        if ($b['type'] === 'body') { $v['--cols'] = mag_num($p['cols']); $v['--gap'] = mag_num($p['gap']); }
        $v += mag_text_fx($p);
    } elseif ($fam === 'image') {
        $v += ['--fit' => $p['fit'], '--fx' => mag_num($p['fx']), '--fy' => mag_num($p['fy']),
               '--zm' => mag_num($p['zoom']), '--gr' => mag_num($p['gray']), '--con' => mag_num($p['contrast'])];
        if ($p['tintOn']) { $v['--tint'] = $p['tint']; $v['--tA'] = mag_num($p['tintA']); $v['--tm'] = $p['tintMode']; }
    } elseif ($fam === 'barcode') {
        $v['--c'] = $p['color'];
    } elseif ($fam === 'game') {
        $v['--fit'] = $p['fit'];
        $v['--gac'] = $p['accent'];
    }
    $s = '';
    foreach ($v as $k => $val) $s .= $k . ':' . $val . ';';
    return $s;
}

function mag_block_attrs(array $b): string
{
    $p = $b['p'];
    $fam = mag_types()[$b['type']];
    $a = '';
    if ($p['rx'] != 0 || $p['ry'] != 0) $a .= ' data-3d';
    if ($p['lift'] > 0) $a .= ' data-lift';
    if ($p['pop']) $a .= ' data-pop';
    if ($p['holo'] !== 'none') $a .= ($fam === 'text' ? ' data-holot="' : ' data-holo="') . $p['holo'] . '"';
    if ($fam === 'text' && $p['tfx'] !== 'none') $a .= ' data-tfx="' . $p['tfx'] . '"';
    if ($p['reveal'] === 'flashlight') $a .= ' data-rv';
    if ($p['peel']) $a .= ' data-peel="' . $b['id'] . '"';
    if (array_filter($p['q'], function ($x) { return $x != 0; })) $a .= ' data-q="' . implode(' ', array_map('mag_num', $p['q'])) . '"';
    return $a;
}

// Изогнутый текст: SVG textPath, координаты в мм
function mag_bend_svg(array $b, string $salt): string
{
    $p = $b['p'];
    $IW = mag_r3(max(1, $b['w'] - 2 * $p['pad']));
    $IH = mag_r3(max(1, $b['h'] - 2 * $p['pad']));
    $fs = mag_r3($p['size'] * MAG_PT);
    $LH = mag_r3($fs * $p['lh']);
    $lines = explode("\n", (string)$b['text']);
    $T = count($lines) * $LH;
    $y0 = $p['valign'] === 'middle' ? ($IH - $T) / 2 : ($p['valign'] === 'bottom' ? $IH - $T : 0);
    $apex = $p['bend'] / 100 * $IW * 0.25;
    $anchor = $p['align'] === 'left' ? ['start', '0'] : ($p['align'] === 'right' ? ['end', '100'] : ['middle', '50']);
    $defs = '';
    $texts = '';
    foreach ($lines as $i => $line) {
        $y = $y0 + $LH * $i + $LH * 0.5 + $fs * 0.35;
        $id = 'bp-' . $salt . $b['id'] . '-' . $i;
        $defs .= '<path id="' . $id . '" d="M0 ' . mag_num($y) . ' Q' . mag_num($IW / 2) . ' ' . mag_num($y - 2 * $apex) . ' ' . mag_num($IW) . ' ' . mag_num($y) . '"/>';
        $texts .= '<text text-anchor="' . $anchor[0] . '" style="font-size:' . mag_num($fs) . 'px;letter-spacing:' . mag_num($p['ls']) . 'em"><textPath href="#' . $id . '" startOffset="' . $anchor[1] . '%">' . e($line) . '</textPath></text>';
    }
    return '<svg class="bend" viewBox="0 0 ' . mag_num($IW) . ' ' . mag_num($IH) . '"><defs>' . $defs . '</defs>' . $texts . '</svg>';
}

function render_block(array $b, float $dx, string $base, bool $placeholders = false, bool $static = false, string $salt = ''): string
{
    $p = $b['p'];
    $fam = mag_types()[$b['type']];
    $inner = '';
    if ($fam === 'text') {
        if ($b['type'] === 'body') {
            $cls = 'tx' . ($p['dropcap'] ? ' dc' : '') . ($p['indent'] ? ' ind' : '');
            $paras = '';
            foreach (explode("\n", $b['text']) as $par) {
                if (trim($par) !== '') $paras .= '<p>' . e($par) . '</p>';
            }
            $inner = '<div class="' . $cls . '">' . $paras . '</div>';
        } elseif ($p['bend'] != 0) {
            $inner = '<div class="tx bent">' . mag_bend_svg($b, $salt) . '</div>';
        } else {
            $inner = '<div class="tx' . ($b['type'] === 'quote' && !$p['marks'] ? ' nomark' : '') . '">' . e($b['text']) . '</div>';
        }
    } elseif ($fam === 'image') {
        if ($p['src'] !== '') {
            $inner = '<img src="' . e($base . '/' . $p['src']) . '" alt="" decoding="async" draggable="false">';
            if ($p['tintOn']) $inner .= '<div class="tint"></div>';
        } elseif ($placeholders) {
            $inner = '<div class="ph">Перетащите фото<br>или выберите файл</div>';
        }
    } elseif ($fam === 'barcode') {
        [$digits, $bits] = mag_ean13($p['code']);
        $inner = mag_barcode_svg($bits) . '<div class="bcn">' . $digits[0] . ' ' . substr($digits, 1, 6) . ' ' . substr($digits, 7) . '</div>';
    } elseif ($fam === 'game') {
        // Фасад вместо iframe: обложка + кнопка. Сам плеер поднимает вьюер по клику (viewer.php).
        if ($p['gameCover'] !== '') $inner .= '<img class="gm-cover" src="' . e($p['gameCover']) . '" alt="" loading="lazy" decoding="async" draggable="false">';
        if ($p['gameId'] > 0) {
            // в миниатюрах (полка, лента) кнопка лежала бы внутри <a>/<button> — там рисуем span
            $inner .= $static
                ? '<span class="gm-play"><i></i><span>' . e($p['label']) . '</span></span>'
                : '<button class="gm-play" type="button" data-game="' . $p['gameId'] . '" data-name="' . e($p['gameName']) . '" aria-label="' . e($p['label'] . ': ' . $p['gameName']) . '"><i></i><span>' . e($p['label']) . '</span></button>';
        } elseif ($placeholders) {
            $inner .= '<div class="gm-empty">Укажите игру</div>';
        }
        if ($p['showName'] && $p['gameName'] !== '') $inner .= '<div class="gm-name">' . e($p['gameName']) . '</div>';
    }
    return '<div class="blk t-' . $b['type'] . '"' . mag_block_attrs($b) . ' style="' . e(mag_block_vars($b, $dx)) . '"><div class="ct">' . $inner . '</div></div>';
}

/* ---------- полоса ---------- */

// Какие полосы стоят рядом (как в page-flip с showCover: обложка одна, дальше пары)
function mag_facing(int $i, int $count): ?int
{
    if ($i === 0) return null;
    $f = ($i % 2 === 1) ? $i + 1 : $i - 1;
    return ($f >= 1 && $f < $count) ? $f : null;
}

// Блоки полосы + заходящие с соседней. Порядок по z; при равном z левая полоса ниже правой — как на столе редактора.
function mag_page_items(array $pages, int $i): array
{
    $items = [];
    $add = function (int $pi, float $dx) use (&$items, $pages) {
        foreach ($pages[$pi]['layout']['blocks'] as $b) {
            if ($b['hide']) continue;
            if ($dx != 0 && !($b['x'] + $dx < MAG_PW && $b['x'] + $dx + $b['w'] > 0)) continue;
            $items[] = [$b, $dx, $pi];
        }
    };
    $add($i, 0.0);
    $f = mag_facing($i, count($pages));
    if ($f !== null) $add($f, (float)(($i % 2 === 1) ? MAG_PW : -MAG_PW));
    usort($items, function ($a, $c) { return ($a[0]['z'] <=> $c[0]['z']) ?: ($a[2] <=> $c[2]); });
    return $items;
}

function render_page(array $pages, int $i, array $settings, string $base, bool $placeholders = false, bool $static = false): string
{
    $page = $pages[$i];
    $html = '';
    foreach (mag_page_items($pages, $i) as [$b, $dx, $pi]) {
        $html .= render_block($b, $dx, $base, $placeholders, $static, $pi === $i ? '' : 'f');
    }
    if ($settings['folios'] && $page['kind'] === 'page') {
        $side = ($i % 2 === 1) ? 'L' : 'R';
        $num = '<b>' . ($i + 1) . '</b>';
        $mag = '<span>' . e($settings['mag']) . '</span>';
        $html .= '<div class="folio ' . $side . '">' . ($side === 'L' ? $num . $mag : $mag . $num) . '</div>';
    }
    $q = mag_paper($pages, $i);
    return '<div class="pg kind-' . $page['kind'] . '" data-density="' . $q['density'] . '" data-stiff="' . $q['stiff']
        . '" data-material="' . $q['material'] . '" data-side="' . $q['side'] . '" style="'
        . e('--pg-bg:' . $page['layout']['bg'] . ';--folio:' . $settings['folioColor']) . '">' . $html . '</div>';
}

function mag_custom_fonts(array $pages): array
{
    $out = [];
    foreach ($pages as $pg) {
        foreach ($pg['layout']['blocks'] as $b) {
            if (mag_types()[$b['type']] === 'text' && !isset(mag_fonts()[$b['p']['font']])) $out[$b['p']['font']] = true;
        }
    }
    return array_keys($out);
}

// Отдельная ссылка на каждое начертание: если у семейства нет 700, упадёт только второй запрос
function mag_font_css_urls(string $name): array
{
    $fam = str_replace('%20', '+', rawurlencode($name));
    return [
        "https://fonts.googleapis.com/css2?family=$fam&display=swap",
        "https://fonts.googleapis.com/css2?family=$fam:wght@700&display=swap",
    ];
}

function page_css(): string
{
    static $css = null;
    if ($css === null) $css = (string)file_get_contents(STUDIO_DIR . '/assets/page.css');
    return $css;
}

function page_document(array $pages, int $i, array $issue, array $settings, string $base, array $customFonts = []): string
{
    $title = e($issue['title']) . ' — полоса ' . ($i + 1);
    $links = '<link rel="stylesheet" href="' . e(cfg('fonts_css')) . "\" data-mag-font>\n";
    foreach ($customFonts as $f) {
        foreach (mag_font_css_urls($f) as $u) $links .= '<link rel="stylesheet" href="' . e($u) . "\" data-mag-font>\n";
    }
    return "<!DOCTYPE html>\n<html lang=\"ru\">\n<head>\n<meta charset=\"UTF-8\">\n"
        . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
        . "<title>$title</title>\n"
        . $links
        . "<style data-mag>\n" . page_css() . "\n</style>\n"
        . "<style data-doc>\nhtml, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #fff; }\n"
        . ".pg { width: min(100%, calc(100vh * 210 / 297)); margin: 0 auto; }\n</style>\n"
        . "</head>\n<body>\n" . render_page($pages, $i, $settings, $base) . "\n"
        // свободная трансформация считается по реальному размеру; вьюер делает то же самое сам
        . '<script src="' . e($base . '/assets/render.js') . "\"></script>\n"
        . "<script>addEventListener('load',()=>MagRender.applyQuads(document));addEventListener('resize',()=>MagRender.applyQuads(document));</script>\n"
        . "</body>\n</html>\n";
}

/* ---------- экспорт ---------- */

function export_issue(array $issue): array
{
    $pages = issue_pages((int)$issue['id']);
    foreach ($pages as &$pg) $pg['layout'] = sanitize_layout($pg['layout']);
    unset($pg);
    $settings = issue_settings($issue);
    $base = base_url();
    $slug = $issue['slug'];
    $root = STUDIO_DIR . '/issues';
    $dir = "$root/$slug";
    $tmp = "$dir.tmp-" . bin2hex(random_bytes(3));
    $fonts = mag_custom_fonts($pages);

    if (!is_dir($root)) mkdir($root, 0775, true);
    mkdir($tmp, 0775);

    $list = [];
    foreach ($pages as $i => $pg) {
        $file = "page$i.html";
        file_put_contents("$tmp/$file", page_document($pages, $i, $issue, $settings, $base, $fonts));
        $q = mag_paper($pages, $i);
        $list[] = ['url' => "$base/issues/$slug/$file", 'file' => $file, 'kind' => $pg['kind'],
                   'density' => $q['density'], 'stiff' => $q['stiff'], 'material' => $q['material'],
                   'finish' => in_array($q['material'], ['gloss', 'holo', 'foil'], true) ? 'gloss' : 'matte'];
    }
    $games = [];
    foreach ($pages as $pg) {
        foreach ($pg['layout']['blocks'] as $b) {
            if ($b['type'] === 'game' && !$b['hide'] && $b['p']['gameId'] > 0) $games[$b['p']['gameId']] = true;
        }
    }
    $fontUrls = [];
    foreach ($fonts as $f) $fontUrls = array_merge($fontUrls, mag_font_css_urls($f));
    $manifest = [
        'title'   => $issue['title'],
        'games'   => array_keys($games),
        'fonts'   => $fontUrls,
        'slug'    => $slug,
        'updated' => date('c'),
        'format'  => ['mm' => [MAG_PW, MAG_PH], 'px' => [595, 842]],
        'viewer'  => "$base/viewer.php?i=$slug",
        'pages'   => $list,
    ];
    file_put_contents("$tmp/pages.json", json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

    // атомарная подмена: читатели не увидят полувыгруженный выпуск
    $old = null;
    if (is_dir($dir)) {
        $old = "$dir.old-" . bin2hex(random_bytes(3));
        rename($dir, $old);
    }
    rename($tmp, $dir);
    if ($old) rrmdir($old);

    return $manifest;
}

/* ---------- веб-плеер ---------- */

function webplayer_dir(): string
{
    $d = cfg('webplayer_data_dir');
    return $d ?: rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\') . '/webplayerdata';
}

// Состояние сборки прямо с диска (тот же .meta.json, что пишет webplayer.php) — без HTTP-запроса к себе.
function webplayer_meta(int $gameId): array
{
    $f = webplayer_dir() . '/' . $gameId . '/.meta.json';
    $m = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($m) ? $m : ['state' => 'absent'];
}
