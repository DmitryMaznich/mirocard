import { randomBytes, randomUUID, createHash } from "node:crypto";
import { withTransaction } from "./db.mjs";
import { collectReferencedPhotoHashes } from "./photo-gc.mjs";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  throw { status, message };
};
const iso = (now) => new Date(now).toISOString();
const DAY = 86400000;
function account(db, id) {
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
  if (!row) fail(404, "Аккаунт не найден.");
  return row;
}
function reason(value) {
  if (
    typeof value !== "string" ||
    value.trim().length < 3 ||
    value.trim().length > 500
  )
    fail(400, "Укажите причину: от 3 до 500 символов.");
  return value.trim();
}
function event(db, id, action, why, details, now, actor = "admin_token") {
  db.prepare(
    "INSERT INTO admin_account_events VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    randomUUID(),
    id,
    action,
    actor,
    why,
    JSON.stringify(details),
    iso(now),
  );
}
function revokeCredentials(db, a) {
  for (const table of [
    "auth_tokens",
    "password_reset_tokens",
    "email_verification_tokens",
    "push_subscriptions",
    "admin_deletion_confirmations",
  ])
    db.prepare(`DELETE FROM ${table} WHERE account_id = ?`).run(a.id);
  const subjects = db
    .prepare("SELECT subject FROM account_identities WHERE account_id = ?")
    .all(a.id)
    .map((row) => row.subject);
  for (const code of db
    .prepare("SELECT code_hash, payload FROM one_time_codes")
    .all()) {
    let payload;
    try {
      payload = JSON.parse(code.payload);
    } catch {
      continue;
    }
    if (
      payload.accountId === a.id ||
      payload.email?.toLowerCase() === a.email.toLowerCase() ||
      subjects.includes(payload.subject)
    )
      db.prepare("DELETE FROM one_time_codes WHERE code_hash = ?").run(
        code.code_hash,
      );
  }
}
export function deletionSummary(db, id) {
  const a = account(db, id);
  if (a.status === "purged") fail(409, "Личные данные уже удалены.");
  const count = (table) =>
    db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`)
      .get(id).n;
  return {
    accountId: id,
    email: a.email,
    status: a.status,
    updatedAt: a.updated_at,
    hasUnlimitedAccess: (() => {
      try {
        const flags = JSON.parse(a.feature_flags || "[]");
        return Array.isArray(flags) && flags.includes("all_access");
      } catch {
        return false;
      }
    })(),
    students: count("students"),
    sessions: count("sessions"),
    audio: count("audio_overrides"),
    materials: count("account_kv"),
    assignments: count("account_topic_assignments"),
    orders: count("orders"),
    paidOrders: db
      .prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE account_id = ? AND status = 'completed'",
      )
      .get(id).n,
    activeAccess: db
      .prepare(
        "SELECT COUNT(*) AS n FROM entitlements WHERE account_id = ? AND status = 'active' AND ends_at > ?",
      )
      .get(id, iso(Date.now())).n,
    lifecycle:
      db
        .prepare("SELECT * FROM account_lifecycle WHERE account_id = ?")
        .get(id) ?? null,
  };
}
function fingerprint(summary) {
  // Credential expiry/heartbeat must not invalidate the preview. Changes to
  // identity, lifecycle or the amount of data to remove must be reviewed again.
  return hash(JSON.stringify(summary));
}
export function prepareDeletion(db, id, mode, now = Date.now()) {
  if (!["immediate", "scheduled"].includes(mode))
    fail(400, "Неизвестный режим удаления.");
  const summary = deletionSummary(db, id);
  if (mode === "scheduled" && summary.status === "deletion_pending")
    fail(409, "Удаление уже запланировано.");
  const token = randomBytes(32).toString("base64url");
  db.prepare(
    "DELETE FROM admin_deletion_confirmations WHERE expires_at < ?",
  ).run(now);
  db.prepare(
    "INSERT INTO admin_deletion_confirmations VALUES (?, ?, ?, ?, ?)",
  ).run(hash(token), id, mode, fingerprint(summary), now + 5 * 60000);
  return {
    ...summary,
    mode,
    confirmationToken: token,
    expiresAt: iso(now + 5 * 60000),
    deleteAfter: mode === "scheduled" ? iso(now + 7 * DAY) : null,
  };
}
export function blockAccount(db, id, why, now = Date.now()) {
  why = reason(why);
  return withTransaction(db, () => {
    const a = account(db, id);
    if (!["active", "pending"].includes(a.status))
      fail(409, "Заблокировать можно активный или неподтверждённый аккаунт.");
    db.prepare(
      `INSERT INTO account_lifecycle (account_id, blocked_previous_status, blocked_at, reason) VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET blocked_previous_status = excluded.blocked_previous_status, blocked_at = excluded.blocked_at, reason = excluded.reason`,
    ).run(id, a.status, iso(now), why);
    revokeCredentials(db, a);
    db.prepare(
      "UPDATE accounts SET status = 'blocked', updated_at = ? WHERE id = ?",
    ).run(iso(now), id);
    event(db, id, "block", why, { previousStatus: a.status }, now);
    return { ok: true, status: "blocked" };
  });
}
export function restoreAccount(db, id, action, why, now = Date.now()) {
  why = reason(why);
  return withTransaction(db, () => {
    const a = account(db, id),
      lifecycle = db
        .prepare("SELECT * FROM account_lifecycle WHERE account_id = ?")
        .get(id);
    let status;
    if (action === "unblock" && a.status === "blocked") {
      status = lifecycle?.blocked_previous_status;
      if (!["active", "pending"].includes(status))
        fail(409, "Не удалось определить исходный статус аккаунта.");
      db.prepare(
        "UPDATE account_lifecycle SET blocked_at = NULL, blocked_previous_status = NULL WHERE account_id = ?",
      ).run(id);
    } else if (
      action === "cancel-deletion" &&
      a.status === "deletion_pending"
    ) {
      if (!lifecycle?.delete_after || Date.parse(lifecycle.delete_after) <= now)
        fail(409, "Срок отмены удаления истёк.");
      status = lifecycle.deletion_previous_status;
      if (!["active", "pending", "blocked", "deleted"].includes(status))
        fail(409, "Не удалось определить исходный статус аккаунта.");
      db.prepare(
        "UPDATE account_lifecycle SET scheduled_at = NULL, delete_after = NULL, deletion_previous_status = NULL WHERE account_id = ?",
      ).run(id);
    } else fail(409, "Это действие недоступно для текущего статуса аккаунта.");
    revokeCredentials(db, a); // Restoring never brings old login tokens back.
    db.prepare(
      "UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?",
    ).run(status, iso(now), id);
    event(db, id, action, why, { status }, now);
    return { ok: true, status };
  });
}
function purge(db, a, why, now, beforePurge, actor = "admin_token") {
  const summary = deletionSummary(db, a.id),
    photos = new Set();
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  // Only consider the deleted account's photos; never run global orphan cleanup.
  for (const { name } of tables) {
    if (!/^[a-z_]+$/.test(name)) continue;
    if (
      !db
        .prepare(`PRAGMA table_info(${name})`)
        .all()
        .some((c) => c.name === "account_id")
    )
      continue;
    for (const row of db
      .prepare(`SELECT * FROM ${name} WHERE account_id = ?`)
      .all(a.id)) {
      for (const value of Object.values(row))
        if (typeof value === "string")
          for (const match of value.matchAll(/\/api\/photos\/([a-f0-9]{32})/g))
            photos.add(match[1]);
    }
  }
  beforePurge?.(a.email);
  revokeCredentials(db, a);
  db.prepare(
    "DELETE FROM concept_progress WHERE student_id IN (SELECT id FROM students WHERE account_id = ?)",
  ).run(a.id);
  db.prepare(
    "DELETE FROM analysis_cache WHERE student_id IN (SELECT id FROM students WHERE account_id = ?)",
  ).run(a.id);
  for (const table of [
    "sessions",
    "student_topic_links",
    "students",
    "account_topics",
    "account_topic_assignments",
    "account_settings",
    "account_kv",
    "audio_overrides",
    "account_identities",
    "marketing_consent_events",
    "sync_revision",
  ])
    db.prepare(`DELETE FROM ${table} WHERE account_id = ?`).run(a.id);
  db.prepare("DELETE FROM materials_leads WHERE lower(email) = lower(?)").run(
    a.email,
  );
  db.prepare(
    "UPDATE entitlements SET status = 'revoked', updated_at = ? WHERE account_id = ?",
  ).run(iso(now), a.id);
  db.prepare(
    "UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE account_id = ?",
  ).run(iso(now), a.id);
  db.prepare(
    "UPDATE orders SET status = 'abandoned', updated_at = ? WHERE account_id = ? AND status = 'pending'",
  ).run(iso(now), a.id);
  // Keep accounting IDs/status/amounts, but discard provider payloads that can
  // contain names and emails. Preserve event idempotency for late webhooks.
  db.prepare(
    "UPDATE payment_events SET payload_json = '{}' WHERE account_id = ?",
  ).run(a.id);
  db.prepare(
    `UPDATE accounts SET email = ?, password_hash = '', display_name = '', first_name = '', last_name = '',
    role = '', feature_flags = '[]', referral_source = '', consent_personal_data_at = '', marketing_opt_in = 0,
    marketing_prompt_answered_at = NULL, last_seen_at = NULL, open_count = 0, status = 'purged', updated_at = ? WHERE id = ?`,
  ).run(`removed-${a.id}@deleted.invalid`, iso(now), a.id);
  db.prepare(
    `INSERT INTO account_lifecycle (account_id, purged_at, reason) VALUES (?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET purged_at = excluded.purged_at, reason = excluded.reason, delete_after = NULL`,
  ).run(a.id, iso(now), why);
  const referenced = collectReferencedPhotoHashes(db);
  let photosDeleted = 0;
  for (const photo of photos)
    if (!referenced.has(photo))
      photosDeleted += db
        .prepare("DELETE FROM photos WHERE hash = ?")
        .run(photo).changes;
  const counts = {
    students: summary.students,
    sessions: summary.sessions,
    audio: summary.audio,
    materials: summary.materials,
    ordersRetained: summary.orders,
    photosDeleted,
  };
  event(db, a.id, "purge", why, counts, now, actor);
  return { ok: true, status: "purged", deleted: counts };
}
export function confirmDeletion(
  db,
  id,
  body,
  { now = Date.now(), beforePurge } = {},
) {
  const why = reason(body.reason);
  return withTransaction(db, () => {
    const a = account(db, id);
    if (a.status === "purged") fail(409, "Личные данные уже удалены.");
    if (typeof body.confirmationToken !== "string")
      fail(400, "Сначала откройте предварительный просмотр удаления.");
    const confirmation = db
      .prepare(
        "SELECT * FROM admin_deletion_confirmations WHERE token_hash = ?",
      )
      .get(hash(body.confirmationToken));
    if (
      !confirmation ||
      confirmation.account_id !== id ||
      confirmation.mode !== body.mode ||
      confirmation.expires_at <= now
    )
      fail(
        409,
        "Подтверждение истекло или уже использовано. Откройте удаление заново.",
      );
    if (
      body.confirmEmail !== a.email ||
      body.confirmWord !== "УДАЛИТЬ" ||
      body.acknowledgeData !== true ||
      body.acknowledgeRetention !== true
    )
      fail(
        400,
        "Введите точный email, слово УДАЛИТЬ и подтвердите последствия удаления.",
      );
    if (fingerprint(deletionSummary(db, id)) !== confirmation.snapshot_hash)
      fail(
        409,
        "Данные аккаунта изменились. Проверьте состав данных и подтвердите удаление заново.",
      );
    db.prepare(
      "DELETE FROM admin_deletion_confirmations WHERE token_hash = ?",
    ).run(hash(body.confirmationToken));
    if (body.mode === "immediate") return purge(db, a, why, now, beforePurge);
    if (body.mode !== "scheduled" || a.status === "deletion_pending")
      fail(409, "Удаление уже запланировано или режим недопустим.");
    revokeCredentials(db, a);
    const deadline = iso(now + 7 * DAY);
    db.prepare(
      `INSERT INTO account_lifecycle (account_id, deletion_previous_status, scheduled_at, delete_after, reason) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET deletion_previous_status = excluded.deletion_previous_status, scheduled_at = excluded.scheduled_at, delete_after = excluded.delete_after, reason = excluded.reason`,
    ).run(id, a.status, iso(now), deadline, why);
    db.prepare(
      "UPDATE accounts SET status = 'deletion_pending', updated_at = ? WHERE id = ?",
    ).run(iso(now), id);
    event(db, id, "schedule-deletion", why, { deleteAfter: deadline }, now);
    return { ok: true, status: "deletion_pending", deleteAfter: deadline };
  });
}
export function sweepScheduledDeletions(
  db,
  { now = Date.now(), beforePurge, log = console } = {},
) {
  const due = db
    .prepare(
      "SELECT a.id FROM accounts a JOIN account_lifecycle l ON l.account_id = a.id WHERE a.status = 'deletion_pending' AND l.delete_after <= ?",
    )
    .all(iso(now));
  let deleted = 0;
  for (const { id } of due) {
    try {
      withTransaction(db, () => {
        const a = account(db, id),
          lifecycle = db
            .prepare(
              "SELECT reason FROM account_lifecycle WHERE account_id = ?",
            )
            .get(id);
        purge(db, a, lifecycle.reason, now, beforePurge, "deletion_scheduler");
      });
      deleted++;
    } catch (err) {
      log.error(
        "[account-deletion] purge failed for account",
        id,
        err.message ?? "transaction rolled back",
      );
    }
  }
  return { deleted, failed: due.length - deleted };
}
export function startAccountDeletionLoop(db, options = {}) {
  sweepScheduledDeletions(db, options);
  const timer = setInterval(() => sweepScheduledDeletions(db, options), 60000);
  timer.unref?.();
  return timer;
}
