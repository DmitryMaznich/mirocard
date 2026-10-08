// Usage time is sampled in small intervals: hidden tabs and device sleep do not
// add time. This is an activity estimate, not proof that a person is working.
const TOPIC_SCREENS = new Set([
  "home",
  "modes",
  "texts",
  "params",
  "concepts",
  "session",
  "summary",
  "reading",
  "all_texts",
]);
export function createUsageTracker({
  emit,
  getState,
  isVisible,
  now = () => Date.now(),
}) {
  let context = null,
    last = now(),
    lastInteraction = last,
    foreground = 0,
    active = 0;
  const state = () => {
    const s = getState();
    return s.token && s.account?.id
      ? {
          accountId: s.account.id,
          screen: s.screen,
          topicId: TOPIC_SCREENS.has(s.screen)
            ? (s.activeTopicId ?? null)
            : null,
        }
      : null;
  };
  const send = (kind, extra = {}) => {
    if (context)
      emit({
        kind,
        occurredAt: new Date(now()).toISOString(),
        ...context,
        ...extra,
      });
  };
  const flush = () => {
    if (foreground > 0)
      send("time", {
        foregroundMs: Math.round(foreground),
        activeMs: Math.round(active),
      });
    foreground = 0;
    active = 0;
  };
  const sample = () => {
    const at = now(),
      delta = Math.min(5000, Math.max(0, at - last));
    if (context && isVisible()) {
      foreground += delta;
      active += Math.max(
        0,
        Math.min(at, lastInteraction + 60000) - Math.max(last, at - delta),
      );
    }
    last = at;
    const next = state();
    if (JSON.stringify(next) !== JSON.stringify(context)) {
      flush();
      const previous = context;
      context = next;
      if (context) {
        if (previous?.accountId !== context.accountId) send("app_open");
        send("screen_view");
        if (context.topicId && context.topicId !== previous?.topicId)
          send("topic_open");
      }
    }
  };
  return {
    sample,
    flush: () => {
      sample();
      flush();
    },
    interact: () => {
      sample();
      lastInteraction = now();
    },
    pause: () => {
      sample();
      flush();
      last = now();
    },
    resume: () => {
      last = now();
      lastInteraction = last;
      sample();
    },
  };
}
