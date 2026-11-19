import { useEffect, useId, useRef, useState } from "react";
import { TUG_FINISH, tugPullDirection } from "./raceEngine";
import "./tug.css";

const SCENE_WIDTH = 1040;
const CENTER = SCENE_WIDTH / 2;
const DIVISION = 12;
const MARKS = Array.from({ length: TUG_FINISH * 2 + 1 }, (_, i) => i - TUG_FINISH);
const COLORS = ["#e77868", "#369c9a"];

function Puller({ x, player, effort, stride }) {
  const adult = player === 1;
  const scale = adult ? 1.63 : 1.45;
  const shirt = COLORS[player];
  const skin = adult ? "#e5b58e" : "#f3c6a0";
  const hair = adult ? "#634231" : "#855037";
  const gripY = adult ? -76 : -85;
  return <g className="tug-puller" data-player={player} transform={`translate(${x} 435) scale(${adult ? -scale : scale} ${scale})`}>
    <ellipse cy="4" rx="43" ry="7" fill="#405443" opacity=".13" />
    <path d={`M-12-52 -24-22 ${-36 + stride}-3 M12-52 23-23 ${28 - stride}-4`} stroke="#50627b" strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={`M${-42 + stride}-2h18m${44 - 2 * stride} 0h17`} stroke="#283b54" strokeWidth="9" strokeLinecap="round" />
    <path d={`M${-42 + stride} 2h18m${44 - 2 * stride} 0h17`} stroke="#fff8ed" strokeWidth="2" strokeLinecap="round" />
    <g transform={`rotate(${-5 - effort * 5} 0 -55)`}>
      <path d="M-27-57q2-44 12-53l30-2q13 11 14 54l-6 7h-46z" fill={shirt} />
      <path d="M-18-94q-4 13-4 31" stroke="#fff7e8" strokeWidth="4" opacity=".32" fill="none" strokeLinecap="round" />
      <path d="M-5-119v13q8 7 17-1v-13" fill={skin} />
      <path d="M-25-146q-3-28 24-30 28-2 30 25l6 12q1 4-6 5-4 18-24 20-28-1-30-32z" fill={skin} />
      <path d="M-25-142q-11-21 3-32 12-12 29-7 15-6 23-12 9 16-2 25-9 7-22 0-10 16-22 14l-2 13z" fill={hair} />
      <path d="M-22-170q16-14 32-7" stroke="#ad7751" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".65" />
      <ellipse cx="-19" cy="-141" rx="7" ry="9" fill={skin} />
      <path d="M-21-144q6-3 5 5" stroke="#ce9477" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="19" cy="-145" rx="6" ry="8" fill="#fffdf7" />
      <ellipse cx="21" cy="-144" rx="3.2" ry="4.7" fill="#654432" /><circle cx="22" cy="-146" r="1.1" fill="#fffdf7" />
      <path d="M12-157q7-4 13-1" stroke={hair} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="15" cy="-131" rx="7" ry="3.5" fill="#e99481" opacity=".3" />
      {adult && <path d="M-13-126q8 4 13-1 12 7 23-8-1 19-20 20-11-1-16-11z" fill={hair} opacity=".78" />}
      <path d="M13-130q6 5 12-1" stroke={adult ? "#5b3c2b" : "#ab6652"} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
    <path d={`M-3-96 Q${15 - effort * 5}-65 42 ${gripY}`} stroke="#d9a281" strokeWidth="11" strokeLinecap="round" fill="none" />
    <path d={`M12-94 Q${24 - effort * 6}-65 47 ${gripY}`} stroke={skin} strokeWidth="12" strokeLinecap="round" fill="none" />
    <ellipse cx="47" cy={gripY} rx="7" ry="6" fill={skin} />
    <path d={`M44 ${gripY-3}v5m3-5v5m3-5v4`} stroke="#ce9477" strokeWidth=".9" strokeLinecap="round" />
  </g>;
}

