const body=document.body;
body.classList.add("product-premium");

[
  ["assets/css/product-premium.css?v=3","productPremium"],
  ["assets/css/product-polish.css?v=2","productPolish"],
  ["assets/css/product-polish-mobile.css?v=3","productPolishMobile"],
  ["assets/css/brilliant.css?v=2","brilliantProduct"]
].forEach(([href,key])=>{
  const attr=`data-${key.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}`;
  if(document.querySelector(`link[${attr}]`))return;
  const link=document.createElement("link");link.rel="stylesheet";link.href=href;link.dataset[key]="1";document.head.appendChild(link);
});

if(document.getElementById("dashboardEventCamera")){
  const style=document.createElement("style");
  style.textContent='.dashboard-event-tools{display:flex;align-items:center;gap:8px;flex:0 0 auto}.event-camera-button{display:inline-flex;align-items:center;gap:7px;min-height:48px;padding:9px 13px;border:2px solid #c6a44c;border-radius:14px;background:#fff8df;color:#063d2a;font:inherit;font-weight:900;cursor:pointer}.event-camera-button span{font-size:1.25rem;line-height:1}.event-camera-button.is-uploading{opacity:.65;pointer-events:none}.event-camera-button.is-done{border-color:#78b48e;background:#e7f6ee}@media(max-width:650px){.dashboard-event-title-line{align-items:flex-start;gap:9px}.dashboard-event-tools{gap:6px}.event-camera-button{width:48px;height:48px;padding:0;justify-content:center}.event-camera-button strong{display:none}.event-camera-button span{font-size:1.35rem}.event-scorecard-cta{min-height:48px;padding:9px 11px}.event-scorecard-cta strong{font-size:.78rem;white-space:normal;line-height:1.15}}';
  document.head.appendChild(style);
}

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    const register=()=>navigator.serviceWorker.register("./sw.js?v=fast9").catch(()=>{});
    if("requestIdleCallback" in window)requestIdleCallback(register,{timeout:1400});else setTimeout(register,250);
  },{once:true});
}

document.querySelectorAll(".menu-button").forEach(menuButton=>{
  const navigationId=menuButton.getAttribute("aria-controls");
  const navigation=navigationId?document.getElementById(navigationId):menuButton.closest(".site-header")?.querySelector(".site-nav");
  if(!navigation)return;
  const closeMenu=()=>{navigation.classList.remove("is-open");menuButton.setAttribute("aria-expanded","false");body.classList.remove("mobile-menu-open")};
  menuButton.addEventListener("click",event=>{event.stopPropagation();const open=navigation.classList.toggle("is-open");menuButton.setAttribute("aria-expanded",String(open));body.classList.toggle("mobile-menu-open",open)});
  navigation.querySelectorAll("a").forEach(link=>link.addEventListener("click",closeMenu));
  document.addEventListener("click",event=>{if(!navigation.contains(event.target)&&!menuButton.contains(event.target))closeMenu()});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeMenu();menuButton.focus()}});
});

const year=document.querySelector("#year");if(year)year.textContent=new Date().getFullYear();
const installBtn=document.querySelector("#installHelpBtn"),installHelp=document.querySelector("#installHelp");
if(installBtn&&installHelp)installBtn.addEventListener("click",()=>{installHelp.classList.toggle("hidden");installBtn.textContent=installHelp.classList.contains("hidden")?"Show instructions":"Hide instructions"});

const currentPage=location.pathname.split("/").pop()||"index.html";

// Test Event is a core Admin action. Keep an always-visible entry in the normal Admin screen
// so it does not depend on optional enhancement scripts or cached Season Setup UI.
if(currentPage==="admin.html"){
  const dashboard=document.getElementById("adminDashboard");
  const toolbar=dashboard?.querySelector(".admin-toolbar");
  if(toolbar&&!document.getElementById("adminDirectTestEvent")){
    const link=document.createElement("a");
    link.id="adminDirectTestEvent";
    link.href="test-event.html";
    link.textContent="Test Event";
    link.className="button button-primary admin-direct-test-event";
    link.setAttribute("aria-label","Open Test Event controls");
    toolbar.appendChild(link);
    const style=document.createElement("style");
    style.textContent='.admin-direct-test-event{min-height:50px;display:inline-flex;align-items:center;justify-content:center;background:#a83931!important;border-color:#a83931!important;color:#fff!important;font-weight:950!important}@media(max-width:720px){#adminDashboard .admin-toolbar{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}#adminDashboard .admin-toolbar>div{grid-column:1/-1}.admin-direct-test-event,#adminSignOut{width:100%;min-height:52px}}';
    document.head.appendChild(style);
  }
}

