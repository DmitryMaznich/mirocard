# Handoff: Claude Code session 2026-09-23 (commercial-launch prep)

Audience: the next coding agent (Codex) picking this work up. Everything
below is either verified in this session (command/test/CI output) or
explicitly marked as unverified. Owner = the product owner (Dmitry).

## 0. TL;DR state

| Thing | State |
|---|---|
| Production (Railway `mirocard-backend`) | **v1.0.2253**, commit `96409a40` (merge of PR #19). Deployed 2026-09-23 14:13 UTC, status SUCCESS. Reports `gitSha: "unknown"` (fixed in PR #20, not deployed). |
| PR #18 (launch prep) | Merged into `main` (`5a97bc6a`, v1.0.2251). |
| PR #19 (unlimited access + 2-step subscription screen) | Merged into `main` (`96409a40`, v1.0.2253). |
| **PR #20** `claude/commercial-hardening-photos-ops` | **Open, not merged, not deployed.** Head `6f62318a` (v1.0.2254). All 5 CI jobs green incl. the new Docker job. https://github.com/DmitryMaznich/mirocard/pull/20 |
| Checkout / real money | **Disabled by design**: `LEGAL_DOCS_VERSION` unset in Railway -> `"draft"` -> `POST /api/billing/checkout` returns 503. |
| Promo `INSTAGRAM31` | **Not created.** |
| Off-site backups | Code in PR #20; **no bucket configured**, no restore drill done. |

Hard boundaries the owner set (keep respecting them unless told otherwise):
no Railway deploys without explicit owner "go"; don't touch real secrets /
Stripe / Resend / Railway variables / legal version; don't create the real
promo code; don't enable checkout; no M1 recurring billing; no destructive
migrations; never claim Stripe sandbox, legal review or off-site backup
are done without real proof.

## 1. Chronology of this session

1. **Found the earlier (other-account) launch-prep branch**
   `claude/app-fix-prep-vx1j7v` / PR #18: 13-item Definition of Done in
   `docs/release-evidence.md`.
2. **Merged `main` into it**, fixed 12 stale frontend tests (tests lagged
   intentional code changes; no app code changed).
3. **Legal drafts** (owner decisions: EU only, seller Smart Washing d.o.o.,
   Slovenia, Stripe only, statutory-minimum refunds): full RU texts in
   `backend/legal/*.html`, **Slovenian** versions in `backend/legal/sl/*.html`
   served at `/sl/<slug>` with a language switcher. Checkout withdrawal
   checkbox strengthened ("теряю право"), purchase email confirms the
   waiver (durable medium), RU/SL toggle on checkout consents
   (`checkout_consents.locale`), purchase email sent in consent language.
   Placeholders `[[MATIČNA ŠTEVILKA]]`, registering court, share capital
   still unfilled. Open lawyer/accountant questions:
   `docs/legal-launch-inputs.md` §3. **Not legally reviewed.**
4. **МИР/СБП (Lava Top)** shown disabled ("скоро") in UI and refused
   server-side (`DISABLED_CHECKOUT_METHODS`).
5. **Release of PR #18 (v1.0.2251)** after pre-merge checks that caught two
   prod-breaking bugs: (a) Stripe keys were required at startup but absent
   in Railway -> now required only when checkout is enabled; (b) the new
   reminder loop would have emailed every long-expired trial -> "expired"
   reminder limited to the last 3 days.
6. **PR #19 (v1.0.2253)**: pre-launch accounts (created before
   2026-09-23T22:00:00Z = 24.09 00:00 CEST) get `all_access` automatically
   at startup (`grantAllAccessToExistingAccounts` in `backend/lib/db.mjs`;
   the old manual script had never been run in prod). Railway log after
   deploy: `Granted all_access to 8 pre-launch account(s).` Subscription
   screen became two-step (status + plans -> "Перейти к оплате" -> method,
   consents, pay); unlimited accounts see no purchase UI.
7. **PR #20 (this handoff's main subject)** -- see §2.

## 2. PR #20 contents (branch `claude/commercial-hardening-photos-ops`)

Base `origin/main` @ `96409a40`. 11 commits, ~48 files.

### 2.1 Photos
- `backend/lib/photo-normalizer.mjs`: libvips (`sharp` **0.35.4**, backend
  runtime dep) decodes every photo; MIME/extension ignored; JPEG/PNG/WebP
  only; HEIC rejected (prod libvips has no HEVC decoder -- verified:
  `sharp.format.heif.input.fileSuffix == [".avif"]`); EXIF orientation
  applied, all metadata stripped; <=1440 px long side, never upscaled;
  WebP q84 -> q76/68/60 -> 1312/1184/1056/1024 px until <=550 KiB, hard
  max 650 KiB else reject; 16 MP pixel guard; 10 MiB input.
- `backend/lib/photo-store.mjs`: `photo_owners(hash, account_id, created_at,
  released_at)` over de-duplicated `photos`; `GET /api/photos/:hash` -> 401
  no token / 200 owner / 404 others. Ownership only from storing bytes or
  the **one-time** backfill (`app_migrations.photo_ownership_backfill_v1`)
  -- a reference alone never grants access (a re-running backfill would
  have been exploitable; that's why it's once-only).
