import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
      my_people_profile TEXT DEFAULT '{}',
      my_people         TEXT DEFAULT '[]',
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
  if (!studentColumns.some((column) => column.name === "reward_videos_updated_at")) {
    db.exec("ALTER TABLE students ADD COLUMN reward_videos_updated_at TEXT");
    // Backfill: give existing non-empty video lists a timestamp so a stale client
    // write can't blank them out (same protection as photo_updated_at above).
    db.exec("UPDATE students SET reward_videos_updated_at = updated_at WHERE reward_videos IS NOT NULL AND reward_videos != '[]'");
  }
  if (!studentColumns.some((column) => column.name === "close_adults_updated_at")) {
    db.exec("ALTER TABLE students ADD COLUMN close_adults_updated_at TEXT");
    db.exec("UPDATE students SET close_adults_updated_at = updated_at WHERE close_adults IS NOT NULL AND close_adults != '[]'");
  }
  if (!studentColumns.some((column) => column.name === "my_people_profile")) {
    db.exec("ALTER TABLE students ADD COLUMN my_people_profile TEXT DEFAULT '{}'");
  }
  if (!studentColumns.some((column) => column.name === "my_people_profile_updated_at")) {
    db.exec("ALTER TABLE students ADD COLUMN my_people_profile_updated_at TEXT");
  }
  if (!studentColumns.some((column) => column.name === "my_people")) {
    db.exec("ALTER TABLE students ADD COLUMN my_people TEXT DEFAULT '[]'");
  }
  if (!studentColumns.some((column) => column.name === "my_people_updated_at")) {
    db.exec("ALTER TABLE students ADD COLUMN my_people_updated_at TEXT");
  }
  // GDPR Art. 9: the free-text "comment" field can carry health/development
  // data (speech-therapy notes, diagnoses) — that's a special category and
  // needs its own explicit consent, separate from the account-level consent
  // checkbox at registration.
  if (!studentColumns.some((column) => column.name === "health_data_consent")) {
    db.exec("ALTER TABLE students ADD COLUMN health_data_consent INTEGER DEFAULT 0");
  }
  if (!studentColumns.some((column) => column.name === "health_data_consent_at")) {
    db.exec("ALTER TABLE students ADD COLUMN health_data_consent_at TEXT");
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS materials_leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL,
      material_id   TEXT NOT NULL,
      token_hash    TEXT UNIQUE NOT NULL,
      created_at    TEXT NOT NULL,
      expires_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_materials_leads_token ON materials_leads(token_hash);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                   TEXT PRIMARY KEY,
      account_id           TEXT NOT NULL UNIQUE REFERENCES accounts(id),
      provider             TEXT NOT NULL,          -- 'stripe' | 'lava_top' | 'promo'
      plan                 TEXT NOT NULL,          -- 'monthly' | 'half_year' | 'annual' | 'free_grant'
      status               TEXT NOT NULL,          -- 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'refunded'
      currency             TEXT NOT NULL,
      amount_minor         INTEGER NOT NULL,
      external_contract_id TEXT UNIQUE,            -- Mironium-generated orderId, the correlation key with the provider
      applied_code         TEXT,                   -- promo code used at checkout, if any — finalized as redeemed only on webhook success
      current_period_end   TEXT NOT NULL,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id           TEXT PRIMARY KEY,
      account_id   TEXT REFERENCES accounts(id),
      provider     TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      external_id  TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      UNIQUE(provider, event_type, external_id)
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      code                 TEXT PRIMARY KEY,
      kind                 TEXT NOT NULL,          -- 'percent_off' | 'fixed_off' | 'free_grant'
      value                INTEGER,
      currency             TEXT,
      applies_to_plan      TEXT,
      grant_duration_days  INTEGER,
      max_redemptions      INTEGER,
      redeemed_count       INTEGER NOT NULL DEFAULT 0,
      expires_at           TEXT,
      note                 TEXT,
      created_at           TEXT NOT NULL,
      created_by           TEXT
    );

    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id          TEXT PRIMARY KEY,
      code        TEXT NOT NULL REFERENCES promo_codes(code),
      account_id  TEXT NOT NULL REFERENCES accounts(id),
      redeemed_at TEXT NOT NULL,
      UNIQUE(code, account_id)
    );

    -- One row per checkout attempt (never overwritten by a later one --
    -- the old "subscriptions" table used to be keyed UNIQUE(account_id),
    -- which meant a second purchase silently discarded the first
    -- checkout's orderId/amount/currency, breaking audit, refunds and
    -- chargebacks). "pending" until a webhook confirms or the account
    -- starts a newer checkout (see billing-repository.createOrder, which
    -- marks superseded pending orders "abandoned").
    CREATE TABLE IF NOT EXISTS orders (
      id                    TEXT PRIMARY KEY,
      account_id            TEXT NOT NULL REFERENCES accounts(id),
      provider              TEXT NOT NULL,          -- 'stripe' | 'lava_top'
      plan                  TEXT NOT NULL,          -- 'monthly' | 'half_year' | 'annual'
      status                TEXT NOT NULL,          -- 'pending' | 'completed' | 'refunded' | 'chargeback' | 'abandoned'
      currency              TEXT NOT NULL,
      amount_minor          INTEGER NOT NULL,
      external_contract_id  TEXT UNIQUE,            -- Mironium-generated orderId, the correlation key with the provider
      applied_code          TEXT,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id);

    -- The actual, time-boxed access grant -- decoupled from "orders" so a
    -- pending/failed checkout can never affect current access, and from
    -- the old single-row "subscriptions" table so each grant (trial,
    -- promo, a paid order, a renewal) keeps its own row instead of one
    -- overwriting another. "Current access" is whichever active row has
    -- the furthest ends_at (see hasActiveEntitlement / getActiveSubscription
    -- ForAccount in billing-repository.mjs).
    CREATE TABLE IF NOT EXISTS entitlements (
      id                    TEXT PRIMARY KEY,
      account_id            TEXT NOT NULL REFERENCES accounts(id),
      source                TEXT NOT NULL,          -- 'trial' | 'order' | 'promo'
      source_id             TEXT,                   -- orders.id, or a promo code, or a migration marker
      plan                  TEXT NOT NULL,          -- 'trial' | 'monthly' | 'half_year' | 'annual' | 'free_grant'
      status                TEXT NOT NULL,          -- 'active' | 'expired' | 'revoked'
      starts_at             TEXT NOT NULL,
      ends_at               TEXT NOT NULL,
      cancel_at_period_end  INTEGER DEFAULT 0,
      -- Dedup markers for scripts/entitlement-reminder-loop.mjs -- each
      -- reminder must fire at most once per entitlement, even though the
      -- loop re-scans all active entitlements on every run.
      reminder_5d_sent_at      TEXT,
      reminder_1d_sent_at      TEXT,
      reminder_expired_sent_at TEXT,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entitlements_account ON entitlements(account_id);
    CREATE INDEX IF NOT EXISTS idx_entitlements_account_active ON entitlements(account_id, status, ends_at);

    -- One row per checkout, recording exactly what the account agreed to
    -- and against which version of the legal docs -- a durable audit trail
    -- independent of whatever the current /terms page says later. Required
    -- before handleBillingCheckout will create an order at all (see
    -- LEGAL_DOCS_VERSION in lib/config.mjs).
    CREATE TABLE IF NOT EXISTS checkout_consents (
      id                      TEXT PRIMARY KEY,
      account_id              TEXT NOT NULL REFERENCES accounts(id),
      order_id                TEXT NOT NULL REFERENCES orders(id),
      legal_docs_version      TEXT NOT NULL,
      terms_accepted          INTEGER NOT NULL,
      price_period_confirmed  INTEGER NOT NULL,
      digital_content_ack     INTEGER NOT NULL,
      created_at              TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_checkout_consents_account ON checkout_consents(account_id);
  `);

  backfillOrdersAndEntitlementsFromLegacySubscriptions(db);

  return db;
}

// One-time (but safe to re-run) backfill from the old one-row-per-account
// "subscriptions" table into the orders/entitlements split above. Runs on
// every startup; each row it would insert is guarded by an existence
// check first, so a repeat run after the first does essentially nothing.
// This is necessarily a best-effort reconstruction -- the old schema had
// already discarded prior-purchase history by the time this ships, so a
// legacy account that bought twice only has its most recent purchase to
// backfill from.
function backfillOrdersAndEntitlementsFromLegacySubscriptions(db) {
  const legacyRows = db.prepare("SELECT * FROM subscriptions").all();
  for (const sub of legacyRows) {
    if (sub.provider === "stripe" || sub.provider === "lava_top") {
      const existingOrder = sub.external_contract_id
        ? db.prepare("SELECT 1 FROM orders WHERE external_contract_id = ?").get(sub.external_contract_id)
        : null;
      if (!existingOrder && sub.external_contract_id) {
        const orderStatus =
          sub.status === "refunded" ? "refunded" :
          sub.status === "pending" ? "pending" :
          "completed"; // active/past_due/cancelled/expired all mean "was paid at some point"
        db.prepare(`
          INSERT INTO orders
            (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, applied_code, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(), sub.account_id, sub.provider, sub.plan, orderStatus,
          sub.currency, sub.amount_minor, sub.external_contract_id, sub.applied_code,
          sub.created_at, sub.updated_at,
        );
      }
    }

    if (sub.status === "pending") continue; // a pending checkout never earned an entitlement

    const migratedSourceId = `migrated:${sub.id}`;
    const existingEntitlement = db.prepare("SELECT 1 FROM entitlements WHERE source_id = ?").get(migratedSourceId);
    if (existingEntitlement) continue;

    const entitlementStatus = sub.status === "active" ? "active" : sub.status === "refunded" ? "revoked" : "expired";
    const source = sub.provider === "trial" ? "trial" : sub.provider === "promo" ? "promo" : "order";
    db.prepare(`
      INSERT INTO entitlements
        (id, account_id, source, source_id, plan, status, starts_at, ends_at, cancel_at_period_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), sub.account_id, source, migratedSourceId, sub.plan, entitlementStatus,
      sub.created_at, sub.current_period_end, sub.cancel_at_period_end ?? 0, sub.created_at, sub.updated_at,
    );
  }
}

// Runs `fn` inside a single SQLite transaction: either every write it makes
// commits together, or (on a throw) none of them do. Webhook processing
// depends on this -- recording the payment_event, completing the order,
// extending the entitlement, finalizing a promo redemption and bumping the
// sync revision must all succeed or all roll back, or a crash between two
// of those steps could leave a payment recorded with no entitlement
// granted (or vice versa), with no way for a retried delivery to fix it
// (payment_events' own idempotency check would then see the event as
// already-processed and skip it again).
export function withTransaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ROLLBACK itself only fails if there's no open transaction (e.g. the
      // error came from something that already closed it) -- the original
      // error is what matters to the caller either way.
    }
    throw err;
  }
}

export function getDb() {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}
