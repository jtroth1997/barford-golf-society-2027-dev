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

  // Step 1 must contain ONLY the event form. Legacy admin-auth code can inject a scoring panel inside the form,
  // so remove anything between the course description field and the form action buttons unless it is a form field.
  const removeCreateEventScoring=()=>{
    const form=document.getElementById("adminEventForm");
    if(!form)return;
    const actions=form.querySelector(".admin-form-actions");
    Array.from(form.children).forEach(node=>{
      if(node===actions||node.id==="adminEventId"||node.matches("label"))return;
      const text=(node.textContent||"").replace(/\s+/g," ").trim();
      if(/scoring setup|prepare the course scorecard|find scoring card|not prepared/i.test(text))node.remove();
    });
    // Also catch nested/injected legacy scoring cards regardless of their class name.
    Array.from(form.querySelectorAll("section,article,div")).forEach(node=>{
      if(node===actions||node.contains(actions))return;
      const text=(node.textContent||"").replace(/\s+/g," ").trim();
      if(/prepare the course scorecard|find scoring card/i.test(text))node.remove();
    });
  };
  removeCreateEventScoring();
  new MutationObserver(removeCreateEventScoring).observe(document.getElementById("adminEventForm"),{childList:true,subtree:true});

  const makePanel=(name,title,help)=>{const p=document.createElement("section");p.className="admin-view hidden";p.dataset.adminPanel=name;p.innerHTML=`<div class="admin-workflow-stage"><p class="eyebrow">${title}</p><p>${help}</p></div>`;dashboard.appendChild(p);return p;};
  const createPanel=makePanel("create-event","1 · Create event","Create the round and its basic event information only.");
  const nextPanel=makePanel("next-action","Event control centre","The system shows the next event and the one action needed to move it forward.");
  const managePanel=makePanel("manage-event","Ongoing management · RSVPs","Manage the event, players, reserves and RSVP choices.");
  const teePanel=makePanel("tee-times","2 · Tee times","Generate and publish tee times. This does not create or post scorecards.");
  const scorecardPanel=makePanel("scorecards-setup","3 · Scorecards","Set the course and scoring information, then post the group scorecards separately after tee times are published.");
  const dayPanel=makePanel("event-day","4 · Play event & results","Run the live event. Groups choose their scorer on the day; submitted cards and results appear here for presentation.");
  createPanel.appendChild(createCard);managePanel.append(manageCard,rsvpCard);teePanel.appendChild(teeCard);if(dropoutCard)dayPanel.appendChild(dropoutCard);dayPanel.appendChild(liveCard);if(resultsCard)dayPanel.appendChild(resultsCard);
  oldEvents.remove();oldDay.remove();

  const nav=document.querySelector(".admin-section-nav");
  const galleryPanel=document.querySelector('[data-admin-panel="gallery"]');
  nav.innerHTML='<button type="button" data-flow-tab="next-action">Next action</button><button type="button" data-flow-tab="create-event">1. Event setup</button><button type="button" data-flow-tab="tee-times">2. Tee times</button><button type="button" data-flow-tab="scorecards-setup">3. Scorecards</button><button type="button" data-flow-tab="event-day">4. Play & results</button><button type="button" data-flow-tab="manage-event">Manage RSVPs</button><button type="button" data-flow-tab="gallery">Manage photos</button>';
  const panels=[nextPanel,createPanel,managePanel,teePanel,scorecardPanel,dayPanel,galleryPanel].filter(Boolean);
  let inlineActionStage=null;
  const openTab=name=>{if(name!=="next-action")inlineActionStage=null;nav.querySelectorAll("[data-flow-tab]").forEach(b=>b.classList.toggle("active",b.dataset.flowTab===name));panels.forEach(p=>p.classList.toggle("hidden",!(p.dataset.adminPanel===name||(name==="next-action"&&p.dataset.adminPanel===inlineActionStage))));};
  nav.querySelectorAll("[data-flow-tab]").forEach(b=>b.addEventListener("click",()=>openTab(b.dataset.flowTab)));
  const requestedTab=new URLSearchParams(location.search).get("section");
  openTab(panels.some(p=>p.dataset.adminPanel===requestedTab)?requestedTab:"next-action");

  const selectEventForStage=(stage,eventId)=>{
    const selects={"tee-times":"adminTeeEvent","scorecards-setup":"adminScorecardEvent","event-day":"adminScoringEvent","manage-event":"adminRsvpEvent"};
    const select=document.getElementById(selects[stage]);
    if(select&&eventId){select.value=eventId;select.dispatchEvent(new Event("change",{bubbles:true}));}
  };
  const openEventStage=(stage,eventId)=>{openTab(stage);selectEventForStage(stage,eventId);};
  const openInlineAction=(stage,eventId)=>{inlineActionStage=stage;selectEventForStage(stage,eventId);openTab("next-action");document.querySelector(`[data-admin-panel="${stage}"]`)?.scrollIntoView({behavior:"smooth",block:"start"});};
  const commandCentre=document.createElement("section");
  commandCentre.className="admin-event-command-centre";
  commandCentre.innerHTML='<p>Loading current event…</p>';
  nextPanel.appendChild(commandCentre);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  const actionFor=(event,counts)=>{
    if(event.status==="completed"||event.results_status==="published")return {title:"EVENT COMPLETE",copy:"Results are published and the league table has been updated.",stage:"event-day",label:"View completed event"};
    if(event.tee_times_status!=="published"||!counts.tees)return {title:"CREATE & PUBLISH TEE TIMES",copy:"RSVPs are open. When the groups are ready, create a draft, review it, then publish the tee times.",stage:"tee-times",label:"Create tee times"};
    if(event.scorecards_status!=="published"||!counts.cards)return {title:"CREATE & PUBLISH SCORECARDS",copy:"Tee times are published. Verify the saved course data, then create the group scorecards separately.",stage:"scorecards-setup",label:"Create scorecards"};
    if(event.results_status==="ready_to_review")return {title:"REVIEW & VERIFY RESULTS",copy:"Every group has submitted. Check the scores and competition winners before publishing the final results.",stage:"event-day",label:"Review results"};
    return {title:"EVENT READY",copy:"Tee times and scorecards are published. On the day, monitor group cards here until all scores are in.",stage:"event-day",label:"Open live event"};
  };
  const refreshCommandCentre=async()=>{
    const {data:events,error}=await client.from("events").select("id,name,venue,event_date,status,capacity,tee_times_status,scorecards_status,results_status").neq("status","cancelled").neq("status","completed").order("event_date");
    if(error){commandCentre.innerHTML=`<p>${esc(error.message)}</p>`;return;}
    const event=(events||[]).find(item=>item.event_date>=today())||(events||[])[0];
    const {data:completed}=await client.from("events").select("id,name,event_date").eq("status","completed").order("event_date",{ascending:false}).limit(8);
    if(!event){commandCentre.innerHTML=`<div class="admin-next-empty"><h3>No active event</h3><p>Create the next event to begin the workflow.</p><button class="button button-primary" data-command-stage="create-event">Create event</button></div><details class="admin-history"><summary>Completed events (${(completed||[]).length})</summary>${(completed||[]).map(item=>`<p>${esc(item.name)} · ${esc(item.event_date)}</p>`).join("")||"<p>No completed events yet.</p>"}</details>`;commandCentre.querySelector("[data-command-stage]")?.addEventListener("click",()=>openTab("create-event"));return;}
    const [rsvp,tees,holes,cards,submitted]=await Promise.all([
      client.from("rsvps").select("id,status",{count:"exact",head:true}).eq("event_id",event.id),
      client.from("tee_times").select("id",{count:"exact",head:true}).eq("event_id",event.id),
      client.from("event_holes").select("id",{count:"exact",head:true}).eq("event_id",event.id),
      client.from("event_scorecards").select("id",{count:"exact",head:true}).eq("event_id",event.id),
      client.from("event_scorecards").select("id",{count:"exact",head:true}).eq("event_id",event.id).in("status",["submitted","locked"])
    ]);
    const counts={players:rsvp.count||0,tees:tees.count||0,holes:holes.count||0,cards:cards.count||0,submitted:submitted.count||0};
    const action=actionFor(event,counts),stages=[
      ["Event",true,"create-event"],
      ["Tee times",event.tee_times_status==="published"&&counts.tees>0,"tee-times"],
      ["Scorecards",event.scorecards_status==="published"&&counts.cards>0,"scorecards-setup"],
      ["Play",counts.cards>0&&counts.submitted<counts.cards,"event-day"],
      ["Results",event.results_status==="ready_to_review"||event.results_status==="published","event-day"],
      ["Complete",event.results_status==="published"||event.status==="completed","event-day"]
    ];
    const facts=`<span>${counts.players} RSVP${counts.players===1?"":"s"}</span><span>${event.capacity?Math.max(0,event.capacity-counts.players)+" places remaining":"Capacity not set"}</span><span>${counts.cards?counts.submitted+"/"+counts.cards+" cards submitted":counts.holes===18?"Course card verified":"Course card not set"}</span>`;
    const progress=stages.map(([name,done,stage])=>`<button type="button" class="${done?"is-done":""} ${stage===action.stage?"is-current":""}" data-workspace-stage="${stage}"><b>${done?"✓":"○"}</b>${name}</button>`).join("");
    const workspace=[["Event setup",true,"create-event","View / edit"],["RSVPs",true,"manage-event","Manage"],["Tee times",counts.tees>0,"tee-times",counts.tees?"View / edit":"Not created"],["Scorecards",counts.cards>0||counts.holes===18,"scorecards-setup",counts.cards?"View / edit":counts.holes===18?"Course card saved":"Not created"],["Results",counts.cards>0,"event-day",event.results_status==="ready_to_review"?"Ready to review":counts.cards?counts.submitted+"/"+counts.cards+" submitted":"Awaiting event"]].map(([name,ready,stage,label])=>`<article><strong>${name}</strong><small>${ready?"Saved":"Not started"}</small><button type="button" data-workspace-stage="${stage}">${label}</button></article>`).join("");
    const archived=(completed||[]).map(item=>`<p>${esc(item.name)} · ${esc(item.event_date)}</p>`).join("")||"<p>No completed events yet.</p>";
    commandCentre.innerHTML=`<section class="admin-current-event"><p class="eyebrow">Current / next event</p><h2>${esc(event.name)}</h2><p>${esc(event.event_date)} · ${esc(event.venue)}</p><div class="admin-event-facts">${facts}</div></section><section class="admin-progress"><p class="eyebrow">Event progress</p><div>${progress}</div></section><section class="admin-next-action"><p class="eyebrow">Next action</p><h3>${action.title}</h3><p>${action.copy}</p><button class="button button-primary" data-command-stage="${action.stage}">${action.label}</button></section><section class="admin-workspace"><p class="eyebrow">Saved event information</p><div>${workspace}</div></section><details class="admin-history"><summary>Completed events (${(completed||[]).length})</summary>${archived}</details>`;
    commandCentre.querySelectorAll("[data-command-stage]").forEach(button=>button.addEventListener("click",()=>openInlineAction(button.dataset.commandStage,event.id)));
    commandCentre.querySelectorAll("[data-workspace-stage]").forEach(button=>button.addEventListener("click",()=>openEventStage(button.dataset.workspaceStage,event.id)));
  };
  setTimeout(()=>refreshCommandCentre().catch(error=>{commandCentre.innerHTML=`<p>${esc(error.message||"Could not load event workflow.")}</p>`;}),600);

  const setupWrap=document.createElement("section");setupWrap.className="admin-card admin-combined-scorecard-setup";setupWrap.innerHTML='<div class="admin-heading"><div><p class="eyebrow">Step 3</p><h3>Scorecards</h3><p class="admin-score-help">Select the event below, set the course, tees and competition holes, then post the group scorecards when tee times are published.</p></div></div>';
  const scorecardEventLabel=document.createElement("label");scorecardEventLabel.className="admin-scorecard-event";scorecardEventLabel.textContent="Event";const scorecardEvent=document.createElement("select");scorecardEvent.id="adminScorecardEvent";scorecardEvent.innerHTML='<option value="">Select event</option>';scorecardEventLabel.appendChild(scorecardEvent);setupWrap.appendChild(scorecardEventLabel);scorecardPanel.appendChild(setupWrap);
  [document.querySelector(".admin-course-import"),document.getElementById("adminScorecardSaved"),document.querySelector(".admin-competition-setup"),document.querySelector(".admin-advanced-scorecard")].forEach(n=>{if(n)setupWrap.appendChild(n);});
  document.getElementById("adminScoringChecklist")?.remove();
  const prepare=document.getElementById("adminPrepareScorecards");if(prepare){
    const section=prepare.closest("section");prepare.remove();section?.remove();
    const scorecardAction=document.createElement("section");scorecardAction.className="admin-scorecard-publish-step";
    scorecardAction.innerHTML='<div><p class="eyebrow">After tee times are published</p><h4>Post group scorecards</h4><p class="admin-score-help">This is a separate step. It creates ready cards with no scorer selected; each group chooses their scorer on the day.</p></div>';
    prepare.textContent="Post group scorecards";prepare.disabled=true;scorecardAction.appendChild(prepare);scorecardPanel.appendChild(scorecardAction);
  }
  const dayHeading=liveCard.querySelector(".admin-heading > div");if(dayHeading){dayHeading.querySelector(".eyebrow").textContent="Live event";dayHeading.querySelector("h3").textContent="Event control & results";dayHeading.querySelector("p").textContent="This is the event-day screen. Monitor submitted scorecards, award the competitions and finish the round when everyone is in.";}
  const generate=document.getElementById("adminGenerateTeeTimes"),publish=document.getElementById("adminSaveTeeTimes");if(generate)generate.textContent="Generate tee-time preview";if(publish)publish.textContent="Publish tee times";

  const teeSelect=document.getElementById("adminTeeEvent"),scoringSelect=document.getElementById("adminScoringEvent");
  const syncScorecardEvents=()=>{if(!teeSelect||!scorecardEvent)return;const selected=scorecardEvent.value||teeSelect.value;scorecardEvent.innerHTML=teeSelect.innerHTML;if(Array.from(scorecardEvent.options).some(option=>option.value===selected))scorecardEvent.value=selected;};
  if(teeSelect)new MutationObserver(syncScorecardEvents).observe(teeSelect,{childList:true,subtree:true});syncScorecardEvents();
  teeSelect?.addEventListener("change",()=>{syncScorecardEvents();if(scorecardEvent)scorecardEvent.value=teeSelect.value;if(!scoringSelect)return;scoringSelect.value=teeSelect.value;scoringSelect.dispatchEvent(new Event("change",{bubbles:true}));});
  scorecardEvent.addEventListener("change",()=>{if(teeSelect){teeSelect.value=scorecardEvent.value;teeSelect.dispatchEvent(new Event("change",{bubbles:true}));}if(scoringSelect){scoringSelect.value=scorecardEvent.value;scoringSelect.dispatchEvent(new Event("change",{bubbles:true}));}});
  const showConfirmation=message=>{const box=document.getElementById("adminScorecardSaved");if(!box)return;box.classList.remove("hidden");box.innerHTML=`<strong>✓ Saved</strong><span>${message}</span>`;box.style.display="flex";box.style.opacity="1";};

  document.getElementById("adminImportScorecard")?.addEventListener("click",()=>{const button=document.getElementById("adminImportScorecard");if(button)button.textContent="Saving…";setTimeout(async()=>{const eventId=teeSelect?.value;if(!eventId){if(button){button.disabled=false;button.textContent="Save course and tees";}return;}const {data,error}=await client.from("event_holes").select("yellow_tee_name,red_tee_name").eq("event_id",eventId).limit(1);if(!error&&data?.length){button.disabled=false;button.textContent="Saved ✓";showConfirmation(`Course scorecard is saved in Supabase. Men: ${data[0].yellow_tee_name}. Women: ${data[0].red_tee_name}.`);}else{button.disabled=false;button.textContent="Save course and tees";}},2500);},true);
  document.getElementById("adminSaveCompetitionHoles")?.addEventListener("click",()=>{const button=document.getElementById("adminSaveCompetitionHoles");if(button)button.textContent="Saving…";setTimeout(async()=>{const eventId=teeSelect?.value;if(!eventId){button.disabled=false;button.textContent="Save competition holes";return;}const {data,error}=await client.from("event_holes").select("hole_number,longest_drive,nearest_pin").eq("event_id",eventId).or("longest_drive.eq.true,nearest_pin.eq.true");if(!error){const ld=data?.find(x=>x.longest_drive)?.hole_number||"–",np=data?.find(x=>x.nearest_pin)?.hole_number||"–";button.disabled=false;button.textContent="Saved ✓";showConfirmation(`Competition holes saved in Supabase. Longest Drive: Hole ${ld}. Nearest the Pin: Hole ${np}.`);}else{button.disabled=false;button.textContent="Save competition holes";}},2000);},true);

  generate?.addEventListener("click",async event=>{const eventId=teeSelect?.value;if(!eventId)return;const{count}=await client.from("event_holes").select("hole_number",{count:"exact",head:true}).eq("event_id",eventId);if(count!==18){event.stopImmediatePropagation();document.getElementById("adminTeeStatus").textContent="Save the complete course scorecard above before generating tee times.";}},true);
  teeSelect?.addEventListener("change",async()=>{const eventId=teeSelect?.value;if(!eventId){prepare.disabled=true;return;}const{count}=await client.from("tee_times").select("id",{count:"exact",head:true}).eq("event_id",eventId);prepare.disabled=!(count>0);});
  const teeStatus=document.getElementById("adminTeeStatus");
  if(teeStatus)new MutationObserver(async()=>{if(!/^Tee times published\./.test(teeStatus.textContent||""))return;const eventId=teeSelect?.value;if(!eventId)return;const{count}=await client.from("tee_times").select("id",{count:"exact",head:true}).eq("event_id",eventId);prepare.disabled=!(count>0);}).observe(teeStatus,{childList:true,subtree:true,characterData:true});
  prepare?.addEventListener("click",async event=>{const eventId=teeSelect?.value;if(!eventId||prepare.disabled){event.stopImmediatePropagation();document.getElementById("adminTeeStatus").textContent="Publish tee times first, then post the group scorecards.";return;}const{count}=await client.from("tee_times").select("id",{count:"exact",head:true}).eq("event_id",eventId);if(!count){event.stopImmediatePropagation();document.getElementById("adminTeeStatus").textContent="Publish tee times first, then post the group scorecards.";}} ,true);
})();
