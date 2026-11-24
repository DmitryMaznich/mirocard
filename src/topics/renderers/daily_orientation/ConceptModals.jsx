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
  WEEKDAY_NAMES,
  DATE_ORDINALS,
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
// (owner, 2026-11-24) The month as a calendar -- a thing from real life --
// with only «сегодня» as the accent; вчера/сегодня/завтра written small in
// their cells (always about the real today), the days gone paler, weekends
// warm and the month's important dates as pictures in their cells. Beside it
// the same phrase as the card: «24 ноября», «двадцать четвёртое ноября», the
// weekday and that day's events. A tap on a number shows that day there (a
// thin dashed frame marks it, so it doesn't compete with today) -- count
// with the child how many days to grandma's -- and it goes back after a
// minute. Below, the month's events in a list. No year, no «ноябрь→ноября»
// grammar panel: the phrase itself is the model.
const DATE_PICK_RETURN_MS = 60_000;
const RELATIVE_TAGS = { "-1": "вчера", 0: "сегодня", 1: "завтра" };

function EventPicture({ item, pictureFor, className }) {
  const photo = pictureFor(item);
  if (photo) return <AuthenticatedImage className={`${className} ${className}--photo`} src={photo} alt="" draggable="false" />;
  return <span className={className} aria-hidden="true">{importantMark([item])}</span>;
}

