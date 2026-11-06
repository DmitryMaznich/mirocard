import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { useAppStore } from '@/core/store';
import { getDb, kv } from '@/core/db';
import { LearningPhoto } from './PeopleLearningTask';
vi.mock('@/core/api', () => ({ getApiToken: () => 'test-token' }));
let root, container;
const render = async () => { await act(async () => { root.render(<LearningPhoto src="/api/photos/test-offline" />); }); await vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 2)); }); expect(container.querySelector('img')).not.toBeNull(); }); };
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const db = await getDb();
  for (const owner of ['a', 'b']) await kv.del(db, `peoplePhoto:${owner}:kid:/api/photos/test-offline`);
  useAppStore.setState({ account: { id: 'a' }, activeStudentId: 'kid' });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) })));
  vi.stubGlobal('URL', Object.assign(class URLMock extends URL {}, { createObjectURL: vi.fn(() => 'blob:test-photo'), revokeObjectURL: vi.fn() }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('authenticates the first photo fetch and then reuses offline bytes', async () => {
  await render();
  expect(fetch).toHaveBeenCalledWith('/api/photos/test-offline', { headers: { Authorization: 'Bearer test-token' } });
  await act(async () => root.render(null));
  fetch.mockRejectedValue(new Error('offline'));
  await render();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('does not reuse cached photo bytes under a different account', async () => {
  await render();
  await act(async () => useAppStore.setState({ account: { id: 'b' } }));
  await render();
  expect(fetch).toHaveBeenCalledTimes(2);
});
