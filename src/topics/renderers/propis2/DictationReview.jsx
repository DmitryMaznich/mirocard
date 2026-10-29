import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/core/store";
import { getDb, kv } from "@/core/db";
import { api } from "@/core/api";
import PinGateModal from "@/shared/components/PinGateModal";
import RewardVideoModal from "@/shared/components/RewardVideoModal";
import GradeKeys from "./GradeKeys.jsx";
import { gradeText, gradeWriteMs } from "./gradeMark.js";

// The end of the dictation in `propis2` (2026-10-29; until then the shared `propis/DictationReviewScreen.jsx`): what was dictated, as it
// should stand in the notebook (`Answers`, index.jsx), and the adult's mark. The sheet is cut after its last written row and fitted
// to the screen: no scrolling on any screen. Layout and scaling: the dictation screen's (`p2d-stage`, one unit --u, dictation.css).
// The mark: pick a digit and, if wanted, + or − (in any order, changeable), then «Оценить» -- only then the red pen writes it on the
// sheet. «Изменить» takes it back. Then «Дальше — бонус» (adult PIN, reward video) or «Готово». The mark is not stored anywhere.
export default function DictationReview({ task, onClose, Answers }) {
  const items = task?.items ?? [];
  const level = task?.level ?? "letters";
  const video = Boolean(task?.videoRewardEnabled);

  const students = useAppStore((s) => s.students);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const adultPinHash = useAppStore((s) => s.settings.adultPinHash);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const activeStudent = students.find((s) => s.id === activeStudentId) ?? null;

  const [stage, setStage] = useState("idle"); // "idle" | "pin" | "reward"
  const [draft, setDraft] = useState({ n: null, sign: "" });
  const [grade, setGrade] = useState(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (!grade) return undefined;
    const t = window.setTimeout(() => setWriting(false), gradeWriteMs(grade) + 300);
    return () => window.clearTimeout(t);
  }, [grade]);

  function commit() {
    if (draft.n == null) return;
    setWriting(true);
    setGrade({ ...draft });
  }
  const finish = () => (video ? setStage("pin") : onClose());

  const handleSetPin = useCallback(async (hash) => {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, "settings", { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch("/account/settings", { adultPinHash: hash }).catch(() => {});
  }, [patchSettings]);

  return (
    <div className="p2d-stage p2r">
      <button type="button" className="p2d-close" onClick={onClose} aria-label="Закрыть">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <div className="p2r-frame">
        <header className="p2r-head">
          <h1 className="p2r-title">Диктант окончен</h1>
          <p className="p2r-hint">Сверьте с тетрадью: всё, что прозвучало, по порядку.</p>
        </header>

        <div className="p2r-sheet">
          {Answers && <Answers items={items} level={level} grade={grade} />}
        </div>

        <div className="p2r-panel">
          {grade == null ? (
            <>
              <div className="p2r-label">Оценка</div>
              <GradeKeys value={draft} onChange={setDraft} />
              <button type="button" className="p2d-next p2r-rate" disabled={draft.n == null} onClick={commit}>
                {draft.n == null ? "Оценить" : `Оценить: ${gradeText(draft)}`}
              </button>
              <button type="button" className="p2r-link" onClick={finish}>{video ? "Без оценки" : "Закрыть без оценки"}</button>
            </>
          ) : (
            <>
              <div className="p2r-graded">
                <span>Оценка</span>
                <b>{gradeText(grade)}</b>
                <button type="button" className="p2r-link" disabled={writing} onClick={() => setGrade(null)}>Изменить</button>
              </div>
              <button type="button" className="p2d-next" disabled={writing} onClick={finish}>{video ? "Дальше — бонус" : "Готово"}</button>
            </>
          )}
        </div>
      </div>

      {stage === "pin" && (
        <PinGateModal pinHash={adultPinHash} onSuccess={() => setStage("reward")} onSetPin={handleSetPin} onCancel={() => setStage("idle")} />
      )}
      {stage === "reward" && activeStudent && (
        <RewardVideoModal rewardVideos={activeStudent.rewardVideos ?? []} studentId={activeStudent.id} onDismiss={onClose} title="Диктант готов — молодец!" />
      )}
    </div>
  );
}
