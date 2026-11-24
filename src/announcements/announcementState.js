// What the dialog (AnnouncementHost) and «Что нового» (WhatsNewScreen) both need: who the user is, for the audience rules
// (announcementLogic.js), and which announcements they have read (seenStore.js: the device's marks plus the account's).
import { getDb } from "@/core/db";
import { useAppStore } from "@/core/store";
import { keepLocal, localSeen, remoteSeen } from "./seenStore.js";

export function announcementContext(db, uiLanguage) {
  const s = useAppStore.getState();
  return {
    db,
    account: s.account,
    accountCreatedAt: s.account?.createdAt ?? null,
    featureFlags: s.account?.featureFlags ?? [],
    ownedTopicIds: (s.ownedTopics ?? []).filter((o) => o.source !== "request").map((o) => o.topicId),
    installedTopicIds: (s.topicRecords ?? []).map((r) => r.meta?.id).filter(Boolean),
    uiLanguage,
  };
}

// read on this device, or on another one of the account (then kept here too, for offline)
export async function seenIds(list, db) {
  const database = db ?? (await getDb());
  let seen = await localSeen(database, list.map((a) => a.id));
  if (useAppStore.getState().account) {
    const remote = await remoteSeen();
    if (remote) {
      const fresh = remote.filter((id) => !seen.includes(id));
      if (fresh.length) await keepLocal(database, fresh);
      seen = [...seen, ...fresh];
    }
  }
  return seen;
}
