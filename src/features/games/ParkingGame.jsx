import {useEffect,useReducer,useRef,useState} from 'react';
import {useUiTranslation} from '@/shared/i18n/useUiTranslation';
import {useRewardSettings} from '@/features/rewards/useRewardSettings';
import {normalizeRewardVideoIds} from '@/shared/utils/rewardVideoPicker';
import {setBackInterceptor} from '@/shared/navigation/backInterceptor';
import {BackArrowIcon} from '@/shared/components/ArrowIcons';
import RewardVideoModal from '@/shared/components/RewardVideoModal';
import {createParking,parkingReducer,parkingCanMove,parkingHint,PARKING_LEVELS,PARKING_MOVE_MS} from './parkingEngine';
import {ParkingSprite,ParkingBell,ParkingBuilding} from './ParkingArt';
import './games.css';
import './parking.css';

const CAR_KEYS=['parking.yellowCar','parking.blueCar','parking.redCar'];
const GARAGE_KEYS=['parking.yellowGarage','parking.blueGarage','parking.redGarage'];
const PALETTES=['yellow','blue','coral'];
const SYMBOLS=['●','▲','■'];

export default function ParkingGame({student,initialAdultName,onNameChange,onStart,onBack}) {
  const {t}=useUiTranslation();
  const settings=useRewardSettings(student.id);
  const [state,dispatch]=useReducer(parkingReducer,undefined,()=>createParking());
  const [configure,setConfigure]=useState(true),[level,setLevel]=useState('first');
  const [puzzleNumber,setPuzzleNumber]=useState(0);
  const [playMode,setPlayMode]=useState('solo');
  const [adultName,setAdultName]=useState(initialAdultName||t('parking.defaultPartner'));
  const [paused,setPaused]=useState(false),[hint,setHint]=useState(null);
  const [reward,setReward]=useState(null),[rewardClaimed,setRewardClaimed]=useState(false);
  const [soundEnabled,setSoundEnabled]=useState(true);
  const bellAudio=useRef(null);
  const names=[student.name||t('parking.child'),adultName.trim()||t('parking.defaultPartner')];
  const finished=state.phase==='finished',celebrating=state.phase==='celebrating';
  const ready=state.phase==='ready',locked=configure||paused||state.phase!=='playing';
  const hasVideo=normalizeRewardVideoIds(configure?student.rewardVideos??[]:reward?.videos??[]).length>0;
  const rewardOpen=finished&&!configure&&hasVideo&&!rewardClaimed;
  const together=state.playMode==='together';
  const celebrationText=t(together?'parking.celebrating':'parking.soloCelebrating');

  useEffect(()=>{
    if(paused||state.phase!=='moving')return undefined;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer=setTimeout(()=>dispatch({type:'settled'}),reduced?60:PARKING_MOVE_MS);
    return()=>clearTimeout(timer);
  },[state.phase,paused]);
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
    onStart();
    if(playMode==='together'){const name=adultName.trim()||t('parking.defaultPartner');setAdultName(name);onNameChange(name);}
    setPuzzleNumber(number=>number+1);dispatch({type:'new',puzzle:createParking(level,Math.random,playMode)});setHint(null);setPaused(false);
    setReward({settings,videos:[...(student.rewardVideos??[])]});setRewardClaimed(false);setConfigure(false);
  }
  function move(index) {
    if(locked||!parkingCanMove(state,index))return;
    setHint(null);
    dispatch({type:'move',index});
  }
  function ring() {
    if(!ready||paused||configure)return;
    const sound=bellAudio.current;
    if(soundEnabled&&sound){
      sound.currentTime=0;
      sound.play().catch(()=>{});
    }
    dispatch({type:'bell'});
  }
  function toggleSound() {
    if(soundEnabled)bellAudio.current?.pause();
    setSoundEnabled(!soundEnabled);
  }
  function showHint() {
    const index=parkingHint(state);
    setHint(index===null?null:state.board[index].id);
  }

  const vacancy=state.board.indexOf(null);
  const lanes=state.palette.map(color=>({color:PALETTES[color],label:t(GARAGE_KEYS[color]),symbol:SYMBOLS[color]}));
  return <main className="games-home parking-game" data-paused={paused}>
    <audio ref={bellAudio} src="/game-art/parking-v1/bell.mp3" preload="auto" />
    <div className="parking-content" inert={configure||paused||rewardOpen||finished} aria-hidden={configure||paused||rewardOpen||finished||undefined}>
      <header className="parking-header">
        <button className="games-icon" aria-label={t('parking.back')} onClick={()=>setPaused(true)}><BackArrowIcon /></button>
      </header>
      <div className="parking-turn" role="status">
        {together&&!ready&&!celebrating&&!finished&&<span className="parking-player" data-active="true">{t('parking.turn',{name:names[state.turn]})}</span>}
      </div>
      <span className="parking-announcement" role="status">
        {ready?t('parking.ready'):celebrating?celebrationText:''}
      </span>
      <div className="parking-play-area">
        <div className="parking-play-layout">
          <section key={puzzleNumber} className="parking-lot" data-phase={state.phase}
            style={{'--columns':state.columns,'--rows':state.rows}} aria-label={t('parking.board')}>
            <ParkingBuilding title={t('parking.title')} lanes={lanes} onClosed={()=>dispatch({type:'celebrated'})} />
            <div className="parking-grid" data-phase={state.phase} data-play-mode={state.playMode} data-turn={state.turn} data-moves={state.moves}>
              <div className="parking-lanes" aria-hidden="true">
                {lanes.map(({color})=><div key={color} data-color={color} />)}
              </div>
              <div className="parking-traffic">
                {!celebrating&&!finished&&<div className="parking-empty" role="img" aria-label={t('parking.empty')}
                  style={{'--column':vacancy%state.columns,'--row':Math.floor(vacancy/state.columns)}}><span /></div>}
                {state.board.map((car,index)=>{
                  if(!car)return null;
                  const movable=parkingCanMove(state,index);
                  const color=state.palette[car.color];
                  return <button key={car.id} className="parking-piece" data-car={car.id} data-index={index}
                    data-color={car.color} data-movable={movable} data-hint={hint===car.id}
                    disabled={locked} aria-disabled={locked||!movable} aria-label={t(CAR_KEYS[color])}
                    onClick={()=>move(index)} style={{'--column':index%state.columns,'--row':Math.floor(index/state.columns)}}>
                    <span className="parking-piece-surface">
                      <ParkingSprite color={color} /><span className="parking-shape" aria-hidden="true">{SYMBOLS[color]}</span>
                    </span>
                  </button>;
                })}
              </div>
            </div>
          </section>
          <div className="parking-actions">
            <button type="button" className="parking-bell" hidden={!ready&&!celebrating} disabled={celebrating}
              data-ringing={celebrating} aria-hidden={celebrating||undefined} aria-label={t('parking.bellLabel')} onClick={ring}>
              <ParkingBell />
            </button>
            {(state.phase==='playing'||state.phase==='moving')&&<button className="parking-hint" disabled={locked} onClick={showHint}>{t('parking.hint')}</button>}
          </div>
        </div>
      </div>
    </div>
    {configure&&<div className="games-overlay"><section className="games-dialog parking-dialog" role="dialog" aria-modal="true" aria-labelledby="parking-start-title"><h2 id="parking-start-title">{t(playMode==='solo'?'parking.soloIntroTitle':'parking.introTitle')}</h2><p>{t('parking.intro')}</p><p>{t(playMode==='solo'?'parking.soloRule':'parking.turnRule')}</p><fieldset className="parking-levels parking-mode-picker"><legend>{t('parking.playMode')}</legend><div role="radiogroup" aria-label={t('parking.playMode')}>{['solo','together'].map(mode=><button type="button" key={mode} role="radio" aria-checked={playMode===mode} onClick={()=>setPlayMode(mode)}><strong>{t('parking.'+mode)}</strong><span>{t('parking.'+mode+'Detail')}</span></button>)}</div></fieldset>{playMode==='together'&&<label className="race-adult-name">{t('parking.partner')}<input maxLength={24} value={adultName} onChange={event=>setAdultName(event.target.value)} /></label>}<fieldset className="parking-levels"><legend>{t('parking.level')}</legend><div role="radiogroup" aria-label={t('parking.level')}>{Object.keys(PARKING_LEVELS).map(id=><button type="button" key={id} role="radio" aria-checked={level===id} onClick={()=>setLevel(id)}><strong>{t('parking.'+id)}</strong><span>{t('parking.'+id+'Detail')}</span></button>)}</div></fieldset><p className="games-prize-rule">{t(hasVideo?'parking.rewardRule':'parking.noVideoRule')}</p><div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>{t('parking.back')}</button><button className="games-primary" autoFocus onClick={begin}>{t('parking.start')}</button></div></section></div>}
    {paused&&<div className="games-overlay">
      <section className="games-dialog" role="dialog" aria-modal="true" aria-labelledby="parking-pause-title">
        <h2 id="parking-pause-title">{t('parking.pause')}</h2>
        <p>{t('parking.pauseText')}</p>
        <div className="games-dialog-actions">
          <button className="games-secondary" onClick={onBack}>{t('parking.end')}</button>
          <button className="parking-sound" aria-pressed={soundEnabled} onClick={toggleSound}>{t('parking.sound')}</button>
          <button className="games-primary" autoFocus onClick={()=>setPaused(false)}>{t('parking.continue')}</button>
        </div>
      </section>
    </div>}
    {finished&&!rewardOpen&&!configure&&<div className="games-overlay"><section className="games-dialog" role="dialog" aria-modal="true" aria-labelledby="parking-result-title"><h2 id="parking-result-title">{t('parking.result')}</h2><p>{celebrationText}</p><div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>{t('parking.back')}</button><button className="games-primary" autoFocus onClick={begin}>{t('parking.replay')}</button><button className="games-secondary" onClick={()=>setConfigure(true)}>{t('parking.configure')}</button></div></section></div>}
    {rewardOpen&&<RewardVideoModal studentId={student.id} rewardVideos={reward.videos} settingsOverride={reward.settings} title={t('parking.result')} continueLabel={t('parking.return')} onDismiss={()=>setRewardClaimed(true)} />}
  </main>;
}
