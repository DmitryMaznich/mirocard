import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { shuffle } from "@/shared/utils/shuffle";
import { getTopicTitle } from "@/shared/utils/format";
import { tokenizeReadingLine } from "./engine";

const UNDERSTAND_BUTTONS = [
  { value: "independent", label: "Сам", mod: "easy" },
  { value: "after_text",  label: "После текста", mod: "prompted" },
  { value: "none",        label: "Нет ответа", mod: "fail" },
];

const FINAL_BUTTONS = [
  { value: "none",       label: "Не рассказал", mod: "fail" },
  { value: "prompted",   label: "С подсказкой", mod: "prompted" },
  { value: "read",       label: "Прочитал", mod: "correct" },
  { value: "expressive", label: "Выразительно", mod: "easy" },
];

function getLineText(line) {
  return typeof line === "string" ? line : line?.text ?? "";
}

function ReadingTextBlock({ lines, large = false, activeLineId = null }) {
  return (
    <div className={`reading-text${large ? " reading-text--large" : ""}`}>
      {(lines ?? []).map((line) => (
        <div
          key={line.id ?? getLineText(line)}
          className={`reading-line${activeLineId === line.id ? " reading-line--active" : ""}`}
        >
          {getLineText(line)}
        </div>
      ))}
    </div>
  );
}

function ReadingIllustration({ topicId, text }) {
  const url = useTopicFile(topicId, text?.image);
  if (!text?.image || !url) return null;

  return (
    <div className="reading-illustration">
      <img src={url} alt="" draggable={false} />
    </div>
  );
}

function ReadTextTask({ task, topicId, sessionParams, onAdvance }) {
  const lines = task.text?.lines ?? [];
  const layout = sessionParams?.layout ?? "full";
  const [lineIndex, setLineIndex] = useState(0);
  const activeLine = lines[lineIndex] ?? lines[0];

  if (layout === "line") {
    return (
      <div className="session-body reading-body">
        <div className="reading-poem-wrap">
          <div className="reading-title">{getTopicTitle(task.text.title)}</div>
          <div className="reading-content">
            <ReadingTextBlock lines={[activeLine]} large activeLineId={activeLine?.id} />
          </div>
        </div>
        <div className="reading-line-nav">
          <button
            className="reading-secondary-btn"
            disabled={lineIndex <= 0}
            onClick={() => setLineIndex((i) => Math.max(0, i - 1))}
          >
            Назад
          </button>
          <span className="reading-line-count">{lineIndex + 1} / {lines.length}</span>
          {lineIndex + 1 < lines.length ? (
            <button
              className="reading-primary-btn"
              onClick={() => setLineIndex((i) => Math.min(lines.length - 1, i + 1))}
            >
              Дальше
            </button>
          ) : (
            <button className="reading-primary-btn" onClick={onAdvance}>Готово</button>
          )}
        </div>
        <ReadingIllustration topicId={topicId} text={task.text} />
      </div>
    );
  }

  return (
    <div className="session-body reading-body" onClick={onAdvance}>
      <div className="reading-poem-wrap">
        <div className="reading-title">{getTopicTitle(task.text.title)}</div>
        <div className="reading-content">
          <ReadingTextBlock lines={lines} />
        </div>
      </div>
      <ReadingIllustration topicId={topicId} text={task.text} />
    </div>
  );
}

