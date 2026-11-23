import { useState } from "react";
import { accountKv } from "@/topics/accountKv";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { cardPhoto, eventsOnDate, isBirthdayType, visibleImportantDates } from "@/features/importantDates/importantDates";
import { addCalendarDays, getLocalDateKey } from "@/topics/renderers/daily_orientation/timeUtils";
import {
  PLAN_WEEK_ORDER,
  buildDayPlan,
  collectPlanItems,
  parsePlanPhotos,
  parseWeekItems,
  planItemKey,
  toggleKey,
} from "@/topics/renderers/daily_orientation/weekPlan.js";
import { useSharedPlanChanges } from "@/topics/renderers/daily_orientation/planChanges.js";

// «Изменения на сегодня и завтра» (owner, 2026-11-23): the same switch as the
// wall screen's pencil, from a phone -- the «Сегодня» screen itself wants a
// landscape tablet. A tap switches an event off for that date only (the wall
// shows it crossed out «НЕ БУДЕТ» within a minute), or adds one of the week's
// own events for that date. Shared through the account (planChanges.js).

function ItemPicture({ item }) {
  if (item.photo) return <AuthenticatedImage className="dos-plan__chip-photo" src={item.photo} alt="" />;
  return item.icon ? <span className="dos-plan__chip-icon" aria-hidden="true">{item.icon}</span> : null;
}

export default function PlanTodayEditor({ params, student, kv = accountKv }) {
  const { t } = useUiTranslation();
  const [tab, setTab] = useState(0);
  const now = new Date();
  const { changesFor, updateChanges } = useSharedPlanChanges({
    accountKv: kv,
    studentId: student?.id,
    oldestKey: getLocalDateKey(addCalendarDays(now, -1)),
  });
  if (!student?.id) return null;

  const weekItems = parseWeekItems(params.weeklyPlan);
  const photos = parsePlanPhotos(params.planPhotos);
  const importantDates = params.importantDatesStyle === "off" ? [] : visibleImportantDates(student.importantDates);
  const ownItems = collectPlanItems(weekItems, PLAN_WEEK_ORDER);
  const date = addCalendarDays(now, tab);
  const dateKey = getLocalDateKey(date);
  const items = buildDayPlan({
    templateItems: weekItems[date.getDay()],
    events: eventsOnDate(importantDates, date).map((item) => ({
      id: item.id,
      title: item.title,
      icon: isBirthdayType(item) ? "🎂" : item.icon,
      photo: cardPhoto(item, student.myPeople) ?? (item.type === "own_birthday" ? student.photo ?? null : null),
    })),
    changes: changesFor(dateKey),
    photos,
  });
  const used = new Set(items.map((item) => item.key));
  const addable = ownItems.filter((item) => !used.has(planItemKey(item)));
  const update = (fn) => updateChanges(dateKey, fn);

  return (
    <section className="dos-section" aria-labelledby="dos-today-title">
      <header className="dos-section__head">
        <h2 className="dos-section__title" id="dos-today-title">{t("dailyToday.title")}</h2>
        <p className="dos-section__hint">{t("dailyToday.hint")}</p>
      </header>
      <div className="dos-card dos-plan dos-today">
        <div className="dos-today__tabs" role="tablist">
          {[t("dailyToday.today"), t("dailyToday.tomorrow")].map((label, index) => (
            <button key={label} type="button" role="tab" aria-selected={index === tab} className={index === tab ? "is-on" : ""} onClick={() => setTab(index)}>
              {label}
            </button>
          ))}
        </div>
        {items.length === 0 && <p className="dos-today__empty">{t("dailyToday.empty")}</p>}
        <div className="dos-plan__chips">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={item.cancelled}
              aria-label={t("dailyToday.toggle", { text: item.text, state: item.cancelled ? t("dailyToday.cancelled").toLowerCase() : t("dailyToday.on") })}
              className={`dos-plan__chip dos-today__item${item.cancelled ? " dos-today__item--off" : ""}`}
              onClick={() => update((changes) => ({ ...changes, off: toggleKey(changes.off, item.key) }))}
            >
              <ItemPicture item={item} />
              <span className="dos-today__text">{item.text}</span>
              {item.cancelled && <span className="dos-today__mark">{t("dailyToday.cancelled")}</span>}
            </button>
          ))}
        </div>
        {addable.length > 0 && (
          <div className="dos-plan__group">
            <p className="dos-plan__label">{t("dailyToday.add")}</p>
            <div className="dos-plan__chips">
              {addable.map((item) => (
                <button
                  key={planItemKey(item)}
                  type="button"
                  className="dos-plan__chip dos-plan__chip--own"
                  onClick={() => update((changes) => ({
                    ...changes,
                    off: (changes.off ?? []).filter((key) => key !== planItemKey(item)),
                    added: [...(changes.added ?? []).filter((other) => planItemKey(other) !== planItemKey(item)), { icon: item.icon, text: item.text }],
                  }))}
                >
                  <ItemPicture item={{ ...item, photo: photos[planItemKey(item)] }} />
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
