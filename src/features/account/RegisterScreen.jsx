import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";

export default function RegisterScreen() {
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
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }
    if (!consent) {
      setError("Необходимо согласие на обработку персональных данных");
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
      });
      setPendingVerificationEmail(email);
      setScreen("verify_email_sent");
    } catch (err) {
      if (err.status === 409) {
        setError("Этот email уже зарегистрирован");
      } else {
        setError(err.message || "Ошибка регистрации. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Mirocard</div>
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
        <input
          className="auth-input"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Имя *"
          required
          autoComplete="given-name"
        />
        <input
          className="auth-input"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Фамилия (необязательно)"
          autoComplete="family-name"
        />
        <select
          className="auth-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="" disabled>Кто вы? *</option>
          <option value="parent">Родитель</option>
          <option value="specialist">Специалист</option>
        </select>
        <select
          className="auth-input"
          value={referralSource}
          onChange={(e) => setReferralSource(e.target.value)}
          required
        >
          <option value="" disabled>Как узнали о Mirocard? *</option>
          <option value="friend">Рекомендация друзей</option>
          <option value="developer">Приглашение разработчика</option>
          <option value="other">Другое</option>
        </select>
        <div className="auth-password-wrap">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль (минимум 8 символов) *"
            required
            autoComplete="new-password"
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
        <label className="auth-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          <span>Согласен(а) на обработку персональных данных</span>
        </label>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
        </Button>
      </form>
      <button className="auth-link" onClick={() => setScreen("login")}>
        Уже есть аккаунт? Войти
      </button>
    </div>
  );
}
