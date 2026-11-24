import { describe, it, expect } from "vitest";
import { ANNOUNCEMENTS } from "./announcements.js";
import { archiveAnnouncements, isActive, matchesAudience, pickAnnouncement, validateAnnouncements } from "./announcementLogic.js";

const day = (s) => Date.parse(s);

describe("announcements: the list", () => {
  it("is valid: unique stable ids, a Russian title and text, dates that parse", () => {
    expect(validateAnnouncements(ANNOUNCEMENTS)).toEqual([]);
  });
  it("every entry ends some day (`until`): old news must not greet a user months later", () => {
    for (const a of ANNOUNCEMENTS) expect(a.until, a.id).toBeTruthy();
  });
  it("catches a duplicate id and a missing Russian text", () => {
    expect(validateAnnouncements([{ id: "a", date: "2026-11-24", title: { ru: "x" }, body: { ru: ["y"] } }, { id: "a", title: {}, body: {} }])).toEqual(["duplicate id: a", "a: no title.ru", "a: no body.ru", "a: no date"]);
  });
});

describe("announcements: who sees what", () => {
  const base = { id: "x", date: "2026-11-24", title: { ru: "t" }, body: { ru: ["b"] } };

  it("from / until", () => {
    const a = { ...base, from: "2026-11-24", until: "2027-01-31" };
    expect(isActive(a, day("2026-11-23"))).toBe(false);
    expect(isActive(a, day("2026-11-24"))).toBe(true);
    expect(isActive(a, day("2027-01-31"))).toBe(false);
  });

  it("topics: owned or installed", async () => {
    const a = { ...base, topics: ["propis2"] };
    expect(await matchesAudience(a, { ownedTopicIds: ["math"] })).toBe(false);
    expect(await matchesAudience(a, { ownedTopicIds: ["propis2"] })).toBe(true);
    expect(await matchesAudience(a, { installedTopicIds: ["propis2"] })).toBe(true);
  });

  it("accountsCreatedBefore: an account made after the change does not get news of it; signed out the rule is skipped", async () => {
    const a = { ...base, accountsCreatedBefore: "2026-11-24" };
    expect(await matchesAudience(a, { accountCreatedAt: "2026-10-01T10:00:00Z" })).toBe(true);
    expect(await matchesAudience(a, { accountCreatedAt: "2026-11-24T10:00:00Z" })).toBe(false);
    expect(await matchesAudience(a, { accountCreatedAt: day("2026-12-01") })).toBe(false);
    expect(await matchesAudience(a, { accountCreatedAt: null })).toBe(true);
  });

  it("languages and match(ctx); a throwing match hides the announcement", async () => {
    expect(await matchesAudience({ ...base, languages: ["ru"] }, { uiLanguage: "sl" })).toBe(false);
    expect(await matchesAudience({ ...base, match: async (ctx) => ctx.flag }, { flag: true })).toBe(true);
    expect(await matchesAudience({ ...base, match: () => { throw new Error("x"); } }, {})).toBe(false);
  });

  it("flags: only accounts with one of the feature flags (try it on your own account first)", async () => {
    const a = { ...base, flags: ["announcements_preview"] };
    expect(await matchesAudience(a, { featureFlags: [] })).toBe(false);
    expect(await matchesAudience(a, {})).toBe(false);
    expect(await matchesAudience(a, { featureFlags: ["announcements_preview"] })).toBe(true);
  });

  it("«Что нового»: published, not older than a year, the audience's, newest first; `until` does not hide it", async () => {
    const list = [
      { ...base, id: "old", date: "2025-10-01" },
      { ...base, id: "mid", date: "2026-11-01", until: "2026-11-10" },
      { ...base, id: "new", date: "2026-11-20" },
      { ...base, id: "later", date: "2026-11-20", from: "2026-12-01" },
      { ...base, id: "theirs", date: "2026-11-21", topics: ["none"] },
    ];
    expect((await archiveAnnouncements(list, {}, day("2026-11-24"))).map((a) => a.id)).toEqual(["new", "mid"]);
  });

  it("the first due, unread one in the list's order", async () => {
    const list = [{ ...base, id: "a" }, { ...base, id: "b" }, { ...base, id: "c", topics: ["none"] }];
    expect((await pickAnnouncement(list, [], {}))?.id).toBe("a");
    expect((await pickAnnouncement(list, ["a"], {}))?.id).toBe("b");
    expect(await pickAnnouncement(list, ["a", "b"], {})).toBeNull();
  });

  it("«Прописи» 0.8.0: to the old users of propis2 only", async () => {
    const a = ANNOUNCEMENTS.find((x) => x.id === "propis2-0-8-0");
    const now = day("2026-11-25");
    expect(isActive(a, now)).toBe(true);
    const flags = []; // (deploy 1 kept it behind `announcements_preview`; out for everyone with the deck, deploy 2)
    expect(await matchesAudience(a, { featureFlags: flags, ownedTopicIds: ["propis2"], accountCreatedAt: "2026-09-01T00:00:00Z" })).toBe(true);
    expect(await matchesAudience(a, { featureFlags: flags, ownedTopicIds: ["math"], accountCreatedAt: "2026-09-01T00:00:00Z" })).toBe(false);
    expect(await matchesAudience(a, { featureFlags: flags, ownedTopicIds: ["propis2"], accountCreatedAt: "2026-11-25T00:00:00Z" })).toBe(false);
  });
});
