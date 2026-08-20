(() => {
  "use strict";
  if (window.__barfordScorerSelectionLoaded) return;
  window.__barfordScorerSelectionLoaded = true;
  const client = window.BarfordSupabase;
  const host = document.getElementById("dashboardTeeGroup");
  const scoreLink = document.querySelector(".event-scorecard-cta");
  const nextStepText = document.getElementById("dashboardNextStepText");
  const nextStepBox = document.getElementById("dashboardNextStep");
  if (!client || !host) return;
  if (scoreLink) scoreLink.classList.add("hidden");
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const setNextStep=(message,action=false)=>{if(nextStepText)nextStepText.textContent=message;nextStepBox?.classList.toggle("needs-action",action);nextStepBox?.classList.toggle("score-ready",!action);};
  let rendering=false;

  async function getState(){
    const {data:{session}}=await client.auth.getSession(); if(!session)return null;
    const {data:memberships,error:membershipError}=await client.from("event_scorecard_players").select("scorecard_id").eq("member_id",session.user.id);
    if(membershipError||!memberships?.length)return null;
    const {data:cards,error:cardError}=await client.from("event_scorecards").select("id,event_id,status,scorer_id,updated_at").in("id",memberships.map(x=>x.scorecard_id)).in("status",["ready","in_progress","submitted","locked"]).order("updated_at",{ascending:false}).limit(1);
    if(cardError||!cards?.length)return null;
    const card=cards[0];
    const {data:players,error:playersError}=await client.from("event_scorecard_players").select("member_id,display_name,position").eq("scorecard_id",card.id).order("position");
    if(playersError||!players?.length)return null;
    return {session,card,players};
  }

  async function setScorer(card,memberId){return client.rpc("select_scorecard_scorer",{target_event_id:card.event_id,target_scorer_id:memberId});}

  function showChangeChooser(box,state){
    const {session,card,players}=state,current=players.find(p=>p.member_id===card.scorer_id);
    box.innerHTML=`<strong style="display:block;font-size:1rem;margin-bottom:4px">Change scorer</strong><small style="display:block;margin-bottom:12px">Choose another player in this group. All scores already entered stay on this scorecard and the new scorer continues from exactly where you left off.</small><div style="display:grid;grid-template-columns:repeat(${Math.min(players.length,2)},minmax(0,1fr));gap:8px">${players.filter(p=>p.member_id!==card.scorer_id).map(p=>`<button type="button" class="button button-outline" data-transfer-scorer="${p.member_id}">${esc(p.display_name)}${p.member_id===session.user.id?" (You)":""}</button>`).join("")}</div><button type="button" class="button button-outline" data-cancel-transfer style="margin-top:8px">Cancel</button><small id="dashboardScorerStatus" style="display:block;margin-top:8px"></small>`;
    box.querySelector("[data-cancel-transfer]")?.addEventListener("click",()=>render());
    box.querySelectorAll("[data-transfer-scorer]").forEach(btn=>btn.addEventListener("click",async()=>{const chosen=players.find(p=>p.member_id===btn.dataset.transferScorer);if(!confirm(`Change scorer from ${current?.display_name||"the current scorer"} to ${chosen?.display_name||"this player"}? All scores already entered will be kept.`))return;box.querySelectorAll("button").forEach(b=>b.disabled=true);const status=document.getElementById("dashboardScorerStatus");if(status)status.textContent="Transferring scorecard…";const {error}=await setScorer(card,btn.dataset.transferScorer);if(error){if(status)status.textContent=error.message;box.querySelectorAll("button").forEach(b=>b.disabled=false);return;}await render();}));
  }

  async function render(){
    if(rendering)return;rendering=true;
    try{
      if(scoreLink)scoreLink.classList.add("hidden");
      const state=await getState();if(!state)return;
      const {session,card,players}=state;
      let box=document.getElementById("dashboardScorerChoice");
      if(!box){box=document.createElement("section");box.id="dashboardScorerChoice";box.style.cssText="margin:16px 0 4px;padding:16px;border:1px solid #e3d7b5;border-radius:14px;background:#fffaf0";host.insertBefore(box,host.querySelector(".tee-group-actions")||null);}
      const scorer=players.find(p=>p.member_id===card.scorer_id);
      if(card.status==="ready"&&!card.scorer_id){
        setNextStep("Pick a scorer to get access to your group scorecard.",true);
        box.innerHTML=`<strong style="display:block;font-size:1rem;margin-bottom:4px">Pick your group scorer</strong><small style="display:block;margin-bottom:12px">Choose who will keep score for the group. The scorecard stays locked until a scorer is selected.</small><div style="display:grid;grid-template-columns:repeat(${Math.min(players.length,2)},minmax(0,1fr));gap:8px">${players.map(p=>`<button type="button" class="button button-outline" data-pick-scorer="${p.member_id}">${esc(p.display_name)}${p.member_id===session.user.id?" (You)":""}</button>`).join("")}</div><small id="dashboardScorerStatus" style="display:block;margin-top:8px"></small>`;
        box.querySelectorAll("[data-pick-scorer]").forEach(btn=>btn.addEventListener("click",async()=>{const scrollY=window.scrollY;box.querySelectorAll("button").forEach(b=>b.disabled=true);const status=document.getElementById("dashboardScorerStatus");if(status)status.textContent="Saving scorer…";const {error}=await setScorer(card,btn.dataset.pickScorer);if(error){if(status)status.textContent=error.message;box.querySelectorAll("button").forEach(b=>b.disabled=false);return;}await render();requestAnimationFrame(()=>window.scrollTo({top:scrollY,behavior:"auto"}));}));return;
      }
      if(scorer&&["ready","in_progress"].includes(card.status)){
        const isMe=scorer.member_id===session.user.id;
        setNextStep(isMe?"You’re the scorer. Your group scorecard is ready to open.":`${scorer.display_name} is your group scorer. The scorecard is now active.`,false);
        box.innerHTML=`<strong style="display:block">${isMe?"You’re keeping score":`${esc(scorer.display_name)} is keeping score`}</strong><small style="display:block;margin-bottom:10px">${isMe?"Your group scorecard is now available.":"Only the nominated scorer can enter this group’s scores."}</small><button type="button" class="button button-outline" data-change-scorer>Change scorer</button>`;
        box.querySelector("[data-change-scorer]")?.addEventListener("click",()=>showChangeChooser(box,state));if(scoreLink)scoreLink.classList.toggle("hidden",!isMe);return;
      }
      setNextStep("Your group scorecard has been submitted.",false);box.innerHTML=`<strong>Scorecard submitted</strong><small>This group card is complete.</small>`;
    }finally{rendering=false;}
  }
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)render().catch(console.error);});window.addEventListener("pageshow",()=>render().catch(console.error));render().catch(console.error);
})();