import { useState } from "react";
import Button from "@/shared/components/Button";
import RewardVideoModal from "@/shared/components/RewardVideoModal";

export default function ChatSummary({ score, onRepeat, onHome, rewardVideos = [], studentId, videoAvailable = false }) {
  const [showReward, setShowReward] = useState(false);
  const percent = score.total > 0
    ? Math.round((score.correct / score.total) * 100)
    : 100;

  const praise =
    percent === 100 ? "Отлично! Всё правильно!" :
    percent >= 80   ? "Молодец! Почти всё верно!" :
    percent >= 60   ? "Хорошо, но ещё потренируемся!" :
                      "Продолжай стараться!";

  return (
    <div className="screen screen-center" style={{ flexDirection: "column", gap: 24, padding: 24 }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>{praise}</div>
      {score.total > 0 && (
        <div style={{ fontSize: 16, color: "#666" }}>
          Правильных ответов: {score.correct} из {score.total}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
        <Button fullWidth onClick={onRepeat}>Ещё раз</Button>
        {videoAvailable && (
          <Button fullWidth variant="secondary" onClick={() => setShowReward(true)}>🎬 Награда</Button>
        )}
        <Button fullWidth variant="secondary" onClick={onHome}>На главную</Button>
      </div>
      {showReward && (
        <RewardVideoModal
          rewardVideos={rewardVideos}
          studentId={studentId}
          onDismiss={() => setShowReward(false)}
        />
      )}
    </div>
  );
}
