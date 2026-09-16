import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

export default function ForgotPasswordScreen() {
  const setScreen = useAppStore((s) => s.setScreen);

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // The backend always returns {ok:true} whether or not the email is
      // registered — it never reveals which, so the UI can't either.
      await api.post("/auth/forgot-password", { email });
    } catch {
      // Best-effort either way — don't leak network/server errors into a
      // signal about whether the account exists.
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="auth-screen">
        <div className="auth-logo">Mironium</div>
        <div className="auth-form" style={{ textAlign: "center", gap: 20 }}>
          <p style={{ fontSize: "1.05rem", color: "#4a9b8f", fontWeight: 600 }}>
            Если такой email зарегистрирован, мы отправили на него ссылку для сброса пароля.
          </p>
          <p style={{ color: "#7c8c89", fontSize: "0.9rem" }}>
            Проверьте папку «Спам», если письма долго нет.
          </p>
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
          Укажите email аккаунта — пришлём ссылку для сброса пароля.
        </p>
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
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Отправляем…" : "Отправить ссылку"}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("login")}>
        Вернуться к входу
      </button>
    </div>
  );
}
