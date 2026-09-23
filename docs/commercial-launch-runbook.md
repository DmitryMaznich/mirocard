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

Two layers (`scripts/railway-backup-loop.mjs`, runs in-process on Railway,
gated on `RAILWAY_ENVIRONMENT`):

1. **Local snapshots, bounded rotation.** Every hour `VACUUM INTO` a new
   snapshot in `<DATA_DIR>/backups` + `PRAGMA integrity_check` (throws on
   failure; a failed cycle is reported and retried next hour, never crashes
   the process). Rotation (`backend/lib/backup/rotation.mjs`): the newest
   `BACKUP_KEEP_HOURLY` (24) snapshots, then at most one per UTC day for
   `BACKUP_KEEP_DAILY_DAYS` (14) more days -- ~38 files instead of 336.
   Only files matching the exact snapshot name pattern, directly in that
   directory and not symlinks, are ever deleted.
2. **Off-site copy (optional, S3-compatible).** When `BACKUP_S3_*` is set,
   every `BACKUP_S3_EVERY_HOURS` (6) the verified snapshot is uploaded to
   the bucket (`backend/lib/backup/s3-client.mjs`, SigV4, checked against
   AWS's published test vector). The PUT carries `Content-MD5` and a
   signed SHA-256 of the payload (the store rejects a mismatched body); a
   HEAD afterwards verifies size and the SHA-256 recorded as object
   metadata. Not configured -> one structured warning
   (`"code":"offsite_backup_not_configured"`) + `reportError` /
   `trackEvent` per process start; the app keeps running. `/healthz`
   reports `offsiteBackup: {configured, lastUploadAt, ageMinutes}`.

**Recommended bucket:** Cloudflare R2 (no egress fees, S3 API). Create a
bucket (e.g. `mironium-backups`), an API token scoped to *Object Read &
Write on that bucket only*, and a lifecycle rule deleting objects older
than e.g. 30 days. Then set in Railway -> `mirocard-backend` -> Variables:
`BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
`BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
(`BACKUP_S3_REGION` defaults to `auto`, `BACKUP_S3_PREFIX` to
`mirocard/sqlite/`). Backups contain personal data incl. children's
photos: the bucket must be private and EU-located (R2 "EU" jurisdiction).

**Restore drill -- required before calling backups done.** Nothing in this
repo has been restored from a real off-site copy yet; that is a manual,
owner-run step after merge:

1. On a machine with Node 22 and this repo, export the same `BACKUP_S3_*`
   values (read-only credentials are enough).
2. `node scripts/restore-sqlite-backup.mjs --list` -> shows snapshots.
3. `node scripts/restore-sqlite-backup.mjs --from-s3 latest --out /tmp/restore-drill/mirocard.db`
4. **Success =** exit code 0, output ends with `RESTORE OK`, JSON shows
   `"integrity": "ok"`, the recorded SHA-256, and row counts for
   `accounts`/`students`/`photos`/`orders` that are plausible vs.
   production (e.g. accounts within a few of the live count).
5. Boot the app on the copy: `MIROCARD_DATA_DIR=/tmp/restore-drill node backend/server.mjs`,
   then `curl localhost:3012/healthz` and log in with a known test account.
6. Write the date, snapshot key and total time taken into
   `docs/release-evidence.md` (that time is the real RTO). Repeat quarterly.

`--file <path>` restores/verifies a local snapshot the same way. The
command never overwrites an existing path unless `--force` is passed; it
never touches the live database on its own.

### Release identity

Railway builds from the Dockerfile **without `.git` in the context**, so
the old `.git`-reading resolver reported `gitSha: "unknown"` in production.
Now (`scripts/build-info.mjs`):

- the Dockerfile declares `ARG RAILWAY_GIT_COMMIT_SHA` (Railway passes its
  provided variables into a Dockerfile build only when declared as `ARG` --
  docs.railway.com/builds/dockerfiles#using-variables-at-build-time) and
  `ARG GIT_SHA` for manual/CI builds;
- the build writes `build-info.json` (full SHA, version, source) into the
  image and **fails if no SHA is available** (`REQUIRE_GIT_SHA=1`), so an
  image that can't identify its commit is never deployed (Railway keeps the
  previous deployment running when a build fails);
- server and frontend resolve: env -> `build-info.json` -> `.git` (dev only);
- `.dockerignore` keeps `.git` out of local builds too, so they match Railway;
- CI job "Docker image reports its commit SHA" builds the real image with
  and without a SHA and asserts `/api/version` + `/healthz` report it.

**A deploy is not successful unless** `curl https://app.mironium.com/api/version`
and `/healthz` return the `version` of the release commit **and** a
`gitSha` equal to the first 7 characters of that commit
(`git rev-parse --short=7 origin/main` after the merge). `unknown` or a
different SHA = the deploy is not the release you prepared; stop and
investigate before announcing anything.

Emergency only: if a Railway build ever fails with "No git commit SHA
available" although the commit exists (e.g. a manual `railway up` without
git metadata), set a service variable `GIT_SHA=<full sha>` for that build.
Do not set `REQUIRE_GIT_SHA=0` in production.

