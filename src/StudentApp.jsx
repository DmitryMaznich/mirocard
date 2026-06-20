import { useAppStore } from "@/core/store";
import { useStudentPortal } from "@/features/student/useStudentPortal";
import StudentHomeScreen from "@/features/student/StudentHomeScreen";
import ModePickerScreen from "@/features/home/ModePickerScreen";
import ParamsScreen from "@/features/session/ParamsScreen";
import ConceptPickerScreen from "@/features/session/ConceptPickerScreen";
import SessionScreen from "@/features/session/SessionScreen";
import SessionSummary from "@/features/session/SessionSummary";

const SESSION_SCREENS = {
  modes: ModePickerScreen,
  params: ParamsScreen,
  concepts: ConceptPickerScreen,
  session: SessionScreen,
  summary: SessionSummary,
};

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    }}>
      <div style={{ color: "white", fontSize: 18, opacity: 0.8 }}>Загрузка…</div>
    </div>
  );
}

function ErrorScreen({ reason }) {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "#f7f8fc",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>
        Ссылка недействительна
      </div>
      <div style={{ fontSize: 15, color: "#6b7280", maxWidth: 280 }}>
        {reason === "revoked"
          ? "Доступ отозван. Попросите логопеда прислать новую ссылку."
          : "Не удалось подключиться. Проверьте интернет и попробуйте снова."}
      </div>
      {reason === "network" && (
        <button
          style={{
            marginTop: 24, padding: "12px 24px", borderRadius: 12, border: "none",
            background: "#667eea", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
          onClick={() => window.location.reload()}
        >
          Повторить
        </button>
      )}
    </div>
  );
}

export default function StudentApp({ token }) {
  const { status, data, error } = useStudentPortal(token);
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);

  if (status === "loading") return <LoadingScreen />;
  if (status === "error") return <ErrorScreen reason={error} />;

  // When a session is active, render the corresponding session screen
  const SessionScreenComp = SESSION_SCREENS[screen];
  if (SessionScreenComp) return <SessionScreenComp />;

  const { student, activeTask } = data;

  function handleStartSession({ topicId, modeId }) {
    useAppStore.setState({
      activeStudentId: student.id,
      activeTopicId: topicId,
      activeModeId: modeId ?? undefined,
    });
    setScreen(modeId ? "params" : "modes");
  }

  return (
    <StudentHomeScreen
      student={student}
      activeTask={activeTask}
      onStartSession={handleStartSession}
    />
  );
}
