import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { useAppStore } from "@/core/store";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import {
  agePhrase,
  ageOn,
  cardPhoto,
  conversationQuestions,
  countdownPhrase,
  dayPhrase,
  eventPhotosFor,
  eventsOnDate,
  isBirthdayType,
  nearestCountdown,
  visibleImportantDates,
  yesterdayPhrase,
} from "@/features/importantDates/importantDates";
import {
  dateClipKeys,
  daypartClipKeys,
  monthClipKeys,
  seasonClipKeys,
  timeClipKeys,
  weekdayClipKeys,
} from "./audioBank.js";
import { clipsSupported, useClipPlayer } from "./clipPlayer.js";
import {
  addCalendarDays,
  formatDigitalClock,
  formatDisplayDate,
  formatRussianClockTime,
  DAYPARTS,
  DEFAULT_BED_HOUR,
  DEFAULT_WAKE_HOUR,
  getClockWordParts,
  getDaypartId,
  getLocalDateKey,
  getSeason,
  getSpokenDate,
  getSpokenDaypart,
  getSpokenMonth,
  getSpokenSeason,
  getSpokenTime,
  getSpokenWeekday,
  getSpokenClockWordParts,
  parseWeeklyPlan,
  splitPlanIcon,
  spokenClockSentence,
} from "./timeUtils";
import { DateContent, DaypartContent, MonthContent, SeasonContent, WeekContent } from "./ConceptModals.jsx";
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

// How people actually say it: "Сегодня солнечно", "Сегодня идёт дождь",
// "Сегодня туман". (These were "погода солнечная/дождливая" adjectives --
// grammatical, but nobody talks like that, and a child learns the phrase
// they hear.) Spoken with browser TTS: the recorded clips still say the old
// adjective form, so they're no longer used for this card.
const WEATHER_OPTIONS = [
  { id: "sunny", label: "СОЛНЕЧНО" },
  { id: "cloudy", label: "ПАСМУРНО" },
  { id: "rain", label: "ИДЁТ ДОЖДЬ" },
  { id: "snow", label: "ИДЁТ СНЕГ" },
  { id: "fog", label: "ТУМАН" },
];
const WEATHER_LABEL_BY_ID = Object.fromEntries(WEATHER_OPTIONS.map((o) => [o.id, o.label]));

// Answers on the cards are written in capitals by default; "sentence" case
// ("Среда", "Октябрь") is for a child who reads whole words and would see
// "СРЕДА" here and "Среда" in the modals as two different words.
function makeCaseText(sentenceCase) {
  return (text) => {
    const value = String(text ?? "");
    if (!sentenceCase) return value.toLocaleUpperCase("ru-RU");
    const lower = value.toLocaleLowerCase("ru-RU");
    return lower.charAt(0).toLocaleUpperCase("ru-RU") + lower.slice(1);
  };
}

