(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const initials = name => String(name || "BG").split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0].toUpperCase()).join("");

  const ensureDialog = () => {
    let dialog = document.getElementById("eventRsvpRosterDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "eventRsvpRosterDialog";
    dialog.className = "member-rsvp-dialog event-players-dialog";
    dialog.innerHTML = `<div class="event-players-panel"><button class="dialog-close" type="button" aria-label="Close">×</button><p class="eyebrow">Who’s playing?</p><h2 id="eventRsvpRosterTitle">Players RSVP’d</h2><p id="eventRsvpRosterSummary"></p><div id="eventRsvpRosterList" class="event-players-list rsvp-roster-list"></div><button class="button button-primary" type="button" data-close-rsvp-roster>Close</button></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector(".dialog-close").addEventListener("click",()=>dialog.close());
    dialog.querySelector("[data-close-rsvp-roster]").addEventListener("click",()=>dialog.close());
    return dialog;
  };

  const fetchPlaying = async eventId => {
    const { data:rsvps, error } = await client.from("rsvps").select("member_id,guest_name").eq("event_id",eventId).eq("status","playing");
    if (error) throw error;
    const memberIds=[...new Set((rsvps||[]).map(r=>r.member_id).filter(Boolean))];
    let profiles=[];
    if(memberIds.length){
      const result=await client.from("profiles").select("id,full_name,photo_url").in("id",memberIds);
      if(result.error) throw result.error;
      profiles=result.data||[];
    }
    const byId=new Map(profiles.map(p=>[p.id,p]));
    return (rsvps||[]).map(r=>({...(byId.get(r.member_id)||{}),full_name:byId.get(r.member_id)?.full_name||r.guest_name||"Guest player"})).sort((a,b)=>a.full_name.localeCompare(b.full_name));
  };

  const openRoster = async (eventId,eventName,capacity) => {
    const dialog=ensureDialog(), list=dialog.querySelector("#eventRsvpRosterList");
    dialog.querySelector("#eventRsvpRosterTitle").textContent=eventName||"Players RSVP’d";
    dialog.querySelector("#eventRsvpRosterSummary").textContent="Loading players…";
    list.innerHTML="";
    dialog.showModal();
    try{
      const players=await fetchPlaying(eventId);
      dialog.querySelector("#eventRsvpRosterSummary").textContent=capacity?`${players.length} of ${capacity} places filled · ${Math.max(0,capacity-players.length)} available`:`${players.length} player${players.length===1?"":"s"} RSVP’d`;
      list.innerHTML=players.length?`<ul class="event-tee-player-list">${players.map((p,i)=>`<li><div class="event-tee-avatar" data-rsvp-avatar="${i}">${escapeHtml(initials(p.full_name))}</div><strong>${escapeHtml(p.full_name)}</strong></li>`).join("")}</ul>`:"<p>No one has RSVP’d as playing yet.</p>";
      players.forEach(async(p,i)=>{if(!p.photo_url)return;const {data}=await client.storage.from("profile-images").createSignedUrl(p.photo_url,3600);const avatar=list.querySelector(`[data-rsvp-avatar="${i}"]`);if(data?.signedUrl&&avatar){avatar.innerHTML=`<img src="${escapeHtml(data.signedUrl)}" alt="">`;avatar.classList.add("has-photo");}});
    }catch(_){dialog.querySelector("#eventRsvpRosterSummary").textContent="The RSVP list could not be loaded. Please try again.";}
  };

  const addDashboardAvailability = async () => {
    const card=document.querySelector(".dashboard-next-event");
    const name=document.getElementById("dashboardEventName")?.textContent;
    if(!card||!name||name.includes("Checking")||name.includes("No upcoming"))return;
    const today=new Date().toISOString().slice(0,10);
    const {data:events}=await client.from("events").select("id,name,capacity,event_date").gte("event_date",today).in("status",["scheduled","cancelled"]).order("event_date").limit(1);
    const event=events?.[0]; if(!event)return;
    const players=await fetchPlaying(event.id);
    let box=document.getElementById("dashboardEventAvailability");
    if(!box){box=document.createElement("div");box.id="dashboardEventAvailability";box.className="event-rsvp-availability dashboard-rsvp-availability";document.getElementById("dashboardEventFacts")?.after(box);}
    const available=event.capacity?Math.max(0,event.capacity-players.length):null;
    box.innerHTML=`<div><span>EVENT PLACES</span><strong>${event.capacity?`${players.length} of ${event.capacity} filled`: `${players.length} RSVP’d`}</strong>${available!==null?`<small>${available} place${available===1?"":"s"} available</small>`:""}</div><button class="button button-outline" type="button">See who’s playing</button>`;
    box.querySelector("button").addEventListener("click",()=>openRoster(event.id,event.name,event.capacity));
  };

  const enhanceEventCards = async () => {
    const list=document.getElementById("eventList"); if(!list)return;
    const cards=[...list.querySelectorAll(".compact-event-card")]; if(!cards.length)return;
    const today=new Date().toISOString().slice(0,10);
    const {data:events}=await client.from("events").select("id,name,capacity,event_date").gte("event_date",today).in("status",["scheduled","cancelled"]).order("event_date");
    for(let i=0;i<cards.length;i++){
      const event=events?.[i]; if(!event||cards[i].querySelector(".event-rsvp-availability"))continue;
      const players=await fetchPlaying(event.id), available=event.capacity?Math.max(0,event.capacity-players.length):null;
      const box=document.createElement("div");box.className="event-rsvp-availability";
      box.innerHTML=`<div><span>EVENT PLACES</span><strong>${event.capacity?`${players.length} of ${event.capacity} filled`:`${players.length} RSVP’d`}</strong>${available!==null?`<small>${available} available</small>`:""}</div><button class="button button-outline" type="button">See who’s playing</button>`;
      const main=cards[i].querySelector(".event-main"); main?.appendChild(box);
      box.querySelector("button").addEventListener("click",()=>openRoster(event.id,event.name,event.capacity));
    }
  };

  const style=document.createElement("style");
  style.textContent=`.event-rsvp-availability{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px;padding:14px 16px;border:1px solid rgba(6,61,42,.16);border-radius:14px;background:#f5f8f6}.event-rsvp-availability>div{display:grid;gap:2px}.event-rsvp-availability span{font-size:.72rem;font-weight:800;letter-spacing:.08em;color:#6b756f}.event-rsvp-availability strong{font-size:1rem;color:#063d2a}.event-rsvp-availability small{color:#65716b}.rsvp-roster-list .event-tee-player-list{margin:0;padding:0;list-style:none}.rsvp-roster-list .event-tee-player-list li{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(6,61,42,.1)}@media(max-width:640px){.event-rsvp-availability{align-items:stretch;flex-direction:column}.event-rsvp-availability .button{width:100%}}`;
  document.head.appendChild(style);

  const observer=new MutationObserver(()=>{enhanceEventCards().catch(()=>{});});
  const eventList=document.getElementById("eventList"); if(eventList)observer.observe(eventList,{childList:true,subtree:false});
  window.addEventListener("load",()=>{setTimeout(()=>addDashboardAvailability().catch(()=>{}),700);setTimeout(()=>enhanceEventCards().catch(()=>{}),500);});
})();
