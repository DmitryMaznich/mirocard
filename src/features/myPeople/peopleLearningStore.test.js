import { beforeEach, describe, it, expect, vi } from 'vitest';
import { getDb, kv } from '@/core/db';
import { useAppStore } from '@/core/store';
import { loadLearningDocuments, saveLearningDocument, learningDocKey } from './peopleLearningStore';
const remote = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/topics/accountKv', () => ({ accountKv: remote }));
beforeEach(async () => {
  useAppStore.setState({ account: { id: 'owner' } });
  const db = await getDb();
  await kv.del(db, 'peopleLearning:owner:kid');
  remote.list.mockResolvedValue([]);
});
describe('prepared plan storage', () => {
  it('draft writes do not change a confirmed plan and the queue is atomic', async () => {
    const p = await saveLearningDocument('owner', 'kid', 'plan', 'self', { goal: 'name', fieldSize: 2 }, null);
    await saveLearningDocument('owner', 'kid', 'draft', 'name:select:self', { goal: 'name', fieldSize: 6 });
    const docs = await loadLearningDocuments('owner', 'kid');
    expect(docs[learningDocKey('kid', 'plan', 'self')]).toMatchObject({ id: p.id, fieldSize: 2 });
    const db = await getDb();
    const queued = await new Promise((resolve, reject) => { const r = db.transaction('syncQueue').objectStore('syncQueue').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    expect(queued.some(op => op.type === 'kv.upsert' && op.data.value.id === p.id)).toBe(true);
  });
  it('an older offline plan cannot overwrite a newer confirmed plan and conflicts are explicit', async () => {
    const p = await saveLearningDocument('owner', 'kid', 'plan', 'self', { fieldSize: 2 }, null);
    const key = learningDocKey('kid', 'plan', 'self');
    remote.list.mockResolvedValue([{ key, value: { ...p, id: 'new-device', parentId: null, revision: 3, fieldSize: 6 } }]);
    await expect(saveLearningDocument('owner', 'kid', 'plan', 'self', { fieldSize: 3 }, p.id)).rejects.toThrow('другом устройстве');
    const docs = await loadLearningDocuments('owner', 'kid');
    expect(docs[key].fieldSize).toBe(6);
  });
  it('keeps newer offline edits even when an in-flight server read returns an older snapshot', async () => {
    const key = learningDocKey('kid', 'draft', 'name:select:self');
    let resolveRemote;
    remote.list.mockImplementation(() => new Promise(resolve => { resolveRemote = resolve; }));
    const reading = loadLearningDocuments('owner', 'kid');
    await vi.waitFor(() => expect(resolveRemote).toBeTypeOf('function'));
    const saved = await saveLearningDocument('owner', 'kid', 'draft', 'name:select:self', { fieldSize: 6 });
    resolveRemote([{ key, value: { id: 'older', revision: 0, fieldSize: 2 } }]);
    expect((await reading)[key].id).toBe(saved.id);
  });
  it('refuses writes after an account switch', async () => {
    useAppStore.setState({ account: { id: 'other' } });
    await expect(saveLearningDocument('owner', 'kid', 'draft', 'name:select:self', {})).rejects.toThrow('Аккаунт изменился');
  });
});
