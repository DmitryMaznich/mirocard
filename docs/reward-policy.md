# Individual video reward rules

All students use the current reward policy, including profiles with no reward settings or a saved `algorithm: "legacy"`. There is no system selector. Adjust **Ученик → Правила видеоприза**, save, and start a new lesson. Settings are captured when a session starts; an earned video keeps the promised duration.

## Behavior contract

- Student settings: 1/2/3 minutes (or earlier if the video ends), noticeable/mild star animation, optional sound. Loading and pauses do not spend viewing time; a natural video end closes the reward sooner.
- Student settings also include strict counting and loss of one/all stars, shared across every topic and mode. Lesson settings show the same rules on the «Видеоприз» plate (`src/features/rewards/VideoPrizeCard.jsx`) and can change them there (owner, 2026-11-04) — it edits the student's rules (`saveStudentRewardSettings`, the same sync op as the student card), still shared by every topic; there are no per-topic overrides. Under the new rules strict counting controls intermediate mistakes in every topic that reports them. A wrong final answer always incurs a penalty. Topic-specific assessment and completion awards remain intact.
- Only one penalty per evaluated attempt. A penalized attempt cannot earn reward progress by correcting or guessing, including at zero balance. Moving to the next task starts a new attempt. All reported errors still enter statistics.
- One star removes one `answersPerStar` group. The new 5-of-5 display always shows five stars for targets of 5, 10, or 15 successful answers. Prize exchange has no loss animation.
- Genuine consecutive success statistics are separate from reward accumulation; softened penalties cannot unlock progression requiring consecutive independent successes.

## Rollback

Duration, strictness, loss, animation and sound remain individually configurable. The `algorithm` field is retained for compatibility but normalizes to `"flexible"`; saved choices in the other fields are preserved. Recovery rejects a saved session whose reward policy no longer matches the student's settings, including legacy sessions.

Source baseline: `backup/rewards-before-flexible-20261023`, commit `472f9f83` (v1.0.2703). If a deployment rollback is needed, revert the reward feature commit on current main, resolve intervening changes, bump the application version in a separate commit, build and deploy normally. Do not reset/force-push main. Database additions are nullable/defaulted columns; keep them during rollback to preserve saved choices. No student, session or statistics deletion is needed.

The retired `duration: "end"` choice normalizes to `"180"`, matching the three-minute limit.

Settings missing the new strictness/loss fields default to strict counting and loss of one star. Old topic-specific choices are retained for compatibility and do not override the new student policy.

Settings use a dedicated sync operation and timestamp. Older clients saving unrelated student fields cannot erase the choices or re-enable the legacy system.

## Verification

- `npx vitest run --maxWorkers=2`
- `node --test backend/tests/*.test.mjs`
- `npx playwright test -c tests/responsive/reward-settings.playwright.config.mjs`
- `npx playwright test -c tests/responsive/streak-tracker.playwright.config.mjs`
- `npm run build`

Browser checks emulate mobile/tablet sizes in Chromium; they do not establish physical iOS/Safari autoplay compatibility. Video timing is tested against a simulated YouTube API. Actual YouTube playback requires a network/device check where YouTube is accessible.
