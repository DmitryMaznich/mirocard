import TopicLanguageBar from "@/features/topics/TopicLanguageBar.jsx";
import { topicLanguageForStudent, requestTopicLanguage } from "@/features/topics/topicLanguageChoice.js";
import { setupText } from "@/shared/i18n/setupText.js";
import { getInterfaceTopicTitle } from "@/shared/i18n/topicTitles.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import Modal from "@/shared/components/Modal";
import InfoModal from "@/shared/components/InfoModal";
import ModeMethodology from "@/shared/components/ModeMethodology";
import { getModeGoal } from "@/shared/utils/methodology";
import ModeIcon from "@/shared/components/ModeIcon";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import { formatDate, getTopicTitle } from "@/shared/utils/format";
import { isPickableMode } from "@/shared/utils/topicUtils";
import { activeMyPeople, isMyPeopleProfileEmpty, myPeopleModeReadiness, openMyPeopleSettings } from "@/features/myPeople/myPeopleReadiness";

function LastResultBadge({ session }) {
  const { t } = useUiTranslation();
  if (!session) return <span className="mode-badge mode-badge--none">{t("mode.notTried")}</span>;
  if (session.percentCorrect === null) {
    return <span className="mode-badge mode-badge--browse">{t("mode.ungraded", { date: formatDate(session.completedAt) })}</span>;
  }
  const ok = session.percentCorrect >= 70;
  return (
    <span className={`mode-badge ${ok ? "mode-badge--ok" : "mode-badge--warn"}`}>
      {session.percentCorrect}% · {formatDate(session.completedAt)}
    </span>
  );
}

function getLastModeSession(sessions, studentId, topicId, modeId, textId = null) {
  return sessions
    .filter((s) => s.studentId === studentId && s.topicId === topicId && s.modeId === modeId)
    .filter((s) => !textId || s.textId === textId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] ?? null;
}

function getTextTitle(text) {
  return getTopicTitle(text?.title) || text?.id || "";
}

function filterReadingModes(modes = [], text) {
  if (!text) return [];
  if (text.kind === "instruction") {
    return modes.filter((mode) => mode.id === "follow_instruction");
  }
  if (text.kind === "safe_code") {
    return modes.filter((mode) => mode.id === "safe_code");
  }
  if (text.kind === "sentence_pool") {
    return modes.filter((mode) => mode.type === "daily_sentences");
  }
  return modes.filter((mode) => !(mode.id === "assemble_text" && text.kind !== "poem" && text.kind !== "story") && mode.id !== "follow_instruction" && mode.id !== "safe_code");
}

function getModeTitle(mode) {
  return setupText(mode?.ui?.title) || mode?.id || "";
}

function getModeInstruction(mode) {
  return getTopicTitle(mode?.ui?.instruction);
}

