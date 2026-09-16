import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api, setApiToken, ApiError } from "@/core/api";
import { getDb } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore } from "@/core/bootstrap";
import Button from "@/shared/components/Button";

export default function ResetPasswordScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const token = useAppStore((s) => s.passwordResetToken);

  const [password,        setPassword]        = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [invalidOrExpired, setInvalidOrExpired] = useState(!token);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { account, settings, token: authToken } = await api.post("/auth/reset-password", {
        token,
        newPassword: password,
      });
      setApiToken(authToken);

      const [bootstrap, sessionsRaw] = await Promise.all([
        api.get("/account/bootstrap"),
        api.get("/sessions?limit=200"),
      ]);

      const payload = {
        token: authToken,
        account,
        settings: settings ?? bootstrap.settings,
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
      if (err instanceof ApiError && err.status === 400) {
        setInvalidOrExpired(true);
      } else {
        setError(err.message || "Не удалось сохранить новый пароль. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (invalidOrExpired) {
    return (
      <div className="auth-screen">
        <div className="auth-logo">Mironium</div>
        <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
          <p style={{ color: "#c0392b" }}>
            Ссылка недействительна или срок её действия истёк.
          </p>
          <Button onClick={() => setScreen("forgot_password")} fullWidth variant="secondary">
            Запросить новую ссылку
          </Button>
          <button className="auth-link" onClick={() => setScreen("login")}>
            Вернуться к входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mironium</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p style={{ color: "#7c8c89", fontSize: "0.9rem", margin: "0 0 4px" }}>
          Придумайте новый пароль.
        </p>
        <div className="auth-password-wrap">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Новый пароль (минимум 8 символов)"
            required
            autoFocus
            autoComplete="new-password"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPass((v) => !v)}
            tabIndex={-1}
            aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPass ? "🙈" : "👁"}
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Сохраняем…" : "Сохранить новый пароль"}
        </Button>
      </form>
    </div>
  );
}
