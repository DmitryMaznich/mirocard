import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { ANTHROPIC_API_KEY } from "./config.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const PROMPT_VERSION = "v1";
const SYSTEM_PROMPT = readFileSync(
  join(__dir, "../prompts/topic-analysis-v1.md"),
  "utf8"
);

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export async function generateAnalysis(db, studentId, topicId) {
  // 1. Fetch all sessions with card_events
  const sessions = db.prepare(`
    SELECT started_at, card_events
    FROM sessions
    WHERE student_id = ? AND topic_id = ?
    ORDER BY started_at ASC
  `).all(studentId, topicId);

  if (sessions.length === 0) return null;

  // 2. Build prompt data
  const promptData = buildPromptData(sessions);

  // 3. Call Claude
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(promptData) }],
  });

  const result = JSON.parse(message.content[0].text);

  // 4. Cache result
  db.prepare(`
    INSERT OR REPLACE INTO analysis_cache
      (student_id, topic_id, prompt_version, generated_at, result_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(studentId, topicId, PROMPT_VERSION, Date.now(), JSON.stringify(result));

  return result;
}

export function getCachedAnalysis(db, studentId, topicId) {
  return db.prepare(
    "SELECT result_json, generated_at FROM analysis_cache WHERE student_id = ? AND topic_id = ?"
  ).get(studentId, topicId) ?? null;
}

export function deleteCachedAnalysis(db, studentId, topicId) {
  db.prepare(
    "DELETE FROM analysis_cache WHERE student_id = ? AND topic_id = ?"
  ).run(studentId, topicId);
}

function buildPromptData(sessions) {
  const sessionAggregates = [];
  const cardHistories = {}; // cardId → [guessingScore per session]

  for (const s of sessions) {
    const events = JSON.parse(s.card_events ?? "[]");
    const scores = events.map((e) => e.guessingScore ?? 0);
    const avg = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;

    sessionAggregates.push({
      date: s.started_at?.slice(0, 10),
      avg_guessing: avg,
      cards_shown: events.length,
    });

    for (const e of events) {
      const id = e.cardId ?? e.conceptId ?? "unknown";
      if (!cardHistories[id]) cardHistories[id] = [];
      cardHistories[id].push(e.guessingScore ?? 0);
    }
  }

  return { sessions: sessionAggregates, cards: cardHistories };
}
