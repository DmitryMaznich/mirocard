import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

// RAILWAY_ENVIRONMENT is injected by Railway itself and is already trusted
// elsewhere in this codebase as the "are we really running in production"
// signal (see scripts/railway-backup-loop.mjs, scripts/entitlement-reminder-loop.mjs)
// -- reused here rather than NODE_ENV, which the frontend build sets to
// "production" too and could make this fire somewhere it shouldn't.
const IS_RAILWAY_PRODUCTION = Boolean(readEnv("RAILWAY_ENVIRONMENT"));

// A secret that silently falls back to a hardcoded default is only "secret"
// until someone reads the source -- which anyone can, since this is a
// public-ish open-source-shaped repo. Previously every one of these had an
// insecure default with no check that a real value was ever set in
// production, so a misconfigured Railway deploy would start up fine and
// serve real traffic signed with e.g. "dev-admin-token-change-me". Throwing
// here instead means a missing required secret is a deploy that never comes
// up, not a silent security hole discovered later.
function requiredInProduction(name, fallback) {
  const value = readEnv(name);
  if (value) return value;
  if (IS_RAILWAY_PRODUCTION) {
    throw new Error(`FATAL: ${name} must be set in the Railway environment -- refusing to start without it (no insecure default is used in production).`);
  }
  return fallback;
}

export const DATA_DIR =
  readEnv("MIROCARD_DATA_DIR") || path.resolve(BACKEND_DIR, "../runtime/data");

export const DB_PATH = path.join(DATA_DIR, "mirocard.db");
export const PORT = Number(readEnv("PORT") || 3012);
export const ACCESS_TOKEN_TTL_SEC = Number(
  readEnv("ACCESS_TOKEN_TTL_SEC") || 60 * 60 * 24 * 30  // 30 days
);
export const AUTH_SECRET = requiredInProduction("AUTH_SECRET", "dev-auth-secret-change-me");
export const ACCOUNT_SECRET = requiredInProduction("ACCOUNT_SECRET", "dev-account-secret-change-me");
export const DEPLOY_TOKEN = requiredInProduction("MIROCARD_DEPLOY_TOKEN", "mirocard-deploy-2026");
export const DEPLOY_FRONTEND_DIR =
  readEnv("MIROCARD_DEPLOY_FRONTEND_DIR") ||
  path.resolve(BACKEND_DIR, "../dist");

// Only Railway (no Caddy in front) needs the backend to serve the built SPA itself.
export const SERVE_STATIC = readEnv("SERVE_STATIC") === "1";

// Email (password reset, verification, purchase/promo confirmation, expiry
// reminders) — sent via Resend's HTTPS API, not SMTP: Railway blocks
// outbound SMTP on the Hobby plan, so a raw SMTP client can never connect
// regardless of which mail server it targets. Without a real key,
// lib/mailer.mjs silently console.logs instead of sending -- fine for local
// dev, a genuine outage (nobody gets their verification/reset/purchase
// email) if it happened unnoticed in production, hence required here.
export const RESEND_API_KEY = requiredInProduction("RESEND_API_KEY", "");
export const SMTP_FROM      = readEnv("SMTP_FROM") || "Mironium <noreply@mironium.com>";
export const APP_BASE_URL   = readEnv("APP_BASE_URL") || "http://localhost:5174";

// Admin
export const ADMIN_TOKEN = requiredInProduction("MIROCARD_ADMIN_TOKEN", "dev-admin-token-change-me");

// Anthropic
export const ANTHROPIC_API_KEY = readEnv("ANTHROPIC_API_KEY");

// Push
export const VAPID_PUBLIC_KEY  = readEnv("VAPID_PUBLIC_KEY");
export const VAPID_PRIVATE_KEY = readEnv("VAPID_PRIVATE_KEY");
export const PUSH_SUBJECT      = readEnv("PUSH_SUBJECT") || "mailto:hello@mirocard.app";

// Legal docs — "draft" (the default) means the launch checklist in
// docs/legal-launch-inputs.md hasn't been signed off yet. handleBillingCheckout
// refuses to create a real order while this is "draft", so a commercial
// checkout can never go live pointing at unreviewed legal text. Set this to
// a real version string (e.g. an ISO date the docs were approved) once
// product/legal have signed off -- see docs/legal-launch-inputs.md.
export const LEGAL_DOCS_VERSION = readEnv("LEGAL_DOCS_VERSION") || "draft";

