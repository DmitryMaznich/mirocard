# Commercial launch runbook — Instagram promo + paid access

Status: **in progress, not yet recommended for production** — see
`docs/release-evidence.md` for the Definition-of-Done checklist and what's
still outstanding.

This document is the operational companion to the code changes on branch
`launch/commercial-prep`. It explains what shipped, why, what a human still
has to do (Railway/Stripe/Lava/Resend dashboard actions, legal review), and
how to run/verify everything. It's written to be read start to finish once,
then used as a reference.

## 1. Billing model: M0 now, M1 later

### M0 (this launch) — prepaid access, no recurring charge

- A purchase buys a fixed period (1 / 6 / 12 months) at a fixed price. Stripe
  Checkout runs in `mode: "payment"` (one-time), not `mode: "subscription"`.
  No card is kept on file, nothing charges again automatically.
- Access ends exactly at the end of the paid period. The user has to come
  back and buy the next period manually — there is no dunning, no retry
  billing, no auto-renewal.
- UI copy was audited (`src/features/billing/SubscriptionScreen.jsx`,
  `CheckoutReturnScreen.jsx`, `landing/index.html`, `landing/terms.html`,
  `landing/refund-policy.html`) for any wording implying automatic renewal —
  none was found, and `SubscriptionScreen` now says explicitly, next to the
  purchase button: *"Разовая оплата за «{план}». Без автосписаний — карта не
  сохраняется, по истечении периода доступ закончится, продлить можно будет
  вручную в любой момент."*
- This is intentionally the **safe minimum**: no live recurring-billing
  integration to debug or get wrong under a launch deadline, and no
  "cancel my subscription" support burden because there is nothing to
  cancel — the worst case for a customer is "I have to click buy again."

### M1 (future, not implemented) — real recurring subscription

Do not enable M1 without a Stripe test-mode sandbox run covering the full
checklist in §7, reviewed by a human. Architecture, for when that happens:

1. **Stripe Checkout `mode: "subscription"`** with real recurring Price
   objects created in the Stripe dashboard for each plan (monthly / half-year
   / annual), replacing today's ad-hoc `price_data` line item
   (`backend/lib/billing-providers/stripe.mjs:createCheckoutSession`).
2. **Store the Stripe customer + subscription ID.** Add
   `stripe_customer_id`/`provider_subscription_id` columns to a
   provider-level record — this is exactly what the `subscriptions` table
   name was reserved for in the P0-3 rearchitecture (see
   `backend/lib/db.mjs`): it currently only exists as the source for a
   one-time backfill into `orders`/`entitlements`, and is free to become the
   real "recurring contract" table for M1 without another rename.
3. **Webhook lifecycle events to handle**, beyond today's
   `checkout.session.completed` / `charge.refunded`:
   - `invoice.paid` → extend the entitlement for the new period (reuse
     `extendEntitlementForOrder`'s max(now, current_end) logic, sourced from
     the subscription's `current_period_end` instead of a fixed `periodDays`
     lookup).
   - `invoice.payment_failed` → do **not** immediately revoke access (Stripe
     retries automatically per its dunning schedule); surface a "payment
     failed, update your card" notice and only revoke once Stripe reports
     `customer.subscription.deleted` or the period actually lapses.
   - `customer.subscription.deleted` / `customer.subscription.updated`
     (status → `canceled`/`unpaid`) → mark the entitlement to not renew
     further; existing paid time already granted stays valid until its
     `ends_at`.
4. **Cancel-at-period-end**, not immediate cancellation: call Stripe's
   subscription-update API with `cancel_at_period_end: true`. The
   `entitlements.cancel_at_period_end` column already exists in the schema
   for this (added in P0-3, unused by M0's one-shot purchases).
5. **Stripe Customer Portal** for self-service cancel/payment-method update,
   linked from `SubscriptionScreen`. Needs `stripe_customer_id` (point 2)
   and a `POST /billing/portal-session` endpoint that calls Stripe's
   `billing_portal.sessions.create`.
6. **Renewal must never lose remaining time**: reuse the same
   max(now, current active entitlement's end) rule P0-3 already implements
   for one-shot renewals (`extendEntitlementForOrder` in
   `backend/lib/billing-repository.mjs`) — an `invoice.paid` for a
   subscription's next cycle should extend from the same logic, not from
   `now`.
7. **Known gap carried over from M0's webhook design**: Lava Top's
   `payment_events` idempotency key is `(provider, event_type, external_id)`
   with `external_id = contractId` (see
   `backend/lib/billing-providers/lava-top.mjs:parseLavaTopWebhookEvent`).
   For M0's one-time purchases this is safe (each checkout gets a fresh
   contract). For M1 recurring charges on Lava Top, **the same contractId
   would repeat across multiple distinct `subscription.recurring.payment.success`
   events** (one per billing cycle) — under the current key, the second
   real charge would be misidentified as a duplicate of the first and
   silently dropped, silently under-extending the entitlement. This needs
   a genuinely unique per-charge event ID from Lava Top's real API
   (unconfirmed — see `docs/superpowers/specs/2026-09-13-lava-top-payments-design.md`
   §9.1) before Lava Top can be used for M1 recurring billing. Stripe's own
   `event.id` doesn't have this problem (Stripe issues a fresh event ID per
   delivery, even for the same subscription).
8. Do not implement any of the above against production Stripe/Lava keys
   without first running it against Stripe's test mode / Lava Top's sandbox
   and getting a human sign-off — this is a payments system, and a bug here
   either overcharges someone or gives away access for free.

