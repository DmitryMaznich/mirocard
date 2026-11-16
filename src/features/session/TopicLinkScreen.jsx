import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";
import "./topicLinkScreen.css";

// A mode that lives in another topic now (`type: "topic_link"`, `link: { topicId, title, text }`):
// the checks of «Столбик», «Плюс и минус», «Сравнение» moved to «Контрольные по математике»
// (owner, 2026-11-16). Whatever opened the mode (the mode list, the home screen, a plan) lands
// here instead of a session: the other topic opens if it is installed, otherwise the catalog opens
// on it, with its «установить» button.
export default function TopicLinkScreen({ mode, onBack }) {
  const topicRecords = useAppStore((s) => s.topicRecords);
  const setActiveTopicId = useAppStore((s) => s.setActiveTopicId);
  const setScreen = useAppStore((s) => s.setScreen);
  const setTopicLibraryQuery = useAppStore((s) => s.setTopicLibraryQuery);
  const { topicId, title, text } = mode.link ?? {};
  const installed = topicRecords.some((r) => r.meta.id === topicId);

  function go() {
    if (installed) {
      setActiveTopicId(topicId);
      setScreen("home");
      return;
    }
    setTopicLibraryQuery(title ?? "");
    setScreen("topics");
  }

  return (
    <div className="screen topic-link-screen">
      <div className="screen-header">
        <button type="button" className="back-btn" onClick={onBack} aria-label="Назад"><BackArrowIcon /></button>
        <h1 className="screen-title">{mode.ui?.title?.ru ?? mode.ui?.title ?? ""}</h1>
      </div>
      <div className="topic-link-card">
        <div className="topic-link-icon" aria-hidden="true">📝</div>
        <h2>Теперь в теме «{title}»</h2>
        <p>{text}</p>
        {!installed && <p className="topic-link-hint">Тема ещё не установлена — откроется каталог, там её можно установить.</p>}
        <Button onClick={go}>{installed ? `Открыть «${title}»` : "Установить тему"}</Button>
      </div>
    </div>
  );
}
