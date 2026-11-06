import { it, expect } from 'vitest';
import { openDb, kv } from './db';
import { erasePeopleLearningCache } from './peopleLearningCache';
it('erasure removes only the selected pupil offline photos and v2 documents', async () => {
  const db = await openDb(`people-erase-${crypto.randomUUID()}`);
  const keys = ['peoplePhoto:owner:gone:/api/photos/abc', 'peopleLearning:owner:gone', 'my_people:v2:gone:plan:self', 'peoplePhoto:owner:keep:/api/photos/abc', 'unrelated'];
  for (const key of keys) await kv.set(db, key, { keep: true });
  await erasePeopleLearningCache(db, ['gone']);
  for (const key of keys.slice(0, 3)) expect(await kv.get(db, key)).toBeNull();
  for (const key of keys.slice(3)) expect(await kv.get(db, key)).toEqual({ keep: true });
  db.close();
});
