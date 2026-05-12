import { create } from "zustand";

export const useAppStore = create((set) => ({
  // ─── Navigation ────────────────────────────────────────────────────────────
  screen: "boot",
  setScreen: (screen) => set({ screen }),

  // ─── Auth ──────────────────────────────────────────────────────────────────
  account: null,
  token: null,
  setAccount: (account) => set({ account }),
  setToken: (token) => set({ token }),
  logout: () => set({ account: null, token: null, students: [], ownedTopics: [], screen: "login" }),

  // ─── Settings ──────────────────────────────────────────────────────────────
  settings: {
    uiLanguage: "ru",
    cardLanguage: "ru",
    adultPinHash: null,
    pushAppUpdates: true,
    pushTopicUpdates: true,
    pushReminders: false,
    tapToAdvance: true,
    autoAdvanceDelay: 3,
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
  topicRecords: [],
  setOwnedTopics: (ownedTopics) => set({ ownedTopics }),
  setTopicRecords: (topicRecords) => set({ topicRecords }),
  upsertOwnedTopic: (topic) => set((s) => {
    const idx = s.ownedTopics.findIndex((x) => x.topicId === topic.topicId);
    const next = [...s.ownedTopics];
    if (idx >= 0) next[idx] = { ...next[idx], ...topic };
    else next.push(topic);
    return { ownedTopics: next };
  }),

  // ─── Session setup ─────────────────────────────────────────────────────────
  activeStudentId: null,
  activeTopicId: null,
  activeTextId: null,
  activeModeId: null,
  setActiveStudentId: (id) => set({ activeStudentId: id }),
  setActiveTopicId:   (id) => set({ activeTopicId: id, activeTextId: null, activeModeId: null }),
  setActiveTextId:    (id) => set({ activeTextId: id, activeModeId: null }),
  setActiveModeId:    (id) => set({ activeModeId: id }),

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
