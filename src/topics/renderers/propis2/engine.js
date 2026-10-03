// «Прописи 2»: the session engine only hands the renderer one "page" task; the constructor
// itself is the topic's home screen (src/features/propis2), not a session.
export function generateTasks(_mode, _topicRecord, _sessionSize, sessionParams) {
  return [{
    id: "propis2_page",
    type: "page",
    cardId: "propis2_page",
    conceptId: "propis2_page",
    lines: sessionParams?.lines ?? [],
  }];
}
