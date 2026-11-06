import { useEffect, useId, useRef, useState } from "react";
import { BUILD_STEP_MS, MAX_FLOORS, SCENE, TOWER_CENTERS, balconySide, constructionPose, floorY } from "./towerGeometry";
import "./towers.css";

const PALETTES = [
  { wall:"#ed8977", shade:"#e67d6b", trim:"#ffe1b1", dark:"#a74e43" },
  { wall:"#6db9b3", shade:"#5baba6", trim:"#ffe1b1", dark:"#347c7c" },
];
const SHIRTS = ["#e6a23d","#6a90c0","#cf7096","#72a47c","#a084b5"];

function Resident({ x, floor }) {
  return <g className="tower-resident" transform={`translate(${x} 0)`}>
    <circle cx="0" cy="5" r="3" fill={floor%3 ? "#f1c49a" : "#bd865d"} />
    <path d="M-3 4q0-5 4-3q3 1 2 4l-1-2h-4z" fill={floor%4 ? "#79543b" : "#d8c8b3"} />
    <path d="M-4 13V10q4-5 8 0v3" fill={SHIRTS[floor%SHIRTS.length]} />
    <g transform="translate(3 9)"><path className="tower-resident-arm" d="M0 0 4-2 4-5" fill="none" stroke="#d5a174" strokeWidth="1.5" strokeLinecap="round" /></g>
    <circle cx="-1" cy="5" r=".4" fill="#453b38" /><circle cx="1" cy="5" r=".4" fill="#453b38" />
  </g>;
}

function Floor({ floor, player, windowFill, carried = false, landed = false }) {
  const c = PALETTES[player], side = balconySide(floor);
  const balconyX = side === "left" ? -28 : SCENE.towerWidth - 2;
  return <g className={`tower-floor${carried ? " tower-floor--carried" : " tower-floor--built"}`} data-floor={floor}>
    <rect width={SCENE.towerWidth} height={SCENE.floorHeight} fill={floor%2 ? c.wall : c.shade} />
    <path d={`M0 1h${SCENE.towerWidth}M0 15h${SCENE.towerWidth}`} stroke={c.trim} strokeWidth="2" />
    <path d={`M5 2v12M${SCENE.towerWidth-5} 2v12`} stroke={c.trim} strokeWidth="2" opacity=".7" />
    {floor === 1 ? <g><path d="M51 16V8a11 6 0 0 1 22 0v8" fill="#995f45" stroke={c.trim} strokeWidth="2" /><path d="M62 2v14" stroke={c.trim} strokeWidth="1" /><circle cx="66" cy="11" r="1" fill="#ffdd8c" /></g> : [24,78].map(x => <g key={x}>
      <path className={!carried || landed ? "tower-window--lit" : ""} d={`M${x} 13V6a11 5 0 0 1 22 0v7z`} fill={windowFill} stroke={c.dark} strokeWidth="1.2" />
      <path d={`M${x+11} 2v11M${x+1} 7h20`} stroke="#fff2ce" strokeWidth="1" />
    </g>)}
    {side && <g className="tower-balcony" data-side={side}>
      {!carried && <Resident x={balconyX+15} floor={floor} />}
      <rect x={balconyX} y="13" width="30" height="3" rx="1" fill={c.trim} />
      <path d={`M${balconyX} 9h30M${balconyX} 9v5m6-5v5m6-5v5m6-5v5m6-5v5m6-5v5`} stroke="#fff0cd" strokeWidth="1.2" />
      {floor%6 === 0 && <g><rect x={balconyX+22} y="9" width="5" height="4" fill="#b77957" /><circle cx={balconyX+24.5} cy="7.5" r="3" fill="#79a55f" /><circle cx={balconyX+24} cy="6" r="1.5" fill="#eaa0b2" /></g>}
    </g>}
  </g>;
}

