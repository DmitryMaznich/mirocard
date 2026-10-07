# Word formation responsive checks

Run from the repository root:

```powershell
node scripts/build-word-formation-preview.mjs
npx playwright install chromium
npx playwright test -c tests/responsive/playwright.config.mjs
```

The setup builds a local fixture into `.cache/word-formation-responsive`. It uses the real renderer, session header, application styles, and text/images from the bundled word formation deck, without an account or backend. The browser opens the built fixture directly, so the checks do not depend on a development server.

The suite checks all eight task types plus image/phrase stimuli and hidden-image settings at 12 tablet/phone sizes, including rotation without remounting. It checks task overflow, text clipping and minimum button heights. A separate case verifies that selecting multiple categories still defaults to two answers, without an oversized list. Agreement is checked with and without the question hint. Introduction includes both the model and oral-answer states, without child-facing sample switches or manual grading. All seven categories share presentation rules. The tablet preview tests mode settings for choice count, images and checking. Screenshots for representative sizes are saved in `.cache`.

Use `RESPONSIVE_BROWSER=chrome` or `msedge` to override the default Playwright Chromium channel if needed.

The transfer set also checks text-only introduction, word selection and seasonal agreement with a new noun. It does not substitute familiar images for the new object.
