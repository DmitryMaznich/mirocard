import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApiClient } from "./api";

describe("createApiClient", () => {
  let fetchMock;
  let api;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    api = createApiClient({ baseUrl: "http://localhost:3012", token: "test-token" });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it("GET sends Authorization header", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    await api.get("/account/bootstrap");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3012/account/bootstrap",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  it("POST sends JSON body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accepted: true }),
    });
    await api.post("/sync", { operations: [] });
    const call = fetchMock.mock.calls[0];
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body)).toEqual({ operations: [] });
  });

  it("throws ApiError on non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });
    await expect(api.get("/account/bootstrap")).rejects.toThrow("Unauthorized");
  });

  it("no token = no Authorization header", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const anonApi = createApiClient({ baseUrl: "http://localhost:3012", token: null });
    await anonApi.post("/auth/login", {});
    const call = fetchMock.mock.calls[0];
    expect(call[1].headers?.Authorization).toBeUndefined();
  });
});
