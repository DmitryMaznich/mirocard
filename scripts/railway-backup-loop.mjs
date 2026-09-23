#!/usr/bin/env node
// Hourly SQLite snapshots for the Railway service (runs in-process, see
// backend/server.mjs). Each cycle:
//   1. VACUUM INTO a new snapshot + PRAGMA integrity_check (backup-sqlite.mjs)
//   2. local rotation: newest BACKUP_KEEP_HOURLY, then one per day for
//      BACKUP_KEEP_DAILY_DAYS (backend/lib/backup/rotation.mjs)
//   3. every BACKUP_S3_EVERY_HOURS, copy the verified snapshot off-site to
//      an S3-compatible bucket and verify size + SHA-256
//      (backend/lib/backup/s3-client.mjs). Not configured = warning, not
//      failure: the app keeps running, and says so loudly once per start.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { backupSqlite } from "./backup-sqlite.mjs";
import { reportError, trackEvent } from "../backend/lib/observability.mjs";
import { rotateBackups, snapshotName } from "../backend/lib/backup/rotation.mjs";
import { createS3Client, isOffsiteConfigured, uploadVerified } from "../backend/lib/backup/s3-client.mjs";
import { BACKUP_KEEP_HOURLY, BACKUP_KEEP_DAILY_DAYS, OFFSITE_BACKUP } from "../backend/lib/config.mjs";

const HOUR_MS = 60 * 60 * 1000;
const STATE_FILE = "offsite-state.json"; // never matches the snapshot pattern, so rotation ignores it

export function runBackupOnce({ dataDir, keepHourly = BACKUP_KEEP_HOURLY, keepDailyDays = BACKUP_KEEP_DAILY_DAYS, now = new Date() }) {
  const dbPath = path.join(dataDir, "mirocard.db");
  const backupDir = path.join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });

  const outPath = path.join(backupDir, snapshotName(now));
  const written = backupSqlite({ dbPath, outPath }); // runs PRAGMA integrity_check, throws if it fails

  const removed = rotateBackups(backupDir, { now: now.getTime(), keepHourly, keepDailyDays });
  for (const name of removed) console.log(`Pruned old backup: ${name}`);
  trackEvent("backup_completed", { removed: removed.length });
  return written;
}

function readState(backupDir) {
  try { return JSON.parse(readFileSync(path.join(backupDir, STATE_FILE), "utf8")); } catch { return {}; }
}

/**
 * Uploads the snapshot off-site if due. Returns a structured result;
 * never throws for "not configured" -- that is logged and reported.
 */
export async function maybeUploadOffsite({ snapshotPath, backupDir, config = OFFSITE_BACKUP, now = new Date(), fetchImpl }) {
  if (!isOffsiteConfigured(config)) return { status: "not_configured" };
  if (!snapshotPath || !existsSync(snapshotPath)) return { status: "no_snapshot" };
  const state = readState(backupDir);
  const dueAfter = state.lastUploadAt ? Date.parse(state.lastUploadAt) + config.everyHours * HOUR_MS : 0;
  if (now.getTime() < dueAfter) return { status: "not_due", next: new Date(dueAfter).toISOString() };

  const client = createS3Client(config, fetchImpl ? { fetchImpl } : {});
  const key = `${config.prefix}${path.basename(snapshotPath)}`;
  const result = await uploadVerified(client, key, readFileSync(snapshotPath));
  writeFileSync(path.join(backupDir, STATE_FILE), JSON.stringify({ lastUploadAt: now.toISOString(), lastKey: key, size: result.size, sha256: result.sha256 }, null, 2));
  console.log(JSON.stringify({ level: "info", scope: "offsite-backup", msg: "uploaded and verified", key, size: result.size }));
  trackEvent("offsite_backup_uploaded", { size: result.size });
  return { status: "uploaded", ...result };
}

export function warnIfOffsiteNotConfigured(config = OFFSITE_BACKUP) {
  if (isOffsiteConfigured(config)) return false;
  // Structured, grep-able, and forwarded to the error hook: running without
  // an off-site copy means one volume failure loses the DB and every backup.
  console.warn(JSON.stringify({
    level: "warn", scope: "offsite-backup", code: "offsite_backup_not_configured",
    msg: "Off-site backup is NOT configured: set BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY. Local snapshots live on the same volume as the database.",
  }));
  trackEvent("offsite_backup_not_configured", {});
  reportError(new Error("Off-site backup is not configured"), { scope: "offsite-backup", code: "offsite_backup_not_configured" });
  return true;
}

// A throw from a cycle (failed integrity_check, disk error, S3 outage) must
// never escape the timer callback: an uncaught exception there would crash
// the whole backend. Report it and retry on the next tick.
export async function runBackupCycleSafely(options) {
  let snapshotPath;
  try {
    snapshotPath = runBackupOnce(options);
  } catch (err) {
    reportError(err, { scope: "railway-backup-loop" });
    return;
  }
  try {
    await maybeUploadOffsite({ snapshotPath, backupDir: path.join(options.dataDir, "backups"), ...(options.offsite ? { config: options.offsite } : {}), fetchImpl: options.fetchImpl });
  } catch (err) {
    reportError(err, { scope: "offsite-backup" });
  }
}

export function startBackupLoop({ dataDir, intervalMs = HOUR_MS, ...rest }) {
  warnIfOffsiteNotConfigured(rest.offsite);
  runBackupCycleSafely({ dataDir, ...rest });
  return setInterval(() => { runBackupCycleSafely({ dataDir, ...rest }); }, intervalMs);
}

if (process.argv[1]?.endsWith("railway-backup-loop.mjs")) {
  const dataDir = process.env.MIROCARD_DATA_DIR || "/data";
  if (process.argv.includes("--once")) {
    await runBackupCycleSafely({ dataDir });
  } else {
    startBackupLoop({ dataDir });
  }
}
