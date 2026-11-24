// Announcements (docs/announcements.md): a one-time message the developer shows to users, e.g. «Прописи обновились».
// Pure rules here — which announcement is due for this account now; the list itself is announcements.js, the
// «already read» marks are seenStore.js, the dialog is src/features/announcements/AnnouncementHost.jsx.

// An announcement is due when: it is published (`from` ≤ now), not over (`until` > now), not read yet on this
// account (or this device, signed out), and its audience matches. The first due one in the list's order is shown.
export function isActive(a, now = Date.now()) {
  if (a.from && now < Date.parse(a.from)) return false;
  if (a.until && now >= Date.parse(a.until)) return false;
  return true;
}

// `topics`: only for an account that has one of these topics (owned or installed on the device);
// `accountsCreatedBefore`: only for accounts made before that day — news of a change means nothing to someone
// who never saw the old way (signed out, there is no account: the rule is skipped);
// `languages`: only for these interface languages; `match(ctx)`: any other rule, may be async.
export async function matchesAudience(a, ctx) {
  if (Array.isArray(a.topics) && a.topics.length) {
    const has = new Set([...(ctx.ownedTopicIds ?? []), ...(ctx.installedTopicIds ?? [])]);
    if (!a.topics.some((id) => has.has(id))) return false;
  }
  if (a.accountsCreatedBefore && ctx.accountCreatedAt) {
    const created = typeof ctx.accountCreatedAt === "number" ? ctx.accountCreatedAt : Date.parse(ctx.accountCreatedAt);
    if (Number.isFinite(created) && created >= Date.parse(a.accountsCreatedBefore)) return false;
  }
  if (Array.isArray(a.languages) && a.languages.length && !a.languages.includes(ctx.uiLanguage)) return false;
  if (typeof a.match === "function") {
    try { if (!(await a.match(ctx))) return false; } catch { return false; }
  }
  return true;
}

export async function pickAnnouncement(list, seenIds, ctx, now = Date.now()) {
  const seen = new Set(seenIds);
  for (const a of list) {
    if (!a?.id || seen.has(a.id) || !isActive(a, now)) continue;
    if (await matchesAudience(a, ctx)) return a;
  }
  return null;
}

// a list mistake caught by the test (announcements.test.js), not at runtime: ids unique and stable, a title and a text
// in Russian (the fallback chain's last language), dates that parse
export function validateAnnouncements(list) {
  const errors = [];
  const ids = new Set();
  for (const a of list) {
    if (!a?.id || !/^[a-z0-9][a-z0-9-]*$/.test(a.id)) errors.push(`bad id: ${a?.id}`);
    if (ids.has(a.id)) errors.push(`duplicate id: ${a.id}`);
    ids.add(a.id);
    if (!a.title?.ru) errors.push(`${a.id}: no title.ru`);
    if (!a.body?.ru?.length) errors.push(`${a.id}: no body.ru`);
    for (const k of ["from", "until", "accountsCreatedBefore"]) if (a[k] && !Number.isFinite(Date.parse(a[k]))) errors.push(`${a.id}: bad ${k}`);
  }
  return errors;
}
