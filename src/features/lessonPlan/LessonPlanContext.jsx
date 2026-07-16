import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { getActiveSessionPlan, setSessionItemDone } from "./lessonPlanApi";

const LessonPlanContext = createContext(null);

export function LessonPlanProvider({ children }) {
  const [activeSessionPlan, setActiveSessionPlan] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const activeStudentId = useAppStore((s) => s.activeStudentId);

  const refresh = useCallback(async (studentId) => {
    const sid = studentId ?? activeStudentId;
    if (!sid) { setActiveSessionPlan(null); return; }
    const plan = await getActiveSessionPlan(sid);
    setActiveSessionPlan(plan);
  }, [activeStudentId]);

  useEffect(() => {
    if (!activeStudentId) { setActiveSessionPlan(null); setIsOpen(false); return; }
    refresh(activeStudentId);
  }, [activeStudentId, refresh]);

  const markItemDone = useCallback(async (itemId, done = true, note = null) => {
    if (!activeStudentId) return;
    const updated = await setSessionItemDone(activeStudentId, itemId, done, note);
    if (updated) setActiveSessionPlan(updated);
  }, [activeStudentId]);

  const value = { activeSessionPlan, isOpen, setIsOpen, refresh, markItemDone };
  return <LessonPlanContext.Provider value={value}>{children}</LessonPlanContext.Provider>;
}

export function useLessonPlan() {
  return useContext(LessonPlanContext);
}
