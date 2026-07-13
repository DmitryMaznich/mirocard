import { useEffect, useState, useCallback, Fragment } from "react";
import { useAppStore } from "@/core/store";
import { getAllInstructions } from "./instructionsApi";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import "./instructions.css";

// Same sentence-break rule as the recipe reading engine (reading/index.jsx):
// put each sentence on its own line instead of one dense paragraph.
function splitSentences(text) {
  return text.split(/(?<=[.!]) (?=[А-ЯЁа-яёA-Za-z(])/g).map((sentence, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {sentence}
    </Fragment>
  ));
}

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
    return <div className="session-screen instruction-runner"><div className="home-tab-loading">Загрузка…</div></div>;
  }

  if (instruction === null) {
    return (
      <div className="session-screen instruction-runner">
        <div className="instruction-step instruction-step--heading">
          <div className="instruction-step-text">Инструкция не найдена</div>
        </div>
        <div className="instruction-nav">
          <button type="button" className="reading-primary-btn instruction-cta-btn" onClick={exit}>
            К списку инструкций
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="session-screen instruction-runner">
        <div className="instruction-step instruction-step--heading">
          <div className="instruction-phase-complete-badge">Готово! 👍</div>
          <div className="instruction-step-text">Инструкция «{instruction.title}» пройдена до конца.</div>
        </div>
        <div className="instruction-nav">
          <button type="button" className="reading-primary-btn instruction-cta-btn" onClick={exit}>
            К списку инструкций
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-screen instruction-runner">
      <div className="instruction-header">
        <div className="instruction-header-row">
          <div className="instruction-progressbar-wrap">
            <div className="instruction-progressbar">
              {steps.map((_, i) => (
                <div key={i} className="instruction-progressbar-segment">
                  <div
                    className="instruction-progressbar-segment-fill"
                    style={{ width: `${stepIndex >= i ? 100 : 0}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="instruction-phase-label">{instruction.emoji} {instruction.title}</div>
          </div>
          <button type="button" className="instruction-close-btn" onClick={exit} aria-label="Закрыть">
            ✕
          </button>
        </div>
      </div>

      <div key={stepIndex} className="instruction-step">
        <div className="instruction-step-text">{splitSentences(steps[stepIndex].text)}</div>
        {steps[stepIndex].photo && (
          <img
            className="instruction-step-img instruction-step-img--inline"
            src={steps[stepIndex].photo}
            alt=""
          />
        )}
      </div>

      <div className="instruction-nav">
        <button type="button" className="instruction-back-btn" onClick={handleBack} aria-label="Назад">
          <BackArrowIcon size={20} />
        </button>
        <button type="button" className="reading-primary-btn instruction-cta-btn" onClick={handleNext}>
          {isLast ? "Готово ✓" : "Дальше →"}
        </button>
      </div>
    </div>
  );
}
