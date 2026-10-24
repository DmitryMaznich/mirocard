import { appendUsageEvent } from "./usage-repository.mjs";
import {
  upsertStudent, softDeleteStudent, upsertStudentPhoto,
  upsertStudentVideos, upsertStudentAdults,
  upsertStudentRewardSettings,
  recordStudentVideoViews,
  upsertStudentMyPeopleProfile, upsertStudentMyPeople,
  upsertStudentImportantDates,
  appendSession,
  upsertAccountTopic, softDeleteAccountTopic,
  upsertStudentTopicLink,
  upsertConceptProgress,
  upsertAccountKv,
  incrementRevision,
} from "./account-repository.mjs";

const HANDLERS = {
  "student.reward_settings.upsert": (db, accountId, data) => upsertStudentRewardSettings(db, accountId, data),
  "usage.append": (db, accountId, data) => appendUsageEvent(db, accountId, data),
  "student.video_view.record": (db, accountId, data) =>
    recordStudentVideoViews(db, accountId, data),
  "student.upsert": (db, accountId, data) =>
    upsertStudent(db, accountId, data),

  "student.photo.upsert": (db, accountId, data) =>
    upsertStudentPhoto(db, accountId, { studentId: data.studentId, photo: data.photo, photoUpdatedAt: data.photoUpdatedAt }),

  "student.videos.upsert": (db, accountId, data) =>
    upsertStudentVideos(db, accountId, { studentId: data.studentId, rewardVideos: data.rewardVideos, updatedAt: data.updatedAt }),

  "student.adults.upsert": (db, accountId, data) =>
    upsertStudentAdults(db, accountId, { studentId: data.studentId, closeAdults: data.closeAdults, updatedAt: data.updatedAt }),

  "student.my_people_profile.upsert": (db, accountId, data) =>
    upsertStudentMyPeopleProfile(db, accountId, { studentId: data.studentId, profile: data.profile, updatedAt: data.updatedAt }),

  "student.my_people.upsert": (db, accountId, data) =>
    upsertStudentMyPeople(db, accountId, { studentId: data.studentId, people: data.people, updatedAt: data.updatedAt }),

  "student.important_dates.upsert": (db, accountId, data) =>
    upsertStudentImportantDates(db, accountId, { studentId: data.studentId, dates: data.dates, updatedAt: data.updatedAt }),

  "student.delete": (db, accountId, data) =>
    softDeleteStudent(db, accountId, data.id),

  "session.append": (db, accountId, data) =>
    appendSession(db, accountId, data),

  "topic.acquire": (db, accountId, data) =>
    upsertAccountTopic(db, accountId, data),

  "topic.delete": (db, accountId, data) =>
    softDeleteAccountTopic(db, accountId, data.id),

  "student_topic_link.upsert": (db, accountId, data) =>
    upsertStudentTopicLink(db, accountId, data),

  "concept_progress.upsert": (db, accountId, data) =>
    upsertConceptProgress(db, accountId, data),

  "kv.upsert": (db, accountId, data) =>
    upsertAccountKv(db, accountId, data.key, data.value),
};

// SQLite failures that say nothing about the operation itself — the disk is
// full, the database is busy/locked, an I/O error — and will pass on a retry.
// (2026-10-19: with a full volume every op was "skipped" here, logged, and
// the request still answered 200 for usage.append, so the client dropped it.)
// Primary result codes: BUSY 5, LOCKED 6, NOMEM 7, READONLY 8, IOERR 10, FULL 13, CANTOPEN 14.
const TRANSIENT_SQLITE_CODES = new Set([5, 6, 7, 8, 10, 13, 14]);

export function isTransientDbError(err) {
  return err?.code === "ERR_SQLITE_ERROR" && TRANSIENT_SQLITE_CODES.has(Number(err.errcode) & 0xff);
}

// A transient failure answers 503: the client keeps the op queued and retries it. Any other failure (bad data,
// a constraint) is the op's own and would fail the same way forever, so it is logged and skipped as before;
// failing the request for it would leave the op at the head of the client's queue, blocking every op behind it.
// The ops are idempotent upserts/appends, so re-sending a batch whose first ops already landed is harmless.
export function processSync(db, accountId, operations) {
  for (const op of operations) {
    const handler = HANDLERS[op.type];
    if (!handler) continue;
    try {
      handler(db, accountId, op.data);
    } catch (err) {
      if (isTransientDbError(err)) {
        console.error(`[sync] ${op.type} failed, client will retry — ${err.message}`);
        throw { status: 503, message: "Storage temporarily unavailable, retry later" };
      }
      console.error(`[sync] ${op.type} skipped — ${err.message}`, JSON.stringify(op.data ?? {}).slice(0, 200));
    }
  }
  if (operations.some(op => op.type !== "usage.append")) {
    try {
      incrementRevision(db, accountId);
    } catch (err) {
      if (isTransientDbError(err)) throw { status: 503, message: "Storage temporarily unavailable, retry later" };
      throw err;
    }
  }
}
