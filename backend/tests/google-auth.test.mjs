import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { verifyGoogleIdToken } from "../lib/google-auth.mjs";
import { CLIENT, startJwks, makeIdToken } from "./helpers/google-token.mjs";

const jwks = await startJwks();
test.after(() => jwks.close());
const NOW = 1_800_000_100;
const tok = (claims, o = {}) => makeIdToken(claims, { nowSec: NOW - 100, ...o });
const opts = { clientId: CLIENT, jwksUrl: jwks.url, now: () => NOW * 1000 };

test("valid token", async () => {
  const r = await verifyGoogleIdToken(tok({}), opts);
  assert.deepEqual(r, { sub: "g-123", email: "g@example.test", emailVerified: true, givenName: "Галя", familyName: "Г" });
});
test("email is normalized to lower case", async () => {
  assert.equal((await verifyGoogleIdToken(tok({ email: " Mixed@Example.TEST " }), opts)).email, "mixed@example.test");
});
test("rejects wrong audience", async () => {
  await assert.rejects(verifyGoogleIdToken(tok({ aud: "other" }), opts), { code: "bad_audience" });
});
test("rejects expired", async () => {
  await assert.rejects(verifyGoogleIdToken(tok({ exp: NOW - 1 }), opts), { code: "expired" });
});
test("rejects unverified email", async () => {
  await assert.rejects(verifyGoogleIdToken(tok({ email_verified: false }), opts), { code: "email_unverified" });
});
test("rejects bad issuer", async () => {
  await assert.rejects(verifyGoogleIdToken(tok({ iss: "https://evil.example" }), opts), { code: "bad_issuer" });
});
test("rejects signature by another key", async () => {
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyGoogleIdToken(tok({}, { key: other }), opts), { code: "bad_signature" });
});
test("rejects unknown kid", async () => {
  await assert.rejects(verifyGoogleIdToken(tok({}, { kid: "nope" }), opts), { code: "unknown_key" });
});
test("rejects malformed", async () => {
  await assert.rejects(verifyGoogleIdToken("a.b", opts), { code: "malformed" });
});
