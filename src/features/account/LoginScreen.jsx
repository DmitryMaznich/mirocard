import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import Button from "@/shared/components/Button";

export default function LoginScreen() {
  const setScreen  = useAppStore((s) => s.setScreen);
  const setAccount = useAppStore((s) => s.setAccount);
  const setToken   = useAppStore((s) => s.setToken);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { account, token } = await api.post("/auth/login", { email, password });
      const db = await getDb();
      await kv.set(db, "token",   token);
      await kv.set(db, "account", account);
      setApiToken(token);
      setToken(token);
      setAccount(account);
      setScreen("home");
    } catch (err) {
      setError(err.message || "Ошибка входа. Проверьте email и пароль.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalMode() {
    const account = { email: "local", displayName: "Локальный режим" };
    const db = await getDb();
    await kv.set(db, "account", account);
    setAccount(account);
    setScreen("home");
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mirocard</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoFocus
          autoComplete="email"
        />
        <input
          className="auth-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          required
          autoComplete="current-password"
        />
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Входим…" : "Войти"}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("register")}>
        Нет аккаунта? Зарегистрироваться
      </button>
      <button className="auth-link auth-link--local" onClick={handleLocalMode}>
        Без аккаунта (локальный режим)
      </button>
    </div>
  );
}
