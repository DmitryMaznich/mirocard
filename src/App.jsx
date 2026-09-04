import { useCallback, useEffect, Component } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api, setApiToken } from "@/core/api";
import { loadLocalBootstrap, applyBootstrapToStore, persistBootstrap, mergeStudents } from "@/core/bootstrap";
import { flushQueue, setupOnlineListener } from "@/core/syncApi";
import { useKioskMode } from "@/shared/hooks/useKioskMode";
import { useHeartbeat } from "@/shared/hooks/useHeartbeat";
import { useBackButtonGuard } from "@/shared/hooks/useBackButtonGuard";
import { getActiveOrientationLock } from "@/shared/utils/orientationLock";
import { clearActiveSessionSnapshot as clearPersistedActiveSessionSnapshot, canResumeActiveSession } from "@/features/session/activeSession";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";

import LoginScreen from "@/features/account/LoginScreen";
import RegisterScreen from "@/features/account/RegisterScreen";
import VerifyEmailSentScreen from "@/features/account/VerifyEmailSentScreen";
import VerifyEmailScreen from "@/features/account/VerifyEmailScreen";
import HomeScreen from "@/features/home/HomeScreen";
import StudentsScreen from "@/features/students/StudentsScreen";
import StudentEditScreen from "@/features/students/StudentEditScreen";
import TopicLibraryScreen from "@/features/topics/TopicLibraryScreen";
import TextPickerScreen from "@/features/reading/TextPickerScreen";
import AllTextsScreen from "@/features/reading/AllTextsScreen";
import ModePickerScreen from "@/features/home/ModePickerScreen";
import ParamsScreen from "@/features/session/ParamsScreen";
import ConceptPickerScreen from "@/features/session/ConceptPickerScreen";
import SessionScreen from "@/features/session/SessionScreen";
import SessionSummary from "@/features/session/SessionSummary";
import ChatSessionScreen from "@/features/chat/ChatSessionScreen";
import ChatParamsScreen from "@/features/chat/ChatParamsScreen";
import StudentHistoryScreen from "@/features/history/StudentHistoryScreen";
import SettingsScreen from "@/features/settings/SettingsScreen";
import AccountScreen from "@/features/settings/AccountScreen";
import GlobalTimer from "@/features/timer/GlobalTimer";
import { useTimer } from "@/features/timer/TimerContext";
import InstallBanner from "@/shared/components/InstallBanner";
import PlannerMenuScreen from "@/features/planner/PlannerMenuScreen";
import PlannerShoppingScreen from "@/features/planner/PlannerShoppingScreen";
import PlannerPutawayScreen from "@/features/planner/PlannerPutawayScreen";
import InstructionRunnerScreen from "@/features/instructions/InstructionRunnerScreen";
import InstructionConstructorScreen from "@/features/instructions/InstructionConstructorScreen";
import PeriodPlanScreen from "@/features/lessonPlan/PeriodPlanScreen";
import LessonPlanHistoryScreen from "@/features/lessonPlan/LessonPlanHistoryScreen";

