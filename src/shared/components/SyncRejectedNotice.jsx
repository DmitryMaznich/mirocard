import { useEffect, useState } from "react";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import { SYNC_REJECTED_EVENT } from "@/core/syncApi";

// The server refuses some synced changes outright -- today only photos it
// cannot accept (not an image, HEIC, too large, over the account's photo
// quota). Those operations are dropped from the sync queue (retrying could
// never succeed and would block every later change), so the user must be
// told once, in plain words, what didn't save and what to do.
export default function SyncRejectedNotice() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    function onRejected(event) {
      const incoming = (event.detail ?? []).map((r) => r?.message).filter(Boolean);
      if (!incoming.length) return;
      setMessages((current) => [...new Set([...current, ...incoming])]);
    }
    window.addEventListener(SYNC_REJECTED_EVENT, onRejected);
    return () => window.removeEventListener(SYNC_REJECTED_EVENT, onRejected);
  }, []);

  if (!messages.length) return null;
  const close = () => setMessages([]);
  return (
    <Modal
      title="Фото не сохранено"
      onClose={close}
      actions={<Button onClick={close}>Понятно</Button>}
    >
      {messages.map((message) => <p key={message} className="sync-rejected-notice__text">{message}</p>)}
    </Modal>
  );
}
