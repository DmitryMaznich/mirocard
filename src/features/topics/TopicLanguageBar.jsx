import { useAppStore } from "@/core/store";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { nativeLanguageName } from "../../../shared/topic-delivery.mjs";
import { topicLanguageForStudent, requestTopicLanguage } from "./topicLanguageChoice.js";

export default function TopicLanguageBar({ topic }) {
  useAppStore((s) => s.studentTopicLinks);
  useAppStore((s) => s.activeStudentId);
  const { t } = useUiTranslation();
  if (!topic?.languageContract) return null;
  const language = topicLanguageForStudent(topic);
  const ready = Boolean(topic.languageResources?.content?.[language]);
  return <div className="topic-language-bar">
    <span>{language ? t("topicLanguage.material", { language: nativeLanguageName(language) }) : t("topicLanguage.notChosen")}{language && !ready ? ` · ${t("topicLanguage.notInstalled")}` : ""}</span>
    <button className="link-btn" onClick={() => requestTopicLanguage({ record: topic })}>{t("topicLanguage.change")}</button>
  </div>;
}
