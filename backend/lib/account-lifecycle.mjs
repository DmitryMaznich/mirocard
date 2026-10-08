import { randomBytes, randomUUID, createHash } from "node:crypto";
import { withTransaction } from "./db.mjs";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  throw { status, message };
};
const iso = (now) => new Date(now).toISOString();
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
  if (mode !== "archive")
    fail(410, "Очистка данных отключена. Используйте перенос в удалённые.");
  const summary = deletionSummary(db, id);
  if (["archived", "deleted", "purged"].includes(summary.status))
    fail(409, "Аккаунт уже удалён.");
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
    deleteAfter: null,
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
      action === "restore" &&
      ["archived", "deleted", "deletion_pending"].includes(a.status)
    ) {
      status = lifecycle?.deletion_previous_status ?? "pending";
      if (!["active", "pending", "blocked"].includes(status))
        status = "pending";
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

export function confirmDeletion(db, id, body, { now = Date.now() } = {}) {
  if (body.mode !== "archive")
    fail(410, "Очистка данных отключена. Используйте перенос в удалённые.");
  const why = reason(body.reason);
  return withTransaction(db, () => {
    const a = account(db, id);
    if (["archived", "deleted", "purged"].includes(a.status))
      fail(409, "Аккаунт уже удалён.");
    if (typeof body.confirmationToken !== "string")
      fail(400, "Требуется подтверждение.");
    const c = db
      .prepare(
        "SELECT * FROM admin_deletion_confirmations WHERE token_hash = ?",
      )
      .get(hash(body.confirmationToken));
    if (
      !c ||
      c.account_id !== id ||
      c.mode !== "archive" ||
      c.expires_at <= now
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
      fail(400, "Введите точный email, слово УДАЛИТЬ и подтвердите перенос.");
    if (fingerprint(deletionSummary(db, id)) !== c.snapshot_hash)
      fail(409, "Данные аккаунта изменились. Подтвердите перенос заново.");
    db.prepare(
      `INSERT INTO account_lifecycle (account_id, deletion_previous_status, scheduled_at, delete_after, reason) VALUES (?, ?, ?, NULL, ?)
      ON CONFLICT(account_id) DO UPDATE SET deletion_previous_status = excluded.deletion_previous_status, scheduled_at = excluded.scheduled_at, delete_after = NULL, reason = excluded.reason`,
    ).run(
      id,
      a.status === "deletion_pending" ? "pending" : a.status,
      iso(now),
      why,
    );
    revokeCredentials(db, a);
    db.prepare(
      "UPDATE accounts SET status = 'archived', updated_at = ? WHERE id = ?",
    ).run(iso(now), id);
    event(
      db,
      id,
      "archive",
      why,
      { previousStatus: a.status, dataRetained: true },
      now,
    );
    return { ok: true, status: "archived", dataRetained: true };
  });
}
// A previous release scheduled irreversible erasure. Cancel every outstanding
// deadline on startup, including overdue ones: this policy retains all data.
export function cancelScheduledErasure(db, now = Date.now()) {
  return withTransaction(db, () => {
    const rows = db
      .prepare("SELECT id FROM accounts WHERE status = 'deletion_pending'")
      .all();
    for (const { id } of rows) {
      db.prepare(
        "UPDATE accounts SET status = 'archived', updated_at = ? WHERE id = ?",
      ).run(iso(now), id);
      event(
        db,
        id,
        "archive",
        "Автоматическая очистка отключена; данные сохранены",
        { dataRetained: true },
        now,
        "policy_migration",
      );
    }
    db.prepare(
      "UPDATE account_lifecycle SET delete_after = NULL WHERE delete_after IS NOT NULL",
    ).run();
    db.prepare(
      "DELETE FROM admin_deletion_confirmations WHERE mode != 'archive'",
    ).run();
    return { archived: rows.length };
  });
}
