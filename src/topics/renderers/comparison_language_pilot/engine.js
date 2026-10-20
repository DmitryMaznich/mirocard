import { shuffle } from "@/shared/utils/shuffle";
import { contentMessage } from "../../../../shared/topic-language-contract.mjs";
import { generateComparisonTask } from "./mechanics.js";

const LEVELS = [
  { min: 1, max: 10, minDiff: 5 },
  { min: 1, max: 10, minDiff: 1 },
  { min: 1, max: 20, minDiff: 1 },
  { min: 10, max: 99, minDiff: 1 },
];

// The host pins this context at lesson start; UI language is never an input.
export function generateTasks(mode, cards, count = 20, params = {}, context, pack) {
  if (!context || !pack || context.contentLanguage !== pack.language || context.packageId !== pack.packageId || context.contentVersion !== pack.version) throw new Error("Explicit matching content package required");
  if (!["compare_visual", "compare_sign"].includes(mode.type)) throw new Error("Unsupported pilot mode");
  const card = cards.find((c) => c.id === (params.cardId ?? mode.defaultCardId)) ?? cards[0];
  if (!card) return [];
  const isSign = mode.type === "compare_sign";
  const { level = isSign ? 2 : 1, question = "more", showEqual = false } = params;
  const visualMode = isSign ? "numbers" : (params.visualMode ?? "dots");
  if (!LEVELS[level - 1] || !["more", "less", "mix"].includes(question) || !["dots", "dots_numbers", "numbers", "pairing"].includes(visualMode)) throw new Error("Invalid pilot parameters");
  const range = LEVELS[level - 1];
  const used = new Set();
  const equalTarget = showEqual ? Math.round(count * 0.3) : 0;
  const tasks = [];
  for (let i = 0; i < count; i++) {
    let left, right;
    if (i < equalTarget) {
      let value, key, tries = 0;
      do {
        value = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        key = `${value},${value}`;
        tries++;
      } while (used.has(key) && tries < 100);
      used.add(key);
      left = right = value;
    } else {
      ({ left, right } = generateComparisonTask({ ...range, allowEqual: false }, used));
    }
    const taskQuestion = left === right ? "equal" : question === "mix" ? (Math.random() < 0.5 ? "more" : "less") : question;
    const promptQuestion = taskQuestion === "equal" ? (question === "less" ? "less" : "more") : taskQuestion;
    tasks.push({
      type: mode.type, left, right, conceptId: card.conceptId,
      question: taskQuestion, showEqual, visualMode,
      instruction: contentMessage(pack, isSign ? `prompt.sign.${taskQuestion}` : `prompt.${visualMode}.${promptQuestion}`),
      ...(isSign ? { crocTip: contentMessage(pack, "sign.crocTip") } : {}),
      equalHint: !isSign && showEqual ? contentMessage(pack, visualMode === "numbers" ? "equal.numbersHint" : "equal.hint") : null,
      equalLabel: contentMessage(pack, "equal.label"),
      verdictText: contentMessage(pack, `verdict.${taskQuestion}`, { left, right, larger: Math.max(left, right), smaller: Math.min(left, right) }),
      languageContext: context,
    });
  }
  return shuffle(tasks);
}
