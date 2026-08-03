// Straxor Service Worker — runtime caching with offline shell fallback.
// Network-first for navigations (falls back to cached shell offline),
// stale-while-revalidate for static assets, network-only for /api/*.

// Bump this version on every deploy that changes the app shell so stale
// browser caches are flushed automatically (old caches deleted on activate).
const CACHE = "straxor-shell-v3";

const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
  "/vite.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // API calls: never cache, never serve stale.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, offline fallback to cached app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // On successful deploy, purge stale asset caches so the new
          // index.html (with new hashed asset references) doesn't try
          // to load JS/CSS bundles that no longer exist on the server.
          const copy = response.clone();
          caches.open(CACHE).then(async (cache) => {
            await cache.put("/index.html", copy);
            // Parse the new HTML to find fresh asset URLs and purge old ones.
            try {
              const html = await copy.text();
              const freshAssets = new Set<string>();
              const jsMatch = html.match(/src="([^"]*\.js)"/g);
              const cssMatch = html.match(/href="([^"]*\.css)"/g);
              [...(jsMatch || []), ...(cssMatch || [])].forEach((m) => {
                const url = m.replace(/^(src|href)="|"$/g, "");
                freshAssets.add(url);
              });
              // Remove cached assets that are NOT in the new HTML.
              const keys = await caches.keys();
              for (const k of keys) {
                if (k === CACHE) continue;
                const kCache = await caches.open(k);
                const reqs = await kCache.keys();
                for (const req of reqs) {
                  const path = new URL(req.url).pathname;
                  if (
                    path.startsWith("/assets/") &&
                    !freshAssets.has(path)
                  ) {
                    await kCache.delete(req);
                  }
                }
              }
            } catch {
              // Parsing failed — non-critical, stale assets will 404
              // and browser will load from network anyway.
            }
          });
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then((r) => r || caches.match("/"))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
