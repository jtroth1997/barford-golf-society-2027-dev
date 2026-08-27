const CACHE="barford-golf-2027-offline-v31";
const OFFLINE_FALLBACK="./index.html";
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.add(new Request(OFFLINE_FALLBACK,{cache:"reload"}))).then(()=>self.skipWaiting())));
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
      return (await cache.match(event.request))||(event.request.mode==="navigate"?await cache.match(OFFLINE_FALLBACK):null)||Response.error();
    }
  })());
});