// The backend answers in English machine-ish strings; these screens used to
// show them verbatim ("Too many requests, try again later", "Invalid email
// or password"). Translate the ones a person can hit; anything unexpected
// falls back to the screen's own Russian message rather than leaking English.
const MESSAGES = {
  "Invalid email or password": "Неверный email или пароль.",
  "Invalid email": "Проверьте адрес email.",
  "Password must be at least 8 characters": "Пароль должен быть не короче 8 символов.",
  "First name is required": "Укажите имя.",
  "Email already registered": "Этот email уже зарегистрирован.",
  "Consent to personal data processing is required": "Нужно согласие на обработку персональных данных.",
};

export function authErrorMessage(error, fallback) {
  if (error?.status === 429) return "Слишком много попыток. Подождите несколько минут и попробуйте снова.";
  return MESSAGES[error?.message] ?? fallback;
}
