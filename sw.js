const CACHE = "barford-golf-2027-speed-v4";
const CORE = [
  "./",
  "./index.html",
  "./events.html",
  "./scores.html",
  "./account.html",
  "./gallery.html",
  "./signup.html",
  "./admin.html",
  "./about.html",
  "./shop.html",
  "./worldevents.html",
  "./assets/css/styles.css?v=live1",
  "./assets/css/members.css?v=rsvp1",
  "./assets/css/members.css?v=account5",
  "./assets/css/accessible-mobile.css?v=mobile4",
  "./assets/css/events.css",
  "./assets/css/scores.css?v=7",
  "./assets/css/gallery.css",
  "./assets/css/admin.css?v=controls1",
  "./assets/js/app.js?v=speed2",
  "./assets/js/member-dashboard.js?v=rsvp1",
  "./assets/js/member-auth.js?v=account5",
  "./assets/js/accessible-mobile.js?v=mobile4",
  "./assets/js/supabase-config.js?v=live1",
  "./assets/js/supabase-client.js?v=live1",
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
      caches.match(request, { ignoreSearch: true }).then(cached => {
        const refresh = fetch(request).then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        });
        if (cached) {
          event.waitUntil(refresh.catch(() => undefined));
          return cached;
        }
        return refresh.catch(() => caches.match("./index.html"));
      })
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
