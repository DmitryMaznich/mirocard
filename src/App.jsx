import { useCallback, useEffect, Component } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api, setApiToken } from "@/core/api";
import { loadLocalBootstrap, applyBootstrapToStore, persistBootstrap, mergeStudents } from "@/core/bootstrap";
import { flushQueue, setupOnlineListener } from "@/core/syncApi";
import { useKioskMode } from "@/shared/hooks/useKioskMode";
import { useBackButtonGuard } from "@/shared/hooks/useBackButtonGuard";
import { getActiveOrientationLock } from "@/shared/utils/orientationLock";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import HoldButton from "@/shared/components/HoldButton";

import LoginScreen from "@/features/account/LoginScreen";
import RegisterScreen from "@/features/account/RegisterScreen";
import HomeScreen from "@/features/home/HomeScreen";
import StudentsScreen from "@/features/students/StudentsScreen";
import StudentEditScreen from "@/features/students/StudentEditScreen";
import TopicLibraryScreen from "@/features/topics/TopicLibraryScreen";
import TextPickerScreen from "@/features/reading/TextPickerScreen";
import ModePickerScreen from "@/features/home/ModePickerScreen";
import ParamsScreen from "@/features/session/ParamsScreen";
import ConceptPickerScreen from "@/features/session/ConceptPickerScreen";
import SessionScreen from "@/features/session/SessionScreen";
import SessionSummary from "@/features/session/SessionSummary";
import StudentHistoryScreen from "@/features/history/StudentHistoryScreen";
import SettingsScreen from "@/features/settings/SettingsScreen";
import GlobalTimer from "@/features/timer/GlobalTimer";
import { useTimer } from "@/features/timer/TimerContext";
import InstallBanner from "@/shared/components/InstallBanner";


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
  home: HomeScreen,
  students: StudentsScreen,
  student_edit: StudentEditScreen,
  topics: TopicLibraryScreen,
  texts: TextPickerScreen,
  modes: ModePickerScreen,
  params: ParamsScreen,
  concepts: ConceptPickerScreen,
  session: SessionScreen,
  summary: SessionSummary,
  history: StudentHistoryScreen,
  settings: SettingsScreen,
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
  const closeTimer = useCallback(() => setIsOpen(false), [setIsOpen]);

  useEffect(() => {
    if (screen === "home") resetSession();
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishSessionFromPrompt = useCallback(() => {
    closeSessionExitPrompt();
    setScreen("home");
  }, [closeSessionExitPrompt, setScreen]);

  const showSessionExitPrompt = screen === "session" && sessionExitPromptOpen;
  const orientationLock = getActiveOrientationLock({ screen, topicRecords, activeTopicId, activeModeId });

  useKioskMode(orientationLock);

  useBackButtonGuard({
    isTimerOpen,
    onCloseTimer: closeTimer,
    isSessionExitPromptOpen: showSessionExitPrompt,
    onCloseSessionExitPrompt: closeSessionExitPrompt,
    onRequestSessionExit: openSessionExitPrompt,
  });

  useEffect(() => {
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
          setScreen("home");

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
                account: bootstrap.account,
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
  }, [setScreen]);

  // Re-sync from server whenever the tab becomes visible (e.g. user switches back
  // from another app/tab). Throttled to once per 30 s so it's cheap in normal use.
  // This ensures Device B automatically picks up changes made on Device A.
  useEffect(() => {
    let lastSyncAt = 0;
    async function onVisible() {
      if (document.hidden) return;
      if (!useAppStore.getState().token) return;
      if (Date.now() - lastSyncAt < 30_000) return;
      lastSyncAt = Date.now();
      try {
        const db = await getDb();
        const serverBootstrap = await api.get("/account/bootstrap");
        const localStudents = useAppStore.getState().students;
        const merged = mergeStudents(localStudents, serverBootstrap.students);
        const payload = {
          settings: serverBootstrap.settings,
          students: merged,
          ownedTopics: serverBootstrap.ownedTopics,
          studentTopicLinks: serverBootstrap.studentTopicLinks,
          conceptProgress: serverBootstrap.conceptProgress,
        };
        await persistBootstrap(db, payload);
        applyBootstrapToStore(payload);
      } catch {}
      flushQueue().catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const activeStudent = students?.find(s => s.id === activeStudentId);
  const rewardVideos = activeStudent?.rewardVideos || [];
  const Screen = SCREENS[screen] ?? NotFoundScreen;

  return (
    <>
      <GlobalTimer rewardVideos={rewardVideos} />
      <ErrorBoundary key={screen}>
        <Screen />
      </ErrorBoundary>
      <OrientationGuard orientationLock={orientationLock} />
      {screen !== "boot" && screen !== "session" && <InstallBanner />}
      {showSessionExitPrompt && (
        <Modal
          title="Завершить занятие?"
          onClose={closeSessionExitPrompt}
          actions={
            <>
              <Button variant="secondary" onClick={closeSessionExitPrompt}>Остаться</Button>
              <HoldButton className="btn btn--danger" onAction={finishSessionFromPrompt}>Завершить</HoldButton>
            </>
          }
        >
          Текущий прогресс занятия не будет сохранён.
        </Modal>
      )}
    </>
  );
}
