import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../lib/rate-limit.mjs";

test("allows up to max requests per key within the window, then rejects", () => {
  const check = createRateLimiter({ max: 3, windowMs: 60000 });
  assert.equal(check("a"), true);
  assert.equal(check("a"), true);
  assert.equal(check("a"), true);
  assert.equal(check("a"), false);
});

test("tracks separate keys independently", () => {
  const check = createRateLimiter({ max: 1, windowMs: 60000 });
  assert.equal(check("a"), true);
  assert.equal(check("b"), true); // a different key is unaffected
  assert.equal(check("a"), false);
});

test("resets after the window elapses", () => {
  let nowMs = 0;
  const realNow = Date.now;
  Date.now = () => nowMs;
  try {
    const check = createRateLimiter({ max: 1, windowMs: 1000 });
    assert.equal(check("a"), true);
    assert.equal(check("a"), false);
    nowMs = 1001;
    assert.equal(check("a"), true, "must allow again once the window has passed");
  } finally {
    Date.now = realNow;
  }
});
