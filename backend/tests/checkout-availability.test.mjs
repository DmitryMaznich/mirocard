// While legal docs are "draft", checkout answers 503. The client must know
// that up front (via the public signup-status) so it can say "оплата скоро"
// instead of letting a parent fill the form and hit a raw English error.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-checkout-avail-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-checkout-avail-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
delete process.env.LEGAL_DOCS_VERSION; // default "draft" -> checkout off

const { router } = await import("../server.mjs");
const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

test("signup-status tells the client that checkout is off while legal docs are draft", async () => {
  const s = await (await fetch(`${base}/api/auth/signup-status`)).json();
  assert.equal(s.checkoutEnabled, false);
});
