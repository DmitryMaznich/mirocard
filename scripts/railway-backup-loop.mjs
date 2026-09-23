#!/usr/bin/env node
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { backupSqlite } from "./backup-sqlite.mjs";
import { reportError, trackEvent } from "../backend/lib/observability.mjs";

const HOUR_MS = 60 * 60 * 1000;

export function runBackupOnce({ dataDir, retentionDays = 14 }) {
  const dbPath = path.join(dataDir, "mirocard.db");
  const backupDir = path.join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(backupDir, `mirocard-${stamp}.db`);
  backupSqlite({ dbPath, outPath }); // itself runs PRAGMA integrity_check and throws if it fails

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(backupDir)) {
    const filePath = path.join(backupDir, name);
    if (statSync(filePath).mtimeMs < cutoff) {
      unlinkSync(filePath);
      console.log(`Pruned old backup: ${name}`);
    }
  }
  trackEvent("backup_completed", {});
}

// A throw from runBackupOnce (a real one has happened before: a failed
// integrity_check, or a disk/fs error) used to propagate straight out of
// the setInterval callback below with nothing catching it -- Node treats
// an uncaught synchronous throw in a timer callback as an uncaught
// exception, which crashes the whole backend process. One failed hourly
// backup attempt must never take the live service down with it; it should
// just be reported and retried on the next tick.
function runBackupOnceSafely(options) {
  try {
    runBackupOnce(options);
  } catch (err) {
    reportError(err, { scope: "railway-backup-loop" });
  }
}

export function startBackupLoop({ dataDir, retentionDays = 14, intervalMs = HOUR_MS }) {
  runBackupOnceSafely({ dataDir, retentionDays });
  return setInterval(() => runBackupOnceSafely({ dataDir, retentionDays }), intervalMs);
}

if (process.argv[1]?.endsWith("railway-backup-loop.mjs")) {
  const dataDir = process.env.MIROCARD_DATA_DIR || "/data";
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
  const once = process.argv.includes("--once");

  if (once) {
    runBackupOnce({ dataDir, retentionDays });
  } else {
    startBackupLoop({ dataDir, retentionDays });
  }
}
