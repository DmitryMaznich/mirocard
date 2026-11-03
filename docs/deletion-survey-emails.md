# Automatic account deletion survey

Self-service `DELETE /api/account` archives the account and atomically queues one
email for 24 hours later. Administrative archive, block, student deletion and
permanent erasure do not schedule surveys. The agreed Russian email contains ten
reasons, a first-name greeting with a neutral fallback, and a promise not to
contact the recipient again without permission. Replies go to
`dmaznichenko@gmail.com` by default. There are no forms, login links or trackers.

## Production operation

The main Railway backend process starts the dispatcher automatically and checks
the SQLite queue every minute. No workstation, cron job or Codex automation is
required. Set `DELETION_SURVEY_EMAILS=0` to stop dispatching. Sender and reply
address can be overridden with `DELETION_SURVEY_FROM` and
`DELETION_SURVEY_REPLY_TO`; the approved defaults need no extra configuration.

Delivery is no earlier than 24 hours after self-deletion, normally on the next
minute tick. Existing email budget guards take precedence so verification and
password-reset capacity remain available. At most one survey is dispatched per
tick. Transient errors are retried with backoff; permanent API rejections are
retained as failed for review.

`GET /api/admin/deletion-surveys` requires the existing admin bearer token. It
returns whether the loop is running, its last tick, queue counts, the next
attempt and latest send time, without recipient addresses.

## One-time contact and recovery

- A normalized-email SHA-256 primary key records the one-time survey across
  account restoration, deletion and re-registration.
- The 41 receipts from the November 2 manual campaign are imported from
  `backend/data/deletion-survey-history.json`. Only hashes, provider receipt IDs
  and send timestamps are included; names and addresses are not in the seed.
- Startup recovers current self-deletions not already recorded. It does not
  create jobs for administrative or unknown legacy deletions.
- Restoration cancels a queued job. A later self-deletion resets the 24-hour
  delay only if the previous job was cancelled before any attempt.
- Permanent erasure cancels unsent work, clears the recipient snapshot and
  detaches the account ID. A minimal hash receipt prevents unsolicited repeats.
- An account restored while a network send is already in flight may still
  receive that single in-flight message; completed network requests cannot be
  recalled.
- Old news consent is withdrawn when the account self-deletes, including once
  when importing the manual campaign receipts. A later explicit opt-in remains
  effective and is not undone by subsequent restarts.

The provider idempotency key and exact payload are persisted before sending.
Competing workers claim jobs with a lease. Retries reuse the same body/key, and
are stopped after 23 hours from the first attempt because Resend retains keys
for only 24 hours. An expired uncertain send is held for manual review, never
blindly resent. Successful sends retain only the receipt, not a second copy of
the recipient or email body. A provider-accepted email may still bounce later;
acceptance is not proof of inbox placement or reading.

Relevant tests: `node --test backend/tests/deletion-survey*.test.mjs` plus the
existing account-lifecycle, marketing consent and email-budget tests. All test
emails use fake transports; tests do not send real mail.
