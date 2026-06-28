import { create } from "zustand";
import { BUILTIN_TOPICS, BUILTIN_TOPIC_IDS } from "@/topics/builtinTopics";

export const useAppStore = create((set) => ({
  // ─── Navigation ────────────────────────────────────────────────────────────
  screen: "boot",
  setScreen: (screen) => set({ screen }),
  sessionExitPromptOpen: false,
  openSessionExitPrompt:  () => set({ sessionExitPromptOpen: true }),
  closeSessionExitPrompt: () => set({ sessionExitPromptOpen: false }),
  activeSessionSnapshot: null,
  setActiveSessionSnapshot: (activeSessionSnapshot) => set({ activeSessionSnapshot }),
  clearActiveSessionSnapshot: () => set({ activeSessionSnapshot: null }),

  // ─── Student portal mode ───────────────────────────────────────────────────
  isStudentPortal: false,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  account: null,
  token: null,
  setAccount: (account) => set({ account }),
  setToken: (token) => set({ token }),
  logout: () => set({
    account: null,
    token: null,
    students: [],
    ownedTopics: [],
    activeSessionSnapshot: null,
    screen: "login",
  }),

  // ─── Settings ──────────────────────────────────────────────────────────────
  settings: {
    uiLanguage: "ru",
    cardLanguage: "ru",
    adultPinHash: null,
    pushAppUpdates: true,
    pushTopicUpdates: true,
    pushReminders: false,
    adultConfirmAdvance: false,
    tapToAdvance: true,
    autoAdvanceDelay: 3,
    physicalKeyboard: false,
  },
  setSettings: (settings) => set({ settings }),
  patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  // ─── Sync ──────────────────────────────────────────────────────────────────
  syncStatus: "idle",
  serverRevision: 0,
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setServerRevision: (serverRevision) => set({ serverRevision }),

  // ─── Students ──────────────────────────────────────────────────────────────
  editingStudentId: null,
  setEditingStudentId: (id) => set({ editingStudentId: id }),

  students: [],
  setStudents: (students) => set({ students }),
  upsertStudent: (student) => set((s) => {
    const idx = s.students.findIndex((x) => x.id === student.id);
    const next = [...s.students];
    if (idx >= 0) next[idx] = { ...next[idx], ...student };
    else next.push(student);
    return { students: next };
  }),
  removeStudent: (id) => set((s) => ({
    students: s.students.filter((x) => x.id !== id),
  })),

  // ─── Topics ────────────────────────────────────────────────────────────────
  ownedTopics: [],
  topicRecords: [...BUILTIN_TOPICS],
  setOwnedTopics: (ownedTopics) => set({ ownedTopics }),
  setTopicRecords: (topicRecords) => set({
    topicRecords: [...BUILTIN_TOPICS, ...(topicRecords ?? []).filter((r) => !BUILTIN_TOPIC_IDS.has(r.meta.id))],
  }),
  upsertTopicRecord: (record) => set((s) => {
    if (BUILTIN_TOPIC_IDS.has(record.meta.id)) return s;
    return {
      topicRecords: [
        ...s.topicRecords.filter((r) => r.meta.id !== record.meta.id),
        record,
      ],
    };
  }),
  upsertOwnedTopic: (topic) => set((s) => {
    const idx = s.ownedTopics.findIndex((x) => x.topicId === topic.topicId);
    const next = [...s.ownedTopics];
    if (idx >= 0) next[idx] = { ...next[idx], ...topic };
    else next.push(topic);
    return { ownedTopics: next };
  }),

  // ─── Planner ───────────────────────────────────────────────────────────────
  plannerStudentId: null,
  setPlannerStudentId: (id) => set({ plannerStudentId: id }),

  // ─── Session setup ─────────────────────────────────────────────────────────
  activeStudentId: null,
  activeTopicId: null,
  activeTextId: null,
  activeText: null,
  activeModeId: null,
  chatScriptOverride: null,   // { topicId, text, contactOverride } — отредактированный скрипт до запуска чата
  setActiveStudentId:           (id) => set({ activeStudentId: id }),
  setActiveTopicId:             (id) => set({ activeTopicId: id, activeTextId: null, activeText: null, activeModeId: null }),
  setActiveTextId:              (id) => set({ activeTextId: id, activeModeId: null }),
  setActiveText:                (text) => set({ activeText: text, activeTextId: text?.id ?? null, activeModeId: null }),
  setActiveModeId:              (id) => set({ activeModeId: id }),
  setChatScriptOverride:        (topicId, text, contactOverride = null) => set({ chatScriptOverride: { topicId, text, contactOverride } }),
  clearChatScriptOverride:      () => set({ chatScriptOverride: null }),

  // ─── Student-topic links ───────────────────────────────────────────────────
  studentTopicLinks: {},
  setStudentTopicLinks: (links) => set({ studentTopicLinks: links }),
  upsertStudentTopicLink: (studentId, topicId, patch) => set((s) => {
    const key = `${studentId}_${topicId}`;
    return {
      studentTopicLinks: {
        ...s.studentTopicLinks,
        [key]: { ...s.studentTopicLinks[key], ...patch },
      },
    };
  }),

  // ─── Concept progress ──────────────────────────────────────────────────────
  conceptProgress: {},
  setConceptProgress: (progress) => set({ conceptProgress: progress }),
  upsertConceptProgress: (studentId, topicId, conceptId, patch) => set((s) => {
    const key = `${studentId}_${topicId}_${conceptId}`;
    return {
      conceptProgress: {
        ...s.conceptProgress,
        [key]: { ...s.conceptProgress[key], ...patch },
      },
    };
  }),

  // ─── Sessions ──────────────────────────────────────────────────────────────
  sessions: [],
  setSessions:   (sessions) => set({ sessions }),
  appendSession: (session)  => set((s) => ({ sessions: [...s.sessions, session] })),

  // ─── Build info ───────────────────────────────────────────────────────────
  buildInfo: {
    version:   typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
    buildTime: typeof __BUILD_TIME__  !== "undefined" ? __BUILD_TIME__  : "dev",
    gitSha:    typeof __GIT_SHA__     !== "undefined" ? __GIT_SHA__     : "dev",
  },
}));
