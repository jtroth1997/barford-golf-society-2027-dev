const CACHE="barford-golf-2027-offline-v45";
const ESSENTIALS=["./","./index.html","./events.html","./payments.html","./scores.html","./gallery.html","./about.html","./account.html","./admin.html","./signup.html","./scoring.html","./hole-view.html","./manifest.webmanifest","./assets/images/barford-golf-society-logo.png","./assets/images/barford-golf-society-logo-320.webp","./assets/js/app.js","./assets/js/offline-register.js","./assets/js/events-live.js","./assets/js/member-dashboard.js","./assets/js/payments-hub.js","./assets/js/scores.js","./assets/js/scores-data.js","./assets/js/member-auth.js","./assets/js/scoring.js","./assets/js/scoring-resilience.js","./assets/js/offline-course-view.js","./assets/js/course-view.js","./assets/js/course-view-guided-setup.js","./assets/js/supabase-config.js","./assets/js/supabase-client.js","./assets/css/styles.css","./assets/css/deep-teal-theme.css","./assets/css/matchday-redesign.css","./assets/css/hole-view-light.css","./assets/css/scoring.css","./assets/css/scoring-simple.css","./assets/css/score-competitions.css","https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(ESSENTIALS.map(url=>cache.add(new Request(url,{cache:"reload"}))))).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin&&url.hostname!=="cdn.jsdelivr.net")return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const isPage=event.request.mode==="navigate";
    const cached=await cache.match(event.request,{ignoreSearch:!isPage});
    const update=fetch(event.request,{cache:"no-store"}).then(fresh=>{if(fresh.ok&&fresh.type!=="opaque")cache.put(event.request,fresh.clone());return fresh;});
    if(isPage){try{return await update}catch{return cached||await cache.match("./index.html")||Response.error();}}
    if(cached){event.waitUntil(update.catch(()=>{}));return cached;}
    try{return await update}catch{return Response.error();}
  })());
});
