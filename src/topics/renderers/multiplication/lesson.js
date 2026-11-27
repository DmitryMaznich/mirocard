import { useCallback, useEffect, useRef } from "react";
import { contentMessage } from "../../../../shared/topic-language-contract.mjs";
import { APPLE, BANANA, PLATE } from "./assets.js";

// Lesson text always comes from the task's pinned content package.
export const msg = (task, key, values = {}) => contentMessage({ messages: task.messages }, key, values);
export const lessonLanguage = (task) => task.languageContext.contentLanguage;
export const rootStyle = { "--plate": `url("${PLATE}")` };
export const itemImage = (kind) => (kind === "banana" ? BANANA : APPLE);
export const BANANA_POS = { 1: [[50, 50, -9]], 2: [[46, 38, -10], [54, 63, 4]], 3: [[47, 30, -10], [53, 51, 3], [47, 71, -6]] };

// Timeouts that die with the task (the renderer is remounted for every task).
export function useTimers() {
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return useCallback((fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id; }, []);
}
