import { useUsageTracking } from "./useUsageTracking";
import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";

const INTERVAL_MS = 30_000;

export function useHeartbeat() {
  useUsageTracking();
  useEffect(() => {
    async function beat() {
      const { token, screen, activeTopicId, homeActiveTab, buildInfo } =
        useAppStore.getState();
      if (
        document.hidden ||
        !token ||
        screen === "boot" ||
        screen === "login" ||
        screen === "register"
      )
        return;
      try {
        const currentScreen =
          screen === "home" && homeActiveTab && homeActiveTab !== "session"
            ? homeActiveTab
            : screen;
        const topicScreen = [
          "home",
          "modes",
          "texts",
          "params",
          "concepts",
          "session",
          "summary",
          "reading",
          "all_texts",
        ].includes(currentScreen);
        await api.post("/heartbeat", {
          screen: currentScreen,
          topicId: topicScreen ? activeTopicId || null : null,
          version: buildInfo?.version ?? null,
        });
      } catch {
        /* Presence is best-effort; usage is queued separately. */
      }
    }

    beat();
    const interval = setInterval(beat, INTERVAL_MS);
    function onVisible() {
      if (!document.hidden) beat();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
