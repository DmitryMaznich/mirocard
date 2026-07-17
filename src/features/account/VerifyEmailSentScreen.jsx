import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

export default function VerifyEmailSentScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const email = useAppStore((s) => s.pendingVerificationEmail);

  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    if (!email || loading) return;
    setLoading(true);
    try {
      await api.post("/auth/resend-verification", { email });
      setSent(true);
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
          Письмо не пришло? Проверьте папку «Спам».
        </p>
        {sent ? (
          <p style={{ textAlign: "center", color: "#4a9b8f", fontSize: "0.92rem" }}>
            Письмо отправлено повторно.
          </p>
        ) : (
          <Button onClick={handleResend} disabled={loading} fullWidth variant="secondary">
            {loading ? "Отправляем…" : "Отправить повторно"}
          </Button>
        )}
      </div>
      <button className="auth-link" onClick={() => setScreen("login")}>
        Вернуться к входу
      </button>
    </div>
  );
}
