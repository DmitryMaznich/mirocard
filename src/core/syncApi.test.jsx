import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import * as apiModule from "@/core/api";
import { pushOp, flushQueue, SYNC_REJECTED_EVENT } from "./syncApi";
import SyncRejectedNotice from "@/shared/components/SyncRejectedNotice";

describe("sync queue and server-rejected operations", () => {
  afterEach(() => vi.restoreAllMocks());

  it("drops a server-rejected op from the queue and announces it, so later ops are not blocked", async () => {
    const rejected = [{ type: "student.photo.upsert", code: "photo_count_quota", message: "Достигнут лимит фото: 12 на аккаунт." }];
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({ accepted: true, rejected });
    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener(SYNC_REJECTED_EVENT, listener);

    await pushOp("student.photo.upsert", { studentId: "s-rej", photo: "data:image/jpeg;base64,AAAA" });
    await flushQueue();
    window.removeEventListener(SYNC_REJECTED_EVENT, listener);

    expect(events.at(-1)).toEqual(rejected);
    post.mockClear();
    await flushQueue();
    expect(post).not.toHaveBeenCalled();
  });

  it("the notice shows the server's message and can be dismissed", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<SyncRejectedNotice />));
    expect(document.body.textContent).not.toContain("Фото не сохранено");

    act(() => {
      window.dispatchEvent(new CustomEvent(SYNC_REJECTED_EVENT, {
        detail: [{ code: "heic_unsupported", message: "Фото в формате HEIC пока не поддерживается." }],
      }));
    });
    expect(document.body.textContent).toContain("Фото не сохранено");
    expect(document.body.textContent).toContain("HEIC пока не поддерживается");

    const ok = Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent === "Понятно");
    act(() => ok.click());
    expect(document.body.textContent).not.toContain("Фото не сохранено");
    act(() => root.unmount());
    container.remove();
  });
});
