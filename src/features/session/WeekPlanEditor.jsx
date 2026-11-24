import { useRef, useState } from "react";
import { api } from "@/core/api";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { PHOTO_ACCEPT, PhotoPrepareError, squarePhotoDataUrl } from "@/shared/utils/squarePhoto";
import {
  FREQUENT_EMOJI,
  PLAN_DAYPARTS,
  PLAN_WEEK_ORDER,
  collectPlanItems,
  firstEmoji,
  moveItem,
  parsePlanPhotos,
  parseWeekItems,
  planItemKey,
  serializePlanPhotos,
  serializeWeekItems,
  setItemIconEverywhere,
  sortByDaypart,
  suggestEmoji,
} from "@/topics/renderers/daily_orientation/weekPlan.js";

// The weekly plan as rows of the day's big events (owner, 2026-11-23): what
// the wall screen's «План на день» shows. Tap «+» to add an event (one of the
// adult's own, or a new one with a picture they pick), tap an event to move it,
// change its picture (in every day at once) or remove it. An empty day can be
// filled «Как в …» from the nearest filled day before it.
//
// A picture is an emoji, a photo or nothing -- the adult chooses (owner,
// 2026-11-23). A photo belongs to the item like its emoji does, and the emoji
// is kept underneath as the picture wherever the photo can't be shown.

const WEEKEND = new Set([6, 0]);
const PHOTO_MAX_SIZE = 768;
const PHOTO_JPEG_QUALITY = 0.85;

// Unlike My People, no offline data-URL fallback: the plan travels in the
// topic's settings, and a whole photo inside them would bloat every sync.
async function uploadPhoto(file) {
  const dataUrl = await squarePhotoDataUrl(file, { maxSize: PHOTO_MAX_SIZE, quality: PHOTO_JPEG_QUALITY });
  const { url } = await api.post("/photos", { dataUrl });
  if (typeof url !== "string" || !url.startsWith("/api/photos/")) throw new Error("upload failed");
  return url;
}

function ItemPicture({ item, photo }) {
  if (photo) return <AuthenticatedImage className="dos-plan__chip-photo" src={photo} alt="" />;
  return item.icon ? <span className="dos-plan__chip-icon" aria-hidden="true">{item.icon}</span> : null;
}

