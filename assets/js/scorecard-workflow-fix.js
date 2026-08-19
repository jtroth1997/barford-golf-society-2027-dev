(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  async function adminAssignmentControls() {
    if (!document.body.classList.contains("admin-page")) return;
    const eventSelect = document.getElementById("adminScoringEvent");
    const progress = document.getElementById("adminScorecardProgress");
    if (!eventSelect || !progress) return;
    let busy = false;

    async function renderAssignments() {
      const eventId = eventSelect.value;
      if (!eventId || busy) return;
      busy = true;
      try {
        const { data: cards, error: cardError } = await client.from("event_scorecards")
          .select("id,tee_time,tee_number,status,scorer_id")
          .eq("event_id", eventId).order("tee_time");
        if (cardError || !cards?.length) return;
        const { data: players, error: playerError } = await client.from("event_scorecard_players")
          .select("scorecard_id,member_id,display_name,position")
          .in("scorecard_id", cards.map(card => card.id)).order("position");
        if (playerError) return;

        const articles = [...progress.querySelectorAll(".admin-scorecard-state")];
        cards.forEach((card, index) => {
          const article = articles[index];
          if (!article) return;
          article.querySelector(".scorecard-assignment")?.remove();
          const groupPlayers = (players || []).filter(player => player.scorecard_id === card.id);
          const assigned = groupPlayers.find(player => player.member_id === card.scorer_id);
          const box = document.createElement("div");
          box.className = "scorecard-assignment";
          box.style.cssText = "width:100%;margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap";
          if (card.status === "ready") {
            box.innerHTML = `<label style="flex:1;min-width:190px"><span style="display:block;font-size:.78rem;font-weight:700;margin-bottom:4px">Official scorer</span><select data-card-scorer="${card.id}" style="width:100%"><option value="">Not selected</option>${groupPlayers.map(player => `<option value="${player.member_id}" ${player.member_id===card.scorer_id?"selected":""}>${esc(player.display_name)}</option>`).join("")}</select></label><button type="button" class="button button-primary" data-assign-card="${card.id}">${assigned ? "Update scorer" : "Assign scorer"}</button><small style="width:100%">${assigned ? `${esc(assigned.display_name)} is assigned. The card stays prepared until they open it.` : "Prepared only — nobody can score until you choose a player."}</small>`;
          } else {
            box.innerHTML = `<small><strong>Scorer:</strong> ${esc(assigned?.display_name || "Not assigned")} · ${esc(card.status.replace("_", " "))}</small>`;
          }
          article.appendChild(box);
        });

        progress.querySelectorAll("[data-assign-card]").forEach(button => button.addEventListener("click", async () => {
          const cardId = button.dataset.assignCard;
          const select = progress.querySelector(`[data-card-scorer="${cardId}"]`);
          if (!select?.value) {
            const status = document.getElementById("adminLiveScoringStatus");
            if (status) status.textContent = "Choose a player from the tee group before assigning the scorecard.";
            return;
          }
          button.disabled = true;
          const { error } = await client.rpc("assign_scorecard_scorer", { target_scorecard_id: cardId, target_scorer_id: select.value });
          const status = document.getElementById("adminLiveScoringStatus");
          if (error) {
            if (status) status.textContent = error.message;
            button.disabled = false;
            return;
          }
          if (status) status.textContent = "Scorer assigned. The card is still prepared and will only start when that player opens it.";
          await renderAssignments();
        }));
      } finally {
        busy = false;
      }
    }

    eventSelect.addEventListener("change", () => setTimeout(renderAssignments, 350));
    const observer = new MutationObserver(() => setTimeout(renderAssignments, 80));
    observer.observe(progress, { childList: true });
    setTimeout(renderAssignments, 500);
  }

  async function genderAwareTeeDisplay() {
    if (!document.body.classList.contains("scoring-page")) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const { data: memberships } = await client.from("event_scorecard_players").select("scorecard_id").eq("member_id", session.user.id);
    if (!memberships?.length) return;
    const { data: cards } = await client.from("event_scorecards").select("id,status,updated_at")
      .in("id", memberships.map(item => item.scorecard_id)).in("status", ["ready","in_progress","submitted"]).order("updated_at", { ascending:false }).limit(1);
    const card = cards?.[0];
    if (!card) return;
    const { data: players } = await client.from("event_scorecard_players").select("playing_category").eq("scorecard_id", card.id);
    if (!players?.length) return;
    const categories = new Set(players.map(player => String(player.playing_category || "men").toLowerCase()));
    const hasWomen = [...categories].some(value => /women|female/.test(value));
    const hasMen = [...categories].some(value => !/women|female/.test(value));
    const yellow = document.getElementById("yellowTeeSummary");
    const red = document.getElementById("redTeeSummary");
    if (yellow) yellow.style.setProperty("display", hasMen ? "" : "none", "important");
    if (red) red.style.setProperty("display", hasWomen ? "" : "none", "important");
  }

  const start = () => { adminAssignmentControls().catch(()=>{}); genderAwareTeeDisplay().catch(()=>{}); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true }); else start();
})();
