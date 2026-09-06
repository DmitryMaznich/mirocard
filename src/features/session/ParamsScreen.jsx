import { useState, useEffect, useMemo, useRef } from "react";
import { useTimer } from "@/features/timer/TimerContext";
import { useAppStore } from "@/core/store";
import { persistStudentTopicLink } from "@/core/linkUtils";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import PinGateModal from "@/shared/components/PinGateModal";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import { getRecipeSettings, saveRecipeSettings, getRecipeOptionSelections, saveRecipeOptionSelections } from "@/core/groupStore";
import OptionsPicker from "@/shared/components/OptionsPicker";
import ModeMethodology from "@/shared/components/ModeMethodology";
import { getModeGoal } from "@/shared/utils/methodology";
import ConceptDot from "@/shared/components/ConceptDot";
import { deriveConcepts, getConceptCards, getFigureFilter, readModeSelectedConceptIds, withFigureFilter } from "@/shared/utils/topicUtils";
import { getTopicTitle, getInitials } from "@/shared/utils/format";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { COMPARISON_LEVELS } from "@/topics/renderers/comparison/engine";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import InstructionParamsContent from "@/features/reading/InstructionParamsContent";
import SafeCodeParamsContent from "@/features/reading/SafeCodeParamsContent";
import StoveHeatModal from "@/shared/components/StoveHeatModal";
import { GLOBAL_MAX_PORTIONS, scalePortionQty } from "@/features/planner/recipeParser.js";
import { getBuiltinRecipeRawText } from "@/topics/builtinRecipesTopic.js";
import { extractAdjustableTemplates, computeAdjustableDefault, formatCompact, stepPortionsMultiplier, formatPortionsPhrase } from "@/topics/renderers/reading/parseRecipeTxt.js";
import WrittenLettersPairParams from "@/topics/renderers/written_letters/WrittenLettersPairParams";
import SymmetryDrawPrintParams from "@/features/session/SymmetryDrawPrintParams";
import ShareWithStudentPanel from "@/features/session/ShareWithStudentPanel";
import { sessionSettingsChanged, clearActiveSessionSnapshot as clearPersistedActiveSessionSnapshot } from "@/features/session/activeSession";
import { shouldRequestSessionStartPin } from "@/features/session/sessionStartGate";
import { getFigureDifficultyRecommendation } from "@/features/session/figureDifficultyProgress";

// ─── Recipe start (portions only — no group/chef/edit tooling) ───────────────

function RecipeStartParams({ topicId, activeText, student }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setSessionPortionsOverride = useAppStore((s) => s.setSessionPortionsOverride);
  const setSessionIngredientOverrides = useAppStore((s) => s.setSessionIngredientOverrides);
  const setSessionOptionsOverride = useAppStore((s) => s.setSessionOptionsOverride);
  const { markSessionStart } = useTimer();
  const fixedPortions = activeText.fixedPortions ?? null;
  // Defaults to 1, not the recipe file's "written for N people" portions —
  // that's a fact about the recipe, not a choice the cook has made yet (same
  // reasoning as the menu/catalog ingredient previews). getRecipeSettings
  // below still restores whatever the cook picked last time for this recipe.
  const basePortions = 1;
  const maxPortions = activeText.maxPortions ?? GLOBAL_MAX_PORTIONS;
  const [portions, setPortions] = useState(basePortions);
  const [ingredientOverrides, setIngredientOverrides] = useState({});
  const [stoveModalOpen, setStoveModalOpen] = useState(false);
  const [options, setOptions] = useState({}); // { groupId: string[] } — last cooked-with choice
  const optionGroups = Object.entries(activeText.options ?? {});
  const optionGroupsMeta = activeText.optionGroups ?? {}; // { groupId: { mode, label } }, see builtinRecipesTopic.js

  // A "single" group (exclusive swap, e.g. omelette filling) always needs
  // exactly one selection — default to the first choice when nothing was
  // saved yet, so a cook who never touches the picker still gets a valid,
  // persisted choice instead of an empty/undefined one at session start.
  const effectiveOptions = { ...options };
  for (const [groupId, choices] of optionGroups) {
    if (optionGroupsMeta[groupId]?.mode === "single" && !(effectiveOptions[groupId]?.length)) {
      effectiveOptions[groupId] = choices[0] ? [choices[0].product] : [];
    }
  }

  // Only keys BOTH declared in # adjustable: (for the label) AND actually
  // present as a {key:...} template in the steps (for the number/word
  // forms) get a stepper — adjusting a key with no visible effect on any
  // step would be a dead control. Memoized on the file path only (a stable
  // string) — filtering the small resulting array against the labels object
  // every render is cheap and avoids depending on a `?? {}` object literal
  // that would get a new identity on every render.
  //
  // A key whose adjustable entry names an optionGroup (e.g. omelette milk)
  // only gets a stepper once that group actually has a selection — showing
  // "Молоко" in the ingredient ledger before the cook has even turned milk
  // on would be adjusting something that isn't part of the dish yet.
  const adjustableLabels = activeText.adjustable ?? {};
  const allTemplates = useMemo(
    () => extractAdjustableTemplates(getBuiltinRecipeRawText(activeText.file) ?? ""),
    [activeText.file]
  );
  const adjustableTemplates = allTemplates.filter((t) => {
    const info = adjustableLabels[t.key];
    if (info == null) return false;
    if (info.optionGroup) return (effectiveOptions[info.optionGroup]?.length ?? 0) > 0;
    return true;
  });
  const factor = stepPortionsMultiplier(activeText.portions, fixedPortions, portions);

  useEffect(() => {
    let cancelled = false;
    getRecipeSettings(topicId, activeText.id).then((s) => {
      if (cancelled) return;
      setPortions(s.portions ?? basePortions);
      setIngredientOverrides(s.ingredientOverrides ?? {});
    }).catch(() => {});
    getRecipeOptionSelections(topicId, activeText.id).then((s) => { if (!cancelled) setOptions(s ?? {}); }).catch(() => {});
    return () => { cancelled = true; };
  }, [topicId, activeText.id, basePortions]);

  // Changing the batch size invalidates any manual per-ingredient tweak made
  // for the old size — silently carrying it over would quietly unbalance the
  // dish (e.g. an oil amount hand-tuned for 3 portions surviving a jump to 8).
  function changePortions(next) {
    setPortions(next);
    setIngredientOverrides({});
  }

  function startSession() {
    const finalPortions = fixedPortions || portions;
    setSessionPortionsOverride(finalPortions);
    setSessionIngredientOverrides(ingredientOverrides);
    saveRecipeSettings(topicId, activeText.id, { portions: finalPortions, ingredientOverrides }).catch(() => {});
    setSessionOptionsOverride(effectiveOptions);
    saveRecipeOptionSelections(topicId, activeText.id, effectiveOptions).catch(() => {});
    markSessionStart();
    setScreen("session");
  }

  function renderLedgerRow(t) {
    const info = adjustableLabels[t.key];
    const defaultValue = computeAdjustableDefault(t, factor);
    const value = ingredientOverrides[t.key] ?? defaultValue;
    const increment = t.kind === "additive" ? t.step : 1;
    // Coverage templates have no `base` (they're driven by `divisor` instead) —
    // a whole unit is never optional, so the floor is always 1, not 0.
    const min = t.kind === "coverage" ? 1 : Math.max(0, t.base - increment);
    const isOverridden = ingredientOverrides[t.key] != null;
    return (
      <li className="rp-row" key={t.key}>
        <span className="rp-row-main">
          <span className="rp-row-label">{info.label}</span>
          {isOverridden && (
            <span className="rp-row-note">
              <button
                type="button"
                className="rp-reset-link"
                onClick={() => setIngredientOverrides((prev) => {
                  const next = { ...prev };
                  delete next[t.key];
                  return next;
                })}
              >
                правка · вернуть
              </button>
            </span>
          )}
        </span>
        <span className="rp-row-control">
          <button
            type="button"
            className="rp-spoon-btn"
            disabled={value <= min}
            onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: Math.max(min, value - increment) }))}
          >−</button>
          <span className="rp-row-value" key={value}>{formatCompact(value, info.unit)}</span>
          <button
            type="button"
            className="rp-spoon-btn"
            disabled={increment === 0}
            onClick={() => setIngredientOverrides((prev) => ({ ...prev, [t.key]: value + increment }))}
          >+</button>
        </span>
      </li>
    );
  }

  const ingredientTemplates = adjustableTemplates.filter((t) => adjustableLabels[t.key]?.group === "ingredient");
  const timeTemplates = adjustableTemplates.filter((t) => adjustableLabels[t.key]?.group === "time");

  // Each option choice (e.g. omelette filling: колбаса/курица/другое мясо)
  // carries its own qty/unit in the recipe file — scaled the same way the
  // flat ingredient ledger above is, so "1 горсть" vs "8 кружочков" shows up
  // next to the right choice instead of silently disappearing (see
  // OptionsPicker.jsx).
  function withQtyLabels(choices, groupId) {
    // A group with its own adjustable ledger stepper (e.g. omelette milk)
    // already shows and controls the real, overridable quantity above —
    // repeating a second, non-overridable number under the picker pill
    // would just go stale the moment the cook nudges the stepper.
    const hasLedgerStepper = Object.values(adjustableLabels).some((info) => info.optionGroup === groupId);
    if (hasLedgerStepper) return choices.map((c) => ({ ...c, qtyLabel: null }));
    return choices.map((c) => ({
      ...c,
      // No qty (e.g. "сколько хочешь" filling amounts, not a measured
      // dose) — the unit column doubles as the free-text label instead.
      qtyLabel: c.qty != null
        ? formatCompact(scalePortionQty(c.qty, c.additiveStep, factor, c.coverDivisor), c.unit)
        : (c.unit ?? null),
    }));
  }

  return (
    <div className="params-layout">
      <div className="params-info-col">
        {student && (
          <div className="params-info-student">
            <div className="params-info-student__avatar">
              {student.photoDataUrl
                ? <img src={student.photoDataUrl} alt={student.name} />
                : getInitials(student.name)
              }
            </div>
            <div className="params-info-student__name">{student.name}</div>
          </div>
        )}
        <div className="params-info-start">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      <div className="params-settings-col">
        <div className="params-body">
          {fixedPortions ? (
            <div className="param-row">
              <div className="param-label">Порций</div>
              <span className="all-texts-portions-fixed">готовим {fixedPortions}</span>
            </div>
          ) : (
            <section className="rp-people-hero">
              <div className="rp-people-row">
                {Array.from({ length: maxPortions }, (_, i) => i + 1).map((n) => (
                  <span key={n} className={`rp-person ${n <= portions ? "rp-person--filled" : "rp-person--ghost"}`}>
                    <svg viewBox="0 0 26 32">
                      <path
                        className="rp-fig-body"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                        d="M9.5,11 Q6,11.5 5,13 Q2,15 2.6,17.2 Q3.4,19.4 6.2,17.6 Q8,16.4 9,15
                           L9,19 Q7.5,20 7,22 L6.4,29 Q6.2,31.4 8.6,31.2 Q10.6,31 10.8,29
                           L11.6,21.5 Q12,20.2 13,20 Q14,20.2 14.4,21.5 L15.2,29
                           Q15.4,31 17.4,31.2 Q19.8,31.4 19.6,29 L19,22 Q18.5,20 17,19
                           L17,15 Q18,16.4 19.8,17.6 Q22.6,19.4 23.4,17.2 Q24,15 21,13
                           Q20,11.5 16.5,11 Q15,10.2 13,10.2 Q11,10.2 9.5,11 Z"
                      />
                      <circle className="rp-fig-head" cx="13" cy="6.6" r="4.6" strokeWidth="1.7" />
                      <g className="rp-fig-eyes" fill="#fffaf0">
                        <circle cx="11.1" cy="6.4" r="0.85" />
                        <circle cx="14.9" cy="6.4" r="0.85" />
                      </g>
                    </svg>
                  </span>
                ))}
              </div>
              <p className="rp-people-phrase">{formatPortionsPhrase(portions)}</p>
              <div className="rp-people-control">
                <button className="rp-dial-btn" onClick={() => changePortions(Math.max(1, portions - 1))} disabled={portions <= 1} aria-label="Меньше порций">−</button>
                <span className="rp-people-count" key={portions}>{portions}</span>
                <button className="rp-dial-btn" onClick={() => changePortions(Math.min(maxPortions, portions + 1))} disabled={portions >= maxPortions} aria-label="Больше порций">+</button>
              </div>
            </section>
          )}
          {ingredientTemplates.length > 0 && (
            <>
              <div className="rp-stitch">
                <svg className="rp-stitch-icon" viewBox="0 0 22 22" aria-hidden="true">
                  <path d="M4 9.5h14a7 6.3 0 0 1-14 0Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.6 8c0-1 .6-1.6 1.2-1.6M17.4 8c0-1-.6-1.6-1.2-1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span>Ингредиенты</span>
              </div>
              <ul className="rp-ledger">{ingredientTemplates.map(renderLedgerRow)}</ul>
            </>
          )}
          {timeTemplates.length > 0 && (
            <>
              <div className="rp-stitch">
                <svg className="rp-stitch-icon" viewBox="0 0 22 22" aria-hidden="true">
                  <circle cx="11" cy="12" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M11 7.6V12l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8.4 2.6h5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span>Время готовки</span>
              </div>
              <ul className="rp-ledger">{timeTemplates.map(renderLedgerRow)}</ul>
            </>
          )}
          <div className="param-row">
            <div className="param-label">Цифры на плите</div>
            <button
              type="button"
              className="link-btn"
              onClick={() => setStoveModalOpen(true)}
            >
              Настроить
            </button>
          </div>
          {optionGroups.map(([groupId, choices]) => (
            <OptionsPicker
              key={groupId}
              label={optionGroupsMeta[groupId]?.label ?? "Топпинг (можно несколько или ничего)"}
              mode={optionGroupsMeta[groupId]?.mode ?? "multi"}
              choices={withQtyLabels(choices, groupId)}
              selected={effectiveOptions[groupId] ?? []}
              onChange={(next) => setOptions((prev) => ({ ...prev, [groupId]: next }))}
            />
          ))}
        </div>
        <div className="params-start-phone">
          <Button fullWidth onClick={startSession}>Начать готовить</Button>
        </div>
      </div>

      {stoveModalOpen && <StoveHeatModal onClose={() => setStoveModalOpen(false)} />}
    </div>
  );
}

