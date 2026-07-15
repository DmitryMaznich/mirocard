import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";

const INTERVAL_MS = 30_000;

export function useHeartbeat() {
  useEffect(() => {
    async function beat() {
      const { token, screen, activeTopicId } = useAppStore.getState();
      if (!token || screen === "boot" || screen === "login" || screen === "register") return;
      try {
        await api.post("/heartbeat", { screen, topicId: activeTopicId || null });
      } catch {}
    }

    beat();
    const interval = setInterval(beat, INTERVAL_MS);
    function onVisible() { if (!document.hidden) beat(); }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
