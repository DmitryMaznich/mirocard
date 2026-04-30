import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { setApiToken } from "@/core/api";
import { listTopicRecords } from "@/topics/topicLoader";

import LoginScreen        from "@/features/account/LoginScreen";
import RegisterScreen     from "@/features/account/RegisterScreen";
import StudentsScreen     from "@/features/students/StudentsScreen";
import TopicLibraryScreen from "@/features/topics/TopicLibraryScreen";

function BootScreen() { return <div className="screen-center">Загрузка…</div>; }

function HomeScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const account   = useAppStore((s) => s.account);
  const students  = useAppStore((s) => s.students);
  const topics    = useAppStore((s) => s.topicRecords);
  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">Mirocard</h1>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>Привет, {account?.displayName || account?.email}!</div>
        <div>Учеников: {students.length}</div>
        <div>Тем: {topics.length}</div>
        <button onClick={() => setScreen("students")}>Ученики</button>
        <button onClick={() => setScreen("topics")}>Темы</button>
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
};

export default function App() {
  const screen          = useAppStore((s) => s.screen);
  const setScreen       = useAppStore((s) => s.setScreen);
  const setAccount      = useAppStore((s) => s.setAccount);
  const setToken        = useAppStore((s) => s.setToken);
  const setSettings     = useAppStore((s) => s.setSettings);
  const setStudents     = useAppStore((s) => s.setStudents);
  const setTopicRecords = useAppStore((s) => s.setTopicRecords);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const [token, account, settings, students, topicRecords] = await Promise.all([
        kv.get(db, "token"),
        kv.get(db, "account"),
        kv.get(db, "settings"),
        kv.get(db, "students"),
        listTopicRecords(db),
      ]);

      if (settings)             setSettings(settings);
      if (students?.length)     setStudents(students);
      if (topicRecords?.length) setTopicRecords(topicRecords);

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
    const handlePopState = () => {
      history.pushState({ mirocard: 1 }, "");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const Screen = SCREENS[screen] ?? NotFoundScreen;
  return <Screen />;
}
