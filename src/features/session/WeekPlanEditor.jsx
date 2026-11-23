import { useState } from "react";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import {
  FREQUENT_EMOJI,
  PLAN_WEEK_ORDER,
  collectPlanItems,
  firstEmoji,
  moveItem,
  parseWeekItems,
  planItemKey,
  serializeWeekItems,
  setItemIconEverywhere,
  suggestEmoji,
} from "@/topics/renderers/daily_orientation/weekPlan.js";

// The weekly plan as rows of the day's big events (owner, 2026-11-23): what
// the wall screen's «План на день» shows. Tap «+» to add an event (one of the
// adult's own, or a new one with a picture they pick), tap an event to move it,
// change its picture (in every day at once) or remove it. An empty day can be
// filled «Как в …» from the nearest filled day before it.

const WEEKEND = new Set([6, 0]);

function PicturePicker({ word, value, onChange }) {
  const { t } = useUiTranslation();
  const [showAll, setShowAll] = useState(false);
  const suggested = suggestEmoji(word);
  const choice = (emoji) => (
    <button
      key={emoji}
      type="button"
      className={`dos-plan__emoji${emoji === value ? " dos-plan__emoji--on" : ""}`}
      aria-pressed={emoji === value}
      onClick={() => onChange(emoji === value ? null : emoji)}
    >
      {emoji}
    </button>
  );
  return (
    <div className="dos-plan__picker">
      {suggested.length > 0 && (
        <div className="dos-plan__emoji-row" role="group" aria-label={t("dailyPlan.suggested")}>
          {suggested.map(choice)}
        </div>
      )}
      <div className="dos-plan__picker-actions">
        <button type="button" className="dos-plan__link" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {t("dailyPlan.morePictures")}
        </button>
        <button
          type="button"
          className={`dos-plan__link${value ? "" : " dos-plan__link--on"}`}
          aria-pressed={!value}
          onClick={() => onChange(null)}
        >
          {t("dailyPlan.noPicture")}
        </button>
      </div>
      {showAll && (
        <>
          <div className="dos-plan__emoji-grid" role="group" aria-label={t("dailyPlan.morePictures")}>
            {FREQUENT_EMOJI.map(choice)}
          </div>
          <input
            className="dos-plan__any"
            type="text"
            inputMode="text"
            aria-label={t("dailyPlan.anyEmoji")}
            placeholder={t("dailyPlan.anyEmoji")}
            value=""
            onChange={(event) => {
              const emoji = firstEmoji(event.target.value);
              if (emoji) onChange(emoji);
            }}
          />
        </>
      )}
    </div>
  );
}

function AddPanel({ dayItems, ownItems, onAdd, onClose }) {
  const { t } = useUiTranslation();
  const [text, setText] = useState("");
  const [icon, setIcon] = useState(null);
  const [iconTouched, setIconTouched] = useState(false);
  const used = new Set(dayItems.map(planItemKey));
  const available = ownItems.filter((item) => !used.has(planItemKey(item)));
  // Until the adult picks, the first suggestion for the word is pre-selected:
  // most words then need no extra tap.
  const shownIcon = iconTouched ? icon : suggestEmoji(text)[0] ?? null;
  const known = ownItems.find((item) => planItemKey(item) === planItemKey({ text }));

  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(known ? { ...known } : { icon: shownIcon, text: text.trim() });
    setText("");
    setIcon(null);
    setIconTouched(false);
  }

  return (
    <div className="dos-plan__panel">
      {available.length > 0 && (
        <div className="dos-plan__group">
          <p className="dos-plan__label">{t("dailyPlan.yours")}</p>
          <div className="dos-plan__chips">
            {available.map((item) => (
              <button key={planItemKey(item)} type="button" className="dos-plan__chip dos-plan__chip--own" onClick={() => onAdd({ ...item })}>
                {item.icon && <span className="dos-plan__chip-icon" aria-hidden="true">{item.icon}</span>}
                {item.text}
              </button>
            ))}
          </div>
        </div>
      )}
      <form className="dos-plan__group" onSubmit={submit}>
        <label className="dos-plan__label" htmlFor="dos-plan-new">{t("dailyPlan.newItem")}</label>
        <div className="dos-plan__new">
          <span className="dos-plan__preview" aria-hidden="true">{(known?.icon ?? shownIcon) || "·"}</span>
          <input
            id="dos-plan-new"
            className="dos-plan__input"
            type="text"
            value={text}
            maxLength={30}
            placeholder={t("dailyPlan.newPlaceholder")}
            onChange={(event) => setText(event.target.value.replaceAll(",", " "))}
          />
          <button type="submit" className="dos-plan__add-btn" disabled={!text.trim()}>{t("dailyPlan.addButton")}</button>
        </div>
        {text.trim() && !known && (
          <PicturePicker word={text} value={shownIcon} onChange={(next) => { setIcon(next); setIconTouched(true); }} />
        )}
      </form>
      <button type="button" className="dos-plan__done" onClick={onClose}>{t("dailyPlan.done")}</button>
    </div>
  );
}

