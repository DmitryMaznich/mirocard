import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, createReadStream, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  DATA_DIR, PORT, DEPLOY_TOKEN, DEPLOY_FRONTEND_DIR, ADMIN_TOKEN,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBJECT,
} from "./lib/config.mjs";
import { generateAnalysis, getCachedAnalysis, deleteCachedAnalysis } from "./lib/analysis.mjs";
import { getDb } from "./lib/db.mjs";
import {
  createAccount, findAccountByEmail, findAccountByEmailAny, findAccountById,
  updateAccount, updateAccountPasswordHash, deleteAccount, activateAccount,
  serializeAccount,
  storeAuthToken, findAccountByToken, deleteAuthToken,
  getAccountSettings, updateAccountSettings,
  getRevision,
  createPasswordResetToken, consumePasswordResetToken,
  createEmailVerificationToken, consumeEmailVerificationToken,
  deleteEmailVerificationTokensForAccount,
  upsertStudent, getStudents, softDeleteStudent,
  appendSession, getSessions,
  upsertAccountTopic, getAccountTopics, softDeleteAccountTopic,
  getAccountTopicByTopicId, claimAccountTopic, grantAccountTopic, setAccountFeatureFlags,
  listAllAccounts, revokeAccountTopic,
  upsertStudentTopicLink, getStudentTopicLinks,
  upsertConceptProgress, getAllConceptProgress,
  upsertPushSubscription, getAllPushSubscriptions, removePushSubscription,
  getPhoto, migratePhotoData,
  getAccountKvByPrefixes,
} from "./lib/account-repository.mjs";
import {
  createPasswordHash, verifyPasswordHash,
} from "./lib/security.mjs";
import { writeJson, writeNoContent, readJsonBody, readRawBody, writeAudio, getBearerToken } from "./lib/http.mjs";
import { sendPasswordResetEmail, sendEmailVerificationEmail } from "./lib/mailer.mjs";
import { buildBootstrap } from "./lib/snapshot-builder.mjs";
import { processSync } from "./lib/sync-processor.mjs";
import { configureWebPush, sendPushNotification } from "./lib/push.mjs";
import {
  createStudentPortal,
  findPortalByTokenHash,
  listStudentPortals,
  revokeStudentPortal,
  updatePortalLastUsed,
  setPortalActiveTask,
} from "./lib/student-portal.mjs";

// ─── Init ──────────────────────────────────────────────────────────────────────

const db = getDb();

migratePhotoData(db);

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

function requireAdmin(req) {
  const raw = getBearerToken(req);
  if (!raw || raw !== ADMIN_TOKEN) throw { status: 403, message: "Admin access required" };
}

// ─── Catalog helpers ─────────────────────────────────────────────────────────

const DECKS_DIR = path.join(DEPLOY_FRONTEND_DIR, "decks");

function loadCatalog() {
  return JSON.parse(readFileSync(path.join(DECKS_DIR, "catalog.json"), "utf8"));
}

function getCatalogEntry(topicId) {
  const catalog = loadCatalog();
  return (catalog.decks ?? []).find((d) => d.id === topicId) ?? null;
}

function isGranted(source) {
  return ["free", "grant", "paid"].includes(source);
}

// ─── Resend verification rate limit ─────────────────────────────────────────
// Simple in-memory: max 3 resends per email per hour
const _resendLimiter = new Map();

