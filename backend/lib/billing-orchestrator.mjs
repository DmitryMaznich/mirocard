import { incrementRevision } from "./account-repository.mjs";
import {
  getSubscriptionByOrderId, recordPaymentEvent, activateSubscriptionByOrderId,
  markSubscriptionRefundedByOrderId, finalizeDiscountRedemption,
} from "./billing-repository.mjs";

const SUCCESS_EVENT_TYPES = new Set([
  "checkout.session.completed", "payment.success", "subscription.recurring.payment.success",
]);
const REFUND_EVENT_TYPES = new Set(["charge.refunded", "refund.success", "chargeback.initiated"]);

export function processBillingEvent(db, { provider, event, rawBody }) {
  if (!event.orderId) return;
  const row = getSubscriptionByOrderId(db, event.orderId);
  if (!row) return;

  const isNew = recordPaymentEvent(db, {
    accountId: row.account_id, provider, eventType: event.eventType,
    externalId: event.externalId, payloadJson: rawBody,
  });
  if (!isNew) return;

  if (SUCCESS_EVENT_TYPES.has(event.eventType)) {
    activateSubscriptionByOrderId(db, event.orderId);
    finalizeDiscountRedemption(db, row.applied_code, row.account_id);
    incrementRevision(db, row.account_id);
  } else if (REFUND_EVENT_TYPES.has(event.eventType)) {
    markSubscriptionRefundedByOrderId(db, event.orderId);
    incrementRevision(db, row.account_id);
  }
}
