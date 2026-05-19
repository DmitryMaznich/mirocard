import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { shuffle } from "@/shared/utils/shuffle";
import { getTopicTitle } from "@/shared/utils/format";
import { tokenizeReadingLine } from "./engine";
import Modal from "@/shared/components/Modal";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { parseRecipeTxt, resolveStepOwners } from "./parseRecipeTxt";
import { getGroup, getRecipeOverride, getRawRecipeTxt, saveGroup, saveRecipeOverride } from "@/core/groupStore";
import { getAudioOverride, listLocalAudioOverrides, syncAudioOverrides } from "@/core/audioStore";
import AudioRecordDialog from "./AudioRecordDialog";

const UNDERSTAND_BUTTONS = [
  { value: "independent", label: "Сам", mod: "easy" },
  { value: "after_text",  label: "После текста", mod: "prompted" },
  { value: "none",        label: "Нет ответа", mod: "fail" },
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

function InstructionTask({ task, topicId, onAdvance }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const students = useAppStore((s) => s.students);
  const student = students.find((s) => s.id === activeStudentId) ?? null;

  const { speak } = useSpeech();
  const soundEnabled  = useAppStore((s) => s.settings?.soundEnabled ?? false);
  const coverImageUrl = useTopicFile(topicId, task.text?.image);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState("setup"); // "setup" | "running"
  const [baseSteps, setBaseSteps] = useState(task.text?.steps ?? []); // steps WITHOUT owner overrides
  const [steps, setSteps] = useState(task.text?.steps ?? []);         // steps used in session
  const [rawRecipe, setRawRecipe] = useState("");
  const [group, setGroup] = useState([]);

  // ── Setup-phase state ─────────────────────────────────────────────────────
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhoto, setNewMemberPhoto] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeEdit, setRecipeEdit] = useState("");
  const memberPhotoRef = useRef(null);
  const [recordedSteps, setRecordedSteps] = useState(new Set()); // step ids like "s1"
  const [audioDialogStep, setAudioDialogStep] = useState(null);  // {id, num, text} | null

  // ── Running-phase state ───────────────────────────────────────────────────
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState({});
  const [listOpen, setListOpen] = useState(false);
  const listRef = useRef(null);

  // Load recipe .txt and group from IndexedDB
  useEffect(() => {
    async function load() {
      const [grp, rawText] = await Promise.all([
        getGroup(topicId).catch(() => []),
        (async () => {
          const textId = task.text?.id;
          const filePath = task.text?.file;
          if (textId) {
            const override = await getRecipeOverride(topicId, textId).catch(() => null);
            if (override) return override;
          }
          if (filePath) return getRawRecipeTxt(topicId, filePath).catch(() => null);
          return null;
        })(),
      ]);
      setGroup(grp ?? []);
      if (rawText) {
        setRawRecipe(rawText);
        const parsed = parseRecipeTxt(rawText);
        setBaseSteps(parsed);
        setSteps(parsed);
      }
      // Load local audio overrides + sync from server
      const textId = task.text?.id ?? "";
      const overrides = await listLocalAudioOverrides(topicId, textId).catch(() => []);
      setRecordedSteps(new Set(overrides.map((o) => `s${o.stepNum}`)));
      syncAudioOverrides(topicId, textId)
        .then(() => listLocalAudioOverrides(topicId, textId))
        .then((ovrs) => setRecordedSteps(new Set(ovrs.map((o) => `s${o.stepNum}`))))
        .catch(() => {});
    }
    load();
  }, [topicId, task.text?.id, task.text?.file]);

  // ── Setup helpers ──────────────────────────────────────────────────────────
  function handleMemberPhotoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setNewMemberPhoto(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function addMember() {
    const name = newMemberName.trim();
    if (!name) return;
    const newMember = { id: `m_${Date.now()}`, name, photoDataUrl: newMemberPhoto ?? null, stepRanges: "" };
    const next = [...group, newMember];
    setGroup(next);
    await saveGroup(topicId, next).catch(() => {});
    setNewMemberName("");
    setNewMemberPhoto(null);
  }

  async function removeMember(idx) {
    const next = group.filter((_, i) => i !== idx);
    setGroup(next);
    await saveGroup(topicId, next).catch(() => {});
  }

  function updateMemberRanges(idx, ranges) {
    setGroup((prev) => prev.map((m, i) => (i === idx ? { ...m, stepRanges: ranges } : m)));
  }

  async function toggleChef(idx) {
    const next = group.map((m, i) => ({ ...m, role: i === idx && m.role !== "chef" ? "chef" : null }));
    setGroup(next);
    await saveGroup(topicId, next).catch(() => {});
  }

  async function saveRecipeEdit() {
    const textId = task.text?.id;
    if (textId) await saveRecipeOverride(topicId, textId, recipeEdit).catch(() => {});
    setRawRecipe(recipeEdit);
    const parsed = parseRecipeTxt(recipeEdit);
    setBaseSteps(parsed);
    setSteps(parsed);
    setEditingRecipe(false);
  }

  async function startSession() {
    // Persist group (with updated stepRanges)
    await saveGroup(topicId, group).catch(() => {});
    // Apply owner assignments from stepRanges on top of base steps
    const annotated = applyGroupToSteps(baseSteps, group);
    setSteps(annotated);
    setStepIndex(0);
    setChecked({});
    setPhase("running");
  }

  // ── Running helpers ────────────────────────────────────────────────────────
  const step = steps[stepIndex];
  // Support both old single-owner (step.owner) and new multi-owner (step.owners) formats
  const owners = step
    ? resolveStepOwners(step.owners ?? (step.owner ? [step.owner] : []), group, student)
    : [];
  const isLast = stepIndex === steps.length - 1;
  const allChecked =
    step?.type !== "checklist" ||
    (step.items ?? []).every((_, i) => !!checked[`${stepIndex}_${i}`]);

  useEffect(() => {
    if (phase !== "running" || !step || !soundEnabled) return;
    const textId  = task.text?.id ?? "";
    const stepNum = step.id?.startsWith("s") ? parseInt(step.id.slice(1), 10) : null;
    let cancelled = false;
    if (textId && stepNum != null) {
      getAudioOverride(topicId, textId, stepNum).then((blob) => {
        if (cancelled) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          a.onended = () => URL.revokeObjectURL(url);
          a.play();
        } else {
          const ownerPrefix = owners.map((o) => o.name).join(", ");
          const text = ownerPrefix ? `${ownerPrefix}. ${step.text}` : step.text;
          speak(text);
        }
      });
    } else {
      const ownerPrefix = owners.map((o) => o.name).join(", ");
      const text = ownerPrefix ? `${ownerPrefix}. ${step.text}` : step.text;
      speak(text);
    }
    return () => { cancelled = true; };
  }, [stepIndex, steps, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!listOpen || !listRef.current) return;
    const el = listRef.current.querySelector(".instruction-list-item--active");
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [listOpen]);

  const toggleItem = useCallback((i) => {
    const key = `${stepIndex}_${i}`;
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }, [stepIndex]);

  const handleNext = useCallback(() => {
    setListOpen(false);
    if (isLast) onAdvance();
    else setStepIndex((n) => n + 1);
  }, [isLast, onAdvance]);

  const handleSpace = useCallback(() => {
    if (step?.type === "checklist") {
      const nextUnchecked = (step.items ?? []).findIndex((_, i) => !checked[`${stepIndex}_${i}`]);
      if (nextUnchecked >= 0) { toggleItem(nextUnchecked); return; }
    }
    handleNext();
  }, [step, checked, stepIndex, toggleItem, handleNext]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex((n) => n - 1);
    else setPhase("setup");
  }, [stepIndex]);

  const reSpeak = useCallback(() => {
    if (!step || !soundEnabled) return;
    const textId  = task.text?.id ?? "";
    const stepNum = step.id?.startsWith("s") ? parseInt(step.id.slice(1), 10) : null;
    if (textId && stepNum != null) {
      getAudioOverride(topicId, textId, stepNum).then((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          a.onended = () => URL.revokeObjectURL(url);
          a.play();
        } else {
          const ownerPrefix = owners.map((o) => o.name).join(", ");
          const text = ownerPrefix ? `${ownerPrefix}. ${step.text}` : step.text;
          speak(text);
        }
      });
    } else {
      const ownerPrefix = owners.map((o) => o.name).join(", ");
      const text = ownerPrefix ? `${ownerPrefix}. ${step.text}` : step.text;
      speak(text);
    }
  }, [step, owners, speak, topicId, task.text?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowRight": case "Enter": e.preventDefault(); handleNext(); break;
        case " ":          e.preventDefault(); handleSpace(); break;
        case "ArrowLeft":  case "Backspace": e.preventDefault(); goBack(); break;
        case "r": case "R": e.preventDefault(); reSpeak(); break;
        case "Escape": e.preventDefault(); setPhase("setup"); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleNext, handleSpace, goBack, reSpeak]);

  // ── SETUP PHASE ────────────────────────────────────────────────────────────
  if (phase === "setup") {
    const memberList = (
      <div className="instruction-cover-members">
        {group.map((member, i) => (
          <div key={member.id ?? member.name} className="instruction-cover-member">
            <div className="instruction-cover-member-avatar">
              {member.photoDataUrl
                ? <img src={member.photoDataUrl} alt={member.name} />
                : <div className="instruction-cover-member-initials">{member.name?.[0] ?? "?"}</div>
              }
            </div>
            <div className="instruction-cover-member-info">
              <div className="instruction-cover-member-name">{member.name}</div>
              <input
                className="instruction-cover-ranges-input"
                value={member.stepRanges ?? ""}
                onChange={(e) => updateMemberRanges(i, e.target.value)}
                placeholder="шаги: 1-15"
              />
            </div>
            <button
              className={`instruction-cover-chef-btn${member.role === "chef" ? " instruction-cover-chef-btn--active" : ""}`}
              onClick={() => toggleChef(i)}
              title={member.role === "chef" ? "Снять роль шефа" : "Назначить шефом"}
            >
              👑
            </button>
            <button className="instruction-cover-member-remove" onClick={() => removeMember(i)}>×</button>
          </div>
        ))}
        <div className="instruction-cover-add-member">
          <button
            className="instruction-cover-photo-btn"
            onClick={() => memberPhotoRef.current?.click()}
            title="Фото"
          >
            {newMemberPhoto
              ? <img src={newMemberPhoto} alt="" className="instruction-cover-photo-preview" />
              : "📷"}
          </button>
          <input ref={memberPhotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleMemberPhotoFile} />
          <input
            className="instruction-cover-name-input"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Имя участника"
            onKeyDown={(e) => e.key === "Enter" && addMember()}
          />
          <button className="instruction-cover-add-btn" onClick={addMember} disabled={!newMemberName.trim()}>+</button>
        </div>
      </div>
    );

    const audioSection = baseSteps.some((s) => s.type !== "heading") && (
      <div className="instruction-cover-section">
        <div className="instruction-cover-section-label">Аудио шагов</div>
        <div className="instruction-audio-list">
          {baseSteps.filter((s) => s.type !== "heading").map((s) => {
            const num = parseInt(s.id.slice(1), 10);
            const hasAudio = recordedSteps.has(s.id);
            return (
              <button
                key={s.id}
                className={`instruction-audio-item${hasAudio ? " instruction-audio-item--recorded" : ""}`}
                onClick={() => setAudioDialogStep({ id: s.id, num, text: s.text })}
              >
                <span className="instruction-audio-num">{num}</span>
                <span className="instruction-audio-text">
                  {s.text.length > 55 ? s.text.slice(0, 55) + "…" : s.text}
                </span>
                {hasAudio && <span className="instruction-audio-dot" aria-label="записано" />}
              </button>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="session-body reading-body instruction-cover">
        <button className="back-btn instruction-cover-back" onClick={() => setScreen("texts")}>←</button>

        {/* Left column: cover image + title */}
        <div className="instruction-cover-left">
          {coverImageUrl && (
            <div className="instruction-cover-image">
              <img src={coverImageUrl} alt="" draggable={false} />
            </div>
          )}
          <h1 className="instruction-cover-title">{getTopicTitle(task.text?.title)}</h1>
          <button className="reading-primary-btn instruction-cover-start" onClick={startSession}>
            Начать
          </button>
        </div>

        {/* Right column: group + audio */}
        <div className="instruction-cover-right">
          <div className="instruction-cover-section">
            <div className="instruction-cover-section-label">Группа</div>
            {memberList}
          </div>

          <button
            className="instruction-cover-edit-recipe"
            onClick={() => { setRecipeEdit(rawRecipe); setEditingRecipe(true); }}
          >
            Изменить текст инструкции
          </button>

          {audioSection}
        </div>

        {audioDialogStep && (
          <AudioRecordDialog
            topicId={topicId}
            textId={task.text?.id ?? ""}
            stepNum={audioDialogStep.num}
            stepText={audioDialogStep.text}
            onClose={() => setAudioDialogStep(null)}
            onSaved={(stepId) => {
              setRecordedSteps((prev) => new Set([...prev, stepId]));
              setAudioDialogStep(null);
            }}
            onDeleted={(stepId) => {
              setRecordedSteps((prev) => { const n = new Set(prev); n.delete(stepId); return n; });
              setAudioDialogStep(null);
            }}
          />
        )}

        {editingRecipe && (
          <Modal title="Редактирование инструкции" onClose={() => setEditingRecipe(false)}>
            <textarea
              className="instruction-recipe-textarea"
              value={recipeEdit}
              onChange={(e) => setRecipeEdit(e.target.value)}
              rows={18}
            />
            <div className="instruction-recipe-actions">
              <button className="reading-secondary-btn" onClick={() => setEditingRecipe(false)}>Отмена</button>
              <button className="reading-primary-btn" onClick={saveRecipeEdit}>Сохранить</button>
            </div>
          </Modal>
        )}

      </div>
    );
  }

  // ── RUNNING PHASE ──────────────────────────────────────────────────────────
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
            <span className="instruction-progress">{stepIndex + 1} / {steps.length}</span>
          </div>

          <div className={`instruction-step${step.type === "heading" ? " instruction-step--heading" : ""}`}>
            {owners.length > 0 && step.type !== "heading" && (
              <div className="instruction-step-owner">{owners.map((o) => o.name).join(", ")},</div>
            )}
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
                    className={[
                      "instruction-list-item",
                      isDone ? "instruction-list-item--done" : "",
                      isActive ? "instruction-list-item--active" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <span className="instruction-list-icon">{isDone ? "✓" : isActive ? "▶" : ""}</span>
                    {s.type !== "heading" && <span className="instruction-list-num">{i + 1}.</span>}
                    <span className="instruction-list-text">{s.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="instruction-nav">
            <button className="reading-secondary-btn" onClick={goBack}>Назад</button>
            <button className="reading-primary-btn" disabled={!allChecked} onClick={handleNext}>
              {isLast ? "Готово" : "Дальше"}
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

const TASK_RENDERERS = {
  read_text:           ReadTextTask,
  understand_text:     UnderstandTextTask,
  assemble_line:       AssembleLineTask,
  follow_instruction:  InstructionTask,
};

export default function ReadingRenderer({ task, topicId, sessionParams, soundEnabled, playFeedback, onMistake, onAdvance, onQualityAnswer }) {
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
    />
  );
}
