import { useState } from "react";
import {
  DEFAULT_BED_HOUR,
  DEFAULT_WAKE_HOUR,
  getDaypartId,
  parseWeeklyPlan,
  splitPlanIcon,
} from "@/topics/renderers/daily_orientation/timeUtils";
import {
  daysUntil,
  daysWord,
  formatDayMonth,
  sortByNextOccurrence,
  visibleImportantDates,
} from "@/features/importantDates/importantDates";
import "./dailyOrientationSettings.css";

// Settings screen for the "Сегодня" wall display. Instead of a flat list of
// ten switches, it opens with a miniature of the screen itself: the adult
// taps a card on the map to hide/show it and sees exactly what the child
// will get. The map is also the anchor for future per-card settings (tap a
// card -> its own options), so keep each card a self-contained entry in
// MAP_ROWS rather than special-casing it in markup.
//
// Stored params are unchanged (showWeekday, …, wakeHour, bedHour and the
// "Пн: …" weeklyPlan text), so saved settings keep working.

const CLOCK_PARTS = [
  { key: "showAnalogClock", label: "Стрелки" },
  { key: "showDigitalTime", label: "Цифры" },
  { key: "showTimeWords", label: "Словами" },
];

// Same order and flex shares as the real screen (dailyOrientation.css:
// big 5 / narrow 2 / wide 3, Время суток 4), so the map is a true miniature.
const MAP_ROWS = [
  [
    { id: "weekday", label: "День недели", sample: "ПЯТНИЦА", keys: ["showWeekday"], flex: 5, tone: "sage" },
    { id: "date", label: "Число", sample: "25", keys: ["showDayOfMonth"], flex: 2, tone: "coral" },
    { id: "month", label: "Месяц", sample: "СЕНТЯБРЬ", keys: ["showMonth"], flex: 3, tone: "coral" },
    { id: "season", label: "Время года", sample: "ОСЕНЬ", keys: ["showSeason"], flex: 3, tone: "amber" },
  ],
  [
    { id: "daypart", label: "Сейчас", sample: "УТРО", keys: ["showDaypart"], flex: 4, tone: "peach" },
    { id: "weather", label: "Погода", sample: "☁", keys: ["showWeather"], flex: 2, tone: "sand" },
    { id: "time", label: "Время", sample: "10:35", keys: CLOCK_PARTS.map((p) => p.key), flex: 5, tone: "blue" },
  ],
];
const MAP_CARDS = MAP_ROWS.flat();

const WEEK = [
  { day: 1, short: "Пн", name: "Понедельник" },
  { day: 2, short: "Вт", name: "Вторник" },
  { day: 3, short: "Ср", name: "Среда" },
  { day: 4, short: "Чт", name: "Четверг" },
  { day: 5, short: "Пт", name: "Пятница" },
  { day: 6, short: "Сб", name: "Суббота", weekend: true },
  { day: 0, short: "Вс", name: "Воскресенье", weekend: true },
];

// Pictures for the weekly plan: a child who doesn't read yet recognises
// the day by its picture ("🏊 Бассейн").
const PLAN_ICONS = ["🏫", "🏠", "🏊", "⚽", "🎨", "🎵", "🗣️", "🩺", "🛒", "🌳", "🚗", "🧸", "👵", "🎂"];

const WAKE_RANGE = [5, 9];
const BED_RANGE = [19, 23];
const DAYPART_LABELS = { morning: "Утро", day: "День", evening: "Вечер", night: "Ночь" };

const IMPORTANT_DATES_STYLES = [
  { value: "bright", label: "Празднично", hint: "Гирлянда, тёплый фон и полоса с фото" },
  { value: "calm", label: "Спокойно", hint: "Только полоса с фото — для детей, которых пугают перемены на экране" },
  { value: "off", label: "Не показывать", hint: "Экран не отмечает важные даты" },
];

function whenText(item, today) {
  const left = daysUntil(item, today);
  if (left === 0) return "сегодня";
  if (left === 1) return "завтра";
  return `через ${daysWord(left)}`;
}

function isOn(params, key) {
  return params[key] !== false;
}

function cardIsOn(params, card) {
  return card.keys.some((key) => isOn(params, key));
}

function serializeWeeklyPlan(plan) {
  return WEEK
    .map(({ day, short }) => (plan[day]?.trim() ? `${short}: ${plan[day].trim()}` : null))
    .filter(Boolean)
    .join("\n");
}

function hourLabel(hour) {
  return `${hour}:00`;
}

