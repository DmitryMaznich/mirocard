export function generateTasks(mode, topicRecord, sessionParams) {
  const cards = Array.isArray(topicRecord) ? topicRecord : (topicRecord?.cards ?? []);
  const letters = cards
    .filter((c) => c.type === "letter")
    .map((c) => ({ letter: c.id, category: c.category ?? "consonant" }));

  if (mode.type === "magnetic_sentence" || mode.type === "magnetic_sentence_audio") {
    const selectedTexts = Array.isArray(sessionParams?.sentences) ? sessionParams.sentences : [];
    const topicSentences = Array.isArray(topicRecord?.sentences) ? topicRecord.sentences : [];
    const audioMap = Object.fromEntries(topicSentences.map((s) => [s.text, s.audio ?? null]));
    const sentences = selectedTexts.map((text) => ({ text, audio: audioMap[text] ?? null }));
    return [{ type: mode.type, letters, sentences }];
  }

  return [{ type: mode.type ?? "magnetic_free", letters }];
}
