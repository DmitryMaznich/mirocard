export function generateTasks(_mode, cards, _sessionSize, _sessionParams) {
  return [{
    type:       "sentence_puzzle",
    subjects:   cards.filter((c) => c.type === "subject"),
    verbs:      cards.filter((c) => c.type === "verb"),
    adjectives: cards.filter((c) => c.type === "adjective"),
    objects:    cards.filter((c) => c.type === "object"),
  }];
}