function TugPicture({ position, pull = 0, direction = 0, result = null, label, preview = false }) {
  const uid = useId().replace(/:/g, "");
  const offset = position * DIVISION;
  // Leave both pullers room at the margins while the marked rope passes through their grip.
  const pullerOffset = offset * 0.32;
  const child = 165 + pullerOffset;
  const adult = 875 + pullerOffset;
  const ropePath = `M${child - 58} 316Q${child - 20} 312 ${child + 68} 312H${adult - 76}Q${adult + 20} 312 ${adult + 65} 316`;
  const stride = direction * Math.sin(Math.PI * pull) * 6;
  const winner = result === "child" ? 0 : 1;
  return <svg className="tug-picture" viewBox={preview ? "70 95 900 365" : `0 75 ${SCENE_WIDTH} 405`} role={preview ? undefined : "img"} aria-label={label} aria-hidden={preview || undefined}>
    <defs>
      <linearGradient id={`${uid}-sky`} x2="0" y2="1"><stop stopColor="#d1e8dd" /><stop offset="1" stopColor="#faf4e8" /></linearGradient>
    </defs>
    <rect y="75" width={SCENE_WIDTH} height="405" fill={preview ? `url(#${uid}-sky)` : "transparent"} />
    <circle cx="780" cy="133" r="27" fill="#f6d991" opacity=".8" />
    <path d="M65 150q12-22 32-12 19-28 47-5 22-3 32 17zm304-35q11-17 24-8 16-18 35 3 12-2 18 9h-81z" fill="#fffdf6" opacity=".85" />
    <path d="M0 325Q160 245 350 307T700 301Q892 253 1040 320V480H0z" fill="#c9dfc5" opacity=".72" />
    <path d="M0 388Q180 344 350 377T715 373Q875 340 1040 380V480H0z" fill="#b6cfb1" opacity=".65" />
    <path d="M0 444Q220 404 520 434Q805 401 1040 441V480H0z" fill="#eed9b7" />
    <g className="tug-center-flag" transform={`translate(${CENTER} 435)`}>
      <ellipse rx="22" ry="5" fill="#b99367" opacity=".4" />
      <path d="M0-2v-193" stroke="#684232" strokeWidth="7" strokeLinecap="round" />
      <path d="M-1-4v-190" stroke="#b08159" strokeWidth="2" strokeLinecap="round" />
      <path d="M-12 1q6-4 12-1 6-3 13 1" fill="none" stroke="#b99367" strokeWidth="2" strokeLinecap="round" />
      <path d="M0-192h46l-10 12 10 12H0z" fill="#f8c85d" stroke="#684232" strokeWidth="2" strokeLinejoin="round" />
      <path d="M-7-132H7L0-122Z" fill="#f8c85d" stroke="#684232" strokeWidth="2" strokeLinejoin="round" />
      {result && <g className="tug-win" stroke={COLORS[winner]} strokeWidth="4" strokeLinecap="round">
        <path d="M-14-191l-7-6M-2-201l-3-10M18-201l4-9M35-199l7-6" />
      </g>}
    </g>
    <path d={ropePath} fill="none" stroke="#835e43" strokeWidth="14" strokeLinecap="round" />
    <path d={ropePath} transform="translate(0 -2)" fill="none" stroke="#e8bb83" strokeWidth="8" strokeDasharray="5 3" strokeDashoffset={pullerOffset - offset} strokeLinecap="round" />
    <g className="tug-rope" transform={`translate(${offset} 0)`}>
      {MARKS.map(mark => {
        const major = mark % 5 === 0;
        const center = mark === 0;
        const winning = result && mark === -Math.sign(position) * TUG_FINISH;
        return <g key={mark} data-rope-mark={mark} transform={`translate(${CENTER + mark * DIVISION} 312)`}>
          {center && <path d="M-7-9h14l-3 24-4-4-4 4z" fill="#e77868" stroke="#fff8ea" strokeWidth="1.5" />}
          <path d={major ? "M0-8v21" : "M0-4v8"} stroke={center ? "#bc633b" : "#674831"} strokeWidth={major ? 3 : 1.5} strokeLinecap="round" />
          {major && <>
            <rect x="-19" y="10" width="38" height="30" rx="8" fill={winning || center ? "#f8c85d" : "#fff6e1"} stroke={winning ? COLORS[winner] : "#a57d54"} strokeWidth={winning ? 3 : 1.5} />
            <text x="0" y="33" textAnchor="middle" className="tug-mark">{Math.abs(mark)}</text>
          </>}
        </g>;
      })}
    </g>
    <Puller x={child} player={0} effort={direction === -1 ? Math.sin(Math.PI * pull) : 0} stride={stride} />
    <Puller x={adult} player={1} effort={direction === 1 ? Math.sin(Math.PI * pull) : 0} stride={-stride} />
  </svg>;
}

