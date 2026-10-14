import { useRef, useState } from "react";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";

export default function SessionExitPrompt({ onContinue, onFinish }) {
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function finish() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onFinish();
    } catch {
      setError("Не удалось сохранить результаты. Попробуйте завершить занятие ещё раз.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Завершить занятие?"
      onClose={saving ? undefined : onContinue}
      closeOnOverlay={false}
      showCloseButton={false}
      actions={
        <>
          <Button variant="secondary" disabled={saving} onClick={onContinue}>Продолжить</Button>
          <Button disabled={saving} onClick={finish}>{saving ? "Сохраняем…" : "Завершить"}</Button>
        </>
      }
    >
      {error ? <span role="alert">{error}</span> : "Вы уверены, что хотите завершить занятие?"}
    </Modal>
  );
}
