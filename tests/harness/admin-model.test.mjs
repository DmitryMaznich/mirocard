import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountsCsv,
  filterAccounts,
  sortAccounts,
  topicAccess,
} from "../../public/admin-model.js";
const now = Date.parse("2026-10-07T12:00:00Z");
const accounts = [
  {
    id: "1",
    firstName: "Анна",
    email: "anna@example.test",
    status: "active",
    lastSeenAt: "2026-10-07T11:59:00Z",
    sessions7d: 3,
    activeSessions: [{ device: "Phone" }],
    subscription: { plan: "monthly" },
  },
  {
    id: "2",
    displayName: "Борис",
    email: "boris@example.test",
    status: "pending",
    lastSeenAt: null,
    sessions7d: 0,
  },
  {
    id: "3",
    displayName: "Вера",
    email: "vera@example.test",
    status: "deleted",
    lastSeenAt: "2026-09-01T12:00:00Z",
    sessions7d: 0,
  },
];
test("admin filters combine identity, status, activity and subscription", () => {
  assert.deepEqual(
    filterAccounts(
      accounts,
      {
        query: " АННА ",
        status: "active",
        activity: "online",
        access: "active",
      },
      now,
    ).map((a) => a.id),
    ["1"],
  );
  assert.deepEqual(
    filterAccounts(accounts, { activity: "never", access: "none" }, now).map(
      (a) => a.id,
    ),
    ["2"],
  );
  assert.deepEqual(
    filterAccounts(accounts, { activity: "week" }, now).map((a) => a.id),
    ["1"],
  );
  assert.deepEqual(
    filterAccounts(accounts, { query: "3" }, now).map((a) => a.id),
    ["3"],
  );
});
test("sorting puts missing visit dates last in both directions and leaves input intact", () => {
  assert.deepEqual(
    sortAccounts(accounts, "lastSeenAt", "desc").map((a) => a.id),
    ["1", "3", "2"],
  );
  assert.deepEqual(
    sortAccounts(accounts, "lastSeenAt", "asc").map((a) => a.id),
    ["3", "1", "2"],
  );
  assert.deepEqual(
    accounts.map((a) => a.id),
    ["1", "2", "3"],
  );
});
test("assigned topics are deduplicated and download/request rows do not imply access", () => {
  const result = topicAccess({
    ownedTopics: [
      { topicId: "a", source: "grant" },
      { topicId: "b", source: "download" },
      { topicId: "c", source: "paid" },
      { topicId: "d", source: "request" },
    ],
    topicAssignments: [{ topicId: "a", assignedAs: "beta" }],
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].assignment, true);
  assert.equal(result[1].source, "paid");
});
test("CSV keeps Cyrillic, quotes and line breaks, and neutralizes formulas", () => {
  const result = accountsCsv([
    {
      id: "1",
      displayName: '=HYPERLINK("bad")',
      email: 'a;"b\nc',
      status: "active",
    },
  ]);
  assert.ok(result.startsWith("\uFEFF"));
  assert.ok(result.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(result.includes('"a;""b\nc"'));
});
