const STATIC_BACK_TARGETS = {
  register: "login",
  students: "home",
  student_edit: "students",
  topics: "home",
  texts: "home",
  all_texts: "texts",
  params: "modes",
  concepts: "params",
  history: "students",
  account: "home",
  settings: "home",
  summary: "home",
};

export const SESSION_EXIT_TARGET = "session_exit";

export function getBackTarget(state) {
  const screen = state?.screen;

  if (screen === "modes") {
    const topicRecord = state.topicRecords?.find((record) => record.meta.id === state.activeTopicId);
    return topicRecord?.meta?.renderer === "reading" ? "texts" : "home";
  }

  if (screen === "session") return SESSION_EXIT_TARGET;

  return STATIC_BACK_TARGETS[screen] ?? null;
}
