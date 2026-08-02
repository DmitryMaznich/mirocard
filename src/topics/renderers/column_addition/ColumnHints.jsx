import { useMemo, useState } from "react";

const place = { units: "единицы", tens: "десятки", hundreds: "сотни" };

function hintFor({ task, phase, formActiveStep, activeStep, showingCompare, solved }) {
  if (solved) return ["Готово", "Пример решён!", "Посмотри на ответ сверху и похвали себя за каждый выполненный шаг."];
  if (phase === "form" && formActiveStep) {
    const { cellKey, value } = formActiveStep;
    if (cellKey === "sign") return ["Шаг 1", "Поставь знак", `Нажми «${value}».`];
    if (cellKey === "line") return ["Шаг 1", "Проведи черту", "Нажми кнопку с чертой. Под ней будет ответ."];
    const [row, position] = cellKey.split(":");
    return ["Шаг 1", "Собираем столбик", `Впиши ${value} в ${place[position]} ${row === "top" ? "верхнего" : "нижнего"} числа.`];
  }
  if (!activeStep) return ["Подсказка", "Подожди немного", "Сейчас появится следующий шаг."];
  const col = task.columns.find((item) => item.position === activeStep.position);
  const label = place[activeStep.position];
  if (activeStep.cellType === "carry") return ["Шаг 2", "Переносим десяток", `В ${label} получилось больше 9. Перенеси 1 в маленькую клетку сверху.`];
  if (activeStep.cellType === "borrow") return showingCompare
    ? ["Шаг 2", "Проверяем: хватает ли?", `Сравни ${col.compareTopDigit} и ${col.bottomDigit}. ${col.compareTopDigit} меньше ${col.bottomDigit}.`]
    : ["Шаг 2", "Занимаем десяток", `В ${label} не хватает единиц. Поставь маленькую 1.`];
  if (activeStep.cellType === "crossout") return ["Шаг 2", "Отдаём один десяток", `Проведи пальцем по цифре в разряде «${label}».`];
  if (activeStep.cellType === "adjust") return ["Шаг 2", "Уменьшаем цифру", `${col.topDigit} − 1 = ${activeStep.digit}. Впиши ${activeStep.digit} в маленький уголок.`];
  if (task.operation === "add") {
    const sum = col.topDigit + col.bottomDigit + (col.carryIn ?? 0);
    return ["Шаг 2", `Считаем ${label}`, `${col.topDigit} + ${col.bottomDigit}${col.carryIn ? ` + ${col.carryIn}` : ""} = ${sum}. Впиши ${activeStep.digit}.`];
  }
  return ["Шаг 2", `Считаем ${label}`, `${col.effectiveTopDigit} − ${col.bottomDigit} = ${activeStep.digit}. Впиши ${activeStep.digit}.`];
}

export default function ColumnHints(props) {
  const { onClose, isFirstRun } = props;
  const [intro, setIntro] = useState(isFirstRun);
  const [eyebrow, title, text] = useMemo(() => hintFor(props), [props]);
  if (intro) return <div className="col-hint-onboarding" role="dialog" aria-modal="true"><section className="col-hint-onboarding__card"><span className="col-hint__eyebrow">ПОДСКАЗКИ</span><h2>Решим пример вместе</h2><p>Я буду показывать следующий шаг. Нажми «?» в углу, чтобы вернуть подсказку.</p><p className="col-hint__reassurance">Подсказки не влияют на звёзды.</p><div className="col-hint__actions"><button type="button" className="col-hint__secondary" onClick={onClose}>Не сейчас</button><button type="button" className="col-hint__primary" onClick={() => setIntro(false)}>Начать</button></div></section></div>;
  return <aside className="col-hint" aria-live="polite"><button type="button" className="col-hint__close" onClick={onClose} aria-label="Скрыть подсказку">×</button><span className="col-hint__eyebrow">{eyebrow}</span><strong>{title}</strong><p>{text}</p><span className="col-hint__reassurance">Подсказки не влияют на звёзды</span></aside>;
}
