import { useState } from "react";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { PLAN_DAYPARTS, planItemKey, toggleKey } from "./weekPlan.js";

// «Мой день» and «Что меняется?» (see below).

const LABEL_NOW = "Сейчас";
const LABEL_CANCELLED = "Не будет";

function longestWord(text) {
  return Math.max(4, ...String(text ?? "").split(/\s+/).map((word) => word.length));
}

function PlanPicture({ item, className }) {
  if (item.photo) return <AuthenticatedImage className={`${className} ${className}--photo`} src={item.photo} alt="" draggable="false" />;
  if (item.icon) return <span className={className} aria-hidden="true">{item.icon}</span>;
  return null;
}

// «Мой день» (owner, 2026-11-24): the day as утро / день / вечер / ночь, each
// with its pictogram and the day's events of that part. The current part is
// framed «СЕЙЧАС» with its events large -- the answer to «что сейчас?» -- the
// parts gone by paler, the rest as they are: the screen follows the clock, no
// one has to tap anything. A cancelled event stays crossed out «НЕ БУДЕТ».
// Вчера/Завтра: no part is «now».
export function MyDayCard({ items, daypartId, today, caseText, cardProps, onEdit, partLabel }) {
  const nowIndex = today ? PLAN_DAYPARTS.indexOf(daypartId) : -1;
  return (
    <article className="daily-orientation__card daily-orientation__card--myday" {...cardProps}>
      {onEdit && (
        <button
          type="button"
          className="daily-orientation__plan-edit"
          aria-label="Что меняется в плане"
          onClick={(event) => { event.stopPropagation(); onEdit(); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
        </button>
      )}
      <ol className="daily-orientation__myday">
        {PLAN_DAYPARTS.map((part, index) => {
          const partItems = items.filter((item) => item.daypart === part);
          const state = nowIndex < 0 ? "" : index < nowIndex ? " daily-orientation__myday-part--past" : index === nowIndex ? " daily-orientation__myday-part--now" : "";
          return (
            <li key={part} className={`daily-orientation__myday-part daily-orientation__myday-part--${part}${state}`} aria-current={index === nowIndex ? "time" : undefined}>
              {index === nowIndex && <span className="daily-orientation__myday-now">{caseText(LABEL_NOW)}</span>}
              <span className="daily-orientation__myday-head">
                <img className="daily-orientation__myday-picture" src={`/daily-orientation/daypart_${part}.webp`} alt="" draggable="false" />
                <span className="daily-orientation__myday-word">{caseText(partLabel(part))}</span>
              </span>
              <span className="daily-orientation__myday-items">
                {partItems.map((item) => (
                  <span
                    key={item.key}
                    className={[
                      "daily-orientation__myday-item",
                      item.important ? "daily-orientation__myday-item--important" : "",
                      item.cancelled ? "daily-orientation__myday-item--cancelled" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <PlanPicture item={item} className="daily-orientation__myday-item-picture" />
                    <span className="daily-orientation__myday-item-word" style={{ "--chars": longestWord(item.text) }}>{caseText(item.text)}</span>
                    {item.cancelled && <span className="daily-orientation__plan-cancelled">{caseText(LABEL_CANCELLED)}</span>}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

// «Что меняется?»: one tap switches an event off (or back on) for that date
// only -- the weekly plan stays as it is. Events added only for that date can
// be added from the week's own events and removed again.
export function PlanChangesContent({ days, ownItems, caseText }) {
  const [tab, setTab] = useState(0);
  const day = days[tab];
  const usedKeys = new Set(day.items.map((item) => item.key));
  const addable = ownItems.filter((item) => !usedKeys.has(planItemKey(item)));
  return (
    <div className="daily-orientation__plan-changes">
      <h2 className="daily-orientation__plan-changes-title">Что меняется?</h2>
      <p className="daily-orientation__plan-changes-lead">Касание выключает дело только на этот день. Недельный план не меняется.</p>
      <div className="daily-orientation__plan-changes-tabs" role="tablist">
        {days.map((entry, index) => (
          <button key={entry.label} type="button" role="tab" aria-selected={index === tab} className={index === tab ? "is-on" : ""} onClick={() => setTab(index)}>
            {entry.label}
          </button>
        ))}
      </div>
      <div className="daily-orientation__plan-changes-items">
        {day.items.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.cancelled}
            className={`daily-orientation__plan-change${item.cancelled ? " is-off" : ""}`}
            onClick={() => day.update((changes) => ({ ...changes, off: toggleKey(changes.off, item.key) }))}
          >
            {item.cancelled && <span className="daily-orientation__plan-change-mark">{caseText(LABEL_CANCELLED)}</span>}
            <PlanPicture item={item} className="daily-orientation__plan-change-picture" />
            <span>{item.text}</span>
          </button>
        ))}
      </div>
      {addable.length > 0 && (
        <>
          <p className="daily-orientation__plan-changes-sub">Добавить на этот день</p>
          <div className="daily-orientation__plan-changes-add">
            {addable.map((item) => (
              <button
                key={planItemKey(item)}
                type="button"
                onClick={() => day.update((changes) => ({
                  ...changes,
                  off: (changes.off ?? []).filter((key) => key !== planItemKey(item)),
                  added: [...(changes.added ?? []).filter((other) => planItemKey(other) !== planItemKey(item)), { icon: item.icon, text: item.text }],
                }))}
              >
                {item.icon && <span aria-hidden="true">{item.icon}</span>} {item.text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
