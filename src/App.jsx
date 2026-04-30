import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { setApiToken } from "@/core/api";

// Screens (stubs — replaced as features are built)
function BootScreen()     { return <div className="screen-center">Загрузка…</div>; }
function LoginScreen()    { return <div className="screen-center">Вход (скоро)</div>; }
function HomeScreen()     { return <div className="screen-center">Главная (скоро)</div>; }
function NotFoundScreen() { return <div className="screen-center">Экран не найден</div>; }

const SCREENS = {
  boot:     BootScreen,
  login:    LoginScreen,
  register: LoginScreen,
  home:     HomeScreen,
};

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const setAccount = useAppStore((s) => s.setAccount);
  const setToken = useAppStore((s) => s.setToken);
  const setSettings = useAppStore((s) => s.setSettings);

  // Boot: load persisted session from IndexedDB
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const token = await kv.get(db, "token");
      const account = await kv.get(db, "account");
      const settings = await kv.get(db, "settings");

      if (settings) setSettings(settings);

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

  // Back button: push dummy history entry so browser never exits the app
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
