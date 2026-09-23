import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { addCalendarDays, formatDigitalClock, formatDisplayDate, formatRussianClockTime, getRelativePrompt, getSeason } from "./timeUtils";
import "./dailyOrientation.css";

const CAROUSEL_ITEMS = [
  { offset: -1, label: "Вчера" },
  { offset: 0, label: "Сегодня" },
  { offset: 1, label: "Завтра" },
];

const DISPLAY_OPTION_KEYS = [
  "showCarousel",
  "showWeekday",
  "showDayOfMonth",
  "showMonth",
  "showSeason",
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

export default function DailyOrientationRenderer({ sessionParams }) {
  const now = useCurrentTime();
  const { viewportRef, scale } = useDashboardScale();
  const [offset, setOffset] = useState(0);
  const dragStart = useRef(null);
  const display = resolveDisplayOptions(sessionParams);
  const activeDate = addCalendarDays(now, offset);
  const { weekday, month, dayOfMonth } = formatDisplayDate(activeDate);
  const season = getSeason(activeDate.getMonth());
  const hasDate = display.showDayOfMonth || display.showMonth;
  const hasTime = display.showAnalogClock || display.showTimeWords || display.showDigitalTime;
  const visibleCardCount = [display.showWeekday, hasDate, display.showSeason, hasTime].filter(Boolean).length;
  const timeCardClassName = [
    "daily-orientation__card",
    "daily-orientation__card--time",
    !display.showAnalogClock ? "daily-orientation__card--time-without-clock" : "",
    display.showAnalogClock && !display.showTimeWords && !display.showDigitalTime
      ? "daily-orientation__card--time-clock-only"
      : "",
  ].filter(Boolean).join(" ");

  function selectOffset(nextOffset) {
    setOffset(Math.max(-1, Math.min(1, nextOffset)));
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
              <article className="daily-orientation__card daily-orientation__card--weekday">
                <p className="daily-orientation__question">{getRelativePrompt(offset, "day")}</p>
                <strong className="daily-orientation__answer">{weekday}</strong>
              </article>
            )}

            {hasDate && (
              <article className={`daily-orientation__card daily-orientation__card--date${display.showDayOfMonth && display.showMonth ? "" : " daily-orientation__card--date-single"}`}>
                <h2 className="daily-orientation__card-title">Дата</h2>
                <div className={`daily-orientation__date-values${display.showDayOfMonth && display.showMonth ? "" : " daily-orientation__date-values--single"}`}>
                  {display.showDayOfMonth && (
                    <div className="daily-orientation__date-part">
                      <span className="daily-orientation__label">Число</span>
                      <strong className="daily-orientation__date-number">{dayOfMonth}</strong>
                    </div>
                  )}
                  {display.showDayOfMonth && display.showMonth && <div className="daily-orientation__date-divider" aria-hidden="true" />}
                  {display.showMonth && (
                    <div className="daily-orientation__date-part">
                      <span className="daily-orientation__label">Месяц</span>
                      <strong className="daily-orientation__date-month">{month}</strong>
                    </div>
                  )}
                </div>
              </article>
            )}

            {display.showSeason && (
              <article className={`daily-orientation__card daily-orientation__card--season daily-orientation__card--season-${season.id}`}>
                <SeasonMark season={season} />
                <div className="daily-orientation__season-copy">
                  <p className="daily-orientation__question">{getRelativePrompt(offset, "season")}</p>
                  <strong className="daily-orientation__answer">{season.label}</strong>
                </div>
              </article>
            )}

            {hasTime && (
              <article className={timeCardClassName}>
                {display.showAnalogClock && <AnalogClock now={now} />}
                {display.showTimeWords && (
                  <div className="daily-orientation__time-copy">
                    <p className="daily-orientation__question">Который сейчас час?</p>
                    <strong className="daily-orientation__time-words">{formatRussianClockTime(now)}</strong>
                  </div>
                )}
                {display.showDigitalTime && (
                  <output className="daily-orientation__digital-time" aria-label={`Цифровое время: ${formatDigitalClock(now)}`}>{formatDigitalClock(now)}</output>
                )}
              </article>
            )}
          </section>
        </div>
      </div>
      <div className="daily-orientation__rotate-notice" role="status">
        <svg viewBox="0 0 120 120" aria-hidden="true"><rect x="28" y="20" width="64" height="80" rx="10" /><path d="M99 60a39 39 0 0 1-35 38M21 60a39 39 0 0 1 35-38" /><path d="m91 88 7 10 10-7M29 32l-7-10-10 7" /></svg>
        <p>Поверните планшет горизонтально</p>
      </div>
    </main>
  );
}
