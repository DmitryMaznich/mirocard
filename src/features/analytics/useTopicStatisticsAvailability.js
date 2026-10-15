import { useEffect, useState } from "react";
import { api } from "@/core/api";

export function useTopicStatisticsAvailability({ studentId, topicId, enabled, sessions, token, accountId }) {
  // Match the statistics report's inclusion rules, without limiting its period.
  const local = enabled && sessions.some(session => session?.id && session.studentId === studentId
    && session.topicId === topicId && Number.isFinite(Date.parse(session.completedAt)));
  const key = JSON.stringify([accountId, token, studentId, topicId]);
  const [remote, setRemote] = useState(null);
  useEffect(() => {
    if (!enabled || local || !token || !studentId || !topicId) return;
    let cancelled = false;
    const query = new URLSearchParams({ studentId, topicId });
    api.get(`/statistics?${query}`).then(report => {
      if (!cancelled) setRemote({ key, available: report.totals.sessions > 0 });
    }).catch(() => { if (!cancelled) setRemote({ key, available: false }); });
    return () => { cancelled = true; };
  }, [enabled, local, token, studentId, topicId, key]);
  const available = Boolean(enabled && (local || (remote?.key === key && remote.available)));
  const checking = Boolean(enabled && !local && token && remote?.key !== key);
  return { available, checking };
}
