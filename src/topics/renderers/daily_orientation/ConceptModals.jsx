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
  splitPlanIcon,
  WEEKDAY_NAMES,
} from "./timeUtils.js";
import { weekCountClipKeys, weekCountSpoken, weekPhraseClipKeys, weekPhraseSpoken, weekWagonClipKeys } from "./audioBank.js";
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

// ── Неделя ────────────────────────────────────────────────────────────
// A week is a train: a small locomotive, then seven wagons Monday..Sunday.
// Trains for the weeks around today follow each other on a swipeable track,
// so after Sunday the next train's Monday comes. (A 7-day ring with a hand
// was tried and dropped on 2026-10-14: it read as a clock.) The date's
// number sits in each wagon's rim; the month is in the train's plate.
// The icon a date from "Важные даты" gets in a calendar cell or a week day.
function importantMark(events) {
  if (!events.length) return null;
  return isBirthdayType(events[0]) ? "🎂" : events[0].icon;
}

const WEEKS_AROUND = [-2, -1, 0, 1, 2];
const COUNT_STEP_MS = 1400;

function mondayOf(date) {
  return addCalendarDays(date, -((date.getDay() + 6) % 7));
}

function daysBetween(from, to) {
  return Math.round((addCalendarDays(to, 0) - addCalendarDays(from, 0)) / 86_400_000);
}

function weekLabel(week) {
  if (week === 0) return "Эта неделя";
  if (week === -1) return "Прошлая неделя";
  if (week === 1) return "Следующая неделя";
  return week < 0 ? `${-week} недели назад` : `Через ${week} недели`;
}

function weekRange(monday) {
  const sunday = addCalendarDays(monday, 6);
  return monday.getMonth() === sunday.getMonth()
    ? `${monday.getDate()}–${sunday.getDate()} ${MONTHS_GENITIVE[sunday.getMonth()]}`
    : `${monday.getDate()} ${MONTHS_GENITIVE[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_GENITIVE[sunday.getMonth()]}`;
}

function Locomotive() {
  return (
    <svg className="dom-train__loco" viewBox="0 0 120 120" aria-hidden="true">
      <rect className="dom-train__loco-body" x="62" y="22" width="50" height="8" rx="3" />
      <rect className="dom-train__loco-body" x="66" y="28" width="42" height="58" rx="6" />
      <rect x="76" y="38" width="22" height="20" rx="4" fill="#cfe3ec" />
      <rect className="dom-train__loco-body" x="18" y="50" width="52" height="34" rx="14" />
      <rect x="28" y="30" width="12" height="22" rx="2" fill="#3d3a36" />
      <rect x="24" y="26" width="20" height="7" rx="3" fill="#3d3a36" />
      <circle cx="16" cy="66" r="8" fill="#3d3a36" />
      <circle cx="14" cy="66" r="5" fill="#ffd9a0" />
      <path className="dom-train__loco-body" d="M18 84 L4 98 L22 98 Z" />
      <rect x="14" y="82" width="98" height="7" rx="3" fill="#3d3a36" />
      <circle cx="38" cy="96" r="11" fill="#3d3a36" stroke="#fffdf8" strokeWidth="3" />
      <circle cx="38" cy="96" r="3.5" fill="#9a9184" />
      <circle cx="88" cy="94" r="14" fill="#3d3a36" stroke="#fffdf8" strokeWidth="3" />
      <circle cx="88" cy="94" r="4.5" fill="#9a9184" />
    </svg>
  );
}

