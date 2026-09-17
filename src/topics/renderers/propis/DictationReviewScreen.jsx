import { useCallback, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import RewardVideoModal from "@/shared/components/RewardVideoModal";

// Shown once every item has been dictated. Never shown during the session itself (see
// DictationView.jsx) -- this is the FIRST point the answer appears on screen at all, since
// automatic checking is impossible here (the child writes on paper, the app never sees it).
// The adult compares this list against the notebook by eye, then (if the session has video
// reward enabled) confirms with the SAME account-wide adult PIN used everywhere else in the
// app (ParamsScreen.jsx's own session-start gate) before the reward unlocks -- not a new,
// separate PIN. Reads student/PIN straight from the global store rather than threading them
// down as new props through PropisRenderer -> DictationView -> here: every other propis view
// is already self-contained (docs/propis.md), and ParamsScreen.jsx reads adultPinHash the
// same direct way, so this isn't a new pattern.
export default function DictationReviewScreen({ task, onClose }) {
  const items = task?.items ?? [];
  const level = task?.level ?? "letters";

  const students = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const adultPinHash = useAppStore((s) => s.settings.adultPinHash);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const activeStudent = students.find((s) => s.id === activeStudentId) ?? null;

  const [stage, setStage] = useState("idle"); // "idle" | "pin" | "reward"

  const handleSetPin = useCallback(async (hash) => {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }, [patchSettings]);

  return (
    <div className="propis-dictation-stage">
      <button type="button" className="propis-ctrl-btn propis-dictation-close" onClick={onClose} aria-label="Закрыть">✕</button>

      <div className="propis-dictation-review">
        <div className="propis-dictation-review-header">
          <div className="propis-dictation-review-title">Диктант окончен</div>
          <p className="propis-dictation-review-hint">
            Сверьте с тетрадью — вот всё, что прозвучало, по порядку.
          </p>
        </div>

        <div className={`propis-dictation-review-list propis-dictation-review-list--${level}`}>
          {items.map((it, i) => (
            level === "texts" ? (
              <div key={it.key} className="propis-dictation-review-text">
                <span className="propis-dictation-review-index">{i + 1}</span>
                <p className="propis-dictation-review-text-body">{it.display}</p>
              </div>
            ) : (
              <div key={it.key} className="propis-dictation-review-chip">{it.display}</div>
            )
          ))}
        </div>

        <div className="propis-dictation-review-footer">
          {task?.videoRewardEnabled ? (
            <button type="button" className="propis-dictation-next" onClick={() => setStage("pin")}>
              ✓ Всё верно
            </button>
          ) : (
            <button type="button" className="propis-dictation-next" onClick={onClose}>
              Готово
            </button>
          )}
        </div>
      </div>

      {stage === "pin" && (
        <PinGateModal
          pinHash={adultPinHash}
          onSuccess={() => setStage("reward")}
          onSetPin={handleSetPin}
          onCancel={() => setStage("idle")}
        />
      )}

      {stage === "reward" && activeStudent && (
        <RewardVideoModal
          rewardVideos={activeStudent.rewardVideos ?? []}
          studentId={activeStudent.id}
          onDismiss={onClose}
          title="Диктант готов — молодец!"
        />
      )}
    </div>
  );
}
