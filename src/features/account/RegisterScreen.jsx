import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function RegisterScreen() {
  const setScreen = useAppStore((s) => s.setScreen);

  const [email,       setEmail]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password,    setPassword]    = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const body = { email, password };
      if (displayName.trim()) body.displayName = displayName.trim();
      const { account, token } = await api.post("/auth/register", body);
      setApiToken(token);

      const [bootstrap, sessionsRaw] = await Promise.all([
        api.get("/account/bootstrap"),
        api.get("/sessions?limit=200"),
      ]);

      const payload = {
        token,
        account,
        settings: bootstrap.settings,
        students: bootstrap.students,
        ownedTopics: bootstrap.ownedTopics,
        studentTopicLinks: bootstrap.studentTopicLinks,
        conceptProgress: bootstrap.conceptProgress,
        sessions: sessionsRaw,
      };

      const db = await getDb();
      await persistBootstrap(db, payload);
      applyBootstrapToStore(payload);
      setScreen("home");
    } catch (err) {
      setError(err.message || "Ошибка регистрации. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
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
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Имя (необязательно)"
          autoComplete="name"
        />
        <input
          className="auth-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль (минимум 8 символов)"
          required
          autoComplete="new-password"
        />
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("login")}>
        Уже есть аккаунт? Войти
      </button>
    </div>
  );
}
