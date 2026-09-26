import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { getDb } from "@/core/db";
import { ApiError } from "@/core/api";
import { persistBootstrap, applyBootstrapToStore } from "@/core/bootstrap";
import { completeLogin } from "./completeLogin";
import { fetchSignupStatus } from "./signupStatus";
import GoogleSignInButton from "./GoogleSignInButton";
import Button from "@/shared/components/Button";

export default function LoginScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setPendingVerificationEmail = useAppStore((s) => s.setPendingVerificationEmail);

  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [error,          setError]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [showResendHint, setShowResendHint] = useState(false);
  const [google,         setGoogle]         = useState(null);
  // Read once: a one-shot message from an earlier step (e.g. failed Google sign-in).
  const [notice] = useState(() => useAppStore.getState().authNotice);

  useEffect(() => {
    let alive = true;
    fetchSignupStatus().then((s) => { if (alive) setGoogle(s.google); });
    return () => {
      alive = false;
      useAppStore.setState({ authNotice: null });
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { account, token } = await api.post("/auth/login", { email, password });
      await completeLogin({ account, token });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === "email_not_verified") {
        setPendingVerificationEmail(email);
        setShowResendHint(true);
        setError("Email не подтверждён. Проверьте почту или запросите новое письмо.");
      } else {
        setError(err.message || "Ошибка входа. Проверьте email и пароль.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalMode() {
    const account = { email: "local", displayName: "Локальный режим" };
    const db = await getDb();
    const payload = { account, token: null };
    await persistBootstrap(db, payload);
    applyBootstrapToStore(payload);
    setScreen("home");
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mironium</div>
      {notice && <p className="auth-notice auth-notice--standalone">{notice}</p>}
      {google && (
        <div className="auth-google">
          <GoogleSignInButton clientId={google.clientId} text="signin_with" />
          <div className="auth-divider"><span>или по почте</span></div>
        </div>
      )}
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
        <div className="auth-password-wrap">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            required
            autoComplete="current-password"
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
        <button
          type="button"
          className="auth-link auth-link--forgot"
          onClick={() => setScreen("forgot_password")}
        >
          Забыли пароль?
        </button>
        {showResendHint && (
          <button
            type="button"
            className="auth-link"
            onClick={() => setScreen("verify_email_sent")}
          >
            Открыть страницу подтверждения
          </button>
        )}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Входим…" : "Войти"}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("register")}>
        Нет аккаунта? Зарегистрироваться
      </button>
      {/* Hidden from ordinary visitors: work done in local mode silently
          vanishes once they register (launch testing finding N9). Kept
          reachable via ?local=1 for the owner/dev. */}
      {new URLSearchParams(window.location.search).has("local") && (
        <button className="auth-link auth-link--local" onClick={handleLocalMode}>
          Без аккаунта (локальный режим)
        </button>
      )}
    </div>
  );
}
