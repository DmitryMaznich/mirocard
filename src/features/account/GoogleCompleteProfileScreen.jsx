import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import PrivacyContent from "@/features/help/PrivacyContent";
import { MARKETING_CONSENT_TEXT } from "./marketingConsent";
import { completeLogin } from "./completeLogin";

const EXPIRED_TEXT = "Время на завершение регистрации истекло. Нажмите «Войти через Google» ещё раз.";

// First Google sign-in of a new person: the account is created only here,
// after the same questions and consents as the email signup form.
export default function GoogleCompleteProfileScreen() {
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
      setError("Необходимо согласие на обработку персональных данных");
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
      else setError(err?.message || "Не получилось завершить регистрацию. Попробуйте ещё раз.");
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
        <div className="auth-logo">Mironium</div>
        <div className="auth-form">
          <p className="auth-notice">{EXPIRED_TEXT}</p>
          <Button onClick={backToLogin} fullWidth>К входу</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mironium</div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-title">Ещё один шаг</h2>
        <p className="auth-subtitle">
          Вы входите через Google как <strong>{signup.email}</strong>
        </p>
        <select className="auth-input" value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="" disabled>Кто вы? *</option>
          <option value="parent">Родитель</option>
          <option value="specialist">Специалист</option>
        </select>
        <select className="auth-input" value={referralSource} onChange={(e) => setReferralSource(e.target.value)} required>
          <option value="" disabled>Как узнали о Mironium? *</option>
          <option value="friend">Рекомендация друзей</option>
          <option value="developer">Приглашение разработчика</option>
          <option value="other">Другое</option>
        </select>
        <label className="auth-consent">
          <input
            type="checkbox"
            name="consentPersonalData"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Согласен(а) на{" "}
            <button type="button" className="auth-consent__link" onClick={() => setShowPrivacy(true)}>
              обработку персональных данных
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
          <span>{MARKETING_CONSENT_TEXT}</span>
        </label>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Создаём аккаунт…" : "Продолжить"}
        </Button>
      </form>
      <button className="auth-link" onClick={backToLogin}>Отмена</button>

      {showPrivacy && (
        <Modal title="Политика конфиденциальности" onClose={() => setShowPrivacy(false)}>
          <PrivacyContent />
        </Modal>
      )}
    </div>
  );
}
