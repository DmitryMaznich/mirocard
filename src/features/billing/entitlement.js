// Client-side mirror of backend/lib/billing-repository.mjs's
// hasActiveEntitlement -- used only to decide what the UI shows/allows
// (e.g. hiding "Open" on a paid topic whose subscription has lapsed since
// it was downloaded). The backend re-checks independently on every
// claim/download call; this never grants access by itself.
export function hasActiveEntitlement(account, subscription) {
  const flags = account?.featureFlags ?? [];
  if (flags.includes("all_access")) return true;
  if (!subscription || subscription.status !== "active" || !subscription.currentPeriodEnd) {
    return false;
  }
  return new Date(subscription.currentPeriodEnd).getTime() > Date.now();
}

// While the app is free for everyone (launch, 2026-10-14) there is nothing to pay for: the
// account screen hides the subscription block and the subscription screen shows a short
// "free for now" note instead of the plans. Flip back to false when paid plans return.
export const PAID_PLANS_PAUSED = true;
