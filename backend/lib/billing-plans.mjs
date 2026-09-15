// Prices mirror landing/index.html#pricing — keep these two in sync by hand;
// see docs/superpowers/specs/2026-09-13-lava-top-payments-design.md §1.
export const PLAN_CATALOG = {
  monthly:   { label: "Месяц",   amountMinor: 990,  currency: "EUR", periodDays: 31 },
  half_year: { label: "Полгода", amountMinor: 4990, currency: "EUR", periodDays: 183 },
  annual:    { label: "Год",     amountMinor: 8990, currency: "EUR", periodDays: 366 },
};

export function applyDiscount(amountMinor, { kind, value }) {
  if (kind === "percent_off") {
    return Math.max(0, Math.round(amountMinor * (1 - value / 100)));
  }
  if (kind === "fixed_off") {
    return Math.max(0, amountMinor - value);
  }
  return amountMinor;
}
