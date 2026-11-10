import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useAppStore } from '@/core/store';
import { useAdultVideoBonus } from './useAdultVideoBonus';

const mocks = vi.hoisted(() => ({ pin: null, video: null, kvSet: vi.fn(), patch: vi.fn() }));
vi.mock('@/core/db', () => ({ getDb: vi.fn(async () => 'db'), kv: { set: mocks.kvSet } }));
vi.mock('@/core/api', () => ({ api: { patch: mocks.patch } }));
vi.mock('@/shared/components/PinGateModal', () => ({ default: props => { mocks.pin = props; return <div data-testid="pin" />; } }));
vi.mock('@/shared/components/RewardVideoModal', () => ({ default: props => { mocks.video = props; return <div data-testid="video" />; } }));
const student = { id: 'child', rewardVideos: [{ id: 'child-video' }], rewardSettings: { duration: '60' } };
let root, host, bridge;
const initial = useAppStore.getState();
function Harness({ enabled = true, child = student }) {
  const current = useAdultVideoBonus({ student: child, enabled });
  useEffect(() => { bridge = current; }, [current]);
  return current.modal;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mocks.pin = null; mocks.video = null; vi.clearAllMocks(); mocks.patch.mockResolvedValue({});
  useAppStore.setState({ settings: { ...initial.settings, adultPinHash: 'account-pin' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(initial, true); });

it('requires account PIN, passes the chosen student videos/settings, and completes only on dismiss', async () => {
  const complete = vi.fn(), cancel = vi.fn();
  await act(async () => root.render(<Harness />));
  let accepted;
  await act(async () => { accepted = bridge.request({ onComplete: complete, onCancel: cancel }); });
  expect(accepted).toBe(true); expect(mocks.pin.pinHash).toBe('account-pin');
  expect(host.querySelector('[data-testid=video]')).toBeNull();
  expect(bridge.request()).toBe(false); // No duplicate bonus while PIN/video is open.
  await act(async () => mocks.pin.onSuccess());
  expect(mocks.video.studentId).toBe('child'); expect(mocks.video.rewardVideos).toEqual(student.rewardVideos);
  expect(mocks.video.settingsOverride.duration).toBe('60'); expect(complete).not.toHaveBeenCalled();
  await act(async () => mocks.video.onDismiss());
  expect(complete).toHaveBeenCalledOnce(); expect(cancel).not.toHaveBeenCalled(); expect(host.textContent).toBe('');
});
it('cancels PIN without showing video or counting a bonus', async () => {
  const complete = vi.fn(), cancel = vi.fn();
  await act(async () => root.render(<Harness />));
  await act(async () => { bridge.request({ onComplete: complete, onCancel: cancel }); });
  await act(async () => mocks.pin.onCancel());
  expect(cancel).toHaveBeenCalledOnce(); expect(complete).not.toHaveBeenCalled(); expect(mocks.video).toBeNull();
  await act(async () => { expect(bridge.request()).toBe(true); });
});
it('does not offer a request for other modes or a child without videos', async () => {
  await act(async () => root.render(<Harness enabled={false} />));
  expect(bridge.request()).toBe(false);
  await act(async () => root.render(<Harness child={{ id: 'empty', rewardVideos: [] }} />));
  expect(bridge.request()).toBe(false); expect(mocks.pin).toBeNull(); expect(mocks.video).toBeNull();
});
it('uses the existing account PIN setup persistence', async () => {
  useAppStore.setState({ settings: { ...initial.settings, adultPinHash: null } });
  await act(async () => root.render(<Harness />));
  await act(async () => { bridge.request(); }); expect(mocks.pin.pinHash).toBeNull();
  await act(async () => mocks.pin.onSetPin('new-pin-hash'));
  expect(useAppStore.getState().settings.adultPinHash).toBe('new-pin-hash');
  expect(mocks.kvSet).toHaveBeenCalledWith('db', 'settings', expect.objectContaining({ adultPinHash: 'new-pin-hash' }));
  expect(mocks.patch).toHaveBeenCalledWith('/account/settings', { adultPinHash: 'new-pin-hash' });
});
