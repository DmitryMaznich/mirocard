import { useEffect,useId,useRef,useState } from "react";
import { POUR_PORTION_MS,WATER_GOAL,WATER_SCENE,pourFrame,waterLevel } from "./waterGeometry";
import {ART_SIZE,WATER_PEOPLE_ART,waterCharacterPlacement} from "./waterCharacterArt";
import "./water.css";

const PLAYER_COLORS=["#e98373","#4da6a1"];
const ease=t=>t*t*(3-2*t);

function WaterPerson({type,player}) {
  const {art,scale,x,y,child,footX}=waterCharacterPlacement(type);
  return <g className="water-person" data-character={type} data-player={player} transform={player===1 ? "translate(1200 0) scale(-1 1)" : undefined}>
    {child && <g className="water-stool"><rect x={footX-62} y="445" width="124" height="12" rx="4" fill="#d6a770" stroke="#b48759" strokeWidth="2" /><path d={`M${footX-45} 457l-10 48m100-48 10 48M${footX-51} 486h102`} fill="none" stroke="#bd8d58" strokeWidth="10" /></g>}
    <svg className="water-character-sprite" x={x+art.column*ART_SIZE.columnWidth*scale} y={y} width={ART_SIZE.columnWidth*scale} height={ART_SIZE.height*scale} viewBox={`${art.column*ART_SIZE.columnWidth} 0 ${ART_SIZE.columnWidth} ${ART_SIZE.height}`} overflow="hidden">
      <image href={WATER_PEOPLE_ART} width={ART_SIZE.width} height={ART_SIZE.height} />
    </svg>
  </g>;
}

function Faucet({player,open,metal,type}) {
  const {tapX,tapY}=waterCharacterPlacement(type);
  const stem=tapX-18, pivotY=tapY+12;
  return <g className="water-faucet" data-player={player} data-open={open} transform={player===1 ? "translate(1200 0) scale(-1 1)" : undefined}>
    <rect x={stem-23} y="380" width="48" height="12" rx="5" fill="#a8b7bd" stroke="#7f939e" strokeWidth="2" />
    <path d={`M${stem} 382V182C${stem} 87 400 78 400 110`} fill="none" stroke="#8296a1" strokeWidth="23" />
    <path d={`M${stem} 382V182C${stem} 87 400 78 400 110`} fill="none" stroke={metal} strokeWidth="18" />
    <path d={`M${stem-5} 377V182C${stem-5} 99 386 87 396 106`} fill="none" stroke="#f7faf7" strokeWidth="4" opacity=".8" />
    <rect x="389" y="104" width="22" height="11" rx="3" fill="#b2c0c4" stroke="#7e939c" strokeWidth="1.5" />
    <g transform={`translate(${stem} ${pivotY})`}><g transform={`rotate(${-16*open})`}><path d="M0 0 18-12" stroke="#7f939e" strokeWidth="13" strokeLinecap="round" /><path d="M-1-2 18-14" stroke="#d7dfe0" strokeWidth="8" strokeLinecap="round" /><circle r="12" fill="#dce2e2" stroke="#8ba0a7" strokeWidth="2" /><circle r="8" fill={PLAYER_COLORS[player]} /></g></g>
  </g>;
}

