import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
test('service worker never serves or caches administrative pages and assets', () => {
  const handlers = {};
  const context = vm.createContext({ URL, self: { addEventListener: (name, fn) => { handlers[name] = fn; } } });
  vm.runInContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), context);
  for (const pathname of ['/admin.html', '/admin.js', '/admin.css', '/admin-model.js', '/api/admin/accounts', '/audio-review.html', '/audio-review.css', '/audio-review-manifest.json', '/admin-audio-review.js']) {
    let intercepted = false;
    handlers.fetch({ request: { url: 'https://app.mironium.com' + pathname, mode: 'navigate' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, pathname);
  }
});
