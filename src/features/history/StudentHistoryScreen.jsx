import { useAppStore } from "@/core/store";
import StatisticsScreen from "@/features/analytics/StatisticsScreen";

export default function StudentHistoryScreen() {
  const setScreen = useAppStore(state => state.setScreen);
  return <StatisticsScreen onClose={() => setScreen("students")} />;
}
