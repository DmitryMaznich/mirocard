import { useCallback, useSyncExternalStore } from "react";
import { useAppStore } from "./store";

// Device-local opt-in. Never include this preference in account settings,
// bootstrap, sync payloads or a URL. A different account starts with legacy UI.
const PREFIX = "mirocard.topic-ui-preview.v1:";
const listeners = new Set();
const memory = new Map();

export function topicUiPreviewScope(account, token) {
  if (account?.id) return `account:${account.id}`;
  return token ? null : "local";
}

export function readTopicUiPreview(scope) {
  if (!scope) return false;
  if (memory.has(scope)) return memory.get(scope);
  try { return localStorage.getItem(PREFIX + scope) === "enabled"; }
  catch { return false; }
}

export function writeTopicUiPreview(scope, enabled) {
  if (!scope) return false;
  let saved = false;
  try {
    if (enabled) localStorage.setItem(PREFIX + scope, "enabled");
    else localStorage.removeItem(PREFIX + scope);
    memory.delete(scope);
    saved = true;
  } catch { memory.set(scope, Boolean(enabled)); }
  listeners.forEach((notify) => notify());
  return saved;
}

function subscribe(notify) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key.startsWith(PREFIX)) {
      memory.clear();
      listeners.forEach((notify) => notify());
    }
  });
}

export function useTopicUiPreview() {
  const account = useAppStore((state) => state.account);
  const token = useAppStore((state) => state.token);
  const scope = topicUiPreviewScope(account, token);
  const getSnapshot = useCallback(() => readTopicUiPreview(scope), [scope]);
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const setEnabled = useCallback((value) => writeTopicUiPreview(scope, value), [scope]);
  return { enabled, setEnabled };
}
