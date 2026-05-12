import { kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import { listTopicRecords } from "@/topics/topicLoader";

// Newer timestamp wins overall; photo and sex are merged field-by-field
// (either side's non-null value wins) so they survive cross-device edits.
export function mergeStudents(local, server) {
  const byId = new Map((server ?? []).map((s) => [s.id, s]));
  for (const s of (local ?? [])) {
    const srv = byId.get(s.id);
    if (!srv) { byId.set(s.id, s); continue; }
    const winner = (s.updatedAt ?? "") >= (srv.updatedAt ?? "") ? s : srv;
    byId.set(s.id, {
      ...winner,
      photo: s.photo ?? srv.photo ?? null,
      sex:   s.sex   ?? srv.sex   ?? null,
    });
  }
  return [...byId.values()];
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
      const merged = mergeStudents(current, serverStudents);
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
    topicRecords: Array.isArray(raw.topicRecords) ? raw.topicRecords : [],
    studentTopicLinks: indexStudentTopicLinks(raw.studentTopicLinks),
    conceptProgress: indexConceptProgress(raw.conceptProgress),
    sessions: Array.isArray(raw.sessions) ? raw.sessions.slice(-200) : [],
    lastContext: raw.lastContext ?? null,
  };
}

export function applyBootstrapToStore(raw) {
  const bootstrap = normalizeBootstrap(raw);
  const lastContext = bootstrap.lastContext ?? {};

  useAppStore.setState((state) => ({
    ...state,
    token: bootstrap.token,
    account: bootstrap.account,
    settings: { ...state.settings, ...(bootstrap.settings ?? {}) },
    // Merge with current store state so a concurrent local save isn't overwritten in memory.
    students: mergeStudents(state.students, bootstrap.students),
    ownedTopics: bootstrap.ownedTopics,
    topicRecords: "topicRecords" in raw ? bootstrap.topicRecords : state.topicRecords,
    studentTopicLinks: bootstrap.studentTopicLinks,
    conceptProgress: bootstrap.conceptProgress,
    sessions: bootstrap.sessions,
    activeStudentId: lastContext.studentId ?? null,
    activeTopicId: lastContext.topicId ?? null,
    activeTextId: lastContext.textId ?? null,
    activeModeId: lastContext.modeId ?? null,
  }));
}

export async function loadLocalBootstrap(db) {
  const [token, account, settings, students, ownedTopics, studentTopicLinks, conceptProgress, sessions, lastContext, topicRecords] =
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
      listTopicRecords(db),
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
  });
}

export async function persistBootstrap(db, raw) {
  const bootstrap = normalizeBootstrap(raw);
  const writes = [];

  if ("token" in raw) writes.push(kv.set(db, "token", bootstrap.token));
  if ("account" in raw) writes.push(kv.set(db, "account", bootstrap.account));
  if ("settings" in raw) writes.push(kv.set(db, "settings", bootstrap.settings));
  if ("students" in raw) writes.push(atomicMergeStudents(db, bootstrap.students));
  if ("ownedTopics" in raw) writes.push(kv.set(db, "ownedTopics", bootstrap.ownedTopics));
  if ("studentTopicLinks" in raw) writes.push(kv.set(db, "studentTopicLinks", bootstrap.studentTopicLinks));
  if ("conceptProgress" in raw) writes.push(kv.set(db, "conceptProgress", bootstrap.conceptProgress));
  if ("sessions" in raw) writes.push(kv.set(db, "sessions", bootstrap.sessions));
  if ("lastContext" in raw) writes.push(kv.set(db, "lastContext", bootstrap.lastContext));

  await Promise.all(writes);
}
