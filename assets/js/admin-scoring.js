(() => {
  "use strict";
  const client=window.BarfordSupabase,$=id=>document.getElementById(id),esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let events=[],activeEventId=null,courses=[],teeSets=[];
  const status=message=>{$("adminLiveScoringStatus").textContent=message;};
  const holeMarkup=(number,data={})=>`<div class="admin-hole-row"><strong>${number}</strong><input data-hole="${number}" data-field="par" type="number" min="3" max="6" value="${data.par||""}" placeholder="Y Par" aria-label="Hole ${number} yellow par"><input data-hole="${number}" data-field="yards" type="number" min="40" max="800" value="${data.yards||""}" placeholder="Y Yards" aria-label="Hole ${number} yellow yards"><input data-hole="${number}" data-field="stroke_index" type="number" min="1" max="18" value="${data.stroke_index||""}" placeholder="Y SI" aria-label="Hole ${number} yellow stroke index"><input data-hole="${number}" data-field="red_par" type="number" min="3" max="6" value="${data.red_par||""}" placeholder="R Par" aria-label="Hole ${number} red par"><input data-hole="${number}" data-field="red_yards" type="number" min="40" max="800" value="${data.red_yards||""}" placeholder="R Yards" aria-label="Hole ${number} red yards"><input data-hole="${number}" data-field="red_stroke_index" type="number" min="1" max="18" value="${data.red_stroke_index||""}" placeholder="R SI" aria-label="Hole ${number} red stroke index"></div>`;

  async function verifyAdmin(){
    if(!client||!$("adminScoringEvent"))return false;
    const {data:{session}}=await client.auth.getSession();if(!session)return false;
    const {data}=await client.from("profiles").select("is_admin").eq("id",session.user.id).single();return Boolean(data?.is_admin);
  }
  async function loadEvents(){
    if(!await verifyAdmin())return;
    const {data,error}=await client.from("events").select("id,name,event_date,status,round_number,latitude,longitude,uk_golf_club_id,uk_golf_course_id,selected_course_name").neq("status","cancelled").order("event_date");
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
    const ready=holes?.length===18&&holes.every(item=>item.red_yards&&item.red_stroke_index);
    renderCards(cards||[],ready);status(ready?"Yellow and red course cards are ready.":"Find the linked course and select the yellow and red tees.");
  }
  function renderCards(cards,holesReady){
    $("adminPrepareScorecards").disabled=!holesReady;
    $("adminScorecardProgress").innerHTML=cards.length?cards.map((card,index)=>`<article class="admin-scorecard-state"><div><strong>Group ${index+1}</strong><small>${String(card.tee_time).slice(0,5)} · Tee ${card.tee_number}</small></div><span class="scorecard-status ${card.status}">${card.status.replace("_"," ")}</span></article>`).join(""):`<p>${holesReady?"Course ready. Prepare scorecards after tee times are published.":"Save the course card first."}</p>`;
    $("adminCompleteRound").disabled=!cards.length||cards.some(card=>card.status!=="submitted");
  }
  function collectHoles(){
    return Array.from({length:18},(_,index)=>{const hole=index+1,field=name=>$("adminHoleEditor").querySelector(`[data-hole="${hole}"][data-field="${name}"]`).value;return{event_id:activeEventId,hole_number:hole,par:Number(field("par")),yards:Number(field("yards")),stroke_index:Number(field("stroke_index")),red_par:Number(field("red_par")),red_yards:Number(field("red_yards")),red_stroke_index:Number(field("red_stroke_index")),yellow_tee_name:"Yellow",red_tee_name:"Red"};});
  }
  async function invokeCourse(body){const {data,error}=await client.functions.invoke("uk-golf-course",{body});if(error)throw new Error(data?.error||error.message);if(data?.error)throw new Error(data.error);return data;}
  const options=(items,prompt)=>`<option value="">${prompt}</option>${items.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}${item.county?` · ${esc(item.county)}`:""}</option>`).join("")}`;
  async function loadClubCourses(clubId){
    if(!clubId)return;status("Loading the club’s courses…");const data=await invokeCourse({action:"courses",club_id:clubId});
    courses=data.courses||[];$("adminGolfCourse").innerHTML=options(courses,"Select the course being played");$("adminGolfCourse").disabled=false;status(courses.length>1?"This club has multiple courses. Select the one being played.":"Select the course being played.");
  }
  async function loadCourseTees(courseId){
    if(!courseId)return;status("Loading the available tees…");teeSets=courses.find(course=>String(course.id)===String(courseId))?.tee_sets||[];
    const teeOptions=options(teeSets,"Select tee");$("adminYellowTee").innerHTML=teeOptions;$("adminRedTee").innerHTML=teeOptions;$("adminYellowTee").disabled=$("adminRedTee").disabled=false;
    const yellow=teeSets.find(tee=>/yellow/i.test(tee.name))||teeSets.find(tee=>/men|male/i.test(tee.gender));
    const red=teeSets.find(tee=>/red/i.test(tee.name))||teeSets.find(tee=>/women|female/i.test(tee.gender));
    if(yellow)$("adminYellowTee").value=yellow.id;if(red)$("adminRedTee").value=red.id;$("adminImportScorecard").disabled=!(yellow&&red);status(yellow&&red?"Yellow and red tees found. Confirm by pressing Use these tees.":"Select the men’s and women’s tees from the available scorecards.");
  }
  $("adminScoringEvent")?.addEventListener("change",event=>loadEvent(event.target.value));
  $("adminSaveHoles")?.addEventListener("click",async()=>{
    const holes=collectHoles(),indexes=holes.map(h=>h.stroke_index);
    const redIndexes=holes.map(h=>h.red_stroke_index);
    if(holes.some(h=>h.par<3||h.par>6||h.yards<40||h.yards>800||h.stroke_index<1||h.stroke_index>18||h.red_par<3||h.red_par>6||h.red_yards<40||h.red_yards>800||h.red_stroke_index<1||h.red_stroke_index>18)||new Set(indexes).size!==18||new Set(redIndexes).size!==18){status("Check both tee cards. Par, yards and each unique stroke index from 1 to 18 are required.");return;}
    status("Saving course card…");const {error}=await client.from("event_holes").upsert(holes,{onConflict:"event_id,hole_number"});if(error)return status(error.message);await loadEvent(activeEventId);status("Course card saved. It is ready for offline scoring.");
  });
  $("adminFindCourseData")?.addEventListener("click",async()=>{try{const event=events.find(item=>item.id===activeEventId);status("Matching the event location with UK Golf API…");const data=await invokeCourse({action:"nearby",latitude:event?.latitude,longitude:event?.longitude,query:event?.name});$("adminGolfClub").innerHTML=options(data.clubs||[],"Select the linked golf club");$("adminGolfClub").disabled=false;const nameMatch=(data.clubs||[]).find(club=>String(event?.name||"").toLowerCase().includes(String(club.name||"").toLowerCase()));if(nameMatch){$("adminGolfClub").value=nameMatch.id;await loadClubCourses(nameMatch.id);}else if(data.clubs?.length===1){$("adminGolfClub").value=data.clubs[0].id;await loadClubCourses(data.clubs[0].id);}else status("Select the correct golf club.");}catch(error){status(error.message);}});
  $("adminGolfClub")?.addEventListener("change",async event=>{try{await loadClubCourses(event.target.value);}catch(error){status(error.message);}});
  $("adminGolfCourse")?.addEventListener("change",async event=>{try{await loadCourseTees(event.target.value);}catch(error){status(error.message);}});
  ["adminYellowTee","adminRedTee"].forEach(id=>$(id)?.addEventListener("change",()=>{$("adminImportScorecard").disabled=!$("adminYellowTee").value||!$("adminRedTee").value;}));
  $("adminImportScorecard")?.addEventListener("click",async()=>{
    const yellowChoice=teeSets.find(tee=>tee.id===$("adminYellowTee").value),redChoice=teeSets.find(tee=>tee.id===$("adminRedTee").value);if(!yellowChoice||!redChoice)return;
    status("Downloading the selected yellow and red scorecards…");let data;try{data=await invokeCourse({action:"scorecard",course_id:$("adminGolfCourse").value,yellow_tee_id:yellowChoice.id,red_tee_id:redChoice.id});}catch(error){status(error.message.includes("429")?"UK Golf API’s request limit has been reached. Please wait one minute and try again.":error.message);return;}const cards=data.tee_sets||[],yellow=cards[0],red=cards[1];if(!yellow||!red)return status("UK Golf API did not return both selected scorecards.");
    const redByHole=new Map(red.holes.map(item=>[item.hole,item]));const holes=yellow.holes.map(item=>{const r=redByHole.get(item.hole);return{event_id:activeEventId,hole_number:item.hole,par:item.par,yards:item.yards,stroke_index:item.stroke_index,red_par:r?.par,red_yards:r?.yards,red_stroke_index:r?.stroke_index,yellow_tee_name:yellow.name||"Yellow",red_tee_name:red.name||"Red"};});
    if(holes.length!==18||holes.some(item=>!item.par||!item.yards||!item.red_par||!item.red_yards)){status("The selected tees do not contain a complete 18-hole scorecard.");return;}if(holes.some(item=>item.stroke_index<1||item.stroke_index>18||item.red_stroke_index<1||item.red_stroke_index>18)||new Set(holes.map(item=>item.stroke_index)).size!==18||new Set(holes.map(item=>item.red_stroke_index)).size!==18){status("UK Golf API is missing one or more stroke indexes for these tees, so the card cannot safely calculate Stableford points. Please use another course record or enter the missing indexes below.");return;}status("Saving both tee scorecards…");
    const event=events.find(item=>item.id===activeEventId),course=$('adminGolfCourse').selectedOptions[0];const [holeResult,eventResult]=await Promise.all([client.from("event_holes").upsert(holes,{onConflict:"event_id,hole_number"}),client.from("events").update({uk_golf_club_id:$("adminGolfClub").value,uk_golf_course_id:$("adminGolfCourse").value,selected_course_name:course?.textContent||event?.name,updated_at:new Date().toISOString()}).eq("id",activeEventId)]);
    if(holeResult.error||eventResult.error)return status((holeResult.error||eventResult.error).message);await loadEvent(activeEventId);status(`${course?.textContent||"Course"} loaded automatically with ${yellow.name} and ${red.name} tees.`);
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
