import { shuffle } from "@/shared/utils/shuffle";

export function generateTasks(mode, topicRecord, sessionParams) {
  const cards = topicRecord.cards ?? [];

  if (mode.type === "sentence_puzzle") {
    return [{
      type:       "sentence_puzzle",
      subjects:   cards.filter((c) => c.type === "subject"),
      verbs:      cards.filter((c) => c.type === "verb"),
      adjectives: cards.filter((c) => c.type === "adjective"),
      objects:    cards.filter((c) => c.type === "object"),
    }];
  }

  if (mode.type === "listen_build") {
    const structure   = sessionParams?.structure ?? "simple";
    const distractors = Math.max(0, Number(sessionParams?.distractors ?? 2));
    const isSimple    = structure === "simple";
    const slotTypes   = isSimple
      ? ["subject", "verb"]
      : ["subject", "verb", "adjective", "object"];

    const sentences = (topicRecord.sentences ?? []).filter((s) =>
      isSimple ? (!s.adjective && !s.object) : (s.adjective && s.object)
    );

    const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));

    return shuffle([...sentences]).map((sentence) => {
      const target = Object.fromEntries(
        slotTypes.map((t) => [t, cardById[sentence[t]]])
      );

      const pool = [];
      for (const slotType of slotTypes) {
        const correct = target[slotType];
        const others  = cards.filter((c) => c.type === slotType && c.id !== correct.id);
        const picks   = shuffle([...others]).slice(0, distractors);
        pool.push(correct, ...picks);
      }

      return {
        type:      "listen_build",
        structure,
        target,
        pool:      shuffle(pool),
        audioPath: sentence.audio ?? null,
      };
    });
  }

  return [];
}
