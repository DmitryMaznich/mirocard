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
import { hasEnoughAboutMeFacts } from "@/topics/renderers/my_people/engine";

function LastResultBadge({ session }) {
  if (!session) return <span className="mode-badge mode-badge--none">Не проходили</span>;
  if (session.percentCorrect === null) {
    return <span className="mode-badge mode-badge--browse">Без оценки · {formatDate(session.completedAt)}</span>;
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
  return getTopicTitle(mode?.ui?.title) || mode?.id || "";
}

function getModeInstruction(mode) {
  return getTopicTitle(mode?.ui?.instruction);
}

export default function ModePickerScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const activeTopicId   = useAppStore((s) => s.activeTopicId);
  const activeTextId    = useAppStore((s) => s.activeTextId);
  const activeTextStored = useAppStore((s) => s.activeText);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const students        = useAppStore((s) => s.students);
  const setEditingStudentId = useAppStore((s) => s.setEditingStudentId);
  const topicRecords    = useAppStore((s) => s.topicRecords);
  const sessions        = useAppStore((s) => s.sessions);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);
  const [methodology,     setMethodology]     = useState(null);
  const [topicAbout,      setTopicAbout]       = useState(false);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);
  const isReading = topicRecord?.meta.renderer === "reading";
  const activeText = isReading
    ? (topicRecord?.texts?.find((text) => text.id === activeTextId) ?? (activeTextStored?.id === activeTextId ? activeTextStored : null))
    : null;
  const rawModes = isReading
    ? filterReadingModes(topicRecord?.modes, activeText)
    : topicRecord?.modes ?? [];
  const activeStudent = students.find((student) => student.id === activeStudentId) ?? null;
  const isMyPeople = topicRecord?.meta.renderer === "my_people";
  const people = (activeStudent?.myPeople ?? []).filter((person) => !person.deletedAt && person.enabled !== false && person.name?.trim() && person.photos?.some(Boolean));
  const profile = activeStudent?.myPeopleProfile ?? {};

  function myPeopleModeAvailable(mode) {
    if (!isMyPeople) return true;
    if (mode.id === "about_me") return hasEnoughAboutMeFacts(activeStudent);
    const context = mode.id.split("_")[0];
    const group = ["family", "home", "school"].includes(context) ? context : null;
    const needsRelation = mode.id.endsWith("_relations");
    const groupPeople = (group ? people.filter((person) => person.contexts?.includes(group)) : people)
      .filter((person) => !needsRelation || person.relation?.trim());
    if (group && profile.enabledBlocks?.[group] === false) return false;
    if (mode.id === "mix" && profile.enabledBlocks?.mix === false) return false;
    return groupPeople.length >= 2;
  }

  const modes = isMyPeople
    ? rawModes.filter((mode) => {
      const block = mode.id.split("_")[0];
      return !["family", "home", "school", "mix"].includes(block) || profile.enabledBlocks?.[block] !== false;
    }).sort((left, right) => {
      const order = profile.blockOrder ?? ["family", "home", "school", "mix"];
      const leftBlock = left.id.split("_")[0];
      const rightBlock = right.id.split("_")[0];
      const leftIndex = order.indexOf(leftBlock);
      const rightIndex = order.indexOf(rightBlock);
      // Personal answers remain a small independent block above the staged
      // people groups; Mix is always pinned by the profile editor as last.
      const normalisedLeft = leftIndex < 0 ? -1 : leftIndex;
      const normalisedRight = rightIndex < 0 ? -1 : rightIndex;
      return normalisedLeft - normalisedRight;
    })
    : rawModes;

  const hasSingleMode = !!topicRecord && modes.length === 1;

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
          <h1 className="screen-title">Режим</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">Тема не выбрана</div>
          <Button onClick={() => setScreen("topics")}>Выбрать тему</Button>
        </div>
      </div>
    );
  }

  if (isReading && !activeText) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("texts")}><BackArrowIcon /></button>
          <h1 className="screen-title">Режим чтения</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">Сначала выберите текст</div>
          <Button onClick={() => setScreen("texts")}>Выбрать текст</Button>
        </div>
      </div>
    );
  }

  function navigateToMode(mode) {
    setActiveModeId(mode.id);
    setScreen(topicRecord?.meta?.renderer === "chat_practice" ? "chat_params" : "params");
  }

  function pickMode(mode) {
    navigateToMode(mode);
  }

  function openMyPeopleSetup() {
    if (activeStudentId) setEditingStudentId(activeStudentId);
    setScreen("my_people_settings");
  }

  if (hasSingleMode) return null;

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen(isReading && activeText?.kind !== "sentence_pool" ? "texts" : "home")}><BackArrowIcon /></button>
        <h1 className="screen-title">{isReading ? getTextTitle(activeText) : getTopicTitle(topicRecord.meta.title)}</h1>
        <button
          className="header-info-btn"
          onClick={() => setTopicAbout(true)}
          title="О теме"
        >
          i
        </button>
      </div>

      <ul className="mode-list">
        {modes.map((mode) => {
          const lastSession = getLastModeSession(sessions, activeStudentId, activeTopicId, mode.id, isReading ? activeTextId : null);
          return (
            <li key={mode.id} className={`mode-item-row${isMyPeople && !myPeopleModeAvailable(mode) ? " mode-item-row--disabled" : ""}`}>
              <div
                className="mode-item mode-item--flex"
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
                    <div className="mode-item__goal">Цель: {getModeGoal(mode)}</div>
                  )}
                  {isMyPeople && !myPeopleModeAvailable(mode)
                    ? <button type="button" className="link-btn" onClick={(event) => { event.stopPropagation(); openMyPeopleSetup(); }}>Настроить раздел</button>
                    : <LastResultBadge session={lastSession} />
                  }
                </div>
                <button
                  className="mode-info-btn"
                  onClick={(e) => { e.stopPropagation(); setMethodology(mode); }}
                  title="О режиме"
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
          title={getTopicTitle(topicRecord.meta.title)}
          about={topicRecord.meta.about}
          modes={modes}
          onClose={() => setTopicAbout(false)}
        />
      )}

    </div>
  );
}
