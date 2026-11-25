import { useState } from "react";
import {
  daypartBounds,
} from "@/topics/renderers/daily_orientation/timeUtils";
import {
  daysUntil,
  daysWord,
  formatDayMonth,
  sortByNextOccurrence,
  visibleImportantDates,
} from "@/features/importantDates/importantDates";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import DaypartBar from "./DaypartBar.jsx";
import PlanTodayEditor from "./PlanTodayEditor.jsx";
import WeekPlanEditor from "./WeekPlanEditor.jsx";
import "./dailyOrientationSettings.css";

// Settings screen for the "Сегодня" wall display. Instead of a flat list of
// ten switches, it opens with a miniature of the screen itself: the adult
// taps a card on the map to hide/show it and sees exactly what the child
// will get. The map is also the anchor for future per-card settings (tap a
// card -> its own options), so keep each card a self-contained entry in
// MAP_ROWS rather than special-casing it in markup.
//
// Stored params are unchanged (showWeekday, …, wakeHour/dayHour/eveningHour/bedHour and the
// one-line-per-day weeklyPlan text, see weekPlan.js), so saved settings keep working.

const CLOCK_PARTS = [
  { key: "showDigitalTime", label: "Цифры" },
  { key: "showTimeWords", label: "Словами" },
];

// Same order and shares as the real screen (dailyOrientation.css: three
// equal cards over Сейчас + Погода + План на день), so the map is a true miniature.
const MAP_ROWS = [
  [
    { id: "weekday", label: "День недели", sample: "ПЯТНИЦА", keys: ["showWeekday"], flex: 1, tone: "sage" },
    { id: "date", label: "Число", sample: "25 СЕНТЯБРЯ", keys: ["showDayOfMonth", "showMonth", "showSeason"], flex: 1, tone: "coral" },
    { id: "time", label: "Время", sample: "10:35", keys: CLOCK_PARTS.map((p) => p.key), flex: 1, tone: "blue" },
  ],
  [
    { id: "daypart", label: "Сейчас", sample: "УТРО", keys: ["showDaypart"], flex: 7, tone: "peach" },
    { id: "weather", label: "Погода", sample: "☁", keys: ["showWeather"], flex: 5, tone: "sand" },
    { id: "plan", label: "План на день", sample: "🏫 › 👟", keys: ["showPlan"], flex: 16, tone: "amber" },
  ],
];
const MAP_CARDS = MAP_ROWS.flat();


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

export default function DailyOrientationSettings({ params, setParams, student, onOpenImportantDates }) {
  const { t } = useUiTranslation();
  const [nudgedCard, setNudgedCard] = useState(null);
  const bounds = daypartBounds(params);
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

  return (
    <div className="dos">
      <PlanTodayEditor params={params} student={student} />

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
          <h2 className="dos-section__title" id="dos-day-title">{t("dailyDay.title")}</h2>
          <p className="dos-section__hint">
            {t(daypartOn ? "dailyDay.hint" : "dailyDay.hintOff")}
          </p>
        </header>

        <div className="dos-card">
          <DaypartBar bounds={bounds} onChange={set} />
        </div>
        <div className="dos-subgroup">
          <span className="dos-subgroup__label" id="dos-night-label">{t("dailyNight.label")}</span>
          <div className="dos-dates__styles" role="radiogroup" aria-labelledby="dos-night-label">
            {[[true, t("dailyNight.dark")], [false, t("dailyNight.usual")]].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={(params.nightScreen !== false) === value}
                className={`dos-chip${(params.nightScreen !== false) === value ? " dos-chip--on" : ""}`}
                onClick={() => set({ nightScreen: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="dos-dates__style-hint">{t(params.nightScreen !== false ? "dailyNight.darkHint" : "dailyNight.usualHint")}</p>
        </div>
      </section>

      <section className="dos-section" aria-labelledby="dos-screen-mode-title">
        <header className="dos-section__head">
          <h2 className="dos-section__title" id="dos-screen-mode-title">{t("dailyScreen.title")}</h2>
          <p className="dos-section__hint">{t("dailyScreen.hint")}</p>
        </header>
        <div className="dos-subgroup">
          <div className="dos-dates__styles" role="radiogroup" aria-labelledby="dos-screen-mode-title">
            {[[true, t("dailyScreen.full")], [false, t("dailyScreen.usual")]].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={(params.fullscreen !== false) === value}
                className={`dos-chip${(params.fullscreen !== false) === value ? " dos-chip--on" : ""}`}
                onClick={() => set({ fullscreen: value })}
              >
                {label}
              </button>
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

      <WeekPlanEditor weeklyPlan={params.weeklyPlan} planPhotos={params.planPhotos} onChange={set} student={student} />
    </div>
  );
}
