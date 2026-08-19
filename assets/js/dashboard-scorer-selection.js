(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const host = document.getElementById("dashboardTeeGroup");
  const scoreLink = document.querySelector(".event-scorecard-cta");
  if (!client || !host) return;

  // Fail closed: a prepared card is NEVER openable until the database says this user is the scorer.
  if (scoreLink) scoreLink.classList.add("hidden");
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let rendering = false;

  async function render() {
    if (rendering) return;
    rendering = true;
    try {
      if (scoreLink) scoreLink.classList.add("hidden");
      const {data:{session}} = await client.auth.getSession();
      if (!session) return;

      const {data: memberships, error: membershipError} = await client.from("event_scorecard_players")
        .select("scorecard_id").eq("member_id",session.user.id);
      if (membershipError || !memberships?.length) return;

      const {data: cards, error: cardError} = await client.from("event_scorecards")
        .select("id,event_id,status,scorer_id,updated_at")
        .in("id",memberships.map(x=>x.scorecard_id))
        .in("status",["ready","in_progress","submitted","locked"])
        .order("updated_at",{ascending:false}).limit(1);
      if (cardError || !cards?.length) return;
      const card = cards[0];

      const {data: players, error: playersError} = await client.from("event_scorecard_players")
        .select("member_id,display_name,position").eq("scorecard_id",card.id).order("position");
      if (playersError || !players?.length) return;

      let box = document.getElementById("dashboardScorerChoice");
      if (!box) {
        box = document.createElement("section");
        box.id = "dashboardScorerChoice";
        box.style.cssText = "margin:16px 0 4px;padding:16px;border:1px solid #e3d7b5;border-radius:14px;background:#fffaf0";
        host.insertBefore(box, host.querySelector(".tee-group-actions") || null);
      }

      const scorer = players.find(p => p.member_id === card.scorer_id);
      if (card.status === "ready" && !card.scorer_id) {
        box.innerHTML = `<strong style="display:block;font-size:1rem;margin-bottom:4px">Who’s keeping score?</strong><small style="display:block;margin-bottom:12px">Your group must choose one scorer before the card can be opened.</small><div style="display:grid;grid-template-columns:repeat(${Math.min(players.length,2)},minmax(0,1fr));gap:8px">${players.map(p=>`<button type="button" class="button button-outline" data-pick-scorer="${p.member_id}">${esc(p.display_name)}${p.member_id===session.user.id?" (You)":""}</button>`).join("")}</div><small id="dashboardScorerStatus" style="display:block;margin-top:8px"></small>`;
        box.querySelectorAll("[data-pick-scorer]").forEach(btn => btn.addEventListener("click", async () => {
          box.querySelectorAll("button").forEach(b=>b.disabled=true);
          const status=document.getElementById("dashboardScorerStatus");
          if(status) status.textContent="Saving scorer…";
          const {error}=await client.rpc("select_scorecard_scorer",{target_event_id:card.event_id,target_scorer_id:btn.dataset.pickScorer});
          if(error){if(status)status.textContent=error.message;box.querySelectorAll("button").forEach(b=>b.disabled=false);return;}
          await renderSoon();
        }));
        return;
      }

      if (scorer) {
        const isMe=scorer.member_id===session.user.id;
        box.innerHTML=`<strong style="display:block">${isMe?"You’re keeping score":`${esc(scorer.display_name)} is keeping score`}</strong><small>${isMe?"You can open the group card when scoring is available.":"Only the nominated scorer can enter this group’s scores."}</small>`;
        if(scoreLink) scoreLink.classList.toggle("hidden", !isMe || !["ready","in_progress"].includes(card.status));
        return;
      }

      box.innerHTML=`<strong>Scorecard submitted</strong><small>This group card is complete.</small>`;
    } finally {
      rendering=false;
    }
  }

  function renderSoon(){setTimeout(()=>render().catch(console.error),50);}

  // member-dashboard.js also updates the scorecard button. Keep this guard authoritative after it runs.
  const observer=new MutationObserver(()=>renderSoon());
  observer.observe(host,{attributes:true,attributeFilter:["class"],childList:true,subtree:true});
  if(scoreLink) observer.observe(scoreLink,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)renderSoon();});
  window.addEventListener("pageshow",renderSoon);
  renderSoon();
  setTimeout(renderSoon,500);
  setTimeout(renderSoon,1200);
  setTimeout(renderSoon,2500);
})();