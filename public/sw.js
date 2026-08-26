const CACHE = "mirocard2-v22";
// Build 1.0.1995. Keep the runtime cache stable between releases: changing
// this worker makes the browser check for an update without repeatedly
// throwing away the cache an installed PWA is currently using.

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
      fetch(new Request(e.request, { cache: "no-store" }))
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
    fetch(new Request(e.request, { cache: "no-store" }))
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
