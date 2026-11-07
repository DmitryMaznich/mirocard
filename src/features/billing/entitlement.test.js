import { describe, expect, it } from "vitest";
import { hasActiveEntitlement, hasPaidAccess, PAID_PLANS_PAUSED } from "./entitlement";

describe("hasPaidAccess", () => {
  const expiredTrial = { plan: "trial", status: "active", currentPeriodEnd: "2000-01-01T00:00:00.000Z" };

  it("keeps an expired trial unlocked while paid plans are paused", () => {
    expect(hasActiveEntitlement({}, expiredTrial)).toBe(false);
    expect(hasPaidAccess({}, expiredTrial)).toBe(PAID_PLANS_PAUSED ? true : false);
  });
});
