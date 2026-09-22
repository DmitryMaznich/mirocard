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

// Billing — Stripe (card rail). Required in production: it's the only
// payment rail this launch actually relies on (see
// docs/commercial-launch-runbook.md §5 on Lava Top being unverified).
export const STRIPE_SECRET_KEY     = requiredInProduction("STRIPE_SECRET_KEY", "");
export const STRIPE_WEBHOOK_SECRET = requiredInProduction("STRIPE_WEBHOOK_SECRET", "");

// Billing — Lava Top (Mir/SBP rail). Deliberately NOT required-in-production:
// its integration is unverified against Lava Top's real API (see
// billing-providers/lava-top.mjs's own top-of-file note) and this launch
// can run on the Stripe rail alone. A production deploy without these set
// just means the "МИР / СБП" payment method 502s if someone tries it,
// rather than the whole service refusing to start over an optional rail.
export const LAVA_TOP_API_KEY         = readEnv("LAVA_TOP_API_KEY");
export const LAVA_TOP_WEBHOOK_SECRET  = readEnv("LAVA_TOP_WEBHOOK_SECRET");

// Legal docs — "draft" (the default) means the launch checklist in
// docs/legal-launch-inputs.md hasn't been signed off yet. handleBillingCheckout
// refuses to create a real order while this is "draft", so a commercial
// checkout can never go live pointing at unreviewed legal text. Set this to
// a real version string (e.g. an ISO date the docs were approved) once
// product/legal have signed off -- see docs/legal-launch-inputs.md.
export const LEGAL_DOCS_VERSION = readEnv("LEGAL_DOCS_VERSION") || "draft";

// CORS — see lib/http.mjs. Comma-separated list of allowed origins;
// defaults to the production app origin plus local dev ports so a missing
// env var doesn't accidentally open this back up to "*". Set
// CORS_ALLOWED_ORIGINS explicitly in Railway if the real production origin
// differs.
export const CORS_ALLOWED_ORIGINS = (readEnv("CORS_ALLOWED_ORIGINS") || "https://app.mironium.com,http://localhost:5174,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
