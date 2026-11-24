import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { pickUiText } from "../../../shared/ui-languages.mjs";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { ANNOUNCEMENTS } from "@/announcements/announcements.js";
import { pickAnnouncement } from "@/announcements/announcementLogic.js";
import { keepLocal, localSeen, markSeen, remoteSeen } from "@/announcements/seenStore.js";

// One-time announcements (docs/announcements.md): on the home screen, the first due one of src/announcements/announcements.js
// that this account has not read; «Понятно» marks it read on the device and in the account. No ×, no tap outside: closing
// it any other way would leave it unread for the next visit. Never during a lesson (only on `home`).
export default function AnnouncementHost({ list = ANNOUNCEMENTS }) {
  const { t, language } = useUiTranslation();
  const screen = useAppStore((s) => s.screen);
  const account = useAppStore((s) => s.account);
  const [shown, setShown] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (screen !== "home" || shown || !list.length) return undefined;
    let alive = true;
    (async () => {
      const db = await getDb();
      const ids = list.map((a) => a.id);
      let seen = await localSeen(db, ids);
      if (account) {
        const remote = await remoteSeen();
        if (remote) {
          const fresh = remote.filter((id) => !seen.includes(id));
          if (fresh.length) await keepLocal(db, fresh);
          seen = [...seen, ...fresh];
        }
      }
      const s = useAppStore.getState();
      const ctx = {
        db,
        account: s.account,
        accountCreatedAt: s.account?.createdAt ?? null,
        ownedTopicIds: (s.ownedTopics ?? []).filter((o) => o.source !== "request").map((o) => o.topicId),
        installedTopicIds: (s.topicRecords ?? []).map((r) => r.meta?.id).filter(Boolean),
        uiLanguage: language,
      };
      const next = await pickAnnouncement(list, seen, ctx);
      if (alive && next && useAppStore.getState().screen === "home") setShown(next);
    })().catch(() => {});
    return () => { alive = false; };
  }, [screen, shown, account, list, language]);

  if (!shown || screen !== "home") return null;
  const paragraphs = pickUiText(shown.body, language);
  async function ok() {
    if (busy) return;
    setBusy(true);
    // marked first, closed after: the next check (the effect runs again on close) must already see it read
    await markSeen(await getDb(), shown.id, { signedIn: Boolean(useAppStore.getState().account) });
    setShown(null);
    setBusy(false);
  }
  return (
    <Modal title={pickUiText(shown.title, language)} closeOnOverlay={false} showCloseButton={false}
      actions={<Button disabled={busy} onClick={ok}>{t("announcement.ok")}</Button>}>
      <div className="announcement-body" data-testid="announcement" data-announcement-id={shown.id}>
        {(Array.isArray(paragraphs) ? paragraphs : [paragraphs]).map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </Modal>
  );
}
