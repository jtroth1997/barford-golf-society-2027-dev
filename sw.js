const CACHE = "barford-golf-2027-speed-v1";
const CORE = [
  "./",
  "./index.html",
  "./events.html",
  "./scores.html",
  "./account.html",
  "./assets/css/styles.css?v=live1",
  "./assets/css/members.css?v=dashboard4",
  "./assets/css/accessible-mobile.css?v=mobile4",
  "./assets/js/app.js?v=speed1",
  "./assets/js/member-dashboard.js?v=speed1",
  "./assets/js/accessible-mobile.js?v=mobile4",
  "./assets/images/barford-golf-society-logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("barford-golf-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  if (url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        });
      })
    );
  }
});