// Contiguous runs of the same part of the day across 24 hours, starting at
// the wake hour so the bar reads like the child's day: утро → … → ночь.
function daypartSegments(wakeHour, bedHour) {
  const segments = [];
  for (let i = 0; i < 24; i++) {
    const hour = (wakeHour + i) % 24;
    const id = getDaypartId(new Date(2026, 0, 1, hour), wakeHour, bedHour);
    const last = segments[segments.length - 1];
    if (last && last.id === id) last.hours += 1;
    else segments.push({ id, from: hour, hours: 1 });
  }
  return segments;
}

function MapCard({ card, on, locked, onToggle }) {
  return (
    <button
      type="button"
      className={`dos-map-card dos-map-card--${card.tone}${on ? "" : " dos-map-card--off"}${locked ? " dos-map-card--locked" : ""}`}
      style={{ flexGrow: card.flex }}
      aria-pressed={on}
      aria-label={`${card.label}: ${on ? "показывается" : "скрыто"}`}
      onClick={onToggle}
    >
      <span className="dos-map-card__label">{card.label}</span>
      <span className="dos-map-card__sample" aria-hidden="true">{on ? card.sample : "скрыто"}</span>
      <span className="dos-map-card__check" aria-hidden="true">
        {on ? (
          <svg viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
        ) : null}
      </span>
    </button>
  );
}

