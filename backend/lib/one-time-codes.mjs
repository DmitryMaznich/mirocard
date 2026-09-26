// Short-lived single-use codes that carry a Google sign-in from the callback
// (a top-level form POST from Google) to the SPA without putting a session
// token in the URL. Only a hash of the code is stored.
import { randomBytes, createHash } from "node:crypto";

const hash = (raw) => createHash("sha256").update(raw).digest("hex");

export function createOneTimeCode(db, { kind, payload, ttlMs = 5 * 60 * 1000, now = Date.now() }) {
  const raw = randomBytes(24).toString("base64url");
  db.prepare("DELETE FROM one_time_codes WHERE expires_at < ?").run(now);
  db.prepare("INSERT INTO one_time_codes (code_hash, kind, payload, expires_at) VALUES (?, ?, ?, ?)")
    .run(hash(raw), kind, JSON.stringify(payload), now + ttlMs);
  return raw;
}

// kind === null accepts any kind (the exchange endpoint takes both login and signup codes).
export function consumeOneTimeCode(db, raw, kind, now = Date.now()) {
  const row = db.prepare("SELECT * FROM one_time_codes WHERE code_hash = ?").get(hash(String(raw || "")));
  if (!row || (kind !== null && row.kind !== kind) || row.used_at || row.expires_at < now) return null;
  const upd = db.prepare("UPDATE one_time_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL").run(now, row.code_hash);
  if (upd.changes !== 1) return null;
  return { kind: row.kind, payload: JSON.parse(row.payload) };
}