function ParamLabel({ label, info, onShowInfo }) {
  return (
    <div className="param-label-wrap">
      <span className="param-label">{label}</span>
      {info && (
        <button
          type="button"
          className="param-info-btn"
          aria-label={`Что означает: ${label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShowInfo({ title: label, text: info.text, tip: info.tip });
          }}
        >
          i
        </button>
      )}
    </div>
  );
}

function NumberStepper({ label, value, min, max, onChange, info, onShowInfo, disabled = false }) {
  return (
    <div className="param-row">
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
      <div className="param-stepper">
        <button className="stepper-btn" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="stepper-value">{value}</span>
        <button className="stepper-btn" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function EnumParam({ label, options, labels, value, onChange, disabledValues, info, onShowInfo, disabled = false }) {
  return (
    <div className="param-row">
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
      <div className="param-enum-group">
        {options.map((opt) => {
          const isDisabled = disabled || (disabledValues?.includes(opt) ?? false);
          return (
            <button
              key={opt}
              className={`enum-btn ${value === opt ? "enum-btn--active" : ""}`}
              onClick={() => onChange(opt)}
              disabled={isDisabled}
            >
              {labels?.[opt] ?? opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function figureCountLabel(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} заданий`;
  if (last === 1) return `${count} задание`;
  if (last >= 2 && last <= 4) return `${count} задания`;
  return `${count} заданий`;
}

function FigureDifficultyParam({
  topicRecord,
  mode,
  params,
  onChange,
  onShowInfo,
  sessions,
  studentId,
  topicId,
  children,
}) {
  const def = mode?.params?.figureDifficulty;
  if (!def) return null;
  const figureFilter = getFigureFilter(params, mode);
  const value = figureFilter.type === "difficulty" ? figureFilter.difficulty : null;
  const labels = def.labels?.ru ?? {};
  const recommendation = getFigureDifficultyRecommendation(sessions, {
    studentId,
    topicId,
    modeId: mode.id,
    difficulty: value ?? "all",
  });
  return (
    <div className="param-row param-row--block figure-difficulty-param">
      <ParamLabel label={def.label?.ru ?? "Сложность фигур"} info={def.info?.ru} onShowInfo={onShowInfo} />
      <div className="param-enum-group figure-difficulty-options">
        {def.values.map((option) => {
          const count = getConceptCards(topicRecord, mode, withFigureFilter(params, mode, { type: "difficulty", difficulty: option })).length;
          return (
            <button
              key={option}
              className={`enum-btn figure-difficulty-option ${value === option ? "enum-btn--active" : ""}`}
              onClick={() => onChange((current) => withFigureFilter(current, mode, { type: "difficulty", difficulty: option }))}
            >
              <span>{labels[option] ?? option}</span>
              <span className="figure-difficulty-option__count">{figureCountLabel(count)}</span>
            </button>
          );
        })}
        {children}
      </div>
      {recommendation && figureFilter.type === "difficulty" && (
        <div className="param-hint figure-difficulty-recommendation" role="status">
          <span>{recommendation.successfulSessions} уверенных занятия позади. Можно попробовать «{labels[recommendation.nextDifficulty] ?? recommendation.nextDifficulty}».</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => onChange((current) => withFigureFilter(current, mode, { type: "difficulty", difficulty: recommendation.nextDifficulty }))}
          >
            Выбрать
          </button>
        </div>
      )}
    </div>
  );
}

const THUMBNAIL_DIRECTIONS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  up_left: [-1, -1], up_right: [1, -1], down_left: [-1, 1], down_right: [1, 1],
};

function figurePreviewPaths(card) {
  if (card.sourcePaths?.length) return card.sourcePaths;
  if (card.points?.length) return [[card.start, ...card.points]];
  if (!card.start || !card.commands?.length) return [];
  const points = [{ ...card.start }];
  for (const command of card.commands) {
    const direction = THUMBNAIL_DIRECTIONS[command.direction];
    if (!direction) continue;
    const previous = points.at(-1);
    points.push({
      col: previous.col + direction[0] * command.cells,
      row: previous.row + direction[1] * command.cells,
    });
  }
  return [points];
}

function FigureThumbnail({ card }) {
  // For repeat/mirror tasks sourcePaths only cover the sample half of the
  // card (0..axisCol); the other half is blank workspace for the child to
  // draw in. Cropping the thumbnail to that half keeps the pictogram large
  // and legible instead of shrinking it into half an otherwise-empty grid.
  const hasSampleHalf = card.sourcePaths?.length && card.axisCol != null;
  const columns = hasSampleHalf ? Number(card.axisCol) : Number(card.columns ?? 10);
  const rows = Number(card.rows ?? 8);
  const gridLines = [
    ...Array.from({ length: columns + 1 }, (_, col) => `M ${col} 0 V ${rows}`),
    ...Array.from({ length: rows + 1 }, (_, row) => `M 0 ${row} H ${columns}`),
  ].join(" ");
  return (
    <svg className="figure-picker__thumbnail" viewBox={`-0.35 -0.35 ${columns + 0.7} ${rows + 0.7}`} aria-hidden="true">
      <path className="figure-picker__thumbnail-grid" d={gridLines} />
      {figurePreviewPaths(card).map((path, index) => (
        <path
          key={index}
          className="figure-picker__line"
          d={path.map((point, pointIndex) => `${pointIndex ? "L" : "M"} ${point.col} ${point.row}`).join(" ")}
        />
      ))}
    </svg>
  );
}

function FigurePickerParam({ topicRecord, mode, params, onChange }) {
  const figureFilter = getFigureFilter(params, mode);
  const allFigures = getConceptCards(
    topicRecord,
    mode,
    withFigureFilter(params, mode, { type: "difficulty", difficulty: "all" }),
  );
  const activeFigures = getConceptCards(topicRecord, mode, params);
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState(() => new Set());
  const [browseDifficulty, setBrowseDifficulty] = useState("all");
  const difficultyLabels = mode?.params?.figureDifficulty?.labels?.ru ?? {};
  const selectedIds = figureFilter.type === "manual" ? figureFilter.cardIds : null;
  const selectedCount = activeFigures.length;
  const visibleFigures = browseDifficulty === "all"
    ? allFigures
    : allFigures.filter((card) => card.difficulty === browseDifficulty);

  function openPicker() {
    setDraftIds(new Set(selectedIds ?? activeFigures.map((card) => card.id)));
    setBrowseDifficulty(figureFilter.type === "difficulty" ? figureFilter.difficulty : "all");
    setOpen(true);
  }

  function toggle(cardId) {
    setDraftIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function applySelection() {
    const cardIds = allFigures.filter((card) => draftIds.has(card.id)).map((card) => card.id);
    if (!cardIds.length) return;
    onChange((current) => withFigureFilter(current, mode, { type: "manual", cardIds }));
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`enum-btn figure-difficulty-option figure-picker-trigger ${selectedIds ? "enum-btn--active" : ""}`}
        onClick={openPicker}
      >
        <span>Свой набор</span>
        <span className="figure-difficulty-option__count">{selectedIds ? `${selectedCount} выбрано` : "Выбрать рисунки"}</span>
      </button>
      {open && (
        <Modal
          title="Выберите рисунки"
          onClose={() => setOpen(false)}
          actions={(
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={applySelection} disabled={!draftIds.size}>Выбрать {draftIds.size || ""}</Button>
            </>
          )}
        >
          <p className="figure-picker__intro">Отметьте рисунки для занятия. Выбор заменяет быстрый фильтр сложности; кнопки сложности вернут набор целиком.</p>
          <div className="figure-picker__filters" aria-label="Показать рисунки по сложности">
            {mode?.params?.figureDifficulty?.values?.map((difficulty) => (
              <button
                type="button"
                key={difficulty}
                className={`enum-btn enum-btn--compact ${browseDifficulty === difficulty ? "enum-btn--active" : ""}`}
                onClick={() => setBrowseDifficulty(difficulty)}
              >
                {difficultyLabels[difficulty] ?? difficulty}
              </button>
            ))}
          </div>
          <div className="figure-picker__toolbar">
            <span className="param-hint">{draftIds.size} из {allFigures.length} отмечено</span>
            <label className="figure-picker__select-all">
              <input
                type="checkbox"
                checked={allFigures.length > 0 && draftIds.size === allFigures.length}
                onChange={(event) => setDraftIds(event.target.checked ? new Set(allFigures.map((card) => card.id)) : new Set())}
              />
              <span>Все рисунки</span>
            </label>
          </div>
          <div className="figure-picker__grid" role="group" aria-label="Рисунки">
            {visibleFigures.map((card) => {
              const selected = draftIds.has(card.id);
              return (
                <button
                  type="button"
                  key={card.id}
                  className={`figure-picker__card ${selected ? "figure-picker__card--selected" : ""}`}
                  onClick={() => toggle(card.id)}
                  aria-pressed={selected}
                >
                  <FigureThumbnail card={card} />
                  <span className="figure-picker__name">{card.label}</span>
                  <span className="figure-picker__level">{difficultyLabels[card.difficulty] ?? card.difficulty}</span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}

function EnumMultiParam({ label, options, labels, value, onChange, info, onShowInfo }) {
  const selected = Array.isArray(value) ? value : [];
  const allSelected = selected.length === 0;

  function toggle(opt) {
    if (allSelected) {
      onChange([opt]);
      return;
    }
    const next = selected.includes(opt)
      ? selected.filter(o => o !== opt)
      : [...selected, opt];
    onChange(next.length === options.length ? [] : next);
  }

  return (
    <div className="param-row param-row--block">
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
      <div className="param-enum-group">
        <button
          className={`enum-btn ${allSelected ? "enum-btn--active" : ""}`}
          onClick={() => onChange([])}
        >
          Все
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            className={`enum-btn ${!allSelected && selected.includes(opt) ? "enum-btn--active" : ""}`}
            onClick={() => toggle(opt)}
          >
            {labels?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function BooleanParam({ label, hint, value, onChange, disabled, info, onShowInfo }) {
  return (
    <>
      <div className={`param-row${disabled ? " param-row--disabled" : ""}`}>
        <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          aria-label={label}
          className={`param-toggle ${value ? "param-toggle--on" : ""}`}
          disabled={disabled}
          onClick={() => onChange(!value)}
        />
      </div>
      {hint ? <div className="param-hint param-hint--under-row">{hint}</div> : null}
    </>
  );
}

// Two-segment switch: left side is a text label (the "off" state), right side is a
// small preview of the actual visual it turns on — used where the setting IS a choice
// between two concrete looks, so showing the look directly reads faster than a label.
function VisualBooleanParam({ label, offLabel, value, onChange, disabled, info, onShowInfo }) {
  return (
    <div className={`param-row${disabled ? " param-row--disabled" : ""}`}>
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
      <div className="param-visual-toggle">
        <button
          type="button"
          className={`enum-btn ${!value ? "enum-btn--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          {offLabel}
        </button>
        <button
          type="button"
          className={`enum-btn enum-btn--visual ${value ? "enum-btn--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          <span className="param-visual-block">10</span>
        </button>
      </div>
    </div>
  );
}

function SentenceListParam({ label, predefined, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const [customText, setCustomText] = useState(() =>
    selected.filter((s) => !predefined.some((p) => p.text === s)).join("\n")
  );

  function togglePredefined(text) {
    if (selected.includes(text)) {
      onChange(selected.filter((s) => s !== text));
    } else {
      onChange([...selected, text]);
    }
  }

  function handleCustomChange(e) {
    setCustomText(e.target.value);
    const customLines = e.target.value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const predefinedSelected = selected.filter((s) => predefined.some((p) => p.text === s));
    onChange([...predefinedSelected, ...customLines]);
  }

  return (
    <div className="param-row param-row--block param-sentence-list">
      <div className="param-label">{label}</div>
      <div className="param-sentence-list__body">
        {predefined.length > 0 && (
          <div className="param-sentence-list__predefined">
            {predefined.map((s) => (
              <label key={s.id} className="param-sentence-list__item">
                <input
                  type="checkbox"
                  className="param-checkbox"
                  checked={selected.includes(s.text)}
                  onChange={() => togglePredefined(s.text)}
                />
                <span>{s.text}</span>
              </label>
            ))}
          </div>
        )}
        <div className="param-sentence-list__custom">
          <div className="param-hint">Свои предложения (по одному на строку):</div>
          <textarea
            className="param-sentence-textarea"
            rows={3}
            value={customText}
            onChange={handleCustomChange}
            placeholder="Например: Ваня читает книгу."
          />
        </div>
      </div>
    </div>
  );
}

// Modal picker, same open/draft/apply shape as FigurePickerParam ("Повтори рисунок") --
// added 2026-08-20 once the predefined list grew past what a single inline checkbox block
// comfortably fits on the params screen. Also reverses an earlier explicit decision (see git
// history): propis's read_text texts used to be pre-authored only, no free-text merge --
// the user asked for a "своего текста" section, same idea as SentenceListParam's custom
// textarea, just file-upload-capable too (texts here are full paragraphs, not one-liners).
// Both predefined and custom texts are stored as plain content strings in the same `value`
// array either way -- engine.js/ReadTextView never know or care which kind a given string
// is (see engine.js's read_text branch), so nothing downstream of this component changed.
const TEXT_LIST_CUSTOM_MAX_LENGTH_DEFAULT = 300;

function normalizeUploadedText(raw) {
  // Uploaded/typed text often has blank lines between paragraphs for readability --
  // layoutTextIntoRows treats every "\n" as a real row break (including blank ones), so
  // without collapsing those here, the text renders with an empty ruled row after every
  // single line (same fix as TextUploadParam.handleFile, applied here for the same reason).
  return raw.replace(/\r\n?/g, "\n").replace(/\n{2,}/g, "\n").trim();
}

function TextListParam({ label, predefined, value, maxLength, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const customMaxLength = maxLength ?? TEXT_LIST_CUSTOM_MAX_LENGTH_DEFAULT;

  const [open, setOpen] = useState(false);
  const [draftPredefinedIds, setDraftPredefinedIds] = useState(() => new Set());
  const [draftCustomTexts, setDraftCustomTexts] = useState([]);
  const [customDraftText, setCustomDraftText] = useState("");
  const [customError, setCustomError] = useState(null);
  const fileRef = useRef(null);

  const totalSelected = draftPredefinedIds.size + draftCustomTexts.length;

  function openPicker() {
    const predefinedTexts = new Set(predefined.map((t) => t.text));
    setDraftPredefinedIds(new Set(predefined.filter((t) => selected.includes(t.text)).map((t) => t.id)));
    setDraftCustomTexts(selected.filter((s) => !predefinedTexts.has(s)));
    setCustomDraftText("");
    setCustomError(null);
    setOpen(true);
  }

  function togglePredefined(id) {
    setDraftPredefinedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCustomText(raw) {
    const normalized = normalizeUploadedText(raw);
    if (!normalized) return;
    if (normalized.length > customMaxLength) {
      setCustomError(`Слишком длинный текст: ${normalized.length} символов, максимум ${customMaxLength}.`);
      return;
    }
    setCustomError(null);
    setDraftCustomTexts((current) => [...current, normalized]);
    setCustomDraftText("");
  }

  function removeCustomText(index) {
    setDraftCustomTexts((current) => current.filter((_, i) => i !== index));
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      addCustomText(await file.text());
    } catch {
      setCustomError("Не удалось прочитать файл. Убедитесь, что это текстовый .txt файл.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applySelection() {
    const predefinedTexts = predefined.filter((t) => draftPredefinedIds.has(t.id)).map((t) => t.text);
    const next = [...draftCustomTexts, ...predefinedTexts];
    if (!next.length) return;
    onChange(next);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`enum-btn figure-difficulty-option figure-picker-trigger ${selected.length ? "enum-btn--active" : ""}`}
        onClick={openPicker}
      >
        <span>{label}</span>
        <span className="figure-difficulty-option__count">{selected.length ? `${selected.length} выбрано` : "Выбрать тексты"}</span>
      </button>
      {open && (
        <Modal
          title="Выберите тексты"
          onClose={() => setOpen(false)}
          actions={(
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={applySelection} disabled={!totalSelected}>Выбрать {totalSelected || ""}</Button>
            </>
          )}
        >
          <div className="text-picker__custom-section">
            <div className="param-hint">Свои тексты</div>
            {draftCustomTexts.length > 0 && (
              <div className="text-picker__custom-list">
                {draftCustomTexts.map((t, i) => (
                  <div key={i} className="text-picker__custom-item">
                    <span className="text-picker__custom-item-preview">{t}</span>
                    <button
                      type="button"
                      className="text-picker__custom-item-remove"
                      onClick={() => removeCustomText(i)}
                      aria-label="Удалить текст"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              className="param-sentence-textarea"
              rows={3}
              value={customDraftText}
              onChange={(e) => setCustomDraftText(e.target.value)}
              placeholder="Напечатайте свой текст…"
            />
            <div className="text-picker__custom-actions">
              <button
                type="button"
                className="param-text-upload__link"
                onClick={() => addCustomText(customDraftText)}
                disabled={!customDraftText.trim()}
              >
                + Добавить текст
              </button>
              <button type="button" className="param-text-upload__link" onClick={() => fileRef.current?.click()}>
                📄 Загрузить .txt
              </button>
            </div>
            {customError && <div className="param-text-upload__error">{customError}</div>}
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFile}
              style={{ display: "none" }}
            />
          </div>

          <div className="figure-picker__toolbar">
            <span className="param-hint">{draftPredefinedIds.size} из {predefined.length} отмечено</span>
            <label className="figure-picker__select-all">
              <input
                type="checkbox"
                checked={predefined.length > 0 && draftPredefinedIds.size === predefined.length}
                onChange={(e) => setDraftPredefinedIds(e.target.checked ? new Set(predefined.map((t) => t.id)) : new Set())}
              />
              <span>Все тексты</span>
            </label>
          </div>
          <div className="param-sentence-list__predefined text-picker__predefined-list">
            {predefined.map((t) => (
              <label key={t.id} className="param-sentence-list__item">
                <input
                  type="checkbox"
                  className="param-checkbox"
                  checked={draftPredefinedIds.has(t.id)}
                  onChange={() => togglePredefined(t.id)}
                />
                <span>{t.text}</span>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function TextUploadParam({ label, maxLength, value, onChange }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      // Uploaded files are often authored with blank lines between paragraphs/list items
      // for readability (see content/recipes/*.txt) — layoutTextIntoRows treats every "\n"
      // as a real row break (including blank ones, to support the on-screen keyboard's
      // double-Enter blank-line gesture), so without collapsing those here, an uploaded
      // file renders with an empty ruled row after every single line (2026-08-14).
      const normalized = raw.replace(/\r\n?/g, "\n").replace(/\n{2,}/g, "\n").trim();
      if (normalized.length > maxLength) {
        setError(`Слишком длинный текст: ${normalized.length} символов, максимум ${maxLength}.`);
        return;
      }
      setError(null);
      onChange(normalized);
    } catch {
      setError("Не удалось прочитать файл. Убедитесь, что это текстовый .txt файл.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="param-row param-row--block param-text-upload">
      <div className="param-label">{label}</div>
      <div className="param-text-upload__body">
        {value ? (
          <>
            <div className="param-text-upload__preview">{value}</div>
            <div className="param-text-upload__actions">
              <button type="button" className="param-text-upload__link" onClick={() => fileRef.current?.click()}>
                Заменить файл
              </button>
              <button type="button" className="param-text-upload__link" onClick={() => onChange("")}>
                Очистить
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="param-text-upload__trigger" onClick={() => fileRef.current?.click()}>
            📄 Загрузить .txt
          </button>
        )}
        {error && <div className="param-text-upload__error">{error}</div>}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}

function SentencePoolSelector({ lines, value, onChange }) {
  const allSelected = value === null || value === undefined;
  const selectedSet = allSelected
    ? new Set(lines.map((l) => l.id))
    : new Set(value);
  const count = selectedSet.size;

  function toggle(id) {
    const next = new Set(selectedSet);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next.size === lines.length ? null : [...next]);
  }

  return (
    <div className="param-row param-row--block param-sentence-list">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="param-label" style={{ margin: 0 }}>
          Предложения
          <span className="param-hint" style={{ fontWeight: "normal", marginLeft: 6 }}>{count} / {lines.length}</span>
        </div>
        <label className="param-sentence-list__item" style={{ margin: 0 }}>
          <input
            type="checkbox"
            className="param-checkbox"
            checked={allSelected}
            onChange={(e) => onChange(e.target.checked ? null : [])}
          />
          <span>Выбрать все</span>
        </label>
      </div>
      <div className="param-sentence-list__predefined" style={{ maxHeight: 300, overflowY: "auto" }}>
        {lines.map((line) => (
          <label key={line.id} className="param-sentence-list__item">
            <input
              type="checkbox"
              className="param-checkbox"
              checked={selectedSet.has(line.id)}
              onChange={() => toggle(line.id)}
            />
            <span>{line.text}{line.therapist && <span style={{ color: "var(--color-accent, #4a7fd4)", marginLeft: 4 }}>*</span>}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function getModeTitle(mode) {
  return getTopicTitle(mode?.ui?.title) || mode?.id || "";
}

function getModeInstruction(mode) {
  return getTopicTitle(mode?.ui?.instruction);
}

const LEVEL_DESCRIPTIONS = {
  1: "Начальный — числа до 10, разница не менее 5",
  2: "Базовый — числа до 10, любая разница",
  3: "Средний — числа до 20, любая разница",
  4: "Сложный — двузначные числа до 99",
};

const QUESTION_OPTIONS = [
  { value: "more", label: "Больше",  hint: "Ребёнок всегда ищет большее" },
  { value: "less", label: "Меньше",  hint: "Ребёнок всегда ищет меньшее" },
  { value: "mix",  label: "Микс",    hint: "Вопросы «больше» и «меньше» чередуются" },
];

const VISUAL_OPTIONS = [
  { value: "dots",         label: "Точки" },
  { value: "dots_numbers", label: "Точки + цифра" },
  { value: "numbers",      label: "Только цифры" },
  { value: "pairing",      label: "Пары" },
];

function ComparisonParams({ params, onChange }) {
  const activeModeId     = useAppStore((s) => s.activeModeId);
  const activeLevel      = COMPARISON_LEVELS.find((l) => l.id === params.level);
  const isEvaluateMode   = activeModeId === "compare_evaluate";
  const isVisualMode     = activeModeId === "compare_visual";
  // The sign to draw is fully determined by left vs right — "Что учим"
  // (more/less/mix) can't change which sign is correct, so it has no
  // effect for this mode and would just be a dead control. The same is
  // true of "Сравни и поставь знак" and "Контрольная работа" — both ask
  // the child to name the actual relationship between two numbers, so a
  // forced direction would either make the task trivial (rig every pair
  // to the same answer) or contradict itself (label says "больше" on a
  // pair where it isn't). See compare_first_number below for the one
  // evaluate-family mode where a fixed relationship genuinely is the task.
  const isDrawSignMode   = activeModeId === "compare_draw_sign";
  const isTestMode       = activeModeId === "compare_test";
  const isFirstNumberMode = activeModeId === "compare_first_number";
  const isApplyMode      = activeModeId === "compare_apply";
  // Unlike compare_evaluate/compare_apply above, "Что учим" (more/less/mix)
  // does apply here — engine.js's realLifeTaskFromScene takes the asked
  // direction as its own input and derives both the instruction wording and
  // which side actually answers it, rather than always hard-coding
  // "больше" the way this mode used to.
  const isRealLifeMode   = activeModeId === "compare_real_life";
  const isEvaluateFamily  = isEvaluateMode || isTestMode;

  const activeQuestion = QUESTION_OPTIONS.find((q) => q.value === (params.question ?? "more"));
  const multiMode       = isTestMode && (params.examplesCount ?? 1) > 1;

  const currentVisualMode = params.visualMode ?? "dots";
  const dotsOnly = isVisualMode && currentVisualMode !== "numbers";

  function handleVisualModeChange(newMode) {
    const isNewDots = newMode !== "numbers";
    onChange({ ...params, visualMode: newMode, level: isNewDots && params.level > 2 ? 2 : params.level });
  }

  return (
    <>
      {/* compare_real_life draws from a fixed bank of 10 pre-illustrated
          scenes (see realLifeScenes.js) instead of generating numbers within
          a level's range, and always shows all three answer buttons
          (У {A} / Поровну / У {B}) — neither "Уровень" nor "=" has any
          effect there, so don't expose controls that can't change anything
          (same reasoning as compare_apply's showEqual exclusion below). */}
      {!isRealLifeMode && (
        <div className="param-row param-row--block">
          <div className="param-label">Уровень</div>
          <div className="param-enum-row">
            <div className="param-enum-section">
              <div className="param-enum-group">
                {COMPARISON_LEVELS.map((lvl) => (
                  <button
                    key={lvl.id}
                    className={`enum-btn enum-btn--compact ${params.level === lvl.id ? "enum-btn--active" : ""}`}
                    disabled={dotsOnly && lvl.id > 2}
                    onClick={() => onChange({ ...params, level: lvl.id })}
                  >
                    {lvl.id}
                  </button>
                ))}
              </div>
              {activeLevel && <div className="param-hint">{LEVEL_DESCRIPTIONS[activeLevel.id]}</div>}
              {dotsOnly && <div className="param-hint">Уровни 3–4 доступны только в режиме «Только цифры»</div>}
            </div>

            {/* compare_apply never reads showEqual (see engine.js's
                compare_apply branch, which returns before the showEqual
                destructure below it) — both its task types need distinct
                numbers (a tied number breaks "choose one that fits" and
                "which slot does it go in"), so the toggle would just be
                dead UI there. */}
            {!isApplyMode && (
              <>
                <div className="param-enum-divider" />

                <div className="param-enum-section">
                  <button
                    className={`enum-btn enum-btn--compact ${params.showEqual ? "enum-btn--active" : ""}`}
                    onClick={() => onChange({ ...params, showEqual: !params.showEqual })}
                  >
                    =
                  </button>
                  <div className="param-hint">
                    {params.showEqual ? "С одинаковыми (~30%)" : "Без одинаковых"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!isEvaluateFamily && !isDrawSignMode && !isFirstNumberMode && !isApplyMode && (
        <div className="param-row param-row--block">
          <div className="param-label">Что учим</div>
          <div className="param-enum-section">
            <div className="param-enum-group">
              {QUESTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`enum-btn ${params.question === opt.value ? "enum-btn--active" : ""}`}
                  onClick={() => onChange({ ...params, question: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {activeQuestion && <div className="param-hint">{activeQuestion.hint}</div>}
          </div>
        </div>
      )}

      {isEvaluateFamily && (
        <EnumParam
          label="Тип ответа"
          options={["sign", "verbal"]}
          labels={{ sign: "Символы < = >", verbal: "Слова Больше / Меньше / Равно" }}
          value={params.style ?? "sign"}
          onChange={(v) => onChange({ ...params, style: v })}
        />
      )}

      {isTestMode && (
        <NumberStepper
          label="Примеров на экране"
          value={params.examplesCount ?? 4}
          min={2}
          max={10}
          onChange={(v) => onChange({ ...params, examplesCount: v })}
        />
      )}

      {isFirstNumberMode && (
        <BooleanParam
          label='Подписи «Первое» и «Второе»'
          value={params.showLabels ?? true}
          onChange={(v) => onChange({ ...params, showLabels: v })}
        />
      )}

      {isApplyMode && (
        <EnumParam
          label="Тип задания"
          options={["generate", "order"]}
          labels={{ generate: "Выбери число", order: "Расставь по порядку" }}
          value={params.taskType ?? "generate"}
          onChange={(v) => onChange({ ...params, taskType: v })}
        />
      )}

      {isApplyMode && params.taskType === "order" && (
        <NumberStepper
          label="Чисел в задании"
          value={params.numbersCount ?? 3}
          min={3}
          max={5}
          onChange={(v) => onChange({ ...params, numbersCount: v })}
        />
      )}

      {isApplyMode && params.taskType === "order" && (
        <EnumParam
          label="Направление"
          options={["asc", "desc"]}
          labels={{ asc: "Меньше → Больше", desc: "Больше → Меньше" }}
          value={params.orderDirection ?? "asc"}
          onChange={(v) => onChange({ ...params, orderDirection: v })}
        />
      )}

      {isVisualMode && (
        <div className="param-row param-row--block">
          <div className="param-label">Вид</div>
          <div className="param-enum-section">
            <div className="param-enum-group">
              {VISUAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`enum-btn ${currentVisualMode === opt.value ? "enum-btn--active" : ""}`}
                  onClick={() => handleVisualModeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isFirstNumberMode && !isApplyMode && !isRealLifeMode && (
        // compare_first_number's own verdict is always spoken as words by
        // design ("Три меньше семи"), compare_apply has no left/right
        // verdict sentence at all, and compare_real_life's verdict is a
        // fixed character-based phrase — this toggle has no effect in any
        // of them, so don't expose a control that can't change anything
        // (same bug as compare_draw_sign's old "Что учим").
        <BooleanParam
          label="Ответ словами"
          hint='Вместо «7 больше 4» — «Семь больше четырёх»'
          value={params.wordsVerdict}
          disabled={multiMode}
          onChange={(v) => onChange({ ...params, wordsVerdict: v })}
        />
      )}
    </>
  );
}

export default function ParamsScreen() {
  const setScreen              = useAppStore((s) => s.setScreen);
  const sessionReturnScreen    = useAppStore((s) => s.sessionReturnScreen);
  const setSessionReturnScreen = useAppStore((s) => s.setSessionReturnScreen);
  const activeTopicId          = useAppStore((s) => s.activeTopicId);
  const activeStudentId        = useAppStore((s) => s.activeStudentId);
  const activeTextId           = useAppStore((s) => s.activeTextId);
  const activeTextStored       = useAppStore((s) => s.activeText);
  const activeModeId           = useAppStore((s) => s.activeModeId);
  const topicRecords           = useAppStore((s) => s.topicRecords);
  const students               = useAppStore((s) => s.students);
  const studentTopicLinks      = useAppStore((s) => s.studentTopicLinks);
  const sessions               = useAppStore((s) => s.sessions);
  const adultPinHash           = useAppStore((s) => s.settings.adultPinHash);
  const settings               = useAppStore((s) => s.settings);
  const patchSettings          = useAppStore((s) => s.patchSettings);
  const clearActiveSessionSnapshot = useAppStore((s) => s.clearActiveSessionSnapshot);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const mode        = topicRecord?.modes.find((m) => m.id === activeModeId);
  const isReading   = topicRecord?.meta.renderer === "reading";
  const activeText  = isReading
    ? (topicRecord?.texts?.find((text) => text.id === activeTextId) ?? (activeTextStored?.id === activeTextId ? activeTextStored : null))
    : null;

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link    = studentTopicLinks[linkKey] ?? {};

  const student   = students.find((s) => s.id === activeStudentId);
  const hasVideos = (student?.rewardVideos?.length ?? 0) > 0;

  const isComparison          = topicRecord?.meta.renderer === "comparison";
  const isReadingInstruction  = isReading && (activeText?.kind === "instruction" || activeText?.kind === "shopping_list");
  const isReadingSafeCode     = isReading && activeText?.kind === "safe_code";
  const isWrittenLettersPair  = topicRecord?.meta.renderer === "written_letters" && activeModeId === "match_pair";
  const isAlphabetPairs       = topicRecord?.meta.renderer === "written_letters" && activeModeId === "alphabet_pairs";
  // Coordinate dictations need their own printable layout, so the print panel is
  // available for the directions variant only.
  const isSymmetryDrawPrint   = activeTopicId === "symmetry_draw" && ["mirror_draw", "repeat_draw"].includes(mode?.type);
  const isGraphicDictation   = activeTopicId === "symmetry_draw" && mode?.type === "graphic_dictation";
  const modeHasCategoryParam  = !!mode?.params?.category;

  const [showShare, setShowShare] = useState(false);

  if (isReadingInstruction) {
    const earlyModeTitle = getTopicTitle(mode?.ui?.title) || mode?.id;
    return (
      <div className="screen">
        <div className="screen-header">
          <button
            className="back-btn"
            onClick={() => {
              setScreen(sessionReturnScreen ?? "texts");
              setSessionReturnScreen(null);
            }}
          ><BackArrowIcon /></button>
          <h1 className="screen-title">{getTopicTitle(activeText.title)}</h1>
          <button className="params-share-btn-header" onClick={() => setShowShare(true)}>↗ Ученику</button>
        </div>
        {activeText.kind === "instruction"
          ? <RecipeStartParams topicId={activeTopicId} activeText={activeText} student={student} />
          : <InstructionParamsContent
              topicId={activeTopicId}
              textId={activeTextId}
              filePath={activeText.file}
              topicTitle={getTopicTitle(topicRecord.meta.title)}
              textTitle={getTopicTitle(activeText.title)}
              student={student}
              kind={activeText.kind}
              fixedPortions={activeText.fixedPortions ?? null}
            />
        }
        {showShare && (
          <ShareWithStudentPanel
            topicId={activeTopicId}
            modeId={activeModeId}
            textId={activeTextId}
            modeTitle={earlyModeTitle}
            onClose={() => setShowShare(false)}
          />
        )}
      </div>
    );
  }

  if (isReadingSafeCode) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button
            className="back-btn"
            onClick={() => {
              setScreen(sessionReturnScreen ?? "texts");
              setSessionReturnScreen(null);
            }}
          ><BackArrowIcon /></button>
          <h1 className="screen-title">{getTopicTitle(activeText.title)}</h1>
        </div>
        <SafeCodeParamsContent
          topicId={activeTopicId}
          topicTitle={getTopicTitle(topicRecord.meta.title)}
          textTitle={getTopicTitle(activeText.title)}
          student={student}
        />
      </div>
    );
  }

  function getInitialParams() {
    const saved = link.params ?? {};
    if (isReading && activeText?.kind === "sentence_pool") {
      return { selectedLineIds: saved.selectedLineIds ?? null, group: mode?.group ?? null };
    }
    if (isComparison) {
      // compare_visual's own methodology recommends starting at level 1
      // (diff >= 5, most contrastive) — other modes keep the general default.
      const defaultLevel = activeModeId === "compare_visual" ? 1 : 2;
      // examplesCount is stored on the shared per-topic params object (this
      // link key isn't per-mode), but only "Контрольная работа" exposes a
      // control for it — force it to that mode's fixed shape on entry so a
      // value picked in one mode can't silently carry into another mode
      // that doesn't even show the control (e.g. "Сравни и поставь знак"
      // quietly running in worksheet mode because the student last set 4
      // examples in "Контрольная работа").
      const isTestMode = activeModeId === "compare_test";
      const examplesCount = isTestMode
        ? Math.max(2, Math.min(10, saved.examplesCount ?? 4))
        : 1;
      // Same per-topic-not-per-mode leakage guard as examplesCount above —
      // taskType only means anything in compare_apply.
      const isApplyMode = activeModeId === "compare_apply";
      const taskType = isApplyMode ? (saved.taskType ?? "generate") : "generate";
      const numbersCount = isApplyMode && taskType === "order"
        ? Math.max(3, Math.min(5, saved.numbersCount ?? 3))
        : 3;
      const orderDirection = isApplyMode && taskType === "order"
        ? (saved.orderDirection === "desc" ? "desc" : "asc")
        : "asc";
      return {
        level:         saved.level         ?? defaultLevel,
        question:      saved.question      ?? "more",
        showEqual:     saved.showEqual     ?? false,
        wordsVerdict:  saved.wordsVerdict  ?? false,
        visualMode:    saved.visualMode    ?? "dots",
        examplesCount,
        showLabels:    saved.showLabels    ?? true,
        style:         saved.style         ?? "sign",
        taskType,
        numbersCount,
        orderDirection,
      };
    }
    const modeParams = mode?.params ?? {};
    // Visual figure selections are deliberately namespaced by exercise inside
    // this object.  It is not a declared renderer option, so retain it while
    // normalizing the rest of the saved settings.
    const out = saved.figureFilters && typeof saved.figureFilters === "object"
      ? { figureFilters: saved.figureFilters }
      : {};
    for (const [key, def] of Object.entries(modeParams)) {
      if (def.type === "concept_selector") continue;
      if (def.type === "sentence_list") {
        out[key] = saved[key] ?? [];
        continue;
      }
      if (def.type === "text_list") {
        out[key] = saved[key] ?? [];
        continue;
      }
      if (def.type === "text_upload") {
        out[key] = saved[key] ?? "";
        continue;
      }
      if (def.type === "enum_multi") {
        out[key] = saved[key] ?? def.default ?? [];
        continue;
      }
      out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
    }
    return out;
  }

  const [params,         setParams]        = useState(getInitialParams);
  const [videoReward,   setVideoReward]   = useState(link.videoRewardEnabled ?? true);
  const [answersPerStar, setAnswersPerStar] = useState(link.answersPerStar ?? 1);
  const forceStrictStars = mode?.rewardDefaults?.forceStrictStars === true;
  const [strictStarsSetting, setStrictStars] = useState(link.strictStars ?? mode?.rewardDefaults?.strictStars ?? true);
  const strictStars = forceStrictStars ? true : strictStarsSetting;
  const [showModeInfo,   setShowModeInfo]    = useState(false);
  const [showPinGate,    setShowPinGate]     = useState(false);
  const [activeInfo,     setActiveInfo]      = useState(null);
  // Flash cards are an ungraded introduction. A video for repeatedly tapping
  // through them would look like a reward for guessing, not for learning.
  const isNavigatorFlashCards = activeTopicId === "symmetry_draw"
    && activeModeId === "navigator_learning"
    && params.learningExercise === "cards";

  const allModes = topicRecord?.modes ?? [];
  const modeBackScreen = allModes.length <= 1 ? (isReading ? "texts" : "home") : "modes";

  if (!topicRecord || !mode) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("modes")}><BackArrowIcon /></button>
          <h1 className="screen-title">Параметры</h1>
        </div>
        <div className="empty-state"><div className="empty-state__text">Режим не выбран</div></div>
      </div>
    );
  }

  const allConcepts        = deriveConcepts(getConceptCards(topicRecord, mode, params));
  const modeSelectedConceptIds = readModeSelectedConceptIds(topicRecord, mode, link.selectedConceptIds?.length ? link.selectedConceptIds : null, params);
  const selectedConceptIds = modeSelectedConceptIds ?? allConcepts.map((c) => c.conceptId);

  // Concept range filter — only in "Считаем на пальцах" mode
  const fcountCards    = activeModeId === "fingers_count"
    ? (topicRecord.cards ?? []).filter(c => c.params?.mode === "fingers_count")
    : [];
  const le5ConceptIds  = fcountCards.filter(c => c.params.a <= 5 && c.params.b <= 5).map(c => c.conceptId);
  const gt5ConceptIds  = fcountCards.filter(c => c.params.a > 5  || c.params.b > 5).map(c => c.conceptId);
  const showRangeFilter = fcountCards.length > 0 && le5ConceptIds.length > 0 && gt5ConceptIds.length > 0;

  const activeCFilter = (() => {
    const sel = link.selectedConceptIds;
    if (!sel || sel.length === 0) return "all";
    const selStr = [...sel].sort().join(",");
    if (selStr === allConcepts.map(c => c.conceptId).sort().join(",")) return "all";
    if (selStr === [...le5ConceptIds].sort().join(",")) return "le5";
    if (selStr === [...gt5ConceptIds].sort().join(",")) return "gt5";
    return null;
  })();

  function applyConceptFilter(filter) {
    const ids = filter === "all" ? null : filter === "le5" ? le5ConceptIds : gt5ConceptIds;
    persistStudentTopicLink(activeStudentId, activeTopicId, { selectedConceptIds: ids });
  }
  const modeTitle          = getModeTitle(mode);
  const modeInstruction    = getModeInstruction(mode);
  const modeGoal           = getModeGoal(mode);
  const { markSessionStart } = useTimer();

  function openPinGate() {
    if (isReading && !activeText) {
      setScreen("texts");
      return;
    }
    const bypassPin = mode?.requirePin === false || mode?.type === "daily_sentences" || isAlphabetPairs;
    if (!shouldRequestSessionStartPin({ videoRewardEnabled: videoReward && !isNavigatorFlashCards, bypassPin })) {
      launchSession();
      return;
    }
    setShowPinGate(true);
  }

  function launchSession() {
    setShowPinGate(false);
    markSessionStart();

    // If the parent came here mid-session (Настройки button) and actually changed
    // something, an active-session snapshot for this exact student/topic/mode still
    // matches on identity and would otherwise silently resurrect the old task list and
    // old answersPerStar/strictStars. An unchanged round-trip (just opened Настройки
    // and left) must still resume normally, so only clear when settings really differ.
    const baseline = {
      params: getInitialParams(),
      videoRewardEnabled: link.videoRewardEnabled ?? true,
      answersPerStar: link.answersPerStar ?? 1,
      strictStars: forceStrictStars ? true : (link.strictStars ?? mode?.rewardDefaults?.strictStars ?? true),
    };
    const current = { params, videoRewardEnabled: videoReward, answersPerStar, strictStars };
    if (sessionSettingsChanged(current, baseline)) {
      clearActiveSessionSnapshot();
      getDb().then((db) => clearPersistedActiveSessionSnapshot(db)).catch(() => {});
    }

    persistStudentTopicLink(activeStudentId, activeTopicId, { params, videoRewardEnabled: videoReward, answersPerStar, strictStars });
    setScreen("session");
    setSessionReturnScreen(null);
  }

  async function handleSetPin(hash) {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  const paramsContent = isReading ? (
    <>
      {activeText?.kind !== "sentence_pool" && (
        <div className="param-row param-row--block">
          <div className="param-label">Текст</div>
          <div className="param-concept-col">
            <div className="param-hint">{getTopicTitle(activeText?.title) || "Не выбран"}</div>
            <button className="link-btn" onClick={() => setScreen("texts")}>Изменить</button>
          </div>
        </div>
      )}
      {activeText?.kind === "sentence_pool" && (
        <SentencePoolSelector
          lines={(activeText.lines ?? []).filter((l) => !mode?.group || l.group === mode.group)}
          value={params.selectedLineIds ?? null}
          onChange={(v) => setParams((p) => ({ ...p, selectedLineIds: v }))}
        />
      )}
      {Object.entries(mode.params ?? {}).map(([key, def]) => {
        if (def.type === "enum") {
          return (
            <EnumParam
              key={key}
              label={def.label?.ru ?? key}
              options={def.values}
              labels={def.labels?.ru}
              value={params[key] ?? def.default}
              onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              disabledValues={def.disabledValues}
              info={def.info?.ru}
              onShowInfo={setActiveInfo}
            />
          );
        }
        if (def.type === "boolean") {
          return (
            <BooleanParam
              key={key}
              label={def.label?.ru ?? key}
              hint={def.hint?.ru ?? ""}
              value={params[key] ?? def.default ?? false}
              disabled={def.dependsOn ? !params[def.dependsOn] : false}
              onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              info={def.info?.ru}
              onShowInfo={setActiveInfo}
            />
          );
        }
        return null;
      })}
    </>
  ) : isWrittenLettersPair ? (
    <WrittenLettersPairParams params={params} onChange={setParams} />
  ) : isComparison ? (
    <ComparisonParams params={params} onChange={setParams} />
  ) : isGraphicDictation ? (
    <>
      <FigureDifficultyParam
        topicRecord={topicRecord} mode={mode} params={params} onChange={setParams} onShowInfo={setActiveInfo}
        sessions={sessions} studentId={activeStudentId} topicId={activeTopicId}
      >
        <FigurePickerParam topicRecord={topicRecord} mode={mode} params={params} onChange={setParams} />
      </FigureDifficultyParam>
      <EnumParam
        label="Как строить рисунок"
        options={["directions", "coordinates"]}
        labels={{ directions: "По направлениям", coordinates: "По координатам" }}
        value={params.dictationCommand ?? "directions"}
        onChange={(v) => setParams((p) => ({ ...p, dictationCommand: v }))}
        info={mode?.params?.dictationCommand?.info?.ru}
        onShowInfo={setActiveInfo}
      />
      {(params.dictationCommand ?? "directions") === "directions" && (
        <>
          <BooleanParam
            label="Стрелка в подсказке"
            hint="Выключите, чтобы ребёнок читал команду текстом, а не смотрел на значок"
            value={params.showArrow ?? true}
            onChange={(v) => setParams((p) => ({ ...p, showArrow: v }))}
          />
          <SymmetryDrawPrintParams topicRecord={topicRecord} mode={mode} params={params} />
        </>
      )}
    </>
  ) : isSymmetryDrawPrint ? (
    <>
      <FigureDifficultyParam
        topicRecord={topicRecord} mode={mode} params={params} onChange={setParams} onShowInfo={setActiveInfo}
        sessions={sessions} studentId={activeStudentId} topicId={activeTopicId}
      >
        <FigurePickerParam topicRecord={topicRecord} mode={mode} params={params} onChange={setParams} />
      </FigureDifficultyParam>
      <SymmetryDrawPrintParams topicRecord={topicRecord} mode={mode} params={params} />
    </>
  ) : (
    <>
      {!modeHasCategoryParam && !mode?.hideConceptPicker && (
        <div className="param-row param-row--block">
          <div className="param-label">Понятия</div>
          <div className="param-concept-col">
            <div className="param-concept-dots">
              {allConcepts.map((c) => (
                <ConceptDot
                  key={c.conceptId}
                  level={computeConceptLevel(sessions, activeStudentId, activeTopicId, c.conceptId)}
                  size={10}
                />
              ))}
            </div>
            <div className="param-concept-row">
              <span className="param-hint">{selectedConceptIds.length} из {allConcepts.length} выбрано</span>
              <button className="link-btn" onClick={() => setScreen("concepts")}>Изменить</button>
            </div>
          </div>
        </div>
      )}
      {/* fingers_count's quick range filter still narrows selectedConceptIds under the
          hood, but stands on its own now that hideConceptPicker hides the full concept
          picker (dots grid) for this mode — the parent never needs to see 88 topic-wide
          concept dots to pick "small numbers only". showRangeFilter is only ever true
          for fingers_count (see fcountCards above), which always sets hideConceptPicker,
          so this is the only place it can still render. */}
      {showRangeFilter && (
        <div className="param-row param-row--block">
          <ParamLabel
            label="Диапазон чисел"
            info={{
              text: "Сужает примеры до пар чисел ≤5 или пар, где хотя бы одно число больше 5 — быстрый выбор вместо ручного отбора карточек-понятий.",
              tip: "Начните с «≤5», пока ребёнок считает на одной руке; переходите на «>5», когда счёт с переходом через пятёрку освоен.",
            }}
            onShowInfo={setActiveInfo}
          />
          <div className="param-enum-group">
            {[{ key: "all", label: "Все" }, { key: "le5", label: "≤5" }, { key: "gt5", label: ">5" }].map(({ key, label }) => (
              <button key={key}
                className={`enum-btn enum-btn--compact ${activeCFilter === key ? "enum-btn--active" : ""}`}
                onClick={() => applyConceptFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {(() => {
        function renderParam(key, def) {
          if (def.type === "concept_selector") return null;
          if (def.showWhen) {
            const [condKey, condVal] = Object.entries(def.showWhen)[0];
            if ((params[condKey] ?? mode.params?.[condKey]?.default) !== condVal) return null;
          }
          const isDisabled = def.disabledWhen
            ? Object.entries(def.disabledWhen).some(([condKey, condValue]) => (params[condKey] ?? mode.params?.[condKey]?.default) === condValue)
            : false;
          if (def.type === "number") {
            return (
              <NumberStepper
                key={key}
                label={def.label?.ru ?? key}
                value={params[key] ?? def.default}
                min={def.min}
                max={def.max}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
                disabled={isDisabled}
              />
            );
          }
          if (def.type === "enum") {
            return (
              <EnumParam
                key={key}
                label={def.label?.ru ?? key}
                options={def.values}
                labels={def.labels?.ru}
                value={params[key] ?? def.default}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                disabledValues={def.disabledValues}
                disabled={isDisabled}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
          if (def.type === "enum_multi") {
            return (
              <EnumMultiParam
                key={key}
                label={def.label?.ru ?? key}
                options={def.values}
                labels={def.labels?.ru}
                value={params[key] ?? def.default ?? []}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
          if (def.type === "number") {
            return (
              <NumberStepper
                key={key}
                label={def.label?.ru ?? key}
                value={params[key] ?? def.default ?? def.min}
                min={def.min}
                max={def.max}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
          if (def.type === "boolean") {
            return (
              <BooleanParam
                key={key}
                label={def.label?.ru ?? key}
                hint={def.hint?.ru ?? ""}
                value={params[key] ?? def.default ?? false}
                disabled={def.dependsOn ? !params[def.dependsOn] : false}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
          if (def.type === "visual_boolean") {
            return (
              <VisualBooleanParam
                key={key}
                label={def.label?.ru ?? key}
                offLabel={def.offLabel?.ru ?? "Выкл"}
                value={params[key] ?? def.default ?? false}
                disabled={def.dependsOn ? !params[def.dependsOn] : false}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
                info={def.info?.ru}
                onShowInfo={setActiveInfo}
              />
            );
          }
          if (def.type === "sentence_list") {
            const predefined = topicRecord?.sentences ?? [];
            return (
              <SentenceListParam
                key={key}
                label={def.label?.ru ?? key}
                predefined={predefined}
                value={params[key] ?? []}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          if (def.type === "text_list") {
            const predefined = topicRecord?.texts ?? [];
            return (
              <TextListParam
                key={key}
                label={def.label?.ru ?? key}
                predefined={predefined}
                maxLength={def.maxLength}
                value={params[key] ?? []}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          if (def.type === "text_upload") {
            return (
              <TextUploadParam
                key={key}
                label={def.label?.ru ?? key}
                maxLength={def.maxLength}
                value={params[key] ?? ""}
                onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
              />
            );
          }
          return null;
        }

        const allEntries = Object.entries(mode.params ?? {});
        const ungrouped  = allEntries.filter(([, def]) => !def.section);
        const sectionMap = {};
        for (const [key, def] of allEntries) {
          if (def.section) {
            if (!sectionMap[def.section]) sectionMap[def.section] = [];
            sectionMap[def.section].push([key, def]);
          }
        }

        return (
          <>
            {ungrouped.map(([key, def]) => renderParam(key, def))}
            {Object.entries(sectionMap).map(([sectionName, entries]) => (
              <div key={sectionName} className="param-section">
                <div className="param-section__header">{sectionName}</div>
                {entries.map(([key, def]) => renderParam(key, def))}
              </div>
            ))}
          </>
        );
      })()}
    </>
  );

  const hasSentenceListParam = Object.values(mode?.params ?? {}).some((d) => d.type === "sentence_list");
  const sentenceListEmpty = hasSentenceListParam && (params.sentences ?? []).length === 0;
  const hasTextListParam = Object.values(mode?.params ?? {}).some((d) => d.type === "text_list");
  const textListEmpty = hasTextListParam && (params.texts ?? []).length === 0;
  const poolEmpty = isReading && activeText?.kind === "sentence_pool" && Array.isArray(params.selectedLineIds) && params.selectedLineIds.length === 0;
  const isStartDisabled = sentenceListEmpty || textListEmpty || poolEmpty;

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen(modeBackScreen)}><BackArrowIcon /></button>
        <h1 className="screen-title">{modeTitle}</h1>
        <button className="header-info-btn" onClick={() => setShowModeInfo(true)} title="О режиме">?</button>
      </div>

      <div className="params-layout">
        {/* Left info column — visible only on tablet via CSS */}
        <div className="params-info-col">
          <div className="params-info-topic">
            {getTopicTitle(topicRecord.meta.title)}
          </div>
          <div className="params-info-mode">
            {modeTitle}
            <button className="params-info-mode-btn" onClick={() => setShowModeInfo(true)} title="О режиме">?</button>
          </div>
          {modeInstruction && (
            <div className="params-info-desc">{modeInstruction}</div>
          )}
          {modeGoal && (
            <div className="params-info-goal">
              <span>Цель</span>
              {modeGoal}
            </div>
          )}
          {student && (
            <div className="params-info-student">
              <div className="params-info-student__avatar">
                {getInitials(student.name)}
              </div>
              <div className="params-info-student__name">{student.name}</div>
            </div>
          )}
          <div className="params-info-start">
            <Button fullWidth onClick={openPinGate} disabled={isStartDisabled}>Начать занятие</Button>
            <button className="params-share-btn" onClick={() => setShowShare(true)}>
              ↗ Отправить ученику
            </button>
          </div>
        </div>

        {/* Right settings column */}
        <div className="params-settings-col">
          <div className="params-body">
            {paramsContent}
          </div>

          {hasVideos && isNavigatorFlashCards && (
            <div className="param-section">
              <div className="param-section__header">Карточки — знакомство</div>
              <div className="param-hint">Здесь ребёнок спокойно знакомится со стрелками, без оценки и видеонаграды. Для проверки и награды выберите «Выбери слово» или «Выбери стрелку».</div>
            </div>
          )}

          {hasVideos && !isAlphabetPairs && !isNavigatorFlashCards && (
            <div className="param-section">
              <div className="param-section__header">Награда за занятие</div>

              <div className="param-row">
                <ParamLabel
                  label="Видео-награда"
                  info={{
                    text: "Включает показ бонусного видео ученику за успешную серию правильных ответов в этом занятии.",
                    tip: "Выключите, если видео отвлекает ребёнка от задания сильнее, чем мотивирует.",
                  }}
                  onShowInfo={setActiveInfo}
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={videoReward}
                  aria-label="Видео-награда"
                  className={`param-toggle ${videoReward ? "param-toggle--on" : ""}`}
                  onClick={() => setVideoReward((v) => !v)}
                />
              </div>

              {mode.evaluation !== "none" && (
                <>
                  <div className={`param-row${!videoReward ? " param-row--disabled" : ""}`}>
                    <ParamLabel
                      label="Серия для видеонаграды"
                      info={{
                        text: "Сколько правильных ответов подряд без ошибок нужно набрать, чтобы получить бонусное видео — отображается как 5 звёзд по пути.",
                        tip: "Начните с 5, чтобы награда приходила быстро и не терялась мотивация; увеличивайте до 10-15 по мере уверенности ребёнка.",
                      }}
                      onShowInfo={setActiveInfo}
                    />
                    <div className="param-enum-group">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          className={`enum-btn ${answersPerStar === n ? "enum-btn--active" : ""}`}
                          disabled={!videoReward}
                          onClick={() => setAnswersPerStar(n)}
                        >
                          {5 * n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`param-row${!videoReward ? " param-row--disabled" : ""}`}>
                    <ParamLabel
                      label={forceStrictStars ? "Строгий подсчёт — обязателен" : "Строгий подсчёт"}
                      info={{
                        text: forceStrictStars
                          ? "В этом режиме неверная точка всегда обнуляет серию звёзд: здесь важна последовательность точных ответов."
                          : "В «Строго» любая ошибка — даже одна неверная цифра в отдельной клетке примера — сразу обнуляет серию для звёзд. В «Мягко» ошибки в клетках не сбрасывают серию, она растёт по мере решённых примеров.",
                        tip: forceStrictStars
                          ? "Сначала закрепляйте уверенное чтение координат короткими сериями из пяти точных ответов."
                          : "Для «Столбика» рекомендуем «Мягко» — ошибка в одной цифре трёхзначного числа при «Строго» может обнулить всю серию за один случайный тап.",
                      }}
                      onShowInfo={setActiveInfo}
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={strictStars}
                      aria-label="Строгий подсчёт"
                      className={`param-toggle ${strictStars ? "param-toggle--on" : ""}`}
                      disabled={!videoReward || forceStrictStars}
                      onClick={() => setStrictStars((v) => !v)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Start button — phone only, hidden on tablet via CSS */}
          <div className="params-start-phone">
            <Button fullWidth onClick={openPinGate} disabled={isStartDisabled}>Начать занятие</Button>
            <button className="params-share-btn" onClick={() => setShowShare(true)}>
              ↗ Отправить ученику
            </button>
          </div>
        </div>
      </div>

      {showModeInfo && (
        <Modal title={modeTitle} onClose={() => setShowModeInfo(false)}>
          <ModeMethodology mode={mode} />
        </Modal>
      )}

      {activeInfo && (
        <Modal title={activeInfo.title} onClose={() => setActiveInfo(null)}>
          <p className="info-modal-text">{activeInfo.text}</p>
          {activeInfo.tip && (
            <div className="info-modal-tip"><b>Совет:</b> {activeInfo.tip}</div>
          )}
        </Modal>
      )}

      {showPinGate && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={launchSession}
          onSetPin={handleSetPin}
          onCancel={() => setShowPinGate(false)}
        />
      )}

      {showShare && (
        <ShareWithStudentPanel
          topicId={activeTopicId}
          modeId={activeModeId}
          textId={isReading ? activeTextId : undefined}
          modeTitle={modeTitle}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
