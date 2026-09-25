import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";
import {
  addCalendarDays,
  formatDigitalClock,
  formatDisplayDate,
  formatRussianClockTime,
  getClockWordParts,
  getLocalDateKey,
  getSeason,
  getSpokenDate,
  getSpokenMonth,
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

// Feminine adjectives agreeing with "погода" ("погода дождливая", not
// "погода — дождь"): дождь/снег/туман name the precipitation/phenomenon
// itself, not a description of the weather, so they're wrong here even
// though they're the obvious first word that comes to mind for each icon.
const WEATHER_OPTIONS = [
  { id: "sunny", label: "СОЛНЕЧНАЯ" },
  { id: "cloudy", label: "ПАСМУРНАЯ" },
  { id: "rain", label: "ДОЖДЛИВАЯ" },
  { id: "snow", label: "СНЕЖНАЯ" },
  { id: "fog", label: "ТУМАННАЯ" },
];
const WEATHER_LABEL_BY_ID = Object.fromEntries(WEATHER_OPTIONS.map((o) => [o.id, o.label]));

function getSpokenWeather(weatherId) {
  return `Погода ${WEATHER_LABEL_BY_ID[weatherId].toLowerCase()}.`;
}

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
const CAPTION_WEATHER = "Погода";
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

// Text and icons are sized once for a 1600x1000 design and scaled uniformly
// (so type never gets squashed), but the canvas itself then grows to cover
// the whole screen: on a screen wider than 16:10 the extra width goes into
// the canvas, and every card in a row widens by its own flex share instead of
// leaving empty bands at the sides (and likewise extra height on a 4:3 one).
function useDashboardScale() {
  const viewportRef = useRef(null);
  const [layout, setLayout] = useState({ scale: 1, width: DESIGN_WIDTH, height: DESIGN_HEIGHT });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    function updateScale() {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height) return;
      const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
      const next = {
        scale,
        width: Math.max(DESIGN_WIDTH, Math.floor(width / scale)),
        height: Math.max(DESIGN_HEIGHT, Math.floor(height / scale)),
      };
      setLayout((current) => (
        Math.abs(current.scale - next.scale) < 0.001
        && current.width === next.width
        && current.height === next.height
          ? current
          : next
      ));
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

  return { viewportRef, ...layout };
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

// Deliberately real-world colours (not currentColor like the rest of this
// topic's icons) -- weather is the one place where the colour itself is part
// of the meaning (yellow sun, blue rain, grey fog), so tinting it to match
// whatever the surrounding card's ink colour is would make it harder, not
// easier, to read at a glance.
function WeatherMark({ id }) {
  if (id === "sunny") {
    return (
      <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true">
        <g stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round">
          <path d="M16 2v4M16 26v4M2 16h4M26 16h4M6.3 6.3l2.8 2.8M22.9 22.9l2.8 2.8M25.7 6.3l-2.8 2.8M9.1 22.9l-2.8 2.8" />
        </g>
        <circle cx="16" cy="16" r="7.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "cloudy") {
    return (
      <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 22a6.5 6.5 0 0 1 .8-12.9A8.5 8.5 0 0 1 26 11a5.5 5.5 0 0 1-1 11H9Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.4" />
      </svg>
    );
  }
  if (id === "rain") {
    return (
      <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 17a6 6 0 0 1 .8-11.9A8 8 0 0 1 25 10a5 5 0 0 1-1 9.9H9Z" fill="#9fb4c7" stroke="#7891a8" strokeWidth="1.4" />
        <g stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round">
          <path d="M11 23l-2 4M17 23l-2 4M23 23l-2 4" />
        </g>
      </svg>
    );
  }
  if (id === "snow") {
    return (
      <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 17a6 6 0 0 1 .8-11.9A8 8 0 0 1 25 10a5 5 0 0 1-1 9.9H9Z" fill="#c7d2dd" stroke="#94a3b8" strokeWidth="1.4" />
        <g stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 23v6M12 24.5l-3 1.5M12 24.5l3 1.5M12 27.5l-3 1.5M12 27.5l3 1.5" />
          <path d="M22 23v6M22 24.5l-3 1.5M22 24.5l3 1.5M22 27.5l-3 1.5M22 27.5l3 1.5" />
        </g>
      </svg>
    );
  }
  // fog
  return (
    <svg className="daily-orientation__weather-mark" viewBox="0 0 32 32" aria-hidden="true">
      <g stroke="#94a3b8" strokeWidth="2.6" strokeLinecap="round">
        <path d="M5 11h22" opacity=".55" />
        <path d="M3 17h26" />
        <path d="M6 23h20" opacity=".55" />
      </g>
    </svg>
  );
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

// A teaching clock, not a decorative one: every minute has a tick (every
// fifth one heavier), the hour hand is short+thick and the minute hand
// long+thin, and each hand has its own colour that the digital clock's digits
// and the spoken-words halves reuse (--orientation-hour / --orientation-minute)
// -- so "the red hand is the 10, the blue hand is the 35" is readable straight
// off the card. The pale wedge from 12 to the minute hand shows how much of
// the hour has already gone by.
const CLOCK_C = 120;

function clockPoint(angleDeg, radius) {
  const angle = angleDeg * Math.PI / 180;
  return [CLOCK_C + Math.sin(angle) * radius, CLOCK_C - Math.cos(angle) * radius];
}

function AnalogClock({ now }) {
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;
  const minuteRotation = minutes * 6;
  const hourRotation = hours * 30 + minutes * 0.5;
  const [wedgeX, wedgeY] = clockPoint(minuteRotation, 100);
  const wedgePath = minutes === 0
    ? null
    : `M${CLOCK_C} ${CLOCK_C}V${CLOCK_C - 100}A100 100 0 ${minuteRotation > 180 ? 1 : 0} 1 ${wedgeX} ${wedgeY}Z`;
  return (
    <svg className="daily-orientation__clock" viewBox="0 0 240 240" role="img" aria-label={`Аналоговые часы: ${formatDigitalClock(now)}`}>
      <circle cx={CLOCK_C} cy={CLOCK_C} r="116" className="daily-orientation__clock-rim" />
      <circle cx={CLOCK_C} cy={CLOCK_C} r="106" className="daily-orientation__clock-face" />
      {wedgePath && <path d={wedgePath} className="daily-orientation__clock-elapsed" />}
      {Array.from({ length: 60 }, (_, index) => {
        const isMajor = index % 5 === 0;
        const [x1, y1] = clockPoint(index * 6, isMajor ? 88 : 94);
        const [x2, y2] = clockPoint(index * 6, 101);
        return (
          <line
            key={index}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={`daily-orientation__clock-tick${isMajor ? " daily-orientation__clock-tick--major" : ""}`}
          />
        );
      })}
      {Array.from({ length: 12 }, (_, index) => {
        const [x, y] = clockPoint(index * 30, 70);
        return (
          <text key={index} x={x} y={y} dy="0.35em" className="daily-orientation__clock-number">
            {index === 0 ? 12 : index}
          </text>
        );
      })}
      <line x1={CLOCK_C} y1={CLOCK_C + 12} x2={CLOCK_C} y2={CLOCK_C - 50} className="daily-orientation__clock-hand daily-orientation__clock-hand--hour" transform={`rotate(${hourRotation} ${CLOCK_C} ${CLOCK_C})`} />
      <line x1={CLOCK_C} y1={CLOCK_C + 16} x2={CLOCK_C} y2={CLOCK_C - 92} className="daily-orientation__clock-hand daily-orientation__clock-hand--minute" transform={`rotate(${minuteRotation} ${CLOCK_C} ${CLOCK_C})`} />
      <circle cx={CLOCK_C} cy={CLOCK_C} r="10" className="daily-orientation__clock-centre" />
      <circle cx={CLOCK_C} cy={CLOCK_C} r="3.5" className="daily-orientation__clock-centre-dot" />
    </svg>
  );
}

// "Десять часов ровно" and "двадцать три часа пятьдесят девять минут" have to
// share one fixed-size box, so the words start big and step down only as far
// as that particular time needs. Measured in the unscaled 1600x1000 canvas
// (offset/scroll sizes ignore the canvas transform), so it doesn't depend on
// the device's scale factor.
const TIME_WORDS_MAX_FONT = 52;
const TIME_WORDS_MIN_FONT = 30;

function useFitTimeWords(text) {
  const containerRef = useRef(null);
  const wordsRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const words = wordsRef.current;
    if (!container || !words) return undefined;

    function fit() {
      let size = TIME_WORDS_MAX_FONT;
      words.style.fontSize = `${size}px`;
      while (
        size > TIME_WORDS_MIN_FONT
        && (container.scrollHeight > container.clientHeight || words.scrollWidth > words.clientWidth)
      ) {
        size -= 2;
        words.style.fontSize = `${size}px`;
      }
    }

    fit();
    let cancelled = false;
    document.fonts?.ready.then(() => { if (!cancelled) fit(); });
    return () => { cancelled = true; };
  }, [text]);

  return { containerRef, wordsRef };
}

function DigitalClock({ now }) {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return (
    <output className="daily-orientation__digital-time" aria-label={`Цифровое время: ${formatDigitalClock(now)}`}>
      <span className="daily-orientation__digital-hours">{hours}</span>
      <span className="daily-orientation__digital-colon">:</span>
      <span className="daily-orientation__digital-minutes">{minutes}</span>
    </output>
  );
}

export default function DailyOrientationRenderer({ sessionParams, soundEnabled }) {
  const now = useCurrentTime();
  const { viewportRef, scale, width: canvasWidth, height: canvasHeight } = useDashboardScale();
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
  const hasTime = display.showAnalogClock || display.showTimeWords || display.showDigitalTime;
  const hideCurrentTime = offset !== 0;
  const timeWords = getClockWordParts(now);
  const timeWordsFit = useFitTimeWords(`${timeWords.hour} ${timeWords.minute}`);
  const timeCardClassName = [
    "daily-orientation__card",
    "daily-orientation__card--big",
    "daily-orientation__card--time",
    !display.showAnalogClock && !display.showDigitalTime ? "daily-orientation__card--time-no-dial" : "",
    !display.showTimeWords ? "daily-orientation__card--time-no-words" : "",
    !display.showAnalogClock && display.showDigitalTime ? "daily-orientation__card--time-no-clock" : "",
    hideCurrentTime ? "daily-orientation__card--time-hidden" : "",
  ].filter(Boolean).join(" ");
  const showTopRow = display.showWeekday || display.showDayOfMonth || display.showMonth;
  const showBottomRow = display.showWeather || display.showSeason || hasTime;

  function selectOffset(nextOffset) {
    setOffset(Math.max(-1, Math.min(1, nextOffset)));
  }

  const speakCard = useCallback((text) => {
    const now = Date.now();
    if (now - lastSpokenAtRef.current < SPEAK_COOLDOWN_MS) return;
    lastSpokenAtRef.current = now;
    speak(text);
  }, [speak]);

  function beginSwipe(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragStart.current = { x: event.clientX, pointerId: event.pointerId, captured: false };
  }

  // Capture only once the pointer is clearly travelling sideways. Capturing
  // on pointerdown (as this used to) makes the browser retarget the follow-up
  // click to the <nav> itself, so a plain tap on Вчера/Завтра never reached
  // its button -- only a swipe could change the day.
  function trackSwipe(event) {
    const start = dragStart.current;
    if (!start || start.captured || start.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - start.x) < 12) return;
    start.captured = true;
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
        <div className={`daily-orientation__canvas${display.showCarousel ? "" : " daily-orientation__canvas--without-carousel"}`} style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, transform: `scale(${scale})` }}>
          {display.showCarousel && (
            <nav
              className="daily-orientation__carousel"
              aria-label="Выберите: вчера, сегодня или завтра"
              onPointerDown={beginSwipe}
              onPointerMove={trackSwipe}
              onPointerUp={endSwipe}
              onPointerCancel={() => { dragStart.current = null; }}
            >
              {/* Every slot renders its chevrons and only the selected one
                  shows them (visibility, not mounting), so the brackets move
                  with the selection without the three labels shifting. */}
              {CAROUSEL_ITEMS.map((item) => (
                <span
                  className={`daily-orientation__carousel-slot${offset === item.offset ? " daily-orientation__carousel-slot--active" : ""}`}
                  key={item.offset}
                >
                  <Chevron direction="left" />
                  <button
                    type="button"
                    className={`daily-orientation__carousel-item${offset === item.offset ? " daily-orientation__carousel-item--active" : ""}`}
                    onClick={() => selectOffset(item.offset)}
                    aria-pressed={offset === item.offset}
                  >
                    {item.label}
                  </button>
                  <Chevron direction="right" />
                </span>
              ))}
            </nav>
          )}

          <div className="daily-orientation__grid" aria-live="polite">
            {showTopRow && (
              <div className="daily-orientation__row">
                {display.showWeekday && (
                  <article
                    className="daily-orientation__card daily-orientation__card--big daily-orientation__card--stacked daily-orientation__card--weekday daily-orientation__card--speakable"
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

                {display.showDayOfMonth && (
                  <article className="daily-orientation__card daily-orientation__card--narrow daily-orientation__card--stacked daily-orientation__card--date">
                    {soundEnabled && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenDate(activeDate, offset));
                      }} />
                    )}
                    <p className="daily-orientation__question">{CAPTION_DATE_NUMBER}</p>
                    <strong className="daily-orientation__date-number">{dayOfMonth}</strong>
                  </article>
                )}

                {display.showMonth && (
                  <article className="daily-orientation__card daily-orientation__card--wide daily-orientation__card--stacked daily-orientation__card--date">
                    {soundEnabled && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenMonth(activeDate, offset));
                      }} />
                    )}
                    <p className="daily-orientation__question">{CAPTION_MONTH}</p>
                    <strong className="daily-orientation__answer">{month}</strong>
                  </article>
                )}
              </div>
            )}

            {showBottomRow && (
              <div className="daily-orientation__row">
                {display.showWeather && (
                  <article
                    className={`daily-orientation__card daily-orientation__card--narrow daily-orientation__card--stacked daily-orientation__card--weather daily-orientation__card--speakable${hideCurrentTime ? " daily-orientation__card--weather-hidden" : ""}`}
                    role="button"
                    tabIndex={hideCurrentTime ? -1 : 0}
                    aria-hidden={hideCurrentTime}
                    onClick={() => setIsWeatherPickerOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setIsWeatherPickerOpen(true);
                    }}
                  >
                    {soundEnabled && weatherId && !hideCurrentTime && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenWeather(weatherId));
                      }} />
                    )}
                    <p className="daily-orientation__question">{CAPTION_WEATHER}</p>
                    <div className={`daily-orientation__weather-display${weatherId ? " daily-orientation__weather-display--set" : " daily-orientation__weather-display--unset"}`}>
                      {weatherId ? (
                        <>
                          <WeatherMark id={weatherId} />
                          <span>{WEATHER_LABEL_BY_ID[weatherId]}</span>
                        </>
                      ) : (
                        <span>Добавить</span>
                      )}
                    </div>
                  </article>
                )}

                {display.showSeason && (
                  <article className={`daily-orientation__card daily-orientation__card--wide daily-orientation__card--stacked daily-orientation__card--season daily-orientation__card--season-${season.id}`}>
                    <div className="daily-orientation__season-background" aria-hidden="true"><SeasonMark season={season} /></div>
                    {soundEnabled && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenSeason(activeDate, offset));
                      }} />
                    )}
                    <p className="daily-orientation__question">{CAPTION_SEASON}</p>
                    <strong className="daily-orientation__answer">{season.label}</strong>
                  </article>
                )}

                {hasTime && (
                  <article className={timeCardClassName} aria-hidden={hideCurrentTime}>
                    {soundEnabled && !hideCurrentTime && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenTime(now));
                      }} />
                    )}
                    {(display.showAnalogClock || display.showDigitalTime) && (
                      <div className="daily-orientation__time-dial">
                        {display.showAnalogClock && <AnalogClock now={now} />}
                        {display.showDigitalTime && <DigitalClock now={now} />}
                      </div>
                    )}
                    <div className="daily-orientation__time-readout" ref={timeWordsFit.containerRef}>
                      <p className="daily-orientation__question daily-orientation__question--time">{CAPTION_TIME}</p>
                      {display.showTimeWords && (
                        <strong className="daily-orientation__time-words" ref={timeWordsFit.wordsRef} aria-label={formatRussianClockTime(now)}>
                          <span className="daily-orientation__time-words-hour">{timeWords.hour}</span>
                          <span className="daily-orientation__time-words-minute">{timeWords.minute}</span>
                        </strong>
                      )}
                    </div>
                  </article>
                )}
              </div>
            )}
          </div>
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
