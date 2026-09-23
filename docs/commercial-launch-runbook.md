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
checklist in `docs/sandbox-e2e-checklist.md`, reviewed by a human.
Architecture, for when that happens:

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

## 4. Legal pages, versioning, checkout consent

- `/terms`, `/privacy`, `/refunds`, `/cancellation`, `/contact` are now real
  server-rendered routes on the app host (`backend/server.mjs`'s
  `handleLegalDoc`, content in `backend/legal/*.html`) — they no longer fall
  through to the SPA shell. Each page shows a "Version: {LEGAL_DOCS_VERSION}"
  footer and, while that env var is unset (defaults to `"draft"`), a visible
  draft banner.
- `LEGAL_DOCS_VERSION` (`backend/lib/config.mjs`) is a hard gate:
  `POST /api/billing/checkout` returns `503` while it's `"draft"` — a
  commercial checkout cannot go live pointing at unreviewed legal text. See
  `docs/legal-launch-inputs.md` for exactly what has to be resolved before
  setting it to a real value in Railway.
- Checkout (`SubscriptionScreen.jsx`) now requires three checkboxes before
  the purchase button enables: accepting Terms, confirming the exact
  price/period, and acknowledging immediate digital-content delivery (this
  last one is explicitly flagged for legal sign-off in
  `docs/legal-launch-inputs.md` §2 — it is a technical placeholder for a
  consent mechanism, not asserted here as legally sufficient). All three are
  persisted per order in a new `checkout_consents` table
  (`backend/lib/db.mjs`), tagged with the `LEGAL_DOCS_VERSION` in effect at
  the time — so a later dispute can be matched to exactly what the customer
  agreed to and which version of the docs said so.
- A purchase confirmation email (durable record, independent of the DB) is
  sent once an order is actually confirmed by a provider webhook — see §3.

## 5. Observability, backups, release identity

### Health, version, errors

- `GET /healthz` (no auth, no PII) — DB reachability, `version`
  (`package.json`), `gitSha` (read straight out of `.git/`, shared between
  frontend build and backend via `scripts/git-sha.mjs` so both report the
  exact same value for the exact same build), and `backupAgeMinutes` (age
  of the newest file under `<DATA_DIR>/backups`, `null` if none exist yet).
  Returns `503` if the DB check fails. Point Railway's own health check
  (or an external uptime monitor) at this.
- `GET /api/version` now also returns `gitSha` alongside `version` — lets
  the post-deploy check in this repo's root `CLAUDE.md`
  ("verify `/api/version` returns the new version") also confirm it's the
  exact commit that was supposed to ship, not just *a* newer version.
- `backend/lib/observability.mjs`: `reportError(err, context)` and
  `trackEvent(name, properties)`, both pluggable via env
  (`ERROR_REPORTING_WEBHOOK_URL`, `ANALYTICS_WEBHOOK_URL`) and a no-op
  otherwise. Deliberately vendor-agnostic — point either at a real
  vendor's HTTP ingest endpoint (Sentry, PostHog, a small relay you own,
  ...) when one is chosen; nothing here hardcodes one. `context`/
  `properties` are structural only (opaque IDs, plan names, amounts, event
  kinds) by contract — never email/name/notes text.
- Funnel events currently wired: `registration_completed`,
  `email_verified`, `promo_validated`, `promo_redeemed`,
  `checkout_created`, `payment_success`, `refund`,
  `expiry_reminder_sent`, `backup_completed`. **Not yet wired** (flagged
  rather than left silently missing): a landing-page CTA click (that's a
  client-only event on the separate `landing/` static site, which has no
  backend to call from), "first lesson completed" (needs picking which
  session-completion event counts as "first"), and D1/D7/D28 retention
  cohorts (needs a scheduled cohort query, not a single event call site —
  the raw data for it already exists in `sessions`/`entitlements` and
  could be computed later without a schema change).
- Every unhandled route error goes through `reportError` now (previously
  a bare `console.error`) — still always logs locally either way; only
  the outbound webhook is new/optional.

### Backups

