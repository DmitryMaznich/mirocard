import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";

export default function ModePickerScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const activeTopicId   = useAppStore((s) => s.activeTopicId);
  const topicRecords    = useAppStore((s) => s.topicRecords);
  const setActiveModeId = useAppStore((s) => s.setActiveModeId);

  const topicRecord = topicRecords.find((r) => r.meta.id === activeTopicId);

  if (!topicRecord) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setScreen("home")}>←</button>
          <h1 className="screen-title">Режим</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__text">Тема не выбрана</div>
          <Button onClick={() => setScreen("topics")}>Выбрать тему</Button>
        </div>
      </div>
    );
  }

  function startMode(mode) {
    setActiveModeId(mode.id);
    setScreen("session");
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}>←</button>
        <h1 className="screen-title">{topicRecord.meta.title}</h1>
      </div>
      <ul className="mode-list">
        {topicRecord.modes.map((mode) => (
          <li key={mode.id}>
            <button className="mode-item" onClick={() => startMode(mode)}>
              <div className="mode-item__title">{mode.ui?.title ?? mode.id}</div>
              <div className="mode-item__desc">{mode.ui?.instruction ?? ""}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
