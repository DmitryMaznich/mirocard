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
  `);

  const studentColumns = db.prepare("PRAGMA table_info(students)").all();
  if (!studentColumns.some((column) => column.name === "reward_videos")) {
    db.exec("ALTER TABLE students ADD COLUMN reward_videos TEXT DEFAULT '[]'");
  }

  const linkColumns = db.prepare("PRAGMA table_info(student_topic_links)").all();
  if (!linkColumns.some((c) => c.name === "params")) {
    db.exec("ALTER TABLE student_topic_links ADD COLUMN params TEXT DEFAULT '{}'");
    db.exec("ALTER TABLE student_topic_links ADD COLUMN video_reward_enabled INTEGER DEFAULT 1");
    db.exec("ALTER TABLE student_topic_links ADD COLUMN reward_threshold INTEGER DEFAULT 90");
  }

  return db;
}

export function getDb() {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}
