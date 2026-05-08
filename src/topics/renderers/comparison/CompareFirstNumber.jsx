import { useState } from "react";

// ── Числительные: именительный падеж ──────────────────────────────────────
const NOM_ONES  = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const NOM_TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
                   'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const NOM_TENS  = ['', '', 'двадцать', 'тридцать', 'сорок',
                   'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];

// ── Числительные: родительный падеж ───────────────────────────────────────
const GEN_ONES  = ['', 'одного', 'двух', 'трёх', 'четырёх', 'пяти', 'шести', 'семи', 'восьми', 'девяти'];
const GEN_TEENS = ['десяти', 'одиннадцати', 'двенадцати', 'тринадцати', 'четырнадцати',
                   'пятнадцати', 'шестнадцати', 'семнадцати', 'восемнадцати', 'девятнадцати'];
const GEN_TENS  = ['', '', 'двадцати', 'тридцати', 'сорока',
                   'пятидесяти', 'шестидесяти', 'семидесяти', 'восьмидесяти', 'девяноста'];

function toNom(n) {
  if (n >= 10 && n <= 19) return NOM_TEENS[n - 10];
  const t = Math.floor(n / 10), o = n % 10;
  if (t === 0) return NOM_ONES[o];
  if (o === 0) return NOM_TENS[t];
  return `${NOM_TENS[t]} ${NOM_ONES[o]}`;
}

function toGen(n) {
  if (n >= 10 && n <= 19) return GEN_TEENS[n - 10];
  const t = Math.floor(n / 10), o = n % 10;
  if (t === 0) return GEN_ONES[o];
  if (o === 0) return GEN_TENS[t];
  return `${GEN_TENS[t]} ${GEN_ONES[o]}`;
}

function wordVerdict(left, right) {
  const nomL = toNom(left);
  const cap  = nomL.charAt(0).toUpperCase() + nomL.slice(1);
  if (left === right) return `Одинаково! ${cap} и ${toNom(right)}`;
  if (left < right)  return `${cap} меньше ${toGen(right)}`;
  return `${cap} больше ${toGen(right)}`;
}

// ─────────────────────────────────────────────────────────────────────────

const OPTIONS = [
  { value: "less",  label: "Меньше", sign: "<" },
  { value: "equal", label: "Равно",  sign: "=" },
  { value: "more",  label: "Больше", sign: ">" },
];

const SIGN = { less: "<", equal: "=", more: ">" };

export default function CompareFirstNumber({ task, mode, onCorrect, onIncorrect, onAdvance }) {
  const [answered, setAnswered] = useState(false);

  const correct = task.question; // "less" | "equal" | "more"

  function handleAnswer(value) {
    if (answered) return;
    setAnswered(true);
    if (value === correct) onCorrect(task.conceptId, null);
    else                   onIncorrect(task.conceptId, null);
  }

  const stage = (
    <div className="cfn-stage">
      <div className="cfn-card cfn-card--first">
        <div className="cfn-label">первое</div>
        <div className="cfn-number">{task.left}</div>
      </div>
      <div className={`cfn-bridge${answered ? " cfn-bridge--shown" : ""}`}>
        {answered ? SIGN[correct] : "?"}
      </div>
      <div className="cfn-card cfn-card--second">
        <div className="cfn-label">второе</div>
        <div className="cfn-number">{task.right}</div>
      </div>
    </div>
  );

  if (answered) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={() => onAdvance()}>
        <div className="compare-instruction">Сравни первое число со вторым:</div>
        {stage}
        <div className="compare-verdict cfn-verdict-reveal">
          {wordVerdict(task.left, task.right)}
        </div>
      </button>
    );
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">Сравни первое число со вторым:</div>
      {stage}
      <div className="cfn-options">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="cfn-btn"
            onClick={() => handleAnswer(opt.value)}
          >
            <span className="cfn-btn-sign">{opt.sign}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
