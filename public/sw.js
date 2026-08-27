const CACHE = "mirocard2-v23";
// Build 1.0.2004. Keep the runtime cache stable between releases: changing
// this worker makes the browser check for an update without repeatedly
// throwing away the cache an installed PWA is currently using.

// A cold app launch on a mobile device is the highest-risk moment for the
// very first network request to fail outright — the radio can still be
// waking from doze/idle even though connectivity is fine a moment later.
// Falling straight back to the cached app shell on any single failure means
// an Android PWA relaunched after being evicted from memory can get stuck
// showing whatever version happened to be cached last time a fetch
// succeeded — sometimes many releases behind — even though the network is
// actually fine. One retry after a short delay avoids treating a transient
// hiccup as if it were real offline use.
function fetchWithRetry(request, retries = 1, delayMs = 400) {
  return fetch(new Request(request, { cache: "no-store" })).catch((err) => {
    if (retries <= 0) throw err;
    return new Promise((resolve) => setTimeout(resolve, delayMs))
      .then(() => fetchWithRetry(request, retries - 1, delayMs));
  });
}

self.addEventListener("install", () => {
  // Stay in the waiting phase until the app explicitly applies the update.
  // Otherwise a background service-worker update can trigger controllerchange
  // and reload the app while the user is navigating or inside a session.
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Фото учеников — cache-first (контент-адресуемые, immutable)
  if (url.pathname.startsWith("/api/photos/")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const resp = await fetch(e.request);
        if (resp.ok) cache.put(e.request, resp.clone());
        return resp;
      })
    );
    return;
  }

  // API — всегда сеть, без кеша
  if (url.pathname.startsWith("/api/")) return;

  // ZIP-файлы тем — cache-first (оффлайн доступ после загрузки)
  if (url.pathname.startsWith("/decks/") && url.pathname.endsWith(".zip")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        // _refresh означает принудительное обновление: всегда с сети, обновляем кеш по чистому URL
        if (url.searchParams.has("_refresh")) {
          const resp = await fetch(e.request);
          if (resp.ok) {
            const cleanUrl = new URL(e.request.url);
            cleanUrl.search = "";
            await cache.put(cleanUrl.href, resp.clone());
          }
          return resp;
        }
        const cached = await cache.match(e.request, { ignoreSearch: false });
        if (cached) return cached;
        const resp = await fetch(e.request);
        if (resp.ok) cache.put(e.request, resp.clone());
        return resp;
      })
    );
    return;
  }

  if (e.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(
      fetchWithRetry(e.request)
        .then((resp) => {
          if (resp.ok) {
            const cloned = resp.clone();
            caches.open(CACHE).then((cache) => cache.put("/", cloned));
          }
          return resp;
        })
        // Only this worker's cache may be used as the offline fallback.  A
        // global caches.match could resurrect the app shell from an older
        // service-worker version after a brief network interruption.
        .catch(() => caches.open(CACHE).then((cache) => cache.match("/").then((resp) => resp || cache.match(e.request))))
    );
    return;
  }

  // App shell — network-first с fallback на кеш
  e.respondWith(
    fetchWithRetry(e.request)
      .then((resp) => {
        if (resp.ok && e.request.method === "GET") {
          const cloned = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, cloned));
        }
        return resp;
      })
      .catch(() => caches.open(CACHE).then((cache) => cache.match(e.request).then((resp) => resp || cache.match("/"))))
  );
});
