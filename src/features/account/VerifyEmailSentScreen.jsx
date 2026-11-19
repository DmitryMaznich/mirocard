import MironiumLogo from "@/shared/components/MironiumLogo";
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

const RESEND_COOLDOWN_MS = 60_000;

export default function VerifyEmailSentScreen() {
  const { t } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const email = useAppStore((s) => s.pendingVerificationEmail);
  const resendAvailableAt = useAppStore((s) => s.verificationResendAvailableAt);
  const setResendAvailableAt = useAppStore((s) => s.setVerificationResendAvailableAt);

  const [loading, setLoading] = useState(false);
  const [budgetError, setBudgetError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const cooldownActive = now < resendAvailableAt;

  // Ticks so a cooldown started before this screen was last mounted (or in
  // a previous mount, since the timestamp lives in the store) still clears
  // on its own instead of staying disabled until the next click.
  useEffect(() => {
    if (!cooldownActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownActive]);

  async function handleResend() {
    if (!email || loading || cooldownActive) return;
    setLoading(true);
    try {
      await api.post("/auth/resend-verification", { email });
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
    } catch (err) {
      // Otherwise silent — the server answers 200 whether or not the account exists.
      if (err?.status === 503) setBudgetError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <MironiumLogo className="auth-logo" />
      <div className="auth-form">
        <p style={{ textAlign: "center", lineHeight: 1.6 }}>
          {t("auth.verifySentTo")}{" "}
          <strong>{email || t("auth.yourEmail")}</strong>.
          <br />
          {t("auth.verifyClickLink")}
        </p>
        <p style={{ textAlign: "center", fontSize: "0.88rem", color: "#888" }}>
          {t("auth.verifyHint")}
        </p>
        {budgetError && <p className="auth-notice">{t("auth.emailBudgetExhausted")}</p>}
        <Button onClick={handleResend} disabled={loading || cooldownActive} fullWidth variant="secondary">
          {loading ? t("auth.sending") : cooldownActive ? t("auth.sentWaiting") : t("auth.resend")}
        </Button>
      </div>
      <button className="auth-link" onClick={() => setScreen("login")}>
        {t("auth.backToLogin")}
      </button>
    </div>
  );
}