### Photos (children's photos -- privacy-critical)

- Every photo (student, close adults, "Мои люди", instruction steps,
  legacy inline `data:` URLs) is decoded server-side by libvips (`sharp`)
  and re-encoded (`backend/lib/photo-normalizer.mjs`): JPEG/PNG/WebP only
  (MIME type/extension ignored), HEIC rejected with instructions (the
  production libvips has no HEVC decoder), EXIF orientation applied, all
  metadata (incl. GPS) stripped, max 1440 px long side, WebP q84 -> lower
  quality -> lower resolution (not below 1024 px) until <= 550 KiB, hard
  max 650 KiB, 16 MP decompression-bomb guard, 10 MiB input.
- Ownership (`photo_owners`): `GET /api/photos/:hash` only for an owning
  account; everyone else gets 404. A reference alone never grants
  ownership; the one-time backfill (`app_migrations:
  photo_ownership_backfill_v1`) linked photos that existing data referenced
  when this shipped.
- Quotas per account: `MAX_PHOTOS_PER_ACCOUNT` (12) and
  `MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT` (6 MiB). Re-uploading an owned photo
  is free; a photo no longer referenced anywhere stops counting after
  `PHOTO_UNREFERENCED_GRACE_HOURS` (24). Over quota -> 409 with a message
  saying what to delete/replace; in sync, the op is dropped and reported in
  `rejected` (the client shows it; the queue never stalls).
- **Watch after launch:** 12 photos per account includes instruction-step
  photos; a user building many photo instructions will hit it. Raise via
  env if support tickets show it.

### Paid content and the offline boundary

- Server: a paid deck's claim/download re-checks the entitlement on every
  request; a client can no longer self-assign a granting topic source
  (fixed: sync `topic.acquire` / `POST /account-topics` with
  `source:"grant"` used to unlock paid decks without paying).
- Client: every session start passes `SessionScreen`, which shows "Доступ
  закончился" for a downloaded paid topic once the entitlement lapsed
  (previously only the library tile checked).
- **Limit, by design:** a downloaded ZIP lives in the device's browser
  storage. It cannot be cryptographically revoked from a device that stays
  offline: offline, the lock uses the last-synced end date and the device
  clock, and a technically skilled user could extract the files. The Terms
  promise that access *ends* (true in the app) and forbid circumventing
  technical restrictions (§8); they do not promise deletion of offline
  copies. No legal text change needed; open question for the lawyer only
  if a stronger promise is ever wanted.

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
- Off-site backup is **implemented but not yet configured**: until the
  owner creates the bucket and sets `BACKUP_S3_*` (see §5), all snapshots
  still live on the same Railway volume as the DB. A restore drill from a
  real off-site copy has not been performed.
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

**Added in the photos/ops hardening stage** (all in `initDb()` or awaited
before the server listens; none deletes or rewrites user data):

