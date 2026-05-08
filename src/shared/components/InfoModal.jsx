import Modal from "./Modal";

export default function InfoModal({ title, about, onClose }) {
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
      {!about?.text && !about?.tips?.length && (
        <p className="info-modal-text info-modal-text--empty">Описание не добавлено</p>
      )}
    </Modal>
  );
}
