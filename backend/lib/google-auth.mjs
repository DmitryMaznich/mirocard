// Verifies a Google Identity Services ID token (RS256 JWT) without external
// dependencies. Checks: signature against Google's published keys, issuer,
// audience (our client id), expiry, and that Google verified the email.
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const cache = new Map(); // jwksUrl -> { keys: Map<kid, KeyObject>, expiresAt }

function fail(code) {
  const e = new Error(`google id token: ${code}`);
  e.code = code;
  return e;
}

async function getKey(jwksUrl, kid, now) {
  let entry = cache.get(jwksUrl);
  // Refetch on expiry and on an unknown kid (Google rotates keys).
  if (!entry || entry.expiresAt <= now || !entry.keys.has(kid)) {
    const res = await fetch(jwksUrl);
    if (!res.ok) throw fail("unknown_key");
    const { keys = [] } = await res.json();
    const maxAge = Number((res.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 3600);
    entry = {
      keys: new Map(keys.map((k) => [k.kid, createPublicKey({ key: k, format: "jwk" })])),
      expiresAt: now + maxAge * 1000,
    };
    cache.set(jwksUrl, entry);
  }
  const key = entry.keys.get(kid);
  if (!key) throw fail("unknown_key");
  return key;
}

export async function verifyGoogleIdToken(idToken, { clientId, jwksUrl, now = () => Date.now() }) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw fail("malformed");
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw fail("malformed");
  }
  if (header.alg !== "RS256" || !header.kid) throw fail("malformed");

  const key = await getKey(jwksUrl, header.kid, now());
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
  if (!cryptoVerify("RSA-SHA256", signed, key, Buffer.from(parts[2], "base64url"))) throw fail("bad_signature");
  if (!ISSUERS.has(claims.iss)) throw fail("bad_issuer");
  if (claims.aud !== clientId) throw fail("bad_audience");
  if (!(Number(claims.exp) * 1000 > now())) throw fail("expired");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw fail("email_unverified");

  return {
    sub: String(claims.sub),
    email: String(claims.email).trim().toLowerCase(),
    emailVerified: true,
    givenName: String(claims.given_name || ""),
    familyName: String(claims.family_name || ""),
  };
}
