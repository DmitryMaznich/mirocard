import { useEffect, Component, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { api, setApiToken } from "@/core/api";
import { loadLocalBootstrap, applyBootstrapToStore, persistBootstrap, mergeStudents } from "@/core/bootstrap";
import { flushQueue, setupOnlineListener } from "@/core/syncApi";
import { useKioskMode } from "@/shared/hooks/useKioskMode";

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
import AnalogTimer from "@/features/timer/AnalogTimer";


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

export default function App() {
  useKioskMode();

  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const students = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const [isTimerOpen, setIsTimerOpen] = useState(false);

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
  }, []);

  useEffect(() => {
    history.replaceState({ mirocard: 1 }, "");
    const handlePopState = () => history.pushState({ mirocard: 1 }, "");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const activeStudent = students?.find(s => s.id === activeStudentId);
  const rewardVideos = activeStudent?.rewardVideos || [];
  const Screen = SCREENS[screen] ?? NotFoundScreen;

  return (
    <>
      <ErrorBoundary key={screen}>
        <Screen onOpenTimer={() => setIsTimerOpen(true)} />
      </ErrorBoundary>
      {isTimerOpen && <AnalogTimer rewardVideos={rewardVideos} onClose={() => setIsTimerOpen(false)} />}
    </>
  );
}
