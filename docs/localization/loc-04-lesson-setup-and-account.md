# Lesson setup and remaining primary adult screens — 1.0.2671

The saved RU/SL interface choice now reaches the general lesson-setup controls, known first-party mode names, text/concept pickers, account profile/security/deletion forms, help, privacy, subscription/checkout states and statistics/history.

## Data and language boundaries

- `setupText` is a display adapter for known UI labels in deck metadata. Explicit Slovenian metadata takes priority, unknown labels fall back to their source. Parameter IDs/values, input content, saved links, selected figures/concepts and learning statistics are never translated or rewritten.
- Mode names on home, mode selection and lesson setup are UI labels. Teaching instructions, methodology, material titles, lesson text/audio and generated AI summaries retain their source language.
- The existing account-language reconciliation and offline queue are unchanged.
- The published Slovenian privacy policy is imported directly from `backend/legal/sl/privacy.html`. The Russian policy stays unchanged; tests compare each in-app text to its published counterpart.
- Checkout's independent consent-language selector now starts in the interface language. The canonical consent wording, prices, payment gates and reset-on-consent-language-change behavior stay unchanged. Paid plans remain paused.
- A profile with no last name no longer displays the JavaScript word `undefined`. Validation errors in profile/security forms update when the UI language changes without clearing user input.

## Validation

- Local full frontend suite passed: 192 files, 2239 tests; subsequent focused checks passed after final copy/profile adjustments, including the added consent-language regression (billing: 32 tests).
- UI-language suite: 9 passed, including metadata immutability, explicit SL priority, unknown content fallback and CLDR plurals. Account-language (10) and rollout (4) checks passed.
- Mounted tests exercise changing parameters across language switches and starting with the original machine values; custom Russian text stays unchanged. They also preserve profile edits, deletion confirmation input, password fields, expanded FAQ and statistics period.
- Mobile Chromium walkthrough covered lesson setup/text picker, profile, help, privacy, statistics and subscription at 390px with simulated iOS safe areas; no page errors.
- Production build passed. No CSS or pinned screen edges changed. Existing lint findings in ParamsScreen and AnalyticsScreen match the baseline; no additional findings are accepted.

## Still to translate

Specialized calendar/Today, letter-case, print/PDF, recipe and safe-code settings; people/important-date editors; the lesson player/feedback/timer; registration/recovery flows; planner, instructions and lesson-plan tools. Teaching content needs explicit language packages and native editorial review.

## Release

Version is bumped in a separate commit. Baseline: 1.0.2670 / `7684484ebbf146b37734bffc74911ffe360a1d48`; preserve `codex/rollback-before-lesson-localization-2671` before merging. No database/schema, deck ZIP, backend or published legal-text changes are required.
