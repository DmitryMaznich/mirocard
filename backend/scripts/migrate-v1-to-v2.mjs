#!/usr/bin/env node
/**
 * One-time migration: Mirocard v1 accounts-store.json → Mirocard2 SQLite
 *
 * Usage:
 *   node scripts/migrate-v1-to-v2.mjs <path-to-accounts-store.json>
 *
 * Creates (or updates) the SQLite DB at DATA_DIR/mirocard.db
 * Does NOT delete the source file — rename it manually after verifying.
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db.mjs";
import {
  createAccount, findAccountByEmail,
  upsertStudent, appendSession, upsertAccountTopic,
} from "../lib/account-repository.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node migrate-v1-to-v2.mjs <path-to-accounts-store.json>");
  process.exit(1);
}

let store;
try {
  store = JSON.parse(readFileSync(sourcePath, "utf8"));
} catch (err) {
  console.error("Failed to read source file:", err.message);
  process.exit(1);
}

const db = getDb();

let accountsCreated = 0, studentsCreated = 0, sessionsCreated = 0, topicsCreated = 0;

for (const v1Account of (store.accounts ?? [])) {
  if (!v1Account?.id || !v1Account?.email) continue;

  let account = findAccountByEmail(db, v1Account.email);
  if (!account) {
    account = createAccount(db, {
      email: v1Account.email,
      passwordHash: v1Account.passwordHash || "migrated-no-password",
      displayName: v1Account.displayName || v1Account.email.split("@")[0],
    });
    accountsCreated++;
  }

  const accountId = account.id;

  for (const student of (store.studentsByAccount?.[v1Account.id] ?? [])) {
    if (!student?.id || student.deletedAt) continue;
    upsertStudent(db, accountId, {
      id: student.id,
      name: student.name || "Unknown",
      comment: student.comment || "",
    });
    studentsCreated++;
  }

  for (const session of (store.sessionsByAccount?.[v1Account.id] ?? [])) {
    if (!session?.id) continue;
    try {
      appendSession(db, accountId, {
        id: session.id,
        studentId: session.studentId || session.childId,
        topicId: session.deckId,
        topicVersion: session.deckVersion || "1.0.0",
        mode: session.mode,
        startedAt: session.startedAt || session.completedAt,
        completedAt: session.completedAt,
        correctCount: session.correctCount ?? 0,
        incorrectCount: session.incorrectCount ?? 0,
        percentCorrect: session.percentCorrect ?? 0,
        mistakes: (session.mistakes ?? []).map((m) => ({
          conceptId: m.cardId || m.conceptId,
          cardId: m.cardId,
        })),
      });
      sessionsCreated++;
    } catch { /* skip duplicate sessions */ }
  }

  for (const deck of (store.decksByAccount?.[v1Account.id] ?? [])) {
    if (!deck?.deckId || deck.deletedAt) continue;
    upsertAccountTopic(db, accountId, {
      id: deck.id || randomUUID(),
      topicId: deck.deckId,
      topicVersion: deck.deckVersion || "1.0.0",
      source: "download",
    });
    topicsCreated++;
  }
}

console.log("Migration complete:");
console.log(`  Accounts: ${accountsCreated}`);
console.log(`  Students: ${studentsCreated}`);
console.log(`  Sessions: ${sessionsCreated}`);
console.log(`  Topics:   ${topicsCreated}`);
console.log("\nVerify the data, then rename accounts-store.json → accounts-store.json.bak");
