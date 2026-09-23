import { incrementRevision } from "./account-repository.mjs";
import { withTransaction } from "./db.mjs";
import {
  getOrderByExternalId, recordPaymentEvent, completeOrder, markOrderRefunded,
  extendEntitlementForOrder, revokeEntitlementsForOrder, finalizeDiscountRedemption,
} from "./billing-repository.mjs";

const SUCCESS_EVENT_TYPES = new Set([
  "checkout.session.completed", "payment.success", "subscription.recurring.payment.success",
]);
const REFUND_EVENT_TYPES = new Set(["charge.refunded", "refund.success", "chargeback.initiated"]);

// Processes one provider webhook delivery. Returns { ok, reason? } rather
// than throwing for any "this delivery doesn't apply" case (unknown order,
// provider/amount/currency mismatch, wrong order status for this event
// type) -- those are expected, recoverable situations a malformed or
// out-of-order delivery can trigger, not bugs; the HTTP handler always
// responds 200 to the provider regardless; the reason is only for logging.
export function processBillingEvent(db, { provider, event, rawBody }) {
  if (!event.orderId) return { ok: false, reason: "no_order_id" };

  const order = getOrderByExternalId(db, event.orderId);
  if (!order) return { ok: false, reason: "unknown_order" };

  if (order.provider !== provider) {
    console.error(`[billing] webhook provider mismatch for order ${event.orderId}: order is ${order.provider}, event claims ${provider}`);
    return { ok: false, reason: "provider_mismatch" };
  }

  const isSuccess = SUCCESS_EVENT_TYPES.has(event.eventType);
  const isRefund = REFUND_EVENT_TYPES.has(event.eventType);
  if (!isSuccess && !isRefund) return { ok: false, reason: "ignored_event_type" };

  // Only success events carry a real payment to verify against what the
  // order was created for -- a mismatched amount/currency here would mean
  // either a provider bug or an attempt to pay less than the order's price
  // and still have it marked paid, so this must never silently proceed.
  if (isSuccess) {
    if (event.amountMinor != null && event.amountMinor !== order.amount_minor) {
      console.error(`[billing] webhook amount mismatch for order ${event.orderId}: order=${order.amount_minor} event=${event.amountMinor}`);
      return { ok: false, reason: "amount_mismatch" };
    }
    if (event.currency && event.currency !== order.currency) {
      console.error(`[billing] webhook currency mismatch for order ${event.orderId}: order=${order.currency} event=${event.currency}`);
      return { ok: false, reason: "currency_mismatch" };
    }
  }

  // Everything from here on must commit or roll back together: recording
  // the event is the idempotency gate, and if a crash happened between
  // recording it and finishing the rest on some earlier delivery, a plain
  // (non-transactional) retry would see the event as "already recorded"
  // and skip granting access entirely, despite the payment having
  // happened. Wrapping the whole thing in one transaction means a crash
  // anywhere in this block rolls back the event record too, so a retried
  // delivery reprocesses from scratch instead of silently doing nothing.
  return withTransaction(db, () => {
    const isNew = recordPaymentEvent(db, {
      accountId: order.account_id, provider, eventType: event.eventType,
      externalId: event.externalId, payloadJson: rawBody,
    });
    if (!isNew) return { ok: true, duplicate: true };

    if (isSuccess) {
      // Guards against an out-of-order or duplicate-with-a-different-
      // event-id success delivery re-extending an already-completed
      // order's entitlement a second time.
      if (order.status !== "pending") return { ok: true, reason: "order_not_pending" };
      completeOrder(db, order.id);
      extendEntitlementForOrder(db, order);
      finalizeDiscountRedemption(db, order.applied_code, order.account_id);
      incrementRevision(db, order.account_id);
      return { ok: true, kind: "completed", orderId: order.id, accountId: order.account_id };
    }

    // Refund/chargeback: only a completed order can be refunded.
    if (order.status !== "completed") return { ok: true, reason: "order_not_completed" };
    markOrderRefunded(db, order.id, event.eventType);
    revokeEntitlementsForOrder(db, order.id);
    incrementRevision(db, order.account_id);
    return { ok: true, kind: "refunded", orderId: order.id, accountId: order.account_id };
  });
}
