// Client-side mirror of backend/lib/billing-repository.mjs's
// hasActiveEntitlement -- used only to decide what the UI shows/allows
// (e.g. hiding "Open" on a paid topic whose subscription has lapsed since
// it was downloaded). The backend re-checks independently on every
// claim/download call; this never grants access by itself.
/**
 * A downloaded PAID topic (claim source "paid") is locked in the UI once the
 * entitlement that earned it has lapsed. Free and admin-granted topics
 * never lock. Offline, this runs on the last-synced subscription end date
 * and the device clock -- see docs/commercial-launch-runbook.md on why an
 * offline copy can't be cryptographically revoked.
 */
export function isPaidTopicLocked({ topicId, ownedTopics, account, subscription }) {
  const owned = (ownedTopics ?? []).find((o) => o.topicId === topicId);
  return owned?.source === "paid" && !hasActiveEntitlement(account, subscription);
}

export function hasActiveEntitlement(account, subscription) {
  const flags = account?.featureFlags ?? [];
  if (flags.includes("all_access")) return true;
  if (!subscription || subscription.status !== "active" || !subscription.currentPeriodEnd) {
    return false;
  }
  return new Date(subscription.currentPeriodEnd).getTime() > Date.now();
}
