import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment } from "react";
import { useAppStore } from "@/core/store";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { shuffle } from "@/shared/utils/shuffle";
import { getTopicTitle } from "@/shared/utils/format";
import { tokenizeReadingLine } from "./engine";
import { parseRecipeTxt, resolveStepOwners, applyPortions, applyFireEmoji, stepPortionsMultiplier, computeStepSegments, formatPortionsPhrase } from "./parseRecipeTxt";
import { getGroup, getRecipeSettings, getRecipeOverrideForMode, getRawRecipeTxt, pullRecipeKvFromServer, getShoppingOrder, saveShoppingOrder, applyShoppingOrder } from "@/core/groupStore";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { getSafeCodeConfig, appendSafeCodeLog } from "@/core/groupStore";

const UNDERSTAND_BUTTONS = [
  { value: "independent", label: "Сам", mod: "easy" },
  { value: "after_text",  label: "После текста", mod: "prompted" },
  { value: "none",        label: "Нет ответа", mod: "fail" },
];

function getLineText(line, textStyle = "normal") {
  if (typeof line === "string") return line;
  if (textStyle === "syllables" && line?.syllableText) return line.syllableText;
  return line?.text ?? "";
}

function ReadingTextBlock({ lines, large = false, activeLineId = null, textStyle = "normal", bookStyle = false }) {
  return (
    <div className={`reading-text${large ? " reading-text--large" : ""}${bookStyle ? " reading-text--book" : ""}`}>
      {(lines ?? []).map((line) => (
        <div
          key={line.id ?? getLineText(line)}
          className={`reading-line${activeLineId === line.id ? " reading-line--active" : ""}`}
        >
          {getLineText(line, textStyle)}
        </div>
      ))}
    </div>
  );
}

function ReadingIllustration({ topicId, text, illustrationRef }) {
  const cornerPhotos = text?.cornerPhotos;
  const leftEntry  = cornerPhotos?.find((p) => p.position === "bottom-left");
  const rightEntry = cornerPhotos?.find((p) => p.position === "bottom-right");
  const leftUrl  = useTopicFile(topicId, leftEntry?.file);
  const rightUrl = useTopicFile(topicId, rightEntry?.file);
  const url = useTopicFile(topicId, cornerPhotos ? undefined : text?.image);

  if (cornerPhotos) {
    if (!leftUrl && !rightUrl) return null;
    return (
      <div className="reading-illustration reading-illustration--corners" ref={illustrationRef}>
        {leftUrl && (
          <div className="reading-corner-photo reading-corner-photo--bottom-left">
            <img src={leftUrl} alt="" draggable={false} />
            {leftEntry.name && <span className="reading-corner-photo-name">{leftEntry.name}</span>}
          </div>
        )}
        {rightUrl && (
          <div className="reading-corner-photo reading-corner-photo--bottom-right">
            <img src={rightUrl} alt="" draggable={false} />
            {rightEntry.name && <span className="reading-corner-photo-name">{rightEntry.name}</span>}
          </div>
        )}
      </div>
    );
  }

  if (!text?.image || !url) return null;

  const hasRoundedCorners = text?.kind === "story" || text?.kind === "poem";

  return (
    <div className={`reading-illustration${hasRoundedCorners ? " reading-illustration--book" : ""}`} ref={illustrationRef}>
      <img src={url} alt="" draggable={false} />
    </div>
  );
}

