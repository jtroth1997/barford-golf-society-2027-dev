const CACHE = "barford-golf-2027-live-first-v25";
const OFFLINE_PAGES = [
  "./", "./index.html", "./events.html", "./scores.html", "./gallery.html",
  "./account.html", "./payments.html", "./scoring.html", "./admin.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(OFFLINE_PAGES.map(url => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const fetchFresh = async (cache, request) => {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return null;
  }
};

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const fresh = await fetchFresh(cache, request);
      if (fresh) return fresh;
      return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
    })());
    return;
  }

  if (url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) {
        event.waitUntil(fetchFresh(cache, request));
        return cached;
      }
      return (await fetchFresh(cache, request)) || Response.error();
    })());
  }
});
