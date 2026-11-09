import PeopleLearningSummary from '@/features/myPeople/PeopleLearningSummary';
import { useState, useEffect } from "react";
import { aboutMeQuestionLabel, mainWord } from "@/topics/renderers/my_people/engine";
import { useAppStore } from "@/core/store";
import { formatDate, getTopicTitle } from "@/shared/utils/format";
import { computeProgressAfterSession } from "./useConceptProgress";
import ConceptDot from "@/shared/components/ConceptDot";
import Button from "@/shared/components/Button";
import { useTimer } from "@/features/timer/TimerContext";
import PlaceValueCheckResult from "./PlaceValueCheckResult.jsx";
import PrintLettersWorks from "./PrintLettersWorks.jsx";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import { effectiveRewardSettings } from "../../../shared/reward-policy.mjs";
import { letterWorks } from "./printLettersWorks.js";
import { endVideoAvailable } from "./endVideo.js";

const ASSESSMENT_LABELS = {
  independent: "Сам",
  after_model: "После образца",
  after_text: "После текста",
  none: "Нет ответа",
  prompted: "С подсказкой",
  read: "Прочитал",
  expressive: "Выразительно",
  fail: "Не ответил",
  correct: "Правильно",
  easy: "Легко",
};

function getPraiseText(isReading) {
  return isReading ? "Молодец, ты прочитал!" : "Молодец, ты справился!";
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ru-RU";
  utter.rate = 0.85;
  utter.pitch = 1.1;
  window.speechSynthesis.speak(utter);
}

export default function SessionSummary() {
  const [id] = useState(() => useAppStore.getState().sessions.at(-1)?.id);
  const session = useAppStore(s => s.sessions.find(item => item.id === id));
  return session?.statistics?.myPeople?.schemaVersion === 2 ? <PeopleLearningSummary session={session} /> : <LegacySessionSummary />;
}

