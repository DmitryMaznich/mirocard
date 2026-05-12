export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_API_URL ?? "/api")
  : "/api";

export function createApiClient({ baseUrl = BASE_URL, token = null, timeoutMs = 30000 } = {}) {
  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let message = res.statusText;
      try { message = (await res.json()).error || message; } catch {}
      throw new ApiError(message, res.status);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  return {
    get:    (path)        => request("GET",    path),
    post:   (path, body)  => request("POST",   path, body),
    patch:  (path, body)  => request("PATCH",  path, body),
    delete: (path)        => request("DELETE", path),
  };
}

// Singleton instance — updated when token changes
let _api = createApiClient();

export function setApiToken(token) {
  _api = createApiClient({ token });
}

export const api = {
  get:    (...args) => _api.get(...args),
  post:   (...args) => _api.post(...args),
  patch:  (...args) => _api.patch(...args),
  delete: (...args) => _api.delete(...args),
};
