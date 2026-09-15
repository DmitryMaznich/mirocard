import { LAVA_TOP_API_KEY, LAVA_TOP_WEBHOOK_SECRET } from "../config.mjs";

// Field names (offerId/clientUtm/paymentUrl/contractId) per Lava Top's
// Public API reference at https://gate.lava.top/docs — confirm against the
// live docs (or a support ticket) before the first real sandbox call, per
// docs/superpowers/specs/2026-09-13-lava-top-payments-design.md §9 point 1.
export async function createInvoice({ orderId, amountMinor, currency, accountEmail }) {
  const res = await fetch("https://gate.lava.top/api/v3/invoice", {
    method: "POST",
    headers: {
      "X-Api-Key": LAVA_TOP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: accountEmail,
      currency,
      amount: amountMinor / 100,
      clientUtm: { orderId },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Lava Top API error ${res.status}: ${errText}`);
  }
  const invoice = await res.json();
  return { checkoutUrl: invoice.paymentUrl, externalId: invoice.id };
}

// Lava Top authenticates its webhook deliveries with a shared secret set
// when the webhook URL is registered in their dashboard (spec §7) — sent
// back as the X-Api-Key header on each delivery.
export function verifyLavaTopWebhookAuth(headerValue) {
  return Boolean(headerValue) && headerValue === LAVA_TOP_WEBHOOK_SECRET;
}

export function parseLavaTopWebhookEvent(rawBody) {
  const event = JSON.parse(rawBody);
  return {
    eventType: event.eventType,
    externalId: event.contractId,
    orderId: event.clientUtm?.orderId ?? null,
    amountMinor: event.amount != null ? Math.round(event.amount * 100) : null,
    currency: event.currency ?? null,
  };
}
