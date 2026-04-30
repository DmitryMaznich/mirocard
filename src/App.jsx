import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { setApiToken } from "@/core/api";
import { listTopicRecords } from "@/topics/topicLoader";

import LoginScreen          from "@/features/account/LoginScreen";
import RegisterScreen       from "@/features/account/RegisterScreen";
import HomeScreen           from "@/features/home/HomeScreen";
import StudentsScreen       from "@/features/students/StudentsScreen";
import TopicLibraryScreen   from "@/features/topics/TopicLibraryScreen";
import ModePickerScreen     from "@/features/home/ModePickerScreen";
import ParamsScreen         from "@/features/session/ParamsScreen";
import ConceptPickerScreen  from "@/features/session/ConceptPickerScreen";
import SessionScreen        from "@/features/session/SessionScreen";
import SessionSummary       from "@/features/session/SessionSummary";
import StudentHistoryScreen from "@/features/history/StudentHistoryScreen";
import SettingsScreen       from "@/features/settings/SettingsScreen";

function BootScreen()     { return <div className="screen-center">Загрузка…</div>; }
function NotFoundScreen() { return <div className="screen-center">Экран не найден</div>; }

const SCREENS = {
  boot:     BootScreen,
  login:    LoginScreen,
  register: RegisterScreen,
  home:     HomeScreen,
  students: StudentsScreen,
  topics:   TopicLibraryScreen,
  modes:    ModePickerScreen,
  params:   ParamsScreen,
  concepts: ConceptPickerScreen,
  session:  SessionScreen,
  summary:  SessionSummary,
  history:  StudentHistoryScreen,
  settings: SettingsScreen,
};

export default function App() {
  const screen             = useAppStore((s) => s.screen);
  const setScreen          = useAppStore((s) => s.setScreen);
  const setAccount         = useAppStore((s) => s.setAccount);
  const setToken           = useAppStore((s) => s.setToken);
  const setSettings        = useAppStore((s) => s.setSettings);
  const setStudents        = useAppStore((s) => s.setStudents);
  const setTopicRecords    = useAppStore((s) => s.setTopicRecords);
  const setSessions        = useAppStore((s) => s.setSessions);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setActiveTopicId   = useAppStore((s) => s.setActiveTopicId);
  const setActiveModeId    = useAppStore((s) => s.setActiveModeId);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const [token, account, settings, students, topicRecords, sessions, lastContext] =
        await Promise.all([
          kv.get(db, "token"),
          kv.get(db, "account"),
          kv.get(db, "settings"),
          kv.get(db, "students"),
          listTopicRecords(db),
          kv.get(db, "sessions"),
          kv.get(db, "lastContext"),
        ]);

      if (settings)             setSettings(settings);
      if (students?.length)     setStudents(students);
      if (topicRecords?.length) setTopicRecords(topicRecords);
      if (sessions?.length)     setSessions(sessions.slice(-200));
      if (lastContext) {
        if (lastContext.studentId) setActiveStudentId(lastContext.studentId);
        if (lastContext.topicId)   setActiveTopicId(lastContext.topicId);
        if (lastContext.modeId)    setActiveModeId(lastContext.modeId);
      }

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
