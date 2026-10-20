import MironiumLogo from "@/shared/components/MironiumLogo";
import { useEffect, useState } from "react";
import { authErrorKey } from "./authErrors";
import { loginDiagnosticCode } from "./loginDiagnostics";
import UiLanguagePicker from "@/shared/components/UiLanguagePicker";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
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
  const { language, t } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const setPendingVerificationEmail = useAppStore((s) => s.setPendingVerificationEmail);

  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [error,          setError]          = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [loading,        setLoading]        = useState(false);
  const [showResendHint, setShowResendHint] = useState(false);
  const [google,         setGoogle]         = useState(null);
  // Read once: a one-shot message from an earlier step (e.g. failed Google sign-in).
  const [initialNotice] = useState(() => useAppStore.getState().authNotice);
  const incomingNotice = useAppStore((s) => s.authNotice);
  const notice = incomingNotice ?? initialNotice;

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
    setDiagnostic("");
    setLoading(true);
    try {
      const { account, token } = await api.post("/auth/login", { email, password });
      await completeLogin({ account, token });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === "email_not_verified") {
        setPendingVerificationEmail(email);
        setShowResendHint(true);
        setError("auth.emailNotVerified");
      } else {
        setError(authErrorKey(err) ?? "auth.loginFailed");
        if (!authErrorKey(err)) setDiagnostic(loginDiagnosticCode(err, "password-request"));
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
      <MironiumLogo className="auth-logo" />
      <UiLanguagePicker />
      {notice && <p className="auth-notice auth-notice--standalone">{typeof notice === "string" ? notice : t(notice.key)}</p>}
      {notice?.diagnostic && <p className="auth-notice"><small>{t("auth.supportCode")}: {notice.diagnostic}</small></p>}
      {google && (
        <div className="auth-google">
          <GoogleSignInButton clientId={google.clientId} text="signin_with" locale={language} />
          <div className="auth-divider"><span>{t("auth.orEmail")}</span></div>
        </div>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.email")}
          aria-label={t("auth.email")}
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
            placeholder={t("auth.password")}
            aria-label={t("auth.password")}
            required
            autoComplete="current-password"
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
        {error && <div className="form-error" role="alert">{t(error)}</div>}
        {diagnostic && <p className="auth-notice"><small>{t("auth.supportCode")}: {diagnostic}</small></p>}
        <button
          type="button"
          className="auth-link auth-link--forgot"
          onClick={() => setScreen("forgot_password")}
        >
          {t("auth.forgotPassword")}
        </button>
        {showResendHint && (
          <button
            type="button"
            className="auth-link"
            onClick={() => setScreen("verify_email_sent")}
          >
            {t("auth.openVerification")}
          </button>
        )}
        <Button type="submit" disabled={loading} fullWidth>
          {t(loading ? "auth.signingIn" : "auth.signIn")}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("register")}>
        {t("auth.register")}
      </button>
      <small className="auth-build">v{useAppStore.getState().buildInfo.version}</small>
      {/* Hidden from ordinary visitors: work done in local mode silently
          vanishes once they register (launch testing finding N9). Kept
          reachable via ?local=1 for the owner/dev. */}
      {new URLSearchParams(window.location.search).has("local") && (
        <button className="auth-link auth-link--local" onClick={handleLocalMode}>
          {t("auth.localMode")}
        </button>
      )}
    </div>
  );
}
