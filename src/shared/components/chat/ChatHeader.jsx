import { useTopicFile } from "@/shared/hooks/useTopicFile";

export default function ChatHeader({ contact, topicId, onBack }) {
  const avatarUrl = useTopicFile(topicId, contact?.avatar);

  return (
    <div className="chat-header">
      {onBack && (
        <button className="chat-header__back" onClick={onBack} aria-label="Назад">
          ←
        </button>
      )}
      <div className="chat-header__avatar">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>👤</span>}
      </div>
      <div className="chat-header__info">
        <span className="chat-header__name">{contact?.name ?? ""}</span>
        <span className="chat-header__status">в сети</span>
      </div>
    </div>
  );
}
