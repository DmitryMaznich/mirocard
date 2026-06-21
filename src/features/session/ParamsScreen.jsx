import { useState } from "react";
import { useTimer } from "@/features/timer/TimerContext";
import { useAppStore } from "@/core/store";
import { persistStudentTopicLink } from "@/core/linkUtils";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import PinGateModal from "@/shared/components/PinGateModal";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import ModeMethodology from "@/shared/components/ModeMethodology";
import { getModeGoal } from "@/shared/utils/methodology";
import ConceptDot from "@/shared/components/ConceptDot";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { getTopicTitle, getInitials } from "@/shared/utils/format";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { COMPARISON_LEVELS } from "@/topics/renderers/comparison/engine";
import InstructionParamsContent from "@/features/reading/InstructionParamsContent";
import ShoppingParamsContent from "@/features/session/ShoppingParamsContent";
import ShareWithStudentPanel from "@/features/session/ShareWithStudentPanel";

function NumberStepper({ label, value, min, max, onChange }) {
  return (
    <div className="param-row">
      <div className="param-label">{label}</div>
      <div className="param-stepper">
        <button className="stepper-btn" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="stepper-value">{value}</span>
        <button className="stepper-btn" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function EnumParam({ label, options, labels, value, onChange }) {
  return (
    <div className="param-row">
      <div className="param-label">{label}</div>
      <div className="param-enum-group">
        {options.map((opt) => (
          <button
            key={opt}
            className={`enum-btn ${value === opt ? "enum-btn--active" : ""}`}
            onClick={() => onChange(opt)}
          >
            {labels?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function BooleanParam({ label, hint, value, onChange, disabled }) {
  return (
    <label className={`param-row param-row--checkbox${disabled ? " param-row--disabled" : ""}`}>
      <input
        type="checkbox"
        className="param-checkbox"
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="param-label">{label}</span>
      {hint ? <span className="param-hint">{hint}</span> : null}
    </label>
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

  const isComparison        = topicRecord?.meta.renderer === "comparison";
  const isPhraseMatch       = topicRecord?.meta.renderer === "phrase_match";
  const isReadingInstruction = isReading && (activeText?.kind === "instruction" || activeText?.kind === "shopping_list");

  if (isReadingInstruction) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("texts")}>←</button>
          <h1 className="screen-title">{getTopicTitle(activeText.title)}</h1>
        </div>
        <InstructionParamsContent
          topicId={activeTopicId}
          textId={activeTextId}
          filePath={activeText.file}
          topicTitle={getTopicTitle(topicRecord.meta.title)}
          textTitle={getTopicTitle(activeText.title)}
          student={student}
          kind={activeText.kind}
          fixedPortions={activeText.fixedPortions ?? null}
        />
      </div>
    );
  }

  const isShoppingPlan = topicRecord?.meta.renderer === "shopping" && mode?.type === "plan";
  if (isShoppingPlan) {
    const shoppingText = topicRecord?.texts?.[0];
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("home")}>←</button>
          <h1 className="screen-title">{getTopicTitle(mode?.ui?.title) || mode?.id}</h1>
        </div>
        <ShoppingParamsContent
          topicId={activeTopicId}
          textId={shoppingText?.id}
          filePath={shoppingText?.file}
          topicTitle={getTopicTitle(topicRecord.meta.title)}
          modeTitle={getTopicTitle(mode?.ui?.title) || mode?.id}
        />
      </div>
    );
  }

  function getInitialParams() {
    const saved = link.params ?? {};
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
      out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
    }
    return out;
  }

  const [params,         setParams]        = useState(getInitialParams);
  const [videoReward,   setVideoReward]   = useState(link.videoRewardEnabled ?? true);
  const [answersPerStar, setAnswersPerStar] = useState(link.answersPerStar ?? 1);
  const [showModeInfo,   setShowModeInfo]    = useState(false);
  const [showPinGate,    setShowPinGate]     = useState(false);
  const [showShare,      setShowShare]       = useState(false);

  if (!topicRecord || !mode) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("modes")}>←</button>
          <h1 className="screen-title">Параметры</h1>
        </div>
        <div className="empty-state"><div className="empty-state__text">Режим не выбран</div></div>
      </div>
    );
  }

  const allConcepts        = deriveConcepts(topicRecord.cards);
  const selectedConceptIds = link.selectedConceptIds?.length ? link.selectedConceptIds : allConcepts.map((c) => c.conceptId);
  const modeTitle          = getModeTitle(mode);
  const modeInstruction    = getModeInstruction(mode);
  const modeGoal           = getModeGoal(mode);
  const { markSessionStart } = useTimer();

  function openPinGate() {
    if (isReading && !activeText) {
      setScreen("texts");
      return;
    }
    if (mode?.requirePin === false) {
      launchSession();
      return;
    }
    setShowPinGate(true);
  }

  function launchSession() {
    setShowPinGate(false);
    markSessionStart();
    persistStudentTopicLink(activeStudentId, activeTopicId, { params, videoRewardEnabled: videoReward, answersPerStar });
    setScreen("session");
  }

  async function handleSetPin(hash) {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }

  const paramsContent = isReading ? (
    <>
      <div className="param-row param-row--block">
        <div className="param-label">Текст</div>
        <div className="param-concept-col">
          <div className="param-hint">{getTopicTitle(activeText?.title) || "Не выбран"}</div>
          <button className="link-btn" onClick={() => setScreen("texts")}>Изменить</button>
        </div>
      </div>
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
  ) : isComparison ? (
    <ComparisonParams params={params} onChange={setParams} />
  ) : (
    <>
      {!isPhraseMatch && (
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
      {Object.entries(mode.params ?? {}).map(([key, def]) => {
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
      })}
    </>
  );

  const hasSentenceListParam = Object.values(mode?.params ?? {}).some((d) => d.type === "sentence_list");
  const sentenceListEmpty = hasSentenceListParam && (params.sentences ?? []).length === 0;

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("modes")}>←</button>
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
            <Button fullWidth onClick={openPinGate} disabled={sentenceListEmpty}>Начать занятие</Button>
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

          {hasVideos && mode.evaluation !== "none" && (
            <div className="param-row param-row--block">
              <div className="param-label">Сложность серии</div>
              <div className="param-enum-section">
                <div className="param-enum-group">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className={`enum-btn enum-btn--compact ${answersPerStar === n ? "enum-btn--active" : ""}`}
                      onClick={() => setAnswersPerStar(n)}
                    >
                      ×{n}
                    </button>
                  ))}
                </div>
                <div className="param-hint">
                  Бонус каждые {5 * answersPerStar} правильных ответов подряд
                </div>
              </div>
            </div>
          )}

          {hasVideos && mode.evaluation !== "none" && (
            <div className="param-row param-row--block">
              <div className="param-label">Видео-награда</div>
              <div className="param-enum-section">
                <div className="param-enum-group">
                  <button
                    className={`enum-btn enum-btn--compact ${!videoReward ? "enum-btn--active" : ""}`}
                    onClick={() => setVideoReward(false)}
                  >
                    Нет
                  </button>
                  <button
                    className={`enum-btn enum-btn--compact ${videoReward ? "enum-btn--active" : ""}`}
                    onClick={() => setVideoReward(true)}
                  >
                    Да
                  </button>
                </div>
                <div className="param-hint">
                  {videoReward ? "Видео показывается за серию правильных ответов" : "Видео-награда отключена"}
                </div>
              </div>
            </div>
          )}

          {/* Start button — phone only, hidden on tablet via CSS */}
          <div className="params-start-phone">
            <Button fullWidth onClick={openPinGate} disabled={sentenceListEmpty}>Начать занятие</Button>
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
          modeTitle={modeTitle}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
