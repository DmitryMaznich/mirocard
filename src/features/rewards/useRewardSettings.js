import { useAppStore } from "@/core/store";
import { effectiveRewardSettings } from "../../../shared/reward-policy.mjs";

export function useRewardSettings(studentId) {
  const student = useAppStore(state => state.students.find(item => item.id === (studentId ?? state.activeStudentId)));
  return effectiveRewardSettings(student?.rewardSettings);
}
