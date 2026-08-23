#!/usr/bin/env node
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { backupSqlite } from "./backup-sqlite.mjs";

const HOUR_MS = 60 * 60 * 1000;

export function runBackupOnce({ dataDir, retentionDays = 14 }) {
  const dbPath = path.join(dataDir, "mirocard.db");
  const backupDir = path.join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(backupDir, `mirocard-${stamp}.db`);
  backupSqlite({ dbPath, outPath });

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(backupDir)) {
    const filePath = path.join(backupDir, name);
    if (statSync(filePath).mtimeMs < cutoff) {
      unlinkSync(filePath);
      console.log(`Pruned old backup: ${name}`);
    }
  }
}

export function startBackupLoop({ dataDir, retentionDays = 14, intervalMs = HOUR_MS }) {
  runBackupOnce({ dataDir, retentionDays });
  return setInterval(() => runBackupOnce({ dataDir, retentionDays }), intervalMs);
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
