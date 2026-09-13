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
    // Reuses the read_text task/view as-is -- layoutTextIntoRows already treats "\n" as a
    // hard row break (see wordEngine.js), so joining the constructor's own lines with "\n"
    // and handing that single string to ReadTextView as its one-and-only "text" produces
    // exactly the same tetrad-page/tap-to-animate rendering, just authored line-by-line in
    // the params screen instead of picking a whole pre-written text. Blank lines are dropped
    // rather than kept as visible blank ruled rows -- the constructor lets a parent leave
    // half-filled draft rows without them showing up on the child's screen.
    const lines = (sessionParams?.lines ?? []).map((l) => l.trim()).filter(Boolean);
    return [{ type: "read_text", letters, connectors, punctuation, texts: lines.length ? [lines.join("\n")] : [] }];
  }

  return [];
}
