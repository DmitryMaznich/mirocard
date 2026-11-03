// A small bridge for topic renderers that keep their own documents in the
// account (e.g. «Печатные буквы» notebooks). A renderer shipped as a deck ZIP
// has its own copy of every module it imports, so it cannot reach the app's
// api/sync state itself — SessionScreen passes this object as the
// `accountKv` prop instead.
//   list(prefix)   → [{ key, value }] the account's documents under prefix
//                    (throws when offline or signed out — keep working locally)
//   put(key, value)→ queued write (`kv.upsert`, the app's offline queue);
//                    last write wins per key on the server
// Keys should start with the topic id, e.g. `print_letters:nb:<id>`.
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";

export const accountKv = {
  async list(prefix) {
    const res = await api.get(`/account/kv?prefix=${encodeURIComponent(prefix)}`);
    return Array.isArray(res?.kv) ? res.kv : [];
  },
  put(key, value) {
    return pushOp("kv.upsert", { key, value });
  },
};
