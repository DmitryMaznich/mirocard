import { kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import { listTopicRecords } from "@/topics/topicLoader";

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
    settings: bootstrap.settings ?? state.settings,
    students: bootstrap.students,
    ownedTopics: bootstrap.ownedTopics,
    topicRecords: bootstrap.topicRecords,
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
  if ("students" in raw) writes.push(kv.set(db, "students", bootstrap.students));
  if ("ownedTopics" in raw) writes.push(kv.set(db, "ownedTopics", bootstrap.ownedTopics));
  if ("studentTopicLinks" in raw) writes.push(kv.set(db, "studentTopicLinks", bootstrap.studentTopicLinks));
  if ("conceptProgress" in raw) writes.push(kv.set(db, "conceptProgress", bootstrap.conceptProgress));
  if ("sessions" in raw) writes.push(kv.set(db, "sessions", bootstrap.sessions));
  if ("lastContext" in raw) writes.push(kv.set(db, "lastContext", bootstrap.lastContext));

  await Promise.all(writes);
}
