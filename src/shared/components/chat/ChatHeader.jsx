import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

export default function ChatHeader({ contact, topicId, onBack }) {
  const avatarUrl = useTopicFile(topicId, contact?.avatar);
  const photoSrc  = contact?.photo ?? avatarUrl ?? null;

  return (
    <div className="chat-header">
      {onBack && (
        <button className="chat-header__back" onClick={onBack} aria-label="Назад">
          <BackArrowIcon size={20} />
        </button>
      )}
      <div className="chat-header__avatar">
        {photoSrc
          ? <img src={photoSrc} alt="" />
          : contact?.emoji
            ? <span>{contact.emoji}</span>
            : <span>👤</span>}
      </div>
      <div className="chat-header__info">
        <span className="chat-header__name">{contact?.name ?? ""}</span>
        <span className="chat-header__status">в сети</span>
      </div>
    </div>
  );
}
