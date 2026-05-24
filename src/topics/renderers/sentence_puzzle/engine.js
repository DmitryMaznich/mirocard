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

export function generateTasks(mode, topicRecord, sessionParams, student = null, selectedConceptIds = null) {
  const cards = topicRecord.cards ?? [];
  const selectedIds = selectedConceptIds?.length ? new Set(selectedConceptIds) : null;

  if (mode.type === "sentence_puzzle") {
    return [{
      type:       "sentence_puzzle",
      subjects:   cards.filter((c) => c.type === "subject"),
      verbs:      cards.filter((c) => c.type === "verb" && (!selectedIds || selectedIds.has(c.id))),
      adjectives: cards.filter((c) => c.type === "adjective" && (!selectedIds || selectedIds.has(c.id))),
      objects:    cards.filter((c) => c.type === "object" && (!selectedIds || selectedIds.has(c.id))),
    }];
  }

  if (mode.type === "listen_write_letters") {
    const structure = sessionParams?.structure ?? "full";
    const isSimple  = structure === "simple";
    const slotTypes = isSimple
      ? ["subject", "verb"]
      : ["subject", "verb", "adjective", "object"];

    const sentences = (topicRecord.sentences ?? []).filter((s) => {
      if (isSimple ? (s.adjective || s.object) : (!s.adjective || !s.object)) return false;
      if (!selectedIds) return true;
      if (!selectedIds.has(s.verb)) return false;
      if (!isSimple && (!selectedIds.has(s.adjective) || !selectedIds.has(s.object))) return false;
      return true;
    });

    const cardById   = Object.fromEntries(cards.map((c) => [c.id, c]));
    const adultCards = adultsFromStudent(student);

    return shuffle([...sentences]).map((sentence) => {
      const target = {};
      for (const slotType of slotTypes) {
        if (slotType === "subject" && adultCards) {
          target[slotType] = shuffle([...adultCards])[0];
        } else {
          target[slotType] = cardById[sentence[slotType]];
        }
      }
      return {
        type:      "listen_write_letters",
        structure,
        target,
        audioPath: sentence.audio ?? null,
      };
    });
  }

  if (mode.type === "listen_build" || mode.type === "listen_build_mono") {
    const structure   = sessionParams?.structure ?? "simple";
    const distractors = Math.max(0, Number(sessionParams?.distractors ?? 2));
    const isSimple    = structure === "simple";
    const slotTypes   = isSimple
      ? ["subject", "verb"]
      : ["subject", "verb", "adjective", "object"];

    const sentences = (topicRecord.sentences ?? []).filter((s) => {
      if (isSimple ? (s.adjective || s.object) : (!s.adjective || !s.object)) return false;
      if (!selectedIds) return true;
      if (!selectedIds.has(s.verb)) return false;
      if (!isSimple && (!selectedIds.has(s.adjective) || !selectedIds.has(s.object))) return false;
      return true;
    });

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
          const others = cards.filter((c) =>
            c.type === slotType &&
            c.id !== correct.id &&
            (c.type === "subject" || !selectedIds || selectedIds.has(c.id))
          );
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