| Migration | What it does | Why it is idempotent |
|---|---|---|
| `photo_owners` table + index | New table (hash, account_id, created_at, released_at), PK (hash, account_id) | `CREATE TABLE/INDEX IF NOT EXISTS` |
| `photos.byte_size` | Adds the column, fills decoded size for rows where it is NULL (BLOB = length, base64 = computed) | Column added only if missing; `UPDATE ... WHERE byte_size IS NULL` touches only unfilled rows |
| Ownership backfill | Links each photo hash that existing student rows (photo, closeAdults, "Мои люди", profile) and `account_kv` values reference to that account, only if the photo exists | Runs **once per database**, recorded in `app_migrations` (`photo_ownership_backfill_v1`); `INSERT OR IGNORE` on the PK. Once-only is a security property: later references must not grant ownership |
| Legacy `data:` photos | Rows still holding inline `data:` URLs (student photo / closeAdults / "Мои люди") are normalized to WebP, stored, owner-linked and replaced by `/api/photos/<hash>`; unreadable ones are left exactly as they were | Only rows matching `LIKE 'data:%'` are selected; after conversion they no longer match. Quota not enforced (existing data) |
| `all_access` grant (previous stage) | Pre-launch accounts get the flag | Only adds a missing flag |

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
| `STRIPE_SECRET_KEY` | No (pre-existing var) | **Only once checkout is enabled** (`LEGAL_DOCS_VERSION` != `draft`) | `""` | Stripe API key. Production currently has none; requiring it unconditionally would have crashed the first deploy. |
| `STRIPE_WEBHOOK_SECRET` | No (pre-existing var) | Same as above | `""` | Stripe webhook signature verification secret. |
| `AUTH_SECRET` | No (pre-existing var) | **Yes, newly enforced** | `"dev-auth-secret-change-me"` | Session/token signing secret. Was previously allowed to silently run in production on the hardcoded dev default. |
| `ACCOUNT_SECRET` | No (pre-existing var) | **Yes, newly enforced** | `"dev-account-secret-change-me"` | Same class of fix as `AUTH_SECRET`. |
| `MIROCARD_DEPLOY_TOKEN` | No (pre-existing var) | **Yes, newly enforced** | `"mirocard-deploy-2026"` | Same class of fix. |
| `MIROCARD_ADMIN_TOKEN` | No (pre-existing var) | **Yes, newly enforced** | `"dev-admin-token-change-me"` | Guards `/admin/*` routes, including the promo-code creation endpoint used in §2. |
| `RESEND_API_KEY` | No (pre-existing var) | **Yes, newly enforced** | `""` | Transactional email API key. Was previously allowed to silently degrade to console-logging emails in production. |
| `LAVA_TOP_API_KEY` / `LAVA_TOP_WEBHOOK_SECRET` | No (pre-existing vars) | No — **deliberately exempt** | unset | Left optional because the Lava Top integration is unverified (see §6/§9) — a production deploy without these just 502s the "МИР / СБП" payment option rather than refusing to start over an optional rail. |
| `PHOTO_MAX_INPUT_BYTES` | Yes | No | `10485760` (10 MiB) | Max `POST /photos` body and max decoded size of one photo. |
| `PHOTO_MAX_INPUT_PIXELS` | Yes | No | `16000000` | Decompression-bomb guard (decoded pixels). |
| `PHOTO_MAX_LONG_SIDE` / `PHOTO_MIN_LONG_SIDE` | Yes | No | `1440` / `1024` | Output long side; size reduction never goes below the minimum. |
| `PHOTO_WEBP_QUALITY` / `PHOTO_WEBP_MIN_QUALITY` | Yes | No | `84` / `60` | Start and floor WebP quality. |
| `PHOTO_TARGET_OUTPUT_BYTES` / `PHOTO_MAX_OUTPUT_BYTES` | Yes | No | `563200` (550 KiB) / `665600` (650 KiB) | Target and hard maximum stored photo size. |
| `MAX_PHOTOS_PER_ACCOUNT` | Yes | No | `12` | Active photos per account. |
| `MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT` | Yes | No | `6291456` (6 MiB) | Active photo bytes per account. |
| `PHOTO_UNREFERENCED_GRACE_HOURS` | Yes | No | `24` | After this, a photo the account no longer references stops counting toward its quota. |
| `MAX_JSON_BODY_BYTES` | Yes | No | `25165824` (24 MiB) | Cap for any JSON request body (was unbounded). |
| `BACKUP_KEEP_HOURLY` / `BACKUP_KEEP_DAILY_DAYS` | Yes | No | `24` / `14` | Local snapshot rotation. |
| `BACKUP_S3_ENDPOINT` / `BACKUP_S3_BUCKET` / `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY` | Yes | No (warning if unset) | unset = off-site disabled | S3-compatible off-site backup target (see §5). |
| `BACKUP_S3_REGION` / `BACKUP_S3_PREFIX` / `BACKUP_S3_EVERY_HOURS` | Yes | No | `auto` / `mirocard/sqlite/` / `6` | Off-site details. |
| `GIT_SHA` (build arg) / `RAILWAY_GIT_COMMIT_SHA` (Railway-provided) | Yes | Build fails without one | -- | Release identity baked into the image (see §5). Not a service variable to set by hand. |

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
6. `curl https://app.mironium.com/healthz` — expect `200`, `status: "ok"`,
   a `version` matching the bump in step 3, and a `gitSha` equal to
   `git rev-parse --short=7 origin/main` of the merged release commit.
   **`unknown` or any other SHA = the deploy is NOT successful** (§5
   Release identity). Also note `offsiteBackup.configured`.
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
