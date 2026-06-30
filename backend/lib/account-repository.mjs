import { randomUUID, createHash } from "node:crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }

function safeJson(value, fallback) {
  try { return JSON.parse(value ?? "null") ?? fallback; }
  catch { return fallback; }
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export function extractAndStorePhoto(db, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return dataUrl;
  const [, contentType, data] = match;
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 32);
  db.prepare(
    "INSERT OR IGNORE INTO photos (hash, content_type, data, created_at) VALUES (?, ?, ?, ?)"
  ).run(hash, contentType, data, now());
  return `/api/photos/${hash}`;
}

function processCloseAdultPhotos(db, adults) {
  if (!Array.isArray(adults)) return adults;
  return adults.map((a) => ({
    ...a,
    photo: a.photo ? extractAndStorePhoto(db, a.photo) : null,
  }));
}

export function getPhoto(db, hash) {
  return db.prepare("SELECT content_type, data FROM photos WHERE hash = ?").get(hash) ?? null;
}

export function migratePhotoData(db) {
  const rows = db.prepare(
    "SELECT id, photo, close_adults FROM students WHERE photo IS NOT NULL OR close_adults IS NOT NULL"
  ).all();
  for (const s of rows) {
    let changed = false;
    let newPhoto = s.photo;
    const adults = safeJson(s.close_adults, []);

    if (newPhoto && newPhoto.startsWith("data:")) {
      newPhoto = extractAndStorePhoto(db, newPhoto);
      changed = true;
    }

    const processedAdults = adults.map((a) => {
      if (a.photo && a.photo.startsWith("data:")) {
        changed = true;
        return { ...a, photo: extractAndStorePhoto(db, a.photo) };
      }
      return a;
    });

    if (changed) {
      db.prepare("UPDATE students SET photo = ?, close_adults = ? WHERE id = ?")
        .run(newPhoto, JSON.stringify(processedAdults), s.id);
    }
  }
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

function findAccountByIdAny(db, id) {
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) ?? null;
}