function HourStepper({ id, label, value, range, onChange }) {
  const [min, max] = range;
  return (
    <div className="dos-hour">
      <span className="dos-hour__label" id={`${id}-label`}>{label}</span>
      <div className="dos-hour__control" role="group" aria-labelledby={`${id}-label`}>
        <button type="button" className="dos-hour__btn" aria-label={`${label}: раньше`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <output className="dos-hour__value" aria-live="polite">{hourLabel(value)}</output>
        <button type="button" className="dos-hour__btn" aria-label={`${label}: позже`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

export default function DailyOrientationSettings({ params, setParams, student, onOpenImportantDates }) {
  const [nudgedCard, setNudgedCard] = useState(null);
  const wakeHour = Number(params.wakeHour ?? DEFAULT_WAKE_HOUR);
  const bedHour = Number(params.bedHour ?? DEFAULT_BED_HOUR);
  // The inputs show their own draft: the stored "Пн: …" text is re-parsed
  // with trimming, so reading straight from it would eat a space the moment
  // it's typed between two words.
  const [planDraft, setPlanDraft] = useState(() => parseWeeklyPlan(params.weeklyPlan ?? ""));
  const [iconPickerDay, setIconPickerDay] = useState(null);
  const visibleCards = MAP_CARDS.filter((card) => cardIsOn(params, card));
  const hiddenLabels = [
    ...(isOn(params, "showCarousel") ? [] : ["вчера, сегодня, завтра"]),
    ...MAP_CARDS.filter((card) => !cardIsOn(params, card)).map((card) => card.label.toLowerCase()),
  ];
  const timeOn = cardIsOn(params, MAP_CARDS.find((card) => card.id === "time"));
  const daypartOn = isOn(params, "showDaypart");
  const clockPartsOn = CLOCK_PARTS.filter((part) => isOn(params, part.key));
  const today = new Date();
  const importantDates = visibleImportantDates(student?.importantDates);
  const upcomingDates = sortByNextOccurrence(importantDates, today)
    .filter((item) => daysUntil(item, today) !== null)
    .slice(0, 3);
  const datesStyle = params.importantDatesStyle ?? "bright";

  function set(patch) {
    setParams((current) => ({ ...current, ...patch }));
  }

  // The screen must always show something, so the last visible card can't
  // be switched off -- it wiggles instead of silently ignoring the tap.
  function toggleCard(card) {
    const on = cardIsOn(params, card);
    if (on && visibleCards.length <= 1) {
      setNudgedCard(card.id);
      window.setTimeout(() => setNudgedCard(null), 400);
      return;
    }
    set(Object.fromEntries(card.keys.map((key) => [key, !on])));
  }

  function toggleClockPart(key) {
    const on = isOn(params, key);
    if (on && clockPartsOn.length <= 1) return; // turning the last one off = hide the card (use the map)
    set({ [key]: !on });
  }

  function setPlanDay(day, text) {
    const next = { ...planDraft, [day]: text };
    setPlanDraft(next);
    set({ weeklyPlan: serializeWeeklyPlan(next) });
  }

  // The picture is stored in front of the text ("🏊 Бассейн"), so saved
  // plans and the "Пн: …" format stay as they were.
  function setPlanDayParts(day, { icon, text }) {
    setPlanDay(day, icon ? `${icon} ${text}` : text);
  }

  return (
    <div className="dos">
      <section className="dos-section" aria-labelledby="dos-screen-title">
        <header className="dos-section__head">
          <h2 className="dos-section__title" id="dos-screen-title">Что видит ребёнок</h2>
          <p className="dos-section__hint">Нажмите на карточку, чтобы скрыть или показать её</p>
        </header>

        <div className="dos-map">
          <button
            type="button"
            className={`dos-map-carousel${isOn(params, "showCarousel") ? "" : " dos-map-carousel--off"}`}
            aria-pressed={isOn(params, "showCarousel")}
            aria-label={`Вчера, сегодня, завтра: ${isOn(params, "showCarousel") ? "показывается" : "скрыто"}`}
            onClick={() => set({ showCarousel: !isOn(params, "showCarousel") })}
          >
            <span>Вчера</span>
            <span className="dos-map-carousel__today">‹ Сегодня ›</span>
            <span>Завтра</span>
          </button>
          {MAP_ROWS.map((row, index) => (
            <div className="dos-map-row" key={index}>
              {row.map((card) => (
                <MapCard
                  key={card.id}
                  card={card}
                  on={cardIsOn(params, card)}
                  locked={nudgedCard === card.id}
                  onToggle={() => toggleCard(card)}
                />
              ))}
            </div>
          ))}
        </div>

        <p className="dos-summary">
          {hiddenLabels.length === 0
            ? "Показываются все карточки"
            : `Скрыто: ${hiddenLabels.join(", ")}`}
        </p>

        <div className="dos-subgroup">
          <span className="dos-subgroup__label" id="dos-case-label">Буквы на карточках</span>
          <div className="dos-dates__styles" role="radiogroup" aria-labelledby="dos-case-label">
            {[["upper", "ЗАГЛАВНЫЕ"], ["sentence", "Обычные"]].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={(params.letterCase ?? "upper") === value}
                className={`dos-chip${(params.letterCase ?? "upper") === value ? " dos-chip--on" : ""}`}
                onClick={() => set({ letterCase: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="dos-dates__style-hint">Одна форма везде: ребёнок, который читает словами, не должен видеть «СРЕДА» на карточке и «Среда» в окне.</p>
        </div>

        {timeOn && (
          <div className="dos-subgroup">
            <span className="dos-subgroup__label" id="dos-clock-label">Время показывать</span>
            <div className="dos-chips" role="group" aria-labelledby="dos-clock-label">
              {CLOCK_PARTS.map((part) => {
                const on = isOn(params, part.key);
                return (
                  <button
                    key={part.key}
                    type="button"
                    className={`dos-chip${on ? " dos-chip--on" : ""}`}
                    aria-pressed={on}
                    disabled={on && clockPartsOn.length <= 1}
                    onClick={() => toggleClockPart(part.key)}
                  >
                    {part.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {timeOn && isOn(params, "showTimeWords") && (
          <div className="dos-subgroup">
            <span className="dos-subgroup__label" id="dos-timewords-label">Время словами</span>
            <div className="dos-dates__styles" role="radiogroup" aria-labelledby="dos-timewords-label">
              {[["exact", "Точно"], ["spoken", "Как говорят дома"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={(params.timeWordsStyle ?? "exact") === value}
                  className={`dos-chip${(params.timeWordsStyle ?? "exact") === value ? " dos-chip--on" : ""}`}
                  onClick={() => set({ timeWordsStyle: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="dos-dates__style-hint">
              {(params.timeWordsStyle ?? "exact") === "spoken"
                ? "«Двадцать минут десятого», «без пяти десять», «половина десятого»."
                : "«Девять часов двадцать минут» — по цифрам на часах."}
            </p>
          </div>
        )}
      </section>

      <section className={`dos-section${daypartOn ? "" : " dos-section--muted"}`} aria-labelledby="dos-day-title">
        <header className="dos-section__head">
          <h2 className="dos-section__title" id="dos-day-title">Режим дня</h2>
          <p className="dos-section__hint">
            {daypartOn
              ? "Когда начинается утро и ночь на карточке «Сейчас»"
              : "Включите карточку «Сейчас», чтобы режим дня был виден ребёнку"}
          </p>
        </header>

        <div className="dos-card">
          <div className="dos-hours">
            <HourStepper id="dos-wake" label="Подъём" value={wakeHour} range={WAKE_RANGE} onChange={(v) => set({ wakeHour: v })} />
            <HourStepper id="dos-bed" label="Отбой" value={bedHour} range={BED_RANGE} onChange={(v) => set({ bedHour: v })} />
          </div>
          <div className="dos-dayline" aria-hidden="true">
            {daypartSegments(wakeHour, bedHour).map((segment) => (
              <div
                key={`${segment.id}-${segment.from}`}
                className={`dos-dayline__part dos-dayline__part--${segment.id}`}
                style={{ flexGrow: segment.hours }}
              >
                <span className="dos-dayline__name">{DAYPART_LABELS[segment.id]}</span>
                <span className="dos-dayline__from">{hourLabel(segment.from)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dos-section" aria-labelledby="dos-sound-title">
        <header className="dos-section__head">
          <h2 className="dos-section__title" id="dos-sound-title">Озвучка карточек</h2>
          <p className="dos-section__hint">
            Обычно не нужна: экран используется со взрослым, и отвечает ребёнок. Включите, если ребёнок
            не может сказать ответ — тогда он нажимает кнопку на карточке, и планшет произносит ответ за него.
          </p>
        </header>
        <div className="dos-subgroup">
          <span className="dos-subgroup__label" id="dos-sound-label">Кнопка «Прослушать» на карточках</span>
          <div className="dos-dates__styles" role="radiogroup" aria-labelledby="dos-sound-label">
            {[[false, "Выключена"], [true, "Включена"]].map(([value, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={(params.cardSound === true) === value}
                className={`dos-chip${(params.cardSound === true) === value ? " dos-chip--on" : ""}`}
                onClick={() => set({ cardSound: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`dos-section${datesStyle === "off" ? " dos-section--muted" : ""}`} aria-labelledby="dos-dates-title">
        <header className="dos-section__head">
          <h2 className="dos-section__title" id="dos-dates-title">Важные даты</h2>
          <p className="dos-section__hint">Дни рождения, праздники и события из профиля ребёнка: в этот день экран выглядит празднично, а заранее показывает, сколько дней осталось.</p>
        </header>

        <div className="dos-card dos-dates">
          {upcomingDates.length ? (
            <ul className="dos-dates__list">
              {upcomingDates.map((item) => (
                <li key={item.id} className="dos-dates__item">
                  <span className="dos-dates__icon" aria-hidden="true">{item.icon}</span>
                  <span className="dos-dates__title">{item.title}</span>
                  <span className="dos-dates__when">{formatDayMonth(item)} · {whenText(item, today)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dos-dates__empty">Пока нет ни одной даты.</p>
          )}
          {onOpenImportantDates && (
            <button type="button" className="dos-dates__open" onClick={onOpenImportantDates}>
              {importantDates.length ? "Настроить даты" : "Добавить даты"}
            </button>
          )}
        </div>

        <div className="dos-subgroup">
          <span className="dos-subgroup__label" id="dos-dates-style-label">Как отмечать на экране</span>
          <div className="dos-dates__styles" role="radiogroup" aria-labelledby="dos-dates-style-label">
            {IMPORTANT_DATES_STYLES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={datesStyle === option.value}
                className={`dos-chip${datesStyle === option.value ? " dos-chip--on" : ""}`}
                onClick={() => set({ importantDatesStyle: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="dos-dates__style-hint">{IMPORTANT_DATES_STYLES.find((option) => option.value === datesStyle)?.hint}</p>
        </div>
      </section>

      <section className="dos-section" aria-labelledby="dos-week-title">
        <header className="dos-section__head">
          <h2 className="dos-section__title" id="dos-week-title">План на неделю</h2>
          <p className="dos-section__hint">Открывается тапом по карточке «День недели». Пустой день просто не показывается.</p>
        </header>

        <div className="dos-card dos-week">
          {WEEK.map(({ day, short, name, weekend }) => {
            const { icon, text } = splitPlanIcon(planDraft[day] ?? "");
            return (
              <div key={day} className={`dos-week__row${weekend ? " dos-week__row--weekend" : ""}`}>
                <span className="dos-week__day" title={name}>{short}</span>
                <button
                  type="button"
                  className={`dos-week__icon${icon ? "" : " dos-week__icon--empty"}`}
                  aria-label={icon ? `Картинка ${name}: ${icon}. Изменить` : `Добавить картинку: ${name}`}
                  aria-expanded={iconPickerDay === day}
                  onClick={() => setIconPickerDay(iconPickerDay === day ? null : day)}
                >
                  {icon ?? "＋"}
                </button>
                <input
                  id={`dos-week-${day}`}
                  className="dos-week__input"
                  type="text"
                  aria-label={name}
                  value={text}
                  placeholder={weekend ? "Например: поездка в парк" : "Например: школа"}
                  maxLength={60}
                  onChange={(event) => setPlanDayParts(day, { icon, text: event.target.value })}
                />
                {iconPickerDay === day && (
                  <div className="dos-week__icons" role="group" aria-label={`Картинка для дня: ${name}`}>
                    {PLAN_ICONS.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`dos-week__icon-choice${choice === icon ? " dos-week__icon-choice--on" : ""}`}
                        onClick={() => { setPlanDayParts(day, { icon: choice, text }); setIconPickerDay(null); }}
                      >
                        {choice}
                      </button>
                    ))}
                    {icon && (
                      <button type="button" className="dos-week__icon-clear" onClick={() => { setPlanDayParts(day, { icon: null, text }); setIconPickerDay(null); }}>
                        Без картинки
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
