import { useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { localeFor } from "@/shared/i18n/uiLanguage.js";
import { pickUiText } from "../../../shared/ui-languages.mjs";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { ANNOUNCEMENTS } from "@/announcements/announcements.js";
import { archiveAnnouncements } from "@/announcements/announcementLogic.js";
import { announcementContext, seenIds } from "@/announcements/announcementState.js";
import { markSeen } from "@/announcements/seenStore.js";
import "./whatsNew.css";

// «Что нового» (menu → Приложение, docs/announcements.md): every announcement meant for this account in the last year, newest
// first, the unread ones marked «Новое». Opening the screen reads them all: the one-time dialog will not show them again.
export default function WhatsNewScreen({ list = ANNOUNCEMENTS }) {
  const { t, language } = useUiTranslation();
  const setScreen = useAppStore((s) => s.setScreen);
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const db = await getDb();
      const seen = new Set(await seenIds(list, db));
      const shown = await archiveAnnouncements(list, announcementContext(db, language));
      if (!alive) return;
      setItems(shown.map((a) => ({ a, unread: !seen.has(a.id) })));
      const signedIn = Boolean(useAppStore.getState().account);
      for (const a of shown) if (!seen.has(a.id)) await markSeen(db, a.id, { signedIn });
    })().catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [list, language]);

  const dateOf = (s) => new Intl.DateTimeFormat(localeFor(language), { day: "numeric", month: "long", year: "numeric" }).format(new Date(s));
  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")} aria-label={t("common.back")}><BackArrowIcon /></button>
        <h1 className="screen-title">{t("nav.whatsNew")}</h1>
      </div>
      <div className="settings-body" data-testid="whats-new">
        {items && !items.length && <p className="whats-new-empty">{t("whatsNew.empty")}</p>}
        {items?.map(({ a, unread }) => {
          const body = pickUiText(a.body, language);
          return (
            <article key={a.id} className="settings-section whats-new-item" data-testid="whats-new-item" data-announcement-id={a.id}>
              <div className="whats-new-meta">
                <time dateTime={a.date}>{dateOf(a.date)}</time>
                {unread && <span className="whats-new-badge">{t("whatsNew.new")}</span>}
              </div>
              <h2 className="whats-new-title">{pickUiText(a.title, language)}</h2>
              {(Array.isArray(body) ? body : [body]).map((p, i) => <p key={i}>{p}</p>)}
            </article>
          );
        })}
      </div>
    </div>
  );
}
