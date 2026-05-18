import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");

function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export const DATA_DIR =
  readEnv("MIROCARD_DATA_DIR") || path.resolve(BACKEND_DIR, "../runtime/data");

export const DB_PATH = path.join(DATA_DIR, "mirocard.db");
export const PORT = Number(readEnv("PORT") || 3012);
export const ACCESS_TOKEN_TTL_SEC = Number(
  readEnv("ACCESS_TOKEN_TTL_SEC") || 60 * 60 * 24 * 30  // 30 days
);
export const AUTH_SECRET =
  readEnv("AUTH_SECRET") || "dev-auth-secret-change-me";
export const ACCOUNT_SECRET =
  readEnv("ACCOUNT_SECRET") || "dev-account-secret-change-me";
export const DEPLOY_TOKEN =
  readEnv("MIROCARD_DEPLOY_TOKEN") || "mirocard-deploy-2026";
export const DEPLOY_FRONTEND_DIR =
  readEnv("MIROCARD_DEPLOY_FRONTEND_DIR") ||
  path.resolve(BACKEND_DIR, "../dist");

// Email (password reset)
export const SMTP_HOST    = readEnv("SMTP_HOST");
export const SMTP_PORT    = Number(readEnv("SMTP_PORT") || 587);
export const SMTP_USER    = readEnv("SMTP_USER");
export const SMTP_PASS    = readEnv("SMTP_PASS");
export const SMTP_FROM    = readEnv("SMTP_FROM") || "Mirocard <noreply@mirocard.app>";
export const APP_BASE_URL = readEnv("APP_BASE_URL") || "http://localhost:5174";

// Anthropic
export const ANTHROPIC_API_KEY = readEnv("ANTHROPIC_API_KEY");

// Push
export const VAPID_PUBLIC_KEY  = readEnv("VAPID_PUBLIC_KEY");
export const VAPID_PRIVATE_KEY = readEnv("VAPID_PRIVATE_KEY");
export const PUSH_SUBJECT      = readEnv("PUSH_SUBJECT") || "mailto:hello@mirocard.app";
