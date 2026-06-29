import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { getInitials, getTopicTitle } from "@/shared/utils/format";
import Button from "@/shared/components/Button";

export default function ShareWithStudentPanel({ topicId, modeId, textId, modeTitle, planData, onClose }) {
  const students = useAppStore((s) => s.students);
  const [urlMap,  setUrlMap]  = useState({});   // { studentId: url }
  const [loading, setLoading] = useState(null); // studentId currently loading

  async function handleGenerate(student) {
    setLoading(student.id);
    try {
      const { portals } = await api.get(`/students/${student.id}/portals`);
      await Promise.all(portals.map((p) => api.delete(`/students/${student.id}/portal/${p.id}`)));
      const data = await api.post(`/students/${student.id}/portal`, {
        topicId,
        modeId:   modeId   ?? undefined,
        textId:   textId   ?? undefined,
        planData: planData ?? undefined,
      });
      setUrlMap((prev) => ({ ...prev, [student.id]: data.url }));
    } catch { /* fail silently */ }
    setLoading(null);
  }

  function shareOrCopy(url) {
    if (navigator.share) {
      navigator.share({ title: "Ссылка для ученика", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  const activeStudents = students.filter((s) => !s.deletedAt);

  return (
    <div className="ssp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ssp-sheet">
        <div className="ssp-header">
          <div className="ssp-title">Отправить ученику</div>
          {modeTitle && <div className="ssp-subtitle">{modeTitle}</div>}
          <button className="ssp-close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className="ssp-body">
          {activeStudents.length === 0 ? (
            <div className="ssp-empty">Нет учеников. Добавьте их на вкладке «Студенты».</div>
          ) : (
            activeStudents.map((student) => {
              const url = urlMap[student.id];
              const isLoading = loading === student.id;
              return (
                <div key={student.id} className="ssp-student">
                  <div className="ssp-student-row">
                    <div className="ssp-avatar">{getInitials(student.name)}</div>
                    <span className="ssp-name">{student.name}</span>
                    {!url && (
                      <button
                        className="ssp-btn-generate"
                        onClick={() => handleGenerate(student)}
                        disabled={isLoading || loading !== null}
                      >
                        {isLoading ? "…" : "Создать ссылку"}
                      </button>
                    )}
                  </div>
                  {url && (
                    <div className="ssp-url-row">
                      <span className="ssp-url">{url}</span>
                      <button
                        className="ssp-btn-share"
                        onClick={() => shareOrCopy(url)}
                      >
                        {navigator.share ? "Поделиться" : "Скопировать"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