- `scripts/railway-backup-loop.mjs` (hourly, gated on `RAILWAY_ENVIRONMENT`,
  unchanged destination — `<DATA_DIR>/backups` on the same Railway
  volume) had a real bug fixed in this branch: a failed backup attempt
  (corrupt file, disk issue, a failed `PRAGMA integrity_check` — which
  `scripts/backup-sqlite.mjs` already ran and threw on) propagated as an
  uncaught exception out of the `setInterval` callback, which crashes the
  whole Node process. One bad backup used to be able to take production
  down with it. Now caught, reported via `reportError`, and retried on the
  next hourly tick instead. See `backend/tests/railway-backup-loop.test.mjs`
  for the regression test (starts the real loop against a deliberately
  corrupt source file and asserts no `uncaughtException` fires).
- **Off-site copy is still a gap** — see §6. This branch can fix in-process
  robustness (the crash bug above) but can't provision or credential an
  external bucket from inside this sandboxed session.
- **Restore drill (do this for real before relying on backups)**:
  1. Pick a backup file from `/data/backups/mirocard-<timestamp>.db`
     (Railway dashboard → volume browser, or `railway ssh` if available on
     the plan in use).
  2. Copy it somewhere you can inspect safely — never restore directly
     over the live volume as the first step of a drill.
  3. Verify integrity independently of the backup job itself:
     `node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync(process.argv[1]); console.log(db.prepare('PRAGMA integrity_check').get());" -- /path/to/mirocard-<timestamp>.db`
     — expect `{ integrity_check: 'ok' }`.
  4. Boot the backend against the copy locally: `MIROCARD_DATA_DIR=<dir containing the copy, renamed to mirocard.db> node backend/server.mjs` and confirm `/healthz` and a login against a known test account both work.
  5. Time the whole drill and write the duration down somewhere the team
     can find it later (`docs/release-evidence.md` or an incident-response
     doc) — that number is your actual RTO if this were a real incident,
     not a guess.
  6. Repeat this periodically (e.g. quarterly), not just once — a backup
     process nobody has ever restored from is unverified by definition.

### Release identity

- Deploys already happen from Railway auto-deploying `main` on every
  push (per this repo's `CLAUDE.md`); there is no separate "tagged
  release" step today. `/healthz`/`/api/version`'s new `gitSha` field is
  what makes a running deployment's identity independently verifiable
  against the repo regardless — after any deploy, `git log --oneline -1`
  locally and `curl https://app.mironium.com/healthz` should show matching
  short SHAs. If a more formal tag-per-release process is wanted later, it
  layers on top of this without needing another code change (`gitSha` was
  read from `.git/HEAD`, which reflects whatever commit — tagged or not —
  actually built the running image).

## 6. Known residual risks

See `docs/release-evidence.md` for the full, current list against the
Definition of Done, and `docs/sandbox-e2e-checklist.md` for the
Stripe/Lava sandbox test plan that hasn't been run yet (no real
payment-provider credentials in this sandboxed session). Highlights
carried in this document because they affect how the campaign should be
run operationally:

- Lava Top's provider integration (`backend/lib/billing-providers/lava-top.mjs`)
  has never been exercised against Lava Top's real API — field names are
  taken from their public docs but explicitly unconfirmed (see the file's
  own top-of-file comment). Until a sandbox call confirms it, **run the
  Instagram campaign (and any paid checkout) on the card/Stripe rail only**;
  treat "МИР / СБП" as unverified/at-risk until proven in Lava's sandbox.
