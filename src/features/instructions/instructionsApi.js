import { getDb, kv } from "@/core/db";
import { pushOp } from "@/core/syncApi";
import { api } from "@/core/api";
import { BUILTIN_INSTRUCTIONS } from "@/topics/builtinInstructions";

const USER_INSTRUCTIONS_KEY = "user_instructions";

export async function getUserInstructions() {
  const db = await getDb();
  return (await kv.get(db, USER_INSTRUCTIONS_KEY)) ?? [];
}

async function saveUserInstructions(instructions) {
  const db = await getDb();
  await kv.set(db, USER_INSTRUCTIONS_KEY, instructions);
  pushOp("kv.upsert", { key: USER_INSTRUCTIONS_KEY, value: instructions }).catch(() => {});
}

export async function getAllInstructions() {
  const userInstructions = await getUserInstructions();
  return [...BUILTIN_INSTRUCTIONS, ...userInstructions];
}

export async function addInstruction({ title, emoji, steps }) {
  const instructions = await getUserInstructions();
  const instruction = {
    id: crypto.randomUUID(),
    title,
    emoji,
    steps,
    builtin: false,
    updatedAt: Date.now(),
  };
  await saveUserInstructions([...instructions, instruction]);
  return instruction;
}

export async function updateInstruction(id, { title, emoji, steps }) {
  const instructions = await getUserInstructions();
  const next = instructions.map((instr) =>
    instr.id === id ? { ...instr, title, emoji, steps, updatedAt: Date.now() } : instr
  );
  await saveUserInstructions(next);
  return next.find((instr) => instr.id === id) ?? null;
}

export async function deleteInstruction(id) {
  const instructions = await getUserInstructions();
  await saveUserInstructions(instructions.filter((instr) => instr.id !== id));
}

/** Pull the latest user_instructions blob from the server into local IndexedDB — same shape as groupStore.js's pullRecipeKvFromServer(). */
export async function pullUserInstructionsFromServer() {
  try {
    const { kv: items } = await api.get(`/account/kv?prefix=${encodeURIComponent(USER_INSTRUCTIONS_KEY)}`);
    if (!Array.isArray(items) || !items.length) return;
    const db = await getDb();
    for (const { key, value } of items) {
      await kv.set(db, key, value);
    }
  } catch {
    // Offline или не авторизован — пропускаем тихо
  }
}