function PicturePicker({ word, value, photo, onChange, onPhoto }) {
  const { t } = useUiTranslation();
  const [showAll, setShowAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const suggested = suggestEmoji(word);
  const choice = (emoji) => {
    const on = !photo && emoji === value;
    return (
      <button
        key={emoji}
        type="button"
        className={`dos-plan__emoji${on ? " dos-plan__emoji--on" : ""}`}
        aria-pressed={on}
        onClick={() => onChange(on ? null : emoji)}
      >
        {emoji}
      </button>
    );
  };

  async function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      onPhoto(await uploadPhoto(file));
    } catch (failure) {
      setError(failure instanceof PhotoPrepareError ? failure.message : t("dailyPlan.photoFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="dos-plan__picker">
      {photo && (
        <div className="dos-plan__photo-row">
          <AuthenticatedImage className="dos-plan__photo" src={photo} alt="" />
          <button type="button" className="dos-plan__link" onClick={() => onPhoto(null)}>{t("dailyPlan.removePhoto")}</button>
        </div>
      )}
      {suggested.length > 0 && (
        <div className="dos-plan__emoji-row" role="group" aria-label={t("dailyPlan.suggested")}>
          {suggested.map(choice)}
        </div>
      )}
      <div className="dos-plan__picker-actions">
        <button type="button" className="dos-plan__link" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? t("dailyPlan.uploading") : `📷 ${t("dailyPlan.photo")}`}
        </button>
        <button type="button" className="dos-plan__link" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {t("dailyPlan.morePictures")}
        </button>
        <button
          type="button"
          className={`dos-plan__link${value || photo ? "" : " dos-plan__link--on"}`}
          aria-pressed={!value && !photo}
          onClick={() => onChange(null)}
        >
          {t("dailyPlan.noPicture")}
        </button>
        <input ref={fileRef} type="file" accept={PHOTO_ACCEPT} hidden onChange={pickPhoto} />
      </div>
      {error && <p className="dos-plan__error" role="alert">{error}</p>}
      {showAll && (
        <>
          <div className="dos-plan__emoji-grid" role="group" aria-label={t("dailyPlan.morePictures")}>
            {FREQUENT_EMOJI.map(choice)}
          </div>
          <input
            className="dos-plan__any"
            type="text"
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

// Утро / день / вечер / ночь: which part of the day an event belongs to
// (owner, 2026-11-24) -- the wall screen lays the day out by it.
function DaypartPicker({ value, onChange, label }) {
  const { t } = useUiTranslation();
  return (
    <div className="dos-plan__dayparts" role="radiogroup" aria-label={label}>
      {PLAN_DAYPARTS.map((part) => (
        <button
          key={part}
          type="button"
          role="radio"
          aria-checked={value === part}
          className={`dos-plan__daypart dos-plan__daypart--${part}${value === part ? " dos-plan__daypart--on" : ""}`}
          onClick={() => onChange(part)}
        >
          {t(`dailyDay.part.${part}`)}
        </button>
      ))}
    </div>
  );
}

function AddPanel({ dayItems, ownItems, photos, onAdd, onClose }) {
  const { t } = useUiTranslation();
  const [text, setText] = useState("");
  const [icon, setIcon] = useState(null);
  const [iconTouched, setIconTouched] = useState(false);
  const [photo, setPhoto] = useState(null);
  // New events go after the day's last waking part by default.
  const [daypart, setDaypart] = useState(() => [...dayItems].reverse().find((item) => item.daypart !== "night")?.daypart ?? "morning");
  const used = new Set(dayItems.map(planItemKey));
  const available = ownItems.filter((item) => !used.has(planItemKey(item)));
  // Until the adult picks, the first suggestion for the word is pre-selected:
  // most words then need no extra tap.
  const shownIcon = iconTouched ? icon : suggestEmoji(text)[0] ?? null;
  const known = ownItems.find((item) => planItemKey(item) === planItemKey({ text }));

  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(known ? { ...known, daypart } : { icon: shownIcon, text: text.trim(), daypart }, known ? null : photo);
    setText("");
    setIcon(null);
    setIconTouched(false);
    setPhoto(null);
  }

  const previewPhoto = known ? photos[planItemKey(known)] : photo;
  return (
    <div className="dos-plan__panel">
      <div className="dos-plan__group">
        <p className="dos-plan__label">{t("dailyPlan.when")}</p>
        <DaypartPicker value={daypart} onChange={setDaypart} label={t("dailyPlan.when")} />
      </div>
      {available.length > 0 && (
        <div className="dos-plan__group">
          <p className="dos-plan__label">{t("dailyPlan.yours")}</p>
          <div className="dos-plan__chips">
            {available.map((item) => (
              <button key={planItemKey(item)} type="button" className="dos-plan__chip dos-plan__chip--own" onClick={() => onAdd({ ...item, daypart }, null)}>
                <ItemPicture item={item} photo={photos[planItemKey(item)]} />
                {item.text}
              </button>
            ))}
          </div>
        </div>
      )}
      <form className="dos-plan__group" onSubmit={submit}>
        <label className="dos-plan__label" htmlFor="dos-plan-new">{t("dailyPlan.newItem")}</label>
        <div className="dos-plan__new">
          <span className="dos-plan__preview" aria-hidden="true">
            {previewPhoto ? <AuthenticatedImage src={previewPhoto} alt="" /> : (known?.icon ?? shownIcon) || "·"}
          </span>
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
          <PicturePicker
            word={text}
            value={shownIcon}
            photo={photo}
            onChange={(next) => { setIcon(next); setIconTouched(true); setPhoto(null); }}
            onPhoto={setPhoto}
          />
        )}
      </form>
      <button type="button" className="dos-plan__done" onClick={onClose}>{t("dailyPlan.done")}</button>
    </div>
  );
}

export default function WeekPlanEditor({ weeklyPlan, planPhotos, onChange }) {
  const { t } = useUiTranslation();
  const week = parseWeekItems(weeklyPlan ?? "");
  const photos = parsePlanPhotos(planPhotos);
  const ownItems = collectPlanItems(week, PLAN_WEEK_ORDER);
  // { day, index } of the tapped event, the day whose «+» panel is open, the
  // item whose picture is being changed (by key).
  const [selected, setSelected] = useState(null);
  const [addingDay, setAddingDay] = useState(null);
  const [pictureKey, setPictureKey] = useState(null);

  function save(nextWeek, nextPhotos = photos) {
    onChange({ weeklyPlan: serializeWeekItems(nextWeek), planPhotos: serializePlanPhotos(nextPhotos, nextWeek) });
  }
  function setDay(day, items, nextPhotos) {
    save({ ...week, [day]: items }, nextPhotos);
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
          const selKey = selItem ? planItemKey(selItem) : null;
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
                      <span className={`dos-plan__chip-part dos-plan__daypart--${item.daypart}`}>{t(`dailyDay.part.${item.daypart}`)}</span>
                      <ItemPicture item={item} photo={photos[planItemKey(item)]} />
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
                  <button type="button" disabled={sel === 0 || items[sel - 1].daypart !== selItem.daypart} onClick={() => { setDay(day, moveItem(items, sel, -1)); setSelected({ day, index: sel - 1 }); }}>
                    {t("dailyPlan.earlier")}
                  </button>
                  <button type="button" disabled={sel === items.length - 1 || items[sel + 1].daypart !== selItem.daypart} onClick={() => { setDay(day, moveItem(items, sel, 1)); setSelected({ day, index: sel + 1 }); }}>
                    {t("dailyPlan.later")}
                  </button>
                  <button type="button" aria-expanded={pictureKey === selKey} onClick={() => setPictureKey(pictureKey === selKey ? null : selKey)}>
                    {t("dailyPlan.picture")}
                  </button>
                  <button type="button" className="dos-plan__remove" onClick={() => { setDay(day, items.filter((_, i) => i !== sel)); setSelected(null); setPictureKey(null); }}>
                    {t("dailyPlan.remove")}
                  </button>
                </div>
              )}
              {selItem && (
                <DaypartPicker
                  value={selItem.daypart}
                  label={t("dailyPlan.when")}
                  onChange={(part) => {
                    const next = sortByDaypart(items.map((item, i) => (i === sel ? { ...item, daypart: part } : item)));
                    setDay(day, next);
                    setSelected({ day, index: next.findIndex((item) => planItemKey(item) === selKey) });
                  }}
                />
              )}
              {selItem && pictureKey === selKey && (
                <div className="dos-plan__panel">
                  <p className="dos-plan__label">{t("dailyPlan.pictureFor", { text: selItem.text })}</p>
                  <PicturePicker
                    word={selItem.text}
                    value={selItem.icon}
                    photo={photos[selKey] ?? null}
                    onChange={(icon) => {
                      const nextPhotos = { ...photos };
                      delete nextPhotos[selKey];
                      save(setItemIconEverywhere(week, selKey, icon), nextPhotos);
                    }}
                    onPhoto={(url) => {
                      const nextPhotos = { ...photos };
                      if (url) nextPhotos[selKey] = url;
                      else delete nextPhotos[selKey];
                      save(week, nextPhotos);
                    }}
                  />
                </div>
              )}
              {addingDay === day && (
                <AddPanel
                  dayItems={items}
                  ownItems={ownItems}
                  photos={photos}
                  onAdd={(item, photo) => setDay(day, [...items, item], photo ? { ...photos, [planItemKey(item)]: photo } : photos)}
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
