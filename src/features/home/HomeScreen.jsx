import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import TopicCover from "@/shared/components/TopicCover";
import ModeIcon from "@/shared/components/ModeIcon";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { getTopicTitle, getInitials } from "@/shared/utils/format";
import { refreshInstalledCatalogTopics, silentUpdateOutdatedTopics } from "@/features/topics/catalogService";
import { loadPlan } from "@/features/planner/plannerApi";
import { countPlanRecipes } from "@/features/planner/plannerUtils";
import "@/features/planner/planner.css";

// ─── Icons ────────────────────────────────────────────────────────────────────

function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 19C3.5 15.13 6.91 12 11 12C15.09 12 18.5 15.13 18.5 19"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function HomeHeader({ onSettings, onBrandTap }) {
  return (
    <header className="home-header">
      <div className="home-header__brand" onClick={onBrandTap} style={{ cursor: "default" }}>
        <img className="home-header__logo" src="/mirocard-mark.svg" alt="" aria-hidden />
        <div className="home-header__copy">
          <span className="home-header__name">Mirocard</span>
          <span className="home-header__tagline">карточки для специалистов</span>
        </div>
      </div>
      <button className="home-header__settings-btn" onClick={onSettings} aria-label="Настройки">
        <AccountIcon />
      </button>
    </header>
  );
}

// ─── Student picker bar ────────────────────────────────────────────────────────

function ChevronTriangle() {
  return (
    <svg className="home-student-bar__chevron" width="9" height="16" viewBox="0 0 9 16" aria-hidden>
      <polygon points="0,0 9,8 0,16" fill="currentColor" />
    </svg>
  );
}

function StudentPickerBar({ student, onTap }) {
  return (
    <button className="home-student-bar" onClick={onTap}>
      <span className={`home-student-bar__icon${student ? ' home-student-bar__icon--filled' : ''}`}>
        {student ? (
          student.photo
            ? <img src={student.photo} alt="" />
            : getInitials(student.name)
        ) : '+'}
      </span>
      <span className="home-student-bar__copy">
        <span className="home-student-bar__label">Ученик</span>
        <span className="home-student-bar__value">
          {student?.name ?? 'Не выбран'}
        </span>
      </span>
      <ChevronTriangle />
    </button>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function HomeTabs({ active, onChange, showPlanner }) {
  return (
    <div className="home-tabs" role="tablist">
      <button
        role="tab"
        className={`home-tab${active === 'session' ? ' home-tab--active' : ''}`}
        onClick={() => onChange('session')}
      >
        Занятие
      </button>
      {showPlanner && (
        <button
          role="tab"
          className={`home-tab${active === 'planner' ? ' home-tab--active' : ''}`}
          onClick={() => onChange('planner')}
        >
          Планировщик
        </button>
      )}
    </div>
  );
}

// ─── Journey step helpers ─────────────────────────────────────────────────────

function RecipeAvatar({ topicId, imagePath }) {
  const url = useTopicFile(topicId, imagePath);
  if (!url) return null;
  return <img className="topic-cover topic-cover--step" src={url} alt="" />;
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

// ─── Session tab ──────────────────────────────────────────────────────────────

function SessionTab({
  student, topic, activeText, mode,
  isReading, isChatPractice,
  s2, s3, topicLabel, readingStepValue, modeTitle,
  canStart, startOrContinue, setScreen,
}) {
  if (!student) {
    return (
      <div className="home-tab-empty">
        <p>Выбери ученика выше</p>
        <Button onClick={() => setScreen("students")}>Выбрать ученика</Button>
      </div>
    );
  }

  return (
    <section className="home-section">
      <div className="home-section-header">
        <span className="home-section-label">Собери занятие</span>
      </div>
      <div className="journey-steps">
        <JourneyStep
          state={s2}
          number="1"
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
          number="2"
          label={isReading ? "Текст и режим" : "Режим"}
          value={isReading ? readingStepValue : modeTitle || "Не выбран"}
          onClick={() => setScreen(
            isReading && activeText?.kind !== "instruction" && activeText
              ? "modes"
              : isReading ? "texts" : "modes"
          )}
          avatar={
            isReading && activeText?.kind === "instruction" && activeText?.image
              ? <RecipeAvatar topicId={topic?.meta.id} imagePath={activeText.image} />
              : mode?.ui?.icon
                ? <ModeIcon topicId={topic?.meta.id} iconPath={mode.ui.icon} size="step" />
                : null
          }
        />
      </div>
      <div className="home-actions home-actions--footer">
        <Button fullWidth disabled={!canStart} onClick={startOrContinue}>
          ▶ Начать занятие
        </Button>
      </div>
    </section>
  );
}

// ─── Planner tab ──────────────────────────────────────────────────────────────

function DayStrip({ days }) {
  return (
    <span className="hub-card__daystrip">
      {days.map((day, i) => {
        const filled = Object.values(day.meals).some((ids) => ids.length > 0);
        return <span key={i} className={`daydot${filled ? ' daydot--filled' : ''}`} />;
      })}
    </span>
  );
}

function PlannerTab({ student, setScreen }) {
  const setPlannerInitialView = useAppStore((s) => s.setPlannerInitialView);
  const [existingPlan, setExistingPlan] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!student) { setExistingPlan(null); return; }
    loadPlan(student.id).then(setExistingPlan);
  }, [student?.id]);

  if (!student) {
    return (
      <div className="home-tab-empty">
        <p>Выбери ученика выше</p>
        <Button onClick={() => setScreen("students")}>Выбрать ученика</Button>
      </div>
    );
  }

  if (existingPlan === undefined) {
    return (
      <div className="planner-hub">
        <div className="home-tab-loading">Загрузка…</div>
      </div>
    );
  }

  const hasRecipes = !!existingPlan && countPlanRecipes(existingPlan) > 0;
  const dayCount = hasRecipes ? existingPlan.days.length : 0;
  const recipeCount = hasRecipes ? countPlanRecipes(existingPlan) : 0;

  return (
    <div className="planner-hub">
      <div className="planner-hub__grid">
        <HubCard
          state={hasRecipes ? 'done' : 'active'}
          icon="🍽️"
          title="Рецепты"
          value={hasRecipes ? `${dayCount} дн. · ${recipeCount} рец.` : 'Смотри рецепты и добавляй в меню'}
          onClick={() => setScreen('planner_menu')}
        >
          {hasRecipes && <DayStrip days={existingPlan.days} />}
        </HubCard>

        <HubCard
          state={hasRecipes ? 'active' : 'locked'}
          icon="📋"
          title="Меню"
          value={hasRecipes ? 'Открой и отредактируй' : 'Сначала рецепты'}
          onClick={() => {
            setPlannerInitialView('plan');
            setScreen('planner_menu');
          }}
          disabled={!hasRecipes}
        />

        <HubCard
          state={hasRecipes ? 'active' : 'locked'}
          icon="🛒"
          title="Покупки"
          value={hasRecipes ? 'Список готов' : 'Сначала меню'}
          onClick={() => setScreen('planner_summary')}
          disabled={!hasRecipes}
        />

        <HubCard
          state="locked"
          icon="📦"
          title="Раскладка"
          value="После покупок"
          disabled
        />
      </div>
    </div>
  );
}

