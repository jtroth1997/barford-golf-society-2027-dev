(() => {
  "use strict";
  const client=window.BarfordSupabase,$=id=>document.getElementById(id),esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let events=[],activeEventId=null;
  const status=message=>{$("adminLiveScoringStatus").textContent=message;};
  const holeMarkup=(number,data={})=>`<div class="admin-hole-row"><strong>${number}</strong><input data-hole="${number}" data-field="par" type="number" min="3" max="6" value="${data.par||""}" placeholder="Par" aria-label="Hole ${number} par"><input data-hole="${number}" data-field="yards" type="number" min="40" max="800" value="${data.yards||""}" placeholder="Yards" aria-label="Hole ${number} yards"><input data-hole="${number}" data-field="stroke_index" type="number" min="1" max="18" value="${data.stroke_index||""}" placeholder="SI" aria-label="Hole ${number} stroke index"></div>`;

  async function verifyAdmin(){
    if(!client||!$("adminScoringEvent"))return false;
    const {data:{session}}=await client.auth.getSession();if(!session)return false;
    const {data}=await client.from("profiles").select("is_admin").eq("id",session.user.id).single();return Boolean(data?.is_admin);
  }
  async function loadEvents(){
    if(!await verifyAdmin())return;
    const {data,error}=await client.from("events").select("id,name,event_date,status,round_number").neq("status","cancelled").order("event_date");
    if(error)return status(error.message);events=data||[];
    $("adminScoringEvent").innerHTML=`<option value="">Select event</option>${events.map(event=>`<option value="${event.id}">${esc(event.name)} · Round ${event.round_number||"?"}</option>`).join("")}`;
  }
  async function loadEvent(eventId){
    activeEventId=eventId;$("adminScoringSetup").classList.toggle("hidden",!eventId);if(!eventId)return;
    status("Loading course and scorecards…");
    const [{data:holes,error:holeError},{data:cards,error:cardError}]=await Promise.all([
      client.from("event_holes").select("*").eq("event_id",eventId).order("hole_number"),
      client.from("event_scorecards").select("id,tee_time,tee_number,status,submitted_at,scorer_id").eq("event_id",eventId).order("tee_time")
    ]);
    if(holeError||cardError){status((holeError||cardError).message);return;}
    const byHole=new Map((holes||[]).map(item=>[item.hole_number,item]));
    $("adminHoleEditor").innerHTML=Array.from({length:18},(_,i)=>holeMarkup(i+1,byHole.get(i+1))).join("");
    renderCards(cards||[],holes?.length===18);status(holes?.length===18?"Course card is ready.":"Enter all 18 holes, then save the course card.");
  }
  function renderCards(cards,holesReady){
    $("adminPrepareScorecards").disabled=!holesReady;
    $("adminScorecardProgress").innerHTML=cards.length?cards.map((card,index)=>`<article class="admin-scorecard-state"><div><strong>Group ${index+1}</strong><small>${String(card.tee_time).slice(0,5)} · Tee ${card.tee_number}</small></div><span class="scorecard-status ${card.status}">${card.status.replace("_"," ")}</span></article>`).join(""):`<p>${holesReady?"Course ready. Prepare scorecards after tee times are published.":"Save the course card first."}</p>`;
    $("adminCompleteRound").disabled=!cards.length||cards.some(card=>card.status!=="submitted");
  }
  function collectHoles(){
    return Array.from({length:18},(_,index)=>{const hole=index+1,field=name=>$("adminHoleEditor").querySelector(`[data-hole="${hole}"][data-field="${name}"]`).value;return{event_id:activeEventId,hole_number:hole,par:Number(field("par")),yards:Number(field("yards")),stroke_index:Number(field("stroke_index"))};});
  }
  $("adminScoringEvent")?.addEventListener("change",event=>loadEvent(event.target.value));
  $("adminSaveHoles")?.addEventListener("click",async()=>{
    const holes=collectHoles(),indexes=holes.map(h=>h.stroke_index);
    if(holes.some(h=>h.par<3||h.par>6||h.yards<40||h.yards>800||h.stroke_index<1||h.stroke_index>18)||new Set(indexes).size!==18){status("Check every hole. Par, yards and each unique stroke index from 1 to 18 are required.");return;}
    status("Saving course card…");const {error}=await client.from("event_holes").upsert(holes,{onConflict:"event_id,hole_number"});if(error)return status(error.message);await loadEvent(activeEventId);status("Course card saved. It is ready for offline scoring.");
  });
  $("adminPrepareScorecards")?.addEventListener("click",async()=>{
    status("Preparing tee groups and locking society handicaps…");const {error}=await client.rpc("prepare_event_scorecards",{target_event_id:activeEventId});if(error)return status(error.message);await loadEvent(activeEventId);status("Group scorecards prepared. Players can now open them on their phones.");
  });
  $("adminCompleteRound")?.addEventListener("click",async()=>{
    const event=events.find(item=>item.id===activeEventId);if(!confirm(`Complete ${event?.name||"this round"}? Scores will be added to the league table and next handicaps calculated.`))return;
    const button=$("adminCompleteRound");button.disabled=true;status("Completing the round and updating the league table…");const {error}=await client.rpc("complete_event_round",{target_event_id:activeEventId});if(error){status(error.message);button.disabled=false;return;}await loadEvent(activeEventId);status("Round completed. Scores, league positions and next handicaps are now updated.");
  });
  window.addEventListener("load",()=>setTimeout(loadEvents,700));
})();
