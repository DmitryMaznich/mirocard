import { useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { importTopic, TopicImportError } from "@/topics/topicLoader";
import Button from "@/shared/components/Button";

export default function TopicImport({ onImported }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const topicRecords    = useAppStore((s) => s.topicRecords);
  const setTopicRecords = useAppStore((s) => s.setTopicRecords);
  const buildInfo = useAppStore((s) => s.buildInfo);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("loading");
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const db = await getDb();
      const record = await importTopic(db, buf, buildInfo.version);
      setTopicRecords([
        ...topicRecords.filter((r) => r.meta.id !== record.meta.id),
        record,
      ]);
      setStatus("idle");
      onImported?.(record);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof TopicImportError
          ? err.message
          : "Ошибка импорта. Файл повреждён?"
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="topic-import">
      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <Button
        variant="secondary"
        onClick={() => fileRef.current?.click()}
        disabled={status === "loading"}
      >
        {status === "loading" ? "Импортируем…" : "Импортировать ZIP"}
      </Button>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