if(currentPage==="admin.html"&&window.fetch){
  const nativeFetch=window.fetch.bind(window),queued=new Set();
  const flush=group=>[...queued].filter(item=>item.group===group).forEach(item=>item.run());
  window.fetch=(input,init)=>{
    let url;try{url=new URL(typeof input==="string"?input:input.url,location.href);}catch{return nativeFetch(input,init);}
    const dashboard=document.getElementById("adminDashboard");
    if(!url.hostname.includes("supabase.co")||dashboard?.classList.contains("hidden"))return nativeFetch(input,init);
    const table=(url.pathname.split("/rest/v1/")[1]||"").split("?")[0];
    const select=decodeURIComponent(url.searchParams.get("select")||"");
    let group="";
    if(table==="gallery_photos")group="gallery";
    else if(table==="products"||table==="world_events"||table==="world_event_votes")group="content";
    else if(table==="profiles"&&select.includes("email")&&select.includes("phone"))group="members";
    if(!group)return nativeFetch(input,init);
    return new Promise((resolve,reject)=>{
      let done=false,timer;
      const item={group,run:()=>{if(done)return;done=true;clearTimeout(timer);queued.delete(item);nativeFetch(input,init).then(resolve,reject)}};
      queued.add(item);timer=setTimeout(item.run,1800);
    });
  };
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-admin-view]");if(!button)return;
    const map={gallery:"gallery",content:"content",members:"members"};
    if(map[button.dataset.adminView])flush(map[button.dataset.adminView]);
  },{passive:true});
}

const mobileNav=document.createElement("nav");
mobileNav.className="mobile-quick-nav";mobileNav.setAttribute("aria-label","Quick navigation");
const quickItems=[["index.html","🏠","Home"],["events.html","📅","Events"],["scores.html","🏆","League"],["gallery.html","📷","Photos"],["account.html","👤","Account"]];
mobileNav.innerHTML=quickItems.map(([href,icon,label])=>`<a href="${href}" class="${currentPage===href?"active":""}"${currentPage===href?' aria-current="page"':""}><span class="quick-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join("");
body.appendChild(mobileNav);

const initialiseSharedUi=()=>{
  const dialog=document.createElement("dialog");dialog.className="profile-photo-lightbox";dialog.setAttribute("aria-label","Profile photo");
  dialog.innerHTML='<form method="dialog"><button class="profile-photo-lightbox-close" value="cancel" aria-label="Close profile photo">×</button><img alt="Enlarged profile photo"><a class="button button-primary profile-photo-change hidden" href="account.html#profile-photo">Change profile picture</a><button class="button button-outline" value="cancel">Close</button></form>';document.body.append(dialog);
  const openPhoto=element=>{const source=element?.dataset?.profilePhoto||element?.querySelector?.("img")?.src;if(!source){location.href="account.html#profile-photo";return}dialog.querySelector("img").src=source;dialog.querySelector(".profile-photo-change")?.classList.toggle("hidden",element.dataset.profileOwner!=="self");dialog.showModal()};
  document.addEventListener("click",event=>{const target=event.target.closest('[data-profile-photo], [data-profile-owner="self"]');if(target)openPhoto(target)});
  document.addEventListener("profile-photo:open",event=>openPhoto(event.target));
  document.addEventListener("keydown",event=>{if((event.key==="Enter"||event.key===" ")&&event.target.matches('[data-profile-photo], [data-profile-owner="self"]')){event.preventDefault();openPhoto(event.target)}});
  if(document.getElementById("dashboardEventCamera")){const script=document.createElement("script");script.src="assets/js/event-day-camera.js?v=3";script.async=true;document.body.appendChild(script);}
  if(!document.querySelector('script[data-product-experience]')){const script=document.createElement("script");script.src="assets/js/product-experience.js?v=3";script.async=true;script.dataset.productExperience="1";document.body.appendChild(script);}
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialiseSharedUi,{once:true});else initialiseSharedUi();

const loadEnhancement=(src,key,done)=>{
  if(document.querySelector(`script[data-${key}]`)){done?.();return;}
  const script=document.createElement("script");script.src=src;script.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]="1";script.onload=()=>done?.();document.body.appendChild(script);
};
window.addEventListener("load",()=>{
  if(currentPage==="admin.html"){
    loadEnhancement("assets/js/test-event-controls.js?v=2","test-event-controls");
    loadEnhancement("assets/js/event-course-setup.js?v=2","event-course-setup",()=>loadEnhancement("assets/js/admin-brilliant.js?v=2","admin-brilliant"));
  } else if(currentPage==="index.html") {
    loadEnhancement("assets/js/member-experience-plus.js?v=2","member-experience-plus");
  } else if(currentPage==="account.html") {
    loadEnhancement("assets/js/member-onboarding.js?v=1","member-onboarding");
  }
},{once:true});