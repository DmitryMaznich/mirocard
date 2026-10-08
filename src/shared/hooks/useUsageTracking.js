import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { pushOp } from "@/core/syncApi";
import { createUsageTracker } from "./usageTracker";
let visitId = null,
  visitAccount = null;
export function recordUsage(kind, details = {}) {
  const s = useAppStore.getState();
  if (!s.token || !s.account?.id) return;
  if (details.accountId && details.accountId !== s.account.id) return;
  if (visitAccount !== s.account.id) {
    visitAccount = s.account.id;
    visitId = crypto.randomUUID();
  }
  const device = /Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "Телефон / планшет"
    : "Компьютер";
  pushOp("usage.append", {
    ...details,
    id: details.id ?? crypto.randomUUID(),
    kind,
    occurredAt: details.occurredAt ?? new Date().toISOString(),
    visitId,
    device,
    version: s.buildInfo?.version ?? null,
  }).catch(() => {});
}
export function useUsageTracking() {
  useEffect(() => {
    const tracker = createUsageTracker({
      getState: useAppStore.getState,
      isVisible: () => !document.hidden,
      emit: (e) => recordUsage(e.kind, e),
    });
    tracker.sample();
    let lastError = 0;
    const onError = (e) => {
      if (Date.now() - lastError < 60000) return;
      lastError = Date.now();
      const s = useAppStore.getState();
      recordUsage("sync_error", {
        screen: s.screen,
        mode: String(e.detail?.code ?? "unknown"),
      });
    };
    window.addEventListener("mrc-api-error", onError);
    const sample = setInterval(tracker.sample, 1000),
      flush = setInterval(tracker.flush, 10000);
    const unsubscribe = useAppStore.subscribe(tracker.sample);
    const visibility = () =>
      document.hidden ? tracker.pause() : tracker.resume();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pointerdown", tracker.interact, { passive: true });
    window.addEventListener("keydown", tracker.interact);
    window.addEventListener("pagehide", tracker.pause);
    window.addEventListener("pageshow", tracker.resume);
    document.addEventListener("freeze", tracker.pause);
    return () => {
      window.removeEventListener("mrc-api-error", onError);
      tracker.pause();
      clearInterval(sample);
      clearInterval(flush);
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointerdown", tracker.interact);
      window.removeEventListener("keydown", tracker.interact);
      window.removeEventListener("pagehide", tracker.pause);
      window.removeEventListener("pageshow", tracker.resume);
      document.removeEventListener("freeze", tracker.pause);
    };
  }, []);
}