export default function WeekPlanEditor({ weeklyPlan, onChange }) {
  const { t } = useUiTranslation();
  const week = parseWeekItems(weeklyPlan ?? "");
  const ownItems = collectPlanItems(week, PLAN_WEEK_ORDER);
  // { day, index } of the tapped event, the day whose «+» panel is open, the
  // item whose picture is being changed (by key).
  const [selected, setSelected] = useState(null);
  const [addingDay, setAddingDay] = useState(null);
  const [pictureKey, setPictureKey] = useState(null);

  function save(next) {
    onChange(serializeWeekItems(next));
  }
  function setDay(day, items) {
    save({ ...week, [day]: items });
  }

  function copySource(day) {
    const start = PLAN_WEEK_ORDER.indexOf(day);
    for (let step = 1; step < PLAN_WEEK_ORDER.length; step++) {
      const other = PLAN_WEEK_ORDER[(start - step + PLAN_WEEK_ORDER.length) % PLAN_WEEK_ORDER.length];
      if (week[other].length) return other;
    }
    return null;
  }

  return (
    <section className="dos-section" aria-labelledby="dos-week-title">
      <header className="dos-section__head">
        <h2 className="dos-section__title" id="dos-week-title">{t("dailyPlan.title")}</h2>
        <p className="dos-section__hint">{t("dailyPlan.hint")}</p>
      </header>

      <div className="dos-card dos-plan">
        {PLAN_WEEK_ORDER.map((day) => {
          const items = week[day];
          const source = items.length ? null : copySource(day);
          const sel = selected?.day === day ? selected.index : null;
          const selItem = sel !== null ? items[sel] : null;
          return (
            <div key={day} className={`dos-plan__day${WEEKEND.has(day) ? " dos-plan__day--weekend" : ""}`}>
              <div className="dos-plan__head">
                <span className="dos-plan__name">{t(`dailyPlan.day.${day}`)}</span>
                {source !== null && (
                  <button type="button" className="dos-plan__copy" onClick={() => setDay(day, week[source].map((item) => ({ ...item })))}>
                    {t("dailyPlan.copyFrom", { day: t(`dailyPlan.dayAcc.${source}`) })}
                  </button>
                )}
              </div>
              <ol className="dos-plan__items">
                {items.map((item, index) => (
                  <li key={`${index}-${planItemKey(item)}`} className="dos-plan__slot">
                    <button
                      type="button"
                      className={`dos-plan__chip${sel === index ? " dos-plan__chip--on" : ""}`}
                      aria-pressed={sel === index}
                      aria-label={t("dailyPlan.edit", { text: item.text || item.icon })}
                      onClick={() => {
                        setAddingDay(null);
                        setPictureKey(null);
                        setSelected(sel === index ? null : { day, index });
                      }}
                    >
                      {item.icon && <span className="dos-plan__chip-icon" aria-hidden="true">{item.icon}</span>}
                      {item.text}
                    </button>
                  </li>
                ))}
                <li className="dos-plan__slot dos-plan__slot--plus">
                  <button
                    type="button"
                    className={`dos-plan__plus${addingDay === day ? " dos-plan__plus--on" : ""}`}
                    aria-label={t("dailyPlan.addTo", { day: t(`dailyPlan.day.${day}`) })}
                    aria-expanded={addingDay === day}
                    onClick={() => { setSelected(null); setPictureKey(null); setAddingDay(addingDay === day ? null : day); }}
                  >
                    +
                  </button>
                </li>
              </ol>
              {selItem && (
                <div className="dos-plan__actions">
                  <button type="button" disabled={sel === 0} onClick={() => { setDay(day, moveItem(items, sel, -1)); setSelected({ day, index: sel - 1 }); }}>
                    {t("dailyPlan.earlier")}
                  </button>
                  <button type="button" disabled={sel === items.length - 1} onClick={() => { setDay(day, moveItem(items, sel, 1)); setSelected({ day, index: sel + 1 }); }}>
                    {t("dailyPlan.later")}
                  </button>
                  <button
                    type="button"
                    aria-expanded={pictureKey === planItemKey(selItem)}
                    onClick={() => setPictureKey(pictureKey === planItemKey(selItem) ? null : planItemKey(selItem))}
                  >
                    {t("dailyPlan.picture")}
                  </button>
                  <button type="button" className="dos-plan__remove" onClick={() => { setDay(day, items.filter((_, i) => i !== sel)); setSelected(null); setPictureKey(null); }}>
                    {t("dailyPlan.remove")}
                  </button>
                </div>
              )}
              {selItem && pictureKey === planItemKey(selItem) && (
                <div className="dos-plan__panel">
                  <p className="dos-plan__label">{t("dailyPlan.pictureFor", { text: selItem.text })}</p>
                  <PicturePicker
                    word={selItem.text}
                    value={selItem.icon}
                    onChange={(icon) => save(setItemIconEverywhere(week, planItemKey(selItem), icon))}
                  />
                </div>
              )}
              {addingDay === day && (
                <AddPanel
                  dayItems={items}
                  ownItems={ownItems}
                  onAdd={(item) => setDay(day, [...items, item])}
                  onClose={() => setAddingDay(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
