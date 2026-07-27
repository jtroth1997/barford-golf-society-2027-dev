const CACHE_NAME = "barford-golf-rapid-v9";
const CORE = [
  "./","./index.html","./payment-beta.html","./events.html","./scores.html","./gallery.html","./account.html","./worldevents.html","./shop.html","./about.html",
  "./assets/css/styles.css?v=fast3","./assets/css/payment-beta.css?v=2","./assets/css/payment-beta-shared.css?v=beta2","./assets/css/accessible-mobile.css?v=rapid1","./assets/css/events.css","./assets/css/scores.css?v=7","./assets/css/members.css","./assets/css/gallery.css",
  "./assets/js/app.js?v=rapid11","./assets/js/payment-beta.js?v=2","./assets/js/payment-beta-shared.js?v=beta7","./assets/js/accessible-mobile.js?v=rapid2","./assets/js/member-session.js","./assets/js/scores.js?v=7","./assets/js/scores-data.js","./assets/js/handicap-engine.js",
  "./assets/images/barford-golf-society-logo.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(CORE.map(url => cache.add(url)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(request, {ignoreSearch:false}).then(cached => {
    const fresh = fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
