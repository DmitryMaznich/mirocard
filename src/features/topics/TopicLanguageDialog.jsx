import { useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb } from "@/core/db";
import { persistStudentTopicLink } from "@/core/linkUtils";
import { atomicUpsertOwnedTopic } from "@/core/bootstrap";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { getInterfaceTopicTitle } from "@/shared/i18n/topicTitles.js";
import Modal from "@/shared/components/Modal";
import Button from "@/shared/components/Button";
import { fetchCatalogTopic, claimDeck } from "./catalogService";
import { topicLanguageForStudent } from "./topicLanguageChoice.js";
import { nativeLanguageName, topicDownloadDescriptor, remainingDownloadBytes } from "../../../shared/topic-delivery.mjs";

function formatBytes(bytes, language) {
  if (!bytes) return "0 KB";
  const units = bytes < 1024 * 1024 ? [1024, "KB"] : [1024 * 1024, "MB"];
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(Math.max(bytes / units[0], 0.1))} ${units[1]}`;
}

function LanguagePicker({ request }) {
  const { t, language: uiLanguage } = useUiTranslation();
  const state = useAppStore();
  const record = state.topicRecords.find((r) => r.meta.id === request.topicId) ?? request.record;
  const entry = request.entry ?? { id: record.meta.id, version: record.meta.version, title: record.meta.title, access: record.installation?.access ?? "free", languageDownload: topicDownloadDescriptor(record) };
  const delivery = entry.languageDownload;
  const options = delivery?.languages ?? record?.languageContract?.packages ?? {};
  const student = state.students.find((s) => s.id === request.studentId);
  const [selected, setSelected] = useState(() => {
    const preferred = record ? topicLanguageForStudent(record) : student?.preferredLessonLanguage ?? state.settings.cardLanguage;
    return Object.hasOwn(options, preferred) ? preferred : Object.keys(options)[0];
  });
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(false);
  const remaining = remainingDownloadBytes(record, delivery, selected);
  const bytes = remaining != null && request.coreBuffer ? Math.max(0, remaining - delivery.core.bytes) : remaining;
  const title = getInterfaceTopicTitle(entry.id, entry.title ?? record?.meta.title);

  function close(result = null) {
    useAppStore.getState().setTopicLanguageRequest(null);
    request.resolve(result);
  }
  function ensureCurrent() {
    const current = useAppStore.getState();
    if ((current.account?.id ?? null) !== request.accountId || current.activeStudentId !== request.studentId || current.topicLanguageRequest?.id !== request.id) throw new Error("Topic language context changed");
  }
  async function install() {
    if (submitting.current || !selected) return;
    submitting.current = true;
    setBusy(true); setError(false);
    try {
      ensureCurrent();
      const owned = state.ownedTopics.find((o) => o.topicId === entry.id && o.source !== "request");
      if ((entry.access ?? "free") !== "free" && !owned) {
        const claim = await claimDeck(entry.id);
        if (claim.status !== "granted") throw new Error("Topic access not granted");
      }
      const installed = delivery ? await fetchCatalogTopic(entry, state.buildInfo.version, { contentLanguage: selected, coreBuffer: request.coreBuffer, onProgress: setProgress, ensureCurrent }) : record;
      ensureCurrent();
      if (!installed?.languageResources?.content?.[selected]) throw new Error("Language is not installed");
      useAppStore.getState().upsertTopicRecord(installed);
      if (!owned) {
        const source = entry.origin === "imported" ? "imported" : (entry.access ?? "free") === "free" ? "free" : "paid";
        const ownership = { topicId: entry.id, source };
        await atomicUpsertOwnedTopic(await getDb(), ownership);
        useAppStore.getState().upsertOwnedTopic(ownership);
      }
      if (request.studentId) {
        const currentLink = useAppStore.getState().studentTopicLinks[`${request.studentId}_${entry.id}`] ?? {};
        await persistStudentTopicLink(request.studentId, entry.id, { params: { ...currentLink.params, topicContentLanguage: selected } });
      }
      close(installed);
    } catch { submitting.current = false; setError(true); setBusy(false); }
  }
  return (
    <Modal title={t("topicLanguage.title", { title })} onClose={busy ? undefined : () => close()} closeOnOverlay={!busy} showCloseButton={!busy}
      actions={<><Button variant="secondary" disabled={busy} onClick={() => close()}>{t("common.cancel")}</Button><Button disabled={busy || !selected || bytes == null} onClick={install}>{busy ? t("topics.downloading") : bytes ? t("topicLanguage.download", { size: formatBytes(bytes, uiLanguage) }) : t("topicLanguage.use")}</Button></>}>
      <p>{t("topicLanguage.choose")}</p>
      <div className="topic-language-options" role="radiogroup" aria-label={t("topicLanguage.choose")}>
        {Object.entries(options).map(([code, pack]) => {
          const ready = record?.languageResources?.content?.[code] && (!delivery || record.installation?.packages?.[code]?.sha256 === pack.sha256);
          return <label key={code} className={`topic-language-option${selected === code ? " is-selected" : ""}`}>
            <input type="radio" name={`topic-language-${request.id}`} value={code} checked={selected === code} disabled={busy} onChange={() => setSelected(code)} />
            <span><strong lang={code}>{nativeLanguageName(code)}</strong><span className="topic-language-detail">{t("topicLanguage.modeCount", { count: pack.modeIds.length })} · {t(pack.audio === "recorded" ? pack.audioScope === "feedback" ? "topicLanguage.feedbackSpeech" : "topicLanguage.speech" : "topicLanguage.noSpeech")} · {ready ? t("topicLanguage.installed") : formatBytes(pack.bytes ?? 0, uiLanguage)}</span></span>
          </label>;
        })}
      </div>
      <p className="param-hint">{t("topicLanguage.hint")}</p>
      {busy && <p role="status">{progress == null ? t("topics.downloading") : `${Math.round(progress * 100)}%`}</p>}
      {error && <p className="form-error" role="alert">{t("topicLanguage.failed")}</p>}
    </Modal>
  );
}

export default function TopicLanguageDialog() {
  const request = useAppStore((s) => s.topicLanguageRequest);
  return request ? <LanguagePicker key={request.id} request={request} /> : null;
}
