import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { getTopicTitle } from "@/shared/utils/format";

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="3.2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M11 2v2.2M11 17.8V20M2 11h2.2M17.8 11H20M4.64 4.64l1.56 1.56M15.8 15.8l1.56 1.56M4.64 17.36l1.56-1.56M15.8 6.2l1.56-1.56"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function HomeHeader({ onSettings }) {
  return (
    <header className="home-header">
      <div className="home-header__brand">
        <img className="home-header__logo" src="/favicon.svg" alt="" aria-hidden />
        <div className="home-header__copy">
          <span className="home-header__name">Mirocard</span>
          <span className="home-header__tagline">карточки для специалистов</span>
        </div>
      </div>
      <button className="home-header__settings-btn" onClick={onSettings} aria-label="Настройки">
        <SettingsIcon />
      </button>
    </header>
  );
}

function stepState(condition, prevCondition) {
  if (!prevCondition) return "disabled";
  if (condition) return "done";
  return "active";
}

function JourneyStep({ state, number, label, value, onClick }) {
  return (
    <button
      className={`journey-step journey-step--${state}`}
      onClick={onClick}
      disabled={state === "disabled"}
    >
      <span className="journey-step__icon">
        {state === "done" ? "✓" : number}
      </span>
      <span className="journey-step__copy">
        <span className="journey-step__label">{label}</span>
        <span className="journey-step__value">{value}</span>
      </span>
      <span className="journey-step__arrow">→</span>
    </button>
  );
}

function conceptProgressSummary(sessions, studentId, topicId, topicRecord) {
  if (!topicRecord) return { total: 0, mastered: 0 };
  const concepts = deriveConcepts(topicRecord.cards);
  const total = concepts.length;
  const mastered = concepts.filter(
    (c) => computeConceptLevel(sessions, studentId, topicId, c.conceptId) === 3
  ).length;
  return { total, mastered };
}

export default function HomeScreen() {
  const setScreen          = useAppStore((s) => s.setScreen);
  const students           = useAppStore((s) => s.students);
  const topicRecords       = useAppStore((s) => s.topicRecords);
  const sessions           = useAppStore((s) => s.sessions);
  const activeStudentId    = useAppStore((s) => s.activeStudentId);
  const activeTopicId      = useAppStore((s) => s.activeTopicId);
  const activeModeId       = useAppStore((s) => s.activeModeId);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setActiveTopicId   = useAppStore((s) => s.setActiveTopicId);
  const setActiveModeId    = useAppStore((s) => s.setActiveModeId);

  const student = students.find((s) => s.id === activeStudentId) ?? students[0];
  const topic   = topicRecords.find((r) => r.meta.id === activeTopicId) ?? topicRecords[0];
  const mode    = topic?.modes?.find((m) => m.id === activeModeId) ?? topic?.modes?.[0];

  useEffect(() => {
    if (student && student.id !== activeStudentId) setActiveStudentId(student.id);
  }, [student?.id]);

  useEffect(() => {
    if (topic && topic.meta.id !== activeTopicId) setActiveTopicId(topic.meta.id);
  }, [topic?.meta.id]);

  useEffect(() => {
    if (mode && mode.id !== activeModeId) setActiveModeId(mode.id);
  }, [mode?.id]);

  const progress = conceptProgressSummary(sessions, student?.id, topic?.meta.id, topic);
  const canStart = !!student && !!topic && !!mode;

  const s1 = stepState(!!student, true);
  const s2 = stepState(!!topic,   !!student);
  const s3 = stepState(!!mode,    !!student && !!topic);

  const topicLabel = topic
    ? `${getTopicTitle(topic.meta.title)} · ${progress.mastered}/${progress.total}`
    : "Не выбрана";

  return (
    <div className="screen home-screen-v2">
      <HomeHeader onSettings={() => setScreen("settings")} />

      <section className="home-section">
        <div className="home-section-header">
          <span className="home-section-label">Собери занятие</span>
        </div>

        <div className="journey-steps">
          <JourneyStep
            state={s1}
            number="1"
            label="Ученик"
            value={student?.name ?? "Не выбран"}
            onClick={() => setScreen("students")}
          />
          <JourneyStep
            state={s2}
            number="2"
            label="Тема"
            value={topicLabel}
            onClick={() => setScreen("topics")}
          />
          <JourneyStep
            state={s3}
            number="3"
            label="Режим"
            value={mode?.ui?.title ?? "Не выбран"}
            onClick={() => setScreen("modes")}
          />
        </div>

        <div className="home-actions home-actions--footer">
          <Button fullWidth disabled={!canStart} onClick={() => setScreen("params")}>
            ▶ Начать занятие
          </Button>
        </div>
      </section>

      <div className="home-quick-actions">
        <button className="home-quick-btn" onClick={() => setScreen("students")}>+ Ученик</button>
        <button className="home-quick-btn" onClick={() => setScreen("topics")}>↓ Темы</button>
      </div>
    </div>
  );
}