function checkResendLimit(email) {
  const now = Date.now();
  const entry = _resendLimiter.get(email);
  if (!entry || now - entry.windowStart > 60 * 60 * 1000) {
    _resendLimiter.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

function requireDeployToken(req) {
  const token = getBearerToken(req);
  if (token !== DEPLOY_TOKEN) throw { status: 403, message: "Invalid deploy token" };
}

function requireStudentPortal(req) {
  const raw = getBearerToken(req);
  if (!raw) throw { status: 401, message: "Missing portal token" };
  const tokenHash = hashToken(raw);
  const portal = findPortalByTokenHash(db, tokenHash);
  if (!portal) throw { status: 401, message: "Invalid or revoked portal link" };
  updatePortalLastUsed(db, tokenHash);
  return portal;
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
    closeAdults:  safeJson(row.close_adults, []),
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
  const firstName = String(body?.firstName || "").trim();
  const lastName = String(body?.lastName || "").trim();
  const role = String(body?.role || "");
  const referralSource = String(body?.referralSource || "");
  const consentPersonalData = body?.consentPersonalData === true;

  if (!email || !email.includes("@")) return writeJson(res, 400, { error: "Invalid email" });
  if (password.length < 8) return writeJson(res, 400, { error: "Password must be at least 8 characters" });
  if (!firstName) return writeJson(res, 400, { error: "First name is required" });
  if (!["parent", "specialist"].includes(role)) return writeJson(res, 400, { error: "Invalid role" });
  if (!["friend", "developer", "other"].includes(referralSource)) return writeJson(res, 400, { error: "Invalid referral source" });
  if (!consentPersonalData) return writeJson(res, 400, { error: "Consent to personal data processing is required" });
  if (findAccountByEmailAny(db, email)) return writeJson(res, 409, { error: "Email already registered" });

  const account = createAccount(db, {
    email,
    passwordHash: createPasswordHash(password),
    firstName,
    lastName,
    role,
    referralSource,
    consentPersonalDataAt: new Date().toISOString(),
  });

  const rawToken = randomUUID();
  createEmailVerificationToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
  await sendEmailVerificationEmail(account.email, rawToken).catch(console.error);

  writeJson(res, 201, { message: "Check your email" });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);
  const password = String(body?.password || "");

  const anyAccount = email ? findAccountByEmailAny(db, email) : null;

  if (anyAccount?.status === "pending") {
    return writeJson(res, 403, { error: "email_not_verified" });
  }

  const account = anyAccount?.status === "active" ? anyAccount : null;
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
    account: serializeAccount(account),
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
    account: serializeAccount(account),
    settings,
    token,
  });
}

async function handleVerifyEmail(req, res) {
  const url = new URL(req.url, "http://localhost");
  const rawToken = url.searchParams.get("token") || "";

  if (!rawToken) return writeJson(res, 400, { error: "Missing token" });

  const accountId = consumeEmailVerificationToken(db, hashToken(rawToken));
  if (!accountId) return writeJson(res, 400, { error: "invalid_or_expired_token" });

  activateAccount(db, accountId);
  const account = findAccountById(db, accountId);
  const token = makeToken(account.id);
  const settings = getAccountSettings(db, account.id);

  writeJson(res, 200, {
    account: serializeAccount(account),
    settings,
    token,
  });
}

async function handleResendVerification(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);

  if (!email || !checkResendLimit(email)) {
    return writeJson(res, 200, { message: "ok" });
  }

  const account = findAccountByEmailAny(db, email);
  if (account?.status === "pending") {
    deleteEmailVerificationTokensForAccount(db, account.id);
    const rawToken = randomUUID();
    createEmailVerificationToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
    await sendEmailVerificationEmail(account.email, rawToken).catch(console.error);
  }

  writeJson(res, 200, { message: "ok" });
}

// ─── Account handlers ──────────────────────────────────────────────────────────

async function handlePatchAccount(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);

  const firstName = body?.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName = body?.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const role = body?.role !== undefined ? String(body.role) : undefined;

  if (firstName === "") return writeJson(res, 400, { error: "First name is required" });
  if (role !== undefined && !["parent", "specialist"].includes(role)) {
    return writeJson(res, 400, { error: "Invalid role" });
  }

  updateAccount(db, account.id, { firstName, lastName, role });
  const updated = findAccountById(db, account.id);
  writeJson(res, 200, serializeAccount(updated));
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

