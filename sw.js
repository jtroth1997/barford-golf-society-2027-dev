const CACHE="barford-golf-2027-fast-v5";
const CORE=[
  "./",
  "./index.html",
  "./assets/css/styles.css",
  "./assets/css/members.css",
  "./assets/css/accessible-mobile.css",
  "./assets/css/product-premium.css",
  "./assets/css/product-polish.css",
  "./assets/css/product-polish-mobile.css",
  "./assets/js/app.js",
  "./assets/js/product-experience.js",
  "./assets/js/supabase-config.js",
  "./assets/js/supabase-client.js",
  "./assets/images/barford-golf-society-logo.png"
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("barford-golf-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
const updateCache=async(cache,request)=>{try{const response=await fetch(request);if(response?.ok)await cache.put(request,response.clone());return response}catch{return null}};
self.addEventListener("fetch",event=>{const request=event.request;if(request.method!=="GET")return;const url=new URL(request.url);if(request.mode==="navigate"){event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(request,{ignoreSearch:true});const network=updateCache(cache,request);if(cached){event.waitUntil(network);return cached}return(await network)||cache.match("./index.html")})());return}if(url.origin===self.location.origin||url.hostname==="cdn.jsdelivr.net"){event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(request,{ignoreSearch:true});if(cached){event.waitUntil(updateCache(cache,request));return cached}return(await updateCache(cache,request))||Response.error()})())}});
