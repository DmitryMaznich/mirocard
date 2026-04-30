import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import Button from "@/shared/components/Button";

export default function RegisterScreen() {
  const setScreen  = useAppStore((s) => s.setScreen);
  const setAccount = useAppStore((s) => s.setAccount);
  const setToken   = useAppStore((s) => s.setToken);

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
      const db = await getDb();
      await kv.set(db, "token",   token);
      await kv.set(db, "account", account);
      setApiToken(token);
      setToken(token);
      setAccount(account);
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
