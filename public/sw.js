// ZF Operativa Service Worker for Mobile Widget
const CACHE_NAME = "zf-operativa-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache
          .addAll(STATIC_ASSETS)
          .catch((err) => console.warn("PWA Cache install warning:", err));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Intercept only our static pages and assets. Firebase, auth, and server
  // function requests must never receive a cached response.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === "navigate") {
            return caches.match("/").then((page) => page || Response.error());
          }
          return Response.error();
        });
      }),
  );
});