## 2. Promo campaign: INSTAGRAM31

### How it works technically

The promo-code infrastructure (`promo_codes`/`promo_redemptions` tables,
`validatePromoCode`/`redeemFreeGrantCode` in
`backend/lib/billing-repository.mjs`, `POST /billing/validate-code` and
`POST /billing/redeem-code`) already existed before this launch prep and
needed only hardening, not building from scratch. To launch the Instagram
campaign, create the code via the existing admin endpoint (no code changes
needed):

```bash
curl -X POST "$MIROCARD_BASE_URL/api/admin/promo-codes" \
  -H "Authorization: Bearer $MIROCARD_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "INSTAGRAM31",
    "kind": "free_grant",
    "grantDurationDays": 31,
    "maxRedemptions": <set by marketing — total budget for the campaign>,
    "expiresAt": "<ISO date the campaign closes, e.g. 2026-12-31T23:59:59.000Z>",
    "note": "Instagram launch campaign"
  }'
```

This is a **manual action a human runs against production** once the
campaign's redemption cap and end date are decided (marketing/product call,
not a code decision) — see §6.

### Redemption rules (server-enforced, tested in `backend/tests/*.test.mjs`)

- Exactly 31 days from the moment of redemption (`grantDurationDays: 31`),
  not from account creation or campaign start.
- One redemption per account, enforced by `promo_redemptions`'
  `UNIQUE(code, account_id)` — a second attempt returns `already_used`.
- Only usable while `redeemed_count < maxRedemptions` and before
  `expiresAt` — both checked server-side in `validatePromoCode`.
- **No card required, no Stripe/Lava checkout at all**: a `free_grant` code
  never reaches `handleBillingCheckout` — it inserts an entitlement row
  directly (see P0-3). A 100%-off code must never be implemented as a
  `percent_off: 100` discount through the paid-checkout path (Stripe
  rejects a €0 `mode: "payment"` session) — `free_grant` is the only
  correct kind for this.
- **Decided trial-interaction rule**: redeeming `INSTAGRAM31` **replaces**
  whatever entitlement is currently active (including a still-running
  7-day generic trial) with the fresh 31-day period, rather than stacking
  the two. This is implemented in `redeemFreeGrantCode`
  (`backend/lib/billing-repository.mjs`) and covered by
  `backend/tests/billing-repository.test.mjs`'s "redeemFreeGrantCode
  replaces an active trial rather than stacking on top of it" test. This
  was an explicit choice within the two options the original brief allowed
  ("промокод заменяет trial" vs. "generic trial disabled during the
  campaign") — flagged here so product/marketing can override it before
  launch if they'd rather disable the generic trial instead.
- Abandoned/never-attempted checkouts never touch `promo_redemptions` at
  all for `free_grant` codes (there is no checkout step to abandon); for
  discount-kind codes, `finalizeDiscountRedemption` only records the
  redemption once a webhook confirms payment, so an abandoned discounted
  checkout doesn't burn the code's `maxRedemptions` budget either.

### What's still manual / not yet built for the campaign

- **Redemption abuse throttling**: `POST /billing/validate-code` and
  `POST /billing/redeem-code` had no rate limiting before this launch prep;
  P1 security work adds a per-account/IP limiter (see §4) reusing the same
  pattern as the existing resend-verification limiter
  (`backend/server.mjs:_resendLimiter`). "Verified email" is *already* an
  implicit gate — both endpoints require `requireAuth`, and auth tokens are
  only issued to `status = 'active'` (email-verified) accounts.
- **Campaign emails** (grant confirmation, -5d/-1d reminders, post-expiry
  notice): see §3.
- **Success screen showing the exact end date**: `CheckoutReturnScreen`
  already shows plan + formatted expiry date on success — this also covers
  a `free_grant` redemption's confirmation, since `applyPromo()` in
  `SubscriptionScreen.jsx` navigates to the same `checkout_return` screen
  after a successful `free_grant` redemption.

## 3. Emails

`backend/lib/mailer.mjs` only sends two emails today (password reset, email
verification), via Resend's HTTPS API. This launch adds (see commit for
exact diff): a promo-grant confirmation email sent from `handleRedeemCode`,
and a scheduled reminder job. Both follow the existing pattern — see
`sendPasswordResetEmail`/`sendEmailVerificationEmail` for the template
shape, and `scripts/railway-backup-loop.mjs` for the in-process
`setInterval` pattern the reminder job reuses (there is no queue/cron
dependency in this codebase; everything scheduled runs in-process, gated on
`RAILWAY_ENVIRONMENT` being set so it never fires in local dev).

## 4. Known residual risks

See `docs/release-evidence.md` for the full, current list against the
Definition of Done. Highlights carried in this document because they
affect how the campaign should be run operationally:

- Lava Top's provider integration (`backend/lib/billing-providers/lava-top.mjs`)
  has never been exercised against Lava Top's real API — field names are
  taken from their public docs but explicitly unconfirmed (see the file's
  own top-of-file comment). Until a sandbox call confirms it, **run the
  Instagram campaign (and any paid checkout) on the card/Stripe rail only**;
  treat "МИР / СБП" as unverified/at-risk until proven in Lava's sandbox.
- No off-site backup exists yet for the Railway SQLite volume (hourly
  backups exist, but land on the same volume as the live DB) — a
  volume-level failure loses both. Not something this branch can fix from
  inside a sandbox session; flagged for the human doing the Railway setup
  in §6.