function Crane({ mirrored = false }) {
  return <g className="tower-crane" transform={mirrored ? `translate(${SCENE.width} 0) scale(-1 1)` : undefined}>
    <rect x="101" y="42" width="18" height="430" fill="#ffcf57" stroke="#bc831c" strokeWidth="2" />
    {Array.from({length:20},(_,i) => <path key={i} d={`M102 ${45+i*21}l16 20h-16l16-20`} fill="none" stroke="#dd9f24" strokeWidth="2" />)}
    <rect x="76" y="468" width="68" height="12" rx="2" fill="#bca781" />
    <path d="M80 477h60" stroke="#4f5147" strokeWidth="5" strokeDasharray="7 7" />
    <path d="M110 12 48 42M110 12 490 42" fill="none" stroke="#465464" strokeWidth="2" />
    <path d="M100 42 110 12 121 42" fill="#ffcf57" stroke="#d89a26" strokeWidth="2" />
    <rect x="45" y="36" width="448" height="14" rx="2" fill="#ffcc50" stroke="#d9991f" strokeWidth="2" />
    {Array.from({length:19},(_,i) => <path key={i} d={`M${47+i*23} 49l11-12 11 12`} fill="none" stroke="#e4a62c" strokeWidth="1.8" />)}
    <rect x="28" y="44" width="38" height="27" rx="2" fill="#9d998b" stroke="#746f66" strokeWidth="2" /><path d="M41 46v23M53 46v23" stroke="#c5c0af" strokeWidth="2" />
    <rect x="119" y="53" width="31" height="39" rx="7" fill="#ffc645" stroke="#ce8d24" strokeWidth="2" />
    <rect x="124" y="59" width="22" height="24" rx="5" fill="#b4dce3" />
    <circle cx="135" cy="68" r="5" fill="#f2bd83" /><path d="M129 65q6-10 12 0z" fill="#eaa728" /><path d="M128 83v-5q7-9 14 0v5" fill="#517d98" />
    <path d="M96 95h60M96 87v9M154 87v9" stroke="#e8b238" strokeWidth="3" />
  </g>;
}

function Hook({ x, y, attached = false, moduleX, moduleY }) {
  return <g className="tower-hoist" data-hook-x={x} data-hook-y={y}>
    <rect x={x-9} y="48" width="18" height="8" rx="2" fill="#344957" />
    <path d={`M${x} ${SCENE.cableTop}V${y-9}`} stroke="#465563" strokeWidth="1.8" />
    <rect x={x-5} y={y-11} width="10" height="11" rx="3" fill="#edb630" stroke="#a87720" strokeWidth="1" />
    <path d={`M${x} ${y}q6 8-2 9`} fill="none" stroke="#966d23" strokeWidth="2" />
    {attached && <path d={`M${x} ${y}L${moduleX-42} ${moduleY}M${x} ${y}L${moduleX+42} ${moduleY}`} fill="none" stroke="#4b5e69" strokeWidth="2" />}
  </g>;
}

function CraneMotion({ race, paused, onPlaced, windowFill }) {
  const [progress,setProgress] = useState(0);
  const elapsed = useRef(0), done = useRef(false);
  const [reduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    if (paused || done.current) return undefined;
    let frame, previous = performance.now();
    const advance = now => {
      elapsed.current += now-previous;
      previous = now;
      const value = Math.min(1,elapsed.current/(reduced ? 180 : BUILD_STEP_MS));
      setProgress(value);
      if (value === 1) { done.current = true; onPlaced(); }
      else frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  },[paused,onPlaced,reduced]);
  return <g className="tower-construction-step" data-progress={progress}>
    {race.positions.map((position,player) => {
      const active = race.step < race.dice[player] && position < MAX_FLOORS;
      if (!active) return <Hook key={player} x={player === 0 ? 230 : 970} y="105" />;
      const floor = position+1;
      const pose = constructionPose(floor,reduced ? 1 : progress,player);
      return <g key={player} className="tower-moving-floor" data-player={player} data-next-floor={floor}>
        <g transform={`translate(${pose.moduleX-SCENE.towerWidth/2} ${pose.moduleY})`}><Floor floor={floor} player={player} windowFill={windowFill} carried landed={pose.landed} /></g>
        <Hook x={pose.hookX} y={pose.hookY} attached={pose.attached} moduleX={pose.moduleX} moduleY={pose.moduleY} />
      </g>;
    })}
  </g>;
}

export function TowerPreview() {
  return <svg viewBox="0 0 240 160" aria-hidden="true"><rect width="240" height="160" rx="20" fill="#e3f2f7" /><path d="M15 45q0-13 13-12q8-18 21-5q16-7 19 9h101q10-18 24-7q17-8 22 9H15" fill="white" />{[0,1].map(p => <g key={p}><rect x={62+p*72} y={p ? 84 : 54} width="44" height={p ? 62 : 92} fill={PALETTES[p].wall} rx="3" />{Array.from({length:p ? 4 : 6},(_,n) => <g key={n}><path d={`M${62+p*72} ${64+n*14+(p ? 30 : 0)}h44`} stroke="#ffe1b1" strokeWidth="3" /><rect x={72+p*72} y={57+n*14+(p ? 30 : 0)} width="8" height="7" rx="2" fill="#def2f2" /><rect x={88+p*72} y={57+n*14+(p ? 30 : 0)} width="8" height="7" rx="2" fill="#def2f2" /></g>)}</g>)}</svg>;
}

