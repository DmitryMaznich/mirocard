import { useCallback, useEffect, useReducer, useState } from "react";
import { useAppStore } from "@/core/store";
import { useRewardSettings } from "@/features/rewards/useRewardSettings";
import { useAudio } from "@/shared/hooks/useAudio";
import { normalizeRewardVideoIds } from "@/shared/utils/rewardVideoPicker";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { setBackInterceptor } from "@/shared/navigation/backInterceptor";
import { genitivePhrase } from "@/features/importantDates/importantDates";
import { FINISH, TUG_FINISH, comparisonAnswer, createRace, createTugOfWar, raceReducer, tugAddition, tugPullDirection } from "./raceEngine";
import { DiceFace, RaceCar } from "./RaceArt";
import RollingDice from "./RollingDice";
import TowerScene from "./TowerScene";
import { MAX_FLOORS } from "./towerGeometry";
import WaterScene from "./WaterScene";
import WaterCharacters from "./WaterCharacters";
import TugScene, { TugScoreboard } from "./TugScene";
import { WATER_CAPACITY,WATER_WIN } from "./waterGeometry";
import "./games.css";
import "./landscape.css";

function tugRoundStatus(race, names) {
  const direction = tugPullDirection(race.dice, race.step);
  if (!direction) return "Поровну. Канат на месте.";
  if (race.phase === "arriving") {
    const highRoll = Math.max(...race.dice);
    const lowRoll = Math.min(...race.dice);
    return `${highRoll} − ${lowRoll} = ${highRoll - lowRoll}`;
  }
  const player = direction < 0 ? 0 : 1;
  return `${names[player]} тянет на ${race.dice[player]}`;
}

function tugPlayerLabel(name, childSex) {
  const lower = name.toLowerCase();
  if (lower === "взрослый") return "У взрослого";
  if (/^(папа|мама|дедушка|бабушка|игрок)$/.test(lower)) return `У ${genitivePhrase(lower)}`;
  const simpleName = /^[А-ЯЁ][а-яё]+$/.test(name) && !/[ь]$/.test(name);
  return simpleName && (/[ая]$/.test(name) || childSex === "m") ? `У ${genitivePhrase(name)}` : name;
}

function RaceLane({ name, player, position }) {
  return <div className={`race-lane race-player--${player}`}>
    <div className="race-player-label"><span className="race-avatar" aria-hidden="true">{name.slice(0,1)}</span><strong>{name}</strong></div>
    <div className="race-track-wrap" role="img" aria-label={`${name}: ${position} из ${FINISH}`}>
      <div className="race-track"><div className="race-car" style={{ left: `${position / FINISH * 100}%` }}><RaceCar /><span>{position}</span></div><span className="race-finish" aria-hidden="true"><b>ФИНИШ</b></span></div>
      <div className="race-ticks" aria-hidden="true">{Array.from({ length: FINISH + 1 }, (_, n) => <span key={n} className={[0,5,10,15,FINISH].includes(n) ? "race-tick--major" : ""}><i />{[0,5,10,15,FINISH].includes(n) && <b>{n}</b>}</span>)}</div>
    </div>
  </div>;
}

function PlayerCard({ name, player, value, disabled, onDice }) {
  return <section className={`race-card race-player--${player}`} aria-label={`Кубик: ${name}`}>
    <h2>{name}</h2>
    <div className="race-numbers" role="group" aria-label={`Выпало у игрока ${name}`}>
      {[1,2,3,4,5,6].map(n => <button key={n} disabled={disabled} aria-label={`${name}: выпало ${n}`} aria-pressed={value === n} onClick={() => onDice(n)}>{n}</button>)}
    </div>
    <div className="race-dice-value"><span>{value ?? "—"}</span><DiceFace value={value} /></div>
  </section>;
}

function TugAddition({ race, disabled, onAnswer }) {
  const { previous, added, total, choices } = tugAddition(race);
  const correct = race.phase === "sumFeedback";
  return <>
    <div className="race-prompt">
      <strong id="race-question" role="status">Сколько очков стало?</strong>
      <b className="tug-equation">{previous} + {added} = {correct ? total : "?"}</b>
      {race.mistake && <span role="status">
        Начни с {previous}. Прибавь ещё {added}.
        <span className="tug-count-dots" aria-hidden="true">{Array.from({ length: added }, (_, n) => <i key={n} />)}</span>
      </span>}
      {correct && <span className="tug-correct" role="status">Верно!</span>}
    </div>
    <div className="race-options" role="group" aria-labelledby="race-question">
      {choices.map(choice => <button key={choice} className={`race-option${race.answer === choice ? correct ? " race-option--correct" : " race-option--wrong" : ""}`}
        disabled={disabled || correct} aria-pressed={race.answer === choice} onClick={() => onAnswer({ type: "sum", answer: choice })}>{choice}</button>)}
    </div>
  </>;
}

