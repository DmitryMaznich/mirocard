import { useEffect, useId, useRef, useState } from "react";
import { TUG_ROUNDS, comparisonAnswer, tugPullDirection, tugDistance } from "./raceEngine";
import "./tug.css";

const SCENE_WIDTH = 1040;
const CENTER = SCENE_WIDTH / 2;
const DIVISION = 9;
const COLORS = ["#e77868", "#369c9a"];

function Puller({ x, player, type, effort, stride }) {
  const adult = type === "man" || type === "woman";
  const feminine = type === "girl" || type === "woman";
  const scale = adult ? 1.63 : 1.45;
  const shirt = COLORS[player];
  const skin = adult ? "#e5b58e" : "#f3c6a0";
  const hair = adult ? "#634231" : "#855037";
  const gripY = adult ? -76 : -85;
  return <g className="tug-puller" data-player={player} data-character={type} transform={`translate(${x} 435) scale(${player === 1 ? -scale : scale} ${scale})`}>
    <ellipse cy="4" rx="43" ry="7" fill="#405443" opacity=".13" />
    <path d={`M-12-52 -24-22 ${-36 + stride}-3 M12-52 23-23 ${28 - stride}-4`} stroke="#50627b" strokeWidth="15" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={`M${-42 + stride}-2h18m${44 - 2 * stride} 0h17`} stroke="#283b54" strokeWidth="9" strokeLinecap="round" />
    <path d={`M${-42 + stride} 2h18m${44 - 2 * stride} 0h17`} stroke="#fff8ed" strokeWidth="2" strokeLinecap="round" />
    <g transform={`rotate(${-5 - effort * 5} 0 -55)`}>
      <path d="M-27-57q2-44 12-53l30-2q13 11 14 54l-6 7h-46z" fill={shirt} />
      <path d="M-18-94q-4 13-4 31" stroke="#fff7e8" strokeWidth="4" opacity=".32" fill="none" strokeLinecap="round" />
      <path d="M-5-119v13q8 7 17-1v-13" fill={skin} />
      {feminine && <path d={adult ? "M-25-158q-17 16-10 38 3 14 22 15l5-25z" : "M-28-156q-25 3-19 30 3 18-8 22 25 4 25-18l9-26z"} fill={hair} />}
      {!adult && feminine && <circle cx="-29" cy="-153" r="4" fill={shirt} />}
      <path d="M-25-146q-3-28 24-30 28-2 30 25l6 12q1 4-6 5-4 18-24 20-28-1-30-32z" fill={skin} />
      <path d={feminine ? "M-25-141q-11-26 7-36 19-10 36 1 13 8 11 24-13-1-18-14-6 17-27 16l-2 12z" : "M-25-142q-11-21 3-32 12-12 29-7 15-6 23-12 9 16-2 25-9 7-22 0-10 16-22 14l-2 13z"} fill={hair} />
      <path d="M-22-170q16-14 32-7" stroke="#ad7751" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".65" />
      <ellipse cx="-19" cy="-141" rx="7" ry="9" fill={skin} />
      <path d="M-21-144q6-3 5 5" stroke="#ce9477" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <ellipse cx="19" cy="-145" rx="6" ry="8" fill="#fffdf7" />
      <ellipse cx="21" cy="-144" rx="3.2" ry="4.7" fill="#654432" /><circle cx="22" cy="-146" r="1.1" fill="#fffdf7" />
      <path d="M12-157q7-4 13-1" stroke={hair} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="15" cy="-131" rx="7" ry="3.5" fill="#e99481" opacity=".3" />
      {type === "man" && <path d="M-13-126q8 4 13-1 12 7 23-8-1 19-20 20-11-1-16-11z" fill={hair} opacity=".78" />}
      <path d="M13-130q6 5 12-1" stroke={adult ? "#5b3c2b" : "#ab6652"} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
    <path d={`M-3-96 Q${15 - effort * 5}-65 42 ${gripY}`} stroke="#d9a281" strokeWidth="11" strokeLinecap="round" fill="none" />
    <path d={`M12-94 Q${24 - effort * 6}-65 47 ${gripY}`} stroke={skin} strokeWidth="12" strokeLinecap="round" fill="none" />
    <ellipse cx="47" cy={gripY} rx="7" ry="6" fill={skin} />
    <path d={`M44 ${gripY-3}v5m3-5v5m3-5v4`} stroke="#ce9477" strokeWidth=".9" strokeLinecap="round" />
  </g>;
}

