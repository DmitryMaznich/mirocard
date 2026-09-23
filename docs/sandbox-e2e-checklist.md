# Stripe / Lava Top sandbox E2E checklist

**Status: not executed in this session.** This is a manual checklist for a
human (or a follow-up session with real Stripe test-mode / Lava Top sandbox
credentials) to run before recommending commercial launch — see
`docs/release-evidence.md` for why this couldn't be run from inside this
sandboxed session (no real payment-provider credentials, and pasting
secret keys into an AI coding session isn't good practice regardless).

Do not paste live/production keys anywhere in this process. Use Stripe's
test-mode keys (`sk_test_...`/`pk_test_...`, dashboard toggle "Test mode")
and Lava Top's sandbox environment/credentials if/when Lava Top confirms
one exists (their integration is unverified — see
`backend/lib/billing-providers/lava-top.mjs`'s own top-of-file note and
`docs/commercial-launch-runbook.md` §5. **Run every Stripe scenario below
first and treat Lava Top as blocked until its own field names and sandbox
behavior are confirmed against their real docs/support.**)

## Setup

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` set to test-mode values
      in a deploy preview or local environment (never production).
- [ ] Stripe CLI (`stripe listen --forward-to <host>/api/billing/webhook/stripe`)
      or a test-mode webhook endpoint configured in the Stripe dashboard,
      pointed at the environment under test.
- [ ] `LEGAL_DOCS_VERSION` set to a non-"draft" value in that same
      environment (checkout is refused otherwise — this is intentional,
      see `docs/legal-launch-inputs.md`).
- [ ] A disposable test account registered and email-verified in that
      environment.

## Stripe — card rail

- [ ] **Successful payment**: checkout with plan `monthly`, Stripe test
      card `4242 4242 4242 4242`, any future expiry/CVC. Confirm: order
      moves `pending` → `completed`, an entitlement is granted with the
      correct `ends_at` (~31 days out), `GET /api/billing/subscription`
      reflects it, a purchase-confirmation email is sent (check Resend's
      dashboard or the dev-mode console log), `checkout_created` +
      `payment_success` events fire if `ANALYTICS_WEBHOOK_URL` is set.
- [ ] **User cancels at Stripe** (closes the Checkout tab / clicks back):
      confirm the order stays `pending` (never silently marked anything
      else), the account is not entitled, and `CheckoutReturnScreen`'s
      20-second poll times out into a usable state (retry button / "check
      status" / support contact — see §2 in the original brief and this
      branch's checkout-UX changes).
- [ ] **3D Secure**: use Stripe's 3DS test card (`4000 0025 0000 3155`),
      complete the challenge. Confirm the same success path as above.
- [ ] **3DS declined/abandoned**: same card, cancel the 3DS challenge.
      Confirm no entitlement is granted and the account can retry.
- [ ] **Delayed webhook**: use the Stripe CLI to hold/replay the
      `checkout.session.completed` event manually after a delay. Confirm
      `CheckoutReturnScreen`'s poll window (or a manual refresh) still
      picks up the entitlement once the webhook actually arrives, and
      that nothing broke while it was pending.
- [ ] **Duplicate webhook delivery**: replay the exact same
      `checkout.session.completed` event a second time (Stripe CLI
      `stripe events resend <id>`, or trigger a real dashboard "Resend").
      Confirm the entitlement is not extended twice (see
      `backend/tests/billing-orchestrator.test.mjs`'s equivalent unit
      test — this is the live-provider version of the same check).
- [ ] **Refund**: refund the completed test payment from the Stripe
      dashboard. Confirm the webhook revokes the entitlement (or, if the
      account also has another active entitlement e.g. a trial, that only
      the refunded order's own grant is revoked — not the other one).
- [ ] **Chargeback**: Stripe test mode has a way to simulate a dispute
      (`charge.dispute.created`/via test clocks or the dashboard's dispute
      testing tools) — if available, confirm the order is marked
      `chargeback` distinctly from a plain refund and access is revoked.
- [ ] **Expired access**: manually set an entitlement's `ends_at` to the
      past (or wait out a very short-duration test grant) and confirm the
      paid topic/library UI locks it out (see
      `backend/tests/paywall.test.mjs` for the automated version;
      this step is about confirming it in the real running UI, not just
      the API).

## Popup blocker / mobile

- [ ] **iOS Safari**: tap "Оформить" on a real iPhone (or iOS Simulator).
      Confirm the Stripe Checkout tab opens without a popup-blocker
      warning (this branch's checkout-UX fix moves `window.open` into the
      synchronous click handler specifically for this).
- [ ] **Android Chrome**: same check.
- [ ] **Popup blocker deliberately enabled** (desktop Chrome/Safari
      settings → block popups): confirm the explicit "Открыть оплату"
      fallback button (added in this branch) still gets the user to
      checkout.

## Lava Top — МИР/СБП rail (blocked until confirmed — see warning above)

- [ ] Confirm with Lava Top (support ticket or their current public docs)
      the exact field names `backend/lib/billing-providers/lava-top.mjs`
      assumes: `offerId`, `clientUtm.orderId`, `paymentUrl`, `contractId`,
      the webhook's `eventType`/`amount`/`currency` shape. Update the code
      if any differ before running the rest of this section.
- [ ] Repeat the successful-payment, cancel, delayed-webhook,
      duplicate-webhook, and refund scenarios above against Lava Top's
      sandbox once the above is confirmed.
- [ ] Specifically verify the idempotency-key concern flagged in
      `docs/commercial-launch-runbook.md` §1 point 7: confirm what
      `contractId` actually identifies (one value per checkout, as this
      launch's one-time-purchase model needs, vs. one value reused across
      multiple webhook deliveries/events for the same contract).

## Sign-off

- [ ] Record the date, who ran this, which scenarios passed/failed, and
      link any Stripe/Lava dashboard event IDs used, in
      `docs/release-evidence.md` (or a dated copy of it) once complete.
      Commercial launch should not be recommended based on unit/
      integration tests alone until at least the Stripe section above has
      a real, dated sign-off here.
