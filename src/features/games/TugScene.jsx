import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { comparisonAnswer, tugPullDirection, tugDistance, TUG_MAX_DISTANCE } from "./raceEngine";
import { drawTug, loadedTugArt, loadTugArt, TUG_PULL_MS, TUG_TRIUMPH_MS, tugEase } from "./tugArt";
import "./tug.css";

function useTugArt() {
  const [art,setArt]=useState(loadedTugArt);
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    loadTugArt().then(images=>{if(active){setArt(images);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[attempt]);
  return {art,failed,retry:()=>{setFailed(false);setAttempt(n=>n+1);}};
}

function TugPicture({art,position,characters,progress=0,direction=0,result,celebrationTime=0,reducedMotion=false,label,preview=false}) {
  const canvas=useRef(null);
  useLayoutEffect(()=>{
    const el=canvas.current;
    if(!el || !art)return;
    const ctx=el.getContext('2d');
    ctx.setTransform(1.5,0,0,1.5,0,0);
    drawTug(ctx,art,{position,characters,progress,direction,result,celebrationTime,reducedMotion});
  },[art,position,characters,progress,direction,result,celebrationTime,reducedMotion]);
  return <canvas ref={canvas} className="tug-picture tug-rope" width="1440" height="810" data-position={position} data-characters={characters?.join(",")??"boy,man"} data-pull-progress={progress} data-celebration-time={celebrationTime} data-winner={result??undefined} role={preview?undefined:"img"} aria-label={preview?undefined:label} aria-hidden={preview||undefined} />;
}

function TugTriumph({art,race,characters,paused,label}) {
  const [time,setTime]=useState(0);
  const elapsed=useRef(0);
  const [reducedMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{
    if(paused||reducedMotion||elapsed.current>=TUG_TRIUMPH_MS)return undefined;
    let frame,previous=performance.now();
    const advance=now=>{
      elapsed.current=Math.min(TUG_TRIUMPH_MS,elapsed.current+now-previous);previous=now;
      setTime(elapsed.current);
      if(elapsed.current<TUG_TRIUMPH_MS)frame=requestAnimationFrame(advance);
    };
    frame=requestAnimationFrame(advance);
    return()=>cancelAnimationFrame(frame);
  },[paused,reducedMotion]);
  return <TugPicture art={art} position={race.ropePosition} characters={characters} result={race.result} celebrationTime={time} reducedMotion={reducedMotion} label={label} />;
}

function TugStep({race,characters,paused,onStep,label,art}) {
  const [progress,setProgress]=useState(0);
  const elapsed=useRef(0),done=useRef(false);
  const direction=tugPullDirection(race.dice);
  useEffect(()=>{
    if(paused||done.current)return undefined;
    let frame,previous=performance.now();
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduced?100:TUG_PULL_MS;
    const advance=now=>{
      elapsed.current+=now-previous;previous=now;
      const p=Math.min(1,elapsed.current/duration);
      if(p===1){done.current=true;onStep();}
      else{if(!reduced)setProgress(p);frame=requestAnimationFrame(advance);}
    };
    frame=requestAnimationFrame(advance);
    return()=>cancelAnimationFrame(frame);
  },[paused,onStep]);
  const eased=tugEase((progress-.2)/.55);
  return <TugPicture art={art} characters={characters} position={race.ropePosition+direction*eased} progress={progress} direction={direction} label={label} />;
}

export default function TugScene({race,names,characters,paused,onStep}) {
  const {art,failed,retry}=useTugArt();
  const label=race.phase==='finished'?`${names[race.result==='child'?0:1]} победил и радуется!`:race.ropePosition===0?'Ленточка у флага':`Ленточка на стороне игрока ${names[race.ropePosition<0?0:1]}. До границы ${TUG_MAX_DISTANCE-Math.abs(race.ropePosition)} шагов.`;
  return <div className={`tug-scene${paused?' tug-scene--paused':''}`} data-rope-position={race.ropePosition} data-completed-rounds={race.completedRounds}>
    <TugPairs race={race} names={names} />
    <div className="tug-stage">
      {art ? race.phase==='moving'
        ? <TugStep key={`${race.round}-${race.step}`} race={race} characters={characters} paused={paused} onStep={onStep} label={label} art={art} />
        : race.phase==='finished'
          ? <TugTriumph art={art} race={race} characters={characters} paused={paused} label={label} />
          : <TugPicture art={art} position={race.ropePosition} characters={characters} label={label} />
        : <div className="tug-art-loading" role="status">{failed?<><span>Не удалось загрузить поле</span><button className="games-secondary" onClick={retry}>Загрузить ещё раз</button></>:'Готовим игровое поле…'}</div>}
    </div>
  </div>;
}

function TugPairs({race,names}) {
  const ready=comparisonAnswer(race.dice)!==null;
  const paired=ready&&(race.phase!=='input'||race.mistake);
  const minimum=ready?Math.min(...race.dice):0;
  const stronger=ready?(race.dice[0]>race.dice[1]?0:1):null;
  const done=['arriving','between','finished'].includes(race.phase);
  return <div className="tug-pairs" aria-label="Точки на кубиках" data-paired={paired} data-distance={ready?tugDistance(race.dice):0}>
    {ready?names.map((name,player)=><div key={player} className={`tug-pair-row race-player--${player===0?'child':'adult'}`}>
      <span className="tug-pair-name">{name}</span><div className="tug-dot-row" aria-label={`${name}: ${race.dice[player]} точек`}>
        {Array.from({length:6},(_,n)=><i key={n} className="tug-dot" data-empty={n>=race.dice[player]} data-paired={paired&&n<minimum} data-used={paired&&n>=minimum&&(done||n<minimum+race.step)} data-active={race.phase==='moving'&&player===stronger&&n===minimum+race.step} />)}
      </div>
    </div>):<span className="tug-opening">Перетяни ленточку за свою линию</span>}
  </div>;
}

export function TugPreview() {
  const {art}=useTugArt();
  return <TugPicture art={art} position={0} preview />;
}
