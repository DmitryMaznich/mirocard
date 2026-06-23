function formatTime(date) {
  return new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, contactAvatar }) {
  const isOutgoing = message.from === "child";
  return (
    <div className={`chat-bubble-row chat-bubble-row--${isOutgoing ? "outgoing" : "incoming"}`}>
      {!isOutgoing && (
        <div className="chat-bubble-row__avatar">
          {contactAvatar
            ? <img src={contactAvatar} alt="" />
            : <span style={{ fontSize: 14 }}>👤</span>
          }
        </div>
      )}
      <div className={`chat-bubble chat-bubble--${isOutgoing ? "outgoing" : "incoming"}`}>
        {message.text}
        <div className="chat-bubble__time">
          {formatTime(message.timestamp)}{isOutgoing && " ✓✓"}
        </div>
      </div>
    </div>
  );
}
