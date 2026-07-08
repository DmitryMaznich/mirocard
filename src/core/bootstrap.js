import { kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import { listTopicRecords, installFirstPartyDeckIfNeeded } from "@/topics/topicLoader";
import { normalizeActiveSessionSnapshot } from "@/features/session/activeSession";
import { BUILTIN_TOPICS, BUILTIN_TOPIC_IDS, FIRST_PARTY_DECK_IDS } from "@/topics/builtinTopics";

export function isDeletedStudent(student) {
  return Boolean(student?.deletedAt);
}

export function activeStudents(students) {
  return (students ?? []).filter((student) => !isDeletedStudent(student));
}

function studentChangeTime(student) {
  return student?.deletedAt ?? student?.updatedAt ?? student?.createdAt ?? "";
}

// Active records use last-write-wins. Delete tombstones win over active records
// so a missing server row cannot be mistaken for a new local student.
export function mergeStudentRecords(local, server) {
  const byId = new Map();

  function put(student) {
    if (!student?.id) return;

    const current = byId.get(student.id);
    if (!current) {
      byId.set(student.id, student);
      return;
    }

    const currentDeleted = isDeletedStudent(current);
    const nextDeleted = isDeletedStudent(student);

    if (currentDeleted || nextDeleted) {
      if (currentDeleted && nextDeleted) {
        byId.set(
          student.id,
          studentChangeTime(student) >= studentChangeTime(current) ? student : current,
        );
      } else {
        byId.set(student.id, nextDeleted ? student : current);
      }
      return;
    }

    const winner = (student.updatedAt ?? "") >= (current.updatedAt ?? "") ? student : current;
    const loser  = winner === student ? current : student;

    // Photo merges independently of the rest of the student fields, by its own
    // photoUpdatedAt, so an unrelated edit on Device B can't erase a photo set on Device A.
    // This timestamp must be the only signal: an earlier version also unconditionally
    // preferred any local "data:" URL as "probably unflushed", but nothing ever rewrites
    // that URL back to the server's resolved one after a sync, so every device ended up
    // permanently stuck on whichever photo it had last set itself.
    const photoWinner = (student.photoUpdatedAt ?? "") >= (current.photoUpdatedAt ?? "")
      ? student : current;
    const resolvedPhoto   = photoWinner.photo ?? null;
    const resolvedPhotoTs = photoWinner.photoUpdatedAt ?? null;

    // If winner has an empty adults list but loser has adults with photos, keep loser's list
    // (empty winner means the server simply hasn't received the pushOp yet).
    const winnerAdults = winner.closeAdults;
    const loserAdults  = loser.closeAdults;
    const closeAdults = winnerAdults == null
      ? winnerAdults
      : winnerAdults.length === 0 && loserAdults?.length > 0
        ? loserAdults
        : winnerAdults.map((adult) => {
            // Adults have no independent photo timestamp, so the whole-record `winner`
            // (by updatedAt) is the best freshness signal available. Fall back to the
            // loser's photo only when the winner doesn't have one for this adult, so a
            // replica that hasn't received the photo yet doesn't erase it.
            const loserAdultPhoto = (loserAdults ?? []).find((a) => a.id === adult.id)?.photo ?? null;
            const resolvedAdultPhoto = adult.photo ?? loserAdultPhoto ?? null;
            return resolvedAdultPhoto === adult.photo ? adult : { ...adult, photo: resolvedAdultPhoto };
          });

    byId.set(student.id, {
      ...winner,
      photo:          resolvedPhoto,
      photoUpdatedAt: resolvedPhotoTs,
      sex:            student.sex   ?? current.sex   ?? null,
      closeAdults:    closeAdults,
    });
  }

  for (const student of (server ?? [])) put(student);
  for (const student of (local ?? [])) put(student);

  return [...byId.values()];
}

export function mergeStudents(local, server) {
  return activeStudents(mergeStudentRecords(local, server));
}

export function markStudentDeleted(students, id, deletedAt = new Date().toISOString()) {
  const current = (students ?? []).find((student) => student?.id === id);
  const tombstone = {
    ...(current ?? { id }),
    id,
    deletedAt,
    updatedAt: deletedAt,
  };
  return mergeStudentRecords(students, [tombstone]);
}

// Atomic IDB read→merge→write: prevents a concurrent save from being overwritten.
// Opens a single readwrite transaction so no other write can slip in between the read and put.
function atomicMergeStudents(db, serverStudents) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keyval", "readwrite");
    const store = tx.objectStore("keyval");
    const getReq = store.get("students");
    getReq.onsuccess = () => {
      const current = Array.isArray(getReq.result) ? getReq.result : [];
      const merged = mergeStudentRecords(current, serverStudents);
      const putReq = store.put(merged, "students");
      putReq.onsuccess = () => resolve(merged);
      putReq.onerror  = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror     = () => reject(tx.error);
  });
}

export function indexStudentTopicLinks(links) {
  if (links && typeof links === "object" && !Array.isArray(links)) {
    return links;
  }
  if (!Array.isArray(links)) return {};

  return links.reduce((acc, link) => {
    if (!link?.studentId || !link?.topicId) return acc;
    acc[`${link.studentId}_${link.topicId}`] = link;
    return acc;
  }, {});
}

export function indexConceptProgress(progress) {
  if (progress && typeof progress === "object" && !Array.isArray(progress)) {
    return progress;
  }
  if (!Array.isArray(progress)) return {};

  return progress.reduce((acc, item) => {
    if (!item?.studentId || !item?.topicId || !item?.conceptId) return acc;
    acc[`${item.studentId}_${item.topicId}_${item.conceptId}`] = item;
    return acc;
  }, {});
}