function getSpokenWeather(weatherId) {
  return `Сегодня ${WEATHER_LABEL_BY_ID[weatherId].toLowerCase()}.`;
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

// The adult asks the question out loud in person; the card captions just name
// what's being shown, so they stay plain nominative labels regardless of the
// carousel offset (the carousel pill is what shows which day is selected).
const CAPTION_WEEKDAY = "День недели";
const CAPTION_DATE_NUMBER = "Число";
const CAPTION_MONTH = "Месяц";
const CAPTION_SEASON = "Время года";
const CAPTION_WEATHER = "Погода";
// "Сейчас — УТРО": caption and answer read as the phrase itself (and match
// the speaker's "Сейчас утро."). "Сутки" is an abstract word nobody uses
// with a child, and the clock card's "Время" doesn't clash: about the clock
// people ask "Сколько время?", without "сейчас". The concept modal keeps
// the name "Время суток" for the whole утро-день-вечер-ночь cycle.
const CAPTION_DAYPART = "Сейчас";
const CAPTION_TIME = "Время";

const DISPLAY_OPTION_KEYS = [
  "showCarousel",
  "showWeekday",
  "showDayOfMonth",
  "showMonth",
  "showSeason",
  "showDaypart",
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

const CONCEPT_MODAL_LABELS = {
  week: "Дни недели",
  date: "Календарь месяца",
  month: "Месяцы",
  season: "Времена года",
  daypart: "Время суток",
};

function DailyOrientationModal({ label, onClose, children }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, MODAL_IDLE_CLOSE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [onClose]);

  return (
    <div
      className="daily-orientation__modal-backdrop"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="daily-orientation__modal" role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="daily-orientation__modal-close" onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
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
const TIME_WORDS_MAX_FONT = 64;
const TIME_WORDS_MIN_FONT = 24;

// Runs a fit function now and again whenever the result could have gone
// stale: a web font finishing loading (the app loads Nunito lazily, so the
// first measurement can be taken with the fallback font -- on iPad that's the
// narrower Helvetica, so words sized to fit it overflowed once Nunito
// arrived) or the measured box changing size.
function useRefit(fit, observedRef, deps) {
  useLayoutEffect(() => {
    fit();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const fonts = typeof document === "undefined" ? null : document.fonts;
    fonts?.ready.then(schedule);
    fonts?.addEventListener?.("loadingdone", schedule);
    const observer = typeof ResizeObserver === "undefined" || !observedRef.current
      ? null
      : new ResizeObserver(schedule);
    observer?.observe(observedRef.current);
    return () => {
      cancelAnimationFrame(frame);
      fonts?.removeEventListener?.("loadingdone", schedule);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function useFitTimeWords(text) {
  const containerRef = useRef(null);
  const wordsRef = useRef(null);

  // Re-run on every minute change (text), web-font load and resize: find the
  // LARGEST size at which every word fits the column's width and all lines
  // fit its height -- so "ДЕСЯТЬ ЧАСОВ РОВНО" fills the card and
  // "ЧЕТЫРНАДЦАТЬ ЧАСОВ ТРИДЦАТЬ ПЯТЬ МИНУТ" steps down just as far as it
  // must. The CSS size on .daily-orientation__time-words is only the
  // no-JS fallback; this inline size overrides it.
  useRefit(() => {
    const container = containerRef.current;
    const words = wordsRef.current;
    if (!container || !words) return;
    const fits = (size) => {
      words.style.fontSize = `${size}px`;
      // Height is checked on the column only: the words box itself always
      // "overflows" by a few px vertically (Д/Ц descend below the line box).
      return container.scrollHeight <= container.clientHeight && words.scrollWidth <= words.clientWidth;
    };
    let low = TIME_WORDS_MIN_FONT;
    let high = TIME_WORDS_MAX_FONT;
    if (fits(high)) return;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (fits(mid)) low = mid;
      else high = mid;
    }
    words.style.fontSize = `${low}px`;
  }, containerRef, [text]);

  return { containerRef, wordsRef };
}

// One-line answer word that shrinks to fit its card instead of breaking
// mid-word: with four cards in the calendar row, "ПОНЕДЕЛЬНИК" or "СЕНТЯБРЬ"
// at the CSS size would overflow a narrower card. Starts from the element's
// own CSS font-size every time the text changes (so a short word goes back
// to full size), measured in the unscaled canvas like useFitTimeWords.
const FIT_TEXT_MIN_FONT = 28;

function FitText({ className, children }) {
  const ref = useRef(null);

  useRefit(() => {
    const element = ref.current;
    if (!element) return;
    {
      element.style.fontSize = "";
      let size = parseFloat(window.getComputedStyle(element).fontSize) || 0;
      while (size > FIT_TEXT_MIN_FONT && element.scrollWidth > element.clientWidth) {
        size -= 2;
        element.style.fontSize = `${size}px`;
      }
    }
  }, ref, [children]);

  return (
    <strong
      className={`${className} daily-orientation__fit-text`}
      ref={ref}
      style={{ "--fit-chars": String(children).length }}
    >
      {children}
    </strong>
  );
}

function DaypartCard({ daypartId, hidden, speakerButton, cardProps, caseText }) {
  return (
    <article
      className={`daily-orientation__card daily-orientation__card--daypart daily-orientation__card--daypart-${daypartId} daily-orientation__card--speakable${hidden ? " daily-orientation__card--daypart-hidden" : ""}`}
      aria-hidden={hidden}
      {...(hidden ? {} : cardProps)}
    >
      {speakerButton}
      <p className="daily-orientation__question">{CAPTION_DAYPART}</p>
      <img className="daily-orientation__daypart-picture" src={`/daily-orientation/daypart_${daypartId}.webp`} alt="" draggable="false" />
      {/* The whole cycle, current part emphasised: shows both "what now" and
          what comes before/after, the same idea as вчера→сегодня→завтра. */}
      <ol className="daily-orientation__daypart-strip">
        {DAYPARTS.map((part) => (
          <li
            key={part.id}
            className={`daily-orientation__daypart-step${part.id === daypartId ? " daily-orientation__daypart-step--current" : ""}`}
            aria-current={part.id === daypartId ? "true" : undefined}
          >
            {caseText(part.label)}
          </li>
        ))}
      </ol>
    </article>
  );
}

function longestWordLength(text) {
  return Math.max(...text.split(/\s+/).map((word) => word.length));
}

// ── Важные даты ─────────────────────────────────────────────────────
// A day from the student's "Важные даты" is marked on the screen itself: a
// ribbon under the carousel with the photo and one sentence ("Сегодня день
// рождения мамы!"), and -- in the "Празднично" style -- a garland and a warm
// background, so the difference is visible from across the room. In the
// days before it, a quieter ribbon counts down. Nothing animates and
// nothing plays on its own: a sudden change to a familiar screen can upset
// a child, and the countdown is there so the day doesn't come as a surprise.
// No speaker on the ribbons, deliberately: the screen is always used with
// an adult, and saying the sentence is the child's job, not the tablet's.

const GARLAND_COLORS = ["#f59e0b", "#4a9b8f", "#e8684a", "#3b82f6", "#a855f7", "#22c55e"];
const GARLAND_FLAGS = 23;
const MAX_CANDLES = 12;

function Garland({ width }) {
  const sag = 38;
  const flags = Array.from({ length: GARLAND_FLAGS }, (_, index) => {
    const x = 20 + index * ((width - 40) / (GARLAND_FLAGS - 1));
    const t = x / width;
    const y = 8 + 4 * sag * t * (1 - t);
    return <path key={index} d={`M${x - 18} ${y} L${x + 18} ${y} L${x} ${y + 40} Z`} fill={GARLAND_COLORS[index % GARLAND_COLORS.length]} />;
  });
  return (
    <svg className="daily-orientation__garland" viewBox={`0 0 ${width} 70`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0 8 Q${width / 2} ${8 + 2 * sag} ${width} 8`} fill="none" stroke="#b9a68a" strokeWidth="3" />
      {flags}
    </svg>
  );
}

function ImportantPicture({ item, photo, className }) {
  return (
    <span className={`${className} daily-orientation__important-picture--${item.type}`} aria-hidden="true">
      {photo ? <AuthenticatedImage src={photo} alt="" draggable="false" /> : <span>{item.icon}</span>}
    </span>
  );
}

function Candle({ lit }) {
  return (
    <svg className={`daily-orientation__candle${lit ? " daily-orientation__candle--lit" : ""}`} viewBox="0 0 24 56" aria-hidden="true">
      {lit && <path className="daily-orientation__candle-flame" d="M12 2c3.5 5 5 8 5 11a5 5 0 0 1-10 0c0-3 1.5-6 5-11Z" />}
      <rect className="daily-orientation__candle-wick" x="11" y="17" width="2" height="5" rx="1" />
      <rect className="daily-orientation__candle-body" x="5" y="22" width="14" height="32" rx="3" />
    </svg>
  );
}

function AskButton({ onClick }) {
  return (
    <button type="button" className="daily-orientation__ask" onClick={onClick} aria-label="Вопросы для разговора">?</button>
  );
}

// The day's photos (added afterwards in "Важные даты") as a small strip;
// a tap opens them large for retelling.
function EventPhotoStrip({ photos, onOpen }) {
  if (!photos.length) return null;
  const shown = photos.slice(0, 3);
  return (
    <button type="button" className="daily-orientation__important-photos" onClick={onOpen} aria-label={`Фото с этого дня: ${photos.length}`}>
      {shown.map((photo) => <AuthenticatedImage key={photo} src={photo} alt="" draggable="false" />)}
      {photos.length > shown.length && <span className="daily-orientation__important-photos-more">+{photos.length - shown.length}</span>}
    </button>
  );
}

// offset -1 is the day after: a calmer ribbon ("Вчера был день рождения
// мамы") with the photos from it, for "Что мы делали?".
function ImportantDayRibbon({ events, offset, date, pictureFor, onAsk, onOpenPhotos }) {
  const past = offset < 0;
  return (
    <section
      className={`daily-orientation__important daily-orientation__important--day${past ? " daily-orientation__important--past" : ""}${events.length > 1 ? " daily-orientation__important--double" : ""}`}
      aria-label={past ? "Вчера был важный день" : "Важный день"}
    >
      {events.map((item) => {
        const age = !past && item.type === "own_birthday" ? ageOn(item, date) : null;
        const photo = pictureFor(item);
        const photos = eventPhotosFor(item, date.getFullYear());
        const eyebrow = past ? "Вчера был важный день" : offset > 0 ? "Завтра важный день" : "Важный день";
        return (
          <div key={item.id} className="daily-orientation__important-event">
            <span className="daily-orientation__important-frame">
              <ImportantPicture item={item} photo={photo} className="daily-orientation__important-picture" />
              {!past && item.type === "own_birthday" && <span className="daily-orientation__important-crown" aria-hidden="true">👑</span>}
              {!past && item.type === "birthday" && (
                <>
                  <span className="daily-orientation__important-balloon daily-orientation__important-balloon--a" aria-hidden="true">🎈</span>
                  <span className="daily-orientation__important-balloon daily-orientation__important-balloon--b" aria-hidden="true">🎈</span>
                </>
              )}
            </span>
            <div className="daily-orientation__important-copy">
              <p className="daily-orientation__important-eyebrow">{eyebrow}</p>
              <p className="daily-orientation__important-phrase">
                {past ? (yesterdayPhrase(item) ?? item.title) : dayPhrase(item, offset)}
                {age && offset === 0 && <span className="daily-orientation__important-age"> {agePhrase(item, date)}</span>}
              </p>
            </div>
            {photos.length > 0 ? (
              <EventPhotoStrip photos={photos} onOpen={() => onOpenPhotos(photos)} />
            ) : age && offset === 0 && age <= MAX_CANDLES ? (
              <span className="daily-orientation__important-candles" aria-hidden="true">
                {Array.from({ length: age }, (_, index) => <Candle key={index} lit />)}
              </span>
            ) : !past && events.length === 1 && isBirthdayType(item) && photo ? (
              <span className="daily-orientation__important-cake" aria-hidden="true">🎂</span>
            ) : null}
          </div>
        );
      })}
      <AskButton onClick={onAsk} />
    </section>
  );
}

function QuestionsContent({ groups }) {
  return (
    <div className="daily-orientation__questions">
      <h2 className="daily-orientation__questions-title">Вопросы для разговора</h2>
      <p className="daily-orientation__questions-lead">Спросите ребёнка — отвечает он сам. Под вопросом — над чем он работает.</p>
      {groups.map(({ title, questions }) => (
        <section key={title} className="daily-orientation__questions-group">
          {groups.length > 1 && <h3>{title}</h3>}
          <ol>
            {questions.map(({ question, hint }) => (
              <li key={question}>
                <strong>{question}</strong>
                <span>{hint}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function PhotoViewer({ photos }) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  return (
    <div className="daily-orientation__viewer">
      <AuthenticatedImage className="daily-orientation__viewer-photo" src={photos[index]} alt={`Фото ${index + 1} из ${count}`} draggable="false" />
      {count > 1 && (
        <div className="daily-orientation__viewer-nav">
          <button type="button" onClick={() => setIndex((index - 1 + count) % count)} aria-label="Предыдущее фото"><Chevron direction="left" /></button>
          <span>{index + 1} / {count}</span>
          <button type="button" onClick={() => setIndex((index + 1) % count)} aria-label="Следующее фото"><Chevron direction="right" /></button>
        </div>
      )}
    </div>
  );
}

function CountdownRibbon({ countdown, picture, onAsk }) {
  const { item, daysLeft } = countdown;
  const { title, when } = countdownPhrase(item, daysLeft);
  const total = item.countdownDays;
  const birthday = isBirthdayType(item);
  return (
    <section className="daily-orientation__important daily-orientation__important--countdown" aria-label={`${title} — ${when}`}>
      <ImportantPicture item={item} photo={picture} className="daily-orientation__important-picture daily-orientation__important-picture--small" />
      <p className="daily-orientation__countdown-text">
        <span className="daily-orientation__countdown-title">{title}</span>{" "}
        <b className="daily-orientation__countdown-when">{when}</b>
      </p>
      {/* One mark per day of the countdown; one goes out each morning, so
          what's left is the number of marks still lit. Candles for a
          birthday, plain dots for everything else. */}
      <ol className={`daily-orientation__countdown-marks${total > 7 ? " daily-orientation__countdown-marks--many" : ""}`} aria-hidden="true">
        {Array.from({ length: total }, (_, index) => {
          const lit = index >= total - daysLeft;
          return (
            <li key={index} className="daily-orientation__countdown-mark">
              {birthday ? <Candle lit={lit} /> : <span className={`daily-orientation__countdown-dot${lit ? " daily-orientation__countdown-dot--lit" : ""}`} />}
            </li>
          );
        })}
        <li className="daily-orientation__countdown-goal">{birthday ? "🎂" : item.icon}</li>
      </ol>
      <AskButton onClick={onAsk} />
    </section>
  );
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
  const { play: playClips } = useClipPlayer();
  const [offset, setOffset] = useState(0);
  // Which concept modal is open: "week" | "date" | "month" | "season" | "daypart" | null.
  const [openConcept, setOpenConcept] = useState(null);
  // Questions for the adult ({ groups }) or the day's photos (string[]).
  const [questionsFor, setQuestionsFor] = useState(null);
  const [viewerPhotos, setViewerPhotos] = useState(null);
  const [isWeatherPickerOpen, setIsWeatherPickerOpen] = useState(false);
  const dragStart = useRef(null);
  const lastSpokenAtRef = useRef(0);
  const display = resolveDisplayOptions(sessionParams);
  // Card speakers are off unless the adult switches them on: the screen is
  // always used with an adult and the child says the answer. They're for a
  // child who can't say it -- then the speaker is the child's voice (AAC).
  const cardSound = soundEnabled && sessionParams?.cardSound === true;
  const weeklyPlan = parseWeeklyPlan(sessionParams?.weeklyPlan);
  const { weatherId, selectWeather } = useTodaysWeather(getLocalDateKey(now));
  const activeDate = addCalendarDays(now, offset);
  const student = useAppStore((state) => state.students.find((candidate) => candidate.id === state.activeStudentId) ?? null);
  const datesStyle = sessionParams?.importantDatesStyle ?? "bright";
  const importantDates = datesStyle === "off" ? [] : visibleImportantDates(student?.importantDates);
  // Today is festive; tomorrow previews it; yesterday gets a calm "Вчера был …".
  const dayEvents = eventsOnDate(importantDates, activeDate).slice(0, 2);
  const countdown = offset === 0 && !dayEvents.length ? nearestCountdown(importantDates, now) : null;
  const isFestive = offset >= 0 && dayEvents.length > 0 && datesStyle === "bright";
  const importantPicture = (item) => cardPhoto(item, student?.myPeople) ?? (item.type === "own_birthday" ? student?.photo ?? null : null);
  const { weekday, month } = formatDisplayDate(activeDate);
  // Plain number on the card, no "-е": a child reads the "е" as a letter.
  // The ordinal is heard (the speaker says "двадцать девятое") and the
  // written "29 сентября" form lives in the Число modal.
  const dayOfMonth = String(activeDate.getDate());
  const season = getSeason(activeDate.getMonth());
  const hasTime = display.showAnalogClock || display.showTimeWords || display.showDigitalTime;
  const hideCurrentTime = offset !== 0;
  const sentenceCase = sessionParams?.letterCase === "sentence";
  const caseText = makeCaseText(sentenceCase);
  // "exact": "девять часов двадцать минут" (24-hour, hour first);
  // "spoken": "двадцать минут десятого" -- how it's said at home.
  const spokenTime = sessionParams?.timeWordsStyle === "spoken";
  const timeWords = spokenTime ? getSpokenClockWordParts(now) : getClockWordParts(now);
  const timeWordsMinuteFirst = spokenTime && timeWords.minute !== "ровно";
  const timeWordsText = timeWordsMinuteFirst ? `${timeWords.minute} ${timeWords.hour}` : `${timeWords.hour} ${timeWords.minute}`;
  const timeWordsFit = useFitTimeWords(timeWordsText);
  // On Вчера/Завтра the month and season usually haven't changed: they're
  // dimmed so the change that matters (day, date) stands out, and "Вчера был
  // октябрь" isn't offered as a sentence.
  const monthUnchanged = offset !== 0 && activeDate.getMonth() === now.getMonth();
  const seasonUnchanged = offset !== 0 && season.id === getSeason(now.getMonth()).id;
  // What that day held, from the weekly plan -- fills the "right now" row,
  // which has nothing to show on Вчера/Завтра.
  const dayPlan = offset !== 0 ? weeklyPlan[activeDate.getDay()] ?? null : null;
  const timeCardClassName = [
    "daily-orientation__card",
    "daily-orientation__card--big",
    "daily-orientation__card--time",
    !display.showAnalogClock && !display.showDigitalTime ? "daily-orientation__card--time-no-dial" : "",
    !display.showTimeWords ? "daily-orientation__card--time-no-words" : "",
    !display.showAnalogClock && display.showDigitalTime ? "daily-orientation__card--time-no-clock" : "",
    hideCurrentTime ? "daily-orientation__card--time-hidden" : "",
  ].filter(Boolean).join(" ");
  const wakeHour = Number(sessionParams?.wakeHour ?? DEFAULT_WAKE_HOUR);
  const bedHour = Number(sessionParams?.bedHour ?? DEFAULT_BED_HOUR);
  const daypartId = getDaypartId(now, wakeHour, bedHour);
  // Calendar row (slow-changing: day, date, month, season) over a "right
  // now" row (part of day, weather, clock) -- the simpler Время суток sits
  // next to the harder clock it helps explain.
  const showTopRow = display.showWeekday || display.showDayOfMonth || display.showMonth || display.showSeason;
  const showBottomRow = display.showDaypart || display.showWeather || hasTime;

  // Tap anywhere on a card (but its speaker button) to open that concept's
  // modal. Same props for every card so they all behave alike.
  function conceptCardProps(concept) {
    return {
      role: "button",
      tabIndex: 0,
      onClick: () => setOpenConcept(concept),
      onKeyDown: (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setOpenConcept(concept);
      },
    };
  }
  const closeConcept = useCallback(() => setOpenConcept(null), []);
  const closeQuestions = useCallback(() => setQuestionsFor(null), []);
  const closeViewer = useCallback(() => setViewerPhotos(null), []);

  function selectOffset(nextOffset) {
    setOffset(Math.max(-1, Math.min(1, nextOffset)));
  }

  // Recorded Kore clips first (see audioBank.js); browser TTS of the same
  // sentence only if the clips can't play here (no Web Audio, a file missing).
  const speakCard = useCallback((text, clipKeys) => {
    const now = Date.now();
    if (now - lastSpokenAtRef.current < SPEAK_COOLDOWN_MS) return;
    lastSpokenAtRef.current = now;
    if (!clipKeys || !clipsSupported()) {
      speak(text);
      return;
    }
    playClips(clipKeys).then((played) => {
      if (!played) speak(text);
    });
  }, [speak, playClips]);

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
    <main className={`daily-orientation${isFestive ? " daily-orientation--festive" : ""}${sentenceCase ? " daily-orientation--sentence-case" : ""}`} aria-label="Экран ориентации во времени">
      <div className="daily-orientation__viewport" ref={viewportRef}>
        <div className={`daily-orientation__canvas${display.showCarousel ? "" : " daily-orientation__canvas--without-carousel"}`} style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, transform: `scale(${scale})` }}>
          {isFestive && <Garland width={canvasWidth} />}
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

          {dayEvents.length > 0 && (
            <ImportantDayRibbon
              events={dayEvents}
              offset={offset}
              date={activeDate}
              pictureFor={importantPicture}
              onOpenPhotos={setViewerPhotos}
              onAsk={() => setQuestionsFor({
                groups: dayEvents.map((item) => ({
                  title: item.title,
                  questions: conversationQuestions(item, {
                    when: offset < 0 ? "yesterday" : offset > 0 ? "tomorrow" : "today",
                    age: item.type === "own_birthday" ? ageOn(item, activeDate) : null,
                  }),
                })),
              })}
            />
          )}
          {countdown && (
            <CountdownRibbon
              countdown={countdown}
              picture={importantPicture(countdown.item)}
              onAsk={() => setQuestionsFor({
                groups: [{ title: countdown.item.title, questions: conversationQuestions(countdown.item, { when: "countdown", daysLeft: countdown.daysLeft }) }],
              })}
            />
          )}

          <div className="daily-orientation__grid" aria-live="polite">
            {showTopRow && (
              <div className="daily-orientation__row">
                {display.showWeekday && (
                  <article
                    className="daily-orientation__card daily-orientation__card--big daily-orientation__card--stacked daily-orientation__card--weekday daily-orientation__card--speakable"
                    {...conceptCardProps("week")}
                  >
                    {cardSound && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenWeekday(activeDate, offset), weekdayClipKeys(activeDate, offset));
                      }} />
                    )}
                    <p className="daily-orientation__question">{CAPTION_WEEKDAY}</p>
                    <FitText className="daily-orientation__answer">{caseText(weekday)}</FitText>
                  </article>
                )}

                {display.showDayOfMonth && (
                  <article className="daily-orientation__card daily-orientation__card--narrow daily-orientation__card--stacked daily-orientation__card--date daily-orientation__card--speakable" {...conceptCardProps("date")}>
                    {cardSound && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenDate(activeDate, offset), dateClipKeys(activeDate, offset));
                      }} />
                    )}
                    <p className="daily-orientation__question">{CAPTION_DATE_NUMBER}</p>
                    <FitText className="daily-orientation__date-number">{dayOfMonth}</FitText>
                    {dayEvents.length > 0 && (
                      <span className="daily-orientation__date-mark" aria-hidden="true">{isBirthdayType(dayEvents[0]) ? "🎂" : dayEvents[0].icon}</span>
                    )}
                  </article>
                )}

                {display.showMonth && (
                  <article className={`daily-orientation__card daily-orientation__card--wide daily-orientation__card--stacked daily-orientation__card--date daily-orientation__card--speakable${monthUnchanged ? " daily-orientation__card--unchanged" : ""}`} {...conceptCardProps("month")}>
                    {cardSound && !monthUnchanged && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenMonth(activeDate, offset), monthClipKeys(activeDate, offset));
                      }} />
                    )}
                    <p className="daily-orientation__question">{CAPTION_MONTH}</p>
                    <FitText className="daily-orientation__answer">{caseText(month)}</FitText>
                  </article>
                )}

                {display.showSeason && (
                  <article className={`daily-orientation__card daily-orientation__card--wide daily-orientation__card--stacked daily-orientation__card--season daily-orientation__card--season-${season.id} daily-orientation__card--speakable${seasonUnchanged ? " daily-orientation__card--unchanged" : ""}`} {...conceptCardProps("season")}>
                    {/* Illustration on the top two thirds, muted; the band
                        underneath carries a small "Время года" over the
                        season's name (the caption on the picture itself read
                        as clutter). */}
                    <div className="daily-orientation__season-picture" aria-hidden="true">
                      <img src={`/daily-orientation/season_${season.id}.webp`} alt="" draggable="false" />
                    </div>
                    {cardSound && !seasonUnchanged && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenSeason(activeDate, offset), seasonClipKeys(activeDate, offset));
                      }} />
                    )}
                    <div className="daily-orientation__season-band">
                      <p className="daily-orientation__season-caption">{CAPTION_SEASON}</p>
                      <FitText className="daily-orientation__answer">{caseText(season.label)}</FitText>
                    </div>
                  </article>
                )}
              </div>
            )}

            {dayPlan && (
              <div className="daily-orientation__row">
                <article className="daily-orientation__card daily-orientation__card--plan" {...conceptCardProps("week")}>
                  <p className="daily-orientation__question">{offset < 0 ? "Что было вчера" : "Что будет завтра"}</p>
                  <div className="daily-orientation__plan">
                    {splitPlanIcon(dayPlan).icon && <span className="daily-orientation__plan-icon" aria-hidden="true">{splitPlanIcon(dayPlan).icon}</span>}
                    <FitText className="daily-orientation__answer">{caseText(splitPlanIcon(dayPlan).text)}</FitText>
                  </div>
                </article>
              </div>
            )}

            {showBottomRow && !dayPlan && (
              <div className="daily-orientation__row">
                {display.showDaypart && (
                  <DaypartCard
                    daypartId={daypartId}
                    caseText={caseText}
                    hidden={hideCurrentTime}
                    cardProps={conceptCardProps("daypart")}
                    speakerButton={cardSound && !hideCurrentTime && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        speakCard(getSpokenDaypart(daypartId), daypartClipKeys(daypartId));
                      }} />
                    )}
                  />
                )}

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
                    {cardSound && weatherId && !hideCurrentTime && (
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
                          <span>{caseText(WEATHER_LABEL_BY_ID[weatherId])}</span>
                        </>
                      ) : (
                        <>
                          <span className="daily-orientation__weather-unset-mark" aria-hidden="true">?</span>
                          <span className="daily-orientation__weather-unset-label">Отметить</span>
                        </>
                      )}
                    </div>
                  </article>
                )}

                {hasTime && (
                  <article className={timeCardClassName} aria-hidden={hideCurrentTime}>
                    {cardSound && !hideCurrentTime && (
                      <SpeakerButton onClick={(event) => {
                        event.stopPropagation();
                        if (spokenTime) speakCard(`Сейчас ${spokenClockSentence(now)}.`);
                        else speakCard(getSpokenTime(now), timeClipKeys(now));
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
                        <strong
                          className="daily-orientation__time-words"
                          ref={timeWordsFit.wordsRef}
                          aria-label={spokenTime ? spokenClockSentence(now) : formatRussianClockTime(now)}
                          style={{ "--fit-chars": longestWordLength(timeWordsText) }}
                        >
                          {/* Hour half in the hour hand's colour, minute half in the
                              minute hand's; "двадцать минут десятого" puts the
                              minute half first. Only the first word is
                              capitalised in sentence case. */}
                          {(timeWordsMinuteFirst ? ["minute", "hour"] : ["hour", "minute"]).map((part, index) => (
                            <span key={part} className={`daily-orientation__time-words-${part}`}>
                              {index === 0 || !sentenceCase ? caseText(timeWords[part]) : timeWords[part]}
                            </span>
                          ))}
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
      {openConcept && (
        <DailyOrientationModal label={CONCEPT_MODAL_LABELS[openConcept]} onClose={closeConcept}>
          {openConcept === "week" && <WeekContent activeDate={activeDate} today={now} plan={weeklyPlan} importantDates={importantDates} />}
          {openConcept === "date" && <DateContent activeDate={activeDate} offset={offset} today={now} importantDates={importantDates} />}
          {openConcept === "month" && <MonthContent activeDate={activeDate} />}
          {openConcept === "season" && <SeasonContent activeDate={activeDate} />}
          {openConcept === "daypart" && <DaypartContent daypartId={daypartId} wakeHour={wakeHour} bedHour={bedHour} />}
        </DailyOrientationModal>
      )}
      {questionsFor && (
        <DailyOrientationModal label="Вопросы для разговора" onClose={closeQuestions}>
          <QuestionsContent groups={questionsFor.groups} />
        </DailyOrientationModal>
      )}
      {viewerPhotos && (
        <DailyOrientationModal label="Фото с этого дня" onClose={closeViewer}>
          <PhotoViewer photos={viewerPhotos} />
        </DailyOrientationModal>
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
