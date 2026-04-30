import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { setApiToken } from "@/core/api";
import { listTopicRecords } from "@/topics/topicLoader";

import LoginScreen        from "@/features/account/LoginScreen";
import RegisterScreen     from "@/features/account/RegisterScreen";
import StudentsScreen     from "@/features/students/StudentsScreen";
import TopicLibraryScreen from "@/features/topics/TopicLibraryScreen";
import ModePickerScreen   from "@/features/home/ModePickerScreen";
import SessionScreen      from "@/features/session/SessionScreen";
import SessionSummary     from "@/features/session/SessionSummary";

function BootScreen() { return <div className="screen-center">Загрузка…</div>; }

function HomeScreen() {
  const setScreen          = useAppStore((s) => s.setScreen);
  const account            = useAppStore((s) => s.account);
  const students           = useAppStore((s) => s.students);
  const topics             = useAppStore((s) => s.topicRecords);
  const setActiveTopicId   = useAppStore((s) => s.setActiveTopicId);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);

  function quickStart() {
    if (!students[0] || !topics[0]) return;
    setActiveStudentId(students[0].id);
    setActiveTopicId(topics[0].meta.id);
    setScreen("modes");
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">Mirocard</h1>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {account && <div>👋 {account.displayName || account.email}</div>}
        <button className="mode-item" onClick={() => setScreen("students")}>
          <div className="mode-item__title">Ученики ({students.length})</div>
        </button>
        <button className="mode-item" onClick={() => setScreen("topics")}>
          <div className="mode-item__title">Темы ({topics.length})</div>
        </button>
        {students.length > 0 && topics.length > 0 && (
          <button className="mode-item" onClick={quickStart}>
            <div className="mode-item__title">▶ Начать занятие</div>
            <div className="mode-item__desc">
              {students[0].name} · {topics[0].meta.title}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

function NotFoundScreen() { return <div className="screen-center">Экран не найден</div>; }

const SCREENS = {
  boot:     BootScreen,
  login:    LoginScreen,
  register: RegisterScreen,
  home:     HomeScreen,
  students: StudentsScreen,
  topics:   TopicLibraryScreen,
  modes:    ModePickerScreen,
  session:  SessionScreen,
  summary:  SessionSummary,
};

export default function App() {
  const screen          = useAppStore((s) => s.screen);
  const setScreen       = useAppStore((s) => s.setScreen);
  const setAccount      = useAppStore((s) => s.setAccount);
  const setToken        = useAppStore((s) => s.setToken);
  const setSettings     = useAppStore((s) => s.setSettings);
  const setStudents     = useAppStore((s) => s.setStudents);
  const setTopicRecords = useAppStore((s) => s.setTopicRecords);
  const setSessions     = useAppStore((s) => s.setSessions);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const [token, account, settings, students, topicRecords, sessions] = await Promise.all([
        kv.get(db, "token"),
        kv.get(db, "account"),
        kv.get(db, "settings"),
        kv.get(db, "students"),
        listTopicRecords(db),
        kv.get(db, "sessions"),
      ]);

      if (settings)             setSettings(settings);
      if (students?.length)     setStudents(students);
      if (topicRecords?.length) setTopicRecords(topicRecords);
      if (sessions?.length)     setSessions(sessions.slice(-200));

      if (token && account) {
        setApiToken(token);
        setToken(token);
        setAccount(account);
        setScreen("home");
      } else {
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

  const Screen = SCREENS[screen] ?? NotFoundScreen;
  return <Screen />;
}
