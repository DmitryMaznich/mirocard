import { useEffect, useRef, useState } from "react";
import { TUG_FINISH, tugPullDirection } from "./raceEngine";
import "./tug.css";

const SCENE_WIDTH = 1040;
const CENTER = SCENE_WIDTH / 2;
const DIVISION = 12;
const MARKS = Array.from({ length: TUG_FINISH * 2 + 1 }, (_, i) => i - TUG_FINISH);
const COLORS = ["#e77868", "#369c9a"];

function Puller({ x, player, effort, stride }) {
  const adult = player === 1;
  const scale = adult ? 1.12 : 1;
  const shirt = COLORS[player];
  const skin = adult ? "#d99a75" : "#f0b188";
  const hair = adult ? "#533b39" : "#774d3b";
  return <g transform={`translate(${x} 275) scale(${adult ? -scale : scale} ${scale})`}>
    <ellipse cy="4" rx="47" ry="9" fill="#769076" opacity=".27" />
    <path d={`M-12-52 -24-22 ${-36 + stride}-3 M12-52 23-23 ${28 - stride}-4`} stroke="#47617a" strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={`M${-42 + stride}-2h18m${44 - 2 * stride} 0h17`} stroke="#293c51" strokeWidth="9" strokeLinecap="round" />
    <g transform={`rotate(${-10 - effort * 8} 0 -55)`}>
      <path d="M-27-57q2-44 12-53l30-2q13 11 14 54l-6 7h-46z" fill={shirt} stroke="#354959" strokeWidth="3" />
      <path d="M-18-93q-4 13-4 30" stroke="#fff7e8" strokeWidth="4" opacity=".45" fill="none" strokeLinecap="round" />
      <path d="M-5-119v13h17v-14" fill={skin} stroke="#354959" strokeWidth="2" />
      <path d="M-27-147q0-29 30-30 29 0 29 29l5 12-7 3q-3 16-25 20-31 0-32-34z" fill={skin} stroke="#354959" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-28-141q-14-29 11-39 15-9 39 0l12-5q9 18-8 26l-12-5q-10 19-29 12l-4 12z" fill={hair} />
      <circle cx="-18" cy="-143" r="8" fill={skin} />
      <circle cx="21" cy="-146" r="3" fill="#293c51" />
      <path d="M15-128q5 4 10 0" stroke="#754838" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
    <path d={`M12-94 Q${24 - effort * 6}-65 47 ${adult ? -76 : -85}`} stroke="#354959" strokeWidth="17" strokeLinecap="round" fill="none" />
    <path d={`M12-94 Q${24 - effort * 6}-65 47 ${adult ? -76 : -85}`} stroke={skin} strokeWidth="12" strokeLinecap="round" fill="none" />
  </g>;
}

function TugPicture({ position, pull = 0, direction = 0, result = null, label, preview = false }) {
  const offset = position * DIVISION;
  // Leave both pullers room at the margins while the marked rope passes through their grip.
  const pullerOffset = offset * 0.55;
  const child = 180 + pullerOffset;
  const adult = 860 + pullerOffset;
  const ropePath = `M${child + 47} 190H${adult - 53}`;
  const stride = direction * Math.sin(Math.PI * pull) * 6;
  const winner = result === "child" ? 0 : 1;
  return <svg className="tug-picture" viewBox={preview ? "110 42 820 278" : `0 0 ${SCENE_WIDTH} 320`} role={preview ? undefined : "img"} aria-label={label} aria-hidden={preview || undefined}>
    <rect width={SCENE_WIDTH} height="320" rx="24" fill="#e3f0e8" />
    <g transform={`scale(${SCENE_WIDTH / 960} 1)`}>
      <circle cx="779" cy="70" r="31" fill="#f9df95" />
      <path d="M75 69q10-28 33-15 22-24 48 7 21-4 29 13H68q0-3 7-5zm230-31q10-16 24-8 16-17 35 3 12-2 18 9h-81z" fill="#fffaf0" />
      <path d="M0 179Q185 107 377 177T692 168Q833 118 960 171V320H0z" fill="#c9e3cb" />
      <path d="M0 246Q154 210 329 236T647 233Q818 204 960 244V320H0z" fill="#b3d3ad" />
      <path d="M0 293Q231 241 480 285Q702 242 960 293V320H0z" fill="#e9d3ab" />
    </g>
    <g className="tug-center-flag" transform={`translate(${CENTER} 301)`}>
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
        return <g key={mark} data-rope-mark={mark} transform={`translate(${CENTER + mark * DIVISION} 190)`}>
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
  const { ropePosition, pullScores } = race;
  const direction = race.phase === "moving" ? tugPullDirection(race.dice, race.step) : 0;
  const label = ropePosition === 0 ? "Ноль на канате под флажком" : `Сдвиг каната в сторону игрока ${names[ropePosition < 0 ? 0 : 1]} — ${Math.abs(ropePosition)}`;
  return <div className="tug-scene" data-rope-position={ropePosition}>
    <TugScoreboard names={names} scores={pullScores} direction={direction} />
    {race.phase === "moving"
      ? <TugStep key={`${race.round}-${race.step}`} race={race} paused={paused} onStep={onStep} label={label} />
      : <TugPicture position={ropePosition} result={race.phase === "finished" ? race.result : null} label={label} />}
  </div>;
}

export function TugScoreboard({ names, scores, direction = 0 }) {
  return <div className="tug-scoreboard" role="group" aria-label="Очки за рывки">
    <span className="tug-scoreboard-title" aria-hidden="true">Очки за рывки</span>
    {names.map((name, i) => <div key={i} className={`tug-score race-player--${i === 0 ? "child" : "adult"}`} data-pulling={direction === (i === 0 ? -1 : 1)}>
      <span className="tug-score-name">{name}</span>
      <strong className="tug-score-value">{scores[i]}</strong>
    </div>)}
  </div>;
}

export function TugPreview() {
  return <TugPicture position={0} preview />;
}
