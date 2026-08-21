import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DB_PATH } from "./config.mjs";

let _db = null;

export function initDb(dbPath = DB_PATH) {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  db.exec("PRAGMA journal_mode=WAL");
  db.exec("PRAGMA foreign_keys=ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name  TEXT DEFAULT '',
      role          TEXT DEFAULT 'user',
      status        TEXT DEFAULT 'active',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_hash  TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id),
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash  TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id),
      expires_at  TEXT NOT NULL,
      used_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS account_settings (
      account_id             TEXT PRIMARY KEY REFERENCES accounts(id),
      ui_language            TEXT DEFAULT 'ru',
      card_language          TEXT DEFAULT 'ru',
      adult_pin_hash         TEXT,
      push_app_updates       INTEGER DEFAULT 1,
      push_topic_updates     INTEGER DEFAULT 1,
      push_reminders         INTEGER DEFAULT 0,
      updated_at             TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id               TEXT PRIMARY KEY,
      account_id       TEXT NOT NULL REFERENCES accounts(id),
      name             TEXT NOT NULL,
      comment          TEXT DEFAULT '',
      primary_language TEXT,
      reward_videos    TEXT DEFAULT '[]',
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      deleted_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id               TEXT PRIMARY KEY,
      account_id       TEXT NOT NULL REFERENCES accounts(id),
      student_id       TEXT NOT NULL,
      topic_id         TEXT NOT NULL,
      topic_version    TEXT NOT NULL,
      mode             TEXT NOT NULL,
      started_at       TEXT NOT NULL,
      completed_at     TEXT NOT NULL,
      correct_count    INTEGER DEFAULT 0,
      incorrect_count  INTEGER DEFAULT 0,
      percent_correct  INTEGER DEFAULT 0,
      mistakes         TEXT DEFAULT '[]',
      active_duration_ms INTEGER,
      elapsed_duration_ms INTEGER,
      params_snapshot_json TEXT NOT NULL DEFAULT '{}',
      entry_point      TEXT NOT NULL DEFAULT 'therapist',
      created_at       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id, topic_id);

    CREATE TABLE IF NOT EXISTS account_topics (
      id             TEXT PRIMARY KEY,
      account_id     TEXT NOT NULL REFERENCES accounts(id),
      topic_id       TEXT NOT NULL,
      topic_version  TEXT NOT NULL,
      acquired_at    TEXT NOT NULL,
      source         TEXT DEFAULT 'download',
      license_token  TEXT,
      deleted_at     TEXT
    );

    CREATE TABLE IF NOT EXISTS student_topic_links (
      id                   TEXT PRIMARY KEY,
      account_id           TEXT NOT NULL REFERENCES accounts(id),
      student_id           TEXT NOT NULL,
      topic_id             TEXT NOT NULL,
      selection_mode       TEXT DEFAULT 'auto',
      selected_concept_ids TEXT DEFAULT '[]',
      reps_per_concept     INTEGER DEFAULT 1,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      deleted_at           TEXT
    );

    CREATE TABLE IF NOT EXISTS concept_progress (
      student_id   TEXT NOT NULL,
      topic_id     TEXT NOT NULL,
      concept_id   TEXT NOT NULL,
      level        INTEGER DEFAULT 0,
      last_seen_at TEXT,
      updated_at   TEXT NOT NULL,
      PRIMARY KEY (student_id, topic_id, concept_id)
    );

    CREATE TABLE IF NOT EXISTS sync_revision (
      account_id TEXT PRIMARY KEY,
      revision   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      endpoint   TEXT NOT NULL,
      keys       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      hash         TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      data         TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audio_overrides (
      account_id   TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      topic_id     TEXT    NOT NULL,
      text_id      TEXT    NOT NULL,
      step_num     INTEGER NOT NULL,
      audio_data   BLOB    NOT NULL,
      content_type TEXT    NOT NULL DEFAULT 'audio/webm;codecs=opus',
      byte_size    INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL,
      PRIMARY KEY (account_id, topic_id, text_id, step_num)
    );
    CREATE INDEX IF NOT EXISTS idx_audio_overrides_lookup
      ON audio_overrides(account_id, topic_id, text_id);

    CREATE TABLE IF NOT EXISTS account_kv (
      account_id  TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      key         TEXT    NOT NULL,
      value       TEXT    NOT NULL,
      updated_at  INTEGER NOT NULL,
      PRIMARY KEY (account_id, key)
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token_hash  TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id),
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_portals (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL REFERENCES accounts(id),
      student_id      TEXT NOT NULL,
      token_hash      TEXT UNIQUE NOT NULL,
      label           TEXT,
      active_topic_id TEXT,
      active_mode_id  TEXT,
      created_at      TEXT NOT NULL,
      last_used_at    TEXT,
      revoked_at      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_portals_account ON student_portals(account_id);
    CREATE INDEX IF NOT EXISTS idx_portals_student ON student_portals(student_id);
    CREATE INDEX IF NOT EXISTS idx_portals_token   ON student_portals(token_hash);
  `);

  const studentColumns = db.prepare("PRAGMA table_info(students)").all();
  if (!studentColumns.some((column) => column.name === "reward_videos")) {
    db.exec("ALTER TABLE students ADD COLUMN reward_videos TEXT DEFAULT '[]'");
  }
  if (!studentColumns.some((column) => column.name === "close_adults")) {
    db.exec("ALTER TABLE students ADD COLUMN close_adults TEXT DEFAULT '[]'");
  }
  if (!studentColumns.some((column) => column.name === "sex")) {
    db.exec("ALTER TABLE students ADD COLUMN sex TEXT");
  }
  if (!studentColumns.some((column) => column.name === "photo")) {
    db.exec("ALTER TABLE students ADD COLUMN photo TEXT");
  }
  if (!studentColumns.some((column) => column.name === "photo_updated_at")) {
    db.exec("ALTER TABLE students ADD COLUMN photo_updated_at TEXT");
    // Backfill: give existing photos a timestamp so they don't get overwritten by null
    db.exec("UPDATE students SET photo_updated_at = updated_at WHERE photo IS NOT NULL");
  }

  const linkColumns = db.prepare("PRAGMA table_info(student_topic_links)").all();
  if (!linkColumns.some((c) => c.name === "params")) {
    db.exec("ALTER TABLE student_topic_links ADD COLUMN params TEXT DEFAULT '{}'");
    db.exec("ALTER TABLE student_topic_links ADD COLUMN video_reward_enabled INTEGER DEFAULT 1");
    db.exec("ALTER TABLE student_topic_links ADD COLUMN reward_threshold INTEGER DEFAULT 90");
  }

  const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
  if (!sessionColumns.some((c) => c.name === "card_events")) {
    db.exec("ALTER TABLE sessions ADD COLUMN card_events TEXT DEFAULT '[]'");
  }
  if (!sessionColumns.some((c) => c.name === "active_duration_ms")) {
    db.exec("ALTER TABLE sessions ADD COLUMN active_duration_ms INTEGER");
  }
  if (!sessionColumns.some((c) => c.name === "elapsed_duration_ms")) {
    db.exec("ALTER TABLE sessions ADD COLUMN elapsed_duration_ms INTEGER");
  }
  if (!sessionColumns.some((c) => c.name === "params_snapshot_json")) {
    db.exec("ALTER TABLE sessions ADD COLUMN params_snapshot_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!sessionColumns.some((c) => c.name === "entry_point")) {
    db.exec("ALTER TABLE sessions ADD COLUMN entry_point TEXT NOT NULL DEFAULT 'therapist'");
  }

  // Ensure unique email at DB level. Older DBs may lack the constraint if the
  // table was created before UNIQUE was in the schema. IF NOT EXISTS is safe to
  // run on every startup — it's a no-op once the index exists. We skip only
  // when duplicates are already present (rare; needs manual cleanup first).
  {
    const dupes = db.prepare(
      "SELECT email FROM accounts GROUP BY email HAVING COUNT(*) > 1"
    ).all();
    if (dupes.length === 0) {
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)");
    } else {
      console.warn(
        `[db] Cannot add unique email index: ${dupes.length} duplicate email(s) found. Clean up first.`
      );
    }
  }

  const accountColumns = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
  if (!accountColumns.includes("last_seen_at")) {
    db.exec("ALTER TABLE accounts ADD COLUMN last_seen_at TEXT");
  }
  if (!accountColumns.includes("open_count")) {
    db.exec("ALTER TABLE accounts ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0");
  }

  // Per-device activity tracked in auth_tokens, not in accounts
  const tokenColumns = db.prepare("PRAGMA table_info(auth_tokens)").all().map(c => c.name);
  if (!tokenColumns.includes("last_seen_at")) {
    db.exec("ALTER TABLE auth_tokens ADD COLUMN last_seen_at TEXT");
  }
  if (!tokenColumns.includes("device")) {
    db.exec("ALTER TABLE auth_tokens ADD COLUMN device TEXT");
  }
  if (!tokenColumns.includes("last_topic_id")) {
    db.exec("ALTER TABLE auth_tokens ADD COLUMN last_topic_id TEXT");
  }
  if (!accountColumns.includes("first_name")) {
    db.exec("ALTER TABLE accounts ADD COLUMN first_name TEXT NOT NULL DEFAULT ''");
  }
  if (!accountColumns.includes("last_name")) {
    db.exec("ALTER TABLE accounts ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
  }
  if (!accountColumns.includes("role")) {
    db.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'parent'");
  }
  if (!accountColumns.includes("referral_source")) {
    db.exec("ALTER TABLE accounts ADD COLUMN referral_source TEXT NOT NULL DEFAULT 'other'");
  }
  if (!accountColumns.includes("consent_personal_data_at")) {
    db.exec("ALTER TABLE accounts ADD COLUMN consent_personal_data_at TEXT NOT NULL DEFAULT ''");
  }
  if (!accountColumns.includes("feature_flags")) {
    db.exec("ALTER TABLE accounts ADD COLUMN feature_flags TEXT NOT NULL DEFAULT '[]'");
  }

  const portalColumns = db.prepare("PRAGMA table_info(student_portals)").all();
  if (!portalColumns.some((c) => c.name === "active_plan_data")) {
    db.exec("ALTER TABLE student_portals ADD COLUMN active_plan_data TEXT");
  }
  if (!portalColumns.some((c) => c.name === "active_text_id")) {
    db.exec("ALTER TABLE student_portals ADD COLUMN active_text_id TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_cache (
      id              INTEGER PRIMARY KEY,
      student_id      TEXT NOT NULL,
      topic_id        TEXT NOT NULL,
      prompt_version  TEXT NOT NULL,
      generated_at    INTEGER NOT NULL,
      result_json     TEXT NOT NULL,
      UNIQUE(student_id, topic_id)
    )
  `);

  return db;
}

export function getDb() {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}
