export default function TypingIndicator({ contactAvatar }) {
  return (
    <div className="chat-typing-row">
      <div className="chat-bubble-row__avatar">
        {contactAvatar
          ? <img src={contactAvatar} alt="" />
          : <span style={{ fontSize: 14 }}>👤</span>
        }
      </div>
      <div className="chat-typing-bubble">
        <div className="chat-typing-dot" />
        <div className="chat-typing-dot" />
        <div className="chat-typing-dot" />
      </div>
    </div>
  );
}
