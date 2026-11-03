import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { MARKETING_CONSENT_VERSION } from "./marketing-consent.mjs";
import { buildDeletionSurveyEmail } from "./deletion-survey-email.mjs";

export const DELETION_SURVEY_DELAY_MS = 86400000;
const RETRY_WINDOW_MS = 23 * 3600000; // Resend idempotency expires after 24 hours.
const LEASE_MS = 5 * 60000;
const runtime = { enabled: false, startedAt: null, lastTickAt: null };
export const deletionSurveyEmailHash = email => createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex");
const keyFor = hash => `mironium-deleted-account-survey-v1-${hash.slice(0, 32)}`;

function withdrawNews(db, accountId, now) {
  const changed = db.prepare("UPDATE accounts SET marketing_opt_in=0, updated_at=? WHERE id=? AND marketing_opt_in!=0")
    .run(new Date(now).toISOString(), accountId).changes;
  if (changed) db.prepare(`INSERT INTO marketing_consent_events (account_id,action,text_version,source,created_at)
    VALUES (?,'withdraw',?,'account_deletion',?)`).run(accountId, MARKETING_CONSENT_VERSION, new Date(now).toISOString());
}

export function initDeletionSurveySchema(db, history = JSON.parse(readFileSync(new URL("../data/deletion-survey-history.json", import.meta.url), "utf8"))) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_deletion_surveys (
    email_hash TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    archived_at TEXT,
    due_at INTEGER NOT NULL,
    next_attempt_at INTEGER NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('pending','sending','sent','cancelled','failed','uncertain')),
    attempts INTEGER NOT NULL DEFAULT 0,
    first_attempt_at INTEGER,
    lease_until INTEGER,
    payload_json TEXT,
    idempotency_key TEXT NOT NULL,
    sent_at TEXT,
    provider_email_id TEXT,
    last_error TEXT
  ); CREATE INDEX IF NOT EXISTS account_deletion_surveys_due ON account_deletion_surveys(state,next_attempt_at);
     CREATE INDEX IF NOT EXISTS account_deletion_surveys_account ON account_deletion_surveys(account_id);`);
  const insert = db.prepare(`INSERT OR IGNORE INTO account_deletion_surveys
    (email_hash,due_at,next_attempt_at,state,idempotency_key,sent_at,provider_email_id) VALUES (?,?,?,'sent',?,?,?)`);
  // Import the one-time Nov 2 campaign without publishing addresses or names.
  const imported = new Set();
  db.exec("SAVEPOINT deletion_survey_import");
  try {
    for (const row of history) {
      if (!/^[a-f0-9]{64}$/.test(row.emailHash) || !Number.isFinite(Date.parse(row.sentAt))) throw new Error("Invalid deletion survey history");
      if (insert.run(row.emailHash, Date.parse(row.sentAt), Date.parse(row.sentAt), keyFor(row.emailHash), row.sentAt, row.providerEmailId).changes)
        imported.add(row.emailHash);
    }
    if (imported.size) for (const a of db.prepare("SELECT id,email FROM accounts WHERE marketing_opt_in!=0").all())
      if (imported.has(deletionSurveyEmailHash(a.email))) withdrawNews(db, a.id, Date.now());
    db.exec("RELEASE deletion_survey_import");
  } catch (error) {
    db.exec("ROLLBACK TO deletion_survey_import; RELEASE deletion_survey_import");
    throw error;
  }
}

export function enqueueDeletionSurvey(db, account, archivedAt = new Date().toISOString()) {
  const deletedAt = Date.parse(archivedAt);
  if (!Number.isFinite(deletedAt) || !/^\S+@[^\s@]+\.[^\s@]+$/.test(account.email) || account.email.endsWith("@deleted.invalid")) return false;
  withdrawNews(db, account.id, deletedAt);
  const hash = deletionSurveyEmailHash(account.email);
  const due = deletedAt + DELETION_SURVEY_DELAY_MS;
  return !!db.prepare(`INSERT INTO account_deletion_surveys
    (email_hash,account_id,archived_at,due_at,next_attempt_at,state,idempotency_key)
    VALUES (?,?,?,?,?,'pending',?) ON CONFLICT(email_hash) DO UPDATE SET
      account_id=excluded.account_id, archived_at=excluded.archived_at, due_at=excluded.due_at,
      next_attempt_at=excluded.next_attempt_at, state='pending', lease_until=NULL, payload_json=NULL, last_error=NULL
    WHERE account_deletion_surveys.state='cancelled' AND account_deletion_surveys.attempts=0`)
    .run(hash, account.id, archivedAt, due, due, keyFor(hash)).changes;
}

export function cancelDeletionSurvey(db, accountId) {
  db.prepare(`UPDATE account_deletion_surveys SET state='cancelled',payload_json=NULL,lease_until=NULL
    WHERE account_id=? AND state IN ('pending','sending')`).run(accountId);
}

// Startup recovery also covers self-deletions between the manual campaign and
// this release. Imported receipts and a unique email hash prevent backfill spam.
export function backfillDeletionSurveys(db) {
  const rows = db.prepare(`SELECT a.*, l.scheduled_at AS archived_at FROM accounts a
    JOIN account_lifecycle l ON l.account_id=a.id WHERE a.status='archived' AND l.scheduled_at IS NOT NULL
    AND EXISTS(SELECT 1 FROM admin_account_events e WHERE e.account_id=a.id
      AND e.action='archive' AND e.actor='self' AND e.created_at=l.scheduled_at)`).all();
  for (const a of rows) {
    const hash = deletionSurveyEmailHash(a.email);
    if (!db.prepare("SELECT 1 FROM account_deletion_surveys WHERE email_hash=?").get(hash)) enqueueDeletionSurvey(db, a, a.archived_at);
  }
  return rows.length;
}

export function createDeletionSurveyDispatcher(db, {
  send, canSend = () => true, now = Date.now, logger = console, from, replyTo,
} = {}) {
  if (typeof send !== "function") throw new Error("Deletion survey sender is required");
  let running = false;
  return async function dispatch() {
    if (running) return 0;
    running = true;
    try {
      const at = now();
      // No recipient snapshot survives restoration or erasure before dispatch.
      db.prepare(`UPDATE account_deletion_surveys SET state='cancelled',payload_json=NULL,lease_until=NULL
        WHERE state IN ('pending','sending') AND NOT EXISTS(SELECT 1 FROM accounts a
          JOIN account_lifecycle l ON l.account_id=a.id
          WHERE a.id=account_deletion_surveys.account_id AND a.status='archived'
          AND l.scheduled_at=account_deletion_surveys.archived_at)` ).run();
      // After a prolonged outage, do not risk sending again past Resend's
      // idempotency window. Keep only a receipt for manual investigation.
      const expired = db.prepare(`UPDATE account_deletion_surveys SET state='uncertain',payload_json=NULL,lease_until=NULL,
        last_error='idempotency_window_expired' WHERE state IN ('pending','sending')
        AND first_attempt_at IS NOT NULL AND first_attempt_at<=?`).run(at - RETRY_WINDOW_MS).changes;
      if (expired) logger.warn(`[deletion-survey] ${expired} attempts need review; retry window expired`);
      if (!canSend()) return 0;
      const row = db.prepare(`SELECT q.*,a.email,a.first_name,a.created_at FROM account_deletion_surveys q
        JOIN accounts a ON a.id=q.account_id WHERE q.due_at<=? AND q.next_attempt_at<=?
        AND (q.state='pending' OR (q.state='sending' AND q.lease_until<=?))
        ORDER BY q.due_at,q.email_hash LIMIT 1`).get(at, at, at);
      if (!row) return 0;
      const payload = row.payload_json ? JSON.parse(row.payload_json) : buildDeletionSurveyEmail(row, row.archived_at, { from, replyTo });
      const claimed = db.prepare(`UPDATE account_deletion_surveys SET state='sending',lease_until=?,
        attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,?),payload_json=?
        WHERE email_hash=? AND (state='pending' OR (state='sending' AND lease_until<=?))`)
        .run(at + LEASE_MS, at, JSON.stringify(payload), row.email_hash, at).changes;
      if (!claimed) return 0;
      try {
        const providerId = await send(payload, row.idempotency_key);
        if (!providerId) throw new Error("Missing deletion survey receipt");
        db.prepare(`UPDATE account_deletion_surveys SET state='sent',sent_at=?,provider_email_id=?,
          payload_json=NULL,lease_until=NULL,last_error=NULL WHERE email_hash=?`)
          .run(new Date(now()).toISOString(), providerId, row.email_hash);
        logger.info("[deletion-survey] email accepted");
        return 1;
      } catch (error) {
        const status = error?.resendStatus;
        const permanent = Number.isInteger(status) && status >= 400 && status < 500 && status !== 429 && status !== 408;
        const code = error?.code === "email_budget_exhausted" ? "budget" : (status == null ? "network_or_receipt" : String(status));
        const delay = Math.min(15 * 60000, 60000 * 2 ** Math.min(row.attempts, 4));
        db.prepare(`UPDATE account_deletion_surveys SET state=?,next_attempt_at=?,lease_until=NULL,
          payload_json=CASE WHEN ? THEN NULL ELSE payload_json END,last_error=? WHERE email_hash=? AND state='sending'`)
          .run(permanent ? "failed" : "pending", now() + delay, permanent ? 1 : 0, code, row.email_hash);
        // Error bodies can contain email addresses or credentials. Log only codes.
        logger.warn(`[deletion-survey] send failed (${code}); ${permanent ? "stopped" : "retry scheduled"}`);
        return 0;
      }
    } finally { running = false; }
  };
}

export function startDeletionSurveyLoop(db, options, env = process.env) {
  if (!env.RAILWAY_ENVIRONMENT || env.DELETION_SURVEY_EMAILS === "0") return;
  backfillDeletionSurveys(db);
  const dispatch = createDeletionSurveyDispatcher(db, options);
  runtime.enabled = true;
  runtime.startedAt = new Date().toISOString();
  const tick = () => {
    runtime.lastTickAt = new Date().toISOString();
    return dispatch().catch(() => console.warn("[deletion-survey] queue processing failed"));
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  void tick();
  console.log("[deletion-survey] automatic follow-up enabled (24h delay)");
  return () => { clearInterval(timer); runtime.enabled = false; };
}

export function getDeletionSurveyStatus(db, now = Date.now()) {
  const states = Object.fromEntries(db.prepare("SELECT state,COUNT(*) n FROM account_deletion_surveys GROUP BY state").all().map(r => [r.state,r.n]));
  const next = db.prepare("SELECT MIN(MAX(due_at,next_attempt_at)) at FROM account_deletion_surveys WHERE state='pending'").get().at;
  return { ...runtime, delayHours: 24, intervalSeconds: 60, states,
    dueNow: db.prepare("SELECT COUNT(*) n FROM account_deletion_surveys WHERE state='pending' AND due_at<=? AND next_attempt_at<=?").get(now,now).n,
    nextAttemptAt: next == null ? null : new Date(next).toISOString(),
    latestSentAt: db.prepare("SELECT MAX(sent_at) at FROM account_deletion_surveys WHERE state='sent'").get().at };
}
