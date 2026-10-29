# Firefox for Android: standalone launch investigation

## What was verified

The source inspected was `DmitryMaznich/mirocard` at
`daa1e3bf62e0ab0482357f703ca4b6c5cf57da71` (app version 1.0.2735).
`mirocard-railway` is an older copy and is not the canonical production source.

- `index.html` links `/manifest.json`.
- Manifest declares `display: standalone`, `start_url: /`, `scope: /` and a name.
- The declared PNG files exist and their actual dimensions are 192x192 and 512x512.
- `src/main.jsx` registers `/sw.js`; it has a fetch handler and offline caching.
- The Railway static handler in `backend/server.mjs` serves JSON, JavaScript and
  PNG MIME types and disables caching of index.html, manifest.json and sw.js.
- The install banner previously depended on `beforeinstallprompt` or iOS
  detection, making it invisible on Firefox Android. The patch adds a manual
  Firefox guide. This fixes the missing UI, not a proven manifest parsing defect.

Firefox's source distinguishes a normal bookmark (`ACTION_VIEW`) from a PWA
shortcut (`WebAppLauncherActivity`). The latter can hide browser UI within scope.
Firefox does not mint Chrome-style WebAPK packages. A separate Android package
and a standalone browser-hosted window are different requirements.

References:

- [Firefox installability predicate](https://github.com/mozilla-firefox/firefox/blob/main/mobile/android/android-components/components/feature/pwa/src/main/java/mozilla/components/feature/pwa/ext/SessionState.kt)
- [Firefox icon requirement and trusted scope](https://github.com/mozilla-firefox/firefox/blob/main/mobile/android/android-components/components/feature/pwa/src/main/java/mozilla/components/feature/pwa/ext/WebAppManifest.kt)
- [Firefox bookmark versus PWA launcher](https://github.com/mozilla-firefox/firefox/blob/main/mobile/android/android-components/components/feature/pwa/src/main/java/mozilla/components/feature/pwa/WebAppShortcutManager.kt)

## Automated checks

```sh
node --test scripts/verify-pwa-installability.test.mjs
node scripts/verify-pwa-installability.mjs --local
node scripts/verify-pwa-installability.mjs
```

The last command checks production HTTP responses. Source mode does not check
HTTP, HTTPS, redirects, actual service-worker activation or Gecko manifest parsing.
The live check confirms that the manifest and icons are not accidental SPA HTML
fallbacks, validates actual PNG dimensions, and checks the app's start page and
service-worker resource. Neither mode proves installation on an Android device.
CI runs both source and production checks on pull requests.

## Device acceptance check (still required)

1. Record Android version, Firefox version, device/launcher and exact URL.
   Use regular Firefox, a normal tab and `https://app.mironium.com/`.
2. Wait for the page to finish loading. Check whether Firefox's menu offers
   **Install** or only **Add to Home screen**. Do not call the second a successful
   standalone installation when its icon opens a regular tab.
3. If Install is available, remove the old bookmark icon and install a fresh
   icon. Launch from the icon, not browser history or a link.
4. Verify there is no address bar/tab strip at launch and after login and
   ordinary in-scope navigation. Exiting app scope may expose browser UI.
5. With Android remote debugging, inspect network/console errors for
   `/manifest.json`, both icons and `/sw.js`. Confirm the manifest JSON is the
   expected version, not an HTML fallback, and the page has a secure context.
6. In the window launched from the icon, run
   `matchMedia('(display-mode: standalone)').matches`. A true result verifies
   standalone display for that window, not a separate Android package.
7. If Firefox still only creates a bookmark despite valid resources, compare
   the same URL on a current Firefox Android version and capture the device's
   manifest/network evidence before attributing it to the app or Firefox.

Do not clear site data, unregister the service worker or erase IndexedDB as a
first troubleshooting step: users may have unsynced local work. Removing a
home-screen bookmark is sufficient to replace an incorrectly created launcher.

## Limits of this investigation

Direct outbound requests from the assistant workspace failed at the configured
proxy, before reaching app.mironium.com. This is not evidence that production is
down. Production HTTP results must be taken from CI, and Firefox Android launch
behavior must be verified on a device. There is no confirmed root cause yet for
the reported bookmark-only behavior.
