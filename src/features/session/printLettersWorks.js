// The «Печатные буквы» letters a lesson's record carries (session.works, sessionEngine.withWork).
export function letterWorks(session) {
  return (session?.works ?? []).filter((w) => w?.kind === "print_letter" && Array.isArray(w.strokes));
}
