import { useState } from "react";
import { useAppStore } from "@/core/store";
import { persistStudentTopicLink } from "@/core/linkUtils";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import ConceptDot from "@/shared/components/ConceptDot";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { getTopicTitle, getInitials } from "@/shared/utils/format";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { COMPARISON_LEVELS } from "@/topics/renderers/comparison/engine";

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

function BooleanParam({ label, hint, value, onChange }) {
  return (
    <label className="param-row param-row--checkbox">
      <input
        type="checkbox"
        className="param-checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="param-label">{label}</span>
      {hint ? <span className="param-hint">{hint}</span> : null}
    </label>
  );
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
];

function ComparisonParams({ params, onChange }) {
  const activeModeId      = useAppStore((s) => s.activeModeId);
  const activeLevel       = COMPARISON_LEVELS.find((l) => l.id === params.level);
  const activeQuestion    = QUESTION_OPTIONS.find((q) => q.value === params.question);
  const isFirstNumberMode = activeModeId === "compare_first_number";
  const isVisualMode      = activeModeId === "compare_visual";

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

      {!isFirstNumberMode && (
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
            {activeQuestion && (
              <div className="param-hint">{activeQuestion.hint}</div>
            )}
          </div>
        </div>
      )}

      {isFirstNumberMode && (
        <NumberStepper
          label="Примеров на экране"
          value={params.examplesCount ?? 1}
          min={1}
          max={6}
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

      {!isFirstNumberMode && (
        <BooleanParam
          label="Ответ словами"
          hint='Вместо «7 больше 4» — «Семь больше четырёх»'
          value={params.wordsVerdict}
          onChange={(v) => onChange({ ...params, wordsVerdict: v })}
        />
      )}
    </>
  );
}

export default function ParamsScreen() {
  const setScreen              = useAppStore((s) => s.setScreen);
  const activeTopicId          = useAppStore((s) => s.activeTopicId);
  const activeStudentId        = useAppStore((s) => s.activeStudentId);
  const activeTextId           = useAppStore((s) => s.activeTextId);
  const activeModeId           = useAppStore((s) => s.activeModeId);
  const topicRecords           = useAppStore((s) => s.topicRecords);
  const students               = useAppStore((s) => s.students);
  const studentTopicLinks      = useAppStore((s) => s.studentTopicLinks);
  const sessions               = useAppStore((s) => s.sessions);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const mode        = topicRecord?.modes.find((m) => m.id === activeModeId);
  const isReading   = topicRecord?.meta.renderer === "reading";
  const activeText  = isReading ? topicRecord?.texts?.find((text) => text.id === activeTextId) : null;

  const linkKey = `${activeStudentId}_${activeTopicId}`;
  const link    = studentTopicLinks[linkKey] ?? {};

  const student   = students.find((s) => s.id === activeStudentId);
  const hasVideos = (student?.rewardVideos?.length ?? 0) > 0;

  const isComparison = topicRecord?.meta.renderer === "comparison";

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
      };
    }
    const modeParams = mode?.params ?? {};
    const out = {};
    for (const [key, def] of Object.entries(modeParams)) {
      if (def.type === "concept_selector") continue;
      out[key] = saved[key] ?? def.default ?? (def.type === "number" ? def.min : def.values?.[0]);
    }
    return out;
  }

  const [params,          setParams]          = useState(getInitialParams);
  const [videoReward,    setVideoReward]     = useState(link.videoRewardEnabled ?? true);
  const [rewardThreshold, setRewardThreshold] = useState(link.rewardThreshold ?? 90);
  const [showModeInfo,   setShowModeInfo]    = useState(false);

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
  const selectedConceptIds = link.selectedConceptIds ?? allConcepts.map((c) => c.conceptId);
  function startSession() {
    if (isReading && !activeText) {
      setScreen("texts");
      return;
    }
    persistStudentTopicLink(activeStudentId, activeTopicId, { params, videoRewardEnabled: videoReward, rewardThreshold });
    setScreen("session");
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
              onChange={(v) => setParams((p) => ({ ...p, [key]: v }))}
            />
          );
        }
        return null;
      })}
    </>
  );

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("modes")}>←</button>
        <h1 className="screen-title">{mode.ui?.title ?? mode.id}</h1>
        {mode.methodology && (
          <button className="header-info-btn" onClick={() => setShowModeInfo(true)} title="О режиме">?</button>
        )}
      </div>

      <div className="params-layout">
        {/* Left info column — visible only on tablet via CSS */}
        <div className="params-info-col">
          <div className="params-info-topic">
            {getTopicTitle(topicRecord.meta.title)}
          </div>
          <div className="params-info-mode">
            {mode.ui?.title ?? mode.id}
            {mode.methodology && (
              <button className="params-info-mode-btn" onClick={() => setShowModeInfo(true)} title="О режиме">?</button>
            )}
          </div>
          {mode.ui?.instruction && (
            <div className="params-info-desc">{mode.ui.instruction}</div>
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
            <Button fullWidth onClick={startSession}>Начать занятие</Button>
          </div>
        </div>

        {/* Right settings column */}
        <div className="params-settings-col">
          <div className="params-body">
            {paramsContent}
          </div>

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
                  {[70, 80, 90].map((pct) => (
                    <button
                      key={pct}
                      className={`enum-btn enum-btn--compact ${videoReward && rewardThreshold === pct ? "enum-btn--active" : ""}`}
                      onClick={() => { setVideoReward(true); setRewardThreshold(pct); }}
                    >
                      ≥{pct}%
                    </button>
                  ))}
                </div>
                <div className="param-hint">
                  {videoReward ? `Мультик при ≥${rewardThreshold}% правильных ответов` : "Видео-награда отключена"}
                </div>
              </div>
            </div>
          )}

          {/* Start button — phone only, hidden on tablet via CSS */}
          <div className="params-start-phone">
            <Button fullWidth onClick={startSession}>Начать занятие</Button>
          </div>
        </div>
      </div>

      {showModeInfo && (
        <Modal title={mode.ui?.title ?? mode.id} onClose={() => setShowModeInfo(false)}>
          {mode.ui?.instruction && <p className="info-modal-text">{mode.ui.instruction}</p>}
          {mode.methodology?.text && <p className="info-modal-text">{mode.methodology.text}</p>}
          {mode.methodology?.tips?.length > 0 && (
            <ul className="info-modal-tips">
              {mode.methodology.tips.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          )}
          {mode.methodology?.duration && (
            <div className="info-modal-duration">⏱ {mode.methodology.duration}</div>
          )}
        </Modal>
      )}
    </div>
  );
}
