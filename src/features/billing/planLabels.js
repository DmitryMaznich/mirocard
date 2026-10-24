import { getUiLanguage, translateUi } from "@/shared/i18n/uiLanguage.js";
export const PLAN_LABELS = {
  trial: "Пробный период",
  free_grant: "Бесплатный доступ",
  monthly: "Месяц",
  half_year: "Полгода",
  annual: "Год",
  all_access: "Бессрочный доступ",
};

// Grandfathered pre-launch accounts (feature flag all_access, surfaced by
// the backend as plan "all_access" with a far-future end date).
export function isUnlimitedPlan(plan) {
  return plan === "all_access";
}

export function daysLeft(iso, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86400000));
}

export function formatPeriodEnd(iso) {
  return new Date(iso).toLocaleDateString(getUiLanguage() === "sl" ? "sl-SI" : "ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function getPlanLabel(plan) {
  return Object.hasOwn(PLAN_LABELS, plan) ? translateUi(`billing.plan.${plan}`) : plan;
}
