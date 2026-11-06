import { useEffect, useReducer, useState } from "react";
import { useAppStore } from "@/core/store";
import { useRewardSettings } from "@/features/rewards/useRewardSettings";
import { normalizeRewardVideoIds } from "@/shared/utils/rewardVideoPicker";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { setBackInterceptor } from "@/shared/navigation/backInterceptor";
import { FINISH, comparisonAnswer, createRace, raceReducer } from "./raceEngine";
import { DiceFace, RaceCar } from "./RaceArt";
import "./games.css";

function RaceLane({ name, player, position }) {
  return <div className={`race-lane race-player--${player}`}>
    <div className="race-player-label"><span className="race-avatar" aria-hidden="true">{name.slice(0,1)}</span><strong>{name}</strong></div>
    <div className="race-track-wrap" role="img" aria-label={`${name}: ${position} из ${FINISH}`}>
      <div className="race-track"><div className="race-car" style={{ left: `${position / FINISH * 100}%` }}><RaceCar /><span>{position}</span></div><span className="race-finish" aria-hidden="true"><b>ФИНИШ</b></span></div>
      <div className="race-ticks" aria-hidden="true">{Array.from({ length: FINISH + 1 }, (_, n) => <span key={n} className={[0,5,10,15,FINISH].includes(n) ? "race-tick--major" : ""}><i />{[0,5,10,15,FINISH].includes(n) && <b>{n}</b>}</span>)}</div>
    </div>
  </div>;
}

function PlayerCard({ name, player, value, disabled, canCompare, compared, onDice, onCompare }) {
  return <section className={`race-card race-player--${player}`} aria-label={`Кубик: ${name}`}>
    <h2>{name}</h2>
    <div className="race-numbers" role="group" aria-label={`Выпало у игрока ${name}`}>
      {[1,2,3,4,5,6].map(n => <button key={n} disabled={disabled} aria-label={`${name}: выпало ${n}`} aria-pressed={value === n} onClick={() => onDice(n)}>{n}</button>)}
    </div>
    <button className="race-answer" disabled={!canCompare || disabled || compared} aria-label={`Больше у игрока ${name}`} onClick={onCompare}>
      <span>{value ?? "—"}</span><DiceFace value={value} />
    </button>
  </section>;
}

export default function GamesScreen() {
  const studentId = useAppStore(s => s.activeStudentId);
  const student = useAppStore(s => s.students.find(item => item.id === s.activeStudentId));
  const setScreen = useAppStore(s => s.setScreen);
  const [gameNumber, setGameNumber] = useState(0);
  const [adultName, setAdultName] = useState("Папа");
  if (!student) return <main className="games-home"><h1>Выберите ученика</h1><button className="games-primary" onClick={() => setScreen("home")}>На главный экран</button></main>;
  return <DiceRace key={`${studentId}-${gameNumber}`} student={student} initialAdultName={adultName} onNameChange={setAdultName} onBack={() => setScreen("modes")} onReplay={() => setGameNumber(n => n + 1)} />;
}