export default function TowerScene({ race, names, paused, onPlaced }) {
  const uid = useId().replace(/:/g,"");
  const windows = `url(#${uid}-window)`;
  return <div className={`tower-scene${paused ? " tower-scene--paused" : ""}`}>
    <svg viewBox={`0 0 ${SCENE.width} ${SCENE.height}`} preserveAspectRatio="xMidYMid meet" aria-label={`Стройка до 20 этажей. ${names[0]}: ${race.positions[0]}. ${names[1]}: ${race.positions[1]}.`} role="img">
      <defs><linearGradient id={`${uid}-sky`} x2="0" y2="1"><stop stopColor="#aee0f6" /><stop offset="1" stopColor="#fff5e5" /></linearGradient><linearGradient id={`${uid}-window`} x2="0" y2="1"><stop stopColor="#fff1b7" /><stop offset="1" stopColor="#b7e0e7" /></linearGradient></defs>
      <rect width="1200" height="540" fill={`url(#${uid}-sky)`} rx="20" />
      <g className="tower-clouds" fill="#fffefb" opacity=".92">{[280,360,445,550,650,755,850,930].map((x,i) => <ellipse key={x} cx={x} cy={145+(i%3)*3} rx="68" ry={15+(i%2)*8} />)}</g>
      <path className="tower-goal" d={`M260 ${floorY(MAX_FLOORS)}H940`} stroke="#6baccb" strokeWidth="1.5" strokeDasharray="9 7" />
      <text x="600" y="120" textAnchor="middle" className="tower-goal-title">20 этажей — до облаков</text>
      <Crane /><Crane mirrored />
      {race.positions.map((count,player) => {
        const x = TOWER_CENTERS[player]-SCENE.towerWidth/2;
        const won = count === MAX_FLOORS;
        return <g key={player} className={`tower-building tower-building--${player}`} data-player={player} data-floors={count} aria-label={`${names[player]}: ${count} из 20 этажей`}>
          <rect x={x} y={floorY(MAX_FLOORS)} width={SCENE.towerWidth} height={MAX_FLOORS*SCENE.floorHeight} fill="none" stroke="#8fc2da" strokeDasharray="5 5" />
          {Array.from({length:MAX_FLOORS-1},(_,i) => <path key={i} d={`M${x} ${floorY(i+1)}h${SCENE.towerWidth}`} stroke="#9ac8dc" opacity=".5" strokeDasharray="5 5" />)}
          {Array.from({length:count},(_,i) => <g key={i+1} transform={`translate(${x} ${floorY(i+1)})`}><Floor floor={i+1} player={player} windowFill={windows} /></g>)}
          {count>0 && <path d={`M${x-5} ${floorY(count)-1}h${SCENE.towerWidth+10}`} stroke="#ffe1b1" strokeWidth="5" />}
          {won && <g className="tower-win-flag"><path d={`M${TOWER_CENTERS[player]} ${floorY(count)-3}v-28`} stroke="#6f786c" strokeWidth="2" /><path d={`M${TOWER_CENTERS[player]+1} ${floorY(count)-31}h24l-5 8 5 8h-24z`} fill={PALETTES[player].wall} /></g>}
          <g className="tower-counter" transform={`translate(${player === 0 ? x+SCENE.towerWidth+24 : x-116} ${floorY(count)-30})`}><rect width="92" height="28" rx="14" fill={PALETTES[player].wall} /><text x="46" y="20" textAnchor="middle">{count} / 20</text></g>
          <circle cx={TOWER_CENTERS[player]-55} cy="518" r="6" fill={PALETTES[player].wall} /><text x={TOWER_CENTERS[player]+4} y="526" textAnchor="middle" className="tower-player-name">{names[player].length>18 ? names[player].slice(0,17)+"…" : names[player]}</text>
        </g>;
      })}
      <path d="M20 481H1180" stroke="#91b76e" strokeWidth="4" />
      {[280,465,735,920].map(x => <g key={x}><ellipse cx={x} cy="472" rx="21" ry="9" fill="#95b56b" /><circle cx={x-8} cy="466" r="9" fill="#a7c67d" /><circle cx={x+7} cy="465" r="11" fill="#8eb167" /></g>)}
      {race.phase === "moving" ? <CraneMotion key={`${race.round}-${race.step}`} race={race} paused={paused} onPlaced={onPlaced} windowFill={windows} /> : <g><Hook x="230" y="105" /><Hook x="970" y="105" /></g>}
      {race.result && <g className="tower-rainbow" fill="none" strokeWidth="6" opacity=".65">{["#ed9a92","#f3d27b","#9bcca8","#8bc6e4"].map((c,i) => <path key={c} d={`M300 ${175+i*8}Q600 ${15+i*8} 900 ${175+i*8}`} stroke={c} />)}</g>}
    </svg>
  </div>;
}
