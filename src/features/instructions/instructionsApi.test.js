import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, kv } from '@/core/db';
import {
  getUserInstructions, addInstruction, updateInstruction, deleteInstruction, getAllInstructions,
} from './instructionsApi.js';

beforeEach(async () => {
  const db = await getDb();
  await kv.set(db, 'user_instructions', []);
});

describe('getUserInstructions', () => {
  it('returns an empty array when nothing is saved', async () => {
    expect(await getUserInstructions()).toEqual([]);
  });
});

describe('addInstruction', () => {
  it('creates an instruction with a generated id and builtin:false', async () => {
    const created = await addInstruction({ title: 'Собираем портфель', emoji: '🎒', steps: ['Найди дневник'] });
    expect(created.id).toBeTruthy();
    expect(created.builtin).toBe(false);
    expect(created.title).toBe('Собираем портфель');

    const all = await getUserInstructions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
  });
});

describe('updateInstruction', () => {
  it('updates title, emoji, and steps by id', async () => {
    const created = await addInstruction({ title: 'Старое имя', emoji: '📦', steps: ['Шаг 1'] });
    const updated = await updateInstruction(created.id, { title: 'Новое имя', emoji: '🧦', steps: ['Шаг 1', 'Шаг 2'] });
    expect(updated.title).toBe('Новое имя');
    expect(updated.emoji).toBe('🧦');
    expect(updated.steps).toEqual(['Шаг 1', 'Шаг 2']);
  });

  it('leaves other instructions untouched', async () => {
    const a = await addInstruction({ title: 'A', emoji: '🅰️', steps: ['1'] });
    const b = await addInstruction({ title: 'B', emoji: '🅱️', steps: ['1'] });
    await updateInstruction(a.id, { title: 'A2', emoji: '🅰️', steps: ['1'] });
    const all = await getUserInstructions();
    expect(all.find((i) => i.id === b.id).title).toBe('B');
  });
});

describe('deleteInstruction', () => {
  it('removes the instruction by id', async () => {
    const created = await addInstruction({ title: 'Удалить меня', emoji: '🗑️', steps: ['1'] });
    await deleteInstruction(created.id);
    expect(await getUserInstructions()).toEqual([]);
  });
});

describe('getAllInstructions', () => {
  it('merges built-in and user instructions', async () => {
    await addInstruction({ title: 'Своя', emoji: '⭐', steps: ['1'] });
    const all = await getAllInstructions();
    expect(all.some((i) => i.id === 'kitchen_cleaning')).toBe(true);
    expect(all.some((i) => i.title === 'Своя')).toBe(true);
  });
});
