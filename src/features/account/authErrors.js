import { translateUi } from "@/shared/i18n/uiLanguage.js";

// The backend answers in English machine-ish strings; these screens used to
// show them verbatim ("Too many requests, try again later", "Invalid email
// or password"). Translate the ones a person can hit; anything unexpected
// falls back to the screen's own Russian message rather than leaking English.
const MESSAGES = {
  "Invalid email or password": "auth.invalidCredentials",
  "Invalid email": "auth.invalidEmail",
  "Password must be at least 8 characters": "auth.shortPassword",
  "First name is required": "auth.firstNameRequired",
  "Email already registered": "auth.emailRegistered",
  "Consent to personal data processing is required": "auth.consentRequired",
};

export function authErrorKey(error) {
  if (error?.status === 429) return "auth.tooManyAttempts";
  return MESSAGES[error?.message] ?? null;
}

// For screens that only have one generic fallback (register, reset password).
// LoginScreen keeps using authErrorKey: an unknown error there shows a
// diagnostic code for support instead.
export function authErrorMessage(error, fallback) {
  const key = authErrorKey(error);
  if (key) return translateUi(key);
  // No HTTP status means the request never got an answer (offline, timeout,
  // connection reset by a provider or VPN) -- retrying the same way won't help.
  if (typeof error?.status !== "number") return translateUi("auth.networkError");
  if (error.status >= 500) return translateUi("auth.serverError");
  return fallback;
}

export function googleAuthErrorKey(error) {
  if (error?.status === 429) return "auth.tooManyAttempts";
  return error?.status === 400 && error.message === "invalid_or_expired_code"
    ? "auth.googleExpired" : "auth.googleFailed";
}
