(() => {
  "use strict";
  const client=window.BarfordSupabase;
  const dashboard=document.getElementById("adminDashboard"),oldEvents=document.querySelector('[data-admin-panel="events"]'),oldDay=document.querySelector('[data-admin-panel="scorecards"]');
  if(!client||!dashboard||!oldEvents||!oldDay)return;

  const createCard=document.getElementById("adminCreateEventCard");
  const manageCard=document.getElementById("adminEventList")?.closest(".admin-card");
  const rsvpCard=document.getElementById("adminRsvpEvent")?.closest(".admin-card");
  const teeCard=document.getElementById("adminTeeEvent")?.closest(".admin-card");
  const dropoutCard=document.getElementById("adminDropoutEvent")?.closest(".admin-card");
  const liveCard=document.querySelector(".admin-live-scoring"),resultsCard=document.querySelector(".admin-event-results");
  if(!createCard||!manageCard||!rsvpCard||!teeCard||!liveCard)return;

  // Create Event is deliberately basic event information only. Remove any legacy scoring-setup UI injected by older admin scripts.
  const removeCreateEventScoring=()=>{
    Array.from(createCard.querySelectorAll("section,div,article")).forEach(node=>{
      const text=(node.textContent||"").replace(/\s+/g," ").trim();
      if((/Prepare the course scorecard now/i.test(text)||(/SCORING SETUP/i.test(text)&&/Find scoring card/i.test(text)))&&!node.querySelector("#adminEventForm")) node.remove();
    });
  };
  removeCreateEventScoring();
  const createObserver=new MutationObserver(removeCreateEventScoring);createObserver.observe(createCard,{childList:true,subtree:true});

  const makePanel=(name,title,help)=>{const p=document.createElement("section");p.className="admin-view hidden";p.dataset.adminPanel=name;p.innerHTML=`<div class="admin-workflow-stage"><p class="eyebrow">${title}</p><p>${help}</p></div>`;dashboard.appendChild(p);return p;};
  const createPanel=makePanel("create-event","1 · Create event","Create the round and its basic event information only.");
  const managePanel=makePanel("manage-event","2 · Manage event & RSVP","Manage the event, players, reserves and RSVP choices.");
  const teePanel=makePanel("tee-scorecards","3 · Tee times & scorecards","Choose the event, set its course and scoring information, generate the groups and publish tee times and scorecards together.");
  const dayPanel=makePanel("event-day","4 · Event day & results","Run the live event. Groups choose their scorer on the day; submitted cards and results appear here for presentation.");
  createPanel.appendChild(createCard);managePanel.append(manageCard,rsvpCard);teePanel.appendChild(teeCard);if(dropoutCard)dayPanel.appendChild(dropoutCard);dayPanel.appendChild(liveCard);if(resultsCard)dayPanel.appendChild(resultsCard);
  oldEvents.remove();oldDay.remove();

  const nav=document.querySelector(".admin-section-nav");
  nav.innerHTML='<button type="button" data-flow-tab="create-event">1. Create Event</button><button type="button" data-flow-tab="manage-event">2. Manage Event & RSVP</button><button type="button" data-flow-tab="tee-scorecards">3. Tee Times & Scorecards</button><button type="button" data-flow-tab="event-day">4. Event Day & Results</button>';
  const panels=[createPanel,managePanel,teePanel,dayPanel];
  const openTab=name=>{nav.querySelectorAll("[data-flow-tab]").forEach(b=>b.classList.toggle("active",b.dataset.flowTab===name));panels.forEach(p=>p.classList.toggle("hidden",p.dataset.adminPanel!==name));};
  nav.querySelectorAll("[data-flow-tab]").forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.flowTab)));openTab("create-event");

  const setupWrap=document.createElement("section");setupWrap.className="admin-combined-scorecard-setup";setupWrap.innerHTML='<div class="admin-heading"><div><p class="eyebrow">Scorecard setup</p><h4>Course & scoring information</h4><p class="admin-score-help">Select the event above, then set the course, tees and competition holes before generating the groups.</p></div></div>';
  teeCard.insertBefore(setupWrap,teeCard.querySelector(".admin-inline-fields"));
  [document.querySelector(".admin-course-import"),document.getElementById("adminScorecardSaved"),document.querySelector(".admin-competition-setup"),document.querySelector(".admin-advanced-scorecard")].forEach(n=>{if(n)setupWrap.appendChild(n);});
  document.getElementById("adminScoringChecklist")?.remove();
  const prepare=document.getElementById("adminPrepareScorecards");if(prepare){const section=prepare.closest("section");prepare.remove();document.getElementById("adminScorecardProgress")?.remove();Array.from(section?.querySelectorAll("h4")||[]).find(x=>/group scorecards/i.test(x.textContent))?.remove();Array.from(section?.querySelectorAll("p.admin-score-help")||[]).find(x=>/tee times|handicaps|scorecard/i.test(x.textContent))?.remove();}
  const dayHeading=liveCard.querySelector(".admin-heading > div");if(dayHeading){dayHeading.querySelector(".eyebrow").textContent="Live event";dayHeading.querySelector("h3").textContent="Event control & results";dayHeading.querySelector("p").textContent="This is the event-day screen. Monitor submitted scorecards, award the competitions and finish the round when everyone is in.";}
  const generate=document.getElementById("adminGenerateTeeTimes"),publish=document.getElementById("adminSaveTeeTimes");if(generate)generate.textContent="Generate tee times & scorecards";if(publish)publish.textContent="Publish tee times & scorecards";

  const teeSelect=document.getElementById("adminTeeEvent"),scoringSelect=document.getElementById("adminScoringEvent");
  teeSelect?.addEventListener("change",()=>{if(!scoringSelect)return;scoringSelect.value=teeSelect.value;scoringSelect.dispatchEvent(new Event("change",{bubbles:true}));});
  const showConfirmation=message=>{const box=document.getElementById("adminScorecardSaved");if(!box)return;box.classList.remove("hidden");box.innerHTML=`<strong>✓ Saved</strong><span>${message}</span>`;box.style.display="flex";box.style.opacity="1";};

  document.getElementById("adminImportScorecard")?.addEventListener("click",()=>{const button=document.getElementById("adminImportScorecard");if(button)button.textContent="Saving…";setTimeout(async()=>{const eventId=teeSelect?.value;if(!eventId){if(button){button.disabled=false;button.textContent="Save course and tees";}return;}const {data,error}=await client.from("event_holes").select("yellow_tee_name,red_tee_name").eq("event_id",eventId).limit(1);if(!error&&data?.length){button.disabled=false;button.textContent="Saved ✓";showConfirmation(`Course scorecard is saved in Supabase. Men: ${data[0].yellow_tee_name}. Women: ${data[0].red_tee_name}.`);}else{button.disabled=false;button.textContent="Save course and tees";}},2500);},true);
  document.getElementById("adminSaveCompetitionHoles")?.addEventListener("click",()=>{const button=document.getElementById("adminSaveCompetitionHoles");if(button)button.textContent="Saving…";setTimeout(async()=>{const eventId=teeSelect?.value;if(!eventId){button.disabled=false;button.textContent="Save competition holes";return;}const {data,error}=await client.from("event_holes").select("hole_number,longest_drive,nearest_pin").eq("event_id",eventId).or("longest_drive.eq.true,nearest_pin.eq.true");if(!error){const ld=data?.find(x=>x.longest_drive)?.hole_number||"–",np=data?.find(x=>x.nearest_pin)?.hole_number||"–";button.disabled=false;button.textContent="Saved ✓";showConfirmation(`Competition holes saved in Supabase. Longest Drive: Hole ${ld}. Nearest the Pin: Hole ${np}.`);}else{button.disabled=false;button.textContent="Save competition holes";}},2000);},true);

  generate?.addEventListener("click",async event=>{const eventId=teeSelect?.value;if(!eventId)return;const{count}=await client.from("event_holes").select("hole_number",{count:"exact",head:true}).eq("event_id",eventId);if(count!==18){event.stopImmediatePropagation();document.getElementById("adminTeeStatus").textContent="Save the complete course scorecard above before generating tee times and scorecards.";}},true);
})();