// Billing — Stripe (card rail), the only rail this launch relies on (see
// docs/commercial-launch-runbook.md §5 on Lava Top being unverified).
// Required in production only once checkout is enabled (LEGAL_DOCS_VERSION
// set to a real version): while it's "draft", handleBillingCheckout refuses
// every order, so the keys are unused -- and production ran without them
// before this was added, so requiring them unconditionally would crash the
// first deploy. Flipping LEGAL_DOCS_VERSION without the keys still fails
// startup loudly instead of letting checkout 500.
const CHECKOUT_ENABLED = LEGAL_DOCS_VERSION !== "draft";
export const STRIPE_SECRET_KEY     = CHECKOUT_ENABLED ? requiredInProduction("STRIPE_SECRET_KEY", "") : readEnv("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = CHECKOUT_ENABLED ? requiredInProduction("STRIPE_WEBHOOK_SECRET", "") : readEnv("STRIPE_WEBHOOK_SECRET");

// Billing — Lava Top (Mir/SBP rail). Deliberately NOT required-in-production:
// its integration is unverified against Lava Top's real API (see
// billing-providers/lava-top.mjs's own top-of-file note) and this launch
// can run on the Stripe rail alone. A production deploy without these set
// just means the "МИР / СБП" payment method 502s if someone tries it,
// rather than the whole service refusing to start over an optional rail.
export const LAVA_TOP_API_KEY         = readEnv("LAVA_TOP_API_KEY");
export const LAVA_TOP_WEBHOOK_SECRET  = readEnv("LAVA_TOP_WEBHOOK_SECRET");


// CORS — see lib/http.mjs. Comma-separated list of allowed origins;
// defaults to the production app origin plus local dev ports so a missing
// env var doesn't accidentally open this back up to "*". Set
// CORS_ALLOWED_ORIGINS explicitly in Railway if the real production origin
// differs.
export const CORS_ALLOWED_ORIGINS = (readEnv("CORS_ALLOWED_ORIGINS") || "https://app.mironium.com,http://localhost:5174,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// ─── Photos ──────────────────────────────────────────────────────────────────
// Every user photo (student, close adults, "Мои люди", instruction steps) is
// decoded and re-encoded server-side by lib/photo-normalizer.mjs; these are
// the limits it enforces. All overridable via env, defaults are the
// production values.
function readIntEnv(name, fallback) {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number, got "${raw}"`);
  }
  return Math.floor(value);
}

const KIB = 1024;
const MIB = 1024 * KIB;

export const PHOTO_LIMITS = Object.freeze({
  // Raw request body for POST /photos (and the decoded size of any single
  // data: URL inside a sync operation).
  maxInputBytes:      readIntEnv("PHOTO_MAX_INPUT_BYTES", 10 * MIB),
  // Decompression-bomb guard, checked by libvips before decoding pixels.
  maxInputPixels:     readIntEnv("PHOTO_MAX_INPUT_PIXELS", 16_000_000),
  maxLongSide:        readIntEnv("PHOTO_MAX_LONG_SIDE", 1440),
  minLongSide:        readIntEnv("PHOTO_MIN_LONG_SIDE", 1024),
  startQuality:       readIntEnv("PHOTO_WEBP_QUALITY", 84),
  minQuality:         readIntEnv("PHOTO_WEBP_MIN_QUALITY", 60),
  targetOutputBytes:  readIntEnv("PHOTO_TARGET_OUTPUT_BYTES", 550 * KIB),
  maxOutputBytes:     readIntEnv("PHOTO_MAX_OUTPUT_BYTES", 650 * KIB),
});

export const MAX_PHOTOS_PER_ACCOUNT = readIntEnv("MAX_PHOTOS_PER_ACCOUNT", 12);
export const MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT = readIntEnv("MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT", 6 * MIB);
// A photo the account no longer references anywhere (replaced/deleted) stops
// counting toward its quota after this grace period. The grace keeps a
// just-uploaded photo (POST /photos returns the URL before the client saves
// the record that references it) counted, so it can't be used to bypass the
// quota.
export const PHOTO_UNREFERENCED_GRACE_HOURS = readIntEnv("PHOTO_UNREFERENCED_GRACE_HOURS", 24);
// Upper bound for any JSON request body (sync batches can carry several
// embedded photos). Previously unbounded.
export const MAX_JSON_BODY_BYTES = readIntEnv("MAX_JSON_BODY_BYTES", 24 * MIB);

// ─── Backups ─────────────────────────────────────────────────────────────────
// Local rotation on the Railway volume (scripts/railway-backup-loop.mjs):
// newest N hourly snapshots, then at most one per day for D more days.
export const BACKUP_KEEP_HOURLY = readIntEnv("BACKUP_KEEP_HOURLY", 24);
export const BACKUP_KEEP_DAILY_DAYS = readIntEnv("BACKUP_KEEP_DAILY_DAYS", 14);
// Optional off-site copy to any S3-compatible bucket (AWS S3, Cloudflare R2,
// Backblaze B2, ...). Unset = off-site disabled, logged as a warning.
export const OFFSITE_BACKUP = Object.freeze({
  endpoint:        readEnv("BACKUP_S3_ENDPOINT"),        // e.g. https://<account>.r2.cloudflarestorage.com
  region:          readEnv("BACKUP_S3_REGION") || "auto",
  bucket:          readEnv("BACKUP_S3_BUCKET"),
  prefix:          readEnv("BACKUP_S3_PREFIX") || "mirocard/sqlite/",
  accessKeyId:     readEnv("BACKUP_S3_ACCESS_KEY_ID"),
  secretAccessKey: readEnv("BACKUP_S3_SECRET_ACCESS_KEY"),
  // Upload one hourly snapshot off-site every N hours (default: every 6h).
  everyHours:      readIntEnv("BACKUP_S3_EVERY_HOURS", 6),
});
