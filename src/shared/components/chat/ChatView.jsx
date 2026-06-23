import { useEffect, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import ChatHeader from "./ChatHeader";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChoicePanel from "./ChoicePanel";

export default function ChatView({
  contact,
  topicId,
  messages,
  isTyping,
  currentChoices,
  disabledChoices,
  showHint,
  onSendChoice,
  onBack,
}) {
  const avatarUrl = useTopicFile(topicId, contact?.avatar);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  return (
    <div className="chat-screen">
      <ChatHeader contact={contact} topicId={topicId} onBack={onBack} />

      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} contactAvatar={avatarUrl} />
        ))}
        {isTyping && <TypingIndicator contactAvatar={avatarUrl} />}
        <div ref={bottomRef} />
      </div>

      <ChoicePanel
        choices={currentChoices}
        disabledChoices={disabledChoices}
        showHint={showHint}
        onChoice={onSendChoice}
      />
    </div>
  );
}