async function handleGetAccountKv(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const prefixes = url.searchParams.getAll("prefix");
  const items = getAccountKvByPrefixes(db, account.id, prefixes);
  writeJson(res, 200, { kv: items });
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
    closeAdults: Array.isArray(body.closeAdults)
      ? body.closeAdults.filter((a) => a && typeof a === "object" && a.id && a.name)
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

function sessionToApi(s) {
  let mistakes, cardEvents;
  try { mistakes   = JSON.parse(s.mistakes   ?? "[]"); } catch { mistakes   = []; }
  try { cardEvents = JSON.parse(s.card_events ?? "[]"); } catch { cardEvents = []; }
  return {
    id:             s.id,
    studentId:      s.student_id,
    topicId:        s.topic_id,
    topicVersion:   s.topic_version,
    mode:           s.mode,
    startedAt:      s.started_at,
    completedAt:    s.completed_at,
    correctCount:   s.correct_count,
    incorrectCount: s.incorrect_count,
    percentCorrect: s.percent_correct,
    mistakes,
    cardEvents,
    createdAt:      s.created_at,
  };
}

async function handleGetSessions(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const studentId = url.searchParams.get("studentId");
  const limit = Math.min(200, Number(url.searchParams.get("limit") || 50));
  const before = url.searchParams.get("before") || null;
  const rows = getSessions(db, account.id, { studentId, limit, before });
  writeJson(res, 200, rows.map(sessionToApi));
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

// ─── Analysis handlers ────────────────────────────────────────────────────────

async function handleGetTopicAnalysis(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://x");
  const studentId = url.searchParams.get("studentId");
  const topicId   = url.searchParams.get("topicId");
  if (!studentId || !topicId) return writeJson(res, 400, { error: "studentId, topicId required" });
  const cached = getCachedAnalysis(db, studentId, topicId);
  if (!cached) return writeJson(res, 404, { error: "not found" });
  writeJson(res, 200, { ...JSON.parse(cached.result_json), generated_at: cached.generated_at });
}

async function handlePostTopicAnalysis(req, res) {
  requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.studentId || !body?.topicId) {
    return writeJson(res, 400, { error: "studentId, topicId required" });
  }
  const result = await generateAnalysis(db, body.studentId, body.topicId);
  if (!result) return writeJson(res, 404, { error: "no sessions found" });
  writeJson(res, 200, result);
}

async function handleDeleteTopicAnalysis(req, res) {
  requireAuth(req);
  const url = new URL(req.url, "http://x");
  const studentId = url.searchParams.get("studentId");
  const topicId   = url.searchParams.get("topicId");
  deleteCachedAnalysis(db, studentId, topicId);
  writeJson(res, 200, { ok: true });
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

// ─── Decks catalog + claim + download ────────────────────────────────────────

async function handleGetDecksCatalog(req, res) {
  const account = requireAuth(req);
  const flags = new Set(JSON.parse(account.feature_flags ?? "[]"));
  const catalog = loadCatalog();
  const decks = (catalog.decks ?? []).filter((d) => {
    const status = d.status ?? "release";
    if (status === "release") return true;
    return flags.has(status);
  });
  writeJson(res, 200, { ...catalog, decks });
}

async function handleClaimDeck(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const topicId = url.pathname.split("/")[2];

  const entry = getCatalogEntry(topicId);
  if (!entry) return writeJson(res, 404, { error: "Deck not found in catalog" });

  const access = entry.access ?? "free";
  const existing = getAccountTopicByTopicId(db, account.id, topicId);

  if (existing && isGranted(existing.source)) {
    return writeJson(res, 200, { status: "granted", topicId });
  }
  if (existing && existing.source === "request") {
    return writeJson(res, 200, { status: "pending", topicId });
  }

  if (access === "free") {
    claimAccountTopic(db, account.id, { topicId, topicVersion: entry.version, source: "free" });
    return writeJson(res, 200, { status: "granted", topicId });
  }

  // paid — create pending request
  claimAccountTopic(db, account.id, { topicId, topicVersion: entry.version, source: "request" });
  return writeJson(res, 200, { status: "pending", topicId });
}

async function handleDownloadDeck(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const topicId = url.pathname.split("/")[2];

  const entry = getCatalogEntry(topicId);
  if (!entry) return writeJson(res, 404, { error: "Deck not found" });

  const row = getAccountTopicByTopicId(db, account.id, topicId);
  if (!row || !isGranted(row.source)) {
    return writeJson(res, 403, { error: "No access to this deck" });
  }

  // entry.url is like "./decks/foo_v1.0.zip" — resolve relative to DECKS_DIR parent
  const zipRelPath = entry.url.replace(/^\.\/decks\//, "");
  const zipPath = path.join(DECKS_DIR, zipRelPath);

  if (!existsSync(zipPath)) return writeJson(res, 404, { error: "Deck file not found" });

  const stat = statSync(zipPath);
  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Length": stat.size,
    "Content-Disposition": `attachment; filename="${path.basename(zipPath)}"`,
    "Cache-Control": "private, max-age=3600",
  });
  createReadStream(zipPath).pipe(res);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function handleAdminSetFlags(req, res) {
  requireAdmin(req);
  const body = await readJsonBody(req);
  if (!body?.email || !Array.isArray(body.flags)) {
    return writeJson(res, 400, { error: "email and flags[] required" });
  }
  const account = findAccountByEmailAny(db, body.email);
  if (!account) return writeJson(res, 404, { error: "Account not found" });
  setAccountFeatureFlags(db, account.id, body.flags);
  writeJson(res, 200, { ok: true, email: account.email, flags: body.flags });
}

async function handleAdminGrant(req, res) {
  requireAdmin(req);
  const body = await readJsonBody(req);
  if (!body?.email || !body?.topicId) {
    return writeJson(res, 400, { error: "email and topicId required" });
  }
  const account = findAccountByEmailAny(db, body.email);
  if (!account) return writeJson(res, 404, { error: "Account not found" });

  const entry = getCatalogEntry(body.topicId);
  const version = entry?.version ?? "unknown";
  grantAccountTopic(db, account.id, { topicId: body.topicId, topicVersion: version });
  writeJson(res, 200, { ok: true, email: account.email, topicId: body.topicId });
}

async function handleAdminListAccounts(req, res) {
  requireAdmin(req);
  writeJson(res, 200, listAllAccounts(db));
}

async function handleAdminRevoke(req, res) {
  requireAdmin(req);
  const body = await readJsonBody(req);
  if (!body?.email || !body?.topicId) {
    return writeJson(res, 400, { error: "email and topicId required" });
  }
  const account = findAccountByEmailAny(db, body.email);
  if (!account) return writeJson(res, 404, { error: "Account not found" });
  revokeAccountTopic(db, account.id, body.topicId);
  writeJson(res, 200, { ok: true });
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

// ─── Photo handler ─────────────────────────────────────────────────────────────

async function handleGetPhoto(req, res) {
  const url = new URL(req.url, "http://localhost");
  const hash = url.pathname.split("/").at(-1);
  const photo = getPhoto(db, hash);
  if (!photo) { res.writeHead(404); res.end(); return; }
  const buffer = Buffer.from(photo.data, "base64");
  res.writeHead(200, {
    "Content-Type": photo.content_type,
    "Content-Length": String(buffer.length),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(buffer);
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

// ─── Audio Overrides ──────────────────────────────────────────────────────────

async function handleListAudioOverrides(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const topicId = url.searchParams.get("topicId");
  const textId  = url.searchParams.get("textId");
  if (!topicId || !textId) throw { status: 400, message: "topicId and textId required" };
  const rows = db.prepare(
    "SELECT step_num, byte_size, updated_at FROM audio_overrides WHERE account_id=? AND topic_id=? AND text_id=?"
  ).all(account.id, topicId, textId);
  writeJson(res, 200, rows.map((r) => ({ stepNum: r.step_num, byteSize: r.byte_size, updatedAt: r.updated_at })));
}

async function handlePutAudioOverride(req, res) {
  const account = requireAuth(req);
  const parts = normalizeApiPath(new URL(req.url, "http://localhost").pathname).split("/").filter(Boolean);
  // parts: ["audio-overrides", topicId, textId, stepNum]
  const [, topicId, textId, stepNumStr] = parts;
  const stepNum = parseInt(stepNumStr, 10);
  if (!topicId || !textId || isNaN(stepNum)) throw { status: 400, message: "Invalid path" };
  const body = await readRawBody(req, 2 * 1024 * 1024);
  if (body.length === 0) throw { status: 400, message: "Empty body" };
  const contentType = req.headers["content-type"] || "audio/webm;codecs=opus";
  const now = Date.now();
  db.prepare(`
    INSERT INTO audio_overrides(account_id, topic_id, text_id, step_num, audio_data, content_type, byte_size, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, topic_id, text_id, step_num)
    DO UPDATE SET audio_data=excluded.audio_data, content_type=excluded.content_type,
                  byte_size=excluded.byte_size, updated_at=excluded.updated_at
  `).run(account.id, topicId, textId, stepNum, body, contentType, body.length, now);
  writeJson(res, 200, { ok: true, byteSize: body.length, updatedAt: now });
}

async function handleGetAudioOverrideData(req, res) {
  const account = requireAuth(req);
  const parts = normalizeApiPath(new URL(req.url, "http://localhost").pathname).split("/").filter(Boolean);
  // parts: ["audio-overrides", topicId, textId, stepNum, "data"]
  const [, topicId, textId, stepNumStr] = parts;
  const stepNum = parseInt(stepNumStr, 10);
  if (!topicId || !textId || isNaN(stepNum)) throw { status: 400, message: "Invalid path" };
  const row = db.prepare(
    "SELECT audio_data, content_type FROM audio_overrides WHERE account_id=? AND topic_id=? AND text_id=? AND step_num=?"
  ).get(account.id, topicId, textId, stepNum);
  if (!row) throw { status: 404, message: "Not found" };
  writeAudio(res, row.audio_data, row.content_type);
}

async function handleDeleteAudioOverride(req, res) {
  const account = requireAuth(req);
  const parts = normalizeApiPath(new URL(req.url, "http://localhost").pathname).split("/").filter(Boolean);
  // parts: ["audio-overrides", topicId, textId, stepNum]
  const [, topicId, textId, stepNumStr] = parts;
  const stepNum = parseInt(stepNumStr, 10);
  if (!topicId || !textId || isNaN(stepNum)) throw { status: 400, message: "Invalid path" };
  db.prepare(
    "DELETE FROM audio_overrides WHERE account_id=? AND topic_id=? AND text_id=? AND step_num=?"
  ).run(account.id, topicId, textId, stepNum);
  writeJson(res, 200, { ok: true });
}

// ─── Student portal handlers ──────────────────────────────────────────────────

async function handleStudentMe(req, res) {
  const portal = requireStudentPortal(req);
  const students = getStudents(db, portal.account_id);
  const student = students.find((s) => s.id === portal.student_id && !s.deleted_at);
  if (!student) throw { status: 404, message: "Student not found" };

  const allLinks = getStudentTopicLinks(db, portal.account_id);
  const studentLinks = allLinks.filter((l) => l.student_id === portal.student_id && !l.deleted_at);

  const assignedTopics = studentLinks.map((l) => ({
    topicId: l.topic_id,
    selectionMode: l.selection_mode,
    selectedConceptIds: safeJson(l.selected_concept_ids, []),
    repsPerConcept: l.reps_per_concept,
  }));

  const activeTask = portal.active_topic_id
    ? {
        topicId:  portal.active_topic_id,
        modeId:   portal.active_mode_id ?? null,
        textId:   portal.active_text_id ?? null,
        planData: portal.active_plan_data ? JSON.parse(portal.active_plan_data) : null,
      }
    : null;

  return writeJson(res, 200, {
    student: { id: student.id, name: student.name },
    activeTask,
    assignedTopics,
  });
}

async function handleStudentSession(req, res) {
  const portal = requireStudentPortal(req);
  const body = await readJsonBody(req);
  appendSession(db, portal.account_id, {
    id: body.id,
    studentId: portal.student_id,
    topicId: body.topicId,
    topicVersion: body.topicVersion ?? "unknown",
    mode: body.mode,
    startedAt: body.startedAt,
    completedAt: body.completedAt,
    correctCount: body.correctCount ?? 0,
    incorrectCount: body.incorrectCount ?? 0,
    percentCorrect: body.percentCorrect ?? 0,
    mistakes: body.mistakes ?? [],
    cardEvents: body.cardEvents ?? [],
  });
  return writeNoContent(res);
}

async function handleCreatePortal(req, res, studentId) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const raw = randomUUID();
  const tokenHash = hashToken(raw);
  const label    = typeof body.label   === "string" ? body.label.trim()   || null : null;
  const topicId  = typeof body.topicId === "string" ? body.topicId.trim() || null : null;
  const modeId   = typeof body.modeId  === "string" ? body.modeId.trim()  || null : null;
  const textId   = typeof body.textId  === "string" ? body.textId.trim()  || null : null;
  const planData = body.planData && typeof body.planData === "object" ? JSON.stringify(body.planData) : null;
  const portalId = createStudentPortal(db, { accountId: account.id, studentId, tokenHash, label, topicId, modeId, textId, planData });
  const origin = req.headers.origin ?? req.headers.host ?? "";
  const url = origin ? `${origin}/s/${raw}` : `/s/${raw}`;
  return writeJson(res, 201, { portalId, url, token: raw });
}

async function handleListPortals(req, res, studentId) {
  const account = requireAuth(req);
  const portals = listStudentPortals(db, { accountId: account.id, studentId });
  return writeJson(res, 200, { portals });
}

async function handleRevokePortal(req, res, studentId, portalId) {
  const account = requireAuth(req);
  revokeStudentPortal(db, { id: portalId, accountId: account.id });
  return writeNoContent(res);
}

async function handleSetActiveTask(req, res, studentId) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const planData = 'planData' in body
    ? (body.planData != null ? JSON.stringify(body.planData) : null)
    : undefined;
  setPortalActiveTask(db, {
    accountId: account.id,
    studentId,
    topicId: body.topicId ?? null,
    modeId:  body.modeId  ?? null,
    textId:  typeof body.textId === "string" ? body.textId || null : null,
    planData,
  });
  return writeNoContent(res);
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
    if (method === "GET"    && p === "/auth/verify-email")        return await handleVerifyEmail(req, res);
    if (method === "POST"   && p === "/auth/resend-verification") return await handleResendVerification(req, res);

    // Account
    if (method === "GET"    && p === "/account/bootstrap")        return await handleBootstrap(req, res);
    if (method === "GET"    && p === "/account/kv")              return await handleGetAccountKv(req, res);
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

    // Analysis
    if (method === "GET"    && p === "/analysis/topic")           return await handleGetTopicAnalysis(req, res);
    if (method === "POST"   && p === "/analysis/topic")           return await handlePostTopicAnalysis(req, res);
    if (method === "DELETE" && p === "/analysis/topic")           return await handleDeleteTopicAnalysis(req, res);

    // Topics
    if (method === "GET"    && p === "/account-topics")           return await handleGetTopics(req, res);
    if (method === "POST"   && p === "/account-topics")           return await handleAcquireTopic(req, res);
    if (method === "DELETE" && /^\/account-topics\/[^/]+$/.test(p)) return await handleDeleteTopic(req, res);

    if (method === "GET"    && p === "/decks/catalog")                             return await handleGetDecksCatalog(req, res);
    if (method === "POST"   && /^\/decks\/[^/]+\/claim$/.test(p))                 return await handleClaimDeck(req, res);
    if (method === "GET"    && /^\/decks\/[^/]+\/download$/.test(p))              return await handleDownloadDeck(req, res);
    if (method === "GET"    && p === "/admin/accounts")                            return await handleAdminListAccounts(req, res);
    if (method === "POST"   && p === "/admin/account/flags")                       return await handleAdminSetFlags(req, res);
    if (method === "POST"   && p === "/admin/grant")                               return await handleAdminGrant(req, res);
    if (method === "POST"   && p === "/admin/revoke")                              return await handleAdminRevoke(req, res);

    // Student topic links + concept progress
    if (method === "GET"    && p === "/student-topic-links")      return await handleGetStudentTopicLinks(req, res);
    if (method === "POST"   && p === "/student-topic-links")      return await handleUpsertStudentTopicLink(req, res);
    if (method === "POST"   && p === "/concept-progress")         return await handleUpsertConceptProgress(req, res);

    // Sync
    if (method === "POST"   && p === "/sync")                     return await handleSync(req, res);

    // Audio overrides
    if (method === "GET"    && p === "/audio-overrides")                                        return await handleListAudioOverrides(req, res);
    if (method === "PUT"    && /^\/audio-overrides\/[^/]+\/[^/]+\/\d+$/.test(p))               return await handlePutAudioOverride(req, res);
    if (method === "GET"    && /^\/audio-overrides\/[^/]+\/[^/]+\/\d+\/data$/.test(p))         return await handleGetAudioOverrideData(req, res);
    if (method === "DELETE" && /^\/audio-overrides\/[^/]+\/[^/]+\/\d+$/.test(p))               return await handleDeleteAudioOverride(req, res);

    // Admin + push
    if (method === "POST"   && p === "/admin/notify-app-update")    return await handleNotifyAppUpdate(req, res);
    if (method === "POST"   && p === "/admin/notify-topic-updates") return await handleNotifyTopicUpdates(req, res);
    if (method === "POST"   && p === "/push/subscribe")             return await handlePushSubscribe(req, res);

    // Photos (content-addressable, no auth required)
    if (method === "GET"    && /^\/photos\/[^/]+$/.test(p))       return await handleGetPhoto(req, res);

    // Version
    if (method === "GET"    && p === "/version")                  return await handleVersion(req, res);

    // Student portal (student auth)
    if (method === "GET"    && p === "/student/me")               return await handleStudentMe(req, res);
    if (method === "POST"   && p === "/student/session")          return await handleStudentSession(req, res);

    // Student portal management (therapist auth)
    {
      const m1 = p.match(/^\/students\/([^/]+)\/portal$/);
      if (method === "POST"   && m1) return await handleCreatePortal(req, res, m1[1]);

      const m2 = p.match(/^\/students\/([^/]+)\/portals$/);
      if (method === "GET"    && m2) return await handleListPortals(req, res, m2[1]);

      const m3 = p.match(/^\/students\/([^/]+)\/portal\/([^/]+)$/);
      if (method === "DELETE" && m3) return await handleRevokePortal(req, res, m3[1], m3[2]);

      const m4 = p.match(/^\/students\/([^/]+)\/active-task$/);
      if (method === "PATCH"  && m4) return await handleSetActiveTask(req, res, m4[1]);
    }

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
