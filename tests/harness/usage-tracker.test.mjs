import { test } from "node:test";
import assert from "node:assert/strict";
import { createUsageTracker } from "../../src/shared/hooks/usageTracker.js";
test("time excludes hidden tabs, idle after one minute and sleep gaps; context changes flush the previous topic", () => {
  let at = Date.parse("2026-10-08T12:00:00Z"),
    visible = true;
  let state = {
    token: "token",
    account: { id: "owner" },
    screen: "modes",
    activeTopicId: "first",
  };
  const events = [];
  const t = createUsageTracker({
    getState: () => state,
    isVisible: () => visible,
    now: () => at,
    emit: (e) => events.push(e),
  });
  t.sample();
  for (let i = 0; i < 75; i++) {
    at += 1000;
    t.sample();
    if ((i + 1) % 30 === 0) t.flush();
  }
  t.flush();
  assert.equal(
    events
      .filter((e) => e.kind === "time")
      .reduce((n, e) => n + e.foregroundMs, 0),
    75000,
  );
  assert.equal(
    events.filter((e) => e.kind === "time").reduce((n, e) => n + e.activeMs, 0),
    60000,
  );
  visible = false;
  at += 10000;
  t.pause();
  visible = true;
  t.resume();
  at += 1000;
  t.sample();
  state = { ...state, activeTopicId: "second" };
  t.sample();
  assert.equal(events.filter((e) => e.kind === "topic_open").length, 2);
  assert.equal(events.filter((e) => e.kind === "time").at(-1).topicId, "first");
  const count = events.length;
  at += 3600000;
  t.sample();
  t.flush();
  assert.equal(
    events.slice(count).find((e) => e.kind === "time").foregroundMs,
    5000,
  );
  state = { ...state, screen: "subscription" };
  t.sample();
  assert.equal(events.at(-1).topicId, null);
});

test("home feature tabs do not attribute planner time to the selected exercise topic", () => {
  let state = {
    token: "token",
    account: { id: "owner" },
    screen: "home",
    activeTopicId: "exercise",
    homeActiveTab: "planner",
  };
  const events = [];
  const t = createUsageTracker({
    getState: () => state,
    isVisible: () => true,
    emit: (e) => events.push(e),
  });
  t.sample();
  assert.equal(events.at(-1).screen, "planner");
  assert.equal(events.at(-1).topicId, null);
  assert.equal(events.filter((e) => e.kind === "topic_open").length, 0);
  state = { ...state, homeActiveTab: "session" };
  t.sample();
  assert.equal(events.at(-1).topicId, "exercise");
});
