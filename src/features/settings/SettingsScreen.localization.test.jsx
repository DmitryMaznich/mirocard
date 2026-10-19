import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import SettingsScreen from "./SettingsScreen.jsx";
import { useAppStore } from "@/core/store";
import { applyBootstrapToStore } from "@/core/bootstrap";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";

describe("settings UI language", () => {
  let root, container;
  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    act(() => setUiLanguage("ru"));
    useAppStore.setState({ activeSessionSnapshot: null });
  });

  it("preserves lesson language, the saved session and local controls through a late bootstrap", async () => {
    const snapshot = { context: { topicId: "example" }, sessionState: { tasks: [{ label: "Русский материал" }] } };
    useAppStore.setState((state) => ({ activeStudentId: null, activeSessionSnapshot: snapshot, settings: { ...state.settings, cardLanguage: "ru", physicalKeyboard: true } }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<SettingsScreen />));
    act(() => {
      setUiLanguage("sl");
      applyBootstrapToStore({ settings: { uiLanguage: "ru" } });
    });
    expect(container.querySelector("h1").textContent).toBe("Nastavitve");
    expect(container.querySelector("select").value).toBe("sl");
    expect(useAppStore.getState().settings.uiLanguage).toBe("sl");
    expect(useAppStore.getState().settings.cardLanguage).toBe("ru");
    expect(useAppStore.getState().settings.physicalKeyboard).toBe(true);
    expect(useAppStore.getState().activeSessionSnapshot).toBe(snapshot);
  });
});