function TugPicture({ position, characters=["boy","man"], pull = 0, direction = 0, result = null, label, preview = false }) {
  const uid = useId().replace(/:/g, "");
  const offset = position * DIVISION;
  // Leave both pullers room at the margins while the marked rope passes through their grip.
  const pullerOffset = offset * 0.32;
  const child = 165 + pullerOffset;
  const adult = 875 + pullerOffset;
  const gripLeft = ["man","woman"].includes(characters[0]) ? 77 : 68;
  const gripRight = ["man","woman"].includes(characters[1]) ? 77 : 68;
  const ropePath = `M${child - 58} 316Q${child - 20} 312 ${child + gripLeft} 312H${adult - gripRight}Q${adult + 20} 312 ${adult + 65} 316`;
  const stride = direction * Math.sin(Math.PI * pull) * 6;
  const winner = result === "child" ? 0 : 1;
  const cheering = result === "child" || result === "adult";
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
      <ellipse rx="19" ry="5" fill="#b99367" opacity=".3" />
      <path d="M0-8v-128" stroke="#8ba38f" strokeWidth="2" strokeDasharray="5 6" />
      <path d="M-14-6H14L0-22Z" fill="#fffaf3" stroke="#8ba38f" strokeWidth="2" strokeLinejoin="round" />
      <text y="30" textAnchor="middle" className="tug-middle-label">Середина</text>
    </g>
    <path d={ropePath} fill="none" stroke="#835e43" strokeWidth="14" strokeLinecap="round" />
    <path d={ropePath} transform="translate(0 -2)" fill="none" stroke="#e8bb83" strokeWidth="8" strokeDasharray="5 3" strokeDashoffset={pullerOffset - offset} strokeLinecap="round" />
    <g className="tug-rope" transform={`translate(${offset} 0)`}>
      <g className={result ? "tug-ribbon tug-win" : "tug-ribbon"}>
        <path d={`M${CENTER-11} 305h22l-4 39-7-7-7 7z`} fill="#ec7568" stroke="#fff8ea" strokeWidth="2.5" />
        <ellipse cx={CENTER} cy="309" rx="15" ry="6" fill="#f18c7f" stroke="#fff8ea" strokeWidth="2" />
      </g>
    </g>
    {cheering && <g className="tug-celebration" transform={`translate(${winner===0 ? child : adult} 150)`} fill="#f7cd64" stroke="#dfae47" strokeWidth="1.5">
      <g className="tug-win">{[-30,0,30].map((x,i)=><path key={x} transform={`translate(${x} ${i===1 ? -15 : 0})`} d="M0-10 3-3 10 0 3 3 0 10-3 3-10 0-3-3Z" />)}</g>
    </g>}
    <Puller x={child} player={0} type={characters[0]} effort={direction === -1 ? Math.sin(Math.PI * pull) : 0} stride={stride} />
    <Puller x={adult} player={1} type={characters[1]} effort={direction === 1 ? Math.sin(Math.PI * pull) : 0} stride={-stride} />
  </svg>;
}

function TugStep({ race, characters, paused, onStep, label }) {
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const direction = tugPullDirection(race.dice, race.step);
  const done = useRef(false);
  useEffect(() => {
    if (paused || done.current) return undefined;
    let frame;
    let previous = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 100 : 480;
    function advance(now) {
      elapsed.current += now - previous;
      previous = now;
      const next = Math.max(0, Math.min(elapsed.current / duration, 1));
      if (next === 1) {done.current=true;onStep();}
      else {
        if (!reduced && direction) setProgress(next);
        frame = requestAnimationFrame(advance);
      }
    }
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [direction, onStep, paused]);
  const eased = progress * progress * (3 - 2 * progress);
  return <TugPicture characters={characters} position={race.ropePosition + direction * eased} pull={progress} direction={direction} label={label} />;
}

export default function TugScene({ race, names, characters, paused, onStep }) {
  const {ropePosition}=race;
  const label=ropePosition===0 ? "Ленточка в центре" : `Ленточка на стороне игрока ${names[ropePosition<0 ? 0 : 1]}`;
  return <div className={`tug-scene${paused ? " tug-scene--paused" : ""}`} data-rope-position={ropePosition} data-completed-rounds={race.completedRounds}>
    <div className="tug-rounds" role="group" aria-label={`Завершено ${race.completedRounds} из ${TUG_ROUNDS} бросков`}>
      {Array.from({length:TUG_ROUNDS},(_,i)=><span key={i} data-done={i<race.completedRounds} data-current={i===race.round-1 && !["between","finished"].includes(race.phase)} aria-label={`Бросок ${i+1}${i<race.completedRounds ? " завершён" : ""}`}>{i<race.completedRounds ? "✓" : i+1}</span>)}
    </div>
    <TugPairs race={race} names={names} />
    {race.phase === "moving"
      ? <TugStep key={`${race.round}-${race.step}`} race={race} characters={characters} paused={paused} onStep={onStep} label={label} />
      : <TugPicture position={ropePosition} characters={characters} result={race.phase === "finished" ? race.result : null} label={label} />}
  </div>;
}

function TugPairs({race,names}) {
  const ready=comparisonAnswer(race.dice)!==null;
  const paired=ready && (race.phase!=="input" || race.mistake);
  const minimum=ready ? Math.min(...race.dice) : 0;
  const stronger=ready ? race.dice[0]>race.dice[1] ? 0 : 1 : null;
  const moving=race.phase==="moving";
  const done=["arriving","between","finished"].includes(race.phase);
  return <div className="tug-pairs" aria-label="Точки на кубиках" data-paired={paired} data-distance={ready ? tugDistance(race.dice) : 0}>
    {ready ? names.map((name,player)=><div key={player} className={`tug-pair-row race-player--${player===0 ? "child" : "adult"}`}>
      <span className="tug-pair-name">{name}</span><div className="tug-dot-row" aria-label={`${name}: ${race.dice[player]} точек`}>
        {Array.from({length:6},(_,n)=><i key={n} className="tug-dot" data-empty={n>=race.dice[player]} data-paired={paired && n<minimum} data-used={paired && n>=minimum && (done || n<minimum+race.step)} data-active={moving && player===stronger && n===minimum+race.step} />)}
      </div>
    </div>) : <span className="tug-opening">Пять бросков. Тянем ленточку к себе.</span>}
  </div>;
}

export function TugPreview() {
  return <TugPicture position={0} preview />;
}
