import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";
import {
  addCalendarDays,
  formatDigitalClock,
  formatDisplayDate,
  formatRussianClockTime,
  getLocalDateKey,
  getSeason,
  getSpokenDate,
  getSpokenSeason,
  getSpokenTime,
  getSpokenWeekday,
  parseWeeklyPlan,
} from "./timeUtils";
import "./dailyOrientation.css";

// Repeated taps re-trigger the same sentence instantly (useSpeech cancels and
// restarts); this just keeps a bored/curious tap streak from turning into a
// stutter of half-finished sentences on the wall display.
const SPEAK_COOLDOWN_MS = 2000;

// Same idle-return reasoning as the carousel: this is an unattended wall
// display, so a modal left open by a child who wandered off must not stay
// open indefinitely.
const MODAL_IDLE_CLOSE_MS = 90_000;

const WEATHER_STORAGE_KEY = "daily_orientation_weather";

const WEATHER_OPTIONS = [
  { id: "sunny", label: "СОЛНЕЧНО" },
  { id: "cloudy", label: "ОБЛАЧНО" },
  { id: "rain", label: "ДОЖДЬ" },
  { id: "snow", label: "СНЕГ" },
];
const WEATHER_LABEL_BY_ID = Object.fromEntries(WEATHER_OPTIONS.map((o) => [o.id, o.label]));

function readStoredWeather(dateKey) {
  try {
    const raw = window.localStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.date === dateKey ? parsed.weatherId : null;
  } catch {
    return null;
  }
}

function writeStoredWeather(dateKey, weatherId) {
  try {
    window.localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify({ date: dateKey, weatherId }));
  } catch {
    // Best-effort only -- a private/blocked storage context just means the
    // pick won't survive a reload, not a reason to break the tap.
  }
}

// The child sets this by looking out the window, not from a live feed, so it
// can never be wrong the moment it's picked -- but it must still expire at
// local midnight, or a forgotten pick from Monday would keep confidently
// claiming to be true on Wednesday. Keying storage to the calendar-day string
// (not a TTL timer) makes that automatic: a new day means a new key, so
// yesterday's value is simply never read again.
//
// weatherId is read fresh from storage every render (cheap, synchronous)
// instead of mirrored into its own useState+effect -- dateKey changing is
// what should make it change, and re-deriving it directly is what React's
// own guidance recommends over syncing external state through an effect.
// `version` exists only to force a re-render after a write, since writing to
// localStorage doesn't itself trigger one.
function useTodaysWeather(dateKey) {
  const [, forceRerender] = useState(0);
  const weatherId = readStoredWeather(dateKey);

  function selectWeather(id) {
    writeStoredWeather(dateKey, id);
    forceRerender((v) => v + 1);
  }

  return { weatherId, selectWeather };
}

const CAROUSEL_ITEMS = [
  { offset: -1, label: "Вчера" },
  { offset: 0, label: "Сегодня" },
  { offset: 1, label: "Завтра" },
];

// Monday-first display order, keyed to Date#getDay() (0=Sunday..6=Saturday)
// so it lines up directly with parseWeeklyPlan's keys.
const WEEK_DAYS = [
  { day: 1, label: "ПН" },
  { day: 2, label: "ВТ" },
  { day: 3, label: "СР" },
  { day: 4, label: "ЧТ" },
  { day: 5, label: "ПТ" },
  { day: 6, label: "СБ" },
  { day: 0, label: "ВС" },
];
const WEEKEND_DAYS = new Set([0, 6]);

// The adult asks the question out loud in person; the card captions just name
// what's being shown, so they stay plain nominative labels regardless of the
// carousel offset (the carousel pill is what shows which day is selected).
const CAPTION_WEEKDAY = "День недели";
const CAPTION_DATE_NUMBER = "Число";
const CAPTION_MONTH = "Месяц";
const CAPTION_SEASON = "Время года";
const CAPTION_TIME = "Время";

const DISPLAY_OPTION_KEYS = [
  "showCarousel",
  "showWeekday",
  "showDayOfMonth",
  "showMonth",
  "showSeason",
  "showWeather",
  "showAnalogClock",
  "showTimeWords",
  "showDigitalTime",
];

const CONTENT_OPTION_KEYS = DISPLAY_OPTION_KEYS.filter((key) => key !== "showCarousel");

