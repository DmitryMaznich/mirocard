import { useRef } from "react";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { DAYPART_HOUR_RANGES } from "@/topics/renderers/daily_orientation/timeUtils";

// One bar for the whole day, 0:00–24:00 (owner, 2026-11-24): утро, день,
// вечер, ночь (at both ends -- it runs over midnight), and a handle on each
// border, dragged in whole hours. A handle never passes its neighbour:
// утро < день < вечер < ночь. Arrow keys move a focused handle by an hour.

const ORDER = ["morning", "day", "evening", "night"];
const PARAM = { morning: "wakeHour", day: "dayHour", evening: "eveningHour", night: "bedHour" };

function limits(bounds, id) {
  const index = ORDER.indexOf(id);
  const [min, max] = DAYPART_HOUR_RANGES[id];
  const low = index > 0 ? bounds[ORDER[index - 1]] + 1 : min;
  const high = index < ORDER.length - 1 ? bounds[ORDER[index + 1]] - 1 : max;
  return [Math.max(min, low), Math.min(max, high)];
}

export default function DaypartBar({ bounds, onChange }) {
  const { t } = useUiTranslation();
  const barRef = useRef(null);
  const dragRef = useRef(null);

  function move(id, hour) {
    const [low, high] = limits(bounds, id);
    const next = Math.min(high, Math.max(low, hour));
    if (next !== bounds[id]) onChange({ [PARAM[id]]: next });
  }

  function hourAt(clientX) {
    const rect = barRef.current.getBoundingClientRect();
    return Math.round(((clientX - rect.left) / rect.width) * 24);
  }

  const segments = [
    { id: "night", from: 0, to: bounds.morning, edge: true },
    { id: "morning", from: bounds.morning, to: bounds.day },
    { id: "day", from: bounds.day, to: bounds.evening },
    { id: "evening", from: bounds.evening, to: bounds.night },
    { id: "night", from: bounds.night, to: 24, edge: true },
  ];
  const pct = (hour) => `${(hour / 24) * 100}%`;

  return (
    <div className="dos-daybar">
      <div className="dos-daybar__track" ref={barRef}>
        {segments.map((segment) => (
          <div
            key={`${segment.id}-${segment.from}`}
            className={`dos-daybar__part dos-dayline__part--${segment.id}`}
            style={{ left: pct(segment.from), width: pct(segment.to - segment.from) }}
          >
            {segment.to - segment.from >= (segment.edge ? 4 : 2) ? (
              <span className="dos-daybar__name">{t(`dailyDay.part.${segment.id}`)}</span>
            ) : null}
          </div>
        ))}
        {ORDER.map((id) => {
          const [low, high] = limits(bounds, id);
          return (
            <div
              key={id}
              role="slider"
              tabIndex={0}
              className={`dos-daybar__handle dos-daybar__handle--${ORDER.indexOf(id) % 2 ? "below" : "above"}`}
              style={{ left: pct(bounds[id]) }}
              aria-label={t(`dailyDay.from.${id}`)}
              aria-valuemin={low}
              aria-valuemax={high}
              aria-valuenow={bounds[id]}
              aria-valuetext={`${bounds[id]}:00`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                dragRef.current = { id, pointerId: event.pointerId };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                move(drag.id, hourAt(event.clientX));
              }}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
              onKeyDown={(event) => {
                const delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1
                  : event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 0;
                if (!delta) return;
                event.preventDefault();
                move(id, bounds[id] + delta);
              }}
            >
              <span className="dos-daybar__hour">{bounds[id]}:00</span>
            </div>
          );
        })}
      </div>
      <div className="dos-daybar__scale" aria-hidden="true">
        {[0, 6, 12, 18, 24].map((hour) => (
          <span key={hour} style={{ left: pct(hour) }}>{hour}</span>
        ))}
      </div>
    </div>
  );
}
