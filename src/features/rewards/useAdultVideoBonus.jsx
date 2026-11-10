import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/core/store';
import { getDb, kv } from '@/core/db';
import { api } from '@/core/api';
import { effectiveRewardSettings } from '../../../shared/reward-policy.mjs';
import PinGateModal from '@/shared/components/PinGateModal';
import RewardVideoModal from '@/shared/components/RewardVideoModal';

// Host-side bridge for ZIP renderers: reuse the real account PIN and student's
// video settings, without bundling a second app store into the topic.
export function useAdultVideoBonus({ student, enabled }) {
  const pinHash = useAppStore(state => state.settings.adultPinHash ?? null);
  const patchSettings = useAppStore(state => state.patchSettings);
  const [pending, setPending] = useState(null);
  const active = useRef(false);
  const request = useCallback((options = {}) => {
    if (!enabled || !student?.rewardVideos?.length || active.current) return false;
    active.current = true;
    setPending({ ...options, student, stage: 'pin' });
    return true;
  }, [enabled, student]);
  const setPin = useCallback(async hash => {
    patchSettings({ adultPinHash: hash });
    const db = await getDb();
    await kv.set(db, 'settings', { ...useAppStore.getState().settings, adultPinHash: hash });
    api.patch('/account/settings', { adultPinHash: hash }).catch(() => {});
  }, [patchSettings]);
  const finish = completed => {
    active.current = false; setPending(null);
    if (completed) pending.onComplete?.(); else pending.onCancel?.();
  };
  const modal = pending && enabled && pending.student.id === student?.id ? pending.stage === 'pin'
    ? <PinGateModal pinHash={pinHash} onSetPin={setPin} onCancel={() => finish(false)}
        onSuccess={() => setPending(previous => ({ ...previous, stage: 'reward' }))} />
    : <RewardVideoModal rewardVideos={pending.student.rewardVideos} studentId={pending.student.id}
        settingsOverride={effectiveRewardSettings(pending.student.rewardSettings)} title={pending.title ?? 'Рисунок готов — молодец!'}
        onDismiss={() => finish(true)} />
    : null;
  return { request, modal };
}
