export const PLAN_LABELS = {
  trial: "Пробный период",
  free_grant: "Бесплатный доступ",
  monthly: "Месяц",
  half_year: "Полгода",
  annual: "Год",
};

export function formatPeriodEnd(iso) {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });
}