function Glass({player,frame,uid,name,celebrating}) {
  const cx=WATER_SCENE.glassCenters[player], x=cx-90;
  const {amount,level,flow,open}=frame;
  return <g className="water-glass" data-player={player} data-amount={amount} data-level={level} aria-label={`${name}: ${Math.floor(amount)} порций`}>
    <path d={`M${x} 130V382Q${x+90} 402 ${x+180} 382V130`} fill={`url(#${uid}-glass)`} stroke="#8baab2" strokeWidth="3" />
    <g clipPath={`url(#${uid}-clip-${player})`}>
      <rect className="water-fill" x={x+10} y={level} width="160" height={380-level} fill={`url(#${uid}-water)`} />
      {amount>0 && <ellipse className={flow ? "water-ripple water-ripple--active" : "water-ripple"} cx={cx} cy={level} rx="78" ry="5" fill="#83d5f0" stroke="#d2f3fb" strokeWidth="1.5" />}
      {flow && [0,1,2,3].map(i=><circle key={i} className="water-bubble" cx={cx-34+i*21} cy={Math.min(374,level+14+(i%2)*10)} r={2+i%2} fill="#d5f4fb" opacity=".8" style={{animationDelay:`${i*-.15}s`}} />)}
    </g>
    {flow && open>0 && <g className="water-flow" opacity={open}>
      <path d={`M${cx} 113V${Math.max(150,level)}`} stroke="#55c4ee" strokeWidth="8" strokeLinecap="round" />
      <path className="water-flow-shine" d={`M${cx-1.5} 115V${Math.max(150,level)}`} stroke="#d4f5ff" strokeWidth="2" strokeDasharray="8 9" />
      <path d={`M${cx-16} ${level-2}q8-15 12-4M${cx+15} ${level-3}q-5-16-11-4`} stroke="#82d8f4" strokeWidth="2" fill="none" />
    </g>}
    <path d={`M${x+13} 146v215M${x+166} 146v210`} stroke="white" strokeWidth="5" opacity=".55" strokeLinecap="round" />
    <ellipse cx={cx} cy="130" rx="90" ry="8" fill="none" stroke="#94aeb6" strokeWidth="3" />
    <path d={`M${x+5} 382q85 15 170 0`} stroke={PLAYER_COLORS[player]} strokeWidth="8" fill="none" strokeLinecap="round" />
    {[0,5,10,15,20].map(n=><g key={n}><path d={`M${x+38} ${waterLevel(n)}h${n===20 ? 130 : 13}`} stroke={n===20 && amount>=WATER_GOAL ? "#4b9980" : "#334e65"} strokeWidth={n===20 ? 2.5 : 1.8} strokeDasharray={n===20 ? "6 5" : undefined} /><text x={x+30} y={waterLevel(n)+5} textAnchor="end" className="water-scale">{n}</text></g>)}
    <g transform={`translate(${cx-65} 414)`}><rect width="130" height="38" rx="19" fill="#fff9ea" /><text x="65" y="27" textAnchor="middle" className="water-count">{Math.min(WATER_GOAL,Math.floor(amount))} / 20</text></g>
    <circle cx={cx-60} cy="478" r="6" fill={PLAYER_COLORS[player]} /><text x={cx+8} y="487" textAnchor="middle" className="water-player-name">{name.length>16 ? name.slice(0,15)+"…" : name}</text>
    {celebrating && amount>=WATER_GOAL && <g className="water-celebration"><path d={`M${cx-18} 164l13 13 25-27`} stroke="#4b9980" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={`M${cx-70} 100l-8-12m148 12 8-12m-78-2v-14`} stroke="#e0b75f" strokeWidth="4" strokeLinecap="round" /></g>}
  </g>;
}

