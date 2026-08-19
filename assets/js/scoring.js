(() => {
  "use strict";
  const client=window.BarfordSupabase;
  const $=id=>document.getElementById(id);
  const show=id=>$(id)?.classList.remove("hidden"), hide=id=>$(id)?.classList.add("hidden");
  if(!client||!$("scoreApp"))return;
  let session,card,players=[],holes=[],scores={},hole=1,selected=null,saving=false;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const key=(pid,h)=>`${pid}:${h}`;
  const tee=(p,h)=>p.playing_category==="women"?{par:+(h.red_par||h.par),yards:+(h.red_yards||h.yards),si:+(h.red_stroke_index||h.stroke_index),name:h.red_tee_name||"Red"}:{par:+h.par,yards:+h.yards,si:+h.stroke_index,name:h.yellow_tee_name||"Yellow"};
  const shots=(hcp,si)=>hcp<si?0:Math.floor((hcp-si)/18)+1;
  const points=(p,h,v)=>!v||v.picked_up?0:Math.max(0,2+tee(p,h).par-(+v.strokes-shots(+p.handicap_used,tee(p,h).si)));
  const badge=t=>{if($("scoreSyncButton"))$("scoreSyncButton").textContent=t.startsWith("Saved")?`✓ ${t}`:t;};

  async function load(){
    try{
      const auth=await client.auth.getSession();session=auth.data.session;if(!session)throw new Error("Please sign in again.");
      const {data:cards,error}=await client.from("event_scorecards").select("id,event_id,status,scorer_id,tee_time,tee_number,updated_at").eq("scorer_id",session.user.id).in("status",["ready","in_progress"]).order("updated_at",{ascending:false}).limit(1);
      if(error)throw error;if(!cards?.length)throw new Error("No active scorecard is assigned to you. Choose the scorer from your group on the dashboard first.");
      card=cards[0];
      const [pr,hr]=await Promise.all([
        client.from("event_scorecard_players").select("id,member_id,display_name,handicap_used,position,playing_category,tee_name").eq("scorecard_id",card.id).order("position"),
        client.from("event_holes").select("hole_number,par,yards,stroke_index,red_par,red_yards,red_stroke_index,yellow_tee_name,red_tee_name,longest_drive,nearest_pin").eq("event_id",card.event_id).order("hole_number")
      ]);
      if(pr.error)throw pr.error;if(hr.error)throw hr.error;players=pr.data||[];holes=hr.data||[];
      if(!players.length||holes.length!==18)throw new Error("The prepared card is incomplete. Ask an administrator to prepare the scorecard again.");
      const {data:existing,error:se}=await client.from("event_hole_scores").select("scorecard_player_id,hole_number,strokes,picked_up").in("scorecard_player_id",players.map(p=>p.id));
      if(se)throw se;(existing||[]).forEach(v=>scores[key(v.scorecard_player_id,v.hole_number)]=v);
      selected=players[0]?.id;hide("scoreLoading");hide("scoreUnavailable");show("scoreReady");render();badge("Saved");
    }catch(e){hide("scoreLoading");show("scoreUnavailable");if($("scoreUnavailableMessage"))$("scoreUnavailableMessage").textContent=e.message||"Scorecard could not be loaded.";}
  }

  function render(){
    const h=holes.find(x=>x.hole_number===hole);if(!h)return;
    $("holeProgress").textContent=`Hole ${hole} of 18`;$("holeTitle").textContent=`Hole ${hole}`;
    $("holePar").textContent=`Par ${h.par}`;$("holeYards").textContent=h.yards?`${h.yards} yards`:"Yards TBC";$("holeIndex").textContent=`SI ${h.stroke_index}`;
    $("redHolePar").textContent=`Par ${h.red_par||h.par}`;$("redHoleYards").textContent=h.red_yards?`${h.red_yards} yards`:"Yards TBC";$("redHoleIndex").textContent=`SI ${h.red_stroke_index||h.stroke_index}`;
    const cats=new Set(players.map(p=>p.playing_category));$("yellowTeeSummary")?.classList.toggle("hidden",cats.size===1&&cats.has("women"));$("redTeeSummary")?.classList.toggle("hidden",cats.size===1&&cats.has("men"));
    const marker=$("competitionMarker"), comps=[];if(h.longest_drive)comps.push("LONGEST DRIVE");if(h.nearest_pin)comps.push("NEAREST THE PIN");if(marker){marker.textContent=comps.join(" · ");marker.classList.toggle("hidden",!comps.length);}
    $("previousHole").textContent=hole===1?"":`‹ Hole ${hole-1}`;$("previousHole").disabled=hole===1;$("previousHoleBottom").disabled=hole===1;$("nextHoleTop").textContent=hole===18?"Review ›":`Hole ${hole+1} ›`;$("nextHole").textContent=hole===18?"Review scores":"Next hole";
    const p=players.find(x=>x.id===selected);if(p){const t=tee(p,h);$("selectedPlayerPrompt").innerHTML=`<strong>${esc(p.display_name)}</strong><small>HCP ${p.handicap_used} · ${esc(t.name)} · ${t.yards}yd</small>`;}
    renderStrip();
  }

  function renderStrip(){
    const start=hole<=9?1:10,nums=Array.from({length:9},(_,i)=>start+i);
    const head=nums.map(n=>`<b class="${n===hole?"is-current":""}">${n}</b>`).join("");
    const rows=players.map(p=>`<div class="live-card-row ${selected===p.id?"is-selected-player":""}"><button type="button" class="live-player-name" data-player="${p.id}">${esc(p.display_name.split(/\s+/)[0])}</button>${nums.map(n=>{const v=scores[key(p.id,n)],hi=holes.find(x=>x.hole_number===n),txt=v?(v.picked_up?"X":`${v.strokes}/${points(p,hi,v)}`):"–";return `<button type="button" data-cell-player="${p.id}" data-cell-hole="${n}" class="${n===hole?"is-current":""} ${v?"has-score":""}">${txt}</button>`}).join("")}</div>`).join("");
    $("liveNineStrip").innerHTML=`<div class="live-card-header"><strong>${start===1?"Front 9":"Back 9"}</strong>${head}</div>${rows}`;
    $("liveNineStrip").querySelectorAll("[data-player]").forEach(b=>b.onclick=()=>{selected=b.dataset.player;render()});
    $("liveNineStrip").querySelectorAll("[data-cell-player]").forEach(b=>b.onclick=()=>{selected=b.dataset.cellPlayer;hole=+b.dataset.cellHole;render()});
  }

  async function setScore(value,picked=false){
    if(!selected||saving)return;scores[key(selected,hole)]={scorecard_player_id:selected,hole_number:hole,strokes:picked?null:value,picked_up:picked};render();badge("Saving…");saving=true;
    const changes=Object.values(scores).map(v=>({player_id:v.scorecard_player_id,hole:v.hole_number,strokes:v.picked_up?null:+v.strokes,picked_up:!!v.picked_up}));
    const {error}=await client.rpc("sync_scorecard",{target_scorecard_id:card.id,score_changes:changes});saving=false;badge(error?"Saved offline":"Saved");
  }
  document.querySelectorAll("[data-score]").forEach(b=>b.addEventListener("click",()=>setScore(+b.dataset.score,false)));
  $("pickupScore")?.addEventListener("click",()=>setScore(null,true));
  $("clearScore")?.addEventListener("click",async()=>{if(!selected)return;delete scores[key(selected,hole)];render();badge("Saving…");const changes=Object.values(scores).map(v=>({player_id:v.scorecard_player_id,hole:v.hole_number,strokes:v.picked_up?null:+v.strokes,picked_up:!!v.picked_up}));const {error}=await client.rpc("sync_scorecard",{target_scorecard_id:card.id,score_changes:changes});badge(error?"Saved offline":"Saved")});
  const move=d=>{hole=Math.max(1,Math.min(18,hole+d));render();window.scrollTo({top:0,behavior:"auto"})};
  $("previousHole")?.addEventListener("click",()=>move(-1));$("previousHoleBottom")?.addEventListener("click",()=>move(-1));$("nextHoleTop")?.addEventListener("click",()=>move(1));$("nextHole")?.addEventListener("click",()=>move(1));
  $("scoreSyncButton")?.addEventListener("click",()=>{const v=scores[key(selected,hole)];if(v)setScore(v.strokes,v.picked_up)});
  load();
})();