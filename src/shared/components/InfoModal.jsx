import Modal from "./Modal";
import { getTopicTitle } from "@/shared/utils/format";

export default function InfoModal({ title, about, modes, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      {about?.text && <p className="info-modal-text">{about.text}</p>}
      {about?.tips?.length > 0 && (
        <ul className="info-modal-tips">
          {about.tips.map((tip, i) => <li key={i}>{tip}</li>)}
        </ul>
      )}
      {about?.duration && (
        <div className="info-modal-duration">⏱ {about.duration}</div>
      )}
      {!about?.text && !about?.tips?.length && !modes?.length && (
        <p className="info-modal-text info-modal-text--empty">Описание не добавлено</p>
      )}
      {modes?.filter((m) => m.methodology).length > 0 && (
        <div className="info-modal-modes">
          <div className="info-modal-modes-heading">Режимы</div>
          {modes.filter((m) => m.methodology).map((mode) => (
            <div key={mode.id} className="info-modal-mode-item">
              <div className="info-modal-mode-title">{getTopicTitle(mode.ui?.title) || mode.id}</div>
              <div className="info-modal-mode-summary">
                {getTopicTitle(mode.methodology.summary) || getTopicTitle(mode.methodology.text)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
