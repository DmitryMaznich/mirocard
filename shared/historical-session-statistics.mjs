// Historical tap collection was incomplete in some renderers and could reset
// on retry. Reconstruct only audited modes whose complete tap totals reconcile
// with the saved action counters. Never infer settings from today's topic.
const SINGLE_RESPONSE_MODES = new Set(["yes_no", "find_n", "choose_word_by_picture", "emotion_control", "emotion_situation", "situation_emotion", "sort_by_attribute"]);
const QUALITIES = new Set(["easy", "correct", "prompted", "fail", "independent", "after_model", "none"]);
const object = value => value && typeof value === "object" && !Array.isArray(value);
const nonempty = value => object(value) && Object.keys(value).length > 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;

function recoverResponses(session) {
  if (!SINGLE_RESPONSE_MODES.has(session.modeId ?? session.mode) || !Array.isArray(session.cardEvents) || !session.cardEvents.length) return null;
  if (!integer(session.correctCount) || !integer(session.incorrectCount)) return null;
  let correctActions = 0, incorrectActions = 0, firstTotal = 0, firstCorrect = 0, corrected = 0;
  const concepts = new Map();
  for (const event of session.cardEvents) {
    if (!object(event) || event.quality != null || !Array.isArray(event.taps) || event.attemptCount !== event.taps.length) return null;
    if (!event.taps.length) {
      if (event.completed !== false) return null;
      continue;
    }
    let correct = false;
    for (let index = 0; index < event.taps.length; index++) {
      const tap = event.taps[index];
      if (!object(tap) || typeof tap.isCorrect !== "boolean" || correct) return null;
      if (tap.isCorrect) { correct = true; correctActions++; }
      else incorrectActions++;
    }
    // Completed old events are emitted on a correct response; pending events
    // explicitly say completed:false and must contain only wrong taps.
    if (correct === (event.completed === false)) return null;
    firstTotal++;
    if (event.taps[0].isCorrect) firstCorrect++;
    else if (correct) corrected++;
    if (typeof event.conceptId === "string" && event.conceptId) {
      const counts = concepts.get(event.conceptId) ?? { total: 0, correct: 0 };
      counts.total++;
      if (event.taps[0].isCorrect) counts.correct++;
      concepts.set(event.conceptId, counts);
    }
  }
  if (!firstTotal || correctActions !== session.correctCount || incorrectActions !== session.incorrectCount) return null;
  return { firstTotal, firstCorrect, corrected, concepts: Object.fromEntries(concepts) };
}

export function recoverHistoricalSession(session) {
  if (!session || (session.statistics && session.statistics.schemaVersion !== "legacy-1")) return session;
  const previous = session.statistics;
  // Replaying a recovered, compact record is idempotent, including after the
  // original taps are no longer present in a client upload.
  if (previous?.recovery?.version === 1) return session;
  const responses = recoverResponses(session);
  const quality = new Map();
  const assessments = Array.isArray(session.assessments) && session.assessments.length
    ? session.assessments : (Array.isArray(session.cardEvents) ? session.cardEvents.filter(event => event?.quality != null) : []);
  for (const assessment of assessments) {
    if (!object(assessment) || !QUALITIES.has(assessment.quality)) continue;
    const count = assessment.count ?? 1;
    if (!integer(count) || !count) continue;
    quality.set(assessment.quality, (quality.get(assessment.quality) ?? 0) + count);
  }
  const params = nonempty(session.paramsSnapshot) ? session.paramsSnapshot : null;
  if (!responses && !quality.size && !params) return session;
  const conditions = params ? { params, historical: true, knownSettingsOnly: true,
    ...(Array.isArray(session.conceptIds) ? { conceptIds: [...new Set(session.conceptIds.filter(id => typeof id === "string"))].sort() } : {}),
    ...(typeof session.textId === "string" ? { textId: session.textId } : {}),
  } : null;
  return { ...session, statistics: { schemaVersion: "legacy-1", ...(responses ?? {}), quality: Object.fromEntries(quality), conditions,
    recovery: { version: 1, responses: responses ? "reconciled_taps" : null, quality: quality.size > 0, savedParams: Boolean(params) },
  } };
}

export function sameSessionIdentity(left, right) {
  const mode = session => session.modeId ?? session.mode;
  if (left.id !== right.id || !left.studentId || left.studentId !== right.studentId || !left.topicId || left.topicId !== right.topicId || left.topicVersion !== right.topicVersion || mode(left) !== mode(right)) return false;
  return ["startedAt", "completedAt"].every(key => left[key] && right[key] && Number.isFinite(Date.parse(left[key])) && Date.parse(left[key]) === Date.parse(right[key]));
}

export function mergeSessionHistory(local = [], remote = []) {
  const sessions = new Map(local.filter(session => session?.id).map(session => [session.id, recoverHistoricalSession(session)]));
  for (const source of remote) {
    if (!source?.id) continue;
    const raw = recoverHistoricalSession(source);
    let saved = sessions.get(raw.id);
    let merged = raw;
    if (saved && sameSessionIdentity(saved, raw)) {
      if (saved.statistics?.recovery?.responses && (saved.correctCount !== raw.correctCount || saved.incorrectCount !== raw.incorrectCount)) {
        const { firstTotal: _total, firstCorrect: _correct, corrected: _corrected, concepts: _concepts, ...metadata } = saved.statistics;
        saved = { ...saved, statistics: { ...metadata, recovery: { ...metadata.recovery, responses: null } } };
      }
      merged = { ...raw };
      for (const field of ["paramsSnapshot", "statistics", "assessments", "cardEvents", "conceptIds", "textId", "completionReason", "activeDurationMs", "elapsedDurationMs"]) {
        const current = raw[field];
        if (current == null || (Array.isArray(current) && !current.length) || (object(current) && !Object.keys(current).length)) merged[field] = saved[field] ?? current;
      }
      // Enrich a server-derived historical summary with a device's original
      // snapshot; leave newly measured statistics untouched.
      if (merged.statistics?.schemaVersion === "legacy-1" && saved.statistics?.schemaVersion === "legacy-1") {
        merged.statistics = { ...merged.statistics,
          ...(!merged.statistics.firstTotal && saved.statistics.firstTotal ? { firstTotal: saved.statistics.firstTotal, firstCorrect: saved.statistics.firstCorrect, corrected: saved.statistics.corrected, concepts: saved.statistics.concepts } : {}),
          conditions: merged.statistics.conditions ?? saved.statistics.conditions,
          recovery: { ...merged.statistics.recovery, responses: merged.statistics.recovery?.responses ?? saved.statistics.recovery?.responses, savedParams: Boolean(merged.statistics.conditions || saved.statistics.conditions) },
        };
        if (saved.statistics.recovery?.responses && !raw.statistics?.recovery?.responses && saved.cardEvents?.length) merged.cardEvents = saved.cardEvents;
      }
    }
    sessions.set(raw.id, recoverHistoricalSession(merged));
  }
  return [...sessions.values()];
}
