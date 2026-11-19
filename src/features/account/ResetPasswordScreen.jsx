import MironiumLogo from "@/shared/components/MironiumLogo";
import { useState } from "react";
import { authErrorMessage } from "./authErrors";
import { useAppStore } from "@/core/store";
import { api, setApiToken, ApiError } from "@/core/api";
import { getDb } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore } from "@/core/bootstrap";
import Button from "@/shared/components/Button";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

export default function ResetPasswordScreen() {
  const { t } = useUiTranslation();
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
      setError(t("auth.shortPassword"));
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
        builtinVisibility: bootstrap.builtinVisibility ?? {},
        archivedTopicIds: bootstrap.archivedTopicIds ?? [],
          erasedStudentIds: bootstrap.erasedStudentIds ?? [],
          subscription: bootstrap.subscription ?? null,
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
        setError(authErrorMessage(err, t("auth.resetFailed")));
      }
    } finally {
      setLoading(false);
    }
  }

  if (invalidOrExpired) {
    return (
      <div className="auth-screen">
        <MironiumLogo className="auth-logo" />
        <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
          <p style={{ color: "#c0392b" }}>
            {t("auth.linkInvalid")}
          </p>
          <Button onClick={() => setScreen("forgot_password")} fullWidth variant="secondary">
            {t("auth.requestNewLink")}
          </Button>
          <button className="auth-link" onClick={() => setScreen("login")}>
            {t("auth.backToLogin")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <MironiumLogo className="auth-logo" />
      <form className="auth-form" onSubmit={handleSubmit}>
        <p style={{ color: "#7c8c89", fontSize: "0.9rem", margin: "0 0 4px" }}>
          {t("auth.newPasswordIntro")}
        </p>
        <div className="auth-password-wrap">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.newPasswordPlaceholder")}
            required
            autoFocus
            autoComplete="new-password"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPass((v) => !v)}
            tabIndex={-1}
            aria-label={t(showPass ? "auth.hidePassword" : "auth.showPassword")}
          >
            {showPass ? "🙈" : "👁"}
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? t("auth.saving") : t("auth.saveNewPassword")}
        </Button>
      </form>
    </div>
  );
}
