<?php
// newmagazine/studio/config.php
// Настройки модуля журналов. Всё остальное подтягивается из lib.php.

return [
    // Источник БД:
    //  'dustore' — взять PDO из /swad/config.php (класс Database), таблицы mag_* лягут в базу dustore (миграция только additive);
    //  'mysql'   — свои реквизиты ниже;
    //  'sqlite'  — файл data/studio.sqlite (для локальной проверки без MySQL).
    'db_driver' => 'dustore',

    'mysql' => [
        'dsn'  => 'mysql:host=127.0.0.1;dbname=dustore;charset=utf8mb4',
        'user' => 'root',
        'pass' => '',
    ],

    // Лимиты
    'max_pages'        => 200,          // полос в одном выпуске
    'max_issues_guest' => 5,            // выпусков у гостя без аккаунта Dustore
    'max_upload_mb'    => 8,
    'max_image_side'   => 2400,         // px, больше — ужимаем

    // Веб-плеер Dustore (webplayer.php в корне сайта)
    'webplayer_url'      => '/webplayer.php',   // ?id=N&status=1 / &prepare=1
    'webplayer_data_url' => '/webplayerdata',   // распакованные игры: /webplayerdata/<id>/www/…
    'webplayer_data_dir' => null,               // null → DOCUMENT_ROOT/webplayerdata

    // Шрифты для редактора и экспортированных страниц
    'fonts_css' => 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&family=Manrope:wght@400;600;800&family=Onest:wght@400;500;600;700&family=Oswald:wght@400;600&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Rubik+Mono+One&family=Unbounded:wght@400;700;900&family=Yeseva+One&display=swap',
];
