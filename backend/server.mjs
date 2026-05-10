import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  DATA_DIR, PORT, DEPLOY_TOKEN, DEPLOY_FRONTEND_DIR,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBJECT,
} from "./lib/config.mjs";
import { getDb } from "./lib/db.mjs";
import {
  createAccount, findAccountByEmail, findAccountById,
  updateAccount, updateAccountPasswordHash, deleteAccount,
  storeAuthToken, findAccountByToken, deleteAuthToken,
  getAccountSettings, updateAccountSettings,
  getRevision,
  createPasswordResetToken, consumePasswordResetToken,
  upsertStudent, getStudents, softDeleteStudent,
  appendSession, getSessions,
  upsertAccountTopic, getAccountTopics, softDeleteAccountTopic,
  upsertStudentTopicLink, getStudentTopicLinks,
  upsertConceptProgress, getAllConceptProgress,
  upsertPushSubscription, getAllPushSubscriptions, removePushSubscription,
} from "./lib/account-repository.mjs";
import {
  createPasswordHash, verifyPasswordHash,
} from "./lib/security.mjs";
import { writeJson, writeNoContent, readJsonBody, getBearerToken } from "./lib/http.mjs";
import { sendPasswordResetEmail } from "./lib/mailer.mjs";
import { buildBootstrap } from "./lib/snapshot-builder.mjs";
import { processSync } from "./lib/sync-processor.mjs";
import { configureWebPush, sendPushNotification } from "./lib/push.mjs";

// ─── Init ──────────────────────────────────────────────────────────────────────

const db = getDb();

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  configureWebPush(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBJECT);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function makeToken(accountId) {
  const raw = randomUUID();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  storeAuthToken(db, { tokenHash, accountId, expiresAt });
  return raw;
}

function requireAuth(req) {
  const raw = getBearerToken(req);
  if (!raw) throw { status: 401, message: "Missing token" };
  const account = findAccountByToken(db, hashToken(raw));
  if (!account) throw { status: 401, message: "Invalid or expired token" };
  return account;
}

function requireDeployToken(req) {
  const token = getBearerToken(req);
  if (token !== DEPLOY_TOKEN) throw { status: 403, message: "Invalid deploy token" };
}

function sanitizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function safeJson(value, fallback) {
  try { return JSON.parse(value ?? "null") ?? fallback; } catch { return fallback; }
}

function normalizeApiPath(pathname) {
  if (pathname === "/api") return "/";
  return pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
}

function getLegacyPasswordHashesPath() {
  return process.env.MIROCARD_LEGACY_PASSWORD_HASHES_PATH ||
    path.join(DATA_DIR, "legacy-password-hashes.json");
}

