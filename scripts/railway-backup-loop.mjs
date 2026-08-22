#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MIROCARD_DATA_DIR || "/data";
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const ONCE = process.argv.includes("--once");

function runBackup() {
  const dbPath = path.join(DATA_DIR, "mirocard.db");
  const backupDir = path.join(DATA_DIR, "backups");
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(backupDir, `mirocard-${stamp}.db`);

  execFileSync(
    "node",
    [path.join(__dirname, "backup-sqlite.mjs"), "--db", dbPath, "--out", outPath],
    { stdio: "inherit" }
  );

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(backupDir)) {
    const filePath = path.join(backupDir, name);
    if (statSync(filePath).mtimeMs < cutoff) {
      unlinkSync(filePath);
      console.log(`Pruned old backup: ${name}`);
    }
  }
}

if (ONCE) {
  runBackup();
  process.exit(0);
} else {
  runBackup();
  setInterval(runBackup, 60 * 60 * 1000); // hourly
}
