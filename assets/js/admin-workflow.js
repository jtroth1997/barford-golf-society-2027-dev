(() => {
  "use strict";
  const client=window.BarfordSupabase;
  const dashboard=document.getElementById("adminDashboard");
  if(!client||!dashboard)return;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let state=[];

  function ensureUI(){
    if(document.getElementById("adminNextJob"))return;
    const nav=document.querySelector(".admin-section-nav");
    if(nav){
      const labels={events:"Season & Events",scorecards:"Scorecards / Event Day",scores:"Manual Scores",gallery:"Gallery",content:"Shop & Trips",members:"Members"};
      nav.querySelectorAll("[data-admin-view]").forEach(b=>{if(labels[b.dataset.adminView])b.textContent=labels[b.dataset.adminView];});
    }
    const toolbar=dashboard.querySelector(".admin-toolbar");
    const wrap=document.createElement("section");
    wrap.id="adminNextJob";
    wrap.className="admin-next-job admin-card";
    wrap.innerHTML=`<div class="next-job-loading"><p class="eyebrow">Committee workflow</p><h2>Finding your next job…</h2><p>Checking the season and the next event.</p></div>`;
    toolbar?.after(wrap);

    const eventsPanel=document.querySelector('[data-admin-panel="events"]');
    const oldWorkflow=eventsPanel?.querySelector(".admin-workflow");
    if(oldWorkflow)oldWorkflow.innerHTML=`<span><b>1</b>Season setup</span><span><b>2</b>RSVPs</span><span><b>3</b>Tee times</span><span><b>4</b>Scorecards</span><span><b>5</b>Event day</span><span><b>6</b>Finish & publish</span>`;
    const createCard=document.getElementById("adminCreateEventCard");
    if(createCard){createCard.querySelector(".eyebrow").textContent="Season setup / maintenance";createCard.querySelector("h3").textContent="Add or amend season event";}
    const dropout=document.querySelector(".admin-dropout-card");
    if(dropout){dropout.querySelector(".eyebrow").textContent="Event day";dropout.querySelector("h3").textContent="Manage player changes";dropout.querySelector("p:not(.eyebrow)").textContent="Remove a late dropout with minimum disruption. The existing rebalance system only moves players when the affected group becomes too small.";}
  }

  const daysUntil=date=>Math.ceil((new Date(`${date}T12:00:00`)-new Date())/86400000);
  async function inspect(){
    ensureUI();
    const {data:events,error}=await client.from("events").select("id,name,event_date,status,round_number").neq("status","cancelled").order("event_date");
    if(error)return renderError(error.message);
    const rows=await Promise.all((events||[]).map(async event=>{
      const [rsvp,tees,holes,cards]=await Promise.all([
        client.from("rsvps").select("id",{count:"exact",head:true}).eq("event_id",event.id).eq("status","playing"),
        client.from("tee_times").select("id",{count:"exact",head:true}).eq("event_id",event.id).not("member_id","is",null),
        client.from("event_holes").select("hole_number",{count:"exact",head:true}).eq("event_id",event.id),
        client.from("event_scorecards").select("id,status").eq("event_id",event.id)
      ]);
      const cardList=cards.data||[];
      return {...event,rsvps:rsvp.count||0,tees:tees.count||0,holes:holes.count||0,cards:cardList,submitted:cardList.filter(c=>["submitted","locked"].includes(c.status)).length,finished:cardList.length>0&&cardList.every(c=>c.status==="locked")};
    }));
    state=rows;render();
  }

  function getJob(){
    const valid=state.filter(e=>e.status!=="cancelled");
    const rounds=new Set(valid.map(e=>Number(e.round_number)).filter(n=>n>=1&&n<=7));
    if(rounds.size<7)return {kind:"season",title:"Complete the 2027 season setup",copy:`${rounds.size} of 7 season rounds are currently created. Add the remaining events first, then this area becomes event maintenance.`,button:"Continue Season Setup",view:"events"};
    const unfinished=valid.filter(e=>!e.finished).sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date)));
    const e=unfinished[0];
    if(!e)return {kind:"done",title:"Season workflow complete",copy:"All current rounds are finished and published.",button:"View League Table",href:"scores.html"};
    const d=daysUntil(e.event_date),when=d===0?"Today":d===1?"Tomorrow":d>1?`In ${d} days`:`${Math.abs(d)} day${Math.abs(d)===1?"":"s"} ago`;
    if(!e.tees)return {kind:d<=7?"next":"waiting",event:e,title:d<=7?`Create tee times — ${e.name}`:`Next event: ${e.name}`,copy:d<=7?`${when} · ${e.rsvps} confirmed player${e.rsvps===1?"":"s"}. Tee times are the next committee job.`:`${when} · ${e.rsvps} confirmed. Tee times become the main job in the week before the event.`,button:"Open Tee Times",view:"events",target:"adminTeeEvent"};
    if(e.holes<18||!e.cards.length)return {kind:"next",event:e,title:`Prepare scorecards — ${e.name}`,copy:`Tee times are complete. Set the course/tees and create the group scorecards next.`,button:"Prepare Scorecards",view:"scorecards",target:"adminScoringEvent"};
    if(d<=0&&!e.finished){
      if(e.submitted<e.cards.length)return {kind:"today",event:e,title:`Event Day — ${e.name}`,copy:`${e.submitted} of ${e.cards.length} group scorecards submitted. Manage any dropouts with minimum disruption, then let the groups complete their cards.`,button:"Open Event Day",view:"scorecards",target:"adminScoringEvent",eventDay:true};
      return {kind:"finish",event:e,title:`All groups are in — ${e.name}`,copy:`All ${e.cards.length} scorecards are submitted. Check the results and finish the round. Finishing publishes the results and updates the leaderboard automatically.`,button:"Finish Round & Results",view:"scorecards",target:"adminScoringEvent"};
    }
    return {kind:"ready",event:e,title:`${e.name} is ready`,copy:`Tee times and scorecards are prepared. ${when}. No further setup is required unless a player changes.`,button:"Review Event",view:"scorecards",target:"adminScoringEvent"};
  }

  function render(){
    const box=document.getElementById("adminNextJob"),job=getJob();if(!box)return;
    const eventMeta=job.event?`<span class="next-job-event-meta">Round ${esc(job.event.round_number||"—")} · ${esc(job.event.event_date)}</span>`:"";
    box.className=`admin-next-job admin-card next-job-${job.kind}`;
    box.innerHTML=`<div class="next-job-copy"><p class="eyebrow">${job.kind==="today"?"Today":"What do we do next?"}</p><h2>${esc(job.title)}</h2><p>${esc(job.copy)}</p>${eventMeta}</div><div class="next-job-action"><button class="button button-primary" id="adminNextJobButton" type="button">${esc(job.button)}</button><button class="next-job-refresh" id="adminWorkflowRefresh" type="button">Refresh status</button></div>`;
    document.getElementById("adminWorkflowRefresh")?.addEventListener("click",inspect);
    document.getElementById("adminNextJobButton")?.addEventListener("click",()=>go(job));
  }

  function go(job){
    if(job.href){location.href=job.href;return;}
    const nav=document.querySelector(`[data-admin-view="${job.view}"]`);nav?.click();
    if(job.event&&job.target)setTimeout(()=>{const select=document.getElementById(job.target);if(select){select.value=job.event.id;select.dispatchEvent(new Event("change",{bubbles:true}));select.scrollIntoView({behavior:"smooth",block:"center"});}},80);
    if(job.eventDay)setTimeout(()=>document.querySelector(".admin-dropout-card")?.scrollIntoView({behavior:"smooth",block:"start"}),300);
  }
  function renderError(message){const box=document.getElementById("adminNextJob");if(box)box.innerHTML=`<p class="eyebrow">Committee workflow</p><h2>Couldn’t check the next job</h2><p>${esc(message)}</p><button id="adminWorkflowRetry" class="button button-outline">Try again</button>`;document.getElementById("adminWorkflowRetry")?.addEventListener("click",inspect);}

  const observer=new MutationObserver(()=>{if(!dashboard.classList.contains("hidden")){observer.disconnect();inspect();}});observer.observe(dashboard,{attributes:true,attributeFilter:["class"]});
  if(!dashboard.classList.contains("hidden"))inspect();
  window.addEventListener("barford-admin-data-changed",inspect);
})();