export function normalizeBootstrap(raw = {}) {
  return {
    token: raw.token ?? null,
    account: raw.account ?? null,
    settings: raw.settings ?? null,
    students: Array.isArray(raw.students) ? raw.students : [],
    ownedTopics: Array.isArray(raw.ownedTopics) ? raw.ownedTopics : [],
    topicRecords: [
      ...BUILTIN_TOPICS,
      ...(Array.isArray(raw.topicRecords) ? raw.topicRecords.filter((r) => !BUILTIN_TOPIC_IDS.has(r.meta?.id)) : []),
    ],
    studentTopicLinks: indexStudentTopicLinks(raw.studentTopicLinks),
    conceptProgress: indexConceptProgress(raw.conceptProgress),
    sessions: Array.isArray(raw.sessions) ? raw.sessions.slice(-200) : [],
    lastContext: raw.lastContext ?? null,
    activeSession: normalizeActiveSessionSnapshot(raw.activeSession),
  };
}

export function applyBootstrapToStore(raw) {
  const bootstrap = normalizeBootstrap(raw);
  const resumeContext = bootstrap.activeSession?.context ?? bootstrap.lastContext;

  useAppStore.setState((state) => ({
    ...state,
    token: bootstrap.token,
    account: bootstrap.account,
    settings: (() => {
      const merged = { ...state.settings, ...(bootstrap.settings ?? {}) };
      // Server null must not overwrite a locally-held PIN that hasn't synced yet.
      if (merged.adultPinHash === null && (state.settings.adultPinHash ?? null) !== null) {
        merged.adultPinHash = state.settings.adultPinHash;
      }
      return merged;
    })(),
    // Merge with current store state so a concurrent local save isn't overwritten in memory.
    students: mergeStudents(state.students, bootstrap.students),
    ownedTopics: bootstrap.ownedTopics,
    topicRecords: "topicRecords" in raw ? bootstrap.topicRecords : state.topicRecords,
    studentTopicLinks: bootstrap.studentTopicLinks,
    conceptProgress: bootstrap.conceptProgress,
    sessions: bootstrap.sessions,
    ...("activeSession" in raw ? { activeSessionSnapshot: bootstrap.activeSession } : {}),
    // Only restore active context from local bootstrap artifacts.
    // A server-side apply without lastContext/activeSession must not clear current navigation.
    ...((bootstrap.activeSession != null || bootstrap.lastContext != null) ? {
      activeStudentId: resumeContext?.studentId ?? null,
      activeTopicId:   resumeContext?.topicId   ?? null,
      activeTextId:    resumeContext?.textId    ?? null,
      activeModeId:    resumeContext?.modeId    ?? null,
    } : {}),
  }));
}

export async function loadLocalBootstrap(db) {
  const [token, account, settings, students, ownedTopics, studentTopicLinks, conceptProgress, sessions, lastContext, activeSession, topicRecords] =
    await Promise.all([
      kv.get(db, "token"),
      kv.get(db, "account"),
      kv.get(db, "settings"),
      kv.get(db, "students"),
      kv.get(db, "ownedTopics"),
      kv.get(db, "studentTopicLinks"),
      kv.get(db, "conceptProgress"),
      kv.get(db, "sessions"),
      kv.get(db, "lastContext"),
      kv.get(db, "activeSession"),
      (async () => {
        await Promise.all([...FIRST_PARTY_DECK_IDS].map((id) => installFirstPartyDeckIfNeeded(db, id)));
        return listTopicRecords(db);
      })(),
    ]);

  return normalizeBootstrap({
    token,
    account,
    settings,
    students,
    ownedTopics,
    topicRecords,
    studentTopicLinks,
    conceptProgress,
    sessions,
    lastContext,
    activeSession,
  });
}

// IDB keys that belong to a specific user account.
// Clear all of these when switching accounts so data doesn't leak between users.
const USER_IDB_KEYS = [
  "token", "account", "accountId",
  "students", "sessions", "studentTopicLinks", "conceptProgress",
  "ownedTopics", "lastContext", "activeSession", "settings",
];

export async function clearUserIdbData(db) {
  await Promise.all(USER_IDB_KEYS.map((key) => kv.del(db, key)));
}

export async function persistBootstrap(db, raw) {
  const bootstrap = normalizeBootstrap(raw);
  const writes = [];

  if ("token" in raw) writes.push(kv.set(db, "token", bootstrap.token));
  if ("account" in raw) writes.push(kv.set(db, "account", bootstrap.account));
  if ("settings" in raw) {
    const settings = { ...bootstrap.settings };
    // Preserve locally-set PIN if server returns null (race: API call may not have completed).
    const localPinHash = useAppStore.getState().settings.adultPinHash ?? null;
    if (settings.adultPinHash === null && localPinHash !== null) {
      settings.adultPinHash = localPinHash;
    }
    writes.push(kv.set(db, "settings", settings));
  }
  if ("students" in raw) writes.push(atomicMergeStudents(db, bootstrap.students));
  if ("ownedTopics" in raw) writes.push(kv.set(db, "ownedTopics", bootstrap.ownedTopics));
  if ("studentTopicLinks" in raw) writes.push(kv.set(db, "studentTopicLinks", bootstrap.studentTopicLinks));
  if ("conceptProgress" in raw) writes.push(kv.set(db, "conceptProgress", bootstrap.conceptProgress));
  if ("sessions" in raw) writes.push(kv.set(db, "sessions", bootstrap.sessions));
  if ("lastContext" in raw) writes.push(kv.set(db, "lastContext", bootstrap.lastContext));
  if ("activeSession" in raw) writes.push(kv.set(db, "activeSession", bootstrap.activeSession));
  if (Array.isArray(raw.kvStore)) {
    for (const { key, value } of raw.kvStore) {
      writes.push(kv.set(db, key, value));
    }
  }

  await Promise.all(writes);
}
