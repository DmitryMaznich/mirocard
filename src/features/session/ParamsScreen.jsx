import { useState, useEffect, useMemo } from "react";
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
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { getTopicTitle, getInitials } from "@/shared/utils/format";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { COMPARISON_LEVELS } from "@/topics/renderers/comparison/engine";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import InstructionParamsContent from "@/features/reading/InstructionParamsContent";
import SafeCodeParamsContent from "@/features/reading/SafeCodeParamsContent";
import StoveHeatModal from "@/shared/components/StoveHeatModal";
import { GLOBAL_MAX_PORTIONS } from "@/features/planner/recipeParser.js";
import { getBuiltinRecipeRawText } from "@/topics/builtinRecipesTopic.js";
import { extractAdjustableTemplates, computeAdjustableDefault, formatCompact, stepPortionsMultiplier, formatPortionsPhrase } from "@/topics/renderers/reading/parseRecipeTxt.js";
import WrittenLettersPairParams from "@/topics/renderers/written_letters/WrittenLettersPairParams";
import ShareWithStudentPanel from "@/features/session/ShareWithStudentPanel";

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
  const maxPortions = GLOBAL_MAX_PORTIONS;
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
  const adjustableLabels = activeText.adjustable ?? {};
  const allTemplates = useMemo(
    () => extractAdjustableTemplates(getBuiltinRecipeRawText(activeText.file) ?? ""),
    [activeText.file]
  );
  const adjustableTemplates = allTemplates.filter((t) => adjustableLabels[t.key] != null);
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
    const min = Math.max(0, t.base - increment);
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
              choices={choices}
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

