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

  return [];
}