- Quotas: `MAX_PHOTOS_PER_ACCOUNT=12`, `MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT=6 MiB`;
  re-upload free; unreferenced photos "released" after 24h (still readable).
- Sync: `resolveSyncOperationPhotos` normalizes `data:` photos before the
  synchronous repository code; rejected ops are dropped and returned in
  `rejected[]` with **HTTP 200** (client queue in `src/core/syncApi.js`
  retries non-2xx forever and would stall). Client shows them via
  `src/shared/components/SyncRejectedNotice.jsx`.
- Repository layer (`extractAndStorePhoto`) now **throws** on raw `data:`.
- Legacy `data:` photos converted at startup (`migrateLegacyDataUrlPhotos`,
  awaited before `listen`); unreadable ones left untouched.
- Client uploads: avatars up to 1024 px (were 200/400 px), instruction
  photos up to 1440 px (were 640 px).

### 2.2 Security fixes found along the way (each has a failing-first test)
- **Paywall bypass**: `upsertAccountTopic` stored client `source` verbatim;
  sync `topic.acquire` or `POST /account-topics` with `source:"grant"`
  unlocked paid ZIPs (or kept them after expiry). Granting sources
  (`free|grant|paid`) are now server-only.
- **Cross-account writes by id**: student upsert/delete, topic delete,
  student-topic link upsert, concept progress -> all account-scoped
  (`backend/tests/cross-account-writes.test.mjs`).
- JSON bodies were unbounded -> `MAX_JSON_BODY_BYTES` (24 MiB); 413 now
  sends `Connection: close` (otherwise the unread body broke the next
  request on the same socket -- reproduced in tests).
- `sharp` 0.34.5 had high-severity libvips/libheif CVEs -> 0.35.4.

### 2.3 Backups
- Rotation (`backend/lib/backup/rotation.mjs`): 24 hourly + 1/day for 14
  days (336 -> 38 files measured); deletes only exact snapshot-name regular
  files in the backup dir.
