export function normalizeLessonFlow(raw) {
  return {
    advance: raw?.advance === "auto" ? "auto" : "tap",
    delaySeconds: Math.max(1, Math.min(10, Math.round(Number(raw?.delaySeconds) || 3))),
  };
}

export function legacyLessonFlow(settings = {}) {
  return normalizeLessonFlow({
    advance: settings.adultConfirmAdvance || settings.tapToAdvance !== false ? "tap" : "auto",
    delaySeconds: settings.autoAdvanceDelay,
  });
}