export default function GamesScreen() {
  const studentId = useAppStore(s => s.activeStudentId);
  const student = useAppStore(s => s.students.find(item => item.id === s.activeStudentId));
  const setScreen = useAppStore(s => s.setScreen);
  const modeId = useAppStore(s => s.activeModeId);
  const [gameNumber, setGameNumber] = useState(0);
  const [adultName, setAdultName] = useState("Папа");
  const [characters,setCharacters] = useState(()=>[student?.sex === "f" ? "girl" : "boy","man"]);
  if (!student) return <main className="games-home"><h1>Выберите ученика</h1><button className="games-primary" onClick={() => setScreen("home")}>На главный экран</button></main>;
  return <DiceRace key={`${studentId}-${modeId}-${gameNumber}`} isTower={modeId === "skyscrapers"} isWater={modeId === "water_fill"} isTug={modeId === "tug_of_war"} initialCharacters={characters} onCharactersChange={setCharacters} student={student} initialAdultName={adultName} onNameChange={setAdultName} onBack={() => setScreen("modes")} onReplay={() => setGameNumber(n => n + 1)} />;
}

function DiceRace({ student, isTower, isWater, isTug, initialCharacters, onCharactersChange, initialAdultName, onNameChange, onBack, onReplay }) {
  const [race, dispatch] = useReducer(raceReducer, undefined, () => isTug ? createTugOfWar() : createRace(isWater ? WATER_WIN : isTower ? MAX_FLOORS : FINISH, isWater ? WATER_CAPACITY : isTower ? MAX_FLOORS : FINISH, isWater, isWater));
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [adultName, setAdultName] = useState(initialAdultName);
  const [characters,setCharacters] = useState(initialCharacters);
  const { soundEnabled, toggleSound, playFeedback } = useAudio(false);
  const settings = useRewardSettings(student.id);
  // Capture the promised prize at the start of this game.
  const [rewardSettings] = useState(() => settings);
  const [rewardVideos] = useState(() => student.rewardVideos ?? []);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const childName = student.name || "Игрок";
  const adult = adultName.trim() || "Взрослый";
  const canCompare = isTug ? race.phase === "comparing" : race.phase === "input" && comparisonAnswer(race.dice) !== null;
  const adding = isTug && (race.phase === "adding" || race.phase === "sumFeedback");
  const comparisonFeedback = isTug && race.phase === "comparisonFeedback";
  const hasVideo = normalizeRewardVideoIds(rewardVideos).length > 0;
  const earnedVideo = race.result === "child" || race.result === "tie";
  const showResult = race.phase === "finished" && (!(isTower || isWater) || celebrated);
  const rewardOpen = showResult && earnedVideo && hasVideo && !rewardClaimed;
  const resultTitle = race.result === "tie" ? "Ничья!" : race.result === "child" ? `${childName} — победитель!` : `${adult} — победитель!`;
  const onSceneStep = useCallback(() => dispatch({type:"tick"}), []);
  const answerQuestion = action => {
    if (isTug) {
      const next = raceReducer(race, action);
      if (next === race) return;
      playFeedback(next.mistake ? "incorrect" : "correct");
    }
    dispatch(action);
  };

  useEffect(() => {
    if (!(isTower || isWater) || race.phase !== "finished" || paused) return undefined;
    const timer = setTimeout(() => setCelebrated(true),isWater ? 1800 : 1000);
    return () => clearTimeout(timer);
  },[isTower,isWater,race.phase,paused]);

  useEffect(() => {
    if (isTower || isWater || isTug || race.phase !== "moving" || paused) return undefined;
    const timer = setTimeout(() => dispatch({ type: "tick" }), 320);
    return () => clearTimeout(timer);
  }, [isTower, isWater, isTug, race.phase, race.step, paused]);

  useEffect(() => {
    if (paused) return undefined;
    const action = race.phase === "settling" ? "settled" : race.phase === "arriving" ? "arrived" : null;
    if (!action) return undefined;
    const duration = race.phase === "settling" ? 360 : 320;
    const timer = setTimeout(() => dispatch({ type: action }), duration);
    return () => clearTimeout(timer);
  }, [race.phase, paused]);

  useEffect(() => {
    if (paused || !["sumFeedback", "comparisonFeedback"].includes(race.phase)) return undefined;
    const timer = setTimeout(() => dispatch({ type: "advanceFeedback" }), 800);
    return () => clearTimeout(timer);
  }, [paused, race.phase]);

  useEffect(() => {
    setBackInterceptor(() => {
      if (rewardOpen) setRewardClaimed(true);
      else if (paused) setPaused(false);
      else if (started && race.phase !== "finished") setPaused(true);
      else onBack();
      return true;
    });
    return () => setBackInterceptor(null);
  }, [rewardOpen, paused, started, race.phase, onBack]);

  const rolling = race.phase === "rolling" || race.phase === "settling";
  const question = isTug ? "У кого больше очков на табло?" : isWater ? "Кто нальёт больше воды?" : isTower ? "Кто построит больше этажей?" : "Кто едет дальше?";
  const moving = race.phase === "moving" || race.phase === "arriving";
  const status = moving
    ? isTug ? tugRoundStatus(race, [childName, adult]) : isWater ? "Наливаем!" : isTower ? "Строим!" : "Поехали!"
    : isTug
      ? race.phase === "input" ? "Отметьте, что выпало на кубиках" : question
      : race.mistake ? "Посмотри на кубики ещё раз" : question;
  const answers = isTug
    ? [["child", tugPlayerLabel(childName, student.sex)], ["adult", tugPlayerLabel(adult)], ["equal", "Поровну"]]
    : [["child", childName], ["adult", adult], ["equal", "Одинаково"]];

  return <main className={`dice-race${isTower ? " dice-race--tower" : ""}${isWater ? " dice-race--water" : ""}${isTug ? " dice-race--tug" : ""}${isTower || isWater ? " dice-race--compact" : ""}`}>
    <div className="race-board" inert={!started || paused || rolling || race.phase === "finished"} aria-hidden={!started || paused || rolling || race.phase === "finished" || undefined}>
    <header className="games-header race-header">
      <button className="games-icon" aria-label="К списку игр" onClick={() => started && race.phase !== "finished" ? setPaused(true) : onBack()}><BackArrowIcon /></button>
      <h1>{isTug ? "Перетягивание каната" : isWater ? "Наливаем до краёв" : isTower ? "Дом до облаков" : "Гонки"}</h1><span className="race-round">Раунд {race.round}</span>
      {isTug && <button className="tug-sound" type="button" aria-pressed={soundEnabled} onClick={toggleSound}>Звук</button>}
    </header>
    {isTug ? <TugScene race={race} names={[childName, adult]} paused={paused} onStep={onSceneStep} /> : isWater ? <WaterScene race={race} names={[childName,adult]} characters={characters} paused={paused} onPortion={onSceneStep} /> : isTower ? <TowerScene race={race} names={[childName,adult]} paused={paused} onPlaced={onSceneStep} /> : <div className="race-course">
      <RaceLane name={childName} player="child" position={race.positions[0]} />
      <RaceLane name={adult} player="adult" position={race.positions[1]} />
    </div>}
    <div className="race-controls">
      {[childName, adult].map((name, i) => <PlayerCard key={i} name={name} player={i === 0 ? "child" : "adult"} value={race.dice[i]} disabled={!started || race.phase !== "input" || paused} onDice={value => dispatch({ type: "dice", player: i, value })} />)}
    </div>
    <footer className="race-footer">
      {adding ? <TugAddition race={race} disabled={!started || paused} onAnswer={answerQuestion} /> : <>
      {race.phase !== "between" && <div className="race-prompt">
        <strong id="race-question" role="status" aria-live="polite">{status}</strong>
        {isTug && race.phase === "comparing" && race.mistake && <span role="status">Посмотри на оба числа на табло.</span>}
        {comparisonFeedback && <span className="tug-correct" role="status">Верно!</span>}
      </div>}
      {race.phase === "between"
        ? <button className="games-primary race-next-throw" disabled={paused} onClick={() => dispatch({type:"nextThrow"})}>Бросить кубики</button>
        : (!isTug || canCompare || comparisonFeedback) && <div className="race-options" role="group" aria-label={question}>
          {answers.map(([answer, label]) => <button key={answer} className={`race-option${race.answer === answer ? race.mistake ? " race-option--wrong" : " race-option--correct" : ""}`} disabled={!started || !canCompare || paused} aria-pressed={race.answer === answer} onClick={() => answerQuestion({ type: "compare", answer })}>{label}</button>)}
        </div>}
      </>}
    </footer>
    </div>

    {started && rolling && <RollingDice key={race.round} childName={childName} adultName={adult} round={race.round} settling={race.phase === "settling"} paused={paused} onReady={() => dispatch({ type: "ready" })} onPause={() => setPaused(true)} />}

    {!started && <div className="games-overlay"><section className={`games-dialog${isWater ? " games-dialog--water" : ""}`} role="dialog" aria-modal="true" aria-labelledby="race-start-title">
      <span className="games-eyebrow">ИГРАЕМ ВДВОЁМ</span><h2 id="race-start-title">{isTug ? "Кто перетянет канат?" : isWater ? "У кого вода первой польётся через край?" : isTower ? "Чья башня дорастёт до облаков?" : "Кто первым до финиша?"}</h2>
      <p>{isTug ? "Бросьте по одному настоящему кубику и отметьте оба числа. После рывков посчитайте новые очки обоих игроков и сравните счёт на табло. При равных бросках сразу сравните счёт." : isWater ? "Бросайте настоящие кубики и сравнивайте числа. Одна точка на кубике — одна порция воды. На отметке 20 стакан полон. Выигрывает тот, у кого первым вода польётся через край." : isTower ? "Бросайте настоящие кубики и сравнивайте числа. Краны построят столько этажей, сколько выпало. Кто первым построит 20 этажей, тот победит." : "Бросайте настоящие кубики, сравнивайте числа и передвигайте машинки."}</p>
      <label className="race-adult-name">Второй игрок<input maxLength={24} value={adultName} onChange={e => setAdultName(e.target.value)} /></label>
      {isWater && <WaterCharacters values={characters} onChange={setCharacters} />}
      <p className="games-prize-rule">{isTug ? `В начале под флажком стоит ноль. Если к концу раунда отметка ${TUG_FINISH} дошла до флажка или прошла мимо него, побеждает игрок, который перетянул канат на свою сторону.${hasVideo ? " За победу ребёнка — любимое видео." : ""}` : hasVideo ? `Если побеждает ${childName} или получается ничья — любимое видео. Если побеждает второй игрок — без видео.` : isWater ? "Вода перелилась одновременно у обоих — ничья." : isTower ? "Оба небоскрёба достигли облаков в одном раунде — ничья." : "Финиш — на 19-й отметке. Побеждает тот, кто первым доберётся до него."}</p>
      <div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>К играм</button><button className="games-primary" autoFocus onClick={() => { setAdultName(adult); onNameChange(adult); onCharactersChange(characters); setStarted(true); }}>На старт!</button></div>
    </section></div>}

    {paused && <div className="games-overlay"><section className="games-dialog" role="dialog" aria-modal="true" aria-labelledby="race-pause-title"><h2 id="race-pause-title">Пауза</h2><p>{isTug ? "Канат подождёт." : isWater ? "Вода подождёт." : isTower ? "Краны подождут." : "Машинки подождут."}</p><div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>Закончить игру</button><button className="games-primary" autoFocus onClick={() => setPaused(false)}>Продолжить</button></div></section></div>}

    {showResult && !rewardOpen && <div className="games-overlay"><section className="games-dialog games-result" role="dialog" aria-modal="true" aria-labelledby="race-result-title">
      <span className="games-result-flag" aria-hidden="true">⚑</span><h2 id="race-result-title">{resultTitle}</h2>
      <p>{isTug ? `Канат перетянут на ${Math.abs(race.ropePosition)} делений!` : isWater ? race.result === "tie" ? "Вода перелилась через край одновременно у обоих!" : "Вода полилась через край!" : isTower ? race.result === "tie" ? "Оба небоскрёба доросли до облаков в одном раунде." : "Небоскрёб до облаков построен!" : race.result === "tie" ? "Обе машинки добрались до финиша в одном раунде." : "Первым до финиша добрался " + (race.result === "child" ? childName : adult) + "."}</p>
      {isTug && <TugScoreboard names={[childName, adult]} scores={race.pullScores} />}
      <div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>К играм</button><button className="games-primary" onClick={onReplay}>{isTug ? "Ещё поединок" : isWater ? "Наливать ещё" : isTower ? "Строить ещё" : "Ещё гонка"}</button></div>
    </section></div>}
    {rewardOpen && <RewardVideoModal studentId={student.id} rewardVideos={rewardVideos} settingsOverride={rewardSettings} title={resultTitle} continueLabel={isTug ? "Вернуться к канату" : isWater ? "Вернуться к воде" : isTower ? "Вернуться к стройке" : "Вернуться к гонке"} onDismiss={() => setRewardClaimed(true)} />}
  </main>;
}