export function DateContent({ activeDate, today, importantDates = [], pictureFor = () => null }) {
  const year = activeDate.getFullYear();
  const monthIndex = activeDate.getMonth();
  const total = daysInMonth(year, monthIndex);
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Monday = 0
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    if (picked === null) return undefined;
    const timer = window.setTimeout(() => setPicked(null), DATE_PICK_RETURN_MS);
    return () => window.clearTimeout(timer);
  }, [picked]);
  const selectedDay = picked ?? activeDate.getDate();
  const selected = new Date(year, monthIndex, selectedDay);
  const tagFor = (date) => RELATIVE_TAGS[daysBetween(today, date)] ?? null;
  const selectedTag = tagFor(selected);
  const selectedEvents = eventsOnDate(importantDates, selected);
  const monthEvents = Array.from({ length: total }, (_, index) => index + 1)
    .flatMap((day) => eventsOnDate(importantDates, new Date(year, monthIndex, day)).map((item) => ({ day, item })));
  const isPast = (date) => date < today && !sameDay(date, today);

  return (
    <div className="dom dom--date">
      <div className="dom-calendar">
        <h2 className="dom-title">{capitalize(MONTHS_NOMINATIVE[monthIndex])}</h2>
        <div className="dom-calendar__grid" role="grid" aria-label={`Календарь: ${MONTHS_NOMINATIVE[monthIndex]}`}>
          {WEEK_MONDAY_FIRST.map(({ day, name, weekend }) => (
            <span key={day} className={`dom-calendar__head${weekend ? " dom-calendar__head--weekend" : ""}`} role="columnheader">
              {name}
            </span>
          ))}
          {cells.map((number, index) => {
            if (number === null) return <span key={`blank-${index}`} className="dom-calendar__cell dom-calendar__cell--blank" />;
            const date = new Date(year, monthIndex, number);
            const events = eventsOnDate(importantDates, date);
            const tag = tagFor(date);
            const isToday = sameDay(date, today);
            return (
              <button
                key={number}
                type="button"
                role="gridcell"
                aria-current={isToday ? "date" : undefined}
                aria-selected={number === selectedDay}
                className={[
                  "dom-calendar__cell",
                  index % 7 >= 5 ? "dom-calendar__cell--weekend" : "",
                  isPast(date) ? "dom-calendar__cell--past" : "",
                  isToday ? "dom-calendar__cell--today" : "",
                  number === selectedDay && !isToday ? "dom-calendar__cell--picked" : "",
                  events.length ? "dom-calendar__cell--important" : "",
                ].filter(Boolean).join(" ")}
                title={events.map((item) => item.title).join(", ") || undefined}
                onClick={() => setPicked(number === activeDate.getDate() ? null : number)}
              >
                {tag && <span className="dom-calendar__tag">{tag}</span>}
                <span className="dom-calendar__number">{number}</span>
                {events.length > 0 && <EventPicture item={events[0]} pictureFor={pictureFor} className="dom-calendar__mark" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="dom-date-side">
        <div className="dom-date-say">
          <p className="dom-date-say__caption">{selectedTag ? capitalize(selectedTag) : "Этот день"}</p>
          <p className="dom-date-say__phrase">
            <span className="dom-date-say__number">{selectedDay}</span>{" "}
            <span className="dom-date-say__month">{MONTHS_GENITIVE[monthIndex]}</span>
          </p>
          <p className="dom-date-say__words">{DATE_ORDINALS[selectedDay - 1]} {MONTHS_GENITIVE[monthIndex]}</p>
          <div className="dom-date-say__chips">
            <span className="dom-date-say__weekday">{capitalize(WEEKDAY_NAMES[selected.getDay()])}</span>
            {selectedEvents.map((item) => (
              <span key={item.id} className="dom-date-say__event">
                <EventPicture item={item} pictureFor={pictureFor} className="dom-date-say__event-picture" /> {item.title}
              </span>
            ))}
          </div>
        </div>
        {monthEvents.length > 0 && (
          <div className="dom-date-events">
            <p className="dom-date-events__caption">В этом месяце</p>
            <ul>
              {monthEvents.map(({ day, item }) => (
                <li key={`${day}-${item.id}`} className={isPast(new Date(year, monthIndex, day)) ? "dom-date-events__item--past" : ""}>
                  <b>{day}</b>
                  <EventPicture item={item} pictureFor={pictureFor} className="dom-date-events__picture" />
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Год: месяцы и времена года (owner, 2026-11-24) ────────────────────
// One modal for both: the four seasons as whole blocks of three months, the
// current season first and the current month the only accent. Swiping (or
// the ‹ › arrows) turns the strip by one season, round and round -- after
// summer comes autumn again -- and it turns back to now after a minute. A tap
// on a month shows it in the phrase below («Март · Весна») with its important
// dates; the month's own name here is the nominative («Сейчас ноябрь»): this is
// the answer to «какой сейчас месяц?», not to «какое число?».
const SEASON_ICONS = { winter: "❄️", spring: "🌱", summer: "☀️", autumn: "🍂" };
const YEAR_RETURN_MS = 60_000;
const YEAR_SWIPE_PX = 45;

export function YearContent({ activeDate, importantDates = [], pictureFor = () => null }) {
  const year = activeDate.getFullYear();
  const currentMonth = activeDate.getMonth();
  const startIndex = SEASON_ORDER.indexOf(getSeason(currentMonth).id);
  const [shift, setShift] = useState(0);
  const [picked, setPicked] = useState(null);
  const swipeRef = useRef(null);
  useEffect(() => {
    if (shift === 0 && picked === null) return undefined;
    const timer = window.setTimeout(() => { setShift(0); setPicked(null); }, YEAR_RETURN_MS);
    return () => window.clearTimeout(timer);
  }, [shift, picked]);

  const seasons = [0, 1, 2, 3].map((i) => SEASON_ORDER[(startIndex + shift + i) % 4]);
  // A month's important dates in the coming twelve months.
  const eventsIn = (month) => {
    const inYear = month >= currentMonth ? year : year + 1;
    return Array.from({ length: daysInMonth(inYear, month) }, (_, index) => index + 1)
      .flatMap((day) => eventsOnDate(importantDates, new Date(inYear, month, day)));
  };
  const turn = (delta) => setShift((value) => (value + delta + 4) % 4);
  const shownMonth = picked ?? currentMonth;
  const shownSeason = getSeason(shownMonth).id;
  const shownEvents = eventsIn(shownMonth);

  return (
    <div className="dom dom--year">
      <h2 className="dom-title">Год</h2>
      <div className="dom-year">
        <button type="button" className="dom-year__nav dom-year__nav--prev" aria-label="Предыдущее время года" onClick={() => turn(-1)}>‹</button>
        <div
          className="dom-year__strip"
          onPointerDown={(event) => { swipeRef.current = { x: event.clientX, id: event.pointerId }; }}
          onPointerUp={(event) => {
            const start = swipeRef.current;
            swipeRef.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            if (Math.abs(dx) >= YEAR_SWIPE_PX) turn(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => { swipeRef.current = null; }}
        >
          {seasons.map((seasonId) => (
            <section key={seasonId} className={`dom-year__season dom-year__season--${seasonId}`} aria-label={SEASON_LABELS[seasonId]}>
              <div className={`dom-year__head${SEASON_MONTHS[seasonId].includes(currentMonth) ? " dom-year__head--now" : ""}`}>
                <img src={seasonPicture(seasonId)} alt="" draggable="false" />
                <span>{SEASON_LABELS[seasonId]}</span>
              </div>
              <div className="dom-year__months">
                {SEASON_MONTHS[seasonId].map((month) => {
                  const events = eventsIn(month);
                  return (
                    <button
                      key={month}
                      type="button"
                      aria-current={month === currentMonth ? "date" : undefined}
                      aria-pressed={month === shownMonth}
                      className={[
                        "dom-year__month",
                        month === currentMonth ? "dom-year__month--now" : "",
                        month === picked && month !== currentMonth ? "dom-year__month--picked" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => setPicked(month === currentMonth ? null : month)}
                    >
                      <span className="dom-year__month-name">{MONTHS_NOMINATIVE[month]}</span>
                      {events.length > 0 && <EventPicture item={events[0]} pictureFor={pictureFor} className="dom-year__mark" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <button type="button" className="dom-year__nav dom-year__nav--next" aria-label="Следующее время года" onClick={() => turn(1)}>›</button>
      </div>
      <div className="dom-year__say">
        <p className="dom-year__phrase">
          {shownMonth === currentMonth ? <>Сейчас <em>{MONTHS_NOMINATIVE[shownMonth]}</em></> : <em>{capitalize(MONTHS_NOMINATIVE[shownMonth])}</em>}
        </p>
        <span className="dom-year__chip">{SEASON_ICONS[shownSeason]} {SEASON_LABELS[shownSeason]}</span>
        {shownEvents.slice(0, 3).map((item) => (
          <span key={item.id} className="dom-year__chip dom-year__chip--event">
            <EventPicture item={item} pictureFor={pictureFor} className="dom-year__chip-picture" /> {item.title}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Время суток ───────────────────────────────────────────────────────
// The cycle утро → день → вечер → ночь, now outlined, the rest paler; no
// hours (owner, 2026-11-24): they are the adult's setting, not the child's.
export function DaypartContent({ daypartId }) {
  return (
    <div className="dom">
      <h2 className="dom-title">Время суток</h2>
      <ol className="dom-cycle">
        {DAYPARTS.map((part, index) => (
          <li key={part.id} className="dom-cycle__slot">
            <div
              className={`dom-cycle__item dom-daypart-tone--${part.id}${part.id === daypartId ? " dom-cycle__item--active" : " dom-cycle__item--other"}`}
              aria-current={part.id === daypartId ? "true" : undefined}
            >
              <img className="dom-cycle__picture" src={`/daily-orientation/daypart_${part.id}.webp`} alt="" draggable="false" />
              <span className="dom-cycle__name">{DAYPART_NAMES[part.id]}</span>
            </div>
            {index < DAYPARTS.length - 1 ? <CycleArrow /> : null}
          </li>
        ))}
      </ol>
      <p className="dom-cycle__note">После ночи снова утро</p>
    </div>
  );
}