function readLegacyPasswordHashes() {
  const legacyPath = getLegacyPasswordHashesPath();
  if (!existsSync(legacyPath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(legacyPath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getLegacyPasswordHashes(email) {
  const hashes = readLegacyPasswordHashes()[sanitizeEmail(email)];
  return Array.isArray(hashes) ? hashes.filter((hash) => typeof hash === "string") : [];
}

function clearLegacyPasswordHashes(email) {
  const legacyPath = getLegacyPasswordHashesPath();
  if (!existsSync(legacyPath)) return;
  const legacy = readLegacyPasswordHashes();
  const key = sanitizeEmail(email);
  if (!(key in legacy)) return;
  delete legacy[key];
  try {
    writeFileSync(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`);
  } catch (err) {
    console.error("Failed to clear legacy password hashes:", err);
  }
}

function serializeStudent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    comment: row.comment,
    primaryLanguage: row.primary_language,
    rewardVideos: safeJson(row.reward_videos, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  };
}

// ─── Auth handlers ─────────────────────────────────────────────────────────────

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);
  const password = String(body?.password || "");
  const displayName = String(body?.displayName || "").trim();

  if (!email || !email.includes("@")) return writeJson(res, 400, { error: "Invalid email" });
  if (password.length < 8) return writeJson(res, 400, { error: "Password must be at least 8 characters" });
  if (findAccountByEmail(db, email)) return writeJson(res, 409, { error: "Email already registered" });

  const account = createAccount(db, {
    email,
    passwordHash: createPasswordHash(password),
    displayName: displayName || email.split("@")[0],
  });
  const token = makeToken(account.id);
  const settings = getAccountSettings(db, account.id);

  writeJson(res, 201, {
    account: { id: account.id, email: account.email, displayName: account.display_name },
    settings,
    token,
  });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);
  const password = String(body?.password || "");

  const account = findAccountByEmail(db, email);
  let passwordMatches = account && verifyPasswordHash(password, account.password_hash);
  let matchedLegacyPassword = false;

  if (account && !passwordMatches) {
    matchedLegacyPassword = getLegacyPasswordHashes(email).some((hash) =>
      verifyPasswordHash(password, hash)
    );
    if (matchedLegacyPassword) {
      updateAccountPasswordHash(db, account.id, createPasswordHash(password));
      passwordMatches = true;
    }
  }

  if (!account || !passwordMatches) {
    return writeJson(res, 401, { error: "Invalid email or password" });
  }

  clearLegacyPasswordHashes(email);

  const token = makeToken(account.id);
  const settings = getAccountSettings(db, account.id);

  writeJson(res, 200, {
    account: { id: account.id, email: account.email, displayName: account.display_name },
    settings,
    token,
  });
}

async function handleLogout(req, res) {
  const raw = getBearerToken(req);
  if (raw) deleteAuthToken(db, hashToken(raw));
  writeNoContent(res);
}

async function handleForgotPassword(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);

  const account = email ? findAccountByEmail(db, email) : null;
  if (account) {
    const rawToken = randomUUID();
    createPasswordResetToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
    await sendPasswordResetEmail(account.email, rawToken).catch(console.error);
  }

  writeJson(res, 200, { ok: true });
}

async function handleResetPassword(req, res) {
  const body = await readJsonBody(req);
  const rawToken = String(body?.token || "");
  const newPassword = String(body?.newPassword || "");

  if (newPassword.length < 8) return writeJson(res, 400, { error: "Password must be at least 8 characters" });

  const accountId = consumePasswordResetToken(db, hashToken(rawToken));
  if (!accountId) return writeJson(res, 400, { error: "Invalid or expired reset token" });

  updateAccountPasswordHash(db, accountId, createPasswordHash(newPassword));

  const account = findAccountById(db, accountId);
  clearLegacyPasswordHashes(account.email);
  const token = makeToken(account.id);
  const settings = getAccountSettings(db, account.id);

  writeJson(res, 200, {
    account: { id: account.id, email: account.email, displayName: account.display_name },
    settings,
    token,
  });
}

// ─── Account handlers ──────────────────────────────────────────────────────────

async function handlePatchAccount(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const displayName = String(body?.displayName ?? "").trim();
  if (displayName) updateAccount(db, account.id, { displayName });
  const updated = findAccountById(db, account.id);
  writeJson(res, 200, { id: updated.id, email: updated.email, displayName: updated.display_name });
}

async function handleChangePassword(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  if (!verifyPasswordHash(currentPassword, account.password_hash)) {
    return writeJson(res, 400, { error: "Current password is incorrect" });
  }
  if (newPassword.length < 8) {
    return writeJson(res, 400, { error: "New password must be at least 8 characters" });
  }

  updateAccountPasswordHash(db, account.id, createPasswordHash(newPassword));
  clearLegacyPasswordHashes(account.email);
  writeJson(res, 200, { ok: true });
}

async function handleDeleteAccount(req, res) {
  const account = requireAuth(req);
  deleteAccount(db, account.id);
  const raw = getBearerToken(req);
  if (raw) deleteAuthToken(db, hashToken(raw));
  writeNoContent(res);
}

async function handlePatchSettings(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const allowed = {
    uiLanguage: "ui_language", cardLanguage: "card_language",
    adultPinHash: "adult_pin_hash",
    pushAppUpdates: "push_app_updates",
    pushTopicUpdates: "push_topic_updates",
    pushReminders: "push_reminders",
  };
  const patch = {};
  for (const [key, col] of Object.entries(allowed)) {
    if (key in body) patch[col] = body[key];
  }
  updateAccountSettings(db, account.id, patch);
  writeJson(res, 200, getAccountSettings(db, account.id));
}

async function handleBootstrap(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const since = Number(url.searchParams.get("since") || 0);
  writeJson(res, 200, buildBootstrap(db, account.id, since));
}

// ─── Student handlers ──────────────────────────────────────────────────────────

async function handleGetStudents(req, res) {
  const account = requireAuth(req);
  writeJson(res, 200, getStudents(db, account.id).map(serializeStudent));
}

async function handleUpsertStudent(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const id = body?.id || randomUUID();

  if (!body?.name?.trim()) return writeJson(res, 400, { error: "name is required" });

  upsertStudent(db, account.id, {
    id,
    name: String(body.name).trim(),
    comment: String(body.comment ?? ""),
    primaryLanguage: body.primaryLanguage ?? null,
    rewardVideos: Array.isArray(body.rewardVideos)
      ? body.rewardVideos
          .map((item) => {
            if (!item) return null;
            if (typeof item === "object" && item.url) return item;
            const s = String(item).trim();
            return s || null;
          })
          .filter(Boolean)
      : [],
  });

  writeJson(res, 200, serializeStudent(getStudents(db, account.id).find((s) => s.id === id)));
}

async function handleDeleteStudent(req, res) {
  requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const studentId = url.pathname.split("/").at(-1);
  softDeleteStudent(db, studentId);
  writeNoContent(res);
}

// ─── Session handlers ──────────────────────────────────────────────────────────

async function handleGetSessions(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const studentId = url.searchParams.get("studentId");
  const limit = Math.min(200, Number(url.searchParams.get("limit") || 50));
  const before = url.searchParams.get("before") || null;
  writeJson(res, 200, getSessions(db, account.id, { studentId, limit, before }));
}

async function handleAppendSession(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.id || !body?.studentId || !body?.topicId) {
    return writeJson(res, 400, { error: "id, studentId, topicId required" });
  }
  appendSession(db, account.id, body);
  writeJson(res, 201, { ok: true });
}

// ─── Topic handlers ───────────────────────────────────────────────────────────

async function handleGetTopics(req, res) {
  const account = requireAuth(req);
  writeJson(res, 200, getAccountTopics(db, account.id));
}

async function handleAcquireTopic(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.topicId || !body?.topicVersion) {
    return writeJson(res, 400, { error: "topicId, topicVersion required" });
  }
  upsertAccountTopic(db, account.id, {
    id: randomUUID(),
    topicId: body.topicId,
    topicVersion: body.topicVersion,
    source: body.source ?? "download",
  });
  writeJson(res, 200, { ok: true });
}

async function handleDeleteTopic(req, res) {
  requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const id = url.pathname.split("/").at(-1);
  softDeleteAccountTopic(db, id);
  writeNoContent(res);
}

// ─── Student topic links + concept progress ────────────────────────────────────

async function handleGetStudentTopicLinks(req, res) {
  const account = requireAuth(req);
  const links = getStudentTopicLinks(db, account.id).map((l) => ({
    id: l.id, studentId: l.student_id, topicId: l.topic_id,
    selectionMode: l.selection_mode,
    selectedConceptIds: safeJson(l.selected_concept_ids, []),
    repsPerConcept: l.reps_per_concept,
  }));
  writeJson(res, 200, links);
}

async function handleUpsertStudentTopicLink(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  upsertStudentTopicLink(db, account.id, {
    id: body.id || randomUUID(),
    studentId: body.studentId,
    topicId: body.topicId,
    selectionMode: body.selectionMode ?? "auto",
    selectedConceptIds: body.selectedConceptIds ?? [],
    repsPerConcept: body.repsPerConcept ?? 1,
  });
  writeJson(res, 200, { ok: true });
}

async function handleUpsertConceptProgress(req, res) {
  requireAuth(req);
  const body = await readJsonBody(req);
  upsertConceptProgress(db, body);
  writeJson(res, 200, { ok: true });
}

// ─── Sync handler ──────────────────────────────────────────────────────────────

async function handleSync(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const operations = Array.isArray(body?.operations) ? body.operations : [];
  processSync(db, account.id, operations);
  const revision = getRevision(db, account.id);
  writeJson(res, 200, { accepted: true, serverRevision: revision });
}

// ─── Admin + push handlers ────────────────────────────────────────────────────

async function handleNotifyAppUpdate(req, res) {
  requireDeployToken(req);
  const body = await readJsonBody(req);
  const version = String(body?.version || "");
  const changelog = body?.changelog ?? {};

  const subs = getAllPushSubscriptions(db);
  let sent = 0;
  for (const sub of subs) {
    try {
      await sendPushNotification(sub, {
        title: `Mirocard обновился до ${version}`,
        body: changelog.ru || changelog.en || "Новая версия доступна",
        data: { type: "app_update", version },
      });
      sent++;
    } catch (err) {
      if (err?.statusCode === 410) removePushSubscription(db, sub.id);
    }
  }
  writeJson(res, 200, { ok: true, sent });
}

async function handleNotifyTopicUpdates(req, res) {
  requireDeployToken(req);
  const body = await readJsonBody(req);
  const updatedTopics = Array.isArray(body?.updatedTopics) ? body.updatedTopics : [];

  let sent = 0;
  for (const { id: topicId, version } of updatedTopics) {
    const ownerSubs = db.prepare(`
      SELECT DISTINCT ps.id, ps.endpoint, ps.keys
      FROM push_subscriptions ps
      JOIN account_topics at ON at.account_id = ps.account_id
      WHERE at.topic_id = ? AND at.topic_version != ? AND at.deleted_at IS NULL
    `).all(topicId, version);

    for (const sub of ownerSubs) {
      try {
        await sendPushNotification(
          { id: sub.id, endpoint: sub.endpoint, keys: safeJson(sub.keys, {}) },
          {
            title: `Тема обновлена до ${version}`,
            body: "Доступна новая версия",
            data: { type: "topic_update", topicId, version },
          }
        );
        sent++;
      } catch (err) {
        if (err?.statusCode === 410) removePushSubscription(db, sub.id);
      }
    }
  }
  writeJson(res, 200, { ok: true, sent });
}

async function handlePushSubscribe(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const { endpoint, keys } = body;
  if (!endpoint || !keys) return writeJson(res, 400, { error: "endpoint and keys required" });
  upsertPushSubscription(db, account.id, { id: randomUUID(), endpoint, keys });
  writeJson(res, 200, { ok: true });
}

// ─── Version handler ───────────────────────────────────────────────────────────

async function handleVersion(req, res) {
  try {
    const versionPath = path.join(DEPLOY_FRONTEND_DIR, "version.json");
    const content = await readFile(versionPath, "utf8");
    writeJson(res, 200, JSON.parse(content));
  } catch {
    writeJson(res, 200, { version: "unknown" });
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

async function router(req, res) {
  const url = new URL(req.url, "http://localhost");
  const method = req.method.toUpperCase();
  const p = normalizeApiPath(url.pathname);

  if (method === "OPTIONS") return writeNoContent(res);

  try {
    // Auth
    if (method === "POST"   && p === "/auth/register")            return await handleRegister(req, res);
    if (method === "POST"   && p === "/auth/login")               return await handleLogin(req, res);
    if (method === "POST"   && p === "/auth/logout")              return await handleLogout(req, res);
    if (method === "POST"   && p === "/auth/forgot-password")     return await handleForgotPassword(req, res);
    if (method === "POST"   && p === "/auth/reset-password")      return await handleResetPassword(req, res);

    // Account
    if (method === "GET"    && p === "/account/bootstrap")        return await handleBootstrap(req, res);
    if (method === "PATCH"  && p === "/account")                  return await handlePatchAccount(req, res);
    if (method === "POST"   && p === "/account/change-password")  return await handleChangePassword(req, res);
    if (method === "DELETE" && p === "/account")                  return await handleDeleteAccount(req, res);
    if (method === "PATCH"  && p === "/account/settings")         return await handlePatchSettings(req, res);

    // Students
    if (method === "GET"    && p === "/students")                 return await handleGetStudents(req, res);
    if (method === "POST"   && p === "/students")                 return await handleUpsertStudent(req, res);
    if (method === "DELETE" && /^\/students\/[^/]+$/.test(p))    return await handleDeleteStudent(req, res);

    // Sessions
    if (method === "GET"    && p === "/sessions")                 return await handleGetSessions(req, res);
    if (method === "POST"   && p === "/sessions")                 return await handleAppendSession(req, res);

    // Topics
    if (method === "GET"    && p === "/account-topics")           return await handleGetTopics(req, res);
    if (method === "POST"   && p === "/account-topics")           return await handleAcquireTopic(req, res);
    if (method === "DELETE" && /^\/account-topics\/[^/]+$/.test(p)) return await handleDeleteTopic(req, res);

    // Student topic links + concept progress
    if (method === "GET"    && p === "/student-topic-links")      return await handleGetStudentTopicLinks(req, res);
    if (method === "POST"   && p === "/student-topic-links")      return await handleUpsertStudentTopicLink(req, res);
    if (method === "POST"   && p === "/concept-progress")         return await handleUpsertConceptProgress(req, res);

    // Sync
    if (method === "POST"   && p === "/sync")                     return await handleSync(req, res);

    // Admin + push
    if (method === "POST"   && p === "/admin/notify-app-update")    return await handleNotifyAppUpdate(req, res);
    if (method === "POST"   && p === "/admin/notify-topic-updates") return await handleNotifyTopicUpdates(req, res);
    if (method === "POST"   && p === "/push/subscribe")             return await handlePushSubscribe(req, res);

    // Version
    if (method === "GET"    && p === "/version")                  return await handleVersion(req, res);

    writeJson(res, 404, { error: "Not found" });
  } catch (err) {
    if (err?.status) {
      writeJson(res, err.status, { error: err.message });
    } else {
      console.error(err);
      writeJson(res, 500, { error: "Internal server error" });
    }
  }
}

createServer(router).listen(PORT, () => {
  console.log(`Mirocard2 backend running on port ${PORT}`);
});
