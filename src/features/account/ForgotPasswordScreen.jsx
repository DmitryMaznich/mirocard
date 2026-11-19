import MironiumLogo from "@/shared/components/MironiumLogo";
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

export default function ForgotPasswordScreen() {
  const { t } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [budgetError, setBudgetError] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setBudgetError(false);
    let exhausted = false;
    try {
      // The backend always returns {ok:true} whether or not the email is
      // registered — it never reveals which, so the UI can't either.
      await api.post("/auth/forgot-password", { email });
    } catch (err) {
      // Best-effort either way — don't leak network/server errors into a
      // signal about whether the account exists. The one exception is the
      // global daily email budget: it says nothing about any account.
      exhausted = err?.status === 503;
    } finally {
      setLoading(false);
      if (exhausted) setBudgetError(true);
      else setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="auth-screen">
        <MironiumLogo className="auth-logo" />
        <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
          <p style={{ fontSize: "1.05rem", color: "#4a9b8f", fontWeight: 600 }}>
            {t("auth.resetSent")}
          </p>
          <p style={{ color: "#7c8c89", fontSize: "0.9rem" }}>
            {t("auth.checkSpam")}
          </p>
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
          {t("auth.forgotIntro")}
        </p>
        <input
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.email")}
          required
          autoFocus
          autoComplete="email"
        />
        {budgetError && <p className="auth-notice">{t("auth.emailBudgetExhausted")}</p>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? t("auth.sending") : t("auth.sendLink")}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("login")}>
        {t("auth.backToLogin")}
      </button>
    </div>
  );
}
