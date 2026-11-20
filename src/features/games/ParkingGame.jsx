import {useEffect,useReducer,useState} from 'react';
import {useUiTranslation} from '@/shared/i18n/useUiTranslation';
import {useRewardSettings} from '@/features/rewards/useRewardSettings';
import {normalizeRewardVideoIds} from '@/shared/utils/rewardVideoPicker';
import {useAudio} from '@/shared/hooks/useAudio';
import {setBackInterceptor} from '@/shared/navigation/backInterceptor';
import {BackArrowIcon} from '@/shared/components/ArrowIcons';
import RewardVideoModal from '@/shared/components/RewardVideoModal';
import {createParking,parkingReducer,parkingCanMove,parkingHint,PARKING_LEVELS,PARKING_MOVE_MS} from './parkingEngine';
import {ParkingSprite,ParkingBell} from './ParkingArt';
import './games.css';
import './parking.css';

const CAR_KEYS=['parking.yellowCar','parking.blueCar','parking.redCar'];
const GARAGE_KEYS=['parking.yellowGarage','parking.blueGarage','parking.redGarage'];
const COLORS=['#e8b73d','#488dd1','#e87865'];
const SYMBOLS=['●','▲','■'];

export default function ParkingGame({student,initialAdultName,onNameChange,onBack}) {
  const {t}=useUiTranslation();
  const settings=useRewardSettings(student.id);
  const [state,dispatch]=useReducer(parkingReducer,undefined,()=>createParking());
  const [configure,setConfigure]=useState(true),[level,setLevel]=useState('first');
  const [puzzleNumber,setPuzzleNumber]=useState(0);
  const [playMode,setPlayMode]=useState('solo');
  const [adultName,setAdultName]=useState(initialAdultName||t('parking.defaultPartner'));
  const [paused,setPaused]=useState(false),[hint,setHint]=useState(null),[notice,setNotice]=useState(false);
  const [reward,setReward]=useState(null),[rewardClaimed,setRewardClaimed]=useState(false);
  const {soundEnabled,toggleSound,playFeedback}=useAudio(false);
  const names=[student.name||t('parking.child'),adultName.trim()||t('parking.defaultPartner')];
  const finished=state.phase==='finished',celebrating=state.phase==='celebrating';
  const ready=state.phase==='ready',locked=configure||paused||state.phase!=='playing';
  const hasVideo=normalizeRewardVideoIds(configure?student.rewardVideos??[]:reward?.videos??[]).length>0;
  const rewardOpen=finished&&!configure&&hasVideo&&!rewardClaimed;
  const together=state.playMode==='together';
  const celebrationText=t(together?'parking.celebrating':'parking.soloCelebrating');

  useEffect(()=>{
    if(paused)return undefined;
    const action=state.phase==='moving'?'settled':celebrating?'celebrated':null;
    if(!action)return undefined;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer=setTimeout(()=>dispatch({type:action}),celebrating?1200:reduced?60:PARKING_MOVE_MS);
    return()=>clearTimeout(timer);
  },[state.phase,celebrating,paused]);
  useEffect(()=>{
    setBackInterceptor(()=>{
      if(rewardOpen)setRewardClaimed(true);
      else if(configure||finished)onBack();
      else setPaused(value=>!value);
      return true;
    });
    return()=>setBackInterceptor(null);
  },[rewardOpen,configure,finished,onBack]);

  function begin() {
    if(playMode==='together'){const name=adultName.trim()||t('parking.defaultPartner');setAdultName(name);onNameChange(name);}
    setPuzzleNumber(number=>number+1);dispatch({type:'new',puzzle:createParking(level,Math.random,playMode)});setHint(null);setNotice(false);setPaused(false);
    setReward({settings,videos:[...(student.rewardVideos??[])]});setRewardClaimed(false);setConfigure(false);
  }
  function move(index) {
    if(locked)return;
    if(!parkingCanMove(state,index)){setNotice(true);return;}
    setHint(null);setNotice(false);dispatch({type:'move',index});
  }
  function ring() {
    if(!ready||paused||configure)return;
    playFeedback('correct');dispatch({type:'bell'});
  }
  const status=ready?t('parking.ready'):celebrating||finished?celebrationText:state.phase==='moving'?t('parking.moving'):t(together?'parking.turn':'parking.soloTurn',{name:names[state.turn]});
  const guides=PARKING_LEVELS[state.level].guides;
  return <main className={`games-home parking-game${paused?' parking-game--paused':''}${celebrating||finished?' parking-game--won':''}`}>
    <div className="parking-content" inert={configure||paused||rewardOpen||finished} aria-hidden={configure||paused||rewardOpen||finished||undefined}>
      <header className="games-header parking-header">
        <button className="games-icon" aria-label={t('parking.back')} onClick={()=>setPaused(true)}><BackArrowIcon /></button>
        <h1>{t('parking.title')}</h1>
        <button className="parking-sound" aria-pressed={soundEnabled} onClick={toggleSound}>{t('parking.sound')}</button>
      </header>
      <div className="parking-turns" aria-label={status}>
        {(together?names:names.slice(0,1)).map((name,index)=><div key={index} className={`parking-player parking-player--${index}`} data-active={state.phase==='playing'&&state.turn===index} aria-current={state.phase==='playing'&&state.turn===index?'true':undefined}><span className="parking-initial" aria-hidden="true">{ready||celebrating||finished?'✓':name.slice(0,1)}</span><strong>{name}</strong></div>)}
      </div>
      <div className="parking-status" role="status" aria-live="polite">{status}</div>
      <div className="parking-play-area">
        <section key={puzzleNumber} className="parking-lot" style={{'--columns':state.columns,'--rows':state.rows}} aria-label={t('parking.board')}>
          <div className="parking-grid" data-phase={state.phase} data-play-mode={state.playMode} data-turn={state.turn} data-moves={state.moves}>
            <div className="parking-lanes" aria-hidden="true">{state.palette.map((color,i)=><div key={i} style={{'--lane-color':COLORS[color]}} />)}</div>
            <div className="parking-slots" aria-hidden="true">{state.board.map((_,i)=><div key={i} />)}</div>
            <div className="parking-empty" role="img" aria-label={t('parking.empty')} style={{'--column':state.board.indexOf(null)%state.columns,'--row':Math.floor(state.board.indexOf(null)/state.columns)}}><span /></div>
            {state.board.map((car,index)=>car&&<button key={car.id} className="parking-piece" data-car={car.id} data-index={index} data-color={car.color} data-movable={parkingCanMove(state,index)} data-guide={guides&&parkingCanMove(state,index)} data-hint={hint===car.id} disabled={locked} aria-label={t(CAR_KEYS[state.palette[car.color]])} aria-disabled={locked||!parkingCanMove(state,index)} onClick={()=>move(index)} style={{'--column':index%state.columns,'--row':Math.floor(index/state.columns),'--car-color':COLORS[state.palette[car.color]]}}><span className="parking-piece-surface"><ParkingSprite color={state.palette[car.color]} /><span className="parking-shape" aria-hidden="true">{SYMBOLS[state.palette[car.color]]}</span></span></button>)}
          </div>
          <div className="parking-garages">{state.palette.map((color,i)=><div key={i} className="parking-garage" style={{'--garage-color':COLORS[color]}} role="img" aria-label={t(GARAGE_KEYS[color])}><ParkingSprite color={color} garage /><span className="parking-garage-shape" aria-hidden="true">{SYMBOLS[color]}</span></div>)}</div>
        </section>
        <aside className="parking-actions">
          <button className="parking-bell" data-ready={ready} disabled={!ready||paused||configure} aria-label={t('parking.bellLabel')} onClick={ring}><ParkingBell /><strong>{t('parking.bell')}</strong></button>
          <button className="parking-hint" disabled={locked} onClick={()=>{const index=parkingHint(state);setHint(index===null?null:state.board[index].id);setNotice(false);}}>{t('parking.hint')}</button>
        </aside>
      </div>
      <p className="parking-help" aria-live="polite">{state.phase==='playing'?t(hint&&!notice?'parking.hintMessage':'parking.instruction'):'\u00a0'}</p>
    </div>
    {configure&&<div className="games-overlay"><section className="games-dialog parking-dialog" role="dialog" aria-modal="true" aria-labelledby="parking-start-title"><h2 id="parking-start-title">{t(playMode==='solo'?'parking.soloIntroTitle':'parking.introTitle')}</h2><p>{t('parking.intro')}</p><p>{t(playMode==='solo'?'parking.soloRule':'parking.turnRule')}</p><fieldset className="parking-levels parking-mode-picker"><legend>{t('parking.playMode')}</legend><div role="radiogroup" aria-label={t('parking.playMode')}>{['solo','together'].map(mode=><button type="button" key={mode} role="radio" aria-checked={playMode===mode} onClick={()=>setPlayMode(mode)}><strong>{t('parking.'+mode)}</strong><span>{t('parking.'+mode+'Detail')}</span></button>)}</div></fieldset>{playMode==='together'&&<label className="race-adult-name">{t('parking.partner')}<input maxLength={24} value={adultName} onChange={event=>setAdultName(event.target.value)} /></label>}<fieldset className="parking-levels"><legend>{t('parking.level')}</legend><div role="radiogroup" aria-label={t('parking.level')}>{Object.keys(PARKING_LEVELS).map(id=><button type="button" key={id} role="radio" aria-checked={level===id} onClick={()=>setLevel(id)}><strong>{t('parking.'+id)}</strong><span>{t('parking.'+id+'Detail')}</span></button>)}</div></fieldset><p className="games-prize-rule">{t(hasVideo?'parking.rewardRule':'parking.noVideoRule')}</p><div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>{t('parking.back')}</button><button className="games-primary" autoFocus onClick={begin}>{t('parking.start')}</button></div></section></div>}
    {paused&&<div className="games-overlay"><section className="games-dialog" role="dialog" aria-modal="true" aria-labelledby="parking-pause-title"><h2 id="parking-pause-title">{t('parking.pause')}</h2><p>{t('parking.pauseText')}</p><div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>{t('parking.end')}</button><button className="games-primary" autoFocus onClick={()=>setPaused(false)}>{t('parking.continue')}</button></div></section></div>}
    {finished&&!rewardOpen&&!configure&&<div className="games-overlay"><section className="games-dialog" role="dialog" aria-modal="true" aria-labelledby="parking-result-title"><h2 id="parking-result-title">{t('parking.result')}</h2><p>{celebrationText}</p><div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>{t('parking.back')}</button><button className="games-primary" autoFocus onClick={begin}>{t('parking.replay')}</button><button className="games-secondary" onClick={()=>setConfigure(true)}>{t('parking.configure')}</button></div></section></div>}
    {rewardOpen&&<RewardVideoModal studentId={student.id} rewardVideos={reward.videos} settingsOverride={reward.settings} title={t('parking.result')} continueLabel={t('parking.return')} onDismiss={()=>setRewardClaimed(true)} />}
  </main>;
}
