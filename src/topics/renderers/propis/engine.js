export function generateTasks(mode, cards, sessionSize, sessionParams) {
  const allCards = Array.isArray(cards) ? cards : (cards?.cards ?? []);
  const withStrokes = allCards.filter((c) => Array.isArray(c.strokes) && c.strokes.length > 0);
  const letters = withStrokes.filter((c) => c.type === "letter");
  const connectors = withStrokes.filter((c) => c.type === "connector");
  // Punctuation is captured ink too, but it's not a letter: it never takes a connector and
  // never chains into a word the way buildWordTrajectory chains letters (see wordEngine.js's
  // buildWordSegments) -- kept as its own card type specifically so it's excluded from
  // `letters`/lettersByLabel and can't accidentally be swept into that machinery.
  const punctuation = withStrokes.filter((c) => c.type === "punctuation");

  if (mode.type === "practice") {
    return [{ type: "practice", items: letters }];
  }

  if (mode.type === "show") {
    return [{ type: "show", items: letters }];
  }

  if (mode.type === "write_words") {
    return [{ type: "write_words", letters, connectors }];
  }

  if (mode.type === "write_text") {
    return [{ type: "write_text", letters, connectors, punctuation, initialText: sessionParams?.customText ?? "" }];
  }

  if (mode.type === "read_text") {
    // One task holding every selected text, not one task per text -- ReadTextView
    // switches between them with its own internal Prev/Next (same self-contained-state
    // pattern PropisPracticeView already uses for letter/case switching), rather than
    // relying on the session engine's own task-advance machinery, which no other propis
    // mode exercises today.
    return [{ type: "read_text", letters, connectors, punctuation, texts: sessionParams?.texts ?? [] }];
  }

  if (mode.type === "read_lines") {
    // Own task/view (PrintPageView.jsx), not a read_text reuse anymore (2026-09-13 rework):
    // the fixed-page/real-print-geometry rendering (PRINT_ROWS_PER_PAGE, red margin line,
    // A5-proportioned page, PDF export) diverges too much from read_text's flowing/scrolling
    // layout to share a view, even though both still build on the same
    // layoutTextIntoRows/AnimatedStrokes primitives. `lines` is passed through raw (not
    // pre-joined) so PrintPageView can paginate it itself (paginateRows, wordEngine.js).
    // Blank lines are dropped -- the constructor lets a parent leave half-filled draft rows
    // without them showing up on the child's screen.
    const lines = (sessionParams?.lines ?? []).map((l) => l.trim()).filter(Boolean);
    return [{ type: "print_page", letters, connectors, punctuation, lines }];
  }

  return [];
}
