import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { useStudentPortal } from "@/features/student/useStudentPortal";
import { createApiClient } from "@/core/api";
import StudentHomeScreen from "@/features/student/StudentHomeScreen";
import StudentLandingPage from "@/features/student/StudentLandingPage";
import SessionScreen from "@/features/session/SessionScreen";
import SessionSummary from "@/features/session/SessionSummary";
import { getDb } from "@/core/db";
import { listTopicRecords, importTopic } from "@/topics/topicLoader";
import { BUILTIN_TOPICS, BUILTIN_TOPIC_IDS } from "@/topics/builtinTopics";
import { clearActiveSessionSnapshot as clearPersistedSessionSnapshot } from "@/features/session/activeSession";
import { saveShoppingPlan } from "@/core/groupStore";
import { semver } from "@/shared/utils/semver";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";

const SESSION_SCREENS = {
  session: SessionScreen,
  summary: SessionSummary,
};

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    }}>
      <div style={{ color: "white", fontSize: 18, opacity: 0.8 }}>Загрузка…</div>
    </div>
  );
}

function ErrorScreen({ reason }) {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "#f7f8fc",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>
        Ссылка недействительна
      </div>
      <div style={{ fontSize: 15, color: "#6b7280", maxWidth: 280 }}>
        {reason === "revoked"
          ? "Доступ отозван. Попросите логопеда прислать новую ссылку."
          : "Не удалось подключиться. Проверьте интернет и попробуйте снова."}
      </div>
      {reason === "network" && (
        <button
          style={{
            marginTop: 24, padding: "12px 24px", borderRadius: 12, border: "none",
            background: "#667eea", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
          onClick={() => window.location.reload()}
        >
          Повторить
        </button>
      )}
    </div>
  );
}

export function computeDefaultParams(topicRecord, mode) {
  const renderer = topicRecord?.meta?.renderer;
  if (renderer === "comparison") {
    return { level: 2, question: "more", showEqual: false, wordsVerdict: false,
             visualMode: "dots", examplesCount: 1, showLabels: true, style: "sign" };
  }
  const out = {};
  for (const [key, def] of Object.entries(mode?.params ?? {})) {
    if (def.type === "concept_selector" || def.type === "sentence_list") continue;
    out[key] = def.default ?? (def.type === "number" ? def.min : (def.values?.[0] ?? null));
  }
  return out;
}

export default function StudentApp({ token, isStandalone = false, fromLink = false }) {
  const [showLanding, setShowLanding] = useState(fromLink);
  const { status, data, error } = useStudentPortal(token);
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const sessionExitPromptOpen  = useAppStore((s) => s.sessionExitPromptOpen);
  const closeSessionExitPrompt = useAppStore((s) => s.closeSessionExitPrompt);
  const clearActiveSessionSnapshot = useAppStore((s) => s.clearActiveSessionSnapshot);
  const [topicsReady, setTopicsReady] = useState(false);
  const sessions = useAppStore((s) => s.sessions);
  const baselineSessionCount = useRef(null);

  // Mark as student portal mode on mount
  useEffect(() => {
    useAppStore.setState({ isStudentPortal: true });
    return () => { useAppStore.setState({ isStudentPortal: false }); };
  }, []);

  // Once portal is ready, capture session baseline so we can detect new completions
  useEffect(() => {
    if (status === "ok" && topicsReady && baselineSessionCount.current === null) {
      baselineSessionCount.current = sessions.length;
    }
  }, [status, topicsReady, sessions.length]);

  // When a new session is appended (count grows), sync it via the student portal endpoint
  useEffect(() => {
    if (baselineSessionCount.current === null) return;
    if (sessions.length <= baselineSessionCount.current) return;
    const newest = sessions[sessions.length - 1];
    baselineSessionCount.current = sessions.length;
    createApiClient({ token }).post("/student/session", { ...newest, mode: newest.modeId }).catch(() => {});
  }, [sessions, token]);

  useEffect(() => {
    if (status !== "ok" || !data) return;
    let cancelled = false;

    (async () => {
      const db = await getDb();

      // Load installed topics from local IndexedDB
      const installed = await listTopicRecords(db);
      let allRecords = [
        ...BUILTIN_TOPICS,
        ...installed.filter((r) => !BUILTIN_TOPIC_IDS.has(r.meta.id)),
      ];
      useAppStore.setState({ topicRecords: allRecords });

      // Keep the active catalog topic current. Topic records are stored locally so
      // that a student can work offline, but that cache must not hide a newer deck.
      const activeTopicId = data.activeTask?.topicId;
      if (activeTopicId) {
        try {
          const catalogResp = await fetch("/decks/catalog.json", { cache: "no-store" });
          const catalog = await catalogResp.json();
          const deck = catalog.decks.find((d) => d.id === activeTopicId);
          const installedRecord = allRecords.find((r) => r.meta.id === activeTopicId);
          const needsInstall = !installedRecord
            || (deck?.version && semver.lt(installedRecord.meta.version ?? "0.0.0", deck.version));

          if (deck && needsInstall) {
            const zipResp = await fetch(deck.url, { cache: "no-store" });
            const zipBuffer = await zipResp.arrayBuffer();
            const record = await importTopic(db, zipBuffer);
            allRecords = [
              ...allRecords.filter((r) => r.meta.id !== record.meta.id),
              record,
            ];
            useAppStore.setState({ topicRecords: allRecords });
          }
        } catch {
          // Download failed — keep the installed version available offline.
        }
      }

      // Apply shopping plan snapshot sent by the logopedist when creating the link
      if (data.activeTask?.planData && data.activeTask?.topicId) {
        await saveShoppingPlan(data.activeTask.topicId, data.activeTask.planData).catch(() => {});
      }

      if (!cancelled) setTopicsReady(true);
    })();

    return () => { cancelled = true; };
  }, [status, data]);

  const handleExitSession = useCallback(async () => {
    closeSessionExitPrompt();
    clearActiveSessionSnapshot();
    try {
      const db = await getDb();
      await clearPersistedSessionSnapshot(db);
    } catch { /* best-effort */ }
    setScreen("home");
  }, [closeSessionExitPrompt, clearActiveSessionSnapshot, setScreen]);

  if (showLanding) return <StudentLandingPage onContinue={() => setShowLanding(false)} />;

  if (status === "loading" || (status === "ok" && !topicsReady)) return <LoadingScreen />;
  if (status === "error") return <ErrorScreen reason={error} />;

  // Route session screens
  const SessionScreenComp = SESSION_SCREENS[screen];
  if (SessionScreenComp) {
    return (
      <>
        <SessionScreenComp />
        {sessionExitPromptOpen && screen === "session" && (
          <Modal
            title="Завершить занятие?"
            onClose={closeSessionExitPrompt}
            closeOnOverlay={false}
            showCloseButton={false}
            actions={
              <>
                <Button variant="secondary" onClick={closeSessionExitPrompt}>Остаться</Button>
                <Button variant="danger" onClick={handleExitSession}>Завершить</Button>
              </>
            }
          >
            Текущий прогресс занятия не будет сохранён.
          </Modal>
        )}
      </>
    );
  }

  const { student, activeTask } = data;

  function handleStartSession({ topicId, modeId, textId }) {
    const { topicRecords } = useAppStore.getState();
    const topicRecord = topicRecords.find((r) => r.meta.id === topicId);
    // Fall back to the first mode if modeId is missing (e.g. old portal without modeId stored)
    const resolvedModeId = modeId ?? topicRecord?.modes?.[0]?.id ?? null;
    const mode = topicRecord?.modes.find((m) => m.id === resolvedModeId);

    const defaultParams = computeDefaultParams(topicRecord, mode);
    useAppStore.getState().upsertStudentTopicLink(student.id, topicId, { params: defaultParams });

    useAppStore.setState({
      activeStudentId: student.id,
      activeTopicId: topicId,
      activeModeId: resolvedModeId ?? undefined,
      // For reading topics the content is identified by textId, not modeId
      activeTextId: textId ?? null,
      activeText:   null,
    });
    setScreen("session");
  }

  return (
    <StudentHomeScreen
      student={student}
      activeTask={activeTask}
      onStartSession={handleStartSession}
    />
  );
}
