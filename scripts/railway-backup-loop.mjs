#!/usr/bin/env node
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { backupSqlite } from "./backup-sqlite.mjs";
import { reportError, trackEvent } from "../backend/lib/observability.mjs";

const HOUR_MS = 60 * 60 * 1000;

// How many backups to keep. They live on the same 5 GB Railway volume as the
// database itself (photos and audio are stored in it), so every copy is a
// full copy of the database: 14 days of hourly copies filled the volume on
// 2026-10-19 and every write -- sync, startup migrations -- failed with
// "database or disk is full". Only the newest few are kept.
export const DEFAULT_KEEP = 3;

const isBackupFile = (name) => /^mirocard-.*\.db$/.test(name);

// Delete all but the newest `keep` backups (and any leftover temp files from
// an interrupted copy). Safe to call before the database is opened.
export function pruneBackups({ dataDir, keep = DEFAULT_KEEP }) {
  const backupDir = path.join(dataDir, "backups");
  let names;
  try { names = readdirSync(backupDir); } catch { return []; }
  const files = names
    .map((name) => ({ name, filePath: path.join(backupDir, name) }))
    .filter(({ name }) => isBackupFile(name) || name.endsWith(".partial"))
    .map((f) => ({ ...f, mtimeMs: statSync(f.filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const backups = files.filter(({ name }) => isBackupFile(name));
  const doomed = [...backups.slice(Math.max(0, keep)), ...files.filter(({ name }) => name.endsWith(".partial"))];
  for (const { name, filePath } of doomed) {
    unlinkSync(filePath);
    console.log(`Pruned old backup: ${name}`);
  }
  return doomed.map(({ name }) => name);
}

export function runBackupOnce({ dataDir, keep = DEFAULT_KEEP }) {
  const dbPath = path.join(dataDir, "mirocard.db");
  const backupDir = path.join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });

  // Make room first: the new copy needs as much space as the database.
  pruneBackups({ dataDir, keep: Math.max(0, keep - 1) });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(backupDir, `mirocard-${stamp}.db`);
  const tmpPath = `${outPath}.partial`;
  try {
    // written under a temp name so a copy cut short (full disk) is never taken for a backup, and is removed
    if (!backupSqlite({ dbPath, outPath: tmpPath })) return; // itself runs PRAGMA integrity_check and throws if it fails
    renameSync(tmpPath, outPath);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    throw err;
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

export function startBackupLoop({ dataDir, keep = DEFAULT_KEEP, intervalMs = HOUR_MS }) {
  runBackupOnceSafely({ dataDir, keep });
  return setInterval(() => runBackupOnceSafely({ dataDir, keep }), intervalMs);
}

if (process.argv[1]?.endsWith("railway-backup-loop.mjs")) {
  const dataDir = process.env.MIROCARD_DATA_DIR || "/data";
  const keep = Number(process.env.BACKUP_KEEP || DEFAULT_KEEP);
  const once = process.argv.includes("--once");

  if (once) {
    runBackupOnce({ dataDir, keep });
  } else {
    startBackupLoop({ dataDir, keep });
  }
}
