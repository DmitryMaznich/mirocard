#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function backupSqlite({ dbPath, outPath }) {
  dbPath = path.resolve(dbPath);
  outPath = path.resolve(outPath);

  if (!existsSync(dbPath)) {
    console.log(`SQLite source not found, skipped: ${dbPath}`);
    return null;
  }

  mkdirSync(path.dirname(outPath), { recursive: true });
  if (existsSync(outPath)) {
    rmSync(outPath, { force: true });
  }

  let db;
  try {
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA busy_timeout = 10000");
    db.exec("PRAGMA wal_checkpoint(PASSIVE)");
    db.exec(`VACUUM INTO ${sqlString(outPath)}`);
  } finally {
    db?.close();
  }

  let backup;
  try {
    backup = new DatabaseSync(outPath);
    const result = backup.prepare("PRAGMA integrity_check").get();
    const value = Object.values(result || {})[0];
    if (value !== "ok") {
      throw new Error(`SQLite integrity_check failed: ${value}`);
    }
  } finally {
    backup?.close();
  }

  const size = statSync(outPath).size;
  console.log(`SQLite backup written: ${outPath} (${size} bytes)`);
  return outPath;
}

if (process.argv[1]?.endsWith("backup-sqlite.mjs")) {
  const args = parseArgs(process.argv.slice(2));
  backupSqlite({
    dbPath: String(args.db || "runtime/data/mirocard.db"),
    outPath: String(args.out || "mirocard.db"),
  });
}