export function WeekContent({ activeDate, today, plan, importantDates = [], onSpeak = null, speakDays = false }) {
  const thisMonday = mondayOf(today);
  const firstDay = addCalendarDays(thisMonday, WEEKS_AROUND[0] * 7);
  const lastDay = addCalendarDays(thisMonday, WEEKS_AROUND[WEEKS_AROUND.length - 1] * 7 + 6);
  const [selected, setSelected] = useState(() => addCalendarDays(activeDate, 0));
  // The count: which train is being counted and how far (1-7 wagons, 8 = "это неделя").
  const [count, setCount] = useState(null);
  const [phrase, setPhrase] = useState(null);
  const trackRef = useRef(null);
  const timersRef = useRef([]);
  const hasScrolledRef = useRef(false);
  const selectedWeek = Math.floor(daysBetween(thisMonday, selected) / 7);

  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), []);

  // Keep the selected day's train in the middle of the track.
  useEffect(() => {
    const track = trackRef.current;
    const train = track?.querySelector(`[data-week="${selectedWeek}"]`);
    if (!train || typeof track.scrollTo !== "function") return;
    const left = train.offsetLeft - (track.clientWidth - train.offsetWidth) / 2;
    const instant = !hasScrolledRef.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left, behavior: instant ? "auto" : "smooth" });
    hasScrolledRef.current = true;
  }, [selectedWeek]);

  function say(text, clipKeys, display, aloud = true) {
    setPhrase(display);
    if (aloud) onSpeak?.(text, clipKeys);
  }

  function select(date) {
    if (count || date < firstDay || date > lastDay) return;
    const fromToday = daysBetween(today, date);
    const crossedIntoMonday = date.getDay() === 1 && daysBetween(selected, date) === 1;
    setSelected(date);
    const name = WEEKDAY_NAMES[date.getDay()];
    if (crossedIntoMonday) {
      say(weekPhraseSpoken("again"), weekPhraseClipKeys("again"), <>Новая неделя! Снова <em>понедельник</em></>, speakDays);
      return;
    }
    const tag = relativeDayTag(date, today);
    say(
      tag ? getSpokenWeekday(date, fromToday) : capitalize(name),
      weekWagonClipKeys(date, fromToday),
      tag ? <>{capitalize(tag)} — <em>{name}</em></> : <em>{capitalize(name)}</em>,
      speakDays,
    );
  }

  function startCount() {
    if (count) return;
    const monday = mondayOf(selected);
    const schedule = (delay, step) => timersRef.current.push(window.setTimeout(step, delay));
    setCount({ week: Math.floor(daysBetween(thisMonday, monday) / 7), step: 0 });
    for (let step = 1; step <= 7; step++) {
      schedule((step - 1) * COUNT_STEP_MS, () => {
        const day = addCalendarDays(monday, step - 1);
        setCount((value) => value && { ...value, step });
        setSelected(day);
        say(weekCountSpoken(step), weekCountClipKeys(step), <><em>{capitalize(COUNT_WORDS[step - 1])}</em> — {WEEKDAY_NAMES[day.getDay()]}</>);
      });
    }
    schedule(7 * COUNT_STEP_MS, () => {
      setCount((value) => value && { ...value, step: 8 });
      say(weekPhraseSpoken("is_seven"), weekPhraseClipKeys("is_seven"), <>Семь дней — это <em>неделя</em></>);
    });
    schedule(8 * COUNT_STEP_MS + 600, () => {
      const nextMonday = addCalendarDays(monday, 7);
      setCount(null);
      if (nextMonday > lastDay) return;
      setSelected(nextMonday);
      say(weekPhraseSpoken("again"), weekPhraseClipKeys("again"), <>Потом всё сначала: снова <em>понедельник</em></>);
    });
  }

  return (
    <div className="dom dom--week">
      <div className="dom-week__head">
        <div className="dom-week__head-text">
          <h2 className="dom-title">Неделя</h2>
          <p className="dom-week__lead">Семь дней едут друг за другом. Потом снова понедельник.</p>
        </div>
        <button type="button" className="dom-week__count" onClick={startCount} disabled={Boolean(count)}>
          Сколько дней в неделе?
        </button>
      </div>

      <div className="dom-week__track-wrap">
        <button
          type="button"
          className="dom-week__nav dom-week__nav--prev"
          aria-label="Предыдущий день"
          disabled={Boolean(count) || selected <= firstDay}
          onClick={() => select(addCalendarDays(selected, -1))}
        >‹</button>
        <div className="dom-week__track" ref={trackRef}>
          {WEEKS_AROUND.map((week) => {
            const monday = addCalendarDays(thisMonday, week * 7);
            const counted = count?.week === week ? count.step : 0;
            return (
              <section
                key={week}
                data-week={week}
                className={[
                  "dom-train",
                  week === 0 ? "dom-train--current" : "",
                  week === selectedWeek ? "dom-train--selected" : "",
                  counted === 8 ? "dom-train--counted" : "",
                ].filter(Boolean).join(" ")}
                aria-label={`${weekLabel(week)}, ${weekRange(monday)}`}
              >
                <p className="dom-train__plate">
                  <span className="dom-train__label">{weekLabel(week)}</span>
                  <span className="dom-train__range">{weekRange(monday)}</span>
                  <span className="dom-train__seven">7 дней — неделя</span>
                </p>
                <Locomotive />
                <ol className="dom-week">
                  {WEEK_MONDAY_FIRST.map(({ day, name, weekend }, index) => {
                    const date = addCalendarDays(monday, index);
                    const isSelected = sameDay(date, selected);
                    const tag = relativeDayTag(date, today);
                    const entry = plan[day] ? splitPlanIcon(plan[day]) : null;
                    return (
                      <li key={day} className="dom-week__slot">
                        <button
                          type="button"
                          className={[
                            "dom-week__day",
                            weekend ? "dom-week__day--weekend" : "",
                            isSelected ? "dom-week__day--active" : "",
                            counted && counted <= 7 && index === counted - 1 ? "dom-week__day--counting" : "",
                          ].filter(Boolean).join(" ")}
                          aria-current={isSelected ? "date" : undefined}
                          onClick={() => select(date)}
                        >
                          <span className="dom-week__rim">{date.getDate()}</span>
                          <span className="dom-week__tag">{tag ?? " "}</span>
                          <span className="dom-week__name">{capitalize(name)}</span>
                          {eventsOnDate(importantDates, date).map((item) => (
                            <span key={item.id} className="dom-week__event">
                              <span aria-hidden="true">{isBirthdayType(item) ? "🎂" : item.icon}</span> {item.title}
                            </span>
                          ))}
                          {entry ? (
                            <span className="dom-week__plan">
                              {entry.icon && <span className="dom-week__plan-icon" aria-hidden="true">{entry.icon}</span>}
                              {entry.text}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
        <button
          type="button"
          className="dom-week__nav dom-week__nav--next"
          aria-label="Следующий день"
          disabled={Boolean(count) || selected >= lastDay}
          onClick={() => select(addCalendarDays(selected, 1))}
        >›</button>
      </div>

      <p className="dom-week__say" aria-live="polite">{phrase ?? " "}</p>
    </div>
  );
}

const COUNT_WORDS = ["один", "два", "три", "четыре", "пять", "шесть", "семь"];

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
