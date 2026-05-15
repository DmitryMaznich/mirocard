import { beforeEach, describe, expect, it } from "vitest";
import { openDb, kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import {
  activeStudents,
  applyBootstrapToStore,
  indexConceptProgress,
  indexStudentTopicLinks,
  loadLocalBootstrap,
  markStudentDeleted,
  mergeStudentRecords,
  mergeStudents,
  normalizeBootstrap,
  persistBootstrap,
} from "./bootstrap";

async function freshDb() {
  return openDb("bootstrap-" + Date.now() + Math.random());
}

describe("bootstrap helpers", () => {
  beforeEach(() => {
    useAppStore.setState({
      screen: "boot",
      account: null,
      token: null,
      settings: {
        uiLanguage: "ru",
        cardLanguage: "ru",
        adultPinHash: null,
        pushAppUpdates: true,
        pushTopicUpdates: true,
        pushReminders: false,
      },
      students: [],
      ownedTopics: [],
      topicRecords: [],
      activeStudentId: null,
      activeTopicId: null,
      activeModeId: null,
      studentTopicLinks: {},
      conceptProgress: {},
      sessions: [],
    });
  });

  it("indexStudentTopicLinks converts array to keyed map", () => {
    expect(indexStudentTopicLinks([
      { id: "l1", studentId: "s1", topicId: "t1", selectedConceptIds: ["c1"] },
      { id: "broken", studentId: "s2" },
    ])).toEqual({
      s1_t1: { id: "l1", studentId: "s1", topicId: "t1", selectedConceptIds: ["c1"] },
    });
  });

  it("indexConceptProgress converts array to keyed map", () => {
    expect(indexConceptProgress([
      { studentId: "s1", topicId: "t1", conceptId: "c1", level: 2 },
      { studentId: "s1", topicId: "t1" },
    ])).toEqual({
      s1_t1_c1: { studentId: "s1", topicId: "t1", conceptId: "c1", level: 2 },
    });
  });

  it("normalizeBootstrap fills defaults and trims sessions", () => {
    const sessions = Array.from({ length: 205 }, (_, index) => ({ id: index + 1 }));
    const result = normalizeBootstrap({
      studentTopicLinks: [{ studentId: "s1", topicId: "t1", id: "l1" }],
      conceptProgress: [{ studentId: "s1", topicId: "t1", conceptId: "c1" }],
      sessions,
    });

    expect(result.token).toBeNull();
    expect(result.account).toBeNull();
    expect(result.settings).toBeNull();
    expect(result.students).toEqual([]);
    expect(result.ownedTopics).toEqual([]);
    expect(result.topicRecords).toEqual([]);
    expect(result.studentTopicLinks).toEqual({
      s1_t1: { studentId: "s1", topicId: "t1", id: "l1" },
    });
    expect(result.conceptProgress).toEqual({
      s1_t1_c1: { studentId: "s1", topicId: "t1", conceptId: "c1" },
    });
    expect(result.sessions).toHaveLength(200);
    expect(result.sessions[0].id).toBe(6);
    expect(result.lastContext).toBeNull();
  });

  it("mergeStudents removes local active records when server sends a tombstone", () => {
    const merged = mergeStudents(
      [{ id: "s1", name: "Маша", updatedAt: "2026-05-14T09:00:00.000Z" }],
      [{ id: "s1", name: "Маша", updatedAt: "2026-05-14T10:00:00.000Z", deletedAt: "2026-05-14T10:00:00.000Z" }],
    );

    expect(merged).toEqual([]);
  });

  it("mergeStudentRecords keeps a local tombstone over an older server active record", () => {
    const records = mergeStudentRecords(
      [{ id: "s1", name: "Маша", updatedAt: "2026-05-14T10:00:00.000Z", deletedAt: "2026-05-14T10:00:00.000Z" }],
      [{ id: "s1", name: "Маша", updatedAt: "2026-05-14T09:00:00.000Z" }],
    );

    expect(records).toHaveLength(1);
    expect(records[0].deletedAt).toBe("2026-05-14T10:00:00.000Z");
    expect(activeStudents(records)).toEqual([]);
  });

  it("mergeStudentRecords preserves closeAdult photos when server wins on updatedAt", () => {
    const local = [{ id: "s1", updatedAt: "2026-01-01T00:00:00.000Z",
      closeAdults: [{ id: "a1", name: "Папа", photo: "data:image/png;base64,ABC" }] }];
    const server = [{ id: "s1", updatedAt: "2026-06-01T00:00:00.000Z",
      closeAdults: [{ id: "a1", name: "Папа", photo: null }] }];

    const records = mergeStudentRecords(local, server);
    expect(records[0].closeAdults[0].photo).toBe("data:image/png;base64,ABC");
  });

  it("mergeStudentRecords preserves closeAdult photos when server wins with empty closeAdults array", () => {
    const local = [{ id: "s1", updatedAt: "2026-01-01T00:00:00.000Z",
      closeAdults: [{ id: "a1", name: "Папа", photo: "data:image/png;base64,ABC" }] }];
    const server = [{ id: "s1", updatedAt: "2026-06-01T00:00:00.000Z",
      closeAdults: [] }];

    const records = mergeStudentRecords(local, server);
    expect(records[0].closeAdults).toHaveLength(1);
    expect(records[0].closeAdults[0].photo).toBe("data:image/png;base64,ABC");
  });

  it("mergeStudentRecords preserves closeAdult photos when local wins on updatedAt", () => {
    const local = [{ id: "s1", updatedAt: "2026-06-01T00:00:00.000Z",
      closeAdults: [{ id: "a1", name: "Папа", photo: "data:image/png;base64,ABC" }] }];
    const server = [{ id: "s1", updatedAt: "2026-01-01T00:00:00.000Z",
      closeAdults: [{ id: "a1", name: "Папа", photo: null }] }];

    const records = mergeStudentRecords(local, server);
    expect(records[0].closeAdults[0].photo).toBe("data:image/png;base64,ABC");
  });

  it("markStudentDeleted creates a tombstone without losing existing fields", () => {
    const deletedAt = "2026-05-14T10:00:00.000Z";
    const records = markStudentDeleted(
      [{ id: "s1", name: "Маша", photo: "photo", updatedAt: "2026-05-14T09:00:00.000Z" }],
      "s1",
      deletedAt,
    );

    expect(records[0]).toMatchObject({ id: "s1", name: "Маша", photo: "photo", updatedAt: deletedAt, deletedAt });
  });

  it("applyBootstrapToStore hydrates store and keeps default settings when missing", () => {
    applyBootstrapToStore({
      account: { email: "demo@test.dev" },
      token: "token-1",
      students: [{ id: "s1" }],
      ownedTopics: [{ topicId: "t1" }],
      studentTopicLinks: [{ studentId: "s1", topicId: "t1", selectedConceptIds: ["c1"] }],
      conceptProgress: [{ studentId: "s1", topicId: "t1", conceptId: "c1", level: 3 }],
      sessions: [{ id: "session-1" }],
      lastContext: { studentId: "s1", topicId: "t1", modeId: "intro" },
    });

    const state = useAppStore.getState();
    expect(state.account).toEqual({ email: "demo@test.dev" });
    expect(state.token).toBe("token-1");
    expect(state.settings.uiLanguage).toBe("ru");
    expect(state.students).toEqual([{ id: "s1" }]);
    expect(state.ownedTopics).toEqual([{ topicId: "t1" }]);
    expect(state.studentTopicLinks.s1_t1.selectedConceptIds).toEqual(["c1"]);
    expect(state.conceptProgress.s1_t1_c1.level).toBe(3);
    expect(state.sessions).toEqual([{ id: "session-1" }]);
    expect(state.activeStudentId).toBe("s1");
    expect(state.activeTopicId).toBe("t1");
    expect(state.activeModeId).toBe("intro");
  });

  it("applyBootstrapToStore hides deleted student tombstones from app state", () => {
    applyBootstrapToStore({
      students: [
        { id: "s1", name: "Маша", updatedAt: "2026-05-14T10:00:00.000Z", deletedAt: "2026-05-14T10:00:00.000Z" },
      ],
    });

    expect(useAppStore.getState().students).toEqual([]);
  });

  it("persistBootstrap saves normalized entities and loadLocalBootstrap returns normalized snapshot", async () => {
    const db = await freshDb();

    await kv.set(db, "installedTopicIds", ["topic-1"]);
    await kv.set(db, "topic:topic-1", {
      id: "topic-1",
      meta: { id: "topic-1", renderer: "flashcards" },
      modes: [],
      cards: [],
      installedAt: "2026-05-05T00:00:00.000Z",
    });

    await persistBootstrap(db, {
      token: "token-2",
      account: { email: "user@test.dev" },
      settings: { uiLanguage: "en" },
      students: [{ id: "s2" }],
      ownedTopics: [{ topicId: "topic-1" }],
      studentTopicLinks: [{ studentId: "s2", topicId: "topic-1", id: "link-1" }],
      conceptProgress: [{ studentId: "s2", topicId: "topic-1", conceptId: "c2", level: 1 }],
      sessions: Array.from({ length: 201 }, (_, index) => ({ id: index + 1 })),
      lastContext: { studentId: "s2", topicId: "topic-1", modeId: "find_n" },
    });

    expect(await kv.get(db, "studentTopicLinks")).toEqual({
      "s2_topic-1": { studentId: "s2", topicId: "topic-1", id: "link-1" },
    });
    expect(await kv.get(db, "conceptProgress")).toEqual({
      "s2_topic-1_c2": { studentId: "s2", topicId: "topic-1", conceptId: "c2", level: 1 },
    });

    const bootstrap = await loadLocalBootstrap(db);
    expect(bootstrap.token).toBe("token-2");
    expect(bootstrap.account).toEqual({ email: "user@test.dev" });
    expect(bootstrap.students).toEqual([{ id: "s2" }]);
    expect(bootstrap.ownedTopics).toEqual([{ topicId: "topic-1" }]);
    expect(bootstrap.studentTopicLinks["s2_topic-1"].id).toBe("link-1");
    expect(bootstrap.conceptProgress["s2_topic-1_c2"].level).toBe(1);
    expect(bootstrap.sessions).toHaveLength(200);
    expect(bootstrap.sessions[0].id).toBe(2);
    expect(bootstrap.lastContext).toEqual({ studentId: "s2", topicId: "topic-1", modeId: "find_n" });
    expect(bootstrap.topicRecords).toHaveLength(1);
    expect(bootstrap.topicRecords[0].id).toBe("topic-1");
  });
});
