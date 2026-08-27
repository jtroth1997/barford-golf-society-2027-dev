const CACHE="barford-golf-2027-offline-v32";
const ESSENTIALS=["./","./index.html","./events.html","./scores.html","./gallery.html","./account.html","./payments.html","./scoring.html","./admin.html","./hole-view.html","./scorecard.html","./assets/js/course-view.js","./assets/js/course-view-guided-setup.js","./assets/js/supabase-config.js","./assets/js/supabase-client.js"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(ESSENTIALS.map(url=>cache.add(new Request(url,{cache:"reload"}))))).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin&&url.hostname!=="cdn.jsdelivr.net")return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const fresh=await fetch(event.request,{cache:"no-store"});
      if(fresh.ok)cache.put(event.request,fresh.clone());
      return fresh;
    }catch{
      return (await cache.match(event.request))||(event.request.mode==="navigate"?await cache.match("./index.html"):null)||Response.error();
    }
  })());
});