export function createAccount(db, {
  email,
  passwordHash,
  displayName = "",
  firstName = "",
  lastName = "",
  role = "parent",
  referralSource = "other",
  consentPersonalDataAt = "",
}) {
  const id = randomUUID();
  const ts = now();
  const computedDisplay = displayName || [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];

  db.prepare(`
    INSERT INTO accounts
      (id, email, password_hash, display_name, first_name, last_name, role, referral_source,
       consent_personal_data_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, email.toLowerCase().trim(), passwordHash, computedDisplay,
         firstName, lastName, role, referralSource, consentPersonalDataAt, ts, ts);

  db.prepare(`
    INSERT INTO account_settings (account_id, updated_at) VALUES (?, ?)
  `).run(id, ts);

  db.prepare(`
    INSERT OR IGNORE INTO sync_revision (account_id, revision) VALUES (?, 0)
  `).run(id);

  return findAccountByIdAny(db, id);
}

export function findAccountByEmail(db, email) {
  return db.prepare(
    "SELECT * FROM accounts WHERE email = ? AND status = 'active'"
  ).get(email.toLowerCase().trim()) ?? null;
}

export function findAccountByEmailAny(db, email) {
  return db.prepare(
    "SELECT * FROM accounts WHERE email = ?"
  ).get(email.toLowerCase().trim()) ?? null;
}

export function findAccountById(db, id) {
  return db.prepare(
    "SELECT * FROM accounts WHERE id = ? AND status = 'active'"
  ).get(id) ?? null;
}

export function serializeAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    featureFlags: safeJson(row.feature_flags, []),
    createdAt: row.created_at,
  };
}

export function updateAccount(db, id, { firstName, lastName, role }) {
  const current = findAccountByIdAny(db, id);
  const nextFirstName = firstName ?? current.first_name;
  const nextLastName = lastName ?? current.last_name;
  const nextRole = role ?? current.role;
  const displayName = [nextFirstName, nextLastName].filter(Boolean).join(" ") || current.email.split("@")[0];

  db.prepare(`
    UPDATE accounts SET first_name = ?, last_name = ?, role = ?, display_name = ?, updated_at = ? WHERE id = ?
  `).run(nextFirstName, nextLastName, nextRole, displayName, now(), id);
}

export function updateAccountPasswordHash(db, id, passwordHash) {
  db.prepare(`
    UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?
  `).run(passwordHash, now(), id);
}

export function deleteAccount(db, id) {
  const ts = now();
  db.prepare("UPDATE accounts SET status = 'deleted', updated_at = ? WHERE id = ?").run(ts, id);
}

export function activateAccount(db, id) {
  db.prepare(
    "UPDATE accounts SET status = 'active', updated_at = ? WHERE id = ?"
  ).run(now(), id);
}

// ─── Account settings ─────────────────────────────────────────────────────────

export function getAccountSettings(db, accountId) {
  return db.prepare(
    "SELECT * FROM account_settings WHERE account_id = ?"
  ).get(accountId) ?? null;
}

export function updateAccountSettings(db, accountId, patch) {
  const allowed = [
    "ui_language", "card_language", "adult_pin_hash",
    "push_app_updates", "push_topic_updates", "push_reminders",
  ];
  const fields = Object.keys(patch).filter((k) => allowed.includes(k));
  if (fields.length === 0) return;

  const sets = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => patch[f]);
  db.prepare(`UPDATE account_settings SET ${sets}, updated_at = ? WHERE account_id = ?`)
    .run(...values, now(), accountId);
}

// ─── Auth tokens ──────────────────────────────────────────────────────────────

export function storeAuthToken(db, { tokenHash, accountId, expiresAt }) {
  db.prepare(`
    INSERT OR REPLACE INTO auth_tokens (token_hash, account_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, accountId, expiresAt, now());
}

export function findAccountByToken(db, tokenHash) {
  const row = db.prepare(`
    SELECT a.* FROM accounts a
    JOIN auth_tokens t ON t.account_id = a.id
    WHERE t.token_hash = ? AND t.expires_at > ? AND a.status = 'active'
  `).get(tokenHash, now());
  return row ?? null;
}

export function deleteAuthToken(db, tokenHash) {
  db.prepare("DELETE FROM auth_tokens WHERE token_hash = ?").run(tokenHash);
}

// ─── Password reset tokens ───────────────────────────────────────────────────

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function createPasswordResetToken(db, { tokenHash, accountId }) {
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO password_reset_tokens (token_hash, account_id, expires_at)
    VALUES (?, ?, ?)
  `).run(tokenHash, accountId, expiresAt);
}

export function consumePasswordResetToken(db, tokenHash) {
  const row = db.prepare(`
    SELECT account_id FROM password_reset_tokens
    WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL
  `).get(tokenHash, now());

  if (!row) return null;

  db.prepare(
    "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?"
  ).run(now(), tokenHash);

  return row.account_id;
}

// ─── Email verification tokens ────────────────────────────────────────────────

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createEmailVerificationToken(db, { tokenHash, accountId }) {
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO email_verification_tokens (token_hash, account_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, accountId, expiresAt, now());
}

export function consumeEmailVerificationToken(db, tokenHash) {
  const row = db.prepare(`
    SELECT account_id FROM email_verification_tokens
    WHERE token_hash = ? AND expires_at > ?
  `).get(tokenHash, now());

  if (!row) return null;

  db.prepare("DELETE FROM email_verification_tokens WHERE token_hash = ?").run(tokenHash);
  return row.account_id;
}

export function deleteEmailVerificationTokensForAccount(db, accountId) {
  db.prepare("DELETE FROM email_verification_tokens WHERE account_id = ?").run(accountId);
}

// ─── Account KV ───────────────────────────────────────────────────────────────

export function upsertAccountKv(db, accountId, key, value) {
  db.prepare(`
    INSERT INTO account_kv (account_id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(accountId, key, JSON.stringify(value), Date.now());
}

export function getAllAccountKv(db, accountId) {
  return db.prepare(
    "SELECT key, value FROM account_kv WHERE account_id = ? ORDER BY updated_at ASC"
  ).all(accountId).map((r) => ({ key: r.key, value: JSON.parse(r.value) }));
}

export function getAccountKvByPrefixes(db, accountId, prefixes) {
  if (!prefixes.length) return [];
  const conditions = prefixes.map(() => "key LIKE ?").join(" OR ");
  return db.prepare(
    `SELECT key, value, updated_at FROM account_kv WHERE account_id = ? AND (${conditions}) ORDER BY updated_at ASC`
  ).all(accountId, ...prefixes.map((p) => p + "%"))
    .map((r) => ({ key: r.key, value: JSON.parse(r.value), updatedAt: r.updated_at }));
}

// ─── Sync revision ────────────────────────────────────────────────────────────

export function getRevision(db, accountId) {
  const row = db.prepare(
    "SELECT revision FROM sync_revision WHERE account_id = ?"
  ).get(accountId);
  return row?.revision ?? 0;
}

export function incrementRevision(db, accountId) {
  db.prepare(`
    INSERT INTO sync_revision (account_id, revision) VALUES (?, 1)
    ON CONFLICT(account_id) DO UPDATE SET revision = revision + 1
  `).run(accountId);
  return getRevision(db, accountId);
}

// ─── Students ─────────────────────────────────────────────────────────────────

export function upsertStudent(db, accountId, {
  id,
  name,
  comment = "",
  primaryLanguage = null,
  sex = null,
  photo = null,
  rewardVideos = [],
  closeAdults = [],
  createdAt = null,
  updatedAt = null,
}) {
  const serverNow = now();
  const created = createdAt || serverNow;
  const updated = updatedAt || serverNow;
  const photoRef = photo ? extractAndStorePhoto(db, photo) : null;
  const processedAdults = processCloseAdultPhotos(db, Array.isArray(closeAdults) ? closeAdults : []);
  db.prepare(`
    INSERT INTO students (id, account_id, name, comment, primary_language, sex, photo, reward_videos, close_adults, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      comment = excluded.comment,
      primary_language = excluded.primary_language,
      sex = excluded.sex,
      photo = excluded.photo,
      reward_videos = excluded.reward_videos,
      close_adults = excluded.close_adults,
      updated_at = excluded.updated_at
  `).run(
    id,
    accountId,
    name,
    comment,
    primaryLanguage,
    sex ?? null,
    photoRef,
    JSON.stringify(Array.isArray(rewardVideos) ? rewardVideos : []),
    JSON.stringify(processedAdults),
    created,
    updated,
  );
}

export function getStudents(db, accountId) {
  return db.prepare(
    "SELECT * FROM students WHERE account_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
  ).all(accountId);
}

export function softDeleteStudent(db, studentId) {
  db.prepare(
    "UPDATE students SET deleted_at = ?, updated_at = ? WHERE id = ?"
  ).run(now(), now(), studentId);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function appendSession(db, accountId, session) {
  const mistakesRaw   = session.mistakes;
  const cardEventsRaw = session.cardEvents ?? session.card_events;
  db.prepare(`
    INSERT OR IGNORE INTO sessions
      (id, account_id, student_id, topic_id, topic_version, mode,
       started_at, completed_at, correct_count, incorrect_count,
       percent_correct, mistakes, card_events, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    accountId,
    session.studentId      ?? session.student_id,
    session.topicId        ?? session.topic_id,
    session.topicVersion   ?? session.topic_version,
    session.mode,
    session.startedAt      ?? session.started_at,
    session.completedAt    ?? session.completed_at,
    session.correctCount   ?? session.correct_count   ?? null,
    session.incorrectCount ?? session.incorrect_count ?? null,
    session.percentCorrect ?? session.percent_correct ?? null,
    Array.isArray(mistakesRaw)   ? JSON.stringify(mistakesRaw)   : (mistakesRaw   ?? "[]"),
    Array.isArray(cardEventsRaw) ? JSON.stringify(cardEventsRaw) : (cardEventsRaw ?? "[]"),
    now()
  );
}

export function getSessions(db, accountId, { studentId = null, limit = 50, before = null } = {}) {
  let sql = "SELECT * FROM sessions WHERE account_id = ?";
  const params = [accountId];

  if (studentId) { sql += " AND student_id = ?"; params.push(studentId); }
  if (before)    { sql += " AND completed_at < ?"; params.push(before); }
  sql += " ORDER BY completed_at DESC LIMIT ?";
  params.push(limit);

  return db.prepare(sql).all(...params);
}

export function getAllSessions(db, accountId) {
  return db.prepare(
    "SELECT * FROM sessions WHERE account_id = ? ORDER BY completed_at DESC"
  ).all(accountId);
}

// ─── Account topics ───────────────────────────────────────────────────────────

export function upsertAccountTopic(db, accountId, { id, topicId, topicVersion, source = "download", licenseToken = null }) {
  const ts = now();
  db.prepare(`
    INSERT INTO account_topics (id, account_id, topic_id, topic_version, acquired_at, source, license_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      topic_version = excluded.topic_version,
      source = excluded.source,
      license_token = excluded.license_token
  `).run(id, accountId, topicId, topicVersion, ts, source, licenseToken);
}

export function getAccountTopics(db, accountId) {
  return db.prepare(
    "SELECT * FROM account_topics WHERE account_id = ? AND deleted_at IS NULL"
  ).all(accountId);
}

export function softDeleteAccountTopic(db, id) {
  db.prepare(
    "UPDATE account_topics SET deleted_at = ? WHERE id = ?"
  ).run(now(), id);
}

export function getAccountTopicByTopicId(db, accountId, topicId) {
  return db.prepare(
    "SELECT * FROM account_topics WHERE account_id = ? AND topic_id = ? AND deleted_at IS NULL ORDER BY acquired_at DESC LIMIT 1"
  ).get(accountId, topicId) ?? null;
}

export function claimAccountTopic(db, accountId, { topicId, topicVersion, source }) {
  const existing = getAccountTopicByTopicId(db, accountId, topicId);
  if (existing) return existing;
  const ts = now();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO account_topics (id, account_id, topic_id, topic_version, acquired_at, source) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, accountId, topicId, topicVersion, ts, source);
  return getAccountTopicByTopicId(db, accountId, topicId);
}

export function grantAccountTopic(db, accountId, { topicId, topicVersion }) {
  const existing = getAccountTopicByTopicId(db, accountId, topicId);
  if (existing) {
    db.prepare("UPDATE account_topics SET source = 'grant', topic_version = ? WHERE id = ?")
      .run(topicVersion, existing.id);
  } else {
    db.prepare(
      "INSERT INTO account_topics (id, account_id, topic_id, topic_version, acquired_at, source) VALUES (?, ?, ?, ?, ?, 'grant')"
    ).run(randomUUID(), accountId, topicId, topicVersion, now());
  }
}

export function setAccountFeatureFlags(db, accountId, flags) {
  db.prepare("UPDATE accounts SET feature_flags = ? WHERE id = ?")
    .run(JSON.stringify(flags), accountId);
}

// ─── Student topic links ──────────────────────────────────────────────────────

export function upsertStudentTopicLink(db, accountId, {
  id, studentId, topicId,
  selectionMode = "auto", selectedConceptIds = [], repsPerConcept = 1,
  params = {}, videoRewardEnabled = true, rewardThreshold = 90,
}) {
  const ts = now();
  db.prepare(`
    INSERT INTO student_topic_links
      (id, account_id, student_id, topic_id, selection_mode, selected_concept_ids, reps_per_concept,
       params, video_reward_enabled, reward_threshold, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      selection_mode = excluded.selection_mode,
      selected_concept_ids = excluded.selected_concept_ids,
      reps_per_concept = excluded.reps_per_concept,
      params = excluded.params,
      video_reward_enabled = excluded.video_reward_enabled,
      reward_threshold = excluded.reward_threshold,
      updated_at = excluded.updated_at
  `).run(
    id, accountId, studentId, topicId,
    selectionMode, JSON.stringify(selectedConceptIds), repsPerConcept,
    JSON.stringify(params), videoRewardEnabled ? 1 : 0, rewardThreshold, ts, ts
  );
}

export function getStudentTopicLinks(db, accountId) {
  return db.prepare(
    "SELECT * FROM student_topic_links WHERE account_id = ? AND deleted_at IS NULL"
  ).all(accountId);
}

// ─── Concept progress ─────────────────────────────────────────────────────────

export function upsertConceptProgress(db, { studentId, topicId, conceptId, level, lastSeenAt = null }) {
  db.prepare(`
    INSERT INTO concept_progress (student_id, topic_id, concept_id, level, last_seen_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, topic_id, concept_id) DO UPDATE SET
      level = excluded.level,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `).run(studentId, topicId, conceptId, level, lastSeenAt, now());
}

export function getConceptProgress(db, studentId, topicId) {
  return db.prepare(
    "SELECT * FROM concept_progress WHERE student_id = ? AND topic_id = ?"
  ).all(studentId, topicId);
}

export function getAllConceptProgress(db, accountId) {
  return db.prepare(`
    SELECT cp.* FROM concept_progress cp
    JOIN students s ON s.id = cp.student_id
    WHERE s.account_id = ?
  `).all(accountId);
}

// ─── Push subscriptions ───────────────────────────────────────────────────────

export function upsertPushSubscription(db, accountId, { id, endpoint, keys }) {
  db.prepare(`
    INSERT OR REPLACE INTO push_subscriptions (id, account_id, endpoint, keys, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, accountId, endpoint, JSON.stringify(keys), now());
}

export function getPushSubscriptions(db, accountId) {
  return db.prepare(
    "SELECT * FROM push_subscriptions WHERE account_id = ?"
  ).all(accountId).map((r) => ({ ...r, keys: safeJson(r.keys, {}) }));
}

export function getAllPushSubscriptions(db) {
  return db.prepare("SELECT * FROM push_subscriptions").all()
    .map((r) => ({ ...r, keys: safeJson(r.keys, {}) }));
}

export function removePushSubscription(db, id) {
  db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(id);
}
