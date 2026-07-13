import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '@/core/api';
import { pushOp } from '@/core/syncApi';
import { pullPlannerKvFromServer, pullRecipeKvFromServer } from './groupStore.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFlakyServer() {
  const callOrder = [];
  let failNextPost = true;
  vi.spyOn(api, 'post').mockImplementation(async () => {
    callOrder.push('post');
    if (failNextPost) { failNextPost = false; throw new Error('offline'); }
    return {};
  });
  vi.spyOn(api, 'get').mockImplementation(async () => {
    callOrder.push('get');
    return { kv: [] };
  });
  return callOrder;
}

describe('pullPlannerKvFromServer', () => {
  it('flushes pending local writes before pulling, so an in-flight local reset cannot be clobbered by stale server data', async () => {
    const callOrder = mockFlakyServer();

    // Simulates a local reset (e.g. "Новое меню") whose immediate push
    // failed (app closed / offline) and is still sitting in the sync queue.
    await pushOp('kv.upsert', { key: 'planner_shop_custom_test-student', value: null });

    callOrder.length = 0; // isolate what pullPlannerKvFromServer itself triggers
    await pullPlannerKvFromServer();

    expect(callOrder[0]).toBe('post'); // must flush the queued write before pulling
    expect(callOrder).toContain('get');
  });
});

describe('pullRecipeKvFromServer', () => {
  it('flushes pending local writes before pulling, so an in-flight local save cannot be clobbered by stale server data', async () => {
    const callOrder = mockFlakyServer();

    await pushOp('kv.upsert', { key: 'recipe_settings_test-topic', value: { portions: 4 } });

    callOrder.length = 0;
    await pullRecipeKvFromServer();

    expect(callOrder[0]).toBe('post');
    expect(callOrder).toContain('get');
  });
});
