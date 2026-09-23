import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, createReadStream, statSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DATA_DIR, PORT, DEPLOY_TOKEN, DEPLOY_FRONTEND_DIR, ADMIN_TOKEN,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBJECT, SERVE_STATIC, LEGAL_DOCS_VERSION, PHOTO_LIMITS, OFFSITE_BACKUP,
  CORS_ALLOWED_ORIGINS,
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
  upsertStudent, getStudents, softDeleteStudent,
  appendSession, getSessions,
  upsertAccountTopic, getAccountTopics, softDeleteAccountTopic,
  getAccountTopicByTopicId, claimAccountTopic, grantAccountTopic, setAccountFeatureFlags,
  listAllAccounts, revokeAccountTopic, touchAccountSeen, recordHeartbeat,
  upsertStudentTopicLink, getStudentTopicLinks,
  upsertConceptProgress,
  upsertPushSubscription, getAllPushSubscriptions, removePushSubscription,
  getAccountKvByPrefixes,
  incrementRevision,
} from "./lib/account-repository.mjs";
import {
  createPasswordHash, verifyPasswordHash,
} from "./lib/security.mjs";
import { writeJson, writeNoContent, readJsonBody, readRawBody, writeAudio, getBearerToken, getClientIp, applyCors } from "./lib/http.mjs";
import { createRateLimiter } from "./lib/rate-limit.mjs";
import {
  sendPasswordResetEmail, sendEmailVerificationEmail, sendPromoGrantEmail, sendPurchaseConfirmationEmail,
} from "./lib/mailer.mjs";
import { buildBootstrap } from "./lib/snapshot-builder.mjs";
import { processSync } from "./lib/sync-processor.mjs";
import { configureWebPush, sendPushNotification } from "./lib/push.mjs";
import {
  createOrder, getOrderByExternalId, getEntitlementForOrder, getActiveSubscriptionForAccount,
  hasActiveEntitlement, validatePromoCode, redeemFreeGrantCode,
  createPromoCode, listPromoCodes, grantTrialSubscription, recordCheckoutConsent, getCheckoutConsentForOrder,
} from "./lib/billing-repository.mjs";
import { PLAN_CATALOG, applyDiscount } from "./lib/billing-plans.mjs";
import {
  createCheckoutSession as createStripeCheckoutSession,
  verifyStripeWebhookSignature, parseStripeWebhookEvent,
} from "./lib/billing-providers/stripe.mjs";
import {
  createInvoice as createLavaTopInvoice,
  verifyLavaTopWebhookAuth, parseLavaTopWebhookEvent,
} from "./lib/billing-providers/lava-top.mjs";
import { processBillingEvent } from "./lib/billing-orchestrator.mjs";
import { resolveGitSha } from "../scripts/build-info.mjs";
import { reportError, trackEvent } from "./lib/observability.mjs";
import { parseSnapshotTime } from "./lib/backup/rotation.mjs";
import { isOffsiteConfigured } from "./lib/backup/s3-client.mjs";
import {
  getOwnedPhoto, storePhotoDataUrl, resolveSyncOperationPhotos, migrateLegacyDataUrlPhotos, PhotoQuotaError,
} from "./lib/photo-store.mjs";
import { PhotoRejectedError } from "./lib/photo-normalizer.mjs";

// ─── Init ──────────────────────────────────────────────────────────────────────

const BACKEND_DIR = path.dirname(fileURLToPath(import.meta.url));

const db = getDb();

// Convert any legacy inline data: URL photos to normalized, owned WebP
// before serving requests (a concurrent sync write could otherwise race the
// read-modify-write). Idempotent: only rows still holding data: URLs match.
await migrateLegacyDataUrlPhotos(db);

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

// ─── Rate limits (see lib/rate-limit.mjs for what these do and don't cover) ────
const HOUR_MS = 60 * 60 * 1000;
const checkRegisterLimit  = createRateLimiter({ max: 10, windowMs: HOUR_MS });        // per IP
const checkLoginLimit     = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 }); // per email, 15min
const checkForgotPwLimit  = createRateLimiter({ max: 5,  windowMs: HOUR_MS });        // per email
const checkPromoLimit     = createRateLimiter({ max: 20, windowMs: HOUR_MS });        // per account
const checkCheckoutLimit  = createRateLimiter({ max: 20, windowMs: HOUR_MS });        // per account
const checkWebhookLimit   = createRateLimiter({ max: 600, windowMs: 60 * 1000 });     // per provider, coarse flood guard

function rateLimited(res) {
  writeJson(res, 429, { error: "Too many requests, try again later" });
}

function requireDeployToken(req) {
  const token = getBearerToken(req);
  if (token !== DEPLOY_TOKEN) throw { status: 403, message: "Invalid deploy token" };
}

function sanitizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function parseDevice(ua) {
  if (!ua) return null;
  const s = ua.toLowerCase();
  if (s.includes("iphone"))                          return "iPhone";
  if (s.includes("ipad"))                            return "iPad";
  if (s.includes("android") && s.includes("mobile")) return "Android";
  if (s.includes("android"))                         return "Android tablet";
  if (s.includes("windows"))                         return "Windows";
  if (s.includes("macintosh") || s.includes("mac os x")) return "Mac";
  if (s.includes("linux"))                           return "Linux";
  return "Desktop";
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
    rewardVideosUpdatedAt: row.reward_videos_updated_at ?? null,
    closeAdults:  safeJson(row.close_adults, []),
    closeAdultsUpdatedAt: row.close_adults_updated_at ?? null,
    healthDataConsent: !!row.health_data_consent,
    healthDataConsentAt: row.health_data_consent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  };
}

