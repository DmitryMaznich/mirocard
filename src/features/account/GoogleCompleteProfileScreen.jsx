import MironiumLogo from "@/shared/components/MironiumLogo";
import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import PrivacyContent from "@/features/help/PrivacyContent";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { authErrorMessage } from "./authErrors";
import { completeLogin } from "./completeLogin";

// First Google sign-in of a new person: the account is created only here,
// after the same questions and consents as the email signup form.
export default function GoogleCompleteProfileScreen() {
  const { t } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const signup = useAppStore((s) => s.googleSignup);

  const [role, setRole] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!signup) setScreen("login");
  }, [signup, setScreen]);
  if (!signup) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!consent) {
      setError(t("auth.consentRequired"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { account, token } = await api.post("/auth/google/complete-signup", {
        signupCode: signup.signupCode,
        role,
        referralSource,
        consentPersonalData: true,
        marketingOptIn,
      });
      useAppStore.setState({ googleSignup: null });
      await completeLogin({ account, token });
    } catch (err) {
      if (err?.status === 400 && err.message === "invalid_or_expired_code") setExpired(true);
      else setError(authErrorMessage(err, t("auth.googleFinishFailed")));
    } finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    useAppStore.setState({ googleSignup: null });
    setScreen("login");
  }

  if (expired) {
    return (
      <div className="auth-screen">
        <MironiumLogo className="auth-logo" />
        <div className="auth-form">
          <p className="auth-notice">{t("auth.googleTimeExpired")}</p>
          <Button onClick={backToLogin} fullWidth>{t("auth.toLogin")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <MironiumLogo className="auth-logo" />
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-title">{t("auth.oneMoreStep")}</h2>
        <p className="auth-subtitle">
          {t("auth.googleAs")} <strong>{signup.email}</strong>
        </p>
        <select className="auth-input" value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="" disabled>{t("auth.whoAreYou")}</option>
          <option value="parent">{t("auth.roleParent")}</option>
          <option value="specialist">{t("auth.roleSpecialist")}</option>
        </select>
        <select className="auth-input" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} required>
          <option value="" disabled>{t("auth.howHeard")}</option>
          <option value="instagram">Instagram</option>
          <option value="friend">{t("auth.heardFriend")}</option>
          <option value="developer">{t("auth.heardDeveloper")}</option>
          <option value="other">{t("auth.heardOther")}</option>
        </select>
        <label className="auth-consent">
          <input
            type="checkbox"
            name="consentPersonalData"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
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
          {loading ? t("auth.creatingAccount") : t("auth.continue")}
        </Button>
      </form>
      <button className="auth-link" onClick={backToLogin}>{t("auth.cancel")}</button>

      {showPrivacy && (
        <Modal title={t("auth.privacyTitle")} onClose={() => setShowPrivacy(false)}>
          <PrivacyContent />
        </Modal>
      )}
    </div>
  );
}
