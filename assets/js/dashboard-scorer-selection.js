(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client || !document.getElementById("dashboardTeeGroup")) return;
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  async function render() {
    const host = document.getElementById("dashboardTeeGroup");
    if (!host || host.classList.contains("hidden")) return;
    const {data:{session}} = await client.auth.getSession();
    if (!session) return;
    const {data: memberships} = await client.from("event_scorecard_players").select("scorecard_id").eq("member_id",session.user.id);
    if (!memberships?.length) return;
    const {data: cards} = await client.from("event_scorecards").select("id,event_id,status,scorer_id,updated_at").in("id",memberships.map(x=>x.scorecard_id)).in("status",["ready","in_progress","submitted"]).order("updated_at",{ascending:false}).limit(1);
    const card = cards?.[0];
    if (!card) return;
    const {data: players} = await client.from("event_scorecard_players").select("member_id,display_name,position").eq("scorecard_id",card.id).order("position");
    if (!players?.length) return;

    let box = document.getElementById("dashboardScorerChoice");
    if (!box) {
      box = document.createElement("section");
      box.id = "dashboardScorerChoice";
      box.style.cssText = "margin:16px 0 4px;padding:16px;border:1px solid #e3d7b5;border-radius:14px;background:#fffaf0";
      const actions = host.querySelector(".tee-group-actions");
      host.insertBefore(box, actions || null);
    }
    const scorer = players.find(p=>p.member_id===card.scorer_id);
    const scoreLink = document.querySelector(".event-scorecard-cta");

    if (card.status === "ready" && !card.scorer_id) {
      if (scoreLink) scoreLink.classList.add("hidden");
      box.innerHTML = `<strong style="display:block;font-size:1rem;margin-bottom:4px">Who’s keeping score?</strong><small style="display:block;margin-bottom:12px">Choose the official scorer for your tee group. The card will not start until that player opens it.</small><div style="display:grid;grid-template-columns:repeat(${Math.min(players.length,2)},minmax(0,1fr));gap:8px">${players.map(p=>`<button type="button" class="button button-outline" data-pick-scorer="${p.member_id}">${esc(p.display_name)}${p.member_id===session.user.id?" (You)":""}</button>`).join("")}</div><small id="dashboardScorerStatus" style="display:block;margin-top:8px"></small>`;
      box.querySelectorAll("[data-pick-scorer]").forEach(btn=>btn.addEventListener("click",async()=>{
        box.querySelectorAll("button").forEach(b=>b.disabled=true);
        const status = document.getElementById("dashboardScorerStatus");
        if(status) status.textContent="Saving scorer…";
        const {error}=await client.rpc("select_scorecard_scorer",{target_event_id:card.event_id,target_scorer_id:btn.dataset.pickScorer});
        if(error){ if(status) status.textContent=error.message; box.querySelectorAll("button").forEach(b=>b.disabled=false); return; }
        await render();
      }));
      return;
    }

    if (scorer) {
      const isMe = scorer.member_id === session.user.id;
      box.innerHTML = `<strong style="display:block">${isMe?"You’re keeping score":`${esc(scorer.display_name)} is keeping score`}</strong><small>${isMe?"Your scorecard is ready to open.":"Only the nominated scorer can enter the group’s scores."}</small>`;
      if (scoreLink) scoreLink.classList.toggle("hidden", !isMe || !["ready","in_progress"].includes(card.status));
    } else {
      if (scoreLink) scoreLink.classList.add("hidden");
      box.innerHTML = `<strong>Scorecard submitted</strong>`;
    }
  }

  const observer = new MutationObserver(()=>setTimeout(()=>render().catch(()=>{}),100));
  const host = document.getElementById("dashboardTeeGroup");
  if (host) observer.observe(host,{attributes:true,attributeFilter:["class"],childList:true,subtree:false});
  setTimeout(()=>render().catch(()=>{}),900);
})();
