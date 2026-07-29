const CACHE_NAME = "barford-golf-mobile-v3";
const CORE = [
  "./","./index.html","./events.html","./scores.html","./gallery.html","./account.html","./worldevents.html","./shop.html","./about.html","./admin.html","./signup.html","./payment-beta.html",
  "./assets/css/styles.css?v=fast3","./assets/css/accessible-mobile.css?v=mobile3","./assets/css/events.css","./assets/css/tee-organiser.css","./assets/css/scores.css?v=7","./assets/css/mobile-menu-fix.css?v=1","./assets/css/members.css","./assets/css/gallery.css","./assets/css/admin.css","./assets/css/payment-beta.css?v=3","./assets/css/payment-beta-shared.css?v=beta4",
  "./assets/js/app.js?v=mobile3","./assets/js/accessible-mobile.js?v=mobile3","./assets/js/member-session.js","./assets/js/event-countdown.js","./assets/js/event-weather.js","./assets/js/event-camera.js","./assets/js/admin.js","./assets/js/scores.js?v=7","./assets/js/scores-data.js","./assets/js/handicap-engine.js","./assets/js/payment-beta.js?v=4","./assets/js/payment-beta-shared.js?v=beta11",
  "./assets/images/barford-golf-society-logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(CORE.map(url => cache.add(url)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.registration.navigationPreload?.enable()
  ]).then(() => self.clients.claim()));
});

const store = async (request, response) => {
  if (response?.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const canonical = new Request(`${url.origin}${url.pathname}`, { credentials:"same-origin" });
    const cachedPromise = caches.match(canonical, { ignoreSearch:true });
    const networkPromise = (event.preloadResponse || Promise.resolve(null))
      .then(preloaded => preloaded || fetch(request))
      .then(response => store(canonical, response));
    event.respondWith(cachedPromise.then(cached => cached || networkPromise).catch(() => caches.match("./index.html")));
    event.waitUntil(networkPromise.catch(() => undefined));
    return;
  }

  event.respondWith(caches.match(request, { ignoreSearch:false }).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => store(request, response));
  }));
});
