import {comparisonAnswer,tugDistance,tugPullDirection} from "./raceEngine";

export default function TugControls({race,names,paused,onAnswer,onNext}) {
  if(race.phase === "between") return <button className="games-primary race-next-throw" disabled={paused} onClick={onNext}>Бросить кубики</button>;
  const distance=tugDistance(race.dice);
  const counting=race.phase === "counting" || (race.phase === "pairing" && race.countMoves && distance>0);
  const choosing=race.phase === "input" || race.phase === "counting" || race.phase === "pairing";
  const canAnswer=!paused && (race.phase === "counting" || (race.phase === "input" && comparisonAnswer(race.dice)!==null));
  const question=counting ? "Сколько точек осталось?" : "У кого выпало больше?";
  const choices=counting ? [1,2,3,4,5].map(n=>[n,String(n)]) : [["child",names[0]],["adult",names[1]],["equal","Одинаково"]];
  const selected=counting ? race.countAnswer : race.answer;
  const direction=tugPullDirection(race.dice);
  const status=race.phase === "finished" ? "Пять бросков позади!" : direction ? `${names[direction<0 ? 0 : 1]} тянет канат` : "Одинаково. Канат на месте.";
  return <>
    <div className="race-prompt"><strong id="race-question" role="status" aria-live="polite">{choosing ? question : status}</strong></div>
    {choosing && <div className={`race-options${counting ? " tug-count-options" : ""}`} role="group" aria-label={question}>
      {choices.map(([answer,label])=><button key={answer} className={`race-option${selected===answer ? race.mistake ? " race-option--wrong" : " race-option--correct" : ""}`} disabled={!canAnswer} aria-pressed={selected===answer} onClick={()=>onAnswer({type:counting ? "count" : "compare",answer})}>{label}</button>)}
    </div>}
    <div className="tug-help" aria-live="polite">{race.mistake ? counting ? "Сосчитай яркие точки." : "Сравни точки на кубиках. Поставим их попарно." : counting ? "Сосчитай яркие точки." : ""}</div>
  </>;
}
