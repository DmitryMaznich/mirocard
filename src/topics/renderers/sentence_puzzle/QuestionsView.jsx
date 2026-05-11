import { useState } from "react";
import { SLOT_TYPES } from "./SentenceRow";

function adjNominative(label) {
  if (!label) return "___";
  if (label.endsWith("юю")) return label.slice(0, -2) + "яя";
  if (label.endsWith("ую")) return label.slice(0, -2) + "ая";
  return label;
}

function buildSentence(placed, structure) {
  return SLOT_TYPES[structure]
    .map((t) => placed[t]?.label ?? "___")
    .join(" ") + ".";
}

function buildQuestions(placed, structure) {
  const subj   = placed.subject?.label?.toLowerCase()  ?? "___";
  const verb   = placed.verb?.label                    ?? "___";
  const objAcc = placed.object?.label                  ?? "___";
  const objNom = placed.object?.nominative             ?? "___";
  const adjNom = adjNominative(placed.adjective?.label);

  if (structure === "simple") {
    return [
      { q: `Кто ${verb}?`,                answer: placed.subject?.label ?? "___" },
      { q: `Что делает ${subj}?`,         answer: verb },
    ];
  }

  return [
    { q: `Кто ${verb} ${objAcc}?`,        answer: placed.subject?.label ?? "___" },
    { q: `Что делает ${subj}?`,           answer: verb },
    { q: `Что ${subj} ${verb}?`,          answer: objAcc },
    { q: `Какая ${objNom}?`,              answer: adjNom },
  ];
}

function QuestionItem({ item, index }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="sp-q-item">
      <span className="sp-q-num">{index + 1}.</span>
      <div className="sp-q-body">
        <span className="sp-q-text">{item.q}</span>
        {revealed
          ? <span className="sp-q-answer">{item.answer}</span>
          : <button className="sp-q-reveal-btn" onClick={() => setRevealed(true)}>показать ответ</button>
        }
      </div>
    </div>
  );
}

function SentenceBlock({ placed, structure, blockIndex }) {
  const sentence  = buildSentence(placed, structure);
  const questions = buildQuestions(placed, structure);

  return (
    <div className="sp-sentence-block">
      <p className="sp-sentence-text">
        <span className="sp-sentence-num">{blockIndex + 1}.</span> {sentence}
      </p>
      <div className="sp-q-list">
        {questions.map((item, i) => (
          <QuestionItem key={i} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}

export default function QuestionsView({ rows, structure, onNewRound, onBack }) {
  return (
    <div className="sp-questions-screen">
      <div className="sp-questions-body">
        {rows.map((placed, i) => (
          <SentenceBlock key={i} placed={placed} structure={structure} blockIndex={i} />
        ))}
      </div>
      <div className="sp-questions-actions">
        <button className="sp-btn sp-btn--secondary" onClick={onBack}>← Назад к пазлу</button>
        <button className="sp-btn sp-btn--primary"   onClick={onNewRound}>Новое задание →</button>
      </div>
    </div>
  );
}