// ─── Auth handlers ─────────────────────────────────────────────────────────────

async function handleRegister(req, res) {
  if (!checkRegisterLimit(getClientIp(req))) return rateLimited(res);
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

  let account;
  try {
    account = createAccount(db, {
      email,
      passwordHash: createPasswordHash(password),
      firstName,
      lastName,
      role,
      referralSource,
      consentPersonalDataAt: new Date().toISOString(),
    });
  } catch (e) {
    if (String(e?.message).includes("UNIQUE constraint failed")) {
      return writeJson(res, 409, { error: "Email already registered" });
    }
    throw e;
  }

  grantTrialSubscription(db, account.id);
  trackEvent("registration_completed", { role, referralSource });

  const rawToken = randomUUID();
  createEmailVerificationToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
  sendEmailVerificationEmail(account.email, rawToken).catch(console.error);

  writeJson(res, 201, { message: "Check your email" });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = sanitizeEmail(body?.email);
  const password = String(body?.password || "");

  if (!checkLoginLimit(email || getClientIp(req))) return rateLimited(res);

  const anyAccount = email ? findAccountByEmailAny(db, email) : null;

  if (anyAccount?.status === "pending") {
    return writeJson(res, 403, { error: "email_not_verified" });
  }

  const account = anyAccount?.status === "active" ? anyAccount : null;
  let passwordMatches = account && verifyPasswordHash(password, account.password_hash);

  if (account && !passwordMatches) {
    const matchedLegacyPassword = getLegacyPasswordHashes(email).some((hash) =>
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

  if (!checkForgotPwLimit(email || getClientIp(req))) return rateLimited(res);

  const account = email ? findAccountByEmail(db, email) : null;
  if (account) {
    const rawToken = randomUUID();
    createPasswordResetToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
    sendPasswordResetEmail(account.email, rawToken).catch(console.error);
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
  trackEvent("email_verified", {});
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
    // Deliberately does not invalidate tokens from earlier sends: a user
    // who resent out of impatience and then opens an older email should
    // still be able to use that link, not hit "invalid or expired" on a
    // token that's only a few minutes old.
    const rawToken = randomUUID();
    createEmailVerificationToken(db, { tokenHash: hashToken(rawToken), accountId: account.id });
    sendEmailVerificationEmail(account.email, rawToken).catch(console.error);
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

async function handleHeartbeat(req, res) {
  requireAuth(req);
  const raw = getBearerToken(req);
  const body = await readJsonBody(req);
  const device = parseDevice(req.headers["user-agent"]);
  const topicId = typeof body?.topicId === "string" ? body.topicId || null : null;
  recordHeartbeat(db, hashToken(raw), { device, topicId });
  writeNoContent(res);
}

async function handleBootstrap(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const since = Number(url.searchParams.get("since") || 0);
  touchAccountSeen(db, account.id);
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
    healthDataConsent: body.healthDataConsent === true,
    healthDataConsentAt: body.healthDataConsent === true ? (body.healthDataConsentAt || null) : null,
  });

  writeJson(res, 200, serializeStudent(getStudents(db, account.id).find((s) => s.id === id)));
}

async function handleDeleteStudent(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const studentId = url.pathname.split("/").at(-1);
  softDeleteStudent(db, account.id, studentId);
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
  requireAuth(req);
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

// Topics anyone can download without an active subscription — the
// marketing "free core" hook from the landing page. Empty until product
// decides which specific topics stay free; add topic ids here later.
export const FREE_TOPIC_IDS = [];

async function handleAcquireTopic(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.topicId || !body?.topicVersion) {
    return writeJson(res, 400, { error: "topicId, topicVersion required" });
  }
  if (!FREE_TOPIC_IDS.includes(body.topicId) && !hasActiveEntitlement(db, account.id)) {
    return writeJson(res, 402, { error: "Subscription required" });
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
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const id = url.pathname.split("/").at(-1);
  softDeleteAccountTopic(db, account.id, id);
  writeNoContent(res);
}

// ─── Decks catalog + claim + download ────────────────────────────────────────

async function handleGetDecksCatalog(req, res) {
  // Auth is optional here on purpose: local-mode / logged-out visitors need
  // to see the free catalog too. What must never happen regardless of auth
  // state is a paid entry's static `url` leaking out of this response --
  // that URL is a direct, unauthenticated path to the ZIP (see
  // handleDownloadDeck / trySpaFallback), so paid downloads must always go
  // through the entitlement-checked /decks/:id/download endpoint instead.
  let flags = new Set();
  try {
    const account = requireAuth(req);
    flags = new Set(JSON.parse(account.feature_flags ?? "[]"));
  } catch {
    // anonymous caller — treated as having no feature flags
  }
  const catalog = loadCatalog();
  const decks = (catalog.decks ?? [])
    .filter((d) => {
      const status = d.status ?? "release";
      if (status === "release") return true;
      return flags.has(status);
    })
    .map((d) => {
      if ((d.access ?? "free") === "free") return d;
      const { url, ...rest } = d;
      return rest;
    });
  writeJson(res, 200, { ...catalog, decks });
}

async function handleClaimDeck(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  // req.url still carries the /api prefix here (only the router's local `p`
  // is normalized) — normalize before splitting or index [2] lands on
  // "decks" instead of the topic id. Pre-existing bug, never triggered
  // before because no catalog entry had ever used access:"paid".
  const topicId = normalizeApiPath(url.pathname).split("/")[2];

  const entry = getCatalogEntry(topicId);
  if (!entry) return writeJson(res, 404, { error: "Deck not found in catalog" });

  const access = entry.access ?? "free";
  const existing = getAccountTopicByTopicId(db, account.id, topicId);

  if (existing && isGranted(existing.source)) {
    // A previous "paid" claim only stays granted while the entitlement that
    // earned it is still active -- otherwise this would keep telling the
    // client "granted" forever even after the subscription/trial/promo
    // period that justified it has expired. Free and admin-granted claims
    // never expire this way.
    if (existing.source !== "paid" || hasActiveEntitlement(db, account.id)) {
      return writeJson(res, 200, { status: "granted", topicId });
    }
    return writeJson(res, 200, { status: "locked", topicId });
  }
  if (existing && existing.source === "request") {
    return writeJson(res, 200, { status: "pending", topicId });
  }

  if (access === "free") {
    claimAccountTopic(db, account.id, { topicId, topicVersion: entry.version, source: "free" });
    return writeJson(res, 200, { status: "granted", topicId });
  }

  // paid — automatic grant for an entitled account, otherwise the caller
  // needs to subscribe. Replaces the older manual-approval "request" flow,
  // which was never exercised by any live catalog entry.
  if (hasActiveEntitlement(db, account.id)) {
    claimAccountTopic(db, account.id, { topicId, topicVersion: entry.version, source: "paid" });
    return writeJson(res, 200, { status: "granted", topicId });
  }
  return writeJson(res, 200, { status: "locked", topicId });
}

async function handleDownloadDeck(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const topicId = normalizeApiPath(url.pathname).split("/")[2];

  const entry = getCatalogEntry(topicId);
  if (!entry) return writeJson(res, 404, { error: "Deck not found" });

  const row = getAccountTopicByTopicId(db, account.id, topicId);
  if (!row || !isGranted(row.source)) {
    return writeJson(res, 403, { error: "No access to this deck" });
  }
  // A "paid" claim is only a download right for as long as the entitlement
  // that earned it stays active -- checked again here, not just at claim
  // time, so a lapsed subscription/trial/promo can't keep re-downloading a
  // paid deck indefinitely off a claim row made while it was still active.
  // Free and admin-granted ("grant") claims are intentionally exempt: they
  // were never tied to a subscription period in the first place.
  if (row.source === "paid" && !hasActiveEntitlement(db, account.id)) {
    return writeJson(res, 403, { error: "Entitlement expired" });
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
    // This endpoint's URL does not contain the deck version. Its response
    // must not outlive a catalog update and conceal a newer ZIP.
    "Cache-Control": "no-store",
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

async function handleAdminVerifyAccount(req, res) {
  requireAdmin(req);
  const body = await readJsonBody(req);
  if (!body?.email) return writeJson(res, 400, { error: "email required" });
  const account = findAccountByEmailAny(db, body.email);
  if (!account) return writeJson(res, 404, { error: "Account not found" });
  if (account.status === "deleted") return writeJson(res, 409, { error: "Account is deleted" });
  if (account.status !== "active") activateAccount(db, account.id);
  writeJson(res, 200, { ok: true, email: account.email, status: "active" });
}

async function handleAdminListAccounts(req, res) {
  requireAdmin(req);
  writeJson(res, 200, listAllAccounts(db));
}

async function handleAdminGetAccountSessions(req, res, accountId) {
  requireAdmin(req);
  const rows = getSessions(db, accountId, { limit: 30 });
  writeJson(res, 200, rows.map((s) => ({
    id: s.id,
    studentId: s.student_id,
    topicId: s.topic_id,
    mode: s.mode,
    startedAt: s.started_at,
    completedAt: s.completed_at,
    correctCount: s.correct_count,
    incorrectCount: s.incorrect_count,
    percentCorrect: s.percent_correct,
  })));
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

async function handleAdminListPromoCodes(req, res) {
  requireAdmin(req);
  writeJson(res, 200, listPromoCodes(db));
}

async function handleAdminCreatePromoCode(req, res) {
  requireAdmin(req);
  const body = await readJsonBody(req);
  if (!body?.code || !body?.kind) return writeJson(res, 400, { error: "code and kind required" });
  createPromoCode(db, {
    code: body.code,
    kind: body.kind,
    value: body.value ?? null,
    currency: body.currency ?? null,
    appliesToPlan: body.appliesToPlan ?? null,
    grantDurationDays: body.grantDurationDays ?? null,
    maxRedemptions: body.maxRedemptions ?? null,
    expiresAt: body.expiresAt ?? null,
    note: body.note ?? null,
    createdBy: body.createdBy ?? "admin",
  });
  writeJson(res, 200, { ok: true });
}

// ─── Billing ────────────────────────────────────────────────────────────────

const CHECKOUT_METHODS = { card: "stripe", mir_sbp: "lava_top" };
// Launch is EU/Stripe only (docs/legal-launch-inputs.md §1). Lava Top stays
// wired but refused here until its integration is verified and the legal
// docs cover it -- the checkout UI shows it disabled with "скоро".
const DISABLED_CHECKOUT_METHODS = new Set(["mir_sbp"]);

async function handleBillingCheckout(req, res) {
  const account = requireAuth(req);
  if (!checkCheckoutLimit(account.id)) return rateLimited(res);

  // Checkout must never go live pointing at unreviewed legal text -- see
  // LEGAL_DOCS_VERSION in lib/config.mjs and docs/legal-launch-inputs.md.
  // This is a deploy-configuration gate, not a per-request error, so it
  // fails the same way for every caller until an operator sets the env var.
  if (LEGAL_DOCS_VERSION === "draft") {
    return writeJson(res, 503, { error: "Checkout is not yet configured for production (legal docs not finalized)" });
  }

  const body = await readJsonBody(req);
  const { plan, method, code, consents } = body ?? {};
  const locale = body?.locale === "sl" ? "sl" : "ru";

  const planDef = PLAN_CATALOG[plan];
  if (!planDef) return writeJson(res, 400, { error: "Unknown plan" });
  const provider = CHECKOUT_METHODS[method];
  if (!provider) return writeJson(res, 400, { error: "Unknown payment method" });
  if (DISABLED_CHECKOUT_METHODS.has(method)) {
    return writeJson(res, 400, { error: "Payment method not available yet" });
  }
  if (!consents?.termsAccepted || !consents?.pricePeriodConfirmed || !consents?.digitalContentAck) {
    return writeJson(res, 400, { error: "All checkout consents are required" });
  }

  let amountMinor = planDef.amountMinor;
  let appliedCode = null;
  if (code) {
    const validation = validatePromoCode(db, code, { accountId: account.id, plan });
    if (validation.ok && validation.kind !== "free_grant") {
      amountMinor = applyDiscount(amountMinor, validation);
      appliedCode = validation.code;
    }
  }

  const orderId = randomUUID();
  createOrder(db, account.id, {
    provider, plan, orderId, currency: planDef.currency, amountMinor, appliedCode,
  });
  const order = getOrderByExternalId(db, orderId);
  recordCheckoutConsent(db, {
    accountId: account.id, orderId: order.id, legalDocsVersion: LEGAL_DOCS_VERSION,
    termsAccepted: consents.termsAccepted, pricePeriodConfirmed: consents.pricePeriodConfirmed,
    digitalContentAck: consents.digitalContentAck, locale,
  });

  try {
    let checkoutUrl;
    if (provider === "stripe") {
      ({ checkoutUrl } = await createStripeCheckoutSession({
        orderId, planLabel: planDef.label, amountMinor, currency: planDef.currency,
        accountEmail: account.email, accountId: account.id,
      }));
    } else {
      ({ checkoutUrl } = await createLavaTopInvoice({
        orderId, amountMinor, currency: planDef.currency, accountEmail: account.email,
      }));
    }
    trackEvent("checkout_created", { plan, provider, amountMinor, currency: planDef.currency, hasPromoCode: Boolean(appliedCode) });
    writeJson(res, 200, { checkoutUrl, orderId, appliedCode });
  } catch (err) {
    // err.message can carry the payment provider's raw error response body
    // (see billing-providers/stripe.mjs and lava-top.mjs, which embed it
    // verbatim to make server-side debugging easier) -- that must never
    // reach the client as-is, only the server log.
    console.error(`[billing] checkout session creation failed for order ${orderId}:`, err.message);
    writeJson(res, 502, { error: "Payment provider error" });
  }
}

async function handleStripeWebhook(req, res) {
  // Coarse volumetric guard ahead of the (comparatively expensive) HMAC
  // signature check -- keyed by provider, not caller, since a legitimate
  // Stripe delivery can't be distinguished from a flood at this point
  // without trusting Stripe's published IP ranges, which this backend
  // doesn't currently verify.
  if (!checkWebhookLimit("stripe")) return rateLimited(res);
  const rawBody = (await readRawBody(req)).toString("utf8");
  if (!verifyStripeWebhookSignature(rawBody, req.headers["stripe-signature"])) {
    return writeJson(res, 401, { error: "Invalid signature" });
  }
  const result = processBillingEvent(db, { provider: "stripe", event: parseStripeWebhookEvent(rawBody), rawBody });
  handleWebhookOutcome(result);
  writeJson(res, 200, { received: true });
}

async function handleLavaTopWebhook(req, res) {
  if (!checkWebhookLimit("lava_top")) return rateLimited(res);
  const rawBody = (await readRawBody(req)).toString("utf8");
  if (!verifyLavaTopWebhookAuth(req.headers["x-api-key"])) {
    return writeJson(res, 401, { error: "Invalid auth" });
  }
  const result = processBillingEvent(db, { provider: "lava_top", event: parseLavaTopWebhookEvent(rawBody), rawBody });
  handleWebhookOutcome(result);
  writeJson(res, 200, { received: true });
}

// Fires the durable purchase-confirmation email exactly once, only when
// this exact webhook delivery is the one that actually completed the
// order (not a duplicate delivery, not a stale/out-of-order event that
// processBillingEvent correctly no-op'd) -- see the `kind: "completed"`
// result billing-orchestrator.mjs only returns on that specific branch.
function handleWebhookOutcome(result) {
  if (result?.kind !== "completed" && result?.kind !== "refunded") return;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.orderId);
  if (!order) return;

  trackEvent(result.kind === "completed" ? "payment_success" : "refund", {
    plan: order.plan, provider: order.provider, amountMinor: order.amount_minor, currency: order.currency,
  });

  if (result.kind !== "completed") return;
  const account = findAccountById(db, result.accountId);
  if (!account) return;
  const sub = getActiveSubscriptionForAccount(db, result.accountId);
  const consent = getCheckoutConsentForOrder(db, order.id);
  sendPurchaseConfirmationEmail(account.email, {
    plan: order.plan, amountMinor: order.amount_minor, currency: order.currency,
    endsAt: sub?.currentPeriodEnd,
    locale: consent?.locale ?? "ru",
    legalDocsVersion: consent?.legal_docs_version,
  }).catch(console.error);
}

async function handleGetSubscription(req, res) {
  const account = requireAuth(req);
  writeJson(res, 200, getActiveSubscriptionForAccount(db, account.id));
}

// Answers "did this specific checkout attempt succeed" -- distinct from
// handleGetSubscription, which reports the account's current overall
// entitlement and would say "active" even while THIS order is still
// pending, if the account happens to already be entitled some other way
// (an existing subscription, a trial, all_access). The checkout-return
// screen polls this by orderId specifically so it never shows "Подписка
// активна" for an unrelated pre-existing entitlement.
async function handleGetOrderStatus(req, res) {
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const orderId = url.searchParams.get("orderId");
  if (!orderId) return writeJson(res, 400, { error: "orderId required" });

  const order = getOrderByExternalId(db, orderId);
  if (!order || order.account_id !== account.id) {
    return writeJson(res, 404, { error: "Order not found" });
  }

  const entitlement = order.status === "completed" ? getEntitlementForOrder(db, order.id) : null;
  writeJson(res, 200, {
    status: order.status, // 'pending' | 'completed' | 'refunded' | 'chargeback' | 'abandoned'
    plan: order.plan,
    currentPeriodEnd: entitlement?.ends_at ?? null,
  });
}

async function handleValidateCode(req, res) {
  const account = requireAuth(req);
  if (!checkPromoLimit(account.id)) return rateLimited(res);
  const body = await readJsonBody(req);
  if (!body?.code || !PLAN_CATALOG[body.plan]) {
    return writeJson(res, 400, { error: "code and a known plan are required" });
  }
  const result = validatePromoCode(db, body.code, { accountId: account.id, plan: body.plan });
  trackEvent("promo_validated", { ok: result.ok, reason: result.reason, kind: result.kind });
  if (!result.ok) return writeJson(res, 200, result);

  if (result.kind === "free_grant") return writeJson(res, 200, result);

  const original = PLAN_CATALOG[body.plan].amountMinor;
  const discounted = applyDiscount(original, result);
  writeJson(res, 200, { ...result, originalAmountMinor: original, discountedAmountMinor: discounted });
}

async function handleRedeemCode(req, res) {
  const account = requireAuth(req);
  if (!checkPromoLimit(account.id)) return rateLimited(res);
  const body = await readJsonBody(req);
  if (!body?.code) return writeJson(res, 400, { error: "code is required" });

  const result = redeemFreeGrantCode(db, body.code, account.id);
  trackEvent("promo_redeemed", { ok: result.ok, reason: result.reason, code: result.ok ? String(body.code).trim().toUpperCase() : undefined });
  if (result.ok) {
    incrementRevision(db, account.id);
    const sub = getActiveSubscriptionForAccount(db, account.id);
    sendPromoGrantEmail(account.email, { code: String(body.code).trim().toUpperCase(), endsAt: sub?.currentPeriodEnd }).catch(console.error);
  }
  writeJson(res, result.ok ? 200 : 400, result);
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
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  upsertConceptProgress(db, account.id, body ?? {});
  writeJson(res, 200, { ok: true });
}

// ─── Sync handler ──────────────────────────────────────────────────────────────

async function handleSync(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const operations = Array.isArray(body?.operations) ? body.operations : [];
  // Photos inside operations are normalized/stored/owner-linked first. An
  // operation whose photo is rejected (bad image, quota) is not applied and
  // is reported in `rejected` -- still a 200, because the client's sync
  // queue retries any non-2xx forever and would stall every later write.
  const { accepted, rejected } = await resolveSyncOperationPhotos(db, account.id, operations);
  processSync(db, account.id, accepted);
  const revision = getRevision(db, account.id);
  writeJson(res, 200, { accepted: true, serverRevision: revision, rejected });
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
        title: `Mironium обновился до ${version}`,
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

async function handleUploadPhoto(req, res) {
  const account = requireAuth(req);
  let body;
  try {
    const raw = await readRawBody(req, PHOTO_LIMITS.maxInputBytes);
    body = JSON.parse(raw.toString("utf8"));
  } catch (err) {
    if (err?.status === 413) {
      // We stopped reading mid-body: close the connection so the unread
      // remainder can't be parsed as the client's next request.
      res.setHeader("Connection", "close");
      return writeJson(res, 413, { error: `Фото слишком большое (больше ${Math.round(PHOTO_LIMITS.maxInputBytes / 1048576)} МБ). Выберите другое фото.`, code: "too_large_input" });
    }
    return writeJson(res, 400, { error: "Не удалось прочитать фото. Попробуйте выбрать его ещё раз.", code: "malformed" });
  }
  if (typeof body?.dataUrl !== "string") return writeJson(res, 400, { error: "dataUrl required", code: "malformed" });
  try {
    const url = await storePhotoDataUrl(db, account.id, body.dataUrl);
    writeJson(res, 200, { url });
  } catch (err) {
    if (err instanceof PhotoRejectedError) return writeJson(res, 422, { error: err.message, code: err.code });
    if (err instanceof PhotoQuotaError) return writeJson(res, 409, { error: err.message, code: err.code, usage: err.details });
    throw err;
  }
}

async function handleGetPhoto(req, res) {
  // Owner-scoped: photos are de-duplicated by content hash across accounts,
  // and photo_owners records every account that stored (or, via the startup
  // backfill, already referenced) those bytes. Anyone else gets 404, not 403,
  // so a known hash doesn't even confirm the photo exists.
  const account = requireAuth(req);
  const url = new URL(req.url, "http://localhost");
  const hash = url.pathname.split("/").at(-1);
  const photo = getOwnedPhoto(db, account.id, hash);
  if (!photo) { res.writeHead(404); res.end(); return; }
  // New rows store raw WebP bytes (BLOB); legacy rows store base64 TEXT.
  const buffer = typeof photo.data === "string" ? Buffer.from(photo.data, "base64") : Buffer.from(photo.data);
  res.writeHead(200, {
    "Content-Type": photo.content_type,
    "Content-Length": String(buffer.length),
    // Requires auth and is per-account: a shared/proxy cache must never
    // serve one account's photo response to a different caller.
    "Cache-Control": "private, max-age=31536000, immutable",
  });
  res.end(buffer);
}

// ─── Legal document pages ───────────────────────────────────────────────────
// Served as real, versioned HTML documents -- registered as explicit
// routes ahead of trySpaFallback's catch-all, so /terms etc. never
// silently falls through to the SPA shell (that was the actual bug this
// closes: none of these paths existed as real routes before, only as an
// in-app modal for /privacy and static drafts on the separate landing
// domain for /terms and /refunds -- see docs/legal-launch-inputs.md and
// docs/commercial-launch-runbook.md for what's still a draft here).

const LEGAL_DIR = path.join(BACKEND_DIR, "legal");
const LEGAL_DOCS = {
  terms: "Условия использования",
  privacy: "Политика конфиденциальности",
  refunds: "Возврат средств",
  cancellation: "Отмена доступа",
  contact: "Контакты",
};
// Slovenian versions live at /sl/<slug> (backend/legal/sl/) -- ZVPot-1
// requires Slovenian for consumer dealings in Slovenia. Russian stays the
// default at /<slug>, which is what the in-app checkout links to.
const LEGAL_DOCS_SL = {
  terms: "Splošni pogoji uporabe",
  privacy: "Politika zasebnosti",
  refunds: "Vračilo kupnine in pravica do odstopa",
  cancellation: "Preklic dostopa",
  contact: "Kontakt",
};
const LEGAL_STRINGS = {
  ru: { draft: "<strong>Черновик.</strong> Этот документ ещё не прошёл финальную юридическую проверку.", version: "Версия документа" },
  sl: { draft: "<strong>Osnutek.</strong> Ta dokument še ni bil dokončno pravno pregledan.", version: "Različica dokumenta" },
};

function renderLegalPage(slug, title, bodyHtml, lang = "ru") {
  const t = LEGAL_STRINGS[lang];
  const draftBanner = LEGAL_DOCS_VERSION === "draft"
    ? `<p class="legal-draft-banner">${t.draft}</p>`
    : "";
  const langSwitch = `<nav class="legal-lang">${lang === "ru" ? "<strong>Русский</strong>" : `<a href="/${slug}" hreflang="ru">Русский</a>`} · ${lang === "sl" ? "<strong>Slovenščina</strong>" : `<a href="/sl/${slug}" hreflang="sl">Slovenščina</a>`}</nav>`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Mironium</title>
<style>
  body { font: 16px/1.6 -apple-system, "Nunito", sans-serif; color: #23302c; max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 28px; }
  a { color: #2f5b57; }
  code { background: #f0ece2; padding: 1px 5px; border-radius: 4px; }
  .legal-draft-banner { background: #fff3cd; border: 1px solid #ffe08a; border-radius: 8px; padding: 10px 14px; margin-bottom: 24px; }
  .legal-draft-notice { color: #6b7573; font-size: 14px; }
  .legal-lang { font-size: 14px; margin-bottom: 16px; }
  .legal-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e4dccf; font-size: 12px; color: #6b7573; }
</style>
</head>
<body>
${langSwitch}
${draftBanner}
${bodyHtml}
<p class="legal-footer">${t.version}: ${LEGAL_DOCS_VERSION}</p>
</body>
</html>`;
}

async function handleLegalDoc(req, res, slug, lang = "ru") {
  const title = (lang === "sl" ? LEGAL_DOCS_SL : LEGAL_DOCS)[slug];
  const dir = lang === "sl" ? path.join(LEGAL_DIR, "sl") : LEGAL_DIR;
  try {
    const bodyHtml = await readFile(path.join(dir, `${slug}.html`), "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(renderLegalPage(slug, title, bodyHtml, lang));
  } catch {
    writeJson(res, 404, { error: "Not found" });
  }
}

// ─── Version handler ───────────────────────────────────────────────────────────

// Repo root: BACKEND_DIR is <root>/backend, matching where .git/ and
// package.json actually live regardless of DEPLOY_FRONTEND_DIR (which can
// be pointed elsewhere via MIROCARD_DEPLOY_FRONTEND_DIR).
const REPO_ROOT = path.resolve(BACKEND_DIR, "..");
// Env (RAILWAY_GIT_COMMIT_SHA) -> build-info.json baked into the image ->
// .git (local dev). See scripts/build-info.mjs.
const GIT_SHA = resolveGitSha({ repoRoot: REPO_ROOT });
if (GIT_SHA === "unknown" && process.env.RAILWAY_ENVIRONMENT) {
  reportError(new Error("Release identity unknown: no git SHA in env, build-info.json or .git"), { scope: "release-identity" });
}

async function readPackageVersion() {
  try {
    // version.json was written by the old deploy-prod.mjs script for the
    // retired Windows/Caddy host. Railway builds straight from a Docker
    // image that never writes that file, so this endpoint silently returned
    // "unknown" — worthless for a client trying to detect it's stale.
    // package.json's version is bumped as its own commit on every release
    // (see DEPLOYMENT.md) and is always present in the built image.
    const content = await readFile(path.join(REPO_ROOT, "package.json"), "utf8");
    return JSON.parse(content).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function handleVersion(req, res) {
  const version = await readPackageVersion();
  writeJson(res, 200, { version, gitSha: GIT_SHA });
}

// Newest file under <DATA_DIR>/backups -- see
// scripts/railway-backup-loop.mjs, which writes there hourly. Returns null
// (not an error) if the directory doesn't exist yet or is empty, which is
// the expected state for a fresh non-Railway checkout, not a health
// problem in itself -- /healthz's caller decides what age is acceptable.
function backupAgeMinutes() {
  try {
    const backupDir = path.join(DATA_DIR, "backups");
    if (!existsSync(backupDir)) return null;
    // Only real snapshots count -- not offsite-state.json or anything else
    // that happens to be in the directory.
    const times = readdirSync(backupDir).map(parseSnapshotTime).filter((t) => t !== null);
    if (!times.length) return null;
    return Math.round((Date.now() - Math.max(...times)) / 60000);
  } catch {
    return null;
  }
}

function offsiteBackupStatus() {
  const configured = isOffsiteConfigured(OFFSITE_BACKUP);
  let lastUploadAt = null;
  try {
    lastUploadAt = JSON.parse(readFileSync(path.join(DATA_DIR, "backups", "offsite-state.json"), "utf8")).lastUploadAt ?? null;
  } catch {
    // no upload yet
  }
  return {
    configured,
    lastUploadAt,
    ageMinutes: lastUploadAt ? Math.round((Date.now() - Date.parse(lastUploadAt)) / 60000) : null,
  };
}

// No auth, no PII: an uptime monitor or Railway's own health check needs
// to be able to call this without a token, and its response must never
// carry anything about a specific account/student regardless.
async function handleHealthz(req, res) {
  let dbOk = false;
  try {
    db.prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    // dbOk already false
  }

  const version = await readPackageVersion();
  const healthy = dbOk;
  writeJson(res, healthy ? 200 : 503, {
    status: healthy ? "ok" : "degraded",
    version,
    gitSha: GIT_SHA,
    db: dbOk,
    backupAgeMinutes: backupAgeMinutes(),
    offsiteBackup: offsiteBackupStatus(),
  });
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

// ─── Static SPA (Railway only — Caddy handles this on the primary host) ───────

const STATIC_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
};

function serveStaticFile(res, absPath) {
  const stat = statSync(absPath);
  const contentType = STATIC_CONTENT_TYPES[path.extname(absPath).toLowerCase()] || "application/octet-stream";
  // The app is built as a single index.html.  Letting a browser cache that
  // shell means an Android PWA can resume an older JavaScript build after a
  // deployment, even though the server already has the current version.
  // The service worker and manifest must be checked fresh for the same reason.
  const fileName = path.basename(absPath);
  const isAppShell = ["index.html", "sw.js", "manifest.json"].includes(fileName);
  // The catalog stays at one fixed URL while each deck ZIP has a versioned
  // filename. Cache the ZIPs, but always revalidate the catalog so a newly
  // published topic is visible as soon as the deployment switches over.
  const isDeckCatalog = fileName === "catalog.json" && path.dirname(absPath).endsWith(`${path.sep}decks`);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": isAppShell || isDeckCatalog ? "no-store, no-cache, must-revalidate" : "public, max-age=86400",
  });
  createReadStream(absPath).pipe(res);
}

// Deck ZIPs and catalog.json live in DEPLOY_FRONTEND_DIR/decks alongside the
// rest of the built SPA (see CLAUDE.md "Deck-zip topics load from their
// downloaded ZIP"), so the generic static-file fallback below would
// otherwise hand out every paid deck's bytes to anyone who knows its URL --
// with no auth, no entitlement check, bypassing /decks/:id/download
// entirely. Free decks are meant to be publicly fetchable this way (that's
// the whole point of "local mode" / no-account installs); paid decks and
// the raw catalog (which lists every paid deck's static URL) are not.
const DECKS_URL_PREFIX = `decks${path.sep}`;

function isPubliclyServableDeckAsset(relative) {
  // `relative` still carries its leading separator here (path.normalize
  // doesn't strip it, and path.join tolerates it) -- strip it before
  // matching the "decks/" prefix, or every request would short-circuit
  // through the `return true` below and skip this check entirely.
  const withoutLeadingSep = relative.replace(/^[/\\]+/, "");
  if (!withoutLeadingSep.startsWith(DECKS_URL_PREFIX)) return true;
  const rest = withoutLeadingSep.slice(DECKS_URL_PREFIX.length);
  // The catalog itself is only ever served through GET /api/decks/catalog,
  // which strips the `url` field from every non-free entry before
  // responding -- the raw file on disk still has every URL, so it must
  // never be handed out verbatim.
  if (rest === "catalog.json") return false;
  let catalog;
  try {
    catalog = loadCatalog();
  } catch {
    return false;
  }
  const entry = (catalog.decks ?? []).find((d) => {
    const entryRelative = (d.url ?? "").replace(/^\.\/decks\//, "");
    return entryRelative === rest.split(path.sep).join("/");
  });
  // An unrecognized filename under decks/ (stale build artifact, directory
  // listing probe, etc.) is refused the same as a paid one -- there is no
  // legitimate reason for a path under decks/ to be servable without a
  // matching free catalog entry.
  return Boolean(entry) && (entry.access ?? "free") === "free";
}

function trySpaFallback(req, res, pathname) {
  if (!SERVE_STATIC || req.method !== "GET") return false;

  // url.pathname is percent-encoded (WHATWG URL never decodes it), so non-ASCII
  // filenames -- e.g. propis dictation audio named after Cyrillic letters --
  // need decoding before hitting the filesystem, or existsSync always misses
  // and every request for them silently falls through to the SPA shell below.
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    // malformed percent-encoding -- fall through to the SPA shell as before
  }
  const relative = path.normalize(decodedPathname).replace(/^([.][.][/\\])+/, "");

  if (!isPubliclyServableDeckAsset(relative)) {
    writeJson(res, 404, { error: "Not found" });
    return true;
  }

  const candidate = path.join(DEPLOY_FRONTEND_DIR, relative);
  if (candidate.startsWith(DEPLOY_FRONTEND_DIR) && existsSync(candidate) && statSync(candidate).isFile()) {
    serveStaticFile(res, candidate);
    return true;
  }

  const indexPath = path.join(DEPLOY_FRONTEND_DIR, "index.html");
  if (!existsSync(indexPath)) return false;
  serveStaticFile(res, indexPath);
  return true;
}

// ─── Router ────────────────────────────────────────────────────────────────────

function resolveAllowedOrigin(req) {
  const origin = req.headers.origin;
  return origin && CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

async function router(req, res) {
  const url = new URL(req.url, "http://localhost");
  const method = req.method.toUpperCase();
  const p = normalizeApiPath(url.pathname);

  applyCors(res, resolveAllowedOrigin(req));

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
    if (method === "POST"   && p === "/heartbeat")                 return await handleHeartbeat(req, res);
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
    { const m = p.match(/^\/admin\/accounts\/([^/]+)\/sessions$/);
      if (method === "GET" && m) return await handleAdminGetAccountSessions(req, res, m[1]); }
    if (method === "POST"   && p === "/admin/account/flags")                       return await handleAdminSetFlags(req, res);
    if (method === "POST"   && p === "/admin/grant")                               return await handleAdminGrant(req, res);
    if (method === "POST"   && p === "/admin/revoke")                              return await handleAdminRevoke(req, res);
    if (method === "POST"   && p === "/admin/verify-account")                      return await handleAdminVerifyAccount(req, res);
    if (method === "GET"  && p === "/admin/promo-codes") return await handleAdminListPromoCodes(req, res);
    if (method === "POST" && p === "/admin/promo-codes") return await handleAdminCreatePromoCode(req, res);

    // Student topic links + concept progress
    if (method === "GET"    && p === "/student-topic-links")      return await handleGetStudentTopicLinks(req, res);
    if (method === "POST"   && p === "/student-topic-links")      return await handleUpsertStudentTopicLink(req, res);
    if (method === "POST"   && p === "/concept-progress")         return await handleUpsertConceptProgress(req, res);

    // Billing
    if (method === "POST" && p === "/billing/checkout") return await handleBillingCheckout(req, res);
    if (method === "POST" && p === "/billing/webhook/stripe")    return await handleStripeWebhook(req, res);
    if (method === "POST" && p === "/billing/webhook/lava-top")  return await handleLavaTopWebhook(req, res);
    if (method === "GET"  && p === "/billing/subscription")      return await handleGetSubscription(req, res);
    if (method === "GET"  && p === "/billing/order-status")      return await handleGetOrderStatus(req, res);
    if (method === "POST" && p === "/billing/validate-code") return await handleValidateCode(req, res);
    if (method === "POST" && p === "/billing/redeem-code")   return await handleRedeemCode(req, res);

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

    // Photos (upload requires auth; read is content-addressable, no auth required)
    if (method === "POST"   && p === "/photos")                   return await handleUploadPhoto(req, res);
    if (method === "GET"    && /^\/photos\/[^/]+$/.test(p))       return await handleGetPhoto(req, res);

    // Version
    if (method === "GET"    && p === "/version")                  return await handleVersion(req, res);
    if (method === "GET"    && p === "/healthz")                  return await handleHealthz(req, res);

    // Legal pages
    { const legalSlug = Object.keys(LEGAL_DOCS).find((slug) => p === `/${slug}`);
      if (method === "GET" && legalSlug) return await handleLegalDoc(req, res, legalSlug); }
    { const legalSlug = Object.keys(LEGAL_DOCS_SL).find((slug) => p === `/sl/${slug}`);
      if (method === "GET" && legalSlug) return await handleLegalDoc(req, res, legalSlug, "sl"); }

    if (!url.pathname.startsWith("/api/") && trySpaFallback(req, res, url.pathname)) return;

    writeJson(res, 404, { error: "Not found" });
  } catch (err) {
    if (err?.status) {
      if (err.status === 413) res.setHeader("Connection", "close");
      writeJson(res, err.status, { error: err.message });
    } else {
      reportError(err, { method, path: p });
      writeJson(res, 500, { error: "Internal server error" });
    }
  }
}

export { router, db };

// Only bind a real listener (and start the backup loop) when this file is
// run directly (`node backend/server.mjs`, exactly what the Dockerfile's
// CMD does) -- not when it's imported, e.g. by backend/tests/*.test.mjs to
// exercise `router` against an isolated in-process HTTP server. Without
// this guard, importing server.mjs for testing would also try to bind
// PORT for real and race whatever's already listening on it.
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  createServer(router).listen(PORT, () => {
    console.log(`Mirocard2 backend running on port ${PORT}`);
  });

  // Railway has no Windows Task Scheduler for hourly SQLite backups, so the
  // running service does it in-process instead. RAILWAY_ENVIRONMENT is
  // injected by Railway itself, so this never runs on the home host.
  if (process.env.RAILWAY_ENVIRONMENT) {
    import("../scripts/railway-backup-loop.mjs")
      .then(({ startBackupLoop }) => startBackupLoop({ dataDir: DATA_DIR }))
      .catch((err) => console.error("[backup] failed to start backup loop:", err));

    import("../scripts/entitlement-reminder-loop.mjs")
      .then(({ startReminderLoop }) => startReminderLoop())
      .catch((err) => console.error("[entitlement-reminder] failed to start reminder loop:", err));
  }
}
