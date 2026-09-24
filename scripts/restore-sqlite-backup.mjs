#!/usr/bin/env node
// Restores (and proves) a SQLite backup -- for the restore drill and for a
// real recovery. It NEVER touches the live database unless explicitly told
// to replace a path that already exists.
//
//   # list off-site snapshots
//   node scripts/restore-sqlite-backup.mjs --list
//
//   # restore drill: newest off-site snapshot into a scratch file, verify it
//   node scripts/restore-sqlite-backup.mjs --from-s3 latest --out /tmp/restore-drill.db
//
//   # a specific off-site snapshot, or a local file
//   node scripts/restore-sqlite-backup.mjs --from-s3 mirocard/sqlite/mirocard-2026-09-24T10-00-00-000Z.db --out /tmp/r.db
//   node scripts/restore-sqlite-backup.mjs --file /data/backups/mirocard-....db --out /tmp/r.db
//
// Success = exit code 0 and "RESTORE OK": SHA-256 matches the recorded
// value (off-site), PRAGMA integrity_check = ok, and the core tables are
// readable (row counts printed). Any other outcome exits non-zero.
//
// Off-site credentials come only from BACKUP_S3_* environment variables.

import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { OFFSITE_BACKUP } from "../backend/lib/config.mjs";
import { createS3Client, downloadVerified, isOffsiteConfigured } from "../backend/lib/backup/s3-client.mjs";

const CORE_TABLES = ["accounts", "students", "sessions", "photos", "photo_owners", "orders", "entitlements"];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

/** Opens a restored file read-only and proves it is a sound Mirocard DB. */
export function verifyRestoredDb(filePath) {
  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = Object.values(db.prepare("PRAGMA integrity_check").get() ?? {})[0];
    if (integrity !== "ok") throw new Error(`PRAGMA integrity_check failed: ${integrity}`);
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    if (!tables.has("accounts")) throw new Error("restored file has no accounts table -- not a Mirocard database");
    const counts = {};
    for (const t of CORE_TABLES) {
      if (tables.has(t)) counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n;
    }
    return { integrity, counts };
  } finally {
    db.close();
  }
}

export async function restoreBackup({ fromS3, file, out, force = false, config = OFFSITE_BACKUP, fetchImpl }) {
  if (!out) throw new Error("--out <path> is required");
  const outPath = path.resolve(out);
  if (existsSync(outPath) && !force) {
    throw new Error(`${outPath} already exists -- refusing to overwrite (pass --force only if you really mean to replace it)`);
  }
  mkdirSync(path.dirname(outPath), { recursive: true });
  const tmpPath = `${outPath}.restoring-${process.pid}`;
  let source;
  try {
    if (fromS3) {
      if (!isOffsiteConfigured(config)) throw new Error("BACKUP_S3_* environment variables are not set");
      const client = createS3Client(config, fetchImpl ? { fetchImpl } : {});
      let key = fromS3;
      if (key === "latest" || key === true) {
        const keys = (await client.listKeys(config.prefix)).filter((k) => k.endsWith(".db"));
        if (!keys.length) throw new Error(`no snapshots found under ${config.prefix}`);
        key = keys.at(-1); // names are timestamps: lexical order = chronological
      }
      const { body, sha256 } = await downloadVerified(client, key);
      writeFileSync(tmpPath, body);
      source = { kind: "s3", key, sha256, size: body.length };
    } else if (file) {
      copyFileSync(path.resolve(file), tmpPath);
      source = { kind: "file", file: path.resolve(file) };
    } else {
      throw new Error("pass --from-s3 <key|latest> or --file <path>");
    }
    const verification = verifyRestoredDb(tmpPath);
    renameSync(tmpPath, outPath);
    return { out: outPath, source, ...verification };
  } finally {
    rmSync(tmpPath, { force: true });
  }
}

if (process.argv[1]?.endsWith("restore-sqlite-backup.mjs")) {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args.list) {
      if (!isOffsiteConfigured(OFFSITE_BACKUP)) throw new Error("BACKUP_S3_* environment variables are not set");
      const keys = await createS3Client(OFFSITE_BACKUP).listKeys(OFFSITE_BACKUP.prefix);
      for (const k of keys) console.log(k);
      console.log(`${keys.length} snapshot(s) under ${OFFSITE_BACKUP.prefix}`);
    } else {
      const result = await restoreBackup({ fromS3: args["from-s3"], file: args.file, out: args.out, force: Boolean(args.force) });
      console.log(JSON.stringify(result, null, 2));
      console.log("RESTORE OK");
    }
  } catch (err) {
    console.error(`RESTORE FAILED: ${err.message}`);
    process.exitCode = 1;
  }
}
