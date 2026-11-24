import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { formatDigitalClock } from "./timeUtils";

// After bedtime (the «Режим дня» bed hour, until the wake hour) the wall
// screen goes dark (owner, 2026-11-24): the bright cards would light up the
// flat at night and keep saying «day» things. Left: the same night
// pictogram as the «Сейчас» card, «НОЧЬ», a dim clock, and under «ПОТОМ» the
// next day's first event -- what comes after the night, the same «сначала →
// потом» the plan teaches. «Потом», not «утром»: the first event of a
// Saturday may well not be in the morning. A tap anywhere shows the usual
// screen for a minute (an adult checking something, a child who woke up).

export function NightScreen({ now, next, caseText, onWake }) {
  return (
    <button type="button" className="daily-orientation__night" onClick={onWake} aria-label="Ночь. Показать экран">
      <img className="daily-orientation__night-picture" src="/daily-orientation/daypart_night.webp" alt="" draggable="false" />
      <span className="daily-orientation__night-word">{caseText("Ночь")}</span>
      <span className="daily-orientation__night-clock">{formatDigitalClock(now)}</span>
      {next && (
        <span className="daily-orientation__night-next">
          <span className="daily-orientation__night-next-label">{caseText("Потом")}</span>
          {next.photo
            ? <AuthenticatedImage className="daily-orientation__night-next-photo" src={next.photo} alt="" draggable="false" />
            : next.icon && <span className="daily-orientation__night-next-icon" aria-hidden="true">{next.icon}</span>}
          <span className="daily-orientation__night-next-word">{caseText(next.text)}</span>
        </span>
      )}
    </button>
  );
}
