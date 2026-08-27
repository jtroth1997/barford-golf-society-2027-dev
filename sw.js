const CACHE="barford-golf-2027-offline-v33";
const ESSENTIALS=["./","./index.html","./scoring.html","./hole-view.html","./assets/js/scoring.js","./assets/js/scoring-resilience.js","./assets/js/course-view.js","./assets/js/course-view-guided-setup.js","./assets/js/supabase-config.js","./assets/js/supabase-client.js","./assets/css/styles.css","./assets/css/scoring.css","./assets/css/scoring-simple.css","./assets/css/score-competitions.css"];
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
    const update=fetch(event.request,{cache:"no-store"}).then(fresh=>{if(fresh.ok)cache.put(event.request,fresh.clone());return fresh;});
    if(isPage){try{return await update}catch{return cached||await cache.match("./index.html")||Response.error();}}
    if(cached){event.waitUntil(update.catch(()=>{}));return cached;}
    try{return await update}catch{return Response.error();}
  })());
});
