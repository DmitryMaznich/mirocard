// Test-only Google ID token factory: our own RSA key served from a local JWKS,
// so verification runs the real code path without talking to Google.
import { createServer } from "node:http";
import { generateKeyPairSync, sign as cryptoSign } from "node:crypto";

export const CLIENT = "test-client.apps.googleusercontent.com";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };

export async function startJwks() {
  const srv = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "max-age=60" });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${srv.address().port}/certs`, close: () => srv.close() };
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function makeIdToken(claims = {}, { kid = "k1", key = privateKey, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const head = b64({ alg: "RS256", kid, typ: "JWT" });
  const body = b64({
    iss: "https://accounts.google.com", aud: CLIENT, sub: "g-123", email: "g@example.test", email_verified: true,
    given_name: "Галя", family_name: "Г", iat: nowSec, exp: nowSec + 3600, ...claims,
  });
  const sig = cryptoSign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url");
  return `${head}.${body}.${sig}`;
}
