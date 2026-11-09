import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { writeTopicUiPreview } from "@/core/topicUiPreview";
import TextPickerScreen from "./TextPickerScreen";

vi.mock("@/core/groupStore", async (original) => ({ ...(await original()), getUserRecipes: async () => [] }));

describe("text choices preserve their special modes in both interfaces", () => {
  let root, host;
  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    writeTopicUiPreview("account:reading-preview", false);
    useAppStore.setState({ account: null, token: null });
  });
  for (const enabled of [false, true]) {
    for (const [kind, modeId] of [["instruction", "follow_instruction"], ["shopping_list", "shopping_list"], ["safe_code", "safe_code"], ["poem_book", "read_poem_book"]]) {
      it(`${enabled ? "preview" : "legacy"}: ${kind}`, async () => {
        writeTopicUiPreview("account:reading-preview", enabled);
        const text = { id: "text", title: "Текст", kind, lines: [] };
        useAppStore.setState({ account: { id: "reading-preview" }, token: "test", screen: "texts",
          activeStudentId: "student", activeTopicId: "reading", activeTextId: null, activeModeId: null,
          topicRecords: [{ meta: { id: "reading", renderer: "reading", title: "Чтение" }, texts: [text] }], sessions: [] });
        host = document.createElement("div"); document.body.append(host); root = createRoot(host);
        await act(async () => root.render(<TextPickerScreen />));
        act(() => host.querySelector(".reading-text-item").click());
        expect(useAppStore.getState().activeTextId).toBe("text");
        expect(useAppStore.getState().activeModeId).toBe(modeId);
        expect(useAppStore.getState().screen).toBe(enabled ? "params" : "home");
      });
    }
  }
});
