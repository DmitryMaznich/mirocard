import { api } from "@/core/api";

// Shown when the server's daily email budget (free Resend plan) is spent.
export const SIGNUP_PAUSED_TEXT =
  "На сегодня регистрация по почте закончилась — мы маленький проект и отправляем ограниченное число писем в день. Регистрация откроется снова завтра — приходите, пожалуйста!";
export const SIGNUP_PAUSED_WITH_GOOGLE_TEXT =
  "На сегодня регистрация по почте закончилась — мы маленький проект и отправляем ограниченное число писем в день. Войдите через Google прямо сейчас или приходите завтра.";
export const EMAIL_BUDGET_EXHAUSTED_TEXT =
  "Сегодня мы уже отправили все письма, какие могли. Попробуйте, пожалуйста, завтра.";

// A failed status request must never block signup: assume open.
export async function fetchSignupStatus() {
  try {
    return await api.get("/auth/signup-status");
  } catch {
    return { emailSignupOpen: true, google: null };
  }
}
