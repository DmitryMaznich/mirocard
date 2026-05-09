import { api } from "@/core/api";

export async function pushOp(type, data) {
  try {
    await api.post("/sync", { operations: [{ type, data }] });
  } catch {
    // fire-and-forget — network errors are silently ignored
  }
}
