// Measures the two synchronous operations that block the whole server:
// password hashing (every register/login) and the hourly SQLite backup.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createPasswordHash } from "../../backend/lib/security.mjs";
import { backupSqlite } from "../backup-sqlite.mjs";
import { initDb } from "../../backend/lib/db.mjs";
import { createAccount } from "../../backend/lib/account-repository.mjs";

const t = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };

const hashes = Array.from({ length: 20 }, () => t(() => createPasswordHash("correct horse battery")));
hashes.sort((a, b) => a - b);
console.log(`scryptSync per call: p50 ${hashes[10].toFixed(1)} ms, max ${hashes[19].toFixed(1)} ms`);
console.log(`→ 300 signups in 60 s = ${(300 * hashes[10] / 1000).toFixed(1)} s of fully blocked event loop`);

const dir = mkdtempSync(path.join(tmpdir(), "mirocard-bench-"));
const dbPath = path.join(dir, "mirocard.db");
const db = initDb(dbPath);
for (const n of [1000, 5000]) {
  const have = db.prepare("SELECT COUNT(*) c FROM accounts").get().c;
  for (let i = have; i < n; i++) createAccount(db, { email: `b${i}-${randomUUID()}@x.test`, passwordHash: "scrypt$x$y", firstName: "B", lastName: "", role: "parent", referralSource: "other", consentPersonalDataAt: new Date().toISOString() });
  const ms = t(() => backupSqlite({ dbPath, outPath: path.join(dir, `b-${n}.db`) }));
  console.log(`backup with ${n} accounts: ${ms.toFixed(0)} ms blocked`);
}
db.close?.();
rmSync(dir, { recursive: true, force: true });