// Shrinks the poem/story text (font-size, gaps) to fit the space left over
// after the illustration claims its reserved height, so the whole text is
// visible on one screen without scrolling on small devices. Falls back to
// scrolling just the line list if even the minimum readable scale overflows.
function useFitReadingText(active, deps) {
  const bodyRef = useRef(null);
  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  const illustrationNodeRef = useRef(null);

  const measure = useCallback(() => {
    if (!active) return;
    const body = bodyRef.current;
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!body || !wrap) return;

    const GAP = 18; // .reading-body gap between the poem-wrap and the illustration
    const MIN_SCALE = 0.55;

    wrap.style.setProperty("--reading-fit-scale", "1");
    if (content) {
      content.style.maxHeight = "";
      content.style.overflowY = "";
      content.style.justifyContent = "";
    }

    const textEl = wrap.querySelector(".reading-text");
    if (!textEl) return;

    // .reading-content centers its child vertically — if that child overflows,
    // the overflow is clipped symmetrically top-and-bottom (a known flexbox
    // centering quirk) and scrollHeight on ancestors under-reports it. Measure
    // the text block's own true rendered position instead, which is reliable
    // regardless of that clipping.
    function requiredHeight() {
      return textEl.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top;
    }

    const bodyStyle = getComputedStyle(body);
    const paddingV = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
    const bodyHeight = body.getBoundingClientRect().height;
    const illuHeight = illustrationNodeRef.current?.getBoundingClientRect().height ?? 0;
    const available = Math.max(0, bodyHeight - paddingV - illuHeight - GAP);

    let current = 1;
    let required = requiredHeight();
    let iterations = 0;
    while (required > available && current > MIN_SCALE && iterations < 8) {
      current = Math.max(MIN_SCALE, current * (available / required) * 0.97);
      wrap.style.setProperty("--reading-fit-scale", String(current));
      required = requiredHeight();
      iterations += 1;
    }

    if (required > available + 1 && content) {
      const textHeight = textEl.getBoundingClientRect().height;
      const chromeHeight = Math.max(0, required - textHeight);
      content.style.maxHeight = `${Math.max(0, available - chromeHeight)}px`;
      content.style.overflowY = "auto";
      // Overflow must scroll top-to-bottom, not clip symmetrically around a
      // centered child — the child needs to start at the top to be scrollable.
      content.style.justifyContent = "flex-start";
    }
  }, [active]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(measure, [measure, ...deps]);

  useEffect(() => {
    if (!active) return undefined;
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [active, measure]);

  const illustrationRef = useCallback((node) => {
    illustrationNodeRef.current = node;
    measure();
  }, [measure]);

  return { bodyRef, wrapRef, contentRef, illustrationRef };
}

function ReadingCloseButton({ onClose }) {
  if (!onClose) return null;
  return (
    <button type="button" className="reading-close-btn" onClick={onClose} aria-label="Закрыть">
      ✕
    </button>
  );
}

function ReadTextTask({ task, topicId, sessionParams, onAdvance, onClose }) {
  const lines = task.text?.lines ?? [];
  const layout = sessionParams?.layout ?? "full";
  const textStyle = sessionParams?.textStyle ?? "normal";
  const [lineIndex, setLineIndex] = useState(0);
  const activeLine = lines[lineIndex] ?? lines[0];
  const isPool = task.text?.kind === "sentence_pool";
  const bookStyle = task.text?.kind === "story";
  const showCloseButton = task.text?.kind === "story" || task.text?.kind === "poem";
  const fit = useFitReadingText(showCloseButton && layout === "full", [task.text?.id, textStyle, lines.length]);

  if (layout === "line") {
    return (
      <div className="session-body reading-body">
        {showCloseButton && <ReadingCloseButton onClose={onClose} />}
        <div className="reading-poem-wrap">
          {!isPool && <div className="reading-title">{getTopicTitle(task.text.title)}</div>}
          {!isPool && task.text.author && <div className="reading-author">{getTopicTitle(task.text.author)}</div>}
          <div className="reading-content">
            <ReadingTextBlock lines={[activeLine]} large activeLineId={activeLine?.id} textStyle={textStyle} bookStyle={bookStyle} />
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
    <div
      className="session-body reading-body"
      ref={fit.bodyRef}
      style={isPool ? { justifyContent: "center" } : undefined}
      onClick={showCloseButton ? undefined : onAdvance}
    >
      {showCloseButton && <ReadingCloseButton onClose={onClose} />}
      <div className="reading-poem-wrap" ref={fit.wrapRef}>
        {!isPool && <div className="reading-title">{getTopicTitle(task.text.title)}</div>}
        {!isPool && task.text.author && <div className="reading-author">{getTopicTitle(task.text.author)}</div>}
        <div className="reading-content" ref={fit.contentRef}>
          <ReadingTextBlock lines={lines} large={isPool} textStyle={textStyle} bookStyle={bookStyle} />
        </div>
      </div>
      <ReadingIllustration topicId={topicId} text={task.text} illustrationRef={showCloseButton ? fit.illustrationRef : undefined} />
    </div>
  );
}

function UnderstandTextTask({ task, onQualityAnswer }) {
  const [showSupport, setShowSupport] = useState(false);
  const supportLines = task.supportLines?.length ? task.supportLines : task.text?.lines ?? [];
  const bookStyle = task.text?.kind === "story";

  function answer(value) {
    onQualityAnswer(value, task.textId, task.question.id);
  }

  return (
    <div className="session-body reading-body reading-understand">
      <div className="reading-question">{task.question.prompt}</div>

      {showSupport ? (
        <ReadingTextBlock lines={supportLines} activeLineId={supportLines[0]?.id} bookStyle={bookStyle} />
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

function AssembleLineTask({ task, soundEnabled, playFeedback, onMistake, onAdvance }) {
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
    playFeedback?.("correct");
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

// Parse "1-15,21,24-28" → Set of step numbers
function parseStepRanges(rangeStr) {
  const nums = new Set();
  for (const part of (rangeStr ?? "").split(",")) {
    const m = part.trim().match(/^(\d+)-(\d+)$/);
    if (m) {
      for (let i = +m[1]; i <= +m[2]; i++) nums.add(i);
    } else {
      const n = parseInt(part.trim());
      if (!isNaN(n) && n > 0) nums.add(n);
    }
  }
  return nums;
}

// Apply group step-range assignments to parsed steps (headings don't consume a number)
function applyGroupToSteps(parsedSteps, group) {
  const memberRanges = group
    .filter((m) => m.stepRanges?.trim())
    .map((m) => ({ name: m.name, nums: parseStepRanges(m.stepRanges) }));
  if (!memberRanges.length) return parsedSteps;

  let actionNum = 0;
  return parsedSteps.map((step) => {
    if (step.type !== "heading") actionNum++;
    const matches = memberRanges.filter((mr) => mr.nums.has(actionNum));
    return { ...step, owners: matches.map((mr) => mr.name) };
  });
}

function playWarningChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [
      { freq: 880,  start: 0.00, dur: 0.35 },
      { freq: 1047, start: 0.20, dur: 0.35 },
      { freq: 1319, start: 0.40, dur: 0.55 },
    ];
    for (const { freq, start, dur } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    }
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // Audio is optional
  }
}

function InstructionProgressBar({ segments, stepIndex }) {
  const active = segments.find((s) => stepIndex >= s.startIndex && stepIndex < s.startIndex + s.count);
  return (
    <div className="instruction-progressbar-wrap">
      <div className="instruction-progressbar">
        {segments.map((seg, i) => {
          const endIndex = seg.startIndex + seg.count - 1;
          let fillPct = 0;
          if (stepIndex > endIndex) fillPct = 100;
          else if (stepIndex >= seg.startIndex) fillPct = ((stepIndex - seg.startIndex + 1) / seg.count) * 100;
          return (
            <div key={i} className="instruction-progressbar-segment" style={{ flexGrow: seg.count }}>
              <div className="instruction-progressbar-segment-fill" style={{ width: `${fillPct}%` }} />
            </div>
          );
        })}
      </div>
      {active?.title && <div className="instruction-phase-label">{active.title}</div>}
    </div>
  );
}

function InstructionTask({ task, topicId, onAdvance, soundEnabled }) {
  const setScreen               = useAppStore((s) => s.setScreen);
  const activeStudentId         = useAppStore((s) => s.activeStudentId);
  const students                = useAppStore((s) => s.students);
  const sessionPortionsOverride    = useAppStore((s) => s.sessionPortionsOverride);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const sessionReturnScreen        = useAppStore((s) => s.sessionReturnScreen);
  const setSessionReturnScreen     = useAppStore((s) => s.setSessionReturnScreen);
  const student = students.find((s) => s.id === activeStudentId) ?? null;

  const [portions,   setPortions]   = useState(1);
  const [portionsCount, setPortionsCount] = useState(1);
  const [steps,      setSteps]      = useState(task.text?.steps ?? []);
  const [group,      setGroup]      = useState([]);
  const [stepIndex,  setStepIndex]  = useState(0);
  const [checked,    setChecked]    = useState({});

  useEffect(() => {
    async function load() {
      await pullRecipeKvFromServer().catch(() => {});
      const textId   = task.text?.id;
      const filePath = task.text?.file;
      const [grp, settings, rawText] = await Promise.all([
        getGroup(topicId).catch(() => []),
        getRecipeSettings(topicId).catch(() => ({ portions: 1 })),
        (async () => {
          if (textId) {
            const override = await getRecipeOverrideForMode(topicId, textId, "group").catch(() => null);
            if (override) return override;
          }
          if (filePath) return getRawRecipeTxt(topicId, filePath).catch(() => null);
          return null;
        })(),
      ]);
      const grpList      = grp ?? [];
      const parsedSteps  = rawText ? parseRecipeTxt(rawText) : (task.text?.steps ?? []);
      const annotated    = applyGroupToSteps(parsedSteps, grpList);
      setGroup(grpList);
      setSteps(annotated);
      const basePortions = task.text?.portions ?? 1;
      const chosenPortions = sessionPortionsOverride ?? settings.portions ?? basePortions;
      setPortions(stepPortionsMultiplier(basePortions, task.text?.fixedPortions, chosenPortions));
      setPortionsCount(chosenPortions);
      if (sessionPortionsOverride != null) setSessionPortionsOverride(null);
    }
    load();
  }, [topicId, task.text?.id, task.text?.file]); // eslint-disable-line react-hooks/exhaustive-deps

  const segments = useMemo(() => computeStepSegments(steps), [steps]);
  const step = steps[stepIndex];
  const imageUrl = useTopicFile(topicId,
    step?.type === "image" ? `media/${step.file}` :
    step?.image ? `media/${step.image}` : null
  );
  // Support both old single-owner (step.owner) and new multi-owner (step.owners) formats
  const owners = step
    ? resolveStepOwners(step.owners ?? (step.owner ? [step.owner] : []), group, student)
    : [];
  const isLast = stepIndex === steps.length - 1;
  const allChecked =
    step?.type !== "checklist" ||
    (step.items ?? []).every((_, i) => !!checked[`${stepIndex}_${i}`]);

  const ctaLabel = isLast
    ? "Готово, рецепт закончен! 🎉"
    : step?.type === "heading"
    ? "Начнём →"
    : step?.type === "warning"
    ? "Понял(а)"
    : step?.type === "image" || step?.type === "bullets"
    ? "Дальше →"
    : "Готово ✓";

  useEffect(() => {
    if (step?.type === "warning" && soundEnabled !== false) {
      playWarningChime();
    }
  }, [stepIndex, soundEnabled]); // step derived from stepIndex

  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocked(true);
    const t = setTimeout(() => setLocked(false), 450);
    return () => clearTimeout(t);
  }, [stepIndex]);

  const toggleItem = useCallback((i) => {
    const key = `${stepIndex}_${i}`;
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }, [stepIndex]);

  const [finished, setFinished] = useState(false);

  const handleNext = useCallback(() => {
    if (locked) return;
    if (isLast) setFinished(true);
    else setStepIndex((n) => n + 1);
  }, [locked, isLast]);

  const handleFinish = useCallback(() => {
    onAdvance();
  }, [onAdvance]);

  const handleSpace = useCallback(() => {
    if (step?.type === "checklist") {
      const nextUnchecked = (step.items ?? []).findIndex((_, i) => !checked[`${stepIndex}_${i}`]);
      if (nextUnchecked >= 0) { toggleItem(nextUnchecked); return; }
    }
    handleNext();
  }, [step, checked, stepIndex, toggleItem, handleNext]);

  // Exits the recipe. Always lands in the Planner — recipes now live there
  // exclusively (the standalone "Инструкции" topic this renderer also still
  // serves is being retired), so there's no scenario where returning to its
  // own params/mode-picker screen is the right destination anymore.
  const exitInstruction = useCallback(() => {
    setScreen(sessionReturnScreen ?? "planner_menu");
    setSessionReturnScreen(null);
  }, [setScreen, sessionReturnScreen, setSessionReturnScreen]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex((n) => n - 1);
    else exitInstruction();
  }, [stepIndex, exitInstruction]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (finished) {
        if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); handleFinish(); }
        if (e.key === "Escape") { e.preventDefault(); exitInstruction(); }
        return;
      }
      switch (e.key) {
        case "ArrowRight": case "Enter": e.preventDefault(); handleNext(); break;
        case " ":          e.preventDefault(); handleSpace(); break;
        case "ArrowLeft":  case "Backspace": e.preventDefault(); goBack(); break;
        case "Escape": e.preventDefault(); exitInstruction(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handleSpace, goBack, exitInstruction, finished, handleFinish]);

  if (finished) {
    return (
      <div className="session-body reading-body instruction-body">
        <div className="instruction-step instruction-step--heading">
          <div className="instruction-step-text">🎉 Рецепт готов!</div>
        </div>
        <div className="instruction-nav">
          <button type="button" className="reading-primary-btn instruction-cta-btn" onClick={handleFinish}>
            Готово
          </button>
        </div>
      </div>
    );
  }

  if (!step) return null;

  const chef = group.find((m) => m.role === "chef") ?? null;

  return (
    <div className="session-body reading-body instruction-body">

      <div className="instruction-running-layout">

        {/* Left panel — visible only in landscape; contains chef info + team at bottom */}
        <div className="instruction-chef-panel">
          {chef && (
            <>
              <div className="instruction-chef-crown">👑</div>
              <div className="instruction-chef-avatar">
                {chef.photoDataUrl
                  ? <img src={chef.photoDataUrl} alt={chef.name} />
                  : <div className="instruction-chef-initials">{chef.name?.[0] ?? "?"}</div>
                }
              </div>
              <div className="instruction-chef-name">{chef.name}</div>
              <div className="instruction-chef-label">шеф</div>
            </>
          )}

          {/* Recipe title block */}
          <div className="instruction-panel-now-cooking">
            <div className="instruction-panel-now-cooking__label">сейчас готовим:</div>
            <div className="instruction-panel-now-cooking__title">{getTopicTitle(task.text?.title)}</div>
          </div>

          {/* Team avatars at bottom of left panel — chef excluded (shown above) */}
          {group.length > 1 && (
            <div className="instruction-panel-participants">
              <div className="instruction-panel-participants-label">Команда шефа:</div>
              {group.filter((m) => m.role !== "chef").map((member) => {
                const isActive = owners.some((o) => o.id === member.id || o.name === member.name);
                const isChef = member.role === "chef";
                return (
                  <div
                    key={member.id ?? member.name}
                    className={[
                      "instruction-panel-participant",
                      isActive ? "instruction-panel-participant--active" : "",
                      isChef ? "instruction-panel-participant--chef" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="instruction-panel-participant-avatar">
                      {member.photoDataUrl
                        ? <img src={member.photoDataUrl} alt={member.name} />
                        : <div className="instruction-panel-participant-initials">{member.name?.[0] ?? "?"}</div>
                      }
                    </div>
                    <div className="instruction-panel-participant-name">{member.name}</div>
                    {isChef && <span className="instruction-panel-participant-chef-mark">👑</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="instruction-main">
          <div className="instruction-header">
            <div className="instruction-header-row">
              <InstructionProgressBar segments={segments} stepIndex={stepIndex} />
              <button
                type="button"
                className="instruction-close-btn"
                onClick={exitInstruction}
                aria-label="Закрыть рецепт"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            key={stepIndex}
            className={`instruction-step${step.type === "heading" ? " instruction-step--heading" : ""}${step.type === "image" ? " instruction-step--image" : ""}${step.type === "warning" ? " instruction-step--warning" : ""}`}
          >
            {step.type === "image" ? (
              imageUrl
                ? <img src={imageUrl} alt="" className="instruction-step-img" />
                : <div className="instruction-step-img-placeholder" />
            ) : step.type === "warning" ? (
              <div className="instruction-step-text instruction-step-text--warning">
                <span className="instruction-warning-icon">🔔</span>
                {step.text}
              </div>
            ) : (
            <>
            {step.type === "heading" && stepIndex > 0 && (
              <div className="instruction-phase-complete-badge">Этап пройден! 👍</div>
            )}
            <div className="instruction-step-text">{(() => {
              const text = applyFireEmoji(applyPortions(step.text, portions));
              const parts = text.split(/(?<=[.!]) (?=[А-ЯЁа-яёA-Za-z(])/g);
              if (parts.length === 1) return text;
              return parts.map((s, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {s}
                </Fragment>
              ));
            })()}</div>
            {step.type === "heading" && stepIndex === 0 && (
              <div className="instruction-title-portions">{formatPortionsPhrase(portionsCount)}</div>
            )}
            </>
            )}
            {step.image && imageUrl && (
              <img src={imageUrl} alt="" className="instruction-step-illustration" />
            )}
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
                      <span className="instruction-check-label">{applyFireEmoji(applyPortions(item, portions))}</span>
                      {!done && <span className="instruction-check-tap-hint">нажми</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {step.type === "bullets" && (
              <ul className="instruction-bullets">
                {(step.items ?? []).map((item, i) => (
                  <li key={i} className="instruction-bullet-item">
                    <span className="instruction-bullet-dot">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="instruction-nav">
            <button
              type="button"
              className="instruction-back-btn"
              onClick={goBack}
              aria-label="Назад"
            >
              <BackArrowIcon size={20} />
            </button>
            <button
              type="button"
              className="reading-primary-btn instruction-cta-btn"
              disabled={!allChecked || locked}
              onClick={handleNext}
            >
              {ctaLabel}
            </button>
          </div>
        </div>

      </div>

      {group.length > 1 && (
        <div className="instruction-participants">
          {group.map((member) => {
            const isActive = owners.some((o) => o.id === member.id || o.name === member.name);
            const isChef = member.role === "chef";
            return (
              <div
                key={member.id ?? member.name}
                className={[
                  "instruction-participant",
                  isActive ? "instruction-participant--active" : "",
                  isChef ? "instruction-participant--chef" : "",
                ].filter(Boolean).join(" ")}
              >
                <div className="instruction-participant-avatar">
                  {member.photoDataUrl
                    ? <img src={member.photoDataUrl} alt={member.name} />
                    : <div className="instruction-participant-initials">{member.name?.[0] ?? "?"}</div>
                  }
                </div>
                <div className="instruction-participant-name">{member.name}</div>
                {isChef && <span className="instruction-participant-chef-mark">👑</span>}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

const RU_DAYS   = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const RU_MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
function formatTodayRu() {
  const d = new Date();
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${RU_DAYS[d.getDay()]}`;
}

function SortableTile({ id, icon, name }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`shopping-tile shopping-tile--sortable${isDragging ? " shopping-tile--dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="shopping-tile-drag-handle">⠿</span>
      <span className="shopping-tile-icon">{icon}</span>
      <span className="shopping-tile-name">{name}</span>
    </div>
  );
}

function ShoppingListTask({ task, topicId, onAdvance }) {
  const [steps, setSteps] = useState([]);
  const [categoryIcons, setCategoryIcons] = useState([]);
  const [group, setGroup] = useState([]);
  const [view, setView] = useState("grid"); // "grid" | "preview" | number
  const [checked, setChecked] = useState({});
  const [sortMode, setSortMode] = useState(false);
  const [pressingTile, setPressingTile] = useState(null);
  const rawStepsRef = useRef([]);
  const rawIconsRef = useRef([]);
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  useEffect(() => {
    async function load() {
      await pullRecipeKvFromServer().catch(() => {});
      const textId   = task.text?.id;
      const filePath = task.text?.file;
      const [raw, grp, savedOrder] = await Promise.all([
        (async () => {
          if (textId) {
            const override = await getRecipeOverrideForMode(topicId, textId, "group").catch(() => null);
            if (override) return override;
          }
          if (filePath) return getRawRecipeTxt(topicId, filePath).catch(() => null);
          return null;
        })(),
        getGroup(topicId).catch(() => []),
        getShoppingOrder(topicId).catch(() => null),
      ]);
      let rawSteps;
      if (raw) {
        rawSteps = parseRecipeTxt(raw).filter((s) => s.type === "checklist" || s.type === "action");
      } else {
        rawSteps = (task.text?.steps ?? []).filter((s) => s.type === "checklist" || s.type === "action");
      }
      const rawIcons = task.text?.categoryIcons ?? [];
      rawStepsRef.current = rawSteps;
      rawIconsRef.current = rawIcons;
      const { steps: orderedSteps, categoryIcons: orderedIcons } = applyShoppingOrder(rawSteps, rawIcons, savedOrder);
      setSteps(orderedSteps);
      setCategoryIcons(orderedIcons);
      setGroup(grp ?? []);
    }
    load();
  }, [topicId, task.text?.id, task.text?.file]);

  const toggleItem = useCallback((stepIdx, itemIdx) => {
    const key = `${stepIdx}_${itemIdx}`;
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }, []);

  const resetCategory = useCallback((stepIdx, itemCount) => {
    setChecked((c) => {
      const next = { ...c };
      for (let i = 0; i < itemCount; i++) delete next[`${stepIdx}_${i}`];
      return next;
    });
  }, []);

  const checkedCountFor = (stepIdx, items) =>
    (items ?? []).filter((_, i) => checked[`${stepIdx}_${i}`]).length;

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = steps.map((s) => s.text);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newSteps = arrayMove(steps, oldIndex, newIndex);
    const newIcons = arrayMove(categoryIcons, oldIndex, newIndex);
    setSteps(newSteps);
    setCategoryIcons(newIcons);
    saveShoppingOrder(topicId, newSteps.map((s) => s.text.replace(/:$/, "").trim())).catch(() => {});
  }

  function resetOrder() {
    saveShoppingOrder(topicId, null).catch(() => {});
    setSteps(rawStepsRef.current);
    setCategoryIcons(rawIconsRef.current);
    setSortMode(false);
  }

  function startLongPress(si) {
    didLongPressRef.current = false;
    setPressingTile(si);
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setPressingTile(null);
      setSortMode(true);
      if (navigator.vibrate) navigator.vibrate(60);
    }, 5000);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimerRef.current);
    setPressingTile(null);
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (typeof view === "number") {
    const step = steps[view];
    const items = step?.items ?? [];
    const icon = categoryIcons[view] ?? "📦";
    const doneCount = checkedCountFor(view, items);

    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-detail-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")} aria-label="К списку категорий">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <span className="shopping-detail-icon">{icon}</span>
          <span className="shopping-detail-title">{step?.text.replace(/:$/, "")}</span>
          <span className="shopping-detail-count">{doneCount}/{items.length}</span>
          {doneCount > 0 && (
            <button className="shopping-reset-btn" onClick={() => resetCategory(view, items.length)}>
              ✕
            </button>
          )}
          {view + 1 < steps.length && (
            <button className="shopping-next-btn" onClick={() => setView(view + 1)} aria-label="Следующая категория">
              <span>{categoryIcons[view + 1] ?? "📦"}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M5 2.5l4.5 4.5L5 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <ul className="shopping-items">
          {items.map((item, ii) => {
            const done = !!checked[`${view}_${ii}`];
            const subs = step?.itemSubgroups;
            const subgroup = subs?.[ii] ?? null;
            const showSubheader = subgroup && subgroup !== (subs?.[ii - 1] ?? null);
            return (
              <Fragment key={ii}>
                {showSubheader && (
                  <li className="shopping-subgroup-header">{subgroup}</li>
                )}
                <li
                  role="checkbox"
                  aria-checked={done}
                  className={`shopping-item${done ? " shopping-item--done" : ""}`}
                  onClick={() => toggleItem(view, ii)}
                >
                  <span className="shopping-checkbox">{done ? "✓" : ""}</span>
                  <span className="shopping-item-label">{item}</span>
                  {!done && <span className="shopping-tap-hint">нажми</span>}
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── PREVIEW VIEW ──────────────────────────────────────────────
  if (view === "preview") {
    const toEntries = (step, si, filterFn = () => true) =>
      (step.items ?? [])
        .map((item, i) => ({ item, subgroup: step.itemSubgroups?.[i] ?? null, _i: i }))
        .filter(({ _i }) => filterFn(_i));

    const selected = steps
      .map((step, si) => ({
        step, si,
        icon: categoryIcons[si] ?? "📦",
        entries: toEntries(step, si, (i) => !!checked[`${si}_${i}`]),
      }))
      .filter(({ entries }) => entries.length > 0);

    const isEmpty = selected.length === 0;
    const renderList = isEmpty
      ? steps.map((step, si) => ({ step, si, icon: categoryIcons[si] ?? "📦", entries: toEntries(step, si) }))
      : selected;

    const responsible = group.find((m) => m.role === "chef");
    const teammates   = group.filter((m) => m.role !== "chef");
    const todayStr    = formatTodayRu();

    return (
      <div className="session-body reading-body shopping-body">
        <div className="shopping-preview-header">
          <button className="shopping-back-btn" onClick={() => setView("grid")}>
            <BackArrowIcon size={16} /> Назад
          </button>
          <span className="shopping-preview-title">
            {isEmpty ? "Ничего не выбрано" : "Список покупок"}
          </span>
        </div>

        <div className="shopping-preview-content">
          {/* Шапка — title (print only) + date + team */}
          <div className="shopping-print-header">
            <div className="shopping-preview-date">{todayStr}</div>
            {responsible && (
              <div className="shopping-preview-responsible">
                Ответственный:&nbsp;<strong>{responsible.name}</strong>&nbsp;★
              </div>
            )}
            {teammates.length > 0 && (
              <div className="shopping-preview-teammates">
                Команда:&nbsp;{teammates.map((m) => m.name).join(", ")}
              </div>
            )}
          </div>

          <div className="shopping-preview-separator" />

          <ul className="shopping-preview-items">
            {renderList.flatMap(({ entries }) => entries).map(({ item, subgroup }, i, all) => {
              const prevSub = all[i - 1]?.subgroup ?? null;
              return (
                <Fragment key={i}>
                  {subgroup && subgroup !== prevSub && (
                    <li className="shopping-preview-subgroup">{subgroup}</li>
                  )}
                  <li className="shopping-preview-item">☐&nbsp;{item}</li>
                </Fragment>
              );
            })}
          </ul>
        </div>

        <div className="shopping-actions">
          <button className="shopping-print-btn" onClick={() => {
            const allEntries = renderList.flatMap(({ entries }) => entries);
            let listHtml = "";
            let prevSub = null;
            for (const { item, subgroup } of allEntries) {
              if (subgroup && subgroup !== prevSub) {
                listHtml += `<li class="sub">${subgroup}</li>`;
              }
              listHtml += `<li class="item">&#9744;&nbsp;${item}</li>`;
              prevSub = subgroup;
            }
            const teamHtml = [
              responsible ? `<div>Ответственный: <strong>${responsible.name}</strong> ★</div>` : "",
              teammates.length ? `<div>Команда: ${teammates.map(m => m.name).join(", ")}</div>` : "",
            ].join("");
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Список покупок</title><style>
@page{size:A4;margin:18mm 22mm}
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;color:#111}
h1{font-size:22pt;font-weight:900;text-transform:uppercase;margin:0 0 4pt}
.meta{font-size:12pt;color:#444;margin-bottom:2pt}
hr{border:none;border-top:1.5pt solid #bbb;margin:8pt 0}
ul{list-style:none;margin:0;padding:0}
li.sub{font-size:8pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#3a7a6a;padding:5pt 0 1pt 4pt;margin-top:3pt}
li.item{font-size:14pt;padding:3pt 0;line-height:1.45}
</style></head><body>
<h1>Список покупок</h1>
<div class="meta">${todayStr}</div>${teamHtml}<hr>
<ul>${listHtml}</ul>
</body></html>`;
            const iframe = document.createElement("iframe");
            iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none";
            document.body.appendChild(iframe);
            iframe.contentDocument.open();
            iframe.contentDocument.write(html);
            iframe.contentDocument.close();
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 2000);
          }}>
            🖨 Печать / PDF
          </button>
        </div>
      </div>
    );
  }

  // ── GRID VIEW ────────────────────────────────────────────────
  return (
    <div className="session-body reading-body shopping-body">
      <div className="shopping-grid-header">Что нужно купить?</div>
      {sortMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.text)} strategy={rectSortingStrategy}>
            <div className="shopping-grid">
              {steps.map((step, si) => (
                <SortableTile
                  key={step.text}
                  id={step.text}
                  icon={categoryIcons[si] ?? "📦"}
                  name={step.text.replace(/:$/, "")}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="shopping-grid">
          {steps.map((step, si) => {
            const items = step.items ?? [];
            const doneCount = checkedCountFor(si, items);
            const allDone = doneCount === items.length && items.length > 0;
            const icon = categoryIcons[si] ?? "📦";
            const isPressing = pressingTile === si;
            return (
              <button
                key={step.id ?? si}
                className={`shopping-tile${allDone ? " shopping-tile--done" : doneCount > 0 ? " shopping-tile--partial" : ""}${isPressing ? " shopping-tile--pressing" : ""}`}
                onClick={() => { if (!didLongPressRef.current) setView(si); }}
                onPointerDown={() => startLongPress(si)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
              >
                <span className="shopping-tile-icon">{icon}</span>
                <span className="shopping-tile-name">{step.text.replace(/:$/, "")}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="shopping-actions">
        {sortMode ? (
          <>
            <button className="shopping-sort-done-btn" onClick={() => setSortMode(false)}>
              ✓ Готово
            </button>
            <button className="shopping-sort-reset-btn" onClick={resetOrder}>
              Сбросить порядок
            </button>
          </>
        ) : (
          <button className="shopping-view-btn" onClick={() => setView("preview")}>
            Посмотреть список покупок
          </button>
        )}
      </div>
    </div>
  );
}

const ORDINALS_ACCUSATIVE = ["первую", "вторую", "третью", "четвёртую", "пятую"];

function SafeCodeTask({ topicId, onAdvance, onClose }) {
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const students = useAppStore((s) => s.students);
  const student = students.find((s) => s.id === activeStudentId) ?? null;

  const [config, setConfig] = useState(null);
  const [foundCount, setFoundCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [wrongPulse, setWrongPulse] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [opened, setOpened] = useState(false);
  const startedAtRef = useRef(null);
  const loggedRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    getSafeCodeConfig(topicId).then(setConfig).catch(() => setConfig({ codeLength: 0, locations: [] }));
  }, [topicId]);

  if (!config) return <div className="session-body reading-body">Загрузка…</div>;

  const locations = config.locations ?? [];
  const total = locations.length;

  function handleDigit(digit) {
    if (opened || foundCount >= total) return;
    const expected = locations[foundCount]?.digit;
    if (digit === expected) {
      setFeedback({ ok: true, text: "Верно! Идём дальше." });
      const next = foundCount + 1;
      setFoundCount(next);
      if (next >= total) {
        setTimeout(() => {
          setOpened(true);
          if (!loggedRef.current) {
            loggedRef.current = true;
            appendSafeCodeLog(topicId, {
              codeLength: config.codeLength,
              locationCount: total,
              wrongAttempts,
              elapsedMs: Date.now() - (startedAtRef.current ?? Date.now()),
              opened: true,
            }).catch(() => {});
          }
        }, 500);
      }
      setTimeout(() => setFeedback(null), 900);
    } else {
      setWrongAttempts((n) => n + 1);
      setWrongPulse(true);
      setFeedback({ ok: false, text: "Не подходит — попробуй ещё раз." });
      setTimeout(() => { setWrongPulse(false); setFeedback(null); }, 500);
    }
  }

  if (opened) {
    return (
      <div className="session-body reading-body safe-code-body">
        <div className="safe-code-instruction-zone">
          <div className="safe-code-icon">🔓🎉</div>
          <div className="safe-code-instruction-text">Сейф открыт!</div>
        </div>
        <RewardVideoModal
          rewardVideos={student?.rewardVideos ?? []}
          studentId={student?.id}
          onDismiss={onAdvance}
          title="Ты открыл сейф! 🎉"
        />
      </div>
    );
  }

  const current = locations[foundCount];

  return (
    <div className="session-body reading-body safe-code-body">
      <ReadingCloseButton onClose={onClose} />
      <div className="safe-code-header">
        <div className="safe-code-progress">
          {locations.map((_, i) => (
            <div key={i} className="safe-code-progress-seg">
              <div className="safe-code-progress-seg-fill" style={{ width: i < foundCount ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <div className="safe-code-tracker">
          {locations.map((loc, i) => (
            <div
              key={i}
              className={[
                "safe-code-slot",
                i === foundCount ? "safe-code-slot--active" : "",
                i === foundCount && wrongPulse ? "safe-code-slot--wrong" : "",
                i < foundCount ? "safe-code-slot--done" : "",
              ].filter(Boolean).join(" ")}
            >
              {i < foundCount ? loc.digit : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="safe-code-instruction-zone">
        <div className="safe-code-instruction-text">
          Иди и найди {current?.phrase} {ORDINALS_ACCUSATIVE[foundCount] ?? "следующую"} цифру кода.
        </div>
        <div className={`safe-code-feedback${feedback ? " safe-code-feedback--show" : ""}${feedback?.ok ? " safe-code-feedback--ok" : ""}`}>
          {feedback?.text ?? ""}
        </div>
      </div>

      <div className="safe-code-numpad">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
          <button key={d} className="safe-code-numpad-btn" onClick={() => handleDigit(d)}>{d}</button>
        ))}
        <div />
        <button className="safe-code-numpad-btn" onClick={() => handleDigit(0)}>0</button>
        <div />
      </div>
    </div>
  );
}

const TASK_RENDERERS = {
  read_text:           ReadTextTask,
  understand_text:     UnderstandTextTask,
  assemble_line:       AssembleLineTask,
  follow_instruction:  InstructionTask,
  shopping_list:       ShoppingListTask,
  safe_code:           SafeCodeTask,
};

export default function ReadingRenderer({ task, topicId, sessionParams, soundEnabled, playFeedback, onMistake, onAdvance, onQualityAnswer, onClose }) {
  const TaskRenderer = TASK_RENDERERS[task?.type];
  if (!TaskRenderer) return <div className="session-body">Неизвестный тип задания: {task?.type}</div>;
  return (
    <TaskRenderer
      task={task}
      topicId={topicId}
      sessionParams={sessionParams}
      soundEnabled={soundEnabled}
      playFeedback={playFeedback}
      onMistake={onMistake}
      onAdvance={onAdvance}
      onQualityAnswer={onQualityAnswer}
      onClose={onClose}
    />
  );
}
