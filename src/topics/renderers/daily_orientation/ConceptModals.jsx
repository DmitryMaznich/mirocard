import {
  DAYPARTS,
  MONTHS_NOMINATIVE,
  SEASON_MONTHS,
  SEASON_ORDER,
  WEEK_MONDAY_FIRST,
  addCalendarDays,
  daysInMonth,
  getSeason,
  monthEndingChange,
  splitPlanIcon,
} from "./timeUtils.js";
import { eventsOnDate, isBirthdayType } from "@/features/importantDates/importantDates";
import "./conceptModals.css";

// What each card's tap opens: the whole range of that concept with the
// current value picked out -- the card answers "what is it now", the modal
// answers "where is that among all of them". Every modal uses the same
// grammar: the full cycle in order, the current item large and outlined,
// its neighbours visible. Content only; the shell (backdrop, close button,
// idle auto-close) is DailyOrientationModal in index.jsx.

const SEASON_LABELS = { winter: "Зима", spring: "Весна", summer: "Лето", autumn: "Осень" };
const DAYPART_NAMES = { morning: "Утро", day: "День", evening: "Вечер", night: "Ночь" };

function seasonPicture(seasonId) {
  return `/daily-orientation/season_${seasonId}.webp`;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// вчера / сегодня / завтра relative to the real today, not to the carousel.
function relativeDayTag(date, today) {
  if (sameDay(date, today)) return "сегодня";
  if (sameDay(date, addCalendarDays(today, -1))) return "вчера";
  if (sameDay(date, addCalendarDays(today, 1))) return "завтра";
  return null;
}

function CycleArrow() {
  return (
    <svg className="dom-cycle-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13m-5-5 5 5-5 5" />
    </svg>
  );
}

// ── День недели ──────────────────────────────────────────────────────
// Full names are the label; the short form (пн, вт…) is only a small
// caption under it, never on its own.
// The icon a date from "Важные даты" gets in a calendar cell or a week day.
function importantMark(events) {
  if (!events.length) return null;
  return isBirthdayType(events[0]) ? "🎂" : events[0].icon;
}

export function WeekContent({ activeDate, today, plan, importantDates = [] }) {
  const mondayOffset = (activeDate.getDay() + 6) % 7;
  const monday = addCalendarDays(activeDate, -mondayOffset);
  return (
    <div className="dom">
      <h2 className="dom-title">Дни недели</h2>
      <ol className="dom-week">
        {WEEK_MONDAY_FIRST.map(({ day, name, short, weekend }, index) => {
          const date = addCalendarDays(monday, index);
          const isActive = sameDay(date, activeDate);
          const tag = relativeDayTag(date, today);
          return (
            <li
              key={day}
              className={[
                "dom-week__day",
                weekend ? "dom-week__day--weekend" : "",
                isActive ? "dom-week__day--active" : "",
              ].filter(Boolean).join(" ")}
              aria-current={isActive ? "date" : undefined}
            >
              <span className="dom-week__tag">{tag ?? " "}</span>
              <span className="dom-week__name">{capitalize(name)}</span>
              <span className="dom-week__short">{short}</span>
              {eventsOnDate(importantDates, date).map((item) => (
                <span key={item.id} className="dom-week__event">
                  <span aria-hidden="true">{isBirthdayType(item) ? "🎂" : item.icon}</span> {item.title}
                </span>
              ))}
              {plan[day] ? (
                <span className="dom-week__plan">
                  {splitPlanIcon(plan[day]).icon && <span className="dom-week__plan-icon" aria-hidden="true">{splitPlanIcon(plan[day]).icon}</span>}
                  {splitPlanIcon(plan[day]).text}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Число ─────────────────────────────────────────────────────────────
// A calendar of the month with the day circled, then the spoken form of the
// date. "29 сентября" vs the Месяц card's "сентябрь" is shown, not hidden:
// the same word, with the one letter that changes after a number marked.
const DATE_LEAD = { "-1": "Вчера было", 0: "Сегодня", 1: "Завтра будет" };

export function DateContent({ activeDate, offset, today, importantDates = [] }) {
  const year = activeDate.getFullYear();
  const monthIndex = activeDate.getMonth();
  const total = daysInMonth(year, monthIndex);
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Monday = 0
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];
  const { stem, nominativeEnding, genitiveEnding } = monthEndingChange(monthIndex);
  const dayNumber = activeDate.getDate();
  const todayInMonth = today.getFullYear() === year && today.getMonth() === monthIndex ? today.getDate() : null;

  return (
    <div className="dom dom--date">
      <div className="dom-calendar">
        <h2 className="dom-title">{capitalize(MONTHS_NOMINATIVE[monthIndex])} {year}</h2>
        <div className="dom-calendar__grid" role="grid" aria-label={`Календарь: ${MONTHS_NOMINATIVE[monthIndex]}`}>
          {WEEK_MONDAY_FIRST.map(({ day, name, weekend }) => (
            <span key={day} className={`dom-calendar__head${weekend ? " dom-calendar__head--weekend" : ""}`} role="columnheader">
              {name}
            </span>
          ))}
          {cells.map((number, index) => {
            if (number === null) return <span key={`blank-${index}`} className="dom-calendar__cell dom-calendar__cell--blank" />;
            const weekend = index % 7 >= 5;
            const past = todayInMonth !== null && number < todayInMonth;
            const events = eventsOnDate(importantDates, new Date(year, monthIndex, number));
            const mark = importantMark(events);
            return (
              <span
                key={number}
                role="gridcell"
                aria-current={number === dayNumber ? "date" : undefined}
                className={[
                  "dom-calendar__cell",
                  weekend ? "dom-calendar__cell--weekend" : "",
                  past ? "dom-calendar__cell--past" : "",
                  number === dayNumber ? "dom-calendar__cell--active" : "",
                  mark ? "dom-calendar__cell--important" : "",
                ].filter(Boolean).join(" ")}
                title={events.map((item) => item.title).join(", ") || undefined}
              >
                {number}
                {mark && <span className="dom-calendar__mark" aria-hidden="true">{mark}</span>}
              </span>
            );
          })}
        </div>
      </div>

      <div className="dom-date-say">
        <p className="dom-date-say__caption">Как мы говорим</p>
        <p className="dom-date-say__phrase">
          <span className="dom-date-say__lead">{DATE_LEAD[offset] ?? DATE_LEAD[0]}</span>{" "}
          <span className="dom-date-say__number">{dayNumber}</span>{" "}
          <span className="dom-date-say__month">{stem}<mark>{genitiveEnding}</mark></span>
        </p>
        <div className="dom-date-say__bridge" aria-label={`${stem}${nominativeEnding}, но ${dayNumber} ${stem}${genitiveEnding}`}>
          <span className="dom-date-say__form">
            <span className="dom-date-say__form-label">Месяц</span>
            <span className="dom-date-say__form-word">{stem}<mark>{nominativeEnding || " "}</mark></span>
          </span>
          <CycleArrow />
          <span className="dom-date-say__form">
            <span className="dom-date-say__form-label">После числа</span>
            <span className="dom-date-say__form-word"><span className="dom-date-say__number">{dayNumber}</span> {stem}<mark>{genitiveEnding}</mark></span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Месяц ─────────────────────────────────────────────────────────────
// All twelve, grouped by the season they belong to: month and time of year
// connected in one picture. (Each month's length used to be shown too --
// not something this screen's children need, and one more thing to read.)
export function MonthContent({ activeDate }) {
  const activeMonth = activeDate.getMonth();
  return (
    <div className="dom">
      <h2 className="dom-title">Месяцы</h2>
      <div className="dom-months">
        {SEASON_ORDER.map((seasonId) => (
          <section key={seasonId} className={`dom-months__season dom-season-tone--${seasonId}`}>
            <h3 className="dom-months__season-name">
              <img className="dom-months__season-thumb" src={seasonPicture(seasonId)} alt="" draggable="false" />
              {SEASON_LABELS[seasonId]}
            </h3>
            <ol className="dom-months__list">
              {SEASON_MONTHS[seasonId].map((monthIndex) => {
                const isActive = monthIndex === activeMonth;
                return (
                  <li
                    key={monthIndex}
                    className={`dom-months__month${isActive ? " dom-months__month--active" : ""}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span className="dom-months__month-name">{capitalize(MONTHS_NOMINATIVE[monthIndex])}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

// ── Время года ────────────────────────────────────────────────────────
export function SeasonContent({ activeDate }) {
  const current = getSeason(activeDate.getMonth()).id;
  const activeMonth = activeDate.getMonth();
  return (
    <div className="dom">
      <h2 className="dom-title">Времена года</h2>
      <ol className="dom-cycle">
        {SEASON_ORDER.map((seasonId, index) => (
          <li key={seasonId} className="dom-cycle__slot">
            <div
              className={`dom-cycle__item dom-season-tone--${seasonId}${seasonId === current ? " dom-cycle__item--active" : ""}`}
              aria-current={seasonId === current ? "true" : undefined}
            >
              <img className="dom-cycle__season-picture" src={seasonPicture(seasonId)} alt="" draggable="false" />
              <span className="dom-cycle__name">{SEASON_LABELS[seasonId]}</span>
              <span className="dom-cycle__months">
                {SEASON_MONTHS[seasonId].map((monthIndex) => (
                  <span key={monthIndex} className={monthIndex === activeMonth ? "dom-cycle__month--active" : undefined}>
                    {MONTHS_NOMINATIVE[monthIndex]}
                  </span>
                ))}
              </span>
            </div>
            {index < SEASON_ORDER.length - 1 ? <CycleArrow /> : null}
          </li>
        ))}
      </ol>
      <p className="dom-cycle__note">После осени снова приходит зима</p>
    </div>
  );
}

// ── Время суток ───────────────────────────────────────────────────────
export function DaypartContent({ daypartId, wakeHour, bedHour }) {
  const ranges = {
    morning: [wakeHour, 12],
    day: [12, 18],
    evening: [18, bedHour],
    night: [bedHour, wakeHour],
  };
  return (
    <div className="dom">
      <h2 className="dom-title">Время суток</h2>
      <ol className="dom-cycle">
        {DAYPARTS.map((part, index) => (
          <li key={part.id} className="dom-cycle__slot">
            <div
              className={`dom-cycle__item dom-daypart-tone--${part.id}${part.id === daypartId ? " dom-cycle__item--active" : ""}`}
              aria-current={part.id === daypartId ? "true" : undefined}
            >
              <img className="dom-cycle__picture" src={`/daily-orientation/daypart_${part.id}.webp`} alt="" draggable="false" />
              <span className="dom-cycle__name">{DAYPART_NAMES[part.id]}</span>
              <span className="dom-cycle__months">
                <span>{ranges[part.id][0]}:00 – {ranges[part.id][1]}:00</span>
              </span>
            </div>
            {index < DAYPARTS.length - 1 ? <CycleArrow /> : null}
          </li>
        ))}
      </ol>
      <p className="dom-cycle__note">После ночи снова наступает утро</p>
    </div>
  );
}
