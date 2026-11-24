import { useEffect, useRef, useState } from "react";
import {
  DAYPARTS,
  MONTHS_GENITIVE,
  MONTHS_NOMINATIVE,
  SEASON_MONTHS,
  SEASON_ORDER,
  WEEK_MONDAY_FIRST,
  addCalendarDays,
  daysInMonth,
  getSeason,
  getSpokenWeekday,
  monthEndingChange,
  WEEKDAY_NAMES,
} from "./timeUtils.js";
import { weekPhraseClipKeys, weekPhraseSpoken, weekWagonClipKeys } from "./audioBank.js";
import { eventsOnDate, isBirthdayType } from "@/features/importantDates/importantDates";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { planItemKey } from "./weekPlan.js";
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

// ── Неделя ────────────────────────────────────────────────────────────
// A week is a train: a small locomotive, then seven wagons Monday..Sunday.
// Trains for the weeks around today follow each other on a swipeable track,
// so after Sunday the next train's Monday comes. (A 7-day ring with a hand
// was tried and dropped on 2026-10-14: it read as a clock.) No numbers at
// all -- no dates, no 1-7: this modal teaches the names in order and the
// cycle; dates are the Число modal's job, and the child counts the wagons.
// The icon a date from "Важные даты" gets in a calendar cell or a week day.
function importantMark(events) {
  if (!events.length) return null;
  return isBirthdayType(events[0]) ? "🎂" : events[0].icon;
}

const COUNT_STEP_MS = 1400;

function mondayOf(date) {
  return addCalendarDays(date, -((date.getDay() + 6) % 7));
}

function daysBetween(from, to) {
  return Math.round((addCalendarDays(to, 0) - addCalendarDays(from, 0)) / 86_400_000);
}

// The week as a page of a planner (owner, 2026-11-24): seven rows top to
// bottom, Monday first, full names -- no train, no numbers, no other weeks.
// Today framed, the days of this week already gone paler, вчера/сегодня/
// завтра as on the main screen's switch, weekends warm. Each row shows that
// day's events from the weekly plan, except those every planned day has
// («Спать», «Занимаемся»: they tell no day from another), and its important
// dates. «Дни недели по порядку» lights the rows one by one, naming them, then
// says it's one week; a tap on a row lights it (and names it with the card
// speakers on), so an adult can go through the week with a finger.
export function WeekContent({ today, weekItems = {}, planPhotos = {}, importantDates = [], onSpeak = null, speakDays = false }) {
  const monday = mondayOf(today);
  const days = WEEK_MONDAY_FIRST.map(({ day, name, weekend }, index) => ({ day, name, weekend, date: addCalendarDays(monday, index) }));
  const plannedDays = days.map(({ day }) => weekItems[day] ?? []).filter((items) => items.length);
  const everyDay = plannedDays.length > 1
    ? new Set(plannedDays[0].map(planItemKey).filter((key) => plannedDays.every((items) => items.some((item) => planItemKey(item) === key))))
    : new Set();
  const [lit, setLit] = useState(null);
  const [walking, setWalking] = useState(false);
  const [phrase, setPhrase] = useState(null);
  const timersRef = useRef([]);

  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), []);

  function say(text, clipKeys, display, aloud = true) {
    setPhrase(display);
    if (aloud) onSpeak?.(text, clipKeys);
  }

  function select(date) {
    if (walking) return;
    setLit(date.getDay());
    const fromToday = daysBetween(today, date);
    const name = WEEKDAY_NAMES[date.getDay()];
    const tag = relativeDayTag(date, today);
    say(
      tag ? getSpokenWeekday(date, fromToday) : capitalize(name),
      weekWagonClipKeys(date, fromToday),
      tag ? <>{capitalize(tag)} — <em>{name}</em></> : <em>{capitalize(name)}</em>,
      speakDays,
    );
  }

  function walk() {
    if (walking) return;
    setWalking(true);
    const schedule = (delay, step) => timersRef.current.push(window.setTimeout(step, delay));
    days.forEach(({ day }, index) => {
      schedule(index * COUNT_STEP_MS, () => {
        setLit(day);
        const name = capitalize(WEEKDAY_NAMES[day]);
        say(name, [`weekday_${day}`], <em>{name}</em>);
      });
    });
    schedule(7 * COUNT_STEP_MS, () => {
      setLit("all");
      say(weekPhraseSpoken("one"), weekPhraseClipKeys("one"), <>Это одна <em>неделя</em></>);
    });
    schedule(8 * COUNT_STEP_MS + 600, () => {
      setLit(1);
      setWalking(false);
      say(weekPhraseSpoken("again"), weekPhraseClipKeys("again"), <>Потом снова <em>понедельник</em></>);
    });
  }

  return (
    <div className="dom dom--week">
      <div className="dom-week__head">
        <h2 className="dom-title">Неделя</h2>
        <button type="button" className="dom-week__count" onClick={walk} disabled={walking}>
          Дни недели по порядку
        </button>
      </div>
      <ol className="dom-weekplan">
        {days.map(({ day, name, weekend, date }) => {
          const tag = relativeDayTag(date, today);
          const items = (weekItems[day] ?? []).filter((item) => !everyDay.has(planItemKey(item)));
          const events = eventsOnDate(importantDates, date);
          return (
            <li key={day}>
              <button
                type="button"
                className={[
                  "dom-weekplan__day",
                  weekend ? "dom-weekplan__day--weekend" : "",
                  sameDay(date, today) ? "dom-weekplan__day--today" : "",
                  date < today && !sameDay(date, today) ? "dom-weekplan__day--past" : "",
                  lit === day || lit === "all" ? "dom-weekplan__day--lit" : "",
                ].filter(Boolean).join(" ")}
                aria-current={sameDay(date, today) ? "date" : undefined}
                onClick={() => select(date)}
              >
                <span className="dom-weekplan__tag">{tag ?? ""}</span>
                <span className="dom-weekplan__name">{capitalize(name)}</span>
                <span className="dom-weekplan__items">
                  {items.map((item) => {
                    const photo = planPhotos[planItemKey(item)];
                    return photo
                      ? <AuthenticatedImage key={planItemKey(item)} className="dom-weekplan__photo" src={photo} alt={item.text} draggable="false" />
                      : <span key={planItemKey(item)} className="dom-weekplan__icon" title={item.text} role="img" aria-label={item.text}>{item.icon || item.text}</span>;
                  })}
                  {events.map((item) => (
                    <span key={item.id} className="dom-weekplan__event">
                      <span aria-hidden="true">{isBirthdayType(item) ? "🎂" : item.icon}</span> {item.title}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="dom-weekplan__cycle"><span aria-hidden="true">↻</span> После воскресенья снова понедельник</p>
      <p className="dom-week__say" aria-live="polite">{phrase ?? " "}</p>
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
export function DaypartContent({ daypartId, bounds }) {
  const ranges = {
    morning: [bounds.morning, bounds.day],
    day: [bounds.day, bounds.evening],
    evening: [bounds.evening, bounds.night],
    night: [bounds.night, bounds.morning],
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
