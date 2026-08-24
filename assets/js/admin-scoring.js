(() => {
  "use strict";
  const client=window.BarfordSupabase,$=id=>document.getElementById(id),esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let events=[],activeEventId=null,courses=[],teeSets=[];
  const status=message=>{$("adminLiveScoringStatus").textContent=message;};
  const saved=message=>{const box=$("adminScorecardSaved");if(!box)return;box.querySelector("span").textContent=message;box.classList.remove("hidden");};
  const holeMarkup=(number,data={})=>`<div class="admin-hole-row"><strong>${number}</strong><input data-hole="${number}" data-field="par" type="number" min="3" max="6" value="${data.par||""}" placeholder="Y Par" aria-label="Hole ${number} yellow par"><input data-hole="${number}" data-field="yards" type="number" min="40" max="800" value="${data.yards||""}" placeholder="Y Yards" aria-label="Hole ${number} yellow yards"><input data-hole="${number}" data-field="stroke_index" type="number" min="1" max="18" value="${data.stroke_index||""}" placeholder="Y SI" aria-label="Hole ${number} yellow stroke index"><input data-hole="${number}" data-field="red_par" type="number" min="3" max="6" value="${data.red_par||""}" placeholder="R Par" aria-label="Hole ${number} red par"><input data-hole="${number}" data-field="red_yards" type="number" min="40" max="800" value="${data.red_yards||""}" placeholder="R Yards" aria-label="Hole ${number} red yards"><input data-hole="${number}" data-field="red_stroke_index" type="number" min="1" max="18" value="${data.red_stroke_index||""}" placeholder="R SI" aria-label="Hole ${number} red stroke index"></div>`;

  async function verifyAdmin(){
    if(!client||!$("adminScoringEvent"))return false;
    const {data:{session}}=await client.auth.getSession();if(!session)return false;
    const {data}=await client.from("profiles").select("is_admin").eq("id",session.user.id).single();return Boolean(data?.is_admin);
  }
  async function loadEvents(){
    if(!await verifyAdmin())return;
    const {data,error}=await client.from("events").select("id,name,event_date,status,round_number,latitude,longitude,uk_golf_club_id,uk_golf_course_id,selected_course_name,longest_drive_winner_id,nearest_pin_winner_id").neq("status","cancelled").order("event_date");
    if(error)return status(error.message);events=data||[];
    $("adminScoringEvent").innerHTML=`<option value="">Select event</option>${events.map(event=>`<option value="${event.id}">${esc(event.name)} · Round ${event.round_number||"?"}</option>`).join("")}`;
    if($("adminResultsEvent"))$("adminResultsEvent").innerHTML=`<option value="">Select event</option>${events.map(event=>`<option value="${event.id}">${esc(event.name)} · Round ${event.round_number||"?"}</option>`).join("")}`;
  }
  async function loadEvent(eventId){
    activeEventId=eventId;$("adminScoringSetup").classList.toggle("hidden",!eventId);$("adminScorecardSaved")?.classList.add("hidden");if(!eventId){$("adminResultsSummary").innerHTML="<p>Select an event.</p>";$("adminSubmittedCards").innerHTML="";$("adminFinalResults").innerHTML="";return;}
    status("Loading course card…");
    try{
      const [{data:holes,error:holeError},{data:cards,error:cardError}]=await Promise.all([
        client.from("event_holes").select("hole_number,par,yards,stroke_index,red_par,red_yards,red_stroke_index,yellow_tee_name,red_tee_name,longest_drive,nearest_pin").eq("event_id",eventId).order("hole_number"),
        client.from("event_scorecards").select("id,tee_time,tee_number,status,submitted_at,scorer_id").eq("event_id",eventId).order("tee_time")
      ]);
      if(eventId!==activeEventId)return;
      if(holeError)throw holeError;
      status("Course data received — preparing the scorecard…");
      const byHole=new Map((holes||[]).map(item=>[item.hole_number,item]));
      $("adminHoleEditor").innerHTML=Array.from({length:18},(_,i)=>holeMarkup(i+1,byHole.get(i+1))).join("");
      const holeOptions='<option value="">Not selected</option>'+Array.from({length:18},(_,i)=>`<option value="${i+1}">Hole ${i+1}</option>`).join("");
      $("adminLongestDriveHole").innerHTML=holeOptions;$("adminNearestPinHole").innerHTML=holeOptions;
      $("adminLongestDriveHole").value=String((holes||[]).find(item=>item.longest_drive)?.hole_number||"");
      $("adminNearestPinHole").value=String((holes||[]).find(item=>item.nearest_pin)?.hole_number||"");
      const ready=holes?.length===18&&holes.every(item=>item.red_yards&&item.red_stroke_index);
      renderCards([],ready);updateChecklist(ready,[]);
      status(ready?"Course card ready — loading group scorecards…":"Find the linked course and select the yellow and red tees.");
      if(eventId!==activeEventId)return;
      if(cardError)throw cardError;
      renderCards(cards||[],ready);updateChecklist(ready,cards||[]);$("adminResultsEvent").value=eventId;
      loadResults(eventId).catch(error=>{$("adminResultsStatus").textContent=error?.message||"Could not load submitted cards.";});
      const event=events.find(item=>item.id===eventId);
      const linked=ready&&showSavedLinkedCourse(event,holes||[]);
      status(linked?`${event?.selected_course_name||event?.venue||event?.name} is already linked and its yellow and red scorecards are ready.`:ready?"Yellow and red course cards are ready.":"Find the linked course and select the yellow and red tees.");
    }catch(error){
      console.error("Admin course-card load failed",error);
      status(`Course-card loading failed: ${error?.message||"Unknown error"}`);
    }
  }
  function updateChecklist(courseReady,cards){
    const set=(name,done,label,current=false)=>{const item=document.querySelector(`[data-score-check="${name}"]`);if(!item)return;item.classList.toggle("is-done",done);item.classList.toggle("is-current",current&&!done);item.querySelector("small").textContent=label;};
    const prepared=cards.length>0,submitted=prepared&&cards.every(card=>["submitted","locked"].includes(card.status)),finished=prepared&&cards.every(card=>card.status==="locked");
    const submittedCount=cards.filter(card=>["submitted","locked"].includes(card.status)).length;
    set("event",true,"Ready");
    set("course",courseReady,courseReady?"Saved":"Do this next",true);
    set("cards",prepared,prepared?`${cards.length} group card${cards.length===1?"":"s"} ready`:courseReady?"Do this next":"Waiting",courseReady);
    set("submitted",submitted,prepared?`${submittedCount} of ${cards.length} submitted`:"Waiting",prepared);
    set("finished",finished,finished?"Complete":submitted?"Ready to finish":"Waiting",submitted);
  }
  function renderCards(cards,holesReady){
    $("adminPrepareScorecards").disabled=!holesReady;
    $("adminScorecardProgress").innerHTML=cards.length?cards.map((card,index)=>`<article class="admin-scorecard-state"><div><strong>Group ${index+1}</strong><small>${String(card.tee_time).slice(0,5)} · Tee ${card.tee_number}</small></div><span class="scorecard-status ${card.status}">${card.status.replace("_"," ")}</span></article>`).join(""):`<p>${holesReady?"Course ready. Prepare scorecards after tee times are published.":"Save the course card first."}</p>`;
    const ended=cards.length&&cards.every(card=>card.status==="locked"),allSubmitted=cards.length&&cards.every(card=>card.status==="submitted");
    $("adminCompleteRound").disabled=!allSubmitted;
    $("adminCompleteRound").textContent=ended?"Round ended":allSubmitted?"End round and publish results":"Waiting for scorecards";
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
  function showSavedLinkedCourse(event, holes){
    const courseName=event?.selected_course_name||event?.venue||event?.name;
    if(!courseName||holes?.length!==18)return false;
    const yellowName=holes.find(h=>h.yellow_tee_name)?.yellow_tee_name||"Yellow";
    const redName=holes.find(h=>h.red_tee_name)?.red_tee_name||"Red";
    $("adminGolfClub").innerHTML=`<option value="${esc(event?.uk_golf_club_id||"linked")}">${esc(event?.venue||event?.name||"Linked club")}</option>`;
    $("adminGolfClub").disabled=false;
    $("adminGolfCourse").innerHTML=`<option value="${esc(event?.uk_golf_course_id||"linked")}" selected>${esc(courseName)}</option>`;
    $("adminGolfCourse").disabled=false;
    $("adminYellowTee").innerHTML=`<option value="saved-yellow" selected>${esc(yellowName)}</option>`;
    $("adminRedTee").innerHTML=`<option value="saved-red" selected>${esc(redName)}</option>`;
    $("adminYellowTee").disabled=false;$("adminRedTee").disabled=false;
    $("adminImportScorecard").disabled=true;
    $("adminFindCourseData").textContent="Course card already saved";
    return true;
  }
  async function loadClubCourses(clubId){
    if(!clubId)return;status("Loading the club’s courses…");const data=await invokeCourse({action:"courses",club_id:clubId});
    courses=data.courses||[];
    if(!courses.length){
      $("adminGolfCourse").innerHTML='<option value="">No courses returned — use the saved course card or try again later</option>';
      $("adminGolfCourse").disabled=true;
      $("adminYellowTee").innerHTML='<option value="">Load a course first</option>';$("adminRedTee").innerHTML='<option value="">Load a course first</option>';
      $("adminYellowTee").disabled=$("adminRedTee").disabled=true;
      status("No course records were returned. The saved scorecard remains available; try Find linked course again later if you need to replace it.");
      return;
    }
    $("adminGolfCourse").innerHTML=options(courses,"Select the course being played");$("adminGolfCourse").disabled=false;status(courses.length>1?"This club has multiple courses. Select the one being played.":"Select the course being played.");
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
    status("Saving course card…");const {error}=await client.from("event_holes").upsert(holes,{onConflict:"event_id,hole_number"});if(error)return status(error.message);const {error:workflowError}=await client.from("events").update({scorecards_status:"course_verified",updated_at:new Date().toISOString()}).eq("id",activeEventId);if(workflowError)return status(workflowError.message);await loadEvent(activeEventId);saved("Course and tee information saved successfully.");status("Course card saved. Publish tee times first, then create group scorecards when you are ready.");
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
    if(holeResult.error||eventResult.error)return status((holeResult.error||eventResult.error).message);const {error:workflowError}=await client.from("events").update({scorecards_status:"course_verified",updated_at:new Date().toISOString()}).eq("id",activeEventId);if(workflowError)return status(workflowError.message);await loadEvent(activeEventId);saved(`${course?.textContent||"Course"} saved with ${yellow.name} and ${red.name} tees.`);status(`${course?.textContent||"Course"} loaded with ${yellow.name} and ${red.name} tees. Publish tee times first, then create group scorecards when you are ready.`);
  });
  $("adminSaveCompetitionHoles")?.addEventListener("click",async()=>{
    if(!activeEventId)return status("Select an event first.");
    const ld=Number($("adminLongestDriveHole").value)||null,np=Number($("adminNearestPinHole").value)||null;
    status("Updating competition holes on every scorecard…");
    const {error:clearError}=await client.from("event_holes").update({longest_drive:false,nearest_pin:false}).eq("event_id",activeEventId);if(clearError)return status(clearError.message);
    if(ld){const {error}=await client.from("event_holes").update({longest_drive:true}).eq("event_id",activeEventId).eq("hole_number",ld);if(error)return status(error.message);}
    if(np){const {error}=await client.from("event_holes").update({nearest_pin:true}).eq("event_id",activeEventId).eq("hole_number",np);if(error)return status(error.message);}
    await loadEvent(activeEventId);saved("Longest Drive and Nearest the Pin holes saved successfully.");status("Competition holes saved. Prepared phone scorecards will update when they next connect.");
  });
  $("adminPrepareScorecards")?.addEventListener("click",async()=>{
    status("Preparing tee groups and locking society handicaps…");const {error}=await client.rpc("prepare_event_scorecards",{target_event_id:activeEventId});if(error)return status(error.message);const {error:workflowError}=await client.from("events").update({scorecards_status:"published",results_status:"collecting",updated_at:new Date().toISOString()}).eq("id",activeEventId);if(workflowError)return status(workflowError.message);await loadEvent(activeEventId);saved("Group scorecards created successfully. Players can now open them.");status("Group scorecards prepared. Players can now open them on their phones.");
  });
  $("adminCompleteRound")?.addEventListener("click",async()=>{
    const event=events.find(item=>item.id===activeEventId);if(!confirm(`END ${event?.name||"this round"}?\n\nThis publishes every submitted score to the league table, confirms the finishing positions and calculates each player's next society handicap.`))return;
    const completedEventId=activeEventId,button=$("adminCompleteRound");button.disabled=true;button.textContent="Ending round…";status("Ending the round and publishing the official results…");
    const {error:winnerError}=await client.from("events").update({longest_drive_winner_id:$("adminLongestDriveWinner").value||null,nearest_pin_winner_id:$("adminNearestPinWinner").value||null,updated_at:new Date().toISOString()}).eq("id",completedEventId);if(winnerError){status(winnerError.message);button.disabled=false;button.textContent="Finish round and publish results";return;}
    const {error}=await client.rpc("complete_event_round",{target_event_id:completedEventId});if(error){status(error.message);button.disabled=false;button.textContent="Finish round and publish results";return;}const {error:workflowError}=await client.from("events").update({results_status:"published",updated_at:new Date().toISOString()}).eq("id",completedEventId);if(workflowError){status(`Results are published, but the workflow status needs refreshing: ${workflowError.message}`);return;}
    await loadEvents();$("adminScoringEvent").value=completedEventId;await loadEvent(completedEventId);status("Round ended. The league table, finishing positions and next handicaps are updated.");
    $("adminFinalResults")?.scrollIntoView({behavior:"smooth",block:"start"});
  });
  const shotsReceived=(handicap,index)=>handicap<index?0:Math.floor((handicap-index)/18)+1;
  const holePoints=(player,info,scoreMap)=>{const score=scoreMap.get(`${player.id}:${info.hole_number}`);if(!score||score.picked_up)return 0;const women=player.playing_category==="women",par=Number(women?(info.red_par||info.par):info.par),si=Number(women?(info.red_stroke_index||info.stroke_index):info.stroke_index);return Math.max(0,2+par-(Number(score.strokes)-shotsReceived(Number(player.handicap_used),si)));};
  const playerResult=(player,holes,scoreMap)=>{const points=(holes||[]).map(info=>({hole:info.hole_number,points:holePoints(player,info,scoreMap)})),sum=from=>points.filter(item=>item.hole>=from).reduce((total,item)=>total+item.points,0);return{memberId:player.member_id,name:player.display_name,handicap:Number(player.handicap_used),points:sum(1),back9:sum(10),last6:sum(13),last3:sum(16),last1:sum(18)};};
  const resultSort=(a,b)=>b.points-a.points||b.back9-a.back9||b.last6-a.last6||b.last3-a.last3||b.last1-a.last1||a.handicap-b.handicap||String(a.memberId).localeCompare(String(b.memberId));
  const playerPoints=(player,holes,scoreMap)=>playerResult(player,holes,scoreMap).points;
  const positionCards=rows=>{
    const choices=[["1st place",rows[0],"winner"],["2nd place",rows[1],""],["3rd place",rows[2],""],["Last place",rows[rows.length-1],""]];
    return `<div class="admin-position-grid">${choices.map(([label,row,className])=>`<article class="admin-position-card ${className}"><strong>${label}</strong><span>${row?esc(row.name):"Not awarded"}</span><small>${row?`${row.points} points · HCP ${row.handicap}`:"Fewer than three players"}</small></article>`).join("")}</div>`;
  };
  const resultsTable=rows=>`<div class="admin-results-table"><div class="results-head"><b>Pos</b><b>Player</b><b>HCP</b><b>Points</b></div>${rows.map((row,index)=>`<div><strong>${index+1}</strong><span>${esc(row.name)}</span><span>${row.handicap}</span><b>${row.points}</b></div>`).join("")}</div>`;
  async function loadResults(eventId){
    const summary=$("adminResultsSummary"),cardsView=$("adminSubmittedCards"),finalView=$("adminFinalResults"),resultStatus=$("adminResultsStatus");cardsView.innerHTML="";finalView.innerHTML="";resultStatus.textContent="";
    if(!eventId){summary.innerHTML="<p>Select an event.</p>";return;}summary.innerHTML="<p>Loading group cards…</p>";
    const [{data:cards,error:cardError},{data:holes,error:holeError}]=await Promise.all([client.from("event_scorecards").select("id,tee_time,tee_number,status,submitted_at").eq("event_id",eventId).order("tee_time"),client.from("event_holes").select("*").eq("event_id",eventId).order("hole_number")]);
    if(cardError||holeError){resultStatus.textContent=(cardError||holeError).message;return;}if(!cards?.length){summary.innerHTML="<p>No group scorecards have been prepared yet.</p>";return;}
    const {data:players,error:playerError}=await client.from("event_scorecard_players").select("id,scorecard_id,member_id,display_name,handicap_used,position,playing_category,tee_name").in("scorecard_id",cards.map(card=>card.id)).order("position");if(playerError){resultStatus.textContent=playerError.message;return;}
    const uniquePlayers=Array.from(new Map((players||[]).map(player=>[player.member_id,player])).values()),winnerOptions='<option value="">Not awarded</option>'+uniquePlayers.map(player=>`<option value="${player.member_id}">${esc(player.display_name)}</option>`).join(""),event=events.find(item=>item.id===eventId);
    $("adminLongestDriveWinner").innerHTML=winnerOptions;$("adminNearestPinWinner").innerHTML=winnerOptions;$("adminLongestDriveWinner").value=event?.longest_drive_winner_id||"";$("adminNearestPinWinner").value=event?.nearest_pin_winner_id||"";
    const ids=(players||[]).map(player=>player.id);const {data:scores,error:scoreError}=ids.length?await client.from("event_hole_scores").select("scorecard_player_id,hole_number,strokes,picked_up").in("scorecard_player_id",ids):{data:[],error:null};if(scoreError){resultStatus.textContent=scoreError.message;return;}
    const scoreMap=new Map((scores||[]).map(score=>[`${score.scorecard_player_id}:${score.hole_number}`,score]));const submitted=cards.filter(card=>card.status==="submitted"||card.status==="locked"),allSubmitted=submitted.length===cards.length;
    summary.innerHTML=`<div class="results-progress"><strong>${submitted.length} of ${cards.length} cards submitted</strong><span>${allSubmitted?"All cards are in — final event table ready.":"Admins can inspect each card as it is completed."}</span></div>`;
    cardsView.innerHTML=cards.map((card,index)=>{const groupPlayers=(players||[]).filter(player=>player.scorecard_id===card.id),entered=groupPlayers.reduce((sum,player)=>sum+(scores||[]).filter(score=>score.scorecard_player_id===player.id).length,0),expected=groupPlayers.length*18;const playerRows=groupPlayers.map(player=>{const cells=(holes||[]).map(info=>{const value=scoreMap.get(`${player.id}:${info.hole_number}`);return `<span><small>${info.hole_number}</small><b>${value?(value.picked_up?"X":value.strokes):"–"}</b></span>`;}).join("");return `<div class="admin-result-player"><header><strong>${esc(player.display_name)}</strong><b>${playerPoints(player,holes||[],scoreMap)} pts</b></header><div class="admin-result-holes">${cells}</div></div>`;}).join(""),reopen=card.status==="submitted"?`<button class="button button-outline admin-reopen-card" type="button" data-reopen-card="${card.id}">Reopen this card</button>`:"";return `<details class="admin-result-card" ${card.status==="submitted"?"open":""}><summary><span><strong>Group ${index+1} · ${String(card.tee_time).slice(0,5)}</strong><small>${entered}/${expected} hole scores entered</small></span><span class="scorecard-status ${card.status}">${card.status.replace("_"," ")}</span></summary>${playerRows||"<p>No players attached.</p>"}${reopen}</details>`;}).join("");
    cardsView.querySelectorAll("[data-reopen-card]").forEach(button=>button.addEventListener("click",async()=>{if(!confirm("Reopen this submitted card so the nominated scorer can correct it?"))return;resultStatus.textContent="Reopening scorecard…";const {error}=await client.rpc("reopen_event_scorecard",{target_scorecard_id:button.dataset.reopenCard});if(error){resultStatus.textContent=error.message;return;}await loadEvent(eventId);resultStatus.textContent="Scorecard reopened. The scorer can now make corrections and submit it again.";}));
    if(allSubmitted){
      const provisional=(players||[]).map(player=>playerResult(player,holes||[],scoreMap)).sort(resultSort);
      const {data:round,error:roundError}=await client.from("rounds").select("id,locked").eq("event_id",eventId).maybeSingle();if(roundError){resultStatus.textContent=roundError.message;return;}
      let rows=provisional,official=false;
      if(round?.locked){const {data:published,error:publishedError}=await client.from("scores").select("member_id,handicap_used,points,winner,runner_up,third_place,next_handicap,longest_drive,nearest_pin").eq("round_id",round.id).eq("dnp",false);if(publishedError){resultStatus.textContent=publishedError.message;return;}const names=new Map((players||[]).map(player=>[player.member_id,player.display_name])),breakdowns=new Map(provisional.map(row=>[row.memberId,row]));rows=(published||[]).map(score=>({...breakdowns.get(score.member_id),memberId:score.member_id,name:names.get(score.member_id)||"Member",handicap:Number(score.handicap_used),points:Number(score.points),nextHandicap:score.next_handicap,longestDrive:score.longest_drive,nearestPin:score.nearest_pin,winner:score.winner,runnerUp:score.runner_up,thirdPlace:score.third_place})).sort((a,b)=>Number(b.winner)-Number(a.winner)||Number(b.runnerUp)-Number(a.runnerUp)||Number(b.thirdPlace)-Number(a.thirdPlace)||resultSort(a,b));official=true;}
      const competition=official?`<div class="admin-competition-winners"><strong>Longest Drive</strong><span>${esc(rows.find(row=>row.longestDrive)?.name||"Not awarded")}</span><strong>Nearest the Pin</strong><span>${esc(rows.find(row=>row.nearestPin)?.name||"Not awarded")}</span></div>`:"";
      finalView.innerHTML=`${official?'<span class="official-results-label">Official results</span><h4>Committee finishing positions</h4><p class="admin-score-help">Published to the league table. Society handicaps have been updated for the next round.</p>':'<h4>Provisional event results</h4><p class="admin-score-help">Check these positions, then use Finish Round above to publish them.</p>'}${positionCards(rows)}${competition}${resultsTable(rows)}`;
    }
  }
  $("adminResultsEvent")?.addEventListener("change",event=>loadResults(event.target.value));
  loadEvents();
})();
