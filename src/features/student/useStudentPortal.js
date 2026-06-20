import { useState, useEffect } from "react";
import { createApiClient } from "@/core/api";

export function useStudentPortal(token) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", data: null, error: "no_token" });
      return;
    }
    const client = createApiClient({ token });
    let cancelled = false;
    client.get("/student/me")
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          const reason = err?.status === 401 ? "revoked" : "network";
          setState({ status: "error", data: null, error: reason });
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  return state;
}
