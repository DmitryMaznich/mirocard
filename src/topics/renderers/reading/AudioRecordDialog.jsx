import { useState, useRef, useEffect } from "react";
import Modal from "@/shared/components/Modal";
import { getAudioOverride, saveAudioOverride, deleteAudioOverride } from "@/core/audioStore";

export default function AudioRecordDialog({ topicId, textId, stepNum, stepText, onClose, onSaved, onDeleted }) {
  // state: "loading" | "idle" | "recording" | "done" | "existing"
  const [state, setState] = useState("loading");
  const [recBlob, setRecBlob]       = useState(null);
  const [existingBlob, setExisting] = useState(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [saving, setSaving]         = useState(false);
  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);

  useEffect(() => {
    getAudioOverride(topicId, textId, stepNum).then((blob) => {
      if (blob) { setExisting(blob); setState("existing"); }
      else setState("idle");
    });
    return () => {
      clearInterval(timerRef.current);
      mediaRecRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startRecording() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("getUserMedia failed:", err);
      alert("Нет доступа к микрофону");
      return;
    }
    chunksRef.current = [];
    let mr;
    try {
      mr = new MediaRecorder(stream, { audioBitsPerSecond: 16000 });
    } catch {
      try {
        mr = new MediaRecorder(stream);
      } catch (err2) {
        console.error("MediaRecorder init failed:", err2);
        stream.getTracks().forEach((t) => t.stop());
        alert("Запись аудио не поддерживается в этом браузере");
        return;
      }
    }
    mr.stream = stream;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      setRecBlob(blob);
      setState("done");
      clearInterval(timerRef.current);
    };
    mr.start(100);
    mediaRecRef.current = mr;
    setRecSeconds(0);
    setState("recording");
    timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecRef.current?.stop();
  }

  function playBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = () => URL.revokeObjectURL(url);
    a.play();
  }

  async function handleSave() {
    setSaving(true);
    await saveAudioOverride(topicId, textId, stepNum, recBlob);
    setSaving(false);
    onSaved?.(`s${stepNum}`);
  }

  async function handleDelete() {
    await deleteAudioOverride(topicId, textId, stepNum);
    onDeleted?.(`s${stepNum}`);
  }

  const mm = String(Math.floor(recSeconds / 60)).padStart(2, "0");
  const ss = String(recSeconds % 60).padStart(2, "0");

  return (
    <Modal title={`Шаг ${stepNum}`} onClose={onClose}>
      <div className="audio-dialog">
        <div className="audio-dialog-step-text">{stepText}</div>

        {state === "loading" && (
          <p className="audio-dialog-hint">Загрузка…</p>
        )}

        {state === "idle" && (
          <button className="audio-dialog-btn audio-dialog-btn--record" onClick={startRecording}>
            🎙 Начать запись
          </button>
        )}

        {state === "recording" && (
          <div className="audio-dialog-recording">
            <span className="audio-dialog-timer">{mm}:{ss}</span>
            <button className="audio-dialog-btn audio-dialog-btn--stop" onClick={stopRecording}>
              ⏹ Стоп
            </button>
          </div>
        )}

        {state === "done" && (
          <div className="audio-dialog-row">
            <button className="audio-dialog-btn" onClick={() => playBlob(recBlob)}>▶ Прослушать</button>
            <button className="audio-dialog-btn" onClick={() => { setRecBlob(null); setState("idle"); }}>× Перезаписать</button>
            <button className="audio-dialog-btn audio-dialog-btn--save" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение…" : "✓ Сохранить"}
            </button>
          </div>
        )}

        {state === "existing" && (
          <div className="audio-dialog-row">
            <button className="audio-dialog-btn" onClick={() => playBlob(existingBlob)}>▶ Текущая</button>
            <button className="audio-dialog-btn audio-dialog-btn--record" onClick={startRecording}>🎙 Перезаписать</button>
            <button className="audio-dialog-btn audio-dialog-btn--delete" onClick={handleDelete}>🗑 Удалить</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
