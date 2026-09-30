import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/api", () => ({ getApiToken: () => "tok123" }));
vi.mock("@/core/db", () => ({ getDb: vi.fn(), topics: { getFile: vi.fn() } }));

import { useTopicFile } from "./useTopicFile";

let root = null;
let container = null;
let latest = null;

function Host({ path }) {
  latest = useTopicFile("my_people", path);
  return null;
}

async function mount(path) {
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => { root.render(<Host path={path} />); });
}

describe("useTopicFile", () => {
  afterEach(() => {
    act(() => root?.unmount());
    vi.unstubAllGlobals();
    latest = null;
  });

  it("fetches stored account photos with the bearer token instead of a bare URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) });
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:photo");
    URL.revokeObjectURL = vi.fn();

    await mount("/api/photos/abc");
    await act(async () => { await Promise.resolve(); });

    expect(fetchMock).toHaveBeenCalledWith("/api/photos/abc", { headers: { Authorization: "Bearer tok123" } });
    expect(latest).toBe("blob:photo");
  });

  it("passes local data URLs through unchanged", async () => {
    await mount("data:image/jpeg;base64,AAA");
    expect(latest).toBe("data:image/jpeg;base64,AAA");
  });
});
