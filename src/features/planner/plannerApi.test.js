import { describe, it, expect } from 'vitest';
import { resetShoppingData } from './plannerApi.js';
import {
  savePlannerShopCustomData, getPlannerShopCustomData,
  savePlannerShopPlan, getPlannerShopPlan,
  savePlannerShopBought, getPlannerShopBought,
  savePlannerPutawayPlan, getPlannerPutawayPlan,
  savePlannerShopMenuKeys, getPlannerShopMenuKeys,
} from '@/core/groupStore';

describe('resetShoppingData', () => {
  it('clears customData, planned, bought, putaway plan, and menu keys', async () => {
    const studentId = 'test-student-reset-1';
    await savePlannerShopCustomData(studentId, { categories: [{ id: 'x', name: 'X', icon: '📦', subgroups: [] }] });
    await savePlannerShopPlan(studentId, { 'X_0': true });
    await savePlannerShopBought(studentId, { 'X_0': true });
    await savePlannerPutawayPlan(studentId, { 'X_0': 'fridge' });
    await savePlannerShopMenuKeys(studentId, ['X_0']);

    await resetShoppingData(studentId);

    expect(await getPlannerShopCustomData(studentId)).toBeNull();
    expect(await getPlannerShopPlan(studentId)).toEqual({});
    expect(await getPlannerShopBought(studentId)).toEqual({});
    expect(await getPlannerPutawayPlan(studentId)).toEqual({});
    expect(await getPlannerShopMenuKeys(studentId)).toEqual([]);
  });
});
