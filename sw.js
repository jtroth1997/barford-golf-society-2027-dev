const CACHE = "barford-golf-2027-speed-v39";
const CORE = [
  "./",
  "./index.html",
  "./events.html",
  "./payments.html",
  "./scores.html",
  "./account.html",
  "./gallery.html",
  "./signup.html",
  "./admin.html",
  "./about.html",
  "./shop.html",
  "./worldevents.html",
  "./assets/css/styles.css?v=live1",
  "./assets/css/styles.css?v=homephotos1",
  "./assets/css/styles.css?v=homephotos2",
  "./assets/css/styles.css?v=homephotos3",
  "./assets/css/styles.css?v=homephotos4",
  "./assets/css/styles.css?v=homephotos5",
  "./assets/css/styles.css?v=homephotos6",
  "./assets/css/styles.css?v=homephotos7",
  "./assets/css/styles.css?v=ux100",
  "./assets/css/styles.css?v=publiclogo1",
  "./assets/css/members.css?v=rsvp1",
  "./assets/css/members.css?v=teeclick2",
  "./assets/css/members.css?v=account5",
  "./assets/css/members.css?v=cancel1",
  "./assets/css/members.css?v=homefit1",
  "./assets/css/members.css?v=homefit2",
  "./assets/css/members.css?v=ux100",
  "./assets/css/accessible-mobile.css?v=mobile6",
  "./assets/css/accessible-mobile.css?v=homefit1",
  "./assets/css/accessible-mobile.css?v=homefit2",
  "./assets/css/accessible-mobile.css?v=ux100",
  "./assets/css/events.css?v=video1",
  "./assets/css/events.css?v=rsvpmanage1",
  "./assets/css/scores.css?v=league6",
  "./assets/css/gallery.css?v=swipe1",
  "./assets/css/admin.css?v=eventround1",
  "./assets/css/admin.css?v=adminsimple1",
  "./assets/js/app.js?v=profilephoto2",
  "./assets/js/member-dashboard.js?v=rsvp1",
  "./assets/js/member-dashboard.js?v=teeclick2",
  "./assets/js/member-dashboard.js?v=cancel1",
  "./assets/js/member-auth.js?v=account5",
  "./assets/js/member-auth.js?v=ux100",
  "./assets/js/admin-auth.js?v=controls4",
  "./assets/js/admin-auth.js?v=eventround1",
  "./assets/js/admin-auth.js?v=adminsimple1",
  "./assets/js/admin-auth.js?v=adminsimple2",
  "./assets/js/admin-auth.js?v=adminsimple3",
  "./assets/js/admin-auth.js?v=adminsimple4",
  "./assets/js/events-live.js?v=video1",
  "./assets/js/events-live.js?v=rsvpmanage1",
  "./assets/js/scores.js?v=league6",
  "./assets/js/scores-data.js?v=overview1",
  "./assets/js/handicap-engine.js",
  "./assets/js/gallery-live.js?v=swipe1",
  "./assets/js/home-photos.js?v=1",
  "./assets/js/home-photos.js?v=2",
  "./assets/js/home-photos.js?v=3",
  "./assets/js/home-photos.js?v=4",
  "./assets/js/home-photos.js?v=5",
  "./assets/js/accessible-mobile.js?v=mobile6",
  "./assets/js/accessible-mobile.js?v=ux100",
  "./assets/js/supabase-config.js?v=live1",
  "./assets/js/supabase-client.js?v=live1",
  "./assets/js/supabase-client.js?v=ux100",
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
      fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match("./index.html")))
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