function NumberStepper({ label, value, min, max, onChange, info, onShowInfo }) {
  return (
    <div className="param-row">
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
      <div className="param-stepper">
        <button className="stepper-btn" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="stepper-value">{value}</span>
        <button className="stepper-btn" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function EnumParam({ label, options, labels, value, onChange, disabledValues, info, onShowInfo }) {
  return (
    <div className="param-row">
      <ParamLabel label={label} info={info} onShowInfo={onShowInfo} />
      <div className="param-enum-group">
        {options.map((opt) => {
          const isDisabled = disabledValues?.includes(opt) ?? false;
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

function EnumMultiParam({ label, options, labels, value, onChange }) {
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
      <div className="param-label">{label}</div>
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
function VisualBooleanParam({ label, offLabel, value, onChange, disabled }) {
  return (
    <div
      className={`param-row param-row--visual-toggle${disabled ? " param-row--disabled" : ""}`}
      role="group"
      aria-label={label}
    >
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

const EVALUATE_QUESTION_OPTIONS = [
  { value: "more",         label: "Где больше",   hint: "Пары чисел: слева всегда большее" },
  { value: "less",         label: "Где меньше",   hint: "Пары чисел: слева всегда меньшее" },
  { value: "mix",          label: "Микс",          hint: "Направление пар чередуется случайно" },
  { value: "first_number", label: "Первое число",  hint: "Оцени первое число — больше, меньше или равно второму" },
];

const VISUAL_OPTIONS = [
  { value: "dots",         label: "Точки" },
  { value: "dots_numbers", label: "Точки + цифра" },
  { value: "numbers",      label: "Только цифры" },
];

function ComparisonParams({ params, onChange }) {
  const activeModeId     = useAppStore((s) => s.activeModeId);
  const activeLevel      = COMPARISON_LEVELS.find((l) => l.id === params.level);
  const isEvaluateMode   = activeModeId === "compare_evaluate";
  const isVisualMode     = activeModeId === "compare_visual";
  const evaluateQuestion = params.question ?? "more";

  const activeQuestion         = QUESTION_OPTIONS.find((q) => q.value === (params.question ?? "more"));
  const activeEvaluateQuestion = EVALUATE_QUESTION_OPTIONS.find((q) => q.value === evaluateQuestion);
  const multiMode              = isEvaluateMode && (params.examplesCount ?? 1) > 1;

  const currentVisualMode = params.visualMode ?? "dots";
  const dotsOnly = isVisualMode && currentVisualMode !== "numbers";

  function handleVisualModeChange(newMode) {
    const isNewDots = newMode !== "numbers";
    onChange({ ...params, visualMode: newMode, level: isNewDots && params.level > 2 ? 2 : params.level });
  }

  return (
    <>
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
        </div>
      </div>

      {isEvaluateMode && (
        <div className="param-row param-row--block">
          <div className="param-label">Что учим</div>
          <div className="param-enum-section">
            <div className="param-enum-group">
              {EVALUATE_QUESTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`enum-btn ${evaluateQuestion === opt.value ? "enum-btn--active" : ""}`}
                  onClick={() => onChange({ ...params, question: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {activeEvaluateQuestion && <div className="param-hint">{activeEvaluateQuestion.hint}</div>}
          </div>
        </div>
      )}

      {!isEvaluateMode && (
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

      {isEvaluateMode && (
        <EnumParam
          label="Тип ответа"
          options={["sign", "verbal"]}
          labels={{ sign: "Символы < = >", verbal: "Слова Больше / Меньше / Равно" }}
          value={params.style ?? "sign"}
          onChange={(v) => onChange({ ...params, style: v })}
        />
      )}

      {isEvaluateMode && (
        <NumberStepper
          label="Примеров на экране"
          value={params.examplesCount ?? 1}
          min={1}
          max={6}
          onChange={(v) => onChange({ ...params, examplesCount: v })}
        />
      )}

      {isEvaluateMode && evaluateQuestion === "first_number" && (
        <BooleanParam
          label='Подписи «Первое» и «Второе»'
          value={params.showLabels ?? true}
          disabled={multiMode}
          onChange={(v) => onChange({ ...params, showLabels: v })}
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

      <BooleanParam
        label="Ответ словами"
        hint='Вместо «7 больше 4» — «Семь больше четырёх»'
        value={params.wordsVerdict}
        disabled={multiMode}
        onChange={(v) => onChange({ ...params, wordsVerdict: v })}
      />
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
  const isPhraseMatch         = topicRecord?.meta.renderer === "phrase_match";
  const isReadingInstruction  = isReading && (activeText?.kind === "instruction" || activeText?.kind === "shopping_list");
  const isReadingSafeCode     = isReading && activeText?.kind === "safe_code";
  const isWrittenLettersPair  = topicRecord?.meta.renderer === "written_letters" && activeModeId === "match_pair";
  const isAlphabetPairs       = topicRecord?.meta.renderer === "written_letters" && activeModeId === "alphabet_pairs";
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
      return {
        level:         saved.level         ?? 2,
        question:      saved.question      ?? "more",
        showEqual:     saved.showEqual     ?? false,
        wordsVerdict:  saved.wordsVerdict  ?? false,
        visualMode:    saved.visualMode    ?? "dots",
        examplesCount: saved.examplesCount ?? 1,
        showLabels:    saved.showLabels    ?? true,
        style:         saved.style         ?? "sign",
      };
    }
    const modeParams = mode?.params ?? {};
    const out = {};
    for (const [key, def] of Object.entries(modeParams)) {
      if (def.type === "concept_selector") continue;
      if (def.type === "sentence_list") {
        out[key] = saved[key] ?? [];
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
  const [strictStars,   setStrictStars]   = useState(link.strictStars ?? mode?.rewardDefaults?.strictStars ?? true);
  const [showModeInfo,   setShowModeInfo]    = useState(false);
  const [showPinGate,    setShowPinGate]     = useState(false);
  const [activeInfo,     setActiveInfo]      = useState(null);

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

  const allConcepts        = deriveConcepts(topicRecord.cards);
  const selectedConceptIds = link.selectedConceptIds?.length ? link.selectedConceptIds : allConcepts.map((c) => c.conceptId);

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
    if (mode?.requirePin === false || mode?.type === "daily_sentences" || isAlphabetPairs) {
      launchSession();
      return;
    }
    setShowPinGate(true);
  }

  function launchSession() {
    setShowPinGate(false);
    markSessionStart();
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
  ) : (
    <>
      {!isPhraseMatch && !modeHasCategoryParam && !mode?.hideConceptPicker && (
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
            {showRangeFilter && (
              <div className="param-enum-group" style={{ marginTop: 4 }}>
                {[{ key: "all", label: "Все" }, { key: "le5", label: "≤5" }, { key: "gt5", label: ">5" }].map(({ key, label }) => (
                  <button key={key}
                    className={`enum-btn enum-btn--compact ${activeCFilter === key ? "enum-btn--active" : ""}`}
                    onClick={() => applyConceptFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="param-concept-row">
              <span className="param-hint">{selectedConceptIds.length} из {allConcepts.length} выбрано</span>
              <button className="link-btn" onClick={() => setScreen("concepts")}>Изменить</button>
            </div>
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
  const poolEmpty = isReading && activeText?.kind === "sentence_pool" && Array.isArray(params.selectedLineIds) && params.selectedLineIds.length === 0;
  const isStartDisabled = sentenceListEmpty || poolEmpty;

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

          {hasVideos && !isAlphabetPairs && (
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
                      label="Строгий подсчёт"
                      info={{
                        text: "В «Строго» любая ошибка — даже одна неверная цифра в отдельной клетке примера — сразу обнуляет серию для звёзд. В «Мягко» ошибки в клетках не сбрасывают серию, она растёт по мере решённых примеров.",
                        tip: "Для «Столбика» рекомендуем «Мягко» — ошибка в одной цифре трёхзначного числа при «Строго» может обнулить всю серию за один случайный тап.",
                      }}
                      onShowInfo={setActiveInfo}
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={strictStars}
                      aria-label="Строгий подсчёт"
                      className={`param-toggle ${strictStars ? "param-toggle--on" : ""}`}
                      disabled={!videoReward}
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