function WaterWorld({race,names,characters,progress,paused}) {
  const uid=useId().replace(/:/g,"");
  const frames=pourFrame(race,progress);
  return <div className={`water-scene${paused ? " water-scene--paused" : ""}`}>
    <svg viewBox="0 0 1200 540" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Наливаем до отметки 20. ${names[0]}: ${Math.floor(frames[0].amount)}. ${names[1]}: ${Math.floor(frames[1].amount)}.`}>
      <defs>
        <linearGradient id={`${uid}-wall`} x2="0" y2="1"><stop stopColor="#d1e8dd" /><stop offset="1" stopColor="#f7f4e9" /></linearGradient>
        <linearGradient id={`${uid}-glass`}><stop stopColor="#f7ffff" stopOpacity=".5" /><stop offset=".5" stopColor="#e9ffff" stopOpacity=".05" /><stop offset="1" stopColor="#e7fcff" stopOpacity=".4" /></linearGradient>
        <linearGradient id={`${uid}-water`} x2="0" y2="1"><stop stopColor="#78d2ed" /><stop offset="1" stopColor="#47b4df" /></linearGradient>
        <linearGradient id={`${uid}-metal`}><stop stopColor="#a1b0b8" /><stop offset=".4" stopColor="#f1f6f4" /><stop offset="1" stopColor="#b2c0c6" /></linearGradient>
        {WATER_SCENE.glassCenters.map((cx,i)=><clipPath key={i} id={`${uid}-clip-${i}`}><rect x={cx-80} y="146" width="160" height="234" rx="6" /></clipPath>)}
      </defs>
      <rect width="1200" height="540" rx="20" fill={`url(#${uid}-wall)`} />
      <path d="M0 305H1200M0 340H1200M0 375H1200" stroke="#fffdf5" strokeWidth="3" opacity=".7" />
      {Array.from({length:12},(_,i)=><path key={i} d={`M${i*110} 305v35m55 0v35`} stroke="#fffdf5" strokeWidth="2" opacity=".7" />)}
      <rect x="0" y="389" width="1200" height="19" fill="#dcb78b" /><path d="M0 391H1200M0 407H1200" stroke="#bd976e" strokeWidth="2" />
      <rect x="0" y="409" width="1200" height="131" fill="#c7dbcc" opacity=".55" />
      <rect x="450" y="30" width="300" height="50" rx="25" fill="#fff8e8" /><text x="600" y="63" textAnchor="middle" className="water-goal-title">Налей до верха</text>
      {frames.map((frame,player)=><Faucet key={player} player={player} type={characters[player]} open={ease(frame.open)} metal={`url(#${uid}-metal)`} />)}
      {frames.map((frame,player)=><Glass key={player} frame={frame} player={player} uid={uid} name={names[player]} celebrating={race.phase==="finished"} />)}
      {frames.map((frame,player)=><WaterPerson key={player} type={characters[player]} player={player} />)}
    </svg>
  </div>;
}

function WaterFrame({race,names,characters,paused,onPortion}) {
  const [progress,setProgress]=useState(0);
  const elapsed=useRef(0),done=useRef(false);
  const [reduced]=useState(()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(()=>{
    if(paused || done.current) return undefined;
    let frame,previous=performance.now();
    const duration=reduced ? 90 : race.phase==="arriving" ? 260 : POUR_PORTION_MS;
    const advance=now=>{
      elapsed.current+=now-previous;previous=now;
      const p=Math.min(1,elapsed.current/duration);
      setProgress(p);
      if(p===1) {done.current=true;if(race.phase==="moving") onPortion();}
      else frame=requestAnimationFrame(advance);
    };
    frame=requestAnimationFrame(advance);
    return()=>cancelAnimationFrame(frame);
  },[paused,onPortion,race.phase,reduced]);
  return <div className="water-frame" data-water-progress={progress}><WaterWorld race={race} names={names} characters={characters} progress={progress} paused={paused} /></div>;
}

export default function WaterScene({race,names,characters,paused,onPortion}) {
  return <div className="water-scene-wrap">
    {race.phase==="moving" || race.phase==="arriving" ? <WaterFrame key={`${race.round}-${race.phase}-${race.step}`} race={race} names={names} characters={characters} paused={paused} onPortion={onPortion} /> : <WaterWorld race={race} names={names} characters={characters} paused={paused} progress={0} />}
  </div>;
}

export function WaterPreview() {
  return <svg viewBox="0 0 240 160" aria-hidden="true"><rect width="240" height="160" rx="20" fill="#e2efe7" />{[0,1].map(p=><g key={p}><path d={`M${40+p*95} 128V45C${40+p*95} 10 ${77+p*95} 10 ${77+p*95} 35`} stroke="#9aafb4" strokeWidth="8" fill="none" /><rect x={52+p*95} y="50" width="50" height="80" rx="6" fill="#f4fdff" stroke="#9ab9bf" strokeWidth="2" /><path d={`M${55+p*95} ${p ? 100 : 83}h44v${p ? 27 : 44}h-44z`} fill="#74cceb" /><path d={`M${56+p*95} 69h42`} stroke={PLAYER_COLORS[p]} strokeWidth="2" strokeDasharray="4 3" /></g>)}</svg>;
}
