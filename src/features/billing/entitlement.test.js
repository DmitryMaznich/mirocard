import { describe, expect, it } from "vitest";
import { hasActiveEntitlement, hasPaidAccess, isBillingPreview, showsPaidPlans, PAID_PLANS_PAUSED } from "./entitlement";

describe("hasPaidAccess", () => {
  const expiredTrial = { plan: "trial", status: "active", currentPeriodEnd: "2000-01-01T00:00:00.000Z" };

  it("keeps an expired trial unlocked while paid plans are paused", () => {
    expect(hasActiveEntitlement({}, expiredTrial)).toBe(false);
    expect(hasPaidAccess({}, expiredTrial)).toBe(PAID_PLANS_PAUSED ? true : false);
  });
});

describe("billing preview", () => {
  it("is on only for accounts with the billing_preview flag", () => {
    expect(isBillingPreview({ featureFlags: ["billing_preview"] })).toBe(true);
    expect(isBillingPreview({ featureFlags: ["planner"] })).toBe(false);
    expect(isBillingPreview(null)).toBe(false);
  });

  it("shows paid plans to preview accounts even while paused", () => {
    expect(showsPaidPlans({ featureFlags: ["billing_preview"] })).toBe(true);
    expect(showsPaidPlans({ featureFlags: [] })).toBe(!PAID_PLANS_PAUSED);
  });
});
