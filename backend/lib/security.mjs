import crypto from "node:crypto";
import { ACCESS_TOKEN_TTL_SEC, ACCOUNT_SECRET, AUTH_SECRET } from "./config.mjs";

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signHmac(content, secret) {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(content).digest());
}

export function createPasswordHash(rawPassword) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(rawPassword, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPasswordHash(rawPassword, storedHash) {
  if (!storedHash?.startsWith("scrypt$")) return false;
  const [, salt, hash] = storedHash.split("$");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(rawPassword, salt, 64);
  const known = Buffer.from(hash, "hex");
  return known.length === candidate.length && crypto.timingSafeEqual(candidate, known);
}

export function createAccessToken(payload, expiresInSec = ACCESS_TOKEN_TTL_SEC) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = signHmac(`${encodedHeader}.${encodedBody}`, AUTH_SECRET);
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export function verifyAccessToken(token) {
  const [encodedHeader, encodedBody, signature] = String(token || "").split(".");
  if (!encodedHeader || !encodedBody || !signature) throw new Error("Invalid token.");
  const expected = signHmac(`${encodedHeader}.${encodedBody}`, AUTH_SECRET);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid token signature.");
  }
  const payload = JSON.parse(base64UrlDecode(encodedBody));
  if (!payload?.sub || !payload?.exp) throw new Error("Invalid token payload.");
  if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("Token expired.");
  return payload;
}

export function computeAdultPinToken(adultPinHash) {
  if (!adultPinHash) return null;
  return crypto.createHmac("sha256", ACCOUNT_SECRET).update(adultPinHash).digest("hex");
}
