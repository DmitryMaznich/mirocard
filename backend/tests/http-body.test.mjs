// The 413 path must leave the connection in a clean state: the old reader
// threw mid-body and destroyed the request stream, so the socket was closed
// with unread data -- which the OS turns into a TCP RST, i.e. the client sees
// ECONNRESET instead of our 413 (reproducible on Windows; on Linux loopback
// the race rarely shows). These tests pin the mechanism deterministically.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

const { readLimitedBody, readJsonBody } = await import("../lib/http.mjs");

function fakeRequest(totalBytes, { chunk = 64 * 1024, declare = true } = {}) {
  let sent = 0;
  const stream = new Readable({
    read() {
      if (sent >= totalBytes) { this.push(null); return; }
      const n = Math.min(chunk, totalBytes - sent);
      sent += n;
      this.push(Buffer.alloc(n, 0x41));
    },
  });
  stream.headers = declare ? { "content-length": String(totalBytes) } : {};
  stream.bytesSent = () => sent;
  return stream;
}

test("within the limit the body is returned intact", async () => {
  const req = fakeRequest(100_000);
  const body = await readLimitedBody(req, 200_000);
  assert.equal(body.length, 100_000);
});

test("over the limit: the whole body is drained (stream ended, not destroyed), then 413 without forcing a close", async () => {
  const req = fakeRequest(5 * 1024 * 1024);
  await assert.rejects(readLimitedBody(req, 1024 * 1024, { drainCap: 64 * 1024 * 1024 }), (err) => {
    assert.equal(err.status, 413);
    assert.equal(err.closeConnection, false);
    return true;
  });
  assert.equal(req.bytesSent(), 5 * 1024 * 1024, "every byte was read");
  // Fully consumed to its natural end (then auto-destroyed as usual) --
  // not torn down with unread data, which is what causes the RST.
  assert.equal(req.readableEnded, true, "stream fully consumed");
});

test("beyond the drain cap it stops reading and asks the caller to close the connection", async () => {
  const req = fakeRequest(8 * 1024 * 1024, { declare: false });
  await assert.rejects(readLimitedBody(req, 1024 * 1024, { drainCap: 4 * 1024 * 1024 }), (err) => err.status === 413 && err.closeConnection === true);
  assert.ok(req.bytesSent() < 8 * 1024 * 1024, "did not read an abusive body to the end");
});

test("a declared Content-Length beyond the drain cap is refused without reading", async () => {
  const req = fakeRequest(8 * 1024 * 1024);
  await assert.rejects(readLimitedBody(req, 1024 * 1024, { drainCap: 4 * 1024 * 1024 }), (err) => err.closeConnection === true);
  assert.equal(req.bytesSent(), 0);
});

test("readJsonBody uses the same draining reader", async () => {
  const req = fakeRequest(2 * 1024 * 1024);
  await assert.rejects(readJsonBody(req, 1024), (err) => err.status === 413 && err.closeConnection === false);
  assert.equal(req.readableEnded, true);
});
