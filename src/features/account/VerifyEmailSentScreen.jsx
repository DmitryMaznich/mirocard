import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

const RESEND_COOLDOWN_MS = 60_000;

export default function VerifyEmailSentScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const email = useAppStore((s) => s.pendingVerificationEmail);
  const resendAvailableAt = useAppStore((s) => s.verificationResendAvailableAt);
  const setResendAvailableAt = useAppStore((s) => s.setVerificationResendAvailableAt);

  const [loading, setLoading] = useState(false);
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
    } catch {
      // silent — server always returns 200
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mironium</div>
      <div className="auth-form">
        <p style={{ textAlign: "center", lineHeight: 1.6 }}>
          Письмо с подтверждением отправлено на{" "}
          <strong>{email || "ваш email"}</strong>.
          <br />
          Нажмите ссылку в письме, чтобы активировать аккаунт.
        </p>
        <p style={{ textAlign: "center", fontSize: "0.88rem", color: "#888" }}>
          Обычно письмо приходит в течение 1–2 минут. Не пришло? Проверьте папку «Спам».
        </p>
        <Button onClick={handleResend} disabled={loading || cooldownActive} fullWidth variant="secondary">
          {loading ? "Отправляем…" : cooldownActive ? "Письмо отправлено, ждём…" : "Отправить повторно"}
        </Button>
      </div>
      <button className="auth-link" onClick={() => setScreen("login")}>
        Вернуться к входу
      </button>
    </div>
  );
}
