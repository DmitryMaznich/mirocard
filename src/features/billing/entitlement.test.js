import { describe, it, expect } from "vitest";
import { isPaidTopicLocked, hasActiveEntitlement } from "./entitlement";

const past = "2000-01-01T00:00:00.000Z";
const future = "2999-01-01T00:00:00.000Z";
const owned = [{ topicId: "paid_x", source: "paid" }, { topicId: "free_x", source: "free" }, { topicId: "gift_x", source: "grant" }];

describe("isPaidTopicLocked", () => {
  it("locks a downloaded paid topic once the entitlement has lapsed", () => {
    expect(isPaidTopicLocked({ topicId: "paid_x", ownedTopics: owned, account: {}, subscription: { status: "active", currentPeriodEnd: past } })).toBe(true);
    expect(isPaidTopicLocked({ topicId: "paid_x", ownedTopics: owned, account: {}, subscription: null })).toBe(true);
  });
  it("keeps it open while the entitlement is active, or for unlimited accounts", () => {
    expect(isPaidTopicLocked({ topicId: "paid_x", ownedTopics: owned, account: {}, subscription: { status: "active", currentPeriodEnd: future } })).toBe(false);
    expect(isPaidTopicLocked({ topicId: "paid_x", ownedTopics: owned, account: { featureFlags: ["all_access"] }, subscription: null })).toBe(false);
  });
  it("never locks free or admin-granted topics", () => {
    expect(isPaidTopicLocked({ topicId: "free_x", ownedTopics: owned, account: {}, subscription: null })).toBe(false);
    expect(isPaidTopicLocked({ topicId: "gift_x", ownedTopics: owned, account: {}, subscription: null })).toBe(false);
  });
  it("hasActiveEntitlement rejects a non-active subscription even with a future end date", () => {
    expect(hasActiveEntitlement({}, { status: "refunded", currentPeriodEnd: future })).toBe(false);
  });
});
