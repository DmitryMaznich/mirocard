import { useCallback, useEffect, useRef, useState } from "react";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { planFocusIndex, planItemKey, toggleKey } from "./weekPlan.js";

// «План на день» (owner, 2026-11-23): the day's big events left to right,
// the first one not yet done in a frame, the next one under «ПОТОМ». No times:
// the screen hangs at home and can't know what is happening at school, only
// the order of the day. The child marks the framed event «сделали» with a tap;
// it then shrinks to the left with a tick (a tap on it undoes it) and the frame
// moves on. A cancelled event stays in its place crossed out «НЕ БУДЕТ».

const SCROLL_HOME_MS = 60_000;
const CAPTION_PLAN = "План на день";
const LABEL_NEXT = "Потом";
const LABEL_CANCELLED = "Не будет";

function longestWord(text) {
  return Math.max(4, ...String(text ?? "").split(/\s+/).map((word) => word.length));
}

function PlanPicture({ item, className }) {
  if (item.photo) return <AuthenticatedImage className={`${className} ${className}--photo`} src={item.photo} alt="" draggable="false" />;
  if (item.icon) return <span className={className} aria-hidden="true">{item.icon}</span>;
  return null;
}

export function PlanCard({ items, today, caseText, cardProps, onDone, onUndo, onEdit }) {
  const stripRef = useRef(null);
  const homeTimer = useRef(null);
  const focus = today ? planFocusIndex(items) : items.findIndex((item) => !item.cancelled);
  // Today: what's done before the frame leaves, except the last done thing,
  // which stays small with a tick (and is where an accidental tap is undone).
  const lastDone = today ? items.reduce((found, item, index) => (item.done && (focus === -1 || index < focus) ? index : found), -1) : -1;
  const shown = items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => !today || !item.done || index === lastDone);
  const nextIndex = focus === -1 ? -1 : items.findIndex((item, index) => index > focus && !item.cancelled && !(today && item.done));

  // A strip scrolled by a curious child goes back to its start after a minute,
  // so the next person passing by sees the day's next thing first.
  const scheduleHome = useCallback(() => {
    window.clearTimeout(homeTimer.current);
    homeTimer.current = window.setTimeout(() => {
      if (stripRef.current) stripRef.current.scrollLeft = 0;
    }, SCROLL_HOME_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(homeTimer.current), []);
  useEffect(() => {
    if (stripRef.current) stripRef.current.scrollLeft = 0;
  }, [focus]);

  return (
    <article className="daily-orientation__card daily-orientation__card--plan daily-orientation__card--speakable" {...cardProps}>
      <p className="daily-orientation__question">{CAPTION_PLAN}</p>
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
      <ol className="daily-orientation__plan-strip" ref={stripRef} onScroll={scheduleHome}>
        {shown.map(({ item, index }) => {
          const role = item.cancelled ? "cancelled" : today && item.done ? "done" : index === focus ? "focus" : index === nextIndex ? "next" : "later";
          const tappable = today && (role === "focus" || role === "done");
          const Tag = tappable ? "button" : "div";
          return (
            <li key={`${index}-${item.key}`} className="daily-orientation__plan-slot">
              <Tag
                {...(tappable ? {
                  type: "button",
                  onClick: (event) => { event.stopPropagation(); if (role === "focus") onDone(item.key); else onUndo(item.key); },
                  "aria-label": role === "focus" ? `${item.text}: сделали` : `${item.text}: вернуть`,
                } : {})}
                className={[
                  "daily-orientation__plan-item",
                  `daily-orientation__plan-item--${role}`,
                  item.important ? "daily-orientation__plan-item--important" : "",
                ].filter(Boolean).join(" ")}
              >
                {role === "next" && <span className="daily-orientation__plan-tag">{caseText(LABEL_NEXT)}</span>}
                <PlanPicture item={item} className="daily-orientation__plan-picture" />
                <span className="daily-orientation__plan-word" style={{ "--chars": longestWord(item.text) }}>{caseText(item.text)}</span>
                {role === "cancelled" && <span className="daily-orientation__plan-cancelled">{caseText(LABEL_CANCELLED)}</span>}
              </Tag>
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
