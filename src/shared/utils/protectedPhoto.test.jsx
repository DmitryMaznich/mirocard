import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { setApiToken } from "@/core/api";
import {
  isProtectedPhotoUrl, loadProtectedPhoto, clearProtectedPhotoCache, useResolvedProtectedPhotos,
} from "./protectedPhoto";
import AuthenticatedImage from "@/shared/components/AuthenticatedImage";
import { useTopicFile } from "@/shared/hooks/useTopicFile";

const PHOTO = "/api/photos/0123456789abcdef0123456789abcdef";
const PHOTO2 = "/api/photos/fedcba9876543210fedcba9876543210";

let fetchMock;
let objectUrlSeq = 0;

beforeEach(() => {
  clearProtectedPhotoCache();
  objectUrlSeq = 0;
  fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["x"], { type: "image/webp" }) }));
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => `blob:test-${++objectUrlSeq}`);
  URL.revokeObjectURL = vi.fn();
  setApiToken("token-A");
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete window.__Mirocard?.getApiToken;
});

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

function mount(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe("protected user photos", () => {
  it("recognises only /api/photos/<hash> URLs", () => {
    expect(isProtectedPhotoUrl(PHOTO)).toBe(true);
    expect(isProtectedPhotoUrl(`https://app.mironium.com${PHOTO}`)).toBe(true);
    expect(isProtectedPhotoUrl("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isProtectedPhotoUrl("/zone-media/fridge.webp")).toBe(false);
    expect(isProtectedPhotoUrl(null)).toBe(false);
  });

  it("fetches with the Bearer token and caches per account", async () => {
    const a = await loadProtectedPhoto(PHOTO);
    const b = await loadProtectedPhoto(PHOTO);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-A");

    setApiToken("token-B"); // another account on the same device
    await loadProtectedPhoto(PHOTO);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer token-B");
  });

  it("uses the app token exposed on window.__Mirocard (deck-ZIP renderers bundle their own api copy)", async () => {
    setApiToken(null);
    window.__Mirocard = { ...(window.__Mirocard ?? {}), getApiToken: () => "token-from-app" };
    await loadProtectedPhoto(PHOTO2);
    expect(fetchMock.mock.calls.at(-1)[1].headers.Authorization).toBe("Bearer token-from-app");
  });

  it("a failed load is retried next time, not cached", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(loadProtectedPhoto(PHOTO)).rejects.toThrow("HTTP 401");
    await flush();
    await loadProtectedPhoto(PHOTO);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("AuthenticatedImage renders the blob URL, never the bare protected URL", async () => {
    const { container, unmount } = mount(<AuthenticatedImage src={PHOTO} alt="Мама" className="x" />);
    expect(container.querySelector("img")).toBeNull();
    await flush();
    expect(container.querySelector("img").getAttribute("src")).toMatch(/^blob:test-/);
    unmount();
    const { container: c2, unmount: u2 } = mount(<AuthenticatedImage src="data:image/png;base64,AAAA" />);
    expect(c2.querySelector("img").getAttribute("src")).toBe("data:image/png;base64,AAAA");
    u2();
  });

  it("useTopicFile resolves a protected photo path (\"Мои люди\" tasks) with auth", async () => {
    let seen = "unset";
    function Probe() { seen = useTopicFile("my_people", PHOTO); return null; }
    const { unmount } = mount(<Probe />);
    await flush();
    expect(seen).toMatch(/^blob:test-/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-A");
    unmount();
  });

  it("useResolvedProtectedPhotos rewrites nested photo URLs for renderers and keeps identity when there are none", async () => {
    const student = { id: "s", photo: PHOTO, closeAdults: [{ id: "m", photo: PHOTO2 }, { id: "d", photo: null }] };
    const plain = { id: "t", words: ["a"] };
    let out;
    let outPlain;
    function Probe() {
      out = useResolvedProtectedPhotos(student);
      outPlain = useResolvedProtectedPhotos(plain);
      return null;
    }
    const { unmount } = mount(<Probe />);
    expect(out.photo).toBeNull(); // not yet loaded: never the bare URL
    await flush();
    expect(out.photo).toMatch(/^blob:test-/);
    expect(out.closeAdults[0].photo).toMatch(/^blob:test-/);
    expect(out.closeAdults[1].photo).toBeNull();
    expect(student.photo).toBe(PHOTO); // input not mutated
    expect(outPlain).toBe(plain);
    unmount();
  });
});