// ─── Hub card (ticket-stub tile) ───────────────────────────────────────────────

function StubGlyph({ state }) {
  if (state === 'done') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M4.5 10.3l3.6 3.6L15.5 6.3" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 'locked') {
    return (
      <svg width="17" height="18" viewBox="0 0 17 18" fill="none" aria-hidden>
        <rect x="2.5" y="8" width="12" height="8.5" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5.2 8V5.6a3.3 3.3 0 0 1 6.6 0V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6.5 4l6.5 6-6.5 6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HubCard({ state, icon, title, value, onClick, disabled, children }) {
  return (
    <button
      type="button"
      className={`hub-card hub-card--${state}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="hub-card__main">
        <span className="hub-card__badge">{icon}</span>
        <span className="hub-card__body">
          <span className="hub-card__title">{title}</span>
          <span className="hub-card__value">{value}</span>
          {children}
        </span>
      </span>
      <span className="hub-card__stub">
        <span className="hub-card__stub-icon"><StubGlyph state={state} /></span>
      </span>
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function conceptProgressSummary(sessions, studentId, topicId, topicRecord) {
  if (!topicRecord) return { total: 0, mastered: 0 };
  if (topicRecord.meta?.renderer === "chat_practice") {
    const completed = sessions.filter(
      (s) => s.studentId === studentId && s.topicId === topicId
    ).length;
    return { total: topicRecord.turns?.length ?? 0, mastered: completed };
  }
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

function useAppUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [reg, setReg] = useState(null);

  useEffect(() => {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then((r) => {
      setReg(r);
      if (r.waiting) setHasUpdate(true);
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            setHasUpdate(true);
          }
        });
      });
      r.update().catch(() => {});
    });
    const onController = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onController);
  }, []);

  const applyUpdate = useCallback(async () => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    try {
      await reg?.update();
    } catch {
      // A manual refresh still gives the browser a chance to load the newest app shell.
    }
    window.location.reload();
  }, [reg]);

  return { hasUpdate, applyUpdate };
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const account = useAppStore((s) => s.account);
  const students = useAppStore((s) => s.students);
  const topicRecords = useAppStore((s) => s.topicRecords);
  const setTopicRecords = useAppStore((s) => s.setTopicRecords);
  const sessions = useAppStore((s) => s.sessions);
  const buildInfo = useAppStore((s) => s.buildInfo);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const activeTopicId = useAppStore((s) => s.activeTopicId);
  const activeTextId = useAppStore((s) => s.activeTextId);
  const activeTextStored = useAppStore((s) => s.activeText);
  const activeModeId = useAppStore((s) => s.activeModeId);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  const [activeTab, setActiveTab] = useState('session');
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const didAutoUpdateRef = useRef(null); // stores app version at which update last ran

  useEffect(() => {
    if (!topicRecords.length) return;
    if (didAutoUpdateRef.current === buildInfo.version) return;
    didAutoUpdateRef.current = buildInfo.version;
    silentUpdateOutdatedTopics({ topicRecords, appVersion: buildInfo.version })
      .then(({ nextRecords, updated }) => {
        if (updated.length > 0) setTopicRecords(nextRecords);
      })
      .catch(() => {});
  }, [topicRecords.length > 0, buildInfo.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const streakTapCountRef = useRef(0);
  const streakTapTimerRef = useRef(null);
  const handleBrandTap = useCallback(() => {
    streakTapCountRef.current += 1;
    clearTimeout(streakTapTimerRef.current);
    if (streakTapCountRef.current >= 5) {
      streakTapCountRef.current = 0;
      if (activeStudentId) {
        setActiveTopicId("streak_tracker");
        setActiveModeId("streak");
        setScreen("session");
      }
      return;
    }
    streakTapTimerRef.current = setTimeout(() => { streakTapCountRef.current = 0; }, 2000);
  }, [activeStudentId, setActiveTopicId, setActiveModeId, setScreen]);

  const student = students.find((s) => s.id === activeStudentId) ?? students[0];
  const topic = topicRecords.find((r) => r.meta.id === activeTopicId) ?? topicRecords[0];
  const isReading      = topic?.meta?.renderer === "reading";
  const isChatPractice = topic?.meta?.renderer === "chat_practice";
  const activeText = isReading
    ? (topic?.texts?.find((text) => text.id === activeTextId) ?? (activeTextStored?.id === activeTextId ? activeTextStored : null))
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

  const { hasUpdate, applyUpdate } = useAppUpdate();
  const hasPlannerAccess = Array.isArray(account?.featureFlags) && account.featureFlags.includes("planner");
  const progress = conceptProgressSummary(sessions, student?.id, topic?.meta.id, topic);
  const canStart = !!student && !!topic && (
    isChatPractice ? true :
    !isReading     ? !!mode :
    !activeText    ? false :
    activeText.kind === "instruction" ? true :
    !!mode
  );

  const s2 = stepState(!!topic, !!student);
  const s3 = isChatPractice
    ? "completed"
    : stepState(isReading ? !!activeText : !!mode, !!student && !!topic);

  const topicLabel = topic
    ? `${getTopicTitle(topic.meta.title)} · ${progress.mastered}/${progress.total}`
    : "Не выбрана";
  const modeTitle = mode ? (getTopicTitle(mode.ui?.title) || mode.id) : "";

  const readingStepValue = activeText
    ? `${getTopicTitle(activeText.title)}${mode ? ` · ${modeTitle}` : ""}`
    : "Не выбран";

  function startOrContinue() {
    if (isChatPractice) { setScreen(topic?.modes?.length > 0 ? "modes" : "chat_params"); return; }
    if (!isReading) { setScreen("params"); return; }
    if (!activeText) { setScreen("texts"); return; }
    setScreen("params");
  }

  async function refreshAppAndTopics() {
    if (refreshingAll) return;
    setRefreshingAll(true);
    setRefreshFailed(false);
    try {
      if (topicRecords.length > 0) {
        const result = await refreshInstalledCatalogTopics({
          topicRecords,
          appVersion: buildInfo.version,
          force: true,
        });
        if (result.updated.length > 0) setTopicRecords(result.nextRecords);
        if (result.failed.length > 0) setRefreshFailed(true);
      }
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshingAll(false);
      applyUpdate();
    }
  }

  const versionTitle = refreshingAll
    ? "Обновляем приложение и темы…"
    : refreshFailed
      ? "Часть тем не обновилась. Нажмите, чтобы повторить"
      : "Обновить приложение и активные темы";

  return (
    <div className="screen home-screen-v2">
      <HomeHeader onSettings={() => setScreen("settings")} onBrandTap={handleBrandTap} />

      <StudentPickerBar student={student} onTap={() => setScreen("students")} />

      <HomeTabs active={activeTab} onChange={setActiveTab} showPlanner={hasPlannerAccess} />

      <div className="home-tab-content">
        {activeTab === 'planner' && hasPlannerAccess ? (
          <PlannerTab student={student} setScreen={setScreen} />
        ) : (
          <SessionTab
            student={student}
            topic={topic}
            activeText={activeText}
            mode={mode}
            isReading={isReading}
            isChatPractice={isChatPractice}
            s2={s2}
            s3={s3}
            topicLabel={topicLabel}
            readingStepValue={readingStepValue}
            modeTitle={modeTitle}
            canStart={canStart}
            startOrContinue={startOrContinue}
            setScreen={setScreen}
          />
        )}
      </div>

      <button
        type="button"
        className={`home-version${hasUpdate || refreshingAll || refreshFailed ? " home-version--update" : ""}${refreshingAll ? " home-version--refreshing" : ""}${refreshFailed ? " home-version--error" : ""}`}
        onClick={refreshAppAndTopics}
        title={versionTitle}
        disabled={refreshingAll}
      >
        v{buildInfo.version}
        {(hasUpdate || refreshingAll || refreshFailed) && <span className="home-version__dot" />}
      </button>
    </div>
  );
}