function BootScreen() { return <div className="screen-center">Загрузка…</div>; }
function NotFoundScreen() { return <div className="screen-center">Экран не найден</div>; }

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "red" }}>
          <strong>Ошибка рендера:</strong>{"\n"}
          {String(this.state.error)}{"\n\n"}
          {this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

const SCREENS = {
  boot: BootScreen,
  login: LoginScreen,
  register: RegisterScreen,
  verify_email_sent: VerifyEmailSentScreen,
  verify_email: VerifyEmailScreen,
  home: HomeScreen,
  students: StudentsScreen,
  student_edit: StudentEditScreen,
  topics: TopicLibraryScreen,
  texts: TextPickerScreen,
  all_texts: AllTextsScreen,
  modes: ModePickerScreen,
  params: ParamsScreen,
  concepts: ConceptPickerScreen,
  session: SessionScreen,
  summary: SessionSummary,
  chat_params: ChatParamsScreen,
  chat_session: ChatSessionScreen,
  history: StudentHistoryScreen,
  settings: SettingsScreen,
  account: AccountScreen,
  planner_menu: PlannerMenuScreen,
  planner_shopping: PlannerShoppingScreen,
  planner_putaway: PlannerPutawayScreen,
  instruction_runner: InstructionRunnerScreen,
  instruction_constructor: InstructionConstructorScreen,
  lesson_plan_period: PeriodPlanScreen,
  lesson_plan_history: LessonPlanHistoryScreen,
};

function OrientationGuard({ orientationLock }) {
  if (!orientationLock) return null;
  const isLandscape = orientationLock.startsWith("landscape");

  return (
    <div className={`orientation-guard orientation-guard--active orientation-guard--${isLandscape ? "landscape" : "portrait"}`}>
      <div className="orientation-guard-card">
        <div className="orientation-guard-icon">↻</div>
        <div className="orientation-guard-title">
          {isLandscape ? "Поверните экран горизонтально" : "Поверните экран вертикально"}
        </div>
        <div className="orientation-guard-text">
          Этот режим рассчитан на {isLandscape ? "горизонтальную" : "вертикальную"} ориентацию экрана.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const students = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const activeModeId = useAppStore((s) => s.activeModeId);
  const { isOpen: isTimerOpen, setIsOpen, resetSession } = useTimer();
  const sessionExitPromptOpen  = useAppStore((s) => s.sessionExitPromptOpen);
  const openSessionExitPrompt  = useAppStore((s) => s.openSessionExitPrompt);
  const closeSessionExitPrompt = useAppStore((s) => s.closeSessionExitPrompt);
  const clearActiveSessionSnapshot = useAppStore((s) => s.clearActiveSessionSnapshot);
  const sessionReturnScreen    = useAppStore((s) => s.sessionReturnScreen);
  const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);
  const setVerifyEmailToken = useAppStore((s) => s.setVerifyEmailToken);
  const closeTimer = useCallback(() => setIsOpen(false), [setIsOpen]);

  useEffect(() => {
    if (screen !== "session") resetSession();
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishSessionFromPrompt = useCallback(async () => {
    closeSessionExitPrompt();
    clearActiveSessionSnapshot();
    try {
      const db = await getDb();
      await clearPersistedActiveSessionSnapshot(db);
    } catch {
      // Local cleanup is best-effort; navigation should still proceed.
    }
    setScreen(sessionReturnScreen ?? "home");
    setSessionReturnScreen(null);
  }, [clearActiveSessionSnapshot, closeSessionExitPrompt, setScreen, sessionReturnScreen, setSessionReturnScreen]);

  const showSessionExitPrompt = screen === "session" && sessionExitPromptOpen;
  const orientationLock = getActiveOrientationLock({ screen, topicRecords, activeTopicId, activeModeId });

  useKioskMode(orientationLock);
  useHeartbeat();

  useBackButtonGuard({
    screen,
    isTimerOpen,
    onCloseTimer: closeTimer,
    isSessionExitPromptOpen: showSessionExitPrompt,
    onCloseSessionExitPrompt: closeSessionExitPrompt,
    onRequestSessionExit: openSessionExitPrompt,
  });

  useEffect(() => {
    // Handle /verify-email?token= deep links before normal boot
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get("token");
    if (window.location.pathname === "/verify-email" && verifyToken) {
      setVerifyEmailToken(verifyToken);
      window.history.replaceState({}, "", "/");
      setScreen("verify_email");
      return;
    }

    (async () => {
      try {
        const _t0 = performance.now();
        const db = await getDb();
        console.log(`[boot] db ${(performance.now()-_t0).toFixed(0)}ms`);

        const _t1 = performance.now();
        const bootstrap = await loadLocalBootstrap(db);
        console.log(`[boot] localBootstrap ${(performance.now()-_t1).toFixed(0)}ms (topics:${bootstrap.topicRecords?.length}, sessions:${bootstrap.sessions?.length})`);
        applyBootstrapToStore(bootstrap);

        if (bootstrap.token && bootstrap.account) {
          setApiToken(bootstrap.token);
          setupOnlineListener();
          const resumable = canResumeActiveSession(bootstrap.activeSession, bootstrap.topicRecords);
          setScreen(resumable ? "session" : "home");
          if (bootstrap.activeSession?.sessionState && !resumable) {
            useAppStore.setState({ activeSessionSnapshot: null });
            clearPersistedActiveSessionSnapshot(db).catch(() => {});
          }

          (async () => {
            try {
              const _t2 = performance.now();
              const [serverBootstrap, sessionsRaw] = await Promise.all([
                api.get("/account/bootstrap"),
                api.get("/sessions?limit=200"),
              ]);
              console.log(`[boot] serverBootstrap ${(performance.now()-_t2).toFixed(0)}ms (students:${serverBootstrap.students?.length}, sessions:${sessionsRaw?.length})`);
              const localStudents = useAppStore.getState().students;
              const merged = mergeStudents(localStudents, serverBootstrap.students);
              const payload = {
                token: bootstrap.token,
                account: serverBootstrap.account,
                settings: serverBootstrap.settings,
                students: merged,
                ownedTopics: serverBootstrap.ownedTopics,
                studentTopicLinks: serverBootstrap.studentTopicLinks,
                conceptProgress: serverBootstrap.conceptProgress,
                sessions: sessionsRaw,
              };
              const _t3 = performance.now();
              await persistBootstrap(db, payload);
              console.log(`[boot] persistBootstrap ${(performance.now()-_t3).toFixed(0)}ms`);
              applyBootstrapToStore(payload);
            } catch (err) {
              if (err?.status === 401) setScreen("login");
            }
            flushQueue().catch(() => {});
          })();
        } else {
          setScreen("login");
        }
      } catch {
        setScreen("login");
      }
    })();
  }, [setScreen, setVerifyEmailToken]);

  // Re-sync from server whenever the tab becomes visible or every 20 s while active.
  // This ensures Device B picks up changes made on Device A even if the tab never hides.
  useEffect(() => {
    let lastSyncAt = 0;
    let syncing = false;
    async function syncFromServer({ force = false } = {}) {
      if (!useAppStore.getState().token) return;
      if (syncing) return;
      if (!force && Date.now() - lastSyncAt < 15_000) return;
      syncing = true;
      lastSyncAt = Date.now();
      try {
        const db = await getDb();
        const [serverBootstrap, sessionsRaw] = await Promise.all([
          api.get("/account/bootstrap"),
          api.get("/sessions?limit=200"),
        ]);
        const localStudents = useAppStore.getState().students;
        const merged = mergeStudents(localStudents, serverBootstrap.students);
        const payload = {
          account: serverBootstrap.account,
          settings: serverBootstrap.settings,
          students: merged,
          ownedTopics: serverBootstrap.ownedTopics,
          studentTopicLinks: serverBootstrap.studentTopicLinks,
          conceptProgress: serverBootstrap.conceptProgress,
          sessions: sessionsRaw,
          kvStore: serverBootstrap.kvStore,
        };
        await persistBootstrap(db, payload);
        applyBootstrapToStore(payload);
      } catch {}
      syncing = false;
      flushQueue().catch(() => {});
    }
    // Visibility change always syncs immediately — user explicitly switched to this device.
    function onVisible() { if (!document.hidden) syncFromServer({ force: true }); }
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(syncFromServer, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  const activeStudent = students?.find(s => s.id === activeStudentId);
  const rewardVideos = activeStudent?.rewardVideos || [];
  const Screen = SCREENS[screen] ?? NotFoundScreen;
  const activeTopicRecord = topicRecords.find(r => r.meta.id === activeTopicId);
  const timerEnabled = activeTopicRecord?.meta?.requiresTimer === true;

  return (
    <>
      {timerEnabled && <GlobalTimer rewardVideos={rewardVideos} />}
      <ErrorBoundary key={screen}>
        <Screen />
      </ErrorBoundary>
      <OrientationGuard orientationLock={orientationLock} />
      {screen !== "boot" && screen !== "session" && <InstallBanner />}
      {showSessionExitPrompt && (
        <Modal
          title="Завершить занятие?"
          onClose={closeSessionExitPrompt}
          closeOnOverlay={false}
          showCloseButton={false}
          actions={
            <>
              <Button variant="secondary" onClick={closeSessionExitPrompt}>Остаться</Button>
              <Button variant="danger" onClick={finishSessionFromPrompt}>Завершить</Button>
            </>
          }
        >
          Текущий прогресс занятия не будет сохранён.
        </Modal>
      )}
    </>
  );
}
