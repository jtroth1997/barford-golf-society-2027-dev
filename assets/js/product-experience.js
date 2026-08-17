(() => {
  "use strict";

  const page = location.pathname.split("/").pop() || "index.html";
  document.body.classList.add("product-premium");

  const icons = {
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    trophy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/></svg>',
    camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h4l1.5-2h5L16 8h4v11H4Z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.3 3.4-6.5 8-6.5s7.3 2.2 8 6.5"/></svg>'
  };

  function replaceQuickNavIcons(){
    const map = {"index.html":"home","events.html":"calendar","scores.html":"trophy","gallery.html":"camera","account.html":"user"};
    document.querySelectorAll(".mobile-quick-nav a").forEach(link => {
      const target = link.getAttribute("href")?.split("/").pop();
      const icon = link.querySelector(".quick-icon");
      if (icon && map[target]) icon.innerHTML = icons[map[target]];
    });
  }

  function addCredit(){
    const footer = document.querySelector(".site-footer .footer-inner");
    if (!footer || footer.querySelector(".product-credit")) return;
    const credit = document.createElement("p");
    credit.className = "product-credit";
    credit.innerHTML = 'Created by <a href="https://highstreetwebco.co.uk" target="_blank" rel="noopener">HighStreetWebCo</a>';
    footer.appendChild(credit);
  }

  function collapseAccountEditor(){
    if (page !== "account.html") return;
    const panel = document.querySelector(".profile-panel");
    const heading = panel?.querySelector(".account-panel-heading");
    const form = panel?.querySelector(".account-profile-form");
    if (!panel || !heading || !form || heading.querySelector(".product-profile-toggle")) return;
    panel.classList.add("product-profile-collapsed");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-profile-toggle";
    button.textContent = "Edit my details";
    button.setAttribute("aria-expanded","false");
    button.addEventListener("click",() => {
      const collapsed = panel.classList.toggle("product-profile-collapsed");
      button.textContent = collapsed ? "Edit my details" : "Close details";
      button.setAttribute("aria-expanded", String(!collapsed));
      if (!collapsed) form.querySelector("input,select,button")?.focus({preventScroll:true});
    });
    heading.appendChild(button);
  }

  function simplifyAdminCopy(){
    if (page !== "admin.html") return;
    const titles = {events:"Events",scorecards:"Event scoring",scores:"Manual scoring",gallery:"Photos",content:"Shop & trips",members:"Members"};
    document.querySelectorAll(".admin-section-nav [data-admin-view]").forEach(button => {
      if (titles[button.dataset.adminView]) button.textContent = titles[button.dataset.adminView];
    });
  }

  function watchEvents(){
    if (page !== "events.html") return;
    const list = document.getElementById("eventList");
    if (!list) return;
    const tidy = () => {
      list.querySelectorAll(".compact-event-card").forEach(card => {
        const more = card.querySelector("[data-event-details]");
        if (more && !more.dataset.productLabelled) {
          more.textContent = "Event details";
          more.dataset.productLabelled = "1";
        }
      });
    };
    tidy();
    new MutationObserver(tidy).observe(list,{childList:true,subtree:true});
  }

  const firstName = value => String(value || "Player").trim().split(/\s+/)[0] || "Player";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  async function waitForClient(){
    for (let i=0;i<40;i+=1){
      if (window.BarfordSupabase) return window.BarfordSupabase;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return null;
  }

  async function initEventDay(){
    if (page !== "index.html") return;
    const client = await waitForClient();
    if (!client) return;
    const {data:{session}} = await client.auth.getSession();
    if (!session) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const {data:event} = await client.from("events").select("id,name,event_date,status").eq("event_date",today).eq("status","scheduled").limit(1).maybeSingle();
    if (!event) return;
    const {data:rsvp} = await client.from("rsvps").select("status").eq("event_id",event.id).eq("member_id",session.user.id).maybeSingle();
    if (rsvp?.status !== "playing") return;

    document.body.classList.add("product-event-day");
    const [{data:groupRows},{data:card}] = await Promise.all([
      client.rpc("get_my_event_tee_group",{target_event_id:event.id}),
      client.from("event_scorecards").select("id,status,scorer_id").eq("event_id",event.id).maybeSingle()
    ]);
    const group = groupRows || [];
    if (!group.length || !card) return;

    const existingLink = document.querySelector(".event-scorecard-cta");
    const players = document.getElementById("dashboardTeeGroupPlayers");
    if (!players) return;
    let panel = document.getElementById("dashboardScorekeeperPanel");
    if (!panel){
      panel = document.createElement("section");
      panel.id = "dashboardScorekeeperPanel";
      panel.className = "scorekeeper-panel";
      players.insertAdjacentElement("afterend", panel);
    }

    const reloadCard = async () => {
      const {data} = await client.from("event_scorecards").select("id,status,scorer_id").eq("id",card.id).single();
      if (data) Object.assign(card,data);
      render();
    };

    const choose = async memberId => {
      panel.querySelectorAll("button").forEach(button=>button.disabled=true);
      const {error} = await client.rpc("select_scorecard_scorer",{target_event_id:event.id,target_scorer_id:memberId});
      if (error){
        window.showSiteMessage?.(error.message || "The scorer could not be changed.");
        panel.querySelectorAll("button").forEach(button=>button.disabled=false);
        return;
      }
      await reloadCard();
    };

    const render = () => {
      const scorer = group.find(player=>player.member_id===card.scorer_id);
      const submitted = ["submitted","locked"].includes(card.status);
      existingLink?.classList.add("hidden");
      if (submitted){
        panel.innerHTML = '<div class="scorekeeper-panel-header"><div><span>Group scorecard</span><strong>✓ Scores submitted</strong></div></div><p class="scorekeeper-note">Your group card is safely with the committee.</p>';
        const next = document.getElementById("dashboardNextStepText");
        if (next) next.textContent = "Your group’s scores have been submitted.";
        return;
      }
      if (scorer){
        const isYou = scorer.member_id === session.user.id;
        panel.innerHTML = `<div class="scorekeeper-panel-header"><div><span>Keeping score today</span><strong>✓ ${escapeHtml(isYou ? "You are" : scorer.full_name + " is")} keeping score</strong></div></div><p class="scorekeeper-note">${isYou ? "Use your phone as the group scorecard. Everyone else can leave scoring to you." : `${escapeHtml(firstName(scorer.full_name))} is the official scorer for your group.`}</p><div class="scorekeeper-actions">${isYou ? '<a class="button button-primary" href="scoring.html">Open group scorecard</a>' : ''}${card.status === "ready" ? '<button class="button button-outline" type="button" data-change-scorer>Change scorer</button>' : ''}</div>`;
        const next = document.getElementById("dashboardNextStepText");
        if (next) next.textContent = isYou ? "You’re keeping score today. Open the scorecard when you’re ready." : `${firstName(scorer.full_name)} is keeping the score today.`;
        panel.querySelector("[data-change-scorer]")?.addEventListener("click",()=>renderPicker());
        return;
      }
      renderPicker();
    };

    const renderPicker = () => {
      const eligible = group.filter(player=>player.member_id);
      panel.innerHTML = `<div class="scorekeeper-panel-header"><div><span>One job before you tee off</span><strong>Choose who is keeping score</strong></div></div><div class="scorekeeper-picker">${eligible.map(player=>`<button class="scorekeeper-choice" type="button" data-scorer="${escapeHtml(player.member_id)}">${escapeHtml(player.is_you ? "Me" : firstName(player.full_name))}</button>`).join("")}</div><p class="scorekeeper-note">Only the selected person will enter the group’s scores. You can change this before scoring starts.</p>`;
      const next = document.getElementById("dashboardNextStepText");
      if (next) next.textContent = "Choose one person in your group to keep the score today.";
      panel.querySelectorAll("[data-scorer]").forEach(button=>button.addEventListener("click",()=>choose(button.dataset.scorer)));
    };

    render();
  }

  replaceQuickNavIcons();
  addCredit();
  collapseAccountEditor();
  simplifyAdminCopy();
  watchEvents();
  initEventDay();
})();