function UnderstandTextTask({ task, onQualityAnswer }) {
  const [showSupport, setShowSupport] = useState(false);
  const supportLines = task.supportLines?.length ? task.supportLines : task.text?.lines ?? [];

  function answer(value) {
    onQualityAnswer(value, task.textId, task.question.id);
  }

  return (
    <div className="session-body reading-body reading-understand">
      <div className="reading-question">{task.question.prompt}</div>

      {showSupport ? (
        <ReadingTextBlock lines={supportLines} activeLineId={supportLines[0]?.id} />
      ) : (
        <button className="reading-support-placeholder" onClick={() => setShowSupport(true)}>
          Показать фрагмент текста
        </button>
      )}

      <div className="qa-row reading-quality-row">
        {UNDERSTAND_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            className={`qa-btn qa-btn--${btn.mod}`}
            onClick={() => answer(btn.value)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function makeLineTokens(line) {
  return tokenizeReadingLine(line).map((token, index) => ({
    ...token,
    uid: `${line.id}_${index}_${token.text}_${Math.random().toString(36).slice(2, 7)}`,
  }));
}

function buildLineState(line) {
  return {
    available: line ? shuffle(makeLineTokens(line)) : [],
    placed: {},
    wrongSlot: null,
  };
}

function AssembleLineTask({ task, soundEnabled, onMistake, onAdvance }) {
  const line = task.line;
  const lineIndex = task.lineIndex ?? 0;
  const totalLines = task.totalLines ?? 1;
  const assembledPreview = (task.text?.lines ?? []).slice(0, lineIndex);

  const [lineState, setLineState] = useState(() => buildLineState(line));
  const [hoverSlot, setHoverSlot] = useState(null);
  const dragRef = useRef(null);

  const expectedTokens = useMemo(() => tokenizeReadingLine(line), [line]);
  const { available, placed, wrongSlot } = lineState;

  function playCorrectSound() {
    if (!soundEnabled) return;
    try { new Audio("/sounds/correct.wav").play().catch(() => {}); } catch {}
  }

  function rejectSlot(slotIndex) {
    onMistake(null, null); // plays error sound via SessionScreen + increments incorrectCount
    setLineState((s) => ({ ...s, wrongSlot: slotIndex }));
    setTimeout(() => setLineState((s) => ({ ...s, wrongSlot: null })), 420);
  }

  function placeToken(uid, slotIndex) {
    if (placed[slotIndex]) return;
    const token = available.find((t) => t.uid === uid);
    const expected = expectedTokens[slotIndex];
    if (!token || !expected) return;

    if (token.text !== expected.text) {
      rejectSlot(slotIndex);
      return;
    }

    const nextPlaced = { ...placed, [slotIndex]: token };
    setLineState((s) => ({
      ...s,
      placed: nextPlaced,
      available: s.available.filter((t) => t.uid !== uid),
      wrongSlot: null,
    }));

    if (Object.keys(nextPlaced).length === expectedTokens.length) {
      setTimeout(() => {
        playCorrectSound();
        onAdvance();
      }, 280);
    }
  }

  function handlePointerDown(event, uid) {
    if (dragRef.current) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const text = available.find((t) => t.uid === uid)?.text ?? "";

    const ghost = document.createElement("div");
    ghost.className = "reading-word reading-word--ghost";
    ghost.textContent = text;
    ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:9999;margin:0;`;
    document.body.appendChild(ghost);

    el.setPointerCapture(event.pointerId);
    dragRef.current = {
      uid,
      pointerId: event.pointerId,
      ghost,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
    drag.ghost.style.top  = `${event.clientY - drag.offsetY}px`;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const slotEl = under?.closest("[data-slot-index]");
    const next = slotEl ? +slotEl.dataset.slotIndex : null;
    setHoverSlot((prev) => prev === next ? prev : next);
  }

  function handlePointerUp(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.ghost.remove();
    dragRef.current = null;
    setHoverSlot(null);
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const slotEl = under?.closest("[data-slot-index]");
    if (slotEl) placeToken(drag.uid, +slotEl.dataset.slotIndex);
  }

  function handlePointerCancel(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.ghost.remove();
    dragRef.current = null;
    setHoverSlot(null);
  }

  return (
    <div className="session-body reading-body reading-assemble">
      <div className="reading-assembled-preview">
        {assembledPreview.length > 0 ? (
          <ReadingTextBlock lines={assembledPreview} />
        ) : (
          <div className="reading-muted">Собранные строки появятся здесь</div>
        )}
      </div>

      <div className="reading-slot-row" aria-label="Строка с пропусками">
        {expectedTokens.map((token, index) => (
          <div
            key={`${token.text}_${index}`}
            data-slot-index={index}
            className={[
              "reading-slot",
              placed[index] ? "reading-slot--filled" : "",
              wrongSlot === index ? "reading-slot--wrong" : "",
              hoverSlot === index && !placed[index] ? "reading-slot--hover" : "",
            ].filter(Boolean).join(" ")}
            style={{ "--chars": Math.max(2, token.text.length) }}
          >
            {placed[index]?.text ?? ""}
          </div>
        ))}
      </div>

      <div className="reading-word-bank">
        {available.map((token) => (
          <button
            key={token.uid}
            className="reading-word"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => handlePointerDown(e, token.uid)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {token.text}
          </button>
        ))}
      </div>

      <div className="reading-line-count">{lineIndex + 1} / {totalLines}</div>
    </div>
  );
}

function InstructionTask({ task, onAdvance }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const steps = task.text?.steps ?? [];
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState({});
  const [listOpen, setListOpen] = useState(false);
  const listRef = useRef(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const allChecked = step?.type !== "checklist" ||
    (step.items ?? []).every((_, i) => !!checked[`${stepIndex}_${i}`]);

  useEffect(() => {
    if (!listOpen || !listRef.current) return;
    const el = listRef.current.querySelector(".instruction-list-item--active");
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [listOpen]);

  function goBack() {
    if (stepIndex > 0) setStepIndex((n) => n - 1);
    else setScreen("texts");
  }

  function toggleItem(i) {
    const key = `${stepIndex}_${i}`;
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }

  function goNext() {
    setListOpen(false);
    if (isLast) onAdvance();
    else setStepIndex((n) => n + 1);
  }

  if (!step) return null;

  return (
    <div className="session-body reading-body instruction-body">
      <div className="instruction-header">
        <span className="instruction-progress">{stepIndex + 1} / {steps.length}</span>
      </div>

      <div className="instruction-step">
        <div className="instruction-step-text">{step.text}</div>
        {step.type === "checklist" && (
          <ul className="instruction-checklist">
            {(step.items ?? []).map((item, i) => {
              const done = !!checked[`${stepIndex}_${i}`];
              return (
                <li
                  key={i}
                  role="checkbox"
                  aria-checked={done}
                  className={`instruction-check-item${done ? " instruction-check-item--done" : ""}`}
                  onClick={() => toggleItem(i)}
                >
                  <span className="instruction-checkbox">{done ? "✓" : ""}</span>
                  <span className="instruction-check-label">{item}</span>
                  {!done && <span className="instruction-check-tap-hint">нажми</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        className={`instruction-drawer-toggle${listOpen ? " instruction-drawer-toggle--open" : ""}`}
        onClick={() => setListOpen((v) => !v)}
      >
        <span className="instruction-drawer-pill" />
        <span className="instruction-drawer-label">все шаги {listOpen ? "▲" : "▼"}</span>
      </button>

      {listOpen && (
        <div className="instruction-drawer" ref={listRef}>
          {steps.map((s, i) => {
            const isDone = i < stepIndex;
            const isActive = i === stepIndex;
            return (
              <div
                key={s.id}
                className={`instruction-list-item${isDone ? " instruction-list-item--done" : ""}${isActive ? " instruction-list-item--active" : ""}`}
              >
                <span className="instruction-list-icon">{isDone ? "✓" : isActive ? "▶" : ""}</span>
                <span className="instruction-list-num">{i + 1}.</span>
                <span className="instruction-list-text">{s.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="instruction-nav">
        <button className="reading-secondary-btn" onClick={goBack}>
          Назад
        </button>
        <button className="reading-primary-btn" disabled={!allChecked} onClick={goNext}>
          {isLast ? "Готово" : "Дальше"}
        </button>
      </div>
    </div>
  );
}

const TASK_RENDERERS = {
  read_text:           ReadTextTask,
  understand_text:     UnderstandTextTask,
  assemble_line:       AssembleLineTask,
  follow_instruction:  InstructionTask,
};

export default function ReadingRenderer({ task, topicId, sessionParams, soundEnabled, onMistake, onAdvance, onQualityAnswer }) {
  const TaskRenderer = TASK_RENDERERS[task?.type];
  if (!TaskRenderer) return <div className="session-body">Неизвестный тип задания: {task?.type}</div>;
  return (
    <TaskRenderer
      task={task}
      topicId={topicId}
      sessionParams={sessionParams}
      soundEnabled={soundEnabled}
      onMistake={onMistake}
      onAdvance={onAdvance}
      onQualityAnswer={onQualityAnswer}
    />
  );
}
