import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import TopicCover from "@/shared/components/TopicCover";
import ModeIcon from "@/shared/components/ModeIcon";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { getTopicTitle, getInitials } from "@/shared/utils/format";

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 2v2.2M11 17.8V20M2 11h2.2M17.8 11H20M4.64 4.64l1.56 1.56M15.8 15.8l1.56 1.56M4.64 17.36l1.56-1.56M15.8 6.2l1.56-1.56"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function JourneyStep({ state, number, label, value, onClick, avatar }) {
  const showAvatar = !!avatar && state !== "disabled";
  return (
    <button
      className={`journey-step journey-step--${state}`}
      onClick={onClick}
      disabled={state === "disabled"}
    >
      <span className={`journey-step__icon${showAvatar ? " journey-step__icon--avatar" : ""}`}>
        {showAvatar ? avatar : state === "done" ? "✓" : number}
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
  if (topicRecord.meta?.renderer === "reading") {
    const texts = topicRecord.texts ?? [];
    const completed = texts.filter((text) =>
      sessions.some((session) => session.studentId === studentId && session.topicId === topicId && session.textId === text.id)
    ).length;
    return { total: texts.length, mastered: completed };
  }
  const concepts = deriveConcepts(topicRecord.cards);
  const total = concepts.length;
  const mastered = concepts.filter(
    (c) => computeConceptLevel(sessions, studentId, topicId, c.conceptId) === 3
  ).length;
  return { total, mastered };
}

export default function HomeScreen({ onOpenTimer }) {
  const setScreen = useAppStore((s) => s.setScreen);
  const students = useAppStore((s) => s.students);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const sessions = useAppStore((s) => s.sessions);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const activeTextId = useAppStore((s) => s.activeTextId);
  const activeModeId = useAppStore((s) => s.activeModeId);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  const student = students.find((s) => s.id === activeStudentId) ?? students[0];
  const topic = topicRecords.find((r) => r.meta.id === activeTopicId) ?? topicRecords[0];
  const isReading = topic?.meta?.renderer === "reading";
  const activeText = isReading
    ? topic?.texts?.find((text) => text.id === activeTextId)
    : null;
  const availableModes = isReading
    ? (activeText ? topic?.modes?.filter((m) => !(m.id === "assemble_text" && activeText.kind !== "poem")) : [])
    : topic?.modes ?? [];
  const mode = availableModes.find((m) => m.id === activeModeId) ?? availableModes[0];

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
  const canStart = !!student && !!topic && (isReading || !!mode);

  const s1 = stepState(!!student, true);
  const s2 = stepState(!!topic, !!student);
  const s3 = stepState(isReading ? !!activeText : !!mode, !!student && !!topic);

  const topicLabel = topic
    ? `${getTopicTitle(topic.meta.title)} · ${progress.mastered}/${progress.total}`
    : "Не выбрана";

  const readingStepValue = activeText
    ? `${getTopicTitle(activeText.title)}${mode ? ` · ${mode.ui?.title ?? mode.id}` : ""}`
    : "Не выбран";

  function startOrContinue() {
    if (!isReading) {
      setScreen("params");
      return;
    }
    if (!activeText) {
      setScreen("texts");
      return;
    }
    if (!mode) {
      setScreen("modes");
      return;
    }
    setScreen("params");
  }

  return (
    <div className="screen home-screen-v2">
      <HomeHeader onSettings={() => setScreen("settings")} />

      <section className="home-section">
        <div className="home-section-header">
          <span className="home-section-label">Собери занятие</span>
          <button className="home-section-add" onClick={onOpenTimer} title="Таймер" aria-label="Таймер">
            ⏱
          </button>
        </div>

        <div className="journey-steps">
          <JourneyStep
            state={s1}
            number="1"
            label="Ученик"
            value={student?.name ?? "Не выбран"}
            onClick={() => setScreen("students")}
            avatar={student ? (
              <div className="journey-student-avatar">{getInitials(student.name)}</div>
            ) : null}
          />
          <JourneyStep
            state={s2}
            number="2"
            label="Тема"
            value={topicLabel}
            onClick={() => setScreen("topics")}
            avatar={topic ? (
              <TopicCover
                topicId={topic.meta.id}
                avatarPath={topic.meta.avatar}
                title={topic.meta.title}
                size="step"
              />
            ) : null}
          />
          <JourneyStep
            state={s3}
            number="3"
            label={isReading ? "Текст и режим" : "Режим"}
            value={isReading ? readingStepValue : mode?.ui?.title ?? "Не выбран"}
            onClick={() => setScreen(isReading && !activeText ? "texts" : "modes")}
            avatar={(mode?.ui?.icon) ? (
              <ModeIcon topicId={topic?.meta.id} iconPath={mode.ui.icon} size="step" />
            ) : null}
          />
        </div>

        <div className="home-actions home-actions--footer">
          <Button fullWidth disabled={!canStart} onClick={startOrContinue}>
            ▶ Начать занятие
          </Button>
        </div>
      </section>

      <div className="home-version">v{__APP_VERSION__}</div>
    </div>
  );
}