function DiceRace({ student, initialAdultName, onNameChange, onBack, onReplay }) {
  const [race, dispatch] = useReducer(raceReducer, undefined, createRace);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [adultName, setAdultName] = useState(initialAdultName);
  const settings = useRewardSettings(student.id);
  // Capture the promised prize at the start of this game.
  const [rewardSettings] = useState(() => settings);
  const [rewardVideos] = useState(() => student.rewardVideos ?? []);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const childName = student.name || "Игрок";
  const adult = adultName.trim() || "Взрослый";
  const canCompare = comparisonAnswer(race.dice) !== null;
  const hasVideo = normalizeRewardVideoIds(rewardVideos).length > 0;
  const earnedVideo = race.result === "child" || race.result === "tie";
  const rewardOpen = race.phase === "finished" && earnedVideo && hasVideo && !rewardClaimed;
  const resultTitle = race.result === "tie" ? "Ничья!" : race.result === "child" ? `${childName} — победитель!` : `${adult} — победитель!`;

  useEffect(() => {
    if (race.phase !== "moving" || paused) return undefined;
    const timer = setTimeout(() => dispatch({ type: "tick" }), 320);
    return () => clearTimeout(timer);
  }, [race.phase, race.step, paused]);

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

  const status = race.phase === "moving" ? "Поехали!" : race.compared ? `${race.dice[0]} ${race.dice[0] === race.dice[1] ? "=" : race.dice[0] > race.dice[1] ? ">" : "<"} ${race.dice[1]}. Поехали!` : race.mistake ? "Посмотри на кубики ещё раз" : canCompare ? "У кого выпало больше?" : "Бросьте кубики и отметьте числа";

  return <main className="dice-race">
    <div className="race-board" inert={!started || paused || race.phase === "finished"}>
    <header className="games-header race-header">
      <button className="games-icon" aria-label="К списку игр" onClick={() => started && race.phase !== "finished" ? setPaused(true) : onBack()}><BackArrowIcon /></button>
      <h1>Гонки</h1><span className="race-round">Раунд {race.round}</span>
      <button className="games-icon race-pause" aria-label="Пауза" disabled={!started || race.phase === "finished"} onClick={() => setPaused(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg></button>
    </header>
    <div className="race-course">
      <RaceLane name={childName} player="child" position={race.positions[0]} />
      <RaceLane name={adult} player="adult" position={race.positions[1]} />
    </div>
    <div className="race-controls">
      {[childName, adult].map((name, i) => <PlayerCard key={i} name={name} player={i === 0 ? "child" : "adult"} value={race.dice[i]} disabled={!started || race.phase !== "input" || paused} canCompare={canCompare} compared={race.compared} onDice={value => dispatch({ type: "dice", player: i, value })} onCompare={() => dispatch({ type: "compare", answer: i === 0 ? "child" : "adult" })} />)}
    </div>
    <footer className="race-footer">
      <div className="race-prompt"><strong role="status" aria-live="polite">{status}</strong><span>{canCompare && !race.compared && race.phase === "input" ? "Нажми на большой кубик игрока или выбери «Поровну»" : "Каждая машинка едет на выпавшее число шагов"}</span></div>
      <div className="race-actions"><button className="games-secondary" disabled={!started || !canCompare || race.compared || race.phase !== "input" || paused} onClick={() => dispatch({ type: "compare", answer: "equal" })}>Поровну</button><button className="games-primary" disabled={!started || !race.compared || race.phase !== "input" || paused} onClick={() => dispatch({ type: "move" })}>Поехали <span aria-hidden="true">→</span></button></div>
    </footer>
    </div>

    {!started && <div className="games-overlay"><section className="games-dialog" role="dialog" aria-modal="true" aria-labelledby="race-start-title">
      <span className="games-eyebrow">ИГРАЕМ ВДВОЁМ</span><h2 id="race-start-title">Кто первым до финиша?</h2>
      <p>Бросайте настоящие кубики, сравнивайте числа и передвигайте машинки.</p>
      <label className="race-adult-name">Второй игрок<input maxLength={24} value={adultName} onChange={e => setAdultName(e.target.value)} /></label>
      <p className="games-prize-rule">{hasVideo ? `Если побеждает ${childName} или получается ничья — любимое видео. Если побеждает второй игрок — без видео.` : "Финиш — на 19-й отметке. Побеждает тот, кто первым доберётся до него."}</p>
      <div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>К играм</button><button className="games-primary" autoFocus onClick={() => { setAdultName(adult); onNameChange(adult); setStarted(true); }}>На старт!</button></div>
    </section></div>}

    {paused && <div className="games-overlay"><section className="games-dialog" role="dialog" aria-modal="true" aria-labelledby="race-pause-title"><h2 id="race-pause-title">Пауза</h2><p>Машинки подождут.</p><div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>Закончить игру</button><button className="games-primary" autoFocus onClick={() => setPaused(false)}>Продолжить</button></div></section></div>}

    {race.phase === "finished" && !rewardOpen && <div className="games-overlay"><section className="games-dialog games-result" role="dialog" aria-modal="true" aria-labelledby="race-result-title">
      <span className="games-result-flag" aria-hidden="true">⚑</span><h2 id="race-result-title">{resultTitle}</h2>
      <p>{race.result === "tie" ? "Обе машинки добрались до финиша в одном раунде." : "Первым до финиша добрался " + (race.result === "child" ? childName : adult) + "."}</p>
      <div className="games-dialog-actions"><button className="games-secondary" onClick={onBack}>К играм</button><button className="games-primary" onClick={onReplay}>Ещё гонка</button></div>
    </section></div>}
    {rewardOpen && <RewardVideoModal studentId={student.id} rewardVideos={rewardVideos} settingsOverride={rewardSettings} title={resultTitle} continueLabel="Вернуться к гонке" onDismiss={() => setRewardClaimed(true)} />}
  </main>;
}