- No off-site backup exists yet for the Railway SQLite volume (hourly
  backups exist, but land on the same volume as the live DB) — a
  volume-level failure loses both. Fixing this needs an actual external
  bucket/credential decision (S3-compatible? the existing SmartNAS
  mentioned in this repo's root `CLAUDE.md`?) that's a human's call, not
  something to wire up speculatively from inside this session. Once
  decided, the mechanical part is small: run
  `scripts/backup-sqlite.mjs`-style export on the schedule already in
  place and sync the output off-volume (`rclone`, a signed upload, or
  reusing whatever mechanism already moves other backups to SmartNAS).
- Account deletion is soft-delete only (`accounts.status = 'deleted'`,
  which does correctly invalidate every existing auth token for that
  account immediately via `findAccountByToken`'s `status = 'active'`
  join) — there is no real data erasure, and no self-service data export.
  Both are real gaps against the rights described in
  `backend/legal/privacy.html`; building them safely (especially erasure,
  given some data — photos — is deliberately de-duplicated across
  accounts, see `backend/server.mjs`'s `handleGetPhoto` comment) is a
  separate, careful piece of work this pass didn't attempt rather than
  rush.

## 7. Migration plan

All schema changes live in `backend/lib/db.mjs`'s `initDb()` and run
automatically on backend startup (there is no separate migration-runner
tool in this codebase — this is the existing, pre-branch pattern, reused
as-is). They are safe to run against the live Railway volume with existing
data, and safe to run twice:

- **Three new tables**, each `CREATE TABLE IF NOT EXISTS`: `orders` (every
  checkout attempt, immutable), `entitlements` (the actual time-boxed
  access grant a user currently has, including the three
  `reminder_*_sent_at` columns baked directly into the `CREATE TABLE` — no
  `ALTER TABLE` needed since the table itself is new), `checkout_consents`
  (one row per order, capturing the three consent checkboxes + the
  `LEGAL_DOCS_VERSION` in effect at that moment). Existing tables
  (`accounts`, `students`, `sessions`, `promo_codes`, `promo_redemptions`,
  the legacy `subscriptions`, …) are untouched — this migration only adds,
  never alters or drops.
- **One-time backfill**: `backfillOrdersAndEntitlementsFromLegacySubscriptions(db)`
  runs on every `initDb()` call (so also on every backend restart, not just
  the first one after this deploy) and synthesizes an `orders` +
  `entitlements` row for every pre-existing row in the old single-row-per-account
  `subscriptions` table that doesn't already have one. It's existence-checked
  per source row (keyed off the legacy `subscriptions.account_id`), so
  re-running it on an already-backfilled database is a no-op — this is what
  makes it safe to ship as "runs on every startup" instead of a one-shot
  flag. **No row in `subscriptions` is deleted, modified, or has its
  meaning changed** — it's kept, unmodified, purely as the backfill's
  read-only source of truth, and every currently-`all_access`/grandfathered
  account keeps exactly the access it had before this migration runs (this
  was one of the explicit boundaries in the original brief: never revoke
  previously-granted access as a side effect of a schema change).
- **Nothing here requires taking the app offline.** `node:sqlite`'s
  `DatabaseSync` runs these as ordinary DDL/DML against the same file the
  backend already has open; Railway's deploy replaces the running process
  with the new one on the same volume, and `initDb()` runs as part of
  normal backend startup either way.
- **Rollback of the migration itself**: because nothing is dropped or
  mutated, rolling back to the pre-branch code (see §10) leaves the
  database in a state that code can still read correctly — the old code
  never queries `orders`/`entitlements`/`checkout_consents`, only the
  still-intact `subscriptions` table, so a rollback doesn't need its own
  reverse migration. The three new tables would simply sit unused until/
  unless this branch is deployed again.

## 8. Environment variables

All new variables have safe, non-production-breaking defaults in local dev;
`requiredInProduction()` in `backend/lib/config.mjs` means the backend
**refuses to start** on Railway (`RAILWAY_ENVIRONMENT` set) if a variable
marked "required in prod" below is missing — this is intentional fail-fast
behavior introduced in this branch (see §"P1 security" in the PR
description), not a bug.

| Variable | New in this branch? | Required in prod? | Default (non-prod) | Purpose |
|---|---|---|---|---|
| `LEGAL_DOCS_VERSION` | Yes | No (but checkout 503s while it's `"draft"`) | `"draft"` | Version tag shown on `/terms` etc. and stamped onto every `checkout_consents` row; gates whether `POST /billing/checkout` will create real orders at all. |
| `CORS_ALLOWED_ORIGINS` | Yes | No | `https://app.mironium.com,http://localhost:5174,http://localhost:4173` | Comma-separated allowlist replacing the previous hardcoded `Access-Control-Allow-Origin: *`. Set explicitly in Railway only if the real production origin ever differs from the default. |
| `ERROR_REPORTING_WEBHOOK_URL` | Yes | No | unset → `reportError` is a local-log-only no-op | POST target for error events (`backend/lib/observability.mjs`); point at a real vendor's HTTP ingest endpoint when one is chosen. Nothing is sent if unset. |
| `ANALYTICS_WEBHOOK_URL` | Yes | No | unset → `trackEvent` is a local-log-only no-op | POST target for the funnel events listed in §5. Same no-op-if-unset behavior. |
| `STRIPE_SECRET_KEY` | No (pre-existing var) | **Yes, newly enforced** | `""` (was previously silently allowed empty) | Stripe API key. Previously could be missing in production with no startup error — now fails fast instead. |
| `STRIPE_WEBHOOK_SECRET` | No (pre-existing var) | **Yes, newly enforced** | `""` | Stripe webhook signature verification secret. Same newly-enforced behavior. |
| `AUTH_SECRET` | No (pre-existing var) | **Yes, newly enforced** | `"dev-auth-secret-change-me"` | Session/token signing secret. Was previously allowed to silently run in production on the hardcoded dev default. |
| `ACCOUNT_SECRET` | No (pre-existing var) | **Yes, newly enforced** | `"dev-account-secret-change-me"` | Same class of fix as `AUTH_SECRET`. |
| `MIROCARD_DEPLOY_TOKEN` | No (pre-existing var) | **Yes, newly enforced** | `"mirocard-deploy-2026"` | Same class of fix. |
| `MIROCARD_ADMIN_TOKEN` | No (pre-existing var) | **Yes, newly enforced** | `"dev-admin-token-change-me"` | Guards `/admin/*` routes, including the promo-code creation endpoint used in §2. |
| `RESEND_API_KEY` | No (pre-existing var) | **Yes, newly enforced** | `""` | Transactional email API key. Was previously allowed to silently degrade to console-logging emails in production. |
| `LAVA_TOP_API_KEY` / `LAVA_TOP_WEBHOOK_SECRET` | No (pre-existing vars) | No — **deliberately exempt** | unset | Left optional because the Lava Top integration is unverified (see §6/§9) — a production deploy without these just 502s the "МИР / СБП" payment option rather than refusing to start over an optional rail. |

**Action required before this branch can be deployed to Railway
production**: confirm `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`AUTH_SECRET`, `ACCOUNT_SECRET`, `MIROCARD_DEPLOY_TOKEN`,
`MIROCARD_ADMIN_TOKEN`, and `RESEND_API_KEY` are all *already* set with
real values in the Railway `mirocard-backend` service (they should be, if
production has been running correctly — this is a fail-fast safety net,
not a new requirement to provision). If any is missing, the very next
deploy of this branch will fail to start rather than silently running
insecurely, which is the intended behavior but will look like an outage if
not anticipated.

## 9. Manual actions in Railway / Stripe / Lava / Resend dashboards

None of these can be done from inside this sandboxed session (no
production credentials, no dashboard access, outbound network to
production is blocked here) — they're listed so a human can work through
them before or during rollout:

- **Railway (`mirocard-backend` service → Variables)**: set
  `CORS_ALLOWED_ORIGINS` only if the production origin differs from the
  default baked in above; leave `LEGAL_DOCS_VERSION` unset/`"draft"` until
  legal sign-off (see `docs/legal-launch-inputs.md`), then set it to a real
  version string; optionally set `ERROR_REPORTING_WEBHOOK_URL` /
  `ANALYTICS_WEBHOOK_URL` once a vendor is chosen. Confirm the pre-existing
  required secrets listed in §8 are already present (should be a no-op
  check, not new provisioning).
- **Railway (health check)**: point Railway's own health check config at
  `GET /healthz` instead of whatever it currently probes (if anything), so
  a DB-down state fails a deploy/restarts instead of serving `503`s
  silently.
- **Stripe dashboard**: no change needed for M0 (still `mode: "payment"`,
  same webhook endpoint/secret as before). Before ever enabling M1 (see
  §1), a human needs to create real recurring `Price` objects per plan and
  add the `invoice.paid` / `invoice.payment_failed` /
  `customer.subscription.*` events to the webhook endpoint's subscribed
  event list — do not do this yet.
- **Lava Top dashboard**: do not route real campaign traffic through this
  rail until a sandbox call confirms the field names/event shapes assumed
  in `backend/lib/billing-providers/lava-top.mjs` (see §6). If/when
  verified, confirm `LAVA_TOP_API_KEY`/`LAVA_TOP_WEBHOOK_SECRET` are set in
  Railway.
- **Resend dashboard**: verify the sending domain used by `SMTP_FROM`
  (`Mironium <noreply@mironium.com>`) is still verified/not rate-limited —
  this branch adds three new email types (promo grant, expiry reminders,
  purchase confirmation) that increase send volume on the same domain.
- **Instagram promo code**: run the `curl` command in §2 against production
  once marketing has decided `maxRedemptions` and `expiresAt` — this does
  not happen automatically, the code does not exist until that request is
  made.
- **Legal content**: work through `docs/legal-launch-inputs.md` with
  product/legal before setting `LEGAL_DOCS_VERSION` to anything other than
  `"draft"` — checkout stays hard-disabled (`503`) until that happens, by
  design.

## 10. Release checklist

1. Confirm this PR's branch is merged (or otherwise deployed) from a clean
   working tree — no uncommitted changes, `npm run build` succeeds locally
   one more time as a final sanity check (per this repo's `CLAUDE.md`).
2. Confirm every "required in prod" env var in §8 is already set in
   Railway — check *before* pushing, since a missing one now means the
   deploy fails to start rather than degrading silently.
3. Bump `package.json`'s version per this repo's `CLAUDE.md` mandatory
   versioning rule, in its own commit.
4. `git push origin main` (Railway auto-deploys).
5. Watch the Railway deploy logs for the new service coming up cleanly —
   specifically watch for a `FATAL: ... must be set` startup error, which
   would mean step 2 was missed.
6. `curl https://app.mironium.com/healthz` — expect `200` with `ok: true`,
   a `version` matching the bump in step 3, and a `gitSha` matching
   `git log --oneline -1`'s short SHA.
7. `curl https://app.mironium.com/api/version` — same version/SHA check,
   per this repo's existing post-deploy rule.
8. Confirm `/`, `/terms`, `/privacy`, `/refunds`, `/cancellation`,
   `/contact` all return `200` (not an SPA-fallback `404`/`index.html` for
   the legal routes — that would mean `handleLegalDoc` isn't wired, a
   regression this branch specifically fixes).
9. **Do not** create the `INSTAGRAM31` promo code or set
   `LEGAL_DOCS_VERSION` to a non-`"draft"` value as part of this release
   step — those are separate, deliberate go-live actions gated on
   marketing/legal sign-off (§2, §9), not automatic consequences of
   deploying this code.
10. Only after the above: work through `docs/sandbox-e2e-checklist.md`
    against Stripe test mode (not production) at least once before telling
    real customers the checkout works, since it has not been run in this
    session (see `docs/release-evidence.md`, DoD item 6).

## 11. Rollback plan

- **Code rollback**: `git revert` the merge commit (or redeploy the
  previous known-good commit via Railway's dashboard) and push to `main`.
  No manual database cleanup step is required first — see §7: the old
  code never reads the new tables, so reverting is safe to do first and
  investigate after, not something that needs to be sequenced around data
  state.
- **What rolling back does *not* undo**: any real orders/entitlements
  created by the new code while it was live stay in `orders`/
  `entitlements` — they simply become unreadable by the old code (which
  only looks at `subscriptions`) until this branch is deployed again. If a
  real rollback ever happens after real purchases occurred, a human needs
  to reconcile those orders manually (or fast-follow the rollback with a
  fix-forward instead of staying on old code for long) — this is not
  automated, and intentionally not attempted in this branch, since it
  would mean guessing at a scenario that hasn't happened.
- **Partial rollback (checkout only)**: if only the payment/checkout path
  needs to be pulled without a full code revert, setting
  `LEGAL_DOCS_VERSION` back to `"draft"` in Railway immediately 503s
  `POST /billing/checkout` again — the fastest available kill switch,
  reusing infrastructure this branch already built for a different reason
  (gating on legal sign-off), rather than a new one.
- **Promo campaign rollback**: set the `INSTAGRAM31` code's
  `expiresAt` to a past date and/or `maxRedemptions` to its current
  `redeemed_count` via the same admin endpoint used to create it (no code
  change needed) — this stops new redemptions immediately without
  affecting anyone who already redeemed.
- **Webhook rollback risk**: if a rollback happens while a Stripe webhook
  retry is in flight for an event the new code already recorded in
  `payment_events`, the old code has no concept of that table and will not
  see or reprocess it — this is safe (no double-charge, no double-grant)
  but means a webhook delivered *during* the rollback window could be
  effectively ignored by both versions. Reconcile against Stripe's own
  dashboard event log if a rollback happens mid-campaign, rather than
  assuming the DB is the complete record for that window.
