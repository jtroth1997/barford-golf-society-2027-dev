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
    if($("adminResultsEvent"))$("adminResultsEvent").innerHTML=`<option value="">Select event</option>${events.map(event=>`<option value="${event.id}">${esc(event.name)} · Round ${event.round_number||"?"}</option>`).join("")}`;
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
    const holeOptions='<option value="">Not selected</option>'+Array.from({length:18},(_,i)=>`<option value="${i+1}">Hole ${i+1}</option>`).join("");
    $("adminLongestDriveHole").innerHTML=holeOptions;$("adminNearestPinHole").innerHTML=holeOptions;
    $("adminLongestDriveHole").value=String((holes||[]).find(item=>item.longest_drive)?.hole_number||"");
    $("adminNearestPinHole").value=String((holes||[]).find(item=>item.nearest_pin)?.hole_number||"");
    const ready=holes?.length===18&&holes.every(item=>item.red_yards&&item.red_stroke_index);
    renderCards(cards||[],ready);status(ready?"Yellow and red course cards are ready.":"Find the linked course and select the yellow and red tees.");
  }
  function renderCards(cards,holesReady){
    $("adminPrepareScorecards").disabled=!holesReady;
    $("adminScorecardProgress").innerHTML=cards.length?cards.map((card,index)=>`<article class="admin-scorecard-state"><div><strong>Group ${index+1}</strong><small>${String(card.tee_time).slice(0,5)} · Tee ${card.tee_number}</small></div><span class="scorecard-status ${card.status}">${card.status.replace("_"," ")}</span></article>`).join(""):`<p>${holesReady?"Course ready. Prepare scorecards after tee times are published.":"Save the course card first."}</p>`;
    $("adminCompleteRound").disabled=!cards.length||cards.some(card=>card.status!=="submitted");
  }
  async function maybeAutoPrepare(){
    const [{count:holes},{count:tees}]=await Promise.all([client.from("event_holes").select("id",{count:"exact",head:true}).eq("event_id",activeEventId),client.from("tee_times").select("id",{count:"exact",head:true}).eq("event_id",activeEventId).not("member_id","is",null)]);
    if(holes!==18||!tees)return false;
    const {error}=await client.rpc("prepare_event_scorecards",{target_event_id:activeEventId});
    if(error)throw error;return true;
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
    status("Saving course card…");const {error}=await client.from("event_holes").upsert(holes,{onConflict:"event_id,hole_number"});if(error)return status(error.message);let prepared=false;try{prepared=await maybeAutoPrepare();}catch(autoError){return status(autoError.message);}await loadEvent(activeEventId);status(prepared?"Course saved and group scorecards prepared automatically.":"Course card saved. Scorecards will prepare automatically when tee times are published.");
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
    if(holeResult.error||eventResult.error)return status((holeResult.error||eventResult.error).message);let prepared=false;try{prepared=await maybeAutoPrepare();}catch(autoError){return status(autoError.message);}await loadEvent(activeEventId);status(`${course?.textContent||"Course"} loaded with ${yellow.name} and ${red.name} tees.${prepared?" Group scorecards are ready.":" Cards will prepare when tee times are published."}`);
  });
  $("adminSaveCompetitionHoles")?.addEventListener("click",async()=>{
    if(!activeEventId)return status("Select an event first.");
    const ld=Number($("adminLongestDriveHole").value)||null,np=Number($("adminNearestPinHole").value)||null;
    status("Updating competition holes on every scorecard…");
    const {error:clearError}=await client.from("event_holes").update({longest_drive:false,nearest_pin:false}).eq("event_id",activeEventId);if(clearError)return status(clearError.message);
    if(ld){const {error}=await client.from("event_holes").update({longest_drive:true}).eq("event_id",activeEventId).eq("hole_number",ld);if(error)return status(error.message);}
    if(np){const {error}=await client.from("event_holes").update({nearest_pin:true}).eq("event_id",activeEventId).eq("hole_number",np);if(error)return status(error.message);}
    await loadEvent(activeEventId);status("Competition holes saved. Prepared phone scorecards will update when they next connect.");
  });
  $("adminPrepareScorecards")?.addEventListener("click",async()=>{
    status("Preparing tee groups and locking society handicaps…");const {error}=await client.rpc("prepare_event_scorecards",{target_event_id:activeEventId});if(error)return status(error.message);await loadEvent(activeEventId);status("Group scorecards prepared. Players can now open them on their phones.");
  });
  $("adminCompleteRound")?.addEventListener("click",async()=>{
    const event=events.find(item=>item.id===activeEventId);if(!confirm(`Complete ${event?.name||"this round"}? Scores will be added to the league table and next handicaps calculated.`))return;
    const button=$("adminCompleteRound");button.disabled=true;status("Completing the round and updating the league table…");const {error}=await client.rpc("complete_event_round",{target_event_id:activeEventId});if(error){status(error.message);button.disabled=false;return;}await loadEvent(activeEventId);status("Round completed. Scores, league positions and next handicaps are now updated.");
  });
  const shotsReceived=(handicap,index)=>handicap<index?0:Math.floor((handicap-index)/18)+1;
  const playerPoints=(player,holes,scoreMap)=>holes.reduce((total,info)=>{const score=scoreMap.get(`${player.id}:${info.hole_number}`);if(!score||score.picked_up)return total;const women=player.playing_category==="women",par=Number(women?(info.red_par||info.par):info.par),si=Number(women?(info.red_stroke_index||info.stroke_index):info.stroke_index);return total+Math.max(0,2+par-(Number(score.strokes)-shotsReceived(Number(player.handicap_used),si)));},0);
  async function loadResults(eventId){
    const summary=$("adminResultsSummary"),cardsView=$("adminSubmittedCards"),finalView=$("adminFinalResults"),resultStatus=$("adminResultsStatus");cardsView.innerHTML="";finalView.innerHTML="";resultStatus.textContent="";
    if(!eventId){summary.innerHTML="<p>Select an event.</p>";return;}summary.innerHTML="<p>Loading group cards…</p>";
    const [{data:cards,error:cardError},{data:holes,error:holeError}]=await Promise.all([client.from("event_scorecards").select("id,tee_time,tee_number,status,submitted_at").eq("event_id",eventId).order("tee_time"),client.from("event_holes").select("*").eq("event_id",eventId).order("hole_number")]);
    if(cardError||holeError){resultStatus.textContent=(cardError||holeError).message;return;}if(!cards?.length){summary.innerHTML="<p>No group scorecards have been prepared yet.</p>";return;}
    const {data:players,error:playerError}=await client.from("event_scorecard_players").select("id,scorecard_id,display_name,handicap_used,position,playing_category,tee_name").in("scorecard_id",cards.map(card=>card.id)).order("position");if(playerError){resultStatus.textContent=playerError.message;return;}
    const ids=(players||[]).map(player=>player.id);const {data:scores,error:scoreError}=ids.length?await client.from("event_hole_scores").select("scorecard_player_id,hole_number,strokes,picked_up").in("scorecard_player_id",ids):{data:[],error:null};if(scoreError){resultStatus.textContent=scoreError.message;return;}
    const scoreMap=new Map((scores||[]).map(score=>[`${score.scorecard_player_id}:${score.hole_number}`,score]));const submitted=cards.filter(card=>card.status==="submitted"||card.status==="locked"),allSubmitted=submitted.length===cards.length;
    summary.innerHTML=`<div class="results-progress"><strong>${submitted.length} of ${cards.length} cards submitted</strong><span>${allSubmitted?"All cards are in — final event table ready.":"Admins can inspect each card as it is completed."}</span></div>`;
    cardsView.innerHTML=cards.map((card,index)=>{const groupPlayers=(players||[]).filter(player=>player.scorecard_id===card.id),entered=groupPlayers.reduce((sum,player)=>sum+(scores||[]).filter(score=>score.scorecard_player_id===player.id).length,0),expected=groupPlayers.length*18;const playerRows=groupPlayers.map(player=>{const cells=(holes||[]).map(info=>{const value=scoreMap.get(`${player.id}:${info.hole_number}`);return `<span><small>${info.hole_number}</small><b>${value?(value.picked_up?"X":value.strokes):"–"}</b></span>`;}).join("");return `<div class="admin-result-player"><header><strong>${esc(player.display_name)}</strong><b>${playerPoints(player,holes||[],scoreMap)} pts</b></header><div class="admin-result-holes">${cells}</div></div>`;}).join("");return `<details class="admin-result-card" ${card.status==="submitted"?"open":""}><summary><span><strong>Group ${index+1} · ${String(card.tee_time).slice(0,5)}</strong><small>${entered}/${expected} hole scores entered</small></span><span class="scorecard-status ${card.status}">${card.status.replace("_"," ")}</span></summary>${playerRows||"<p>No players attached.</p>"}</details>`;}).join("");
    if(allSubmitted){const rows=(players||[]).map(player=>({name:player.display_name,handicap:player.handicap_used,points:playerPoints(player,holes||[],scoreMap)})).sort((a,b)=>b.points-a.points||a.handicap-b.handicap);finalView.innerHTML=`<h4>Provisional event results</h4><p class="admin-score-help">Private until an administrator completes the round.</p><div class="admin-results-table"><div class="results-head"><b>Pos</b><b>Player</b><b>HCP</b><b>Points</b></div>${rows.map((row,index)=>`<div><strong>${index+1}</strong><span>${esc(row.name)}</span><span>${row.handicap}</span><b>${row.points}</b></div>`).join("")}</div>`;}
  }
  $("adminResultsEvent")?.addEventListener("change",event=>loadResults(event.target.value));
  window.addEventListener("load",()=>setTimeout(loadEvents,700));
})();
