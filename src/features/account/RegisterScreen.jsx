import MironiumLogo from "@/shared/components/MironiumLogo";
import { useEffect, useState } from "react";
import { authErrorMessage } from "./authErrors";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import PrivacyContent from "@/features/help/PrivacyContent";
import { fetchSignupStatus } from "./signupStatus";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import GoogleSignInButton from "./GoogleSignInButton";

export default function RegisterScreen() {
  const { t } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const setPendingVerificationEmail = useAppStore((s) => s.setPendingVerificationEmail);

  const [email,         setEmail]         = useState("");
  const [firstName,     setFirstName]     = useState("");
  const [lastName,      setLastName]      = useState("");
  const [role,          setRole]          = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [password,      setPassword]      = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [consent,       setConsent]       = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showPrivacy,   setShowPrivacy]   = useState(false);
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [status,        setStatus]        = useState(null);

  useEffect(() => {
    let alive = true;
    fetchSignupStatus().then((s) => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, []);

  const emailSignupClosed = status?.emailSignupOpen === false;

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("auth.shortPassword"));
      return;
    }
    if (!consent) {
      setError(t("auth.consentRequired"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/register", {
        email,
        password,
        firstName,
        lastName,
        role,
        referralSource,
        consentPersonalData: true,
        marketingOptIn,
      });
      setPendingVerificationEmail(email);
      setScreen("verify_email_sent");
    } catch (err) {
      if (err.status === 503 && err.message === "signup_paused_email_budget") {
        setStatus((s) => ({ ...(s ?? { google: null }), emailSignupOpen: false }));
      } else if (err.status === 409) {
        setError(t("auth.emailRegistered"));
      } else {
        setError(authErrorMessage(err, t("auth.registerFailed")));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <MironiumLogo className="auth-logo" />
      {status?.google && (
        <div className="auth-google">
          <GoogleSignInButton clientId={status.google.clientId} text="signup_with" />
          {!emailSignupClosed && <div className="auth-divider"><span>{t("auth.orEmail")}</span></div>}
        </div>
      )}
      {emailSignupClosed ? (
        <div className="auth-form">
          <p className="auth-notice">{t(status.google ? "auth.signupPausedGoogle" : "auth.signupPaused")}</p>
        </div>
      ) : (
      <form className="auth-form" onSubmit={handleSubmit}>
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
        <input
          className="auth-input"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder={t("auth.firstNameRequiredField")}
          required
          autoComplete="given-name"
        />
        <input
          className="auth-input"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder={t("auth.lastNameOptional")}
          autoComplete="family-name"
        />
        <select
          className="auth-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="" disabled>{t("auth.whoAreYou")}</option>
          <option value="parent">{t("auth.roleParent")}</option>
          <option value="specialist">{t("auth.roleSpecialist")}</option>
        </select>
        <select
          className="auth-input"
          value={referralSource}
          onChange={(e) => setReferralSource(e.target.value)}
          required
        >
          <option value="" disabled>{t("auth.howHeard")}</option>
          <option value="instagram">Instagram</option>
          <option value="friend">{t("auth.heardFriend")}</option>
          <option value="developer">{t("auth.heardDeveloper")}</option>
          <option value="other">{t("auth.heardOther")}</option>
        </select>
        <div className="auth-password-wrap">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordNew")}
            required
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
        <label className="auth-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          <span>
            {t("auth.consentPrefix")}{" "}
            <button type="button" className="auth-consent__link" onClick={() => setShowPrivacy(true)}>
              {t("auth.consentLink")}
            </button>
          </span>
        </label>
        <label className="auth-consent">
          <input
            type="checkbox"
            name="marketingOptIn"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
          />
          <span>{t("auth.marketingConsent")}</span>
        </label>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
        </Button>
      </form>
      )}
      <button className="auth-link" onClick={() => setScreen("login")}>
        {t("auth.haveAccount")}
      </button>

      {showPrivacy && (
        <Modal title={t("auth.privacyTitle")} onClose={() => setShowPrivacy(false)}>
          <PrivacyContent />
        </Modal>
      )}
    </div>
  );
}
