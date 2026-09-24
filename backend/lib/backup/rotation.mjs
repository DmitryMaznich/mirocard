// Local retention for SQLite snapshots on the Railway volume.
//
// Keeps the newest `keepHourly` snapshots, then at most one per UTC day for
// the `keepDailyDays` days before that, and deletes the rest -- about 38
// files instead of 14 days x 24 = 336 full copies. Only files whose name
// exactly matches our own snapshot pattern, sitting directly in the backup
// directory as regular files (not symlinks), are ever considered: anything
// else in the directory is left alone.

import { lstatSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";

// mirocard-2026-09-23T14-13-55-330Z.db (what runBackupOnce writes)
const SNAPSHOT_RE = /^mirocard-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.db$/;

export function snapshotName(date = new Date()) {
  return `mirocard-${date.toISOString().replace(/[:.]/g, "-")}.db`;
}

export function parseSnapshotTime(name) {
  const m = SNAPSHOT_RE.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms] = m;
  const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Pure: decides which snapshot names to keep/delete. Unknown names are never listed. */
export function planRotation(names, { now = Date.now(), keepHourly = 24, keepDailyDays = 14 } = {}) {
  const snaps = names
    .map((name) => ({ name, time: parseSnapshotTime(name) }))
    .filter((s) => s.time !== null)
    .sort((a, b) => b.time - a.time);
  const keep = new Set(snaps.slice(0, keepHourly).map((s) => s.name));
  const hourlyFloor = snaps.length > keepHourly ? snaps[keepHourly - 1]?.time ?? now : now;
  const dailyCutoff = Math.min(now, hourlyFloor) - keepDailyDays * 86_400_000;
  const seenDays = new Set();
  for (const s of snaps.slice(keepHourly)) {
    if (s.time < dailyCutoff) continue;
    const day = new Date(s.time).toISOString().slice(0, 10);
    if (seenDays.has(day)) continue;
    seenDays.add(day);
    keep.add(s.name);
  }
  return {
    keep: snaps.filter((s) => keep.has(s.name)).map((s) => s.name),
    remove: snaps.filter((s) => !keep.has(s.name)).map((s) => s.name),
  };
}

/** Applies planRotation to a directory. Returns the removed names. */
export function rotateBackups(backupDir, options = {}) {
  const dir = path.resolve(backupDir);
  const { remove } = planRotation(readdirSync(dir), options);
  const removed = [];
  for (const name of remove) {
    const filePath = path.join(dir, name);
    // Belt and braces: the name came from our strict regex (no separators),
    // but still refuse anything that isn't a plain file directly in dir.
    if (path.dirname(filePath) !== dir) continue;
    let st;
    try { st = lstatSync(filePath); } catch { continue; }
    if (!st.isFile()) continue;
    unlinkSync(filePath);
    removed.push(name);
  }
  return removed;
}
