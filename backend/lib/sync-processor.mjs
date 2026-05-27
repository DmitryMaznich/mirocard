import {
  upsertStudent, softDeleteStudent,
  appendSession,
  upsertAccountTopic, softDeleteAccountTopic,
  upsertStudentTopicLink,
  upsertConceptProgress,
  upsertAccountKv,
  incrementRevision,
} from "./account-repository.mjs";

const HANDLERS = {
  "student.upsert": (db, accountId, data) =>
    upsertStudent(db, accountId, data),

  "student.delete": (db, accountId, data) =>
    softDeleteStudent(db, data.id),

  "session.append": (db, accountId, data) =>
    appendSession(db, accountId, data),

  "topic.acquire": (db, accountId, data) =>
    upsertAccountTopic(db, accountId, data),

  "topic.delete": (db, accountId, data) =>
    softDeleteAccountTopic(db, data.id),

  "student_topic_link.upsert": (db, accountId, data) =>
    upsertStudentTopicLink(db, accountId, data),

  "concept_progress.upsert": (db, accountId, data) =>
    upsertConceptProgress(db, data),

  "kv.upsert": (db, accountId, data) =>
    upsertAccountKv(db, accountId, data.key, data.value),
};

export function processSync(db, accountId, operations) {
  for (const op of operations) {
    const handler = HANDLERS[op.type];
    if (!handler) continue;
    try {
      handler(db, accountId, op.data);
    } catch (err) {
      console.error(`[sync] ${op.type} skipped — ${err.message}`, JSON.stringify(op.data ?? {}).slice(0, 200));
    }
  }
  incrementRevision(db, accountId);
}
