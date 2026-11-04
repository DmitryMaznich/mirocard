import { afterEach, expect, it } from "vitest";
import { openDb, kv } from "./db.js";
import { migrateSettings, INITIAL_SETTINGS_TIME } from "./settingsMigration.js";
import { mergeStudents } from "./bootstrap.js";
import { legacyLessonFlow } from "../../shared/lesson-flow.mjs";
import { selectedTopicLanguage } from "../../shared/topic-language-contract.mjs";
let db;
afterEach(() => db?.close());
const topic = { meta: { id: "topic" }, languageContract: { packages: { ru: {}, sl: {} } } };
async function migrate(overrides = {}) {
  db ??= await openDb(`settings-migration-${Math.random()}`);
  return migrateSettings(db, { students: [{ id: "s", primaryLanguage: "en", preferredLessonLanguage: "sl" }],
    studentTopicLinks: { s_topic: { id: "link", params: { level: 4 }, videoRewardEnabled: false } }, topicRecords: [topic],
    settings: { cardLanguage: "ru", tapToAdvance: false, autoAdvanceDelay: 7 }, ...overrides });
}
it("atomically freezes inherited material language, preserves hidden metadata and converts pacing", async () => {
  const data = await migrate();
  expect(data.students[0]).toMatchObject({ primaryLanguage: "en", preferredLessonLanguage: "sl", lessonFlow: { advance: "auto", delaySeconds: 7 } });
  expect(data.studentTopicLinks.s_topic).toMatchObject({ params: { level: 4, topicContentLanguage: "sl" }, videoRewardEnabled: false });
  expect(await kv.get(db, "students")).toEqual(data.students);
  const ops = await new Promise(resolve => { const r = db.transaction("syncQueue").objectStore("syncQueue").getAll(); r.onsuccess = () => resolve(r.result); });
  expect(ops.map(op => op.type)).toEqual(["student.lesson_flow.upsert", "student.topic_language.initialize"]);
  expect(ops[0].data).toMatchObject({ initialize: true, updatedAt: INITIAL_SETTINGS_TIME });
  expect(ops[1].data).toEqual({ studentId: "s", topicId: "topic", language: "sl" });
  db.close(); db = null;
});
it("preserves explicit topic choice and existing per-student flow on repeated migrations", async () => {
  const existing = { advance: "tap", delaySeconds: 2 };
  const data = await migrate({ students: [{ id: "s", lessonFlow: existing, lessonFlowUpdatedAt: "2026-11-01T00:00:00Z" }],
    studentTopicLinks: { s_topic: { params: { topicContentLanguage: "ru" } } } });
  expect(data.students[0].lessonFlow).toEqual(existing);
  expect(data.studentTopicLinks.s_topic.params.topicContentLanguage).toBe("ru");
  db.close(); db = null;
});
it("does not silently pick a language when legacy modes conflict or a preference is unavailable", async () => {
  const data = await migrate({ studentTopicLinks: { s_topic: { params: { byMode: { one: { contentLanguage: "ru" }, two: { contentLanguage: "sl" } } } } } });
  expect(data.studentTopicLinks.s_topic.params.topicContentLanguage).toBeUndefined();
  expect(selectedTopicLanguage(topic, {}, "sl", "ru")).toBeNull();
  db.close(); db = null;
});
it("converts the retired confirmation gate to ordinary touch and clamps the delay", () => {
  expect(legacyLessonFlow({ adultConfirmAdvance: true, tapToAdvance: false, autoAdvanceDelay: 30 })).toEqual({ advance: "tap", delaySeconds: 10 });
});
it("keeps a newer remote pacing choice through an unrelated profile edit and an offline migration", () => {
  const migrated = { id: "s", name: "Local", lessonFlow: { advance: "auto", delaySeconds: 7 }, lessonFlowUpdatedAt: INITIAL_SETTINGS_TIME, updatedAt: "2099-01-01" };
  const remote = { id: "s", name: "Remote", lessonFlow: { advance: "tap", delaySeconds: 3 }, lessonFlowUpdatedAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01" };
  expect(mergeStudents([migrated], [remote])[0]).toMatchObject({ name: "Local", lessonFlow: remote.lessonFlow });
});