function LegacySessionSummary() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const sessions          = useAppStore((s) => s.sessions);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const students          = useAppStore((s) => s.students);
  const setActiveTopicId  = useAppStore((s) => s.setActiveTopicId);
  const setActiveTextId   = useAppStore((s) => s.setActiveTextId);
  const setActiveModeId   = useAppStore((s) => s.setActiveModeId);
  const { markSessionStart } = useTimer();

  // The summary is for the session that just ended: pinned by id on opening. The sessions list is
  // replaced on every sync with the server (every 20 s); taking «the last one» again each time made
  // the summary switch records and its spoken praise start over (2026-11-04).
  const [sessionId] = useState(() => sessions[sessions.length - 1]?.id ?? null);
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[sessions.length - 1];

  const topicRecord = topicRecords.find((r) => r.meta.id === session?.topicId);
  const sessionText = topicRecord?.texts?.find((text) => text.id === session?.textId);
  const sessionMode = topicRecord?.modes?.find((mode) => mode.id === session?.modeId);
  const isReading   = topicRecord?.meta.renderer === "reading";
  const isMyPeople  = topicRecord?.meta.renderer === "my_people";
  const isEvaluated = session?.percentCorrect !== null && session?.percentCorrect !== undefined;
  const praiseText  = getPraiseText(isReading);

  // A place-value check opens its result for the adult straight away.
  const isPlaceValueCheck = sessionMode?.type === "pv_test";
  const [detailsOpen, setDetailsOpen] = useState(isPlaceValueCheck);

  // A mode run with "Озвучка" off stays silent here too.
  const voiceOff = session?.paramsSnapshot?.voice === false;
  // «Пишу на экране»: the end of the lesson is «Мои буквы» alone — no «Молодец, ты справился» and no
  // spoken praise (owner, 2026-11-04: «он, получается, нам не нужен»)
  const lettersOnly = letterWorks(session).length > 0;
  const hasSession = Boolean(session);

  // «Видео в конце занятия» (ParamsScreen): the session was gone through to the end (not stopped with
  // ✕), the setting was on, video rewards are on and the student has videos → «Смотреть видео».
  const student = students.find((st) => st.id === session?.studentId) ?? null;
  const showEndVideo = endVideoAvailable(session, student);
  const [endVideo, setEndVideo] = useState("offered"); // offered → open → watched

  useEffect(() => {
    if (!hasSession || voiceOff || lettersOnly) return;
    const timer = setTimeout(() => speak(praiseText), 600);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, [praiseText, hasSession, voiceOff, lettersOnly]); // once per opened summary, not on every sync

  if (!session) {
    return (
      <div className="screen">
        <div className="screen-center">Нет данных о сессии</div>
      </div>
    );
  }

  const progressAfter = computeProgressAfterSession(sessions, session);
  const sessionStudent = students.find((student) => student.id === session.studentId) ?? null;

  function myPeopleLabel(conceptId) {
    if (String(conceptId).startsWith("about_q:")) return aboutMeQuestionLabel(conceptId, sessionStudent);
    if (String(conceptId).startsWith("about_me:")) return "Представься";
    if (String(conceptId).startsWith("introduce:")) {
      const turns = { name: "имя", age: "возраст", family_name: "фамилия", city: "город", all: "рассказ о себе" };
      const turn = turns[String(conceptId).slice("introduce:".length)];
      return turn ? `Представься: ${turn}` : "Представься";
    }
    if (String(conceptId).startsWith("point:")) {
      const person = (sessionStudent?.myPeople ?? []).find((item) => item.id === String(conceptId).slice("point:".length));
      return person ? `Покажи: ${person.name?.trim() || mainWord(person)}` : "Покажи";
    }
    if (String(conceptId).startsWith("match:")) {
      const person = (sessionStudent?.myPeople ?? []).find((item) => item.id === String(conceptId).slice("match:".length));
      return person ? `Найди лицо: ${person.name?.trim() || mainWord(person)}` : "Найди лицо";
    }
    if (String(conceptId).startsWith("person_naming:")) {
      const [, personId] = String(conceptId).split(":");
      const person = (sessionStudent?.myPeople ?? []).find((item) => item.id === personId);
      return person ? `Кто это? — ${mainWord(person)}` : "Кто это?";
    }
    if (String(conceptId).startsWith("album:")) {
      return String(conceptId).includes(":relation:") ? "Кто эти люди для меня" : "Имена знакомых людей";
    }
    const personal = {
      family_name: "Моя фамилия",
      family_label: "Наша семья",
      city: "Где я живу",
      address: "Мой адрес",
    };
    if (personal[conceptId]) return personal[conceptId];
    if (conceptId === "self:name") return sessionStudent?.name ?? "Моё имя";
    const [personId, axis] = String(conceptId).split(":");
    const person = (sessionStudent?.myPeople ?? []).find((item) => item.id === personId);
    if (!person) return "Карточка человека";
    return axis === "relation" ? person.relation || person.name : person.name;
  }

  function handleRepeat() {
    setActiveTopicId(session.topicId);
    if (session.textId) setActiveTextId(session.textId);
    setActiveModeId(session.modeId);
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="screen summary-screen">

      {/* Celebration block */}
      {!lettersOnly && <div className="summary-celebration">
        <div className="summary-topic-label">
          {getTopicTitle(topicRecord?.meta.title) || session.topicId}
          {sessionText ? ` · ${getTopicTitle(sessionText.title)}` : ""}
          {session.topicId === "word_formation_soup" && session.paramsSnapshot?.materialSet === "transfer" ? " · Новые сочетания: перенос" : ""}
          {session.topicId === "word_formation_soup" && session.modeId === "season_form_pick"
            ? session.paramsSnapshot?.activityStage === "check" || session.paramsSnapshot?.materialSet === "transfer"
              ? " · Проверка согласования" : " · Обучение согласованию"
            : ""}
        </div>

        <div className="summary-check">✓</div>

        <div className="summary-praise">{praiseText}</div>
      </div>}

      {/* «Печатные буквы» → «Пишу на экране»: the letters the child wrote, with «Сохранить в PDF» */}
      {letterWorks(session).length > 0 && (
        <PrintLettersWorks session={session} studentName={students.find((st) => st.id === session.studentId)?.name ?? ""} />
      )}

      {showEndVideo && endVideo !== "watched" && (
        <div className="summary-end-video">
          <button type="button" className="reward-modal__btn reward-modal__btn--watch" onClick={() => setEndVideo("open")}>
            🎬 Смотреть видео
          </button>
        </div>
      )}
      {endVideo === "open" && student && (
        <RewardVideoModal
          rewardVideos={student.rewardVideos ?? []}
          studentId={student.id}
          settingsOverride={effectiveRewardSettings(student.rewardSettings)}
          onDismiss={() => setEndVideo("watched")}
          title="Всё занятие пройдено!"
          continueLabel="Закрыть"
        />
      )}

      {/* Actions */}
      <div className="summary-actions">
        <Button variant="secondary" onClick={handleRepeat}>Ещё раз</Button>
        <button
          className="summary-finish-btn"
          onClick={() => setScreen("home")}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="summary-finish-btn__label">Завершить</span>
        </button>
      </div>

      {/* Collapsible teacher stats */}
      <div className="summary-details">
        <button
          className="summary-details__toggle"
          onClick={() => setDetailsOpen((v) => !v)}
        >
          {detailsOpen ? "▲" : "▼"} Результаты
        </button>

        {detailsOpen && (
          <div className="summary-details__body">
            <div className="summary-date">{formatDate(session.completedAt)}</div>

            {isPlaceValueCheck && <PlaceValueCheckResult session={session} modes={topicRecord?.modes} />}

            {isPlaceValueCheck ? null : isEvaluated ? (
              <div className="summary-score-compact">
                {session.percentCorrect}% · ✓ {session.correctCount} · ✗ {session.incorrectCount}
              </div>
            ) : (
              <div className="summary-score-compact">
                {isReading
                  ? getTopicTitle(sessionMode?.ui?.title) || session.modeId
                  : `${session.conceptIds?.length ?? 0} карточек`}
              </div>
            )}

            {session.mistakes?.length > 0 && (
              <div className="summary-section">
                <div className="summary-section-title">Ошибки</div>
                <ul className="summary-mistakes">
                  {session.mistakes.map((m, i) => {
                    const card = topicRecord?.cards.find((c) => c.id === m.cardId);
                    return (
                      <li key={i} className="summary-mistake-item">
                        <ConceptDot level={progressAfter[m.conceptId] ?? 0} />
                        {isMyPeople ? myPeopleLabel(m.conceptId) : (card?.label ?? m.conceptId)}
                        {m.count > 1 ? ` × ${m.count}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {session.assessments?.length > 0 && (
              <div className="summary-section">
                <div className="summary-section-title">Оценки</div>
                <ul className="summary-progress-list">
                  {session.assessments.map((assessment, i) => (
                    <li key={i} className="summary-progress-item">
                      <ConceptDot level={assessment.quality === "none" || assessment.quality === "fail" ? 1 : 2} />
                      {ASSESSMENT_LABELS[assessment.quality] ?? assessment.quality}
                      {assessment.count > 1 ? ` × ${assessment.count}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isReading && session.conceptIds?.length > 0 && (
              <div className="summary-section">
                <div className="summary-section-title">Прогресс</div>
                <ul className="summary-progress-list">
                  {session.conceptIds.map((cid) => {
                    const card = topicRecord?.cards.find((c) => c.conceptId === cid && c.primary);
                    return (
                      <li key={cid} className="summary-progress-item">
                        <ConceptDot level={progressAfter[cid] ?? 0} />
                        {isMyPeople ? myPeopleLabel(cid) : (card?.label ?? cid)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
