import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsScreen from "./SettingsScreen.jsx";
import { useAppStore } from "@/core/store";
import { applyBootstrapToStore } from "@/core/bootstrap";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import { accountLanguages } from "@/core/languageSync.js";

describe("settings UI language", () => {
  let root, container;
  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    accountLanguages.disconnect();
    act(() => setUiLanguage("ru"));
    useAppStore.setState({ account: null, token: null, activeSessionSnapshot: null });
    vi.restoreAllMocks();
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

  it("syncs an authenticated UI choice without changing lesson preference, PIN or the active lesson", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ uiLanguage: "ru", cardLanguage: "sl", languageRevision: 4, conflict: false }),
    });
    const snapshot = { context: { topicId: "example" }, sessionState: { tasks: [{ label: "Урок" }] } };
    useAppStore.setState({ activeSessionSnapshot: snapshot });
    act(() => applyBootstrapToStore({
      account: { id: "language-ui-test" }, token: "test-token",
      settings: { uiLanguage: "sl", cardLanguage: "sl", languageRevision: 3, adultPinHash: "keep" },
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<SettingsScreen />));
    expect(container.querySelectorAll("select")[1].value).toBe("sl");
    await act(async () => {
      setUiLanguage("ru");
      applyBootstrapToStore({ settings: { uiLanguage: "sl", cardLanguage: "sl", languageRevision: 3 } });
      await accountLanguages.flush();
    });
    expect(container.querySelector("select").value).toBe("ru");
    expect(useAppStore.getState().settings.cardLanguage).toBe("sl");
    expect(useAppStore.getState().settings.adultPinHash).toBe("keep");
    expect(useAppStore.getState().activeSessionSnapshot).toBe(snapshot);
    const request = fetchMock.mock.calls.find(([url]) => url.endsWith("/account/languages"));
    expect(JSON.parse(request[1].body).patch).toEqual({ uiLanguage: "ru" });
  });

  it("keeps a native select change to Slovenian while an unchanged default response awaits a successful retry", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ uiLanguage: "ru", cardLanguage: "ru", languageRevision: 0, conflict: false }),
    });
    act(() => applyBootstrapToStore({
      account: { id: "legacy-language-select-test" }, token: "test-token",
      settings: { uiLanguage: "ru", cardLanguage: "ru", languageRevision: 0 },
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<SettingsScreen />));
    fetchMock.mockClear();
    await act(async () => {
      const select = container.querySelector("select");
      select.value = "sl";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await accountLanguages.flush();
    });
    expect(container.querySelector("select").value).toBe("sl");
    expect(container.querySelector("h1").textContent).toBe("Nastavitve");
    expect(accountLanguages.getSnapshot().status).toBe("pending");
    expect(useAppStore.getState().settings.uiLanguage).toBe("sl");
    const request = fetchMock.mock.calls.find(([url]) => url.endsWith("/account/languages"));
    expect(JSON.parse(request[1].body).patch).toEqual({ uiLanguage: "sl" });
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ uiLanguage: "sl", cardLanguage: "ru", languageRevision: 1, conflict: false }),
    });
    await act(async () => accountLanguages.flush());
    expect(container.querySelector("select").value).toBe("sl");
    expect(accountLanguages.getSnapshot().status).toBe("synced");
  });
});
