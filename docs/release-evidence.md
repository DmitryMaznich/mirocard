# Release evidence — commercial launch prep

This is the evidence record for the branch that became this PR, checked
against the 13-item Definition of Done from the original task brief. Every
verdict below is backed by a command actually run in this session (output
summarized; full output is in this session's transcript) — nothing here is
asserted without a corresponding test/command run against this branch.

**Verdict up front: this branch is not yet ready to flip on for real paying
customers.** 9 of 13 items are fully met (one — item 5 — is met specifically
for the M0 scope this launch uses, not for a full recurring-subscription
product), 3 are partially met (8 legal, 11 backups/restore drill, 13 tagged
releases) and 1 is not met (6 sandbox E2E). The blockers are not cosmetic:
no payment-provider sandbox run has ever been executed against this code,
the legal document text is still placeholder/draft by design, and there is
no off-site backup. Do not remove the "not yet
recommended for production" status in `docs/commercial-launch-runbook.md`
until those three are closed.

## Definition of Done — item by item

### 1. No token → no paid catalog/ZIP/UI access — **MET**

`backend/tests/paywall.test.mjs` asserts an unauthenticated request to the
deck catalog never includes a paid entry's real `url`, and a direct
unauthenticated request to a paid deck ZIP under `/decks/` 404s (the static
file no longer lives under the publicly-served directory — see
`isPubliclyServableDeckAsset()` in `backend/server.mjs`).

### 2. Local mode can't bypass payment — **MET**

`src/features/topics/catalogService.test.js` asserts `isFreeStaticInstall()`
no longer special-cases local mode as free; `TopicLibraryScreen.jsx`'s local
mode now redirects to the subscription screen instead of attempting (and
previously always succeeding at) a claim call. Covered by
`TopicLibraryScreen`'s existing test suite plus the catalogService test.

### 3. Expired entitlement blocks paid content — **MET**

`backend/tests/paywall.test.mjs` includes a scenario where an account has a
paid-looking local claim record but the server-side entitlement has since
expired — `handleClaimDeck`/`handleDownloadDeck` re-check entitlement state
server-side on every request rather than trusting a prior "paid" grant, and
the test asserts a `403`.

### 4. Promo gives exactly its period, doesn't burn on abandonment, can't be reused — **MET**

`backend/tests/billing-repository.test.mjs` covers: exact 31-day grant from
redemption time (not account creation/campaign start), a second redemption
attempt on the same account returning `already_used`, `maxRedemptions`/
`expiresAt` enforcement, and that an abandoned discount-code checkout never
increments `promo_redemptions` (only a webhook-confirmed payment finalizes
that via `finalizeDiscountRedemption`). Also covers `redeemFreeGrantCode`
replacing rather than stacking on an active trial (the explicit decision
documented in `docs/commercial-launch-runbook.md` §2).

### 5. Honest payment model — **MET for M0 scope; M1 not implemented**

M0 (this launch) never says "subscription"/"автосписание" anywhere in the
UI and never re-charges a card automatically — verified by grepping the
touched UI files (`SubscriptionScreen.jsx`, `CheckoutReturnScreen.jsx`,
`landing/*.html`) for renewal-implying language and finding none, plus the
explicit new disclaimer text next to the purchase button. This is a
deliberately narrower scope than "real recurring billing" — see
`docs/commercial-launch-runbook.md` §1 for the M1 architecture, which is
documented but **not implemented or tested**, per the brief's own
instruction not to build M1 without a separate sandboxed confirmation step.

### 6. Stripe/Lava sandbox E2E passed and documented — **NOT MET**

`docs/sandbox-e2e-checklist.md` exists and lists every required scenario
(successful payment, cancellation, 3DS, delayed/duplicate webhook, refund,
chargeback, expired access, iOS/Android checkout, popup-blocker scenario),
but **none of it has been executed** — this sandboxed session has no Stripe
test-mode or Lava Top sandbox credentials and no outbound network path to
either provider's API (confirmed: outbound HTTPS to external domains is
blocked by this environment's network policy). This is the single largest
gap before real money should touch this code. A human with real sandbox
credentials must run through that checklist and record results before
launch.

### 7. Transactional/idempotent webhook validating amount/currency/order/provider — **MET**

`backend/lib/billing-orchestrator.mjs`'s `processBillingEvent` validates
provider/amount/currency against the stored order *before* mutating
anything, and wraps event-record + order-complete + entitlement-extend +
promo-finalize in one `withTransaction` (`BEGIN IMMEDIATE`/`COMMIT`/
`ROLLBACK`, `backend/lib/db.mjs`). `backend/tests/billing-orchestrator.test.mjs`
covers: duplicate webhook delivery (idempotent by provider+event-ID, not
contract ID), a simulated mid-transaction crash on retry, refund/chargeback
handling, out-of-order/late webhook delivery, stacked renewals (the
max(now, current_end) rule), and provider/amount/currency mismatches being
rejected rather than silently trusted. `backend/lib/billing-providers/stripe.mjs`'s
`verifyStripeWebhookSignature` also now enforces a timestamp tolerance
window, covered in `backend/tests/billing-providers.test.mjs`.

### 8. Legal pages published+versioned, consent saved — **PARTIALLY MET**

The *infrastructure* is fully built and tested: `/terms`, `/privacy`,
`/refunds`, `/cancellation`, `/contact` are real server-rendered,
version-stamped routes (`backend/tests/legal.test.mjs`); checkout requires
three consent checkboxes persisted per-order with a timestamp and the
`LEGAL_DOCS_VERSION` in effect at that moment
(`backend/tests/legal-checkout-consent.test.mjs`); checkout is hard-gated
to `503` while `LEGAL_DOCS_VERSION` is `"draft"` (the shipped default). What
is **not met**: the documents are now full drafts for the decided scope
(EU only, Smart Washing d.o.o., Stripe only, statutory-minimum refunds —
see `docs/legal-launch-inputs.md` §1), but they have not been reviewed by a
lawyer, three company-register placeholders (`[[...]]`) are still unfilled,
and `LEGAL_DOCS_VERSION` is still `"draft"`, so checkout stays gated to
`503`. Open legal/tax questions are listed in `docs/legal-launch-inputs.md` §3.

### 9. No dev fallback secrets in production — **MET**

`backend/lib/config.mjs`'s `requiredInProduction()` now throws at startup
if `RAILWAY_ENVIRONMENT` is set and any of `AUTH_SECRET`, `ACCOUNT_SECRET`,
`MIROCARD_DEPLOY_TOKEN`, `MIROCARD_ADMIN_TOKEN`, `RESEND_API_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` is missing, instead of
silently running on a hardcoded insecure default. Covered by
`backend/tests/config.test.mjs`.

### 10. Photos/personal data never anonymously accessible — **MET**

Photos are owner-scoped since the photos/ops hardening stage:
`GET /api/photos/:hash` returns 401 without a token, 200 to an owning
account and 404 to any other signed-in account
(`backend/tests/photos.test.mjs`). Ownership lives in `photo_owners`
over the still de-duplicated `photos` table; a reference alone never
grants ownership (`backend/tests/photo-store.test.mjs`, incl. a
forged-reference case). Every stored photo is re-encoded server-side to a
metadata-free WebP within fixed size limits, and per-account quotas cap
how much any one account can store. The same stage fixed cross-account
writes to students/topics/progress by known id
(`backend/tests/cross-account-writes.test.mjs`).

### 11. Healthcheck + error alerting + external backup + restore drill — **PARTIALLY MET**

Built and tested: `/healthz` (incl. `offsiteBackup` status), pluggable
error/event hooks, bounded local rotation (336 -> ~38 snapshots), an
S3-compatible off-site upload with MD5/SHA-256/size verification, and a
restore command with `PRAGMA integrity_check`
(`backend/tests/backup-rotation-offsite.test.mjs`, against a fake S3 that
verifies signatures and checksums). **Not met until the owner does it:**
no bucket is configured in production yet, and no restore drill from a
real off-site copy has been performed (runbook §5).

### 12. CI fully green on a clean worktree — **MET**

`.github/workflows/ci.yml` has `backend-tests`, `frontend-tests`, `lint`,
and `build` jobs. Verified on this branch after merging current `origin/main`:
- `backend-tests`: 175/175 pass, 0 vulnerabilities in
  `npm audit --prefix backend`.
- `frontend-tests` (`npx vitest run`): 110/110 files, 1459/1459 tests pass.
  The 12 failures previously recorded here pre-existed on `origin/main` and
  were all stale tests that had not been updated after intentional code
  changes (youtube-nocookie embed URL, recipe sessions never auto-resuming,
  the new «Помощь и поддержка» menu item, the 5-structure `FINGER_MAP`,
  `choose_action` options switching to `actionInf`). The tests were updated
  to the current behavior; no app code was changed to make them pass.
- `npx eslint backend` (blocking) is clean.
- `npm run build` succeeds.
- Informational, non-blocking steps (`continue-on-error: true`): full-repo
  `npx eslint .` still reports pre-existing lint debt outside `backend/`,
  and the root `npm audit` reports build-tooling vulnerabilities (see
  below). Neither turns the CI run red.

### 13. Production release reproducible from commit SHA — **MET for identity; no tag-per-release process**

The Docker build now bakes the commit SHA into the image
(`RAILWAY_GIT_COMMIT_SHA` build arg / `GIT_SHA`) and fails without one,
so `/api/version` and `/healthz` can no longer report `unknown` from a
successful build. Verified locally on a `git archive` checkout without
`.git` (server reported the release commit's SHA from `build-info.json`),
and by a CI job that builds the real Docker image. Still true: deploys
are "merge to main", no git tags; the release checklist treats a
version/SHA mismatch as a failed deploy.

## Test commands run and their results (this session)

```
$ node --test backend/tests/
# 175/175 pass

$ npm audit --prefix backend
# 0 vulnerabilities

$ npx vitest run          # repo root
# 110 passed (files) | 1459 passed (tests)
# — after merging origin/main and updating 12 stale pre-existing tests

$ npx eslint backend
# clean, 0 problems (this is the first time backend/**/*.mjs was ever
# linted -- eslint.config.js previously had no glob matching .mjs files
# at all, a pre-existing config gap fixed in this branch)

$ npx eslint .            # repo root, informational only, not CI-blocking
# ~195 problems; ~190 pre-exist on origin/main, unrelated to this branch

$ npm run build
# succeeds; dist/index.html contains the real short git SHA (previously
# "unknown" due to the worktree git-sha bug, fixed and re-verified)

$ npm audit                # repo root
# 13 vulnerabilities, all in frontend/build dev-tooling (not backend
# production dependencies); "npm audit fix" was attempted once and crashed
# with an internal npm error unrelated to this branch's changes -- verified
# no partial state was written (package.json/package-lock.json stayed
# clean in git status) and deliberately not retried with --force, which
# would force an untested breaking sharp upgrade
```

Full command output is available in this session's transcript; the numbers
above are the final, re-confirmed values as of the last full validation
pass on this branch.

## Known residual risks (see also `docs/commercial-launch-runbook.md` §6)

- Lava Top's provider integration has never been exercised against Lava
  Top's real API — run the launch on the Stripe/card rail only until a
  sandbox call confirms it.
- No off-site backup exists for the Railway SQLite volume yet.
- Account deletion is soft-delete only; no self-service data export exists.
- Photo access is authenticated but not owner-scoped (documented schema
  limitation, not newly introduced).
- Production `/api/version`/`/healthz` could not be curled from this
  sandboxed session to confirm the *currently live* deployment's state —
  outbound network to `app.mironium.com` is blocked by this environment's
  proxy policy. Whoever merges this PR should run that check manually
  post-deploy, per the release checklist in
  `docs/commercial-launch-runbook.md` §10.