const DESIGN_WIDTH = 1600;
const DESIGN_HEIGHT = 1000;

function resolveDisplayOptions(sessionParams = {}) {
  const options = Object.fromEntries(
    DISPLAY_OPTION_KEYS.map((key) => [key, sessionParams[key] !== false])
  );

  // The settings screen keeps at least one orientation item on. This fallback
  // also protects an old or manually edited saved setting from producing an
  // unusable blank wall display.
  return CONTENT_OPTION_KEYS.some((key) => options[key])
    ? options
    : { ...options, showWeekday: true };
}

function useDashboardScale() {
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    function updateScale() {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height) return;
      const nextScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
      setScale((current) => (Math.abs(current - nextScale) < 0.001 ? current : nextScale));
    }

    updateScale();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScale);
    observer?.observe(viewport);
    window.addEventListener("resize", updateScale);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  return { viewportRef, scale };
}

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId;
    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    }, Math.max(500, 60_050 - (Date.now() % 60_000)));
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return now;
}

function Chevron({ direction }) {
  return (
    <svg className={`daily-orientation__chevron daily-orientation__chevron--${direction}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={direction === "left" ? "M14.5 4 6.5 12l8 8" : "m9.5 4 8 8-8 8"} />
    </svg>
  );
}

function SeasonMark({ season }) {
  if (season.id === "winter") {
    return <svg className="daily-orientation__season-mark" viewBox="0 0 160 160" aria-hidden="true"><g stroke="currentColor" strokeWidth="10" strokeLinecap="round"><path d="M80 20v120M28 50l104 60M28 110l104-60" /><path d="m80 20-14 14M80 20l14 14M80 140l-14-14M80 140l14-14" /></g></svg>;
  }
  if (season.id === "spring") {
    return <svg className="daily-orientation__season-mark" viewBox="0 0 160 160" aria-hidden="true"><path d="M80 140V75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" /><path d="M80 108c-38 0-46-35-43-48 31 3 43 21 43 48ZM80 88c3-32 20-45 43-48 3 22-6 48-43 48Z" fill="currentColor" opacity=".78" /><circle cx="80" cy="55" r="22" fill="currentColor" /></svg>;
  }
  if (season.id === "summer") {
    return <svg className="daily-orientation__season-mark" viewBox="0 0 160 160" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"><circle cx="80" cy="80" r="30" fill="currentColor" opacity=".8" /><path d="M80 14v18M80 128v18M14 80h18M128 80h18M33 33l13 13M114 114l13 13M127 33l-13 13M46 114l-13 13" /></g></svg>;
  }
  return <svg className="daily-orientation__season-mark" viewBox="0 0 160 160" aria-hidden="true"><path d="M78 146c3-53 16-88 56-118-1 48-19 88-56 118Z" fill="currentColor" opacity=".9" /><path d="M78 146C70 99 48 64 20 41c4 47 22 86 58 105Z" fill="currentColor" opacity=".65" /><path d="M78 146c3-47 16-79 56-118M78 146C68 100 45 63 20 41" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>;
}

function SpeakerButton({ onClick }) {
  return (
    <button type="button" className="daily-orientation__speaker-icon" aria-label="Прослушать" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5l14 14M19 5 5 19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function DailyOrientationModal({ label, onClose, children }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, MODAL_IDLE_CLOSE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [onClose]);

  return (
    <div className="daily-orientation__modal-backdrop">
      <div className="daily-orientation__modal" role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="daily-orientation__modal-close" onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
}

function WeeklyPlanModal({ today, plan, onClose }) {
  const todayIndex = today.getDay();

  return (
    <DailyOrientationModal label="План на неделю" onClose={onClose}>
      <div className="daily-orientation__week">
        {WEEK_DAYS.map(({ day, label }) => (
          <div
            key={day}
            className={[
              "daily-orientation__week-day",
              day === todayIndex ? "daily-orientation__week-day--today" : "",
              WEEKEND_DAYS.has(day) ? "daily-orientation__week-day--weekend" : "",
            ].filter(Boolean).join(" ")}
          >
            <span className="daily-orientation__week-day-label">{label}</span>
            {plan[day] && <p className="daily-orientation__week-day-plan">{plan[day]}</p>}
          </div>
        ))}
      </div>
    </DailyOrientationModal>
  );
}

function WeatherMark({ id }) {
  if (id === "sunny") {
    return <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="16" cy="16" r="7" fill="currentColor" stroke="none" /><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6.3 6.3l2.8 2.8M22.9 22.9l2.8 2.8M25.7 6.3l-2.8 2.8M9.1 22.9l-2.8 2.8" /></g></svg>;
  }
  if (id === "rain") {
    return <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 17a6 6 0 0 1 .8-11.9A8 8 0 0 1 25 10a5 5 0 0 1-1 9.9H9Z" fill="currentColor" opacity=".85" /><g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 23l-2 4M17 23l-2 4M23 23l-2 4" /></g></svg>;
  }
  if (id === "snow") {
    return <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 17a6 6 0 0 1 .8-11.9A8 8 0 0 1 25 10a5 5 0 0 1-1 9.9H9Z" fill="currentColor" opacity=".85" /><g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 23v6M12 24.5l-3 1.5M12 24.5l3 1.5M12 27.5l-3 1.5M12 27.5l3 1.5" /><path d="M22 23v6M22 24.5l-3 1.5M22 24.5l3 1.5M22 27.5l-3 1.5M22 27.5l3 1.5" /></g></svg>;
  }
  return <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M9 20a6 6 0 0 1 .8-11.9A8 8 0 0 1 25 13a5 5 0 0 1-1 9.9H9Z" fill="currentColor" /></svg>;
}

function WeatherPickerModal({ value, onSelect, onClose }) {
  return (
    <DailyOrientationModal label="Какая сегодня погода?" onClose={onClose}>
      <p className="daily-orientation__weather-picker-title">Какая сегодня погода?</p>
      <div className="daily-orientation__weather-options">
        {WEATHER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`daily-orientation__weather-option${value === option.id ? " daily-orientation__weather-option--active" : ""}`}
            onClick={() => onSelect(option.id)}
          >
            <WeatherMark id={option.id} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </DailyOrientationModal>
  );
}

function AnalogClock({ now }) {
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;
  const minuteRotation = minutes * 6;
  const hourRotation = hours * 30 + minutes * 0.5;
  return (
    <svg className="daily-orientation__clock" viewBox="0 0 200 200" role="img" aria-label={`Аналоговые часы: ${formatDigitalClock(now)}`}>
      <circle cx="100" cy="100" r="92" className="daily-orientation__clock-rim" />
      <circle cx="100" cy="100" r="79" className="daily-orientation__clock-face" />
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index * 30 * Math.PI / 180;
        const x1 = 100 + Math.sin(angle) * 67;
        const y1 = 100 - Math.cos(angle) * 67;
        const x2 = 100 + Math.sin(angle) * 74;
        const y2 = 100 - Math.cos(angle) * 74;
        return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} className="daily-orientation__clock-tick" />;
      })}
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index * 30 * Math.PI / 180;
        const x = 100 + Math.sin(angle) * 52;
        const y = 100 - Math.cos(angle) * 52 + 6;
        return <text key={index} x={x} y={y} className="daily-orientation__clock-number">{index === 0 ? 12 : index}</text>;
      })}
      <line x1="100" y1="100" x2="100" y2="53" className="daily-orientation__clock-hand daily-orientation__clock-hand--hour" transform={`rotate(${hourRotation} 100 100)`} />
      <line x1="100" y1="100" x2="100" y2="31" className="daily-orientation__clock-hand daily-orientation__clock-hand--minute" transform={`rotate(${minuteRotation} 100 100)`} />
      <circle cx="100" cy="100" r="9" className="daily-orientation__clock-centre" />
    </svg>
  );
}

export default function DailyOrientationRenderer({ sessionParams, soundEnabled }) {
  const now = useCurrentTime();
  const { viewportRef, scale } = useDashboardScale();
  const { speak } = useSpeech();
  const [offset, setOffset] = useState(0);
  const [isWeeklyPlanOpen, setIsWeeklyPlanOpen] = useState(false);
  const [isWeatherPickerOpen, setIsWeatherPickerOpen] = useState(false);
  const dragStart = useRef(null);
  const lastSpokenAtRef = useRef(0);
  const display = resolveDisplayOptions(sessionParams);
  const weeklyPlan = parseWeeklyPlan(sessionParams?.weeklyPlan);
  const { weatherId, selectWeather } = useTodaysWeather(getLocalDateKey(now));
  const activeDate = addCalendarDays(now, offset);
  const { weekday, month, dayOfMonth } = formatDisplayDate(activeDate);
  const season = getSeason(activeDate.getMonth());
  const hasDate = display.showDayOfMonth || display.showMonth;
  const hasTime = display.showAnalogClock || display.showTimeWords || display.showDigitalTime;
  const hideCurrentTime = offset !== 0;
  const visibleCardCount = [display.showWeekday, hasDate, display.showSeason, hasTime].filter(Boolean).length;
  const timeCardClassName = [
    "daily-orientation__card",
    "daily-orientation__card--time",
    !display.showAnalogClock ? "daily-orientation__card--time-without-clock" : "",
    display.showAnalogClock && !display.showTimeWords && !display.showDigitalTime
      ? "daily-orientation__card--time-clock-only"
      : "",
    hideCurrentTime ? "daily-orientation__card--time-hidden" : "",
  ].filter(Boolean).join(" ");

  function selectOffset(nextOffset) {
    setOffset(Math.max(-1, Math.min(1, nextOffset)));
  }

  const speakCard = useCallback((text) => {
    const now = Date.now();
    if (now - lastSpokenAtRef.current < SPEAK_COOLDOWN_MS) return;
    lastSpokenAtRef.current = now;
    speak(text);
  }, [speak]);

  function speakableCardProps(text) {
    if (!soundEnabled) return {};
    return {
      role: "button",
      tabIndex: 0,
      onClick: () => speakCard(text),
      onKeyDown: (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        speakCard(text);
      },
    };
  }

  function beginSwipe(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragStart.current = { x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function endSwipe(event) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const delta = event.clientX - start.x;
    if (Math.abs(delta) < 45) return;
    selectOffset(offset + (delta < 0 ? 1 : -1));
  }

  return (
    <main className="daily-orientation" aria-label="Экран ориентации во времени">
      <div className="daily-orientation__viewport" ref={viewportRef}>
        <div className={`daily-orientation__canvas${display.showCarousel ? "" : " daily-orientation__canvas--without-carousel"}`} style={{ transform: `scale(${scale})` }}>
          {display.showCarousel && (
            <nav
              className="daily-orientation__carousel"
              aria-label="Выберите: вчера, сегодня или завтра"
              onPointerDown={beginSwipe}
              onPointerUp={endSwipe}
              onPointerCancel={() => { dragStart.current = null; }}
            >
              {CAROUSEL_ITEMS.map((item, index) => (
                <span className="daily-orientation__carousel-slot" key={item.offset}>
                  {index === 1 && <Chevron direction="left" />}
                  <button
                    type="button"
                    className={`daily-orientation__carousel-item${offset === item.offset ? " daily-orientation__carousel-item--active" : ""}`}
                    onClick={() => selectOffset(item.offset)}
                    aria-pressed={offset === item.offset}
                  >
                    {item.label}
                  </button>
                  {index === 1 && <Chevron direction="right" />}
                </span>
              ))}
            </nav>
          )}

          <section className={`daily-orientation__grid daily-orientation__grid--${visibleCardCount}`} aria-live="polite">
            {display.showWeekday && (
              <article
                className="daily-orientation__card daily-orientation__card--weekday daily-orientation__card--speakable"
                role="button"
                tabIndex={0}
                onClick={() => setIsWeeklyPlanOpen(true)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setIsWeeklyPlanOpen(true);
                }}
              >
                {soundEnabled && (
                  <SpeakerButton onClick={(event) => {
                    event.stopPropagation();
                    speakCard(getSpokenWeekday(activeDate, offset));
                  }} />
                )}
                <p className="daily-orientation__question">{CAPTION_WEEKDAY}</p>
                <strong className="daily-orientation__answer">{weekday}</strong>
              </article>
            )}

            {hasDate && (
              <article
                className={`daily-orientation__card daily-orientation__card--date${display.showDayOfMonth && display.showMonth ? "" : " daily-orientation__card--date-single"}${soundEnabled ? " daily-orientation__card--speakable" : ""}`}
                {...speakableCardProps(getSpokenDate(activeDate, offset))}
              >
                {soundEnabled && (
                  <SpeakerButton onClick={(event) => {
                    event.stopPropagation();
                    speakCard(getSpokenDate(activeDate, offset));
                  }} />
                )}
                <div className={`daily-orientation__date-values${display.showDayOfMonth && display.showMonth ? "" : " daily-orientation__date-values--single"}`}>
                  {display.showDayOfMonth && (
                    <div className="daily-orientation__date-part">
                      <p className="daily-orientation__question daily-orientation__question--date">{CAPTION_DATE_NUMBER}</p>
                      <strong className="daily-orientation__date-number">{dayOfMonth}</strong>
                    </div>
                  )}
                  {display.showDayOfMonth && display.showMonth && <div className="daily-orientation__date-divider" aria-hidden="true" />}
                  {display.showMonth && (
                    <div className="daily-orientation__date-part">
                      <p className="daily-orientation__question daily-orientation__question--date">{CAPTION_MONTH}</p>
                      <strong className="daily-orientation__date-month">{month}</strong>
                    </div>
                  )}
                </div>
              </article>
            )}

            {display.showSeason && (
              <article
                className={`daily-orientation__card daily-orientation__card--season daily-orientation__card--season-${season.id}${soundEnabled ? " daily-orientation__card--speakable" : ""}`}
                {...speakableCardProps(getSpokenSeason(activeDate, offset))}
              >
                <div className="daily-orientation__season-background" aria-hidden="true"><SeasonMark season={season} /></div>
                {soundEnabled && (
                  <SpeakerButton onClick={(event) => {
                    event.stopPropagation();
                    speakCard(getSpokenSeason(activeDate, offset));
                  }} />
                )}
                <p className="daily-orientation__question">{CAPTION_SEASON}</p>
                <strong className="daily-orientation__answer">{season.label}</strong>
                {display.showWeather && offset === 0 && (
                  <button
                    type="button"
                    className={`daily-orientation__weather-row${weatherId ? " daily-orientation__weather-row--set" : " daily-orientation__weather-row--unset"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsWeatherPickerOpen(true);
                    }}
                  >
                    {weatherId ? (
                      <>
                        <WeatherMark id={weatherId} />
                        <span>{WEATHER_LABEL_BY_ID[weatherId]}</span>
                      </>
                    ) : (
                      <span>Добавить погоду</span>
                    )}
                  </button>
                )}
              </article>
            )}

            {hasTime && (
              <article
                className={`${timeCardClassName}${soundEnabled && !hideCurrentTime ? " daily-orientation__card--speakable" : ""}`}
                aria-hidden={hideCurrentTime}
                {...(hideCurrentTime ? {} : speakableCardProps(getSpokenTime(now)))}
              >
                {soundEnabled && !hideCurrentTime && (
                  <SpeakerButton onClick={(event) => {
                    event.stopPropagation();
                    speakCard(getSpokenTime(now));
                  }} />
                )}
                <p className="daily-orientation__question daily-orientation__question--time">{CAPTION_TIME}</p>
                <div className="daily-orientation__time-content">
                  {display.showAnalogClock && <AnalogClock now={now} />}
                  {(display.showTimeWords || display.showDigitalTime) && (
                    <div className="daily-orientation__time-readout">
                      {display.showTimeWords && <strong className="daily-orientation__time-words">{formatRussianClockTime(now)}</strong>}
                      {display.showDigitalTime && (
                        <output className="daily-orientation__digital-time" aria-label={`Цифровое время: ${formatDigitalClock(now)}`}>{formatDigitalClock(now)}</output>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )}
          </section>
        </div>
      </div>
      <div className="daily-orientation__rotate-notice" role="status">
        <svg viewBox="0 0 120 120" aria-hidden="true"><rect x="28" y="20" width="64" height="80" rx="10" /><path d="M99 60a39 39 0 0 1-35 38M21 60a39 39 0 0 1 35-38" /><path d="m91 88 7 10 10-7M29 32l-7-10-10 7" /></svg>
        <p>Поверните планшет горизонтально</p>
      </div>
      {isWeeklyPlanOpen && (
        <WeeklyPlanModal today={now} plan={weeklyPlan} onClose={() => setIsWeeklyPlanOpen(false)} />
      )}
      {isWeatherPickerOpen && (
        <WeatherPickerModal
          value={weatherId}
          onSelect={(id) => { selectWeather(id); setIsWeatherPickerOpen(false); }}
          onClose={() => setIsWeatherPickerOpen(false)}
        />
      )}
    </main>
  );
}