export default function ModePickerScreen() {
  const { t } = useUiTranslation();
  const setScreen       = useAppStore((s) => s.setScreen);
  const activeTopicId   = useAppStore((s) => s.activeTopicId);
  const activeTextId    = useAppStore((s) => s.activeTextId);
  const activeTextStored = useAppStore((s) => s.activeText);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const students        = useAppStore((s) => s.students);
  const topicRecords    = useAppStore((s) => s.topicRecords);
  const sessions        = useAppStore((s) => s.sessions);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);
  const [methodology,     setMethodology]     = useState(null);
  const [topicAbout,      setTopicAbout]       = useState(false);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const isReading = topicRecord?.meta.renderer === "reading";
  const isShortStories = activeTopicId === "reading_short_stories";
  const activeText = isReading
    ? (topicRecord?.texts?.find((text) => text.id === activeTextId) ?? (activeTextStored?.id === activeTextId ? activeTextStored : null))
    : null;
  const rawModes = isReading
    ? filterReadingModes(topicRecord?.modes, activeText)
    : topicRecord?.modes ?? [];
  const activeStudent = students.find((student) => student.id === activeStudentId) ?? null;
  const isMyPeople = topicRecord?.meta.renderer === "my_people";
  const people = activeMyPeople(activeStudent);
  const readinessByMode = isMyPeople
    ? Object.fromEntries(rawModes.map((mode) => [mode.id, myPeopleModeReadiness(mode, activeStudent)]))
    : {};

  function myPeopleModeAvailable(mode) {
    return !isMyPeople || readinessByMode[mode.id]?.ready !== false;
  }

  // The topic lists its modes in teaching order already; retired ones (the
  // old album modes) stay out of the list.
  useAppStore((s) => s.studentTopicLinks);
  const topicLanguage = topicRecord?.languageContract ? topicLanguageForStudent(topicRecord) : null;
  const modes = rawModes.filter(isPickableMode).filter((mode) => !topicLanguage || topicRecord.languageContract.packages[topicLanguage]?.modeIds.includes(mode.id));

  // Short stories deliberately keep their picker instead of auto-opening
  // settings: the parent chooses between reading together and comprehension
  // practice just like modes in every other topic.
  const hasSingleMode = !!topicRecord && modes.length === 1 && !isShortStories;

  useEffect(() => {
    if (hasSingleMode) {
      setActiveModeId(modes[0].id);
      setScreen("params");
    }
  }, [hasSingleMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!topicRecord) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
          <h1 className="screen-title">{t("home.mode")}</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">{t("mode.noTopic")}</div>
          <Button onClick={() => setScreen("topics")}>{t("mode.chooseTopic")}</Button>
        </div>
      </div>
    );
  }

  if (isReading && !activeText) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("texts")}><BackArrowIcon /></button>
          <h1 className="screen-title">{t("mode.reading")}</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">{t("mode.firstText")}</div>
          <Button onClick={() => setScreen("texts")}>{t("mode.chooseText")}</Button>
        </div>
      </div>
    );
  }

  function navigateToMode(mode) {
    setActiveModeId(mode.id);
    setScreen(topicRecord?.meta?.renderer === "chat_practice" ? "chat_params" : "params");
  }

  function pickMode(mode) {
    if (topicRecord.languageContract && !topicRecord.languageResources?.content?.[topicLanguage]) { requestTopicLanguage({ record: topicRecord }); return; }
    navigateToMode(mode);
  }

  function openMyPeopleSetup(tab = null) {
    openMyPeopleSettings({ studentId: activeStudentId, returnScreen: "modes", tab });
  }

  if (hasSingleMode) return null;

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen(isShortStories ? "home" : isReading && activeText?.kind !== "sentence_pool" ? "texts" : "home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{isShortStories ? getInterfaceTopicTitle(topicRecord.meta.id, topicRecord.meta.title) : isReading ? getTextTitle(activeText) : getInterfaceTopicTitle(topicRecord.meta.id, topicRecord.meta.title)}</h1>
        <button
          className="header-info-btn"
          onClick={() => setTopicAbout(true)}
          title={t("topics.about")}
        >
          i
        </button>
      </div>

      <TopicLanguageBar topic={topicRecord} />
      <ul className="mode-list">
        {isMyPeople && activeStudent && isMyPeopleProfileEmpty(activeStudent) && (
          // Every photo mode is closed until there are two people with
          // photos: say so once, up front, instead of a list of grey rows.
          <li className="mode-item-row">
            <div className="my-people-empty" role="status">
              <span className="my-people-empty__icon" aria-hidden="true">👥</span>
              <div className="my-people-empty__body">
                <strong>{t("mode.peopleEmpty", { name: activeStudent.name })}</strong>
                <span>
                  {t("mode.addPeople", { count: people.length })}
                </span>
                <button type="button" className="my-people-empty__action" onClick={() => openMyPeopleSetup("family")}>{t("mode.setup")}</button>
              </div>
            </div>
          </li>
        )}
        {isMyPeople && activeStudent && !isMyPeopleProfileEmpty(activeStudent) && (
          // The people themselves are edited on the student card; without
          // this row the only way there from a working topic was
          // Меню → Ученики → ✎ → «Настроить тему».
          <li className="mode-item-row">
            <button type="button" className="mode-item mode-item--flex my-people-setup-row" onClick={() => openMyPeopleSetup()}>
              <span className="my-people-setup-row__icon" aria-hidden="true">👥</span>
              <span className="mode-item__body">
                <span className="mode-item__title">{t("mode.people")}</span>
                <span className="mode-item__desc">
                  {t("mode.peopleCount", { count: people.length })}
                </span>
              </span>
              <span className="my-people-setup-row__arrow" aria-hidden="true">›</span>
            </button>
          </li>
        )}
        {isMyPeople && !activeStudent && (
          <li className="mode-item-row">
            <div className="my-people-empty" role="status">
              <span className="my-people-empty__icon" aria-hidden="true">👥</span>
              <div className="my-people-empty__body">
                <strong>{t("home.chooseStudent")}</strong>
                <span>{t("mode.peopleHelp")}</span>
              </div>
            </div>
          </li>
        )}
        {modes.map((mode) => {
          const lastSession = getLastModeSession(sessions, activeStudentId, activeTopicId, mode.id, isReading ? activeTextId : null);
          return (
            <li key={mode.id} className={`mode-item-row${isMyPeople && !myPeopleModeAvailable(mode) ? " mode-item-row--disabled" : ""}`}>
              <div
                // «Контрольная работа» stands out on a light tint — by `finite`
                // (place_value) or by its title (comparison, the other math topics).
                className={`mode-item mode-item--flex${mode.finite || /Контрольная работа/.test(getTopicTitle(mode?.ui?.title)) ? " mode-item--test" : ""}`}
                role="button"
                tabIndex={myPeopleModeAvailable(mode) ? 0 : -1}
                onClick={() => myPeopleModeAvailable(mode) && pickMode(mode)}
                onKeyDown={(e) => e.key === "Enter" && myPeopleModeAvailable(mode) && pickMode(mode)}
              >
                {mode.ui?.icon && (
                  <ModeIcon topicId={activeTopicId} iconPath={mode.ui.icon} size="medium" />
                )}
                <div className="mode-item__body">
                  <div className="mode-item__title">{getModeTitle(mode)}</div>
                  <div className="mode-item__desc">{getModeInstruction(mode)}</div>
                  {getModeGoal(mode) && (
                    <div className="mode-item__goal">{t("info.goal", { goal: getModeGoal(mode) })}</div>
                  )}
                  {isMyPeople && !myPeopleModeAvailable(mode)
                    ? (
                      <div className="my-people-mode-gap">
                        <span>{readinessByMode[mode.id].reason}</span>
                        {/* With the empty-profile card above, a link on every row is noise. */}
                        {readinessByMode[mode.id].tab && activeStudent && !isMyPeopleProfileEmpty(activeStudent) && (
                          <button type="button" className="link-btn" onClick={(event) => { event.stopPropagation(); openMyPeopleSetup(readinessByMode[mode.id].tab); }}>{t("mode.fill")}</button>
                        )}
                      </div>
                    )
                    : <LastResultBadge session={lastSession} />
                  }
                </div>
                <button
                  className="mode-info-btn"
                  onClick={(e) => { e.stopPropagation(); setMethodology(mode); }}
                  title={t("mode.about")}
                >
                  ?
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {methodology && (
        <Modal title={getModeTitle(methodology)} onClose={() => setMethodology(null)}>
          <ModeMethodology mode={methodology} />
        </Modal>
      )}

      {topicAbout && (
        <InfoModal
          title={getInterfaceTopicTitle(topicRecord.meta.id, topicRecord.meta.title)}
          about={topicRecord.meta.about}
          modes={modes}
          onClose={() => setTopicAbout(false)}
        />
      )}

    </div>
  );
}