- Off-site (`backend/lib/backup/s3-client.mjs`): hand-rolled SigV4
  (matches AWS's published test vector), PUT with Content-MD5 + signed
  payload SHA-256, HEAD verifies size + `x-amz-meta-sha256`. Every 6h.
  Not configured -> structured warning + `reportError`/`trackEvent`.
- Restore: `scripts/restore-sqlite-backup.mjs` (`--list`, `--from-s3
  latest|<key>`, `--file`, `--out`, never overwrites without `--force`),
  SHA-256 + `PRAGMA integrity_check` + core table counts.
- `/healthz` gained `offsiteBackup {configured,lastUploadAt,ageMinutes}`;
  backup age now counts snapshots only.
- Tests use a fake S3 server that re-verifies signatures and checksums.

### 2.4 Release identity
- Root cause of prod `gitSha: "unknown"`: Railway's Dockerfile build
  context has no `.git`.
- Fix: `Dockerfile` declares `ARG RAILWAY_GIT_COMMIT_SHA` / `ARG GIT_SHA`,
  runs `node scripts/build-info.mjs --write --require-sha` (**build fails
  without a SHA**), writes `build-info.json`; runtime order env ->
  `build-info.json` -> `.git`. `.dockerignore` excludes `.git`.
- Verified: local `git archive` checkout (no `.git`) + prod-like server;
  CI job "Docker image reports its commit SHA" (logs checked: no-SHA build
  fails at the build-info step; image with SHA reports it on both endpoints;
  no `/app/.git`; sharp 0.35.4 / libvips 8.18.6 loads in the image).
- **Unverified:** that Railway actually passes `RAILWAY_GIT_COMMIT_SHA` as
  a build arg (documented at docs.railway.com/builds/dockerfiles; confirm
  on the first deploy of PR #20 -- if the build fails with "No git commit
  SHA available", see runbook §5 emergency note).

### 2.5 Paid content / offline
- `SessionScreen` wrapper locks a lapsed paid topic for **every** entry
  path (library, home, lesson plan, params, resume); helper
  `isPaidTopicLocked` in `src/features/billing/entitlement.js`.
- Documented limit: an offline device's downloaded ZIP can't be
  cryptographically revoked; Terms don't promise that (no legal change).

### 2.6 Docs updated
`docs/commercial-launch-runbook.md` §5 (backups, restore drill, release
identity, photos, offline), §6, §7 (migrations table + idempotency), §8
(all new env vars), §10 (gitSha mismatch = failed deploy);
`docs/release-evidence.md` items 10/11/13; `docs/backup-restore.md`;
`CLAUDE.md` backup section.

### 2.7 Review fixes (2026-09-24, before merge)
Owner review found four issues; all fixed on this branch:
1. **Photos 401 in the UI** (already live since #18): params screens,
   «Мои люди» cards/editor/tasks and `sentence_puzzle` rendered
   `/api/photos/...` with plain `<img>`/SVG `<image>`. Now one loader
   (`src/shared/utils/protectedPhoto.js`, token via `window.__Mirocard`
   for deck-ZIP copies), `AuthenticatedImage`, `useTopicFile`, and
   `SessionScreen` resolving photos inside renderer props. The
   `sentence_puzzle` ZIP was deliberately NOT rebuilt: its source
   `topic.json` (1.10.0) and renderer carry an unreleased
   `listen_write_letters` mode; the props resolution covers installed ZIPs.
2. **SQLite growth**: unused links are now deleted and orphan bytes
   physically deleted after the grace period (`pruneUnreferencedPhotoLinks`,
   `deleteOrphanPhotos`, `collectPhotoGarbage` hourly + startup + quota
   path); 40-replacement test leaves one row. Legacy pre-migration rows are
   never auto-deleted.
3. Student/close-adult client crop 1024 -> **1440 px**
   (`src/features/students/studentPhoto.js`).
4. **Upload limits**: HTTP body limit derived from the 10 MiB image limit
   (+base64/JSON, ~13.75 MiB); over-limit bodies are drained before a JSON
   413 (old code destroyed the stream mid-body -> RST/ECONNRESET, seen on
   the owner's machine; not reproducible on Linux loopback, so the
   mechanism is pinned by `backend/tests/http-body.test.mjs`).

## 3. Verification commands and results (PR #20, clean worktree)

```
npm ci                                            -> ok
npm ci --prefix backend                           -> ok
npm run build                                     -> ok
npx eslint backend                                -> clean
npm audit --omit=dev --audit-level=high           -> 0 (root), 0 (backend)
node --test backend/tests/*.test.mjs              -> 239/239
npx vitest run                                    -> 112 files, 1472/1472
```
Full-repo `npx eslint .` still has pre-existing errors outside touched
lines (informational CI step); verified identical on `origin/main` for
`SessionScreen.jsx`, `App.jsx`, `StudentEditScreen.jsx`.

## 4. Environment gotchas (for an agent in a similar sandbox)

- Docker daemon wasn't running; `dockerd &` works, but **Docker Hub blob
  host is blocked** by the network policy -> real image builds only in CI.
- `app.mironium.com` is not reachable from the sandbox; use the Railway
  MCP (`list-deployments`, `get-logs`) to verify deploys.
- The auto-mode permission classifier once blocked follow-up actions after
  a PR merge ("Merge Without Review"); merge only on the owner's explicit
  "мёржи"/"deploy".
- Tests: root has `sharp` 0.34.5 as a **devDependency** for build tools;
  backend uses its own `sharp` 0.35.4 (import by package name -- 0.35
  moved its entry to `dist/`).
- Test fixtures of near-identical solid colours collapse to the same WebP
  hash (dedup) -- use strongly different colours when you need distinct
  photos.

## 5. What is NOT done / next steps

Owner-only (cannot be done by an agent):
1. Merge PR #20, then verify `curl /api/version` gitSha ==
   `git rev-parse --short=7 origin/main` (mismatch/`unknown` = failed deploy).
2. Create private EU Cloudflare R2 bucket + scoped token; set `BACKUP_S3_*`
   in Railway; run the restore drill (runbook §5); record time in
   `docs/release-evidence.md`.
3. Fill legal placeholders, lawyer/accountant review
   (`docs/legal-launch-inputs.md` §3: language, VAT/OSS threshold, invoices,
   ZDavPR fiscalization, SKD activity code, minors' data/DPIA, soft-delete
   vs GDPR erasure), native Slovenian proofread; then set
   `LEGAL_DOCS_VERSION`.
4. Stripe **test-mode** E2E per `docs/sandbox-e2e-checklist.md` (needs
   Stripe test keys; never run so far).
5. Decide `INSTAGRAM31` limits/expiry, then create it via the admin API.

Agent-doable follow-ups (not started):
- Hard account deletion + self-service data export (GDPR gap; photos are
  deduped, so delete only `photo_owners` links + orphaned `photos` rows).
- Watch the 12-photo quota (includes instruction-step photos); raise via
  env if needed.
- Photos uploaded via `POST /photos` but not yet synced at PR #20's first
  deploy won't get an owner (404 for their owner) -- rare; could add a
  grace "claim on first reference within N hours of upload" if reported.
- Legacy JPEG rows in `photos` are served as-is (not re-encoded).
- Lava Top stays disabled until sandbox-verified + legal docs cover it.

## 6. Key files

```
backend/lib/photo-normalizer.mjs     backend/lib/photo-store.mjs
backend/lib/backup/rotation.mjs      backend/lib/backup/s3-client.mjs
scripts/railway-backup-loop.mjs      scripts/restore-sqlite-backup.mjs
scripts/build-info.mjs               Dockerfile  .dockerignore
backend/lib/config.mjs (all new env) backend/lib/db.mjs (migrations)
backend/server.mjs (photo/sync/healthz handlers)
src/core/syncApi.js  src/shared/components/SyncRejectedNotice.jsx
src/features/session/SessionScreen.jsx  src/features/billing/entitlement.js
docs/commercial-launch-runbook.md  docs/release-evidence.md
docs/legal-launch-inputs.md        backend/legal/**  (RU + sl/)
```
