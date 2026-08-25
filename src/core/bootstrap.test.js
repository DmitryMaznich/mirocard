import { beforeEach, describe, expect, it } from "vitest";
import { openDb, kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import {
  activeStudents,
  applyBootstrapToStore,
  indexConceptProgress,
  indexStudentTopicLinks,
  loadLocalBootstrap,
  atomicUpsertOwnedTopic,
  markStudentDeleted,
  mergeOwnedTopics,
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
      activeSessionSnapshot: null,
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
    expect(result.topicRecords.filter((r) => !r.meta?.builtin)).toEqual([]);
    expect(result.studentTopicLinks).toEqual({
      s1_t1: { studentId: "s1", topicId: "t1", id: "l1" },
    });
    expect(result.conceptProgress).toEqual({
      s1_t1_c1: { studentId: "s1", topicId: "t1", conceptId: "c1" },
    });
    expect(result.sessions).toHaveLength(200);
    expect(result.sessions[0].id).toBe(6);
    expect(result.lastContext).toBeNull();
    expect(result.activeSession).toBeNull();
  });

  it("mergeOwnedTopics keeps a local free grant the server doesn't know about yet", () => {
    const merged = mergeOwnedTopics(
      [{ topicId: "spatial_prepositions_ru", source: "free" }],
      [],
    );
    expect(merged).toEqual([{ topicId: "spatial_prepositions_ru", source: "free" }]);
  });

  it("mergeOwnedTopics drops a local non-free entry the server no longer sends", () => {
    const merged = mergeOwnedTopics(
      [{ topicId: "granted_topic", source: "grant" }],
      [],
    );
    expect(merged).toEqual([]);
  });

  it("mergeOwnedTopics prefers the server's record once it catches up", () => {
    const merged = mergeOwnedTopics(
      [{ topicId: "t1", source: "free" }],
      [{ topicId: "t1", source: "free", grantedAt: "2026-05-14T00:00:00.000Z" }],
    );
    expect(merged).toEqual([{ topicId: "t1", source: "free", grantedAt: "2026-05-14T00:00:00.000Z" }]);
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

  it("mergeStudentRecords adopts a newer server photo instead of freezing on a stale local data: URL", () => {
    // Regression test: a device that once set its own photo used to keep showing that
    // exact data: URL forever, ignoring any newer photo set later on another device.
    const local = [{ id: "s1", updatedAt: "2026-01-01T00:00:00.000Z",
      photo: "data:image/png;base64,OLD", photoUpdatedAt: "2026-01-01T00:00:00.000Z" }];
    const server = [{ id: "s1", updatedAt: "2026-06-01T00:00:00.000Z",
      photo: "/api/photos/newhash", photoUpdatedAt: "2026-06-01T00:00:00.000Z" }];

    const records = mergeStudentRecords(local, server);
    expect(records[0].photo).toBe("/api/photos/newhash");
    expect(records[0].photoUpdatedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("mergeStudentRecords keeps a just-set local photo that hasn't reached the server yet", () => {
    const local = [{ id: "s1", updatedAt: "2026-06-01T00:00:00.000Z",
      photo: "data:image/png;base64,NEW", photoUpdatedAt: "2026-06-01T00:00:00.000Z" }];
    const server = [{ id: "s1", updatedAt: "2026-01-01T00:00:00.000Z",
      photo: "/api/photos/oldhash", photoUpdatedAt: "2026-01-01T00:00:00.000Z" }];

    const records = mergeStudentRecords(local, server);
    expect(records[0].photo).toBe("data:image/png;base64,NEW");
    expect(records[0].photoUpdatedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("mergeStudentRecords prefers the winning record's closeAdult photo over a stale data: URL on the losing side", () => {
    const local = [{ id: "s1", updatedAt: "2026-01-01T00:00:00.000Z",
      closeAdults: [{ id: "a1", name: "Папа", photo: "data:image/png;base64,OLD" }] }];
    const server = [{ id: "s1", updatedAt: "2026-06-01T00:00:00.000Z",
      closeAdults: [{ id: "a1", name: "Папа", photo: "/api/photos/newhash" }] }];

    const records = mergeStudentRecords(local, server);
    expect(records[0].closeAdults[0].photo).toBe("/api/photos/newhash");
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
      activeSession: {
        context: { studentId: "s1", topicId: "t1", textId: null, modeId: "intro" },
        sessionState: { status: "task_active", topicVersion: "1.0.0" },
      },
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
    expect(state.activeSessionSnapshot).toEqual({
      schemaVersion: 1,
      updatedAt: null,
      context: { studentId: "s1", topicId: "t1", textId: null, modeId: "intro" },
      sessionState: { status: "task_active", topicVersion: "1.0.0" },
    });
  });

  it("applyBootstrapToStore restores active context from activeSession when present", () => {
    applyBootstrapToStore({
      activeSession: {
        context: { studentId: "s9", topicId: "t9", textId: "text-1", modeId: "read_text" },
        sessionState: { status: "task_active", topicVersion: "1.0.0" },
      },
    });

    const state = useAppStore.getState();
    expect(state.activeStudentId).toBe("s9");
    expect(state.activeTopicId).toBe("t9");
    expect(state.activeTextId).toBe("text-1");
    expect(state.activeModeId).toBe("read_text");
  });

  it("applyBootstrapToStore without lastContext preserves current active context", () => {
    // Simulate: local bootstrap sets active context, then server bootstrap arrives without lastContext.
    applyBootstrapToStore({
      lastContext: { studentId: "s1", topicId: "t1", modeId: "intro" },
    });
    expect(useAppStore.getState().activeStudentId).toBe("s1");

    // Server bootstrap has no lastContext — active IDs must not be cleared.
    applyBootstrapToStore({
      students: [{ id: "s1" }],
      ownedTopics: [],
      studentTopicLinks: [],
      conceptProgress: [],
      sessions: [],
    });
    expect(useAppStore.getState().activeStudentId).toBe("s1");
    expect(useAppStore.getState().activeTopicId).toBe("t1");
    expect(useAppStore.getState().activeModeId).toBe("intro");
  });

  it("applyBootstrapToStore hides deleted student tombstones from app state", () => {
    applyBootstrapToStore({
      students: [
        { id: "s1", name: "Маша", updatedAt: "2026-05-14T10:00:00.000Z", deletedAt: "2026-05-14T10:00:00.000Z" },
      ],
    });

    expect(useAppStore.getState().students).toEqual([]);
  });

  it("applyBootstrapToStore survives a periodic server resync that hasn't caught up with a fresh free-deck install", () => {
    // Installing a free deck optimistically grants it locally before the server confirms.
    applyBootstrapToStore({ ownedTopics: [{ topicId: "spatial_prepositions_ru", source: "free" }] });
    expect(useAppStore.getState().ownedTopics).toEqual([{ topicId: "spatial_prepositions_ru", source: "free" }]);

    // The 20s/visibilitychange resync lands next, with a server list that hasn't seen the claim yet.
    applyBootstrapToStore({ ownedTopics: [] });
    expect(useAppStore.getState().ownedTopics).toEqual([{ topicId: "spatial_prepositions_ru", source: "free" }]);
  });

  it("applyBootstrapToStore leaves ownedTopics untouched when the caller omits the field entirely", () => {
    applyBootstrapToStore({ ownedTopics: [{ topicId: "t1", source: "free" }] });
    applyBootstrapToStore({ students: [{ id: "s1" }] });
    expect(useAppStore.getState().ownedTopics).toEqual([{ topicId: "t1", source: "free" }]);
  });

  it("persistBootstrap merges ownedTopics instead of replacing, keeping a local free grant", async () => {
    const db = await freshDb();
    await kv.set(db, "ownedTopics", [{ topicId: "spatial_prepositions_ru", source: "free" }]);

    await persistBootstrap(db, { ownedTopics: [] });

    expect(await kv.get(db, "ownedTopics")).toEqual([{ topicId: "spatial_prepositions_ru", source: "free" }]);
  });

  it("atomicUpsertOwnedTopic persists a fresh free grant that survives a cold restart", async () => {
    const db = await freshDb();

    await atomicUpsertOwnedTopic(db, { topicId: "spatial_prepositions_ru", source: "free" });

    // Simulates the app being closed and relaunched right after install,
    // before any server round-trip — loadLocalBootstrap reads straight from IDB.
    const bootstrap = await loadLocalBootstrap(db);
    expect(bootstrap.ownedTopics).toEqual([{ topicId: "spatial_prepositions_ru", source: "free" }]);
  });

  it("atomicUpsertOwnedTopic updates an existing entry in place without touching others", async () => {
    const db = await freshDb();
    await kv.set(db, "ownedTopics", [
      { topicId: "t1", source: "grant" },
      { topicId: "t2", source: "free" },
    ]);

    await atomicUpsertOwnedTopic(db, { topicId: "t2", source: "free", acquiredAt: "2026-05-14T00:00:00.000Z" });

    expect(await kv.get(db, "ownedTopics")).toEqual([
      { topicId: "t1", source: "grant" },
      { topicId: "t2", source: "free", acquiredAt: "2026-05-14T00:00:00.000Z" },
    ]);
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
      activeSession: {
        context: { studentId: "s2", topicId: "topic-1", textId: null, modeId: "find_n" },
        sessionState: { status: "task_active", topicVersion: "1.0.0", taskIndex: 3 },
      },
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
    expect(bootstrap.activeSession).toEqual({
      schemaVersion: 1,
      updatedAt: null,
      context: { studentId: "s2", topicId: "topic-1", textId: null, modeId: "find_n" },
      sessionState: { status: "task_active", topicVersion: "1.0.0", taskIndex: 3 },
    });
    const userRecords = bootstrap.topicRecords.filter((r) => !r.meta?.builtin);
    expect(userRecords).toHaveLength(1);
    expect(userRecords[0].meta.id).toBe("topic-1");
  });
});
