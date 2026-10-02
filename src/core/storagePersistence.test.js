import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStoragePersistenceStatus,
  requestStoragePersistence,
  STORAGE_PERSISTENCE_EVENT,
} from "./storagePersistence";

const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");

function setStorage(storage) {
  Object.defineProperty(navigator, "storage", { configurable: true, value: storage });
}

describe("storage persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    if (originalStorage) Object.defineProperty(navigator, "storage", originalStorage);
    else delete navigator.storage;
    vi.restoreAllMocks();
  });

  it("reports unsupported browsers without blocking a save", async () => {
    setStorage(undefined);
    expect(await getStoragePersistenceStatus()).toBe("unsupported");
    expect(await requestStoragePersistence()).toBe("unsupported");
  });

  it("checks whether the whole origin is already persistent", async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist: vi.fn() });
    expect(await getStoragePersistenceStatus()).toBe("granted");
  });

  it("starts the request synchronously with the user gesture and announces a grant", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    setStorage({ persist });
    const onChange = vi.fn();
    window.addEventListener(STORAGE_PERSISTENCE_EVENT, onChange);

    const result = requestStoragePersistence();
    expect(persist).toHaveBeenCalledOnce();
    expect(await result).toBe("granted");
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].detail).toBe("granted");

    window.removeEventListener(STORAGE_PERSISTENCE_EVENT, onChange);
  });

  it("does not repeatedly prompt after a denial, but allows a manual retry", async () => {
    const persist = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    setStorage({ persist });

    expect(await requestStoragePersistence()).toBe("not_granted");
    expect(await requestStoragePersistence()).toBe("not_granted");
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await requestStoragePersistence({ force: true })).toBe("granted");
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("deduplicates simultaneous requests and treats an API failure as nonfatal", async () => {
    let rejectRequest;
    const persist = vi.fn().mockImplementation(() => new Promise((_, reject) => { rejectRequest = reject; }));
    setStorage({ persist });

    const first = requestStoragePersistence();
    const second = requestStoragePersistence();
    expect(persist).toHaveBeenCalledTimes(1);
    rejectRequest(new Error("browser denied access"));
    expect(await first).toBe("error");
    expect(await second).toBe("error");
  });
});