function TugStep({ race, paused, onStep, label }) {
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const direction = tugPullDirection(race.dice, race.step);
  const changingSides = direction !== 0 && race.step === Math.min(...race.dice);
  useEffect(() => {
    if (paused) return undefined;
    let frame;
    let previous = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = direction === 0 ? 160 : reduced ? 85 : 290;
    const pauseBeforeStep = changingSides && !reduced ? 280 : 0;
    function advance(now) {
      elapsed.current += now - previous;
      previous = now;
      const next = Math.max(0, Math.min((elapsed.current - pauseBeforeStep) / duration, 1));
      if (next === 1) onStep();
      else {
        if (!reduced && direction) setProgress(next);
        frame = requestAnimationFrame(advance);
      }
    }
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [changingSides, direction, onStep, paused]);
  const eased = progress * progress * (3 - 2 * progress);
  return <TugPicture position={race.ropePosition + direction * eased} pull={progress} direction={direction} label={label} />;
}

export default function TugScene({ race, names, paused, onStep }) {
  const { ropePosition, pullScores, startingScores, sumsAnswered } = race;
  const direction = race.phase === "moving" ? tugPullDirection(race.dice, race.step) : 0;
  const filling = ["moving", "arriving", "adding", "sumFeedback"].includes(race.phase);
  const scores = pullScores.map((score, i) => filling && i >= sumsAnswered ? startingScores[i] : score);
  const bonuses = pullScores.map((score, i) => score - scores[i]);
  const counting = race.phase === "adding" ? sumsAnswered : null;
  const confirmed = race.phase === "sumFeedback" ? sumsAnswered - 1 : null;
  const label = ropePosition === 0 ? "Ноль на канате под флажком" : `Сдвиг каната в сторону игрока ${names[ropePosition < 0 ? 0 : 1]} — ${Math.abs(ropePosition)}`;
  return <div className="tug-scene" data-rope-position={ropePosition}>
    <TugScoreboard names={names} scores={scores} bonuses={bonuses} direction={direction} counting={counting} confirmed={confirmed} />
    {race.phase === "moving"
      ? <TugStep key={`${race.round}-${race.step}`} race={race} paused={paused} onStep={onStep} label={label} />
      : <TugPicture position={ropePosition} result={race.phase === "finished" ? race.result : null} label={label} />}
  </div>;
}

export function TugScoreboard({ names, scores, bonuses = [], direction = 0, counting = null, confirmed = null }) {
  return <div className="tug-scoreboard" role="group" aria-label="Очки за рывки">
    <span className="tug-scoreboard-title" aria-hidden="true">Очки за рывки</span>
    {names.map((name, i) => <div key={i} className={`tug-score race-player--${i === 0 ? "child" : "adult"}`} data-pulling={direction === (i === 0 ? -1 : 1) || counting === i} data-confirmed={confirmed === i}>
      <span className="tug-score-name">{name}</span>
      <span className="tug-score-points">
        <strong className="tug-score-value">{scores[i]}</strong>
        {bonuses[i] > 0 && <span className="tug-score-bonus">+{bonuses[i]}</span>}
      </span>
    </div>)}
  </div>;
}

export function TugPreview() {
  return <TugPicture position={0} preview />;
}
