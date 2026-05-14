import Modal from "./Modal";
import { getModeGoal, getModeSummary } from "@/shared/utils/methodology";
import { getTopicTitle } from "@/shared/utils/format";

function getText(value) {
  return getTopicTitle(value);
}

function toTextList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(getText).filter(Boolean);
  const text = getText(value);
  return text ? [text] : [];
}

export default function InfoModal({ title, about, modes, onClose }) {
  const legacyLines = toTextList(Array.isArray(about) ? about : (about?.ru ?? about?.en));
  const description = getText(about?.description ?? about?.text) || legacyLines[0] || "";
  const goals = toTextList(about?.goals);
  const finalGoal = getText(about?.finalGoal ?? about?.goal);
  const explicitWorkSteps = toTextList(about?.flow ?? about?.tips);
  const workSteps = explicitWorkSteps.length > 0 ? explicitWorkSteps : legacyLines.slice(1);
  const duration = getText(about?.duration);
  const modesWithSummary = (modes ?? []).filter((mode) => getModeSummary(mode) || getModeGoal(mode));
  const isEmpty = !description && goals.length === 0 && !finalGoal && workSteps.length === 0 && modesWithSummary.length === 0;

  return (
    <Modal title={title} onClose={onClose}>
      {description && (
        <section className="info-modal-section">
          <div className="info-modal-section-heading">Описание темы</div>
          <p className="info-modal-text">{description}</p>
        </section>
      )}

      {goals.length > 0 && (
        <section className="info-modal-section">
          <div className="info-modal-section-heading">Цели темы</div>
          <ul className="info-modal-tips">
            {goals.map((goal, index) => <li key={index}>{goal}</li>)}
          </ul>
        </section>
      )}

      {finalGoal && (
        <section className="info-modal-section info-modal-section--goal">
          <div className="info-modal-section-heading">Что должно получиться</div>
          <p className="info-modal-text">{finalGoal}</p>
        </section>
      )}

      {workSteps.length > 0 && (
        <section className="info-modal-section">
          <div className="info-modal-section-heading">Как изучать</div>
          <ul className="info-modal-tips">
            {workSteps.map((step, index) => <li key={index}>{step}</li>)}
          </ul>
        </section>
      )}

      {duration && (
        <div className="info-modal-duration">Время: {duration}</div>
      )}

      {isEmpty && (
        <p className="info-modal-text info-modal-text--empty">Описание не добавлено</p>
      )}

      {modesWithSummary.length > 0 && (
        <div className="info-modal-modes">
          <div className="info-modal-modes-heading">Режимы</div>
          {modesWithSummary.map((mode) => (
            <div key={mode.id} className="info-modal-mode-item">
              <div className="info-modal-mode-title">{getTopicTitle(mode.ui?.title) || mode.id}</div>
              <div className="info-modal-mode-summary">
                {getModeSummary(mode)}
              </div>
              {getModeGoal(mode) && (
                <div className="info-modal-mode-goal">Цель: {getModeGoal(mode)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
