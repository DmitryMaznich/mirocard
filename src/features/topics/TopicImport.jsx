import { importTopicArchive } from "./topicArchiveImport.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { TopicImportError } from "@/topics/topicLoader";
import Button from "@/shared/components/Button";

export default function TopicImport({ onImported, compact = false }) {
  const { t } = useUiTranslation();
  const fileRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const upsertTopicRecord = useAppStore((s) => s.upsertTopicRecord);
  const buildInfo = useAppStore((s) => s.buildInfo);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("loading");
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const db = await getDb();
      const record = await importTopicArchive(db, buf, buildInfo.version);
      if (record) upsertTopicRecord(record);
      setStatus("idle");
      onImported?.(record);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof TopicImportError
          ? err.message
          : t("topics.importError")
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
      {compact ? (
        <button
          className="topic-import-link"
          onClick={() => fileRef.current?.click()}
          disabled={status === "loading"}
        >
          {status === "loading" ? t("topics.importing") : t("topics.importZipPlus")}
        </button>
      ) : (
        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={status === "loading"}
        >
          {status === "loading" ? t("topics.importing") : t("topics.importZip")}
        </Button>
      )}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
