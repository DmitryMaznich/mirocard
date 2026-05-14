import { shuffle } from "@/shared/utils/shuffle";

function adultsFromStudent(student) {
  const adults = student?.closeAdults;
  if (!Array.isArray(adults) || adults.length === 0) return null;
  return adults.map((a) => ({
    id:    `adult_${a.id}`,
    type:  "subject",
    label: a.name,
    emoji: null,
    photo: a.photo ?? null,
  }));
}

export function generateTasks(mode, topicRecord, sessionParams, student = null) {
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

  if (mode.type === "listen_build" || mode.type === "listen_build_mono") {
    const structure   = sessionParams?.structure ?? "simple";
    const distractors = Math.max(0, Number(sessionParams?.distractors ?? 2));
    const isSimple    = structure === "simple";
    const slotTypes   = isSimple
      ? ["subject", "verb"]
      : ["subject", "verb", "adjective", "object"];

    const sentences = (topicRecord.sentences ?? []).filter((s) =>
      isSimple ? (!s.adjective && !s.object) : (s.adjective && s.object)
    );

    const cardById   = Object.fromEntries(cards.map((c) => [c.id, c]));
    const adultCards = adultsFromStudent(student);

    return shuffle([...sentences]).map((sentence) => {
      const target = {};
      const pool   = [];

      for (const slotType of slotTypes) {
        if (slotType === "subject" && adultCards) {
          const correct = shuffle([...adultCards])[0];
          target[slotType] = correct;
          const others = adultCards.filter((a) => a.id !== correct.id);
          pool.push(correct, ...shuffle([...others]).slice(0, distractors));
        } else {
          const correct = cardById[sentence[slotType]];
          target[slotType] = correct;
          const others = cards.filter((c) => c.type === slotType && c.id !== correct.id);
          pool.push(correct, ...shuffle([...others]).slice(0, distractors));
        }
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
