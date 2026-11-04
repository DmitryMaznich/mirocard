import { legacyLessonFlow } from "../../shared/lesson-flow.mjs";

// Initialization is older than every explicit edit and cannot replace a choice
// already accepted on another device. Queue it with the local data atomically.
export const INITIAL_SETTINGS_TIME = "1970-01-01T00:00:00.000Z";
export async function migrateSettings(db, { students = [], studentTopicLinks = {}, topicRecords = [], settings = {} }) {
  const operations = [];
  const migrated = students.map(student => {
    if (student.deletedAt || student.lessonFlowUpdatedAt) return student;
    const lessonFlow = legacyLessonFlow(settings);
    operations.push({ type: "student.lesson_flow.upsert", data: { studentId: student.id, settings: lessonFlow, updatedAt: INITIAL_SETTINGS_TIME, initialize: true } });
    return { ...student, lessonFlow, lessonFlowUpdatedAt: INITIAL_SETTINGS_TIME };
  });
  const links = { ...studentTopicLinks };
  for (const student of migrated) {
    if (student.deletedAt) continue;
    for (const topic of topicRecords) {
      if (!topic.languageContract) continue;
      const key = `${student.id}_${topic.meta.id}`;
      const link = links[key];
      if (!link || link.params?.topicContentLanguage) continue;
      const params = link.params ?? {};
      const previous = [...new Set([params.contentLanguage, ...Object.values(params.byMode ?? {}).map(p => p.contentLanguage)].filter(Boolean))];
      if (previous.length > 1) continue;
      const language = previous[0] ?? student.preferredLessonLanguage ?? settings.cardLanguage ?? "ru";
      if (!topic.languageContract.packages?.[language]) continue;
      links[key] = { ...link, params: { ...params, topicContentLanguage: language } };
      operations.push({ type: "student.topic_language.initialize", data: { studentId: student.id, topicId: topic.meta.id, language } });
    }
  }
  if (operations.length) await new Promise((resolve, reject) => {
    const tx = db.transaction(["keyval", "syncQueue"], "readwrite");
    tx.objectStore("keyval").put(migrated, "students");
    tx.objectStore("keyval").put(links, "studentTopicLinks");
    for (const op of operations) tx.objectStore("syncQueue").add(op);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Settings migration failed"));
  });
  return { students: migrated, studentTopicLinks: links };
}
