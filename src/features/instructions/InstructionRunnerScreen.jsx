import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/core/store";
import { getAllInstructions } from "./instructionsApi";
import "./instructions.css";

export default function InstructionRunnerScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeInstructionId = useAppStore((s) => s.activeInstructionId);
  const [instruction, setInstruction] = useState(undefined); // undefined = loading, null = not found
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllInstructions().then((all) => {
      if (cancelled) return;
      setInstruction(all.find((i) => i.id === activeInstructionId) ?? null);
    });
    return () => { cancelled = true; };
  }, [activeInstructionId]);

  const exit = useCallback(() => {
    setScreen("home");
  }, [setScreen]);

  const steps = instruction?.steps ?? [];
  const isLast = stepIndex === steps.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) { setFinished(true); return; }
    setStepIndex((n) => n + 1);
  }, [isLast]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex((n) => n - 1);
    else exit();
  }, [stepIndex, exit]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (finished) {
        if (e.key === "Escape" || e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); exit(); }
        return;
      }
      switch (e.key) {
        case "ArrowRight": case "Enter": case " ": e.preventDefault(); handleNext(); break;
        case "ArrowLeft": case "Backspace": e.preventDefault(); handleBack(); break;
        case "Escape": e.preventDefault(); exit(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, handleNext, handleBack, exit]);

  if (instruction === undefined) {
    return <div className="screen instruction-runner"><div className="home-tab-loading">Загрузка…</div></div>;
  }

  if (instruction === null) {
    return (
      <div className="screen instruction-runner">
        <div className="dn-body">
          <p>Инструкция не найдена.</p>
          <button type="button" className="dn-btn" onClick={exit}>К списку инструкций</button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="screen instruction-runner">
        <div className="dn-body">
          <div className="dn-badge">✓</div>
          <div className="dn-title">Готово!</div>
          <p className="dn-sub">Инструкция «{instruction.title}» пройдена до конца.</p>
          <button type="button" className="dn-btn" onClick={exit}>К списку инструкций</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen instruction-runner">
      <div className="rn-top">
        <button type="button" className="rn-close" onClick={exit} aria-label="Закрыть">✕</button>
        <div className="rn-progress-wrap">
          <div className="rn-progress">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rn-seg${i < stepIndex ? " rn-seg--done" : i === stepIndex ? " rn-seg--current" : " rn-seg--todo"}`}
              >
                <span />
              </div>
            ))}
          </div>
          <div className="rn-count">Шаг {stepIndex + 1} из {steps.length}</div>
        </div>
      </div>
      <div className="rn-body">
        <div className="rn-kicker">{instruction.emoji} {instruction.title}</div>
        <div className="rn-step">{steps[stepIndex]}</div>
      </div>
      <div className="rn-foot">
        <button type="button" className="rn-btn rn-btn--back" onClick={handleBack}>Назад</button>
        <button type="button" className="rn-btn rn-btn--next" onClick={handleNext}>Дальше</button>
      </div>
    </div>
  );
}
