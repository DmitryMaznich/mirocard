import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

function overlap(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

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
  if (activeStep.cellType === "borrow") return showingCompare ? ["Шаг 2", "Проверяем: хватает ли?", `Сравни ${col.compareTopDigit} и ${col.bottomDigit}. ${col.compareTopDigit} меньше ${col.bottomDigit}.`] : ["Шаг 2", "Занимаем десяток", `В ${label} не хватает единиц. Поставь маленькую 1.`];
  if (activeStep.cellType === "crossout") return ["Шаг 2", "Отдаём один десяток", `Проведи пальцем по цифре в разряде «${label}».`];
  if (activeStep.cellType === "adjust") return ["Шаг 2", "Уменьшаем цифру", `${col.topDigit} − 1 = ${activeStep.digit}. Впиши ${activeStep.digit} в маленький уголок.`];
  if (task.operation === "add") { const sum = col.topDigit + col.bottomDigit + (col.carryIn ?? 0); return ["Шаг 2", `Считаем ${label}`, `${col.topDigit} + ${col.bottomDigit}${col.carryIn ? ` + ${col.carryIn}` : ""} = ${sum}. Впиши ${activeStep.digit}.`]; }
  return ["Шаг 2", `Считаем ${label}`, `${col.effectiveTopDigit} − ${col.bottomDigit} = ${activeStep.digit}. Впиши ${activeStep.digit}.`];
}

export default function ColumnHints(props) {
  const { onClose, onShown, isFirstRun, screenElement, targetSelector, avoidSelector } = props;
  const [intro, setIntro] = useState(isFirstRun); const [position, setPosition] = useState(null); const cardRef = useRef(null);
  useEffect(() => { onShown?.(); }, [onShown]);
  useLayoutEffect(() => {
    if (intro || !screenElement || !targetSelector) return undefined;
    const move = () => {
      const target = screenElement.querySelector(targetSelector); const card = cardRef.current;
      if (!target || !card) return;
      const screen = screenElement.getBoundingClientRect(); const rect = target.getBoundingClientRect(); const width = card.offsetWidth; const height = card.offsetHeight; const gap = 16; const pad = 10;
      const targetBox = { left: rect.left - screen.left, right: rect.right - screen.left, top: rect.top - screen.top, bottom: rect.bottom - screen.top };
      const keepClear = [...screenElement.querySelectorAll(avoidSelector ?? "")].filter((item) => item !== target).map((item) => { const box = item.getBoundingClientRect(); return { left: box.left - screen.left, right: box.right - screen.left, top: box.top - screen.top, bottom: box.bottom - screen.top }; });
      const raw = [[targetBox.top - height - gap, (targetBox.left + targetBox.right - width) / 2], [targetBox.bottom + gap, (targetBox.left + targetBox.right - width) / 2], [(targetBox.top + targetBox.bottom - height) / 2, targetBox.right + gap], [(targetBox.top + targetBox.bottom - height) / 2, targetBox.left - width - gap], [targetBox.top - height - gap, targetBox.right + gap], [targetBox.bottom + gap, targetBox.left - width - gap]];
      const candidates = raw.map(([top, left]) => ({ top: Math.max(pad, Math.min(top, screen.height - height - pad)), left: Math.max(pad, Math.min(left, screen.width - width - pad)) }));
      const best = candidates.map((candidate) => { const box = { left: candidate.left, right: candidate.left + width, top: candidate.top, bottom: candidate.top + height }; const collisions = keepClear.reduce((sum, item) => sum + overlap(box, item), 0); const distance = Math.abs(candidate.left - targetBox.left) + Math.abs(candidate.top - targetBox.top); return { ...candidate, score: collisions * 8 + distance }; }).sort((a, b) => a.score - b.score)[0];
      setPosition(best); target.classList.add("col-hint-target");
    };
    move(); const observer = new ResizeObserver(move); observer.observe(screenElement); return () => { observer.disconnect(); screenElement.querySelector(targetSelector)?.classList.remove("col-hint-target"); };
  }, [avoidSelector, intro, screenElement, targetSelector]);
  const [eyebrow, title, text] = useMemo(() => hintFor(props), [props]);
  if (intro) return <div className="col-hint-onboarding" role="dialog" aria-modal="true"><section className="col-hint-onboarding__card"><span className="col-hint__eyebrow">ПОДСКАЗКИ</span><h2>Решим пример вместе</h2><p>Я буду показывать следующий шаг. Нажми «💡» в углу, чтобы вернуть подсказку.</p><p className="col-hint__reassurance">Подсказки не влияют на звёзды.</p><div className="col-hint__actions"><button type="button" className="col-hint__secondary" onClick={onClose}>Не сейчас</button><button type="button" className="col-hint__primary" onClick={() => setIntro(false)}>Начать</button></div></section></div>;
  return <><div className="col-hint-dimmer" aria-hidden="true" /><aside ref={cardRef} className="col-hint col-hint--jump" style={position ?? undefined} aria-live="polite"><button type="button" className="col-hint__close" onClick={onClose} aria-label="Скрыть подсказку">×</button><span className="col-hint__eyebrow">{eyebrow}</span><strong>{title}</strong><p>{text}</p><span className="col-hint__reassurance">Подсказки не влияют на звёзды</span></aside></>;
}
