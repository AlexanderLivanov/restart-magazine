-- newmagazine/studio/install.sql
-- Схема модуля журналов. Только новые таблицы с префиксом mag_ — существующую базу dustore не трогает.
-- lib.php выполняет этот файл сам при первом запуске (маркер data/.schema_v1).

CREATE TABLE IF NOT EXISTS mag_issues (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug         VARCHAR(16)  NOT NULL,
    owner_key    VARCHAR(48)  NOT NULL,
    title        VARCHAR(160) NOT NULL,
    settings     TEXT         NOT NULL,
    status       ENUM('draft','published') NOT NULL DEFAULT 'draft',
    published_at DATETIME     NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mag_slug (slug),
    KEY ix_mag_owner (owner_key),
    KEY ix_mag_pub (status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mag_pages (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    issue_id   INT UNSIGNED NOT NULL,
    position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    kind       ENUM('cover','page','back') NOT NULL DEFAULT 'page',
    layout     MEDIUMTEXT   NOT NULL,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_mag_pages_issue (issue_id, position),
    CONSTRAINT fk_mag_pages_issue FOREIGN KEY (issue_id) REFERENCES mag_issues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
