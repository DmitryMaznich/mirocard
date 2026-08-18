/**
 * A start PIN only protects sessions that can award a video. Turning the
 * reward off must let the child start immediately, regardless of whether an
 * adult PIN has been configured for the account.
 */
export function shouldRequestSessionStartPin({ videoRewardEnabled, bypassPin = false }) {
  return videoRewardEnabled && !bypassPin;
}
