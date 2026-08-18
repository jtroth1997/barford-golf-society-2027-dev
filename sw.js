const CACHE="barford-golf-2027-no-test-v14";
const CORE=[
  "./","./index.html","./scoring.html",
  "./assets/css/styles.css","./assets/css/members.css","./assets/css/accessible-mobile.css","./assets/css/product-premium.css","./assets/css/product-polish.css","./assets/css/product-polish-mobile.css","./assets/css/brilliant.css","./assets/css/mobile-redesign.css","./assets/css/scoring.css","./assets/css/scoring-simple.css","./assets/css/score-competitions.css",
  "./assets/js/app.js","./assets/js/product-experience.js","./assets/js/admin-scorecard-preview.js","./assets/js/scoring.js","./assets/js/scoring-resilience.js","./assets/js/supabase-config.js","./assets/js/supabase-client.js",
  "./assets/images/barford-golf-society-logo.png"
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("barford-golf-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
const network=async(cache,request)=>{try{const response=await fetch(request);if(response?.ok)await cache.put(request,response.clone());return response}catch{return null}};
const networkFirst=async(cache,request,fallback)=>{const response=await network(cache,request);if(response)return response;return (await cache.match(request,{ignoreSearch:true}))||(fallback?await cache.match(fallback):null)||Response.error()};
self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET")return;
  const url=new URL(request.url),path=url.pathname;
  const isAdminPage=/\/admin\.html$/.test(path);
  const isFreshUiAsset=/\/assets\/js\/(app|product-experience|admin-auth|admin-scoring|admin-scorecard-preview|admin-brilliant|event-course-setup|test-event-controls)\.js$/.test(path)||/\/assets\/css\/mobile-redesign\.css$/.test(path);
  if(request.mode==="navigate"){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);if(isAdminPage)return networkFirst(cache,request,"./index.html");const cached=await cache.match(request,{ignoreSearch:true});const fresh=network(cache,request);if(cached){event.waitUntil(fresh);return cached}return(await fresh)||cache.match("./index.html")})());return;
  }
  if(url.origin===self.location.origin||url.hostname==="cdn.jsdelivr.net"){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);if(isFreshUiAsset)return networkFirst(cache,request);const cached=await cache.match(request,{ignoreSearch:true});if(cached){event.waitUntil(network(cache,request));return cached}return(await network(cache,request))||Response.error()})());
  }
});