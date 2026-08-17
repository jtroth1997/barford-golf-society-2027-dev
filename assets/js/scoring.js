(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const CACHE_PREFIX = "barford-scorecard-v1:";
  let session, model, hole = 1, selectedPlayerId = null, syncTimer;
  const $ = id => document.getElementById(id);
  const show = id => $(id)?.classList.remove("hidden");
  const hide = id => $(id)?.classList.add("hidden");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const cacheKey = userId => `${CACHE_PREFIX}${userId}`;
  const localNow = () => new Date().toISOString();

  function saveLocal() {
    if (!session || !model) return;
    model.savedAt = localNow();
    localStorage.setItem(cacheKey(session.user.id), JSON.stringify(model));
    updateSyncBadge(navigator.onLine ? (model.dirty ? "Saving…" : "Saved") : "Saved offline");
  }

  function readLocal(userId) {
    try { return JSON.parse(localStorage.getItem(cacheKey(userId)) || "null"); } catch (_) { return null; }
  }

  function updateSyncBadge(text, failed = false) {
    const button = $("scoreSyncButton");
    button.textContent = text.startsWith("Saved") ? `✓ ${text}` : text;
    button.setAttribute("aria-label", text.startsWith("Saved") ? `${text}. Tap to save again.` : text);
    button.classList.toggle("sync-failed", failed);
  }

  function shotsReceived(handicap, strokeIndex) {
    return handicap < strokeIndex ? 0 : Math.floor((handicap - strokeIndex) / 18) + 1;
  }

  function teeHole(player, info) {
    return player.playing_category === "women" ? {
      par: Number(info.red_par || info.par), yards: Number(info.red_yards || info.yards),
      stroke_index: Number(info.red_stroke_index || info.stroke_index), tee: info.red_tee_name || "Red"
    } : { par:Number(info.par),yards:Number(info.yards),stroke_index:Number(info.stroke_index),tee:info.yellow_tee_name || "Yellow" };
  }

  function pointsFor(player, holeInfo, value) {
    if (!value || value.picked_up) return 0;
    const tee=teeHole(player,holeInfo);
    const nett = Number(value.strokes) - shotsReceived(player.handicap_used, tee.stroke_index);
    return Math.max(0, 2 + tee.par - nett);
  }

  function valueFor(playerId, holeNumber = hole) {
    return model.scores[`${playerId}:${holeNumber}`] || null;
  }

  function setValue(playerId, value) {
    const wasEmpty = !valueFor(playerId);
    model.scores[`${playerId}:${hole}`] = { ...value, player_id: playerId, hole, changed_at: localNow() };
    model.dirty = true;
    if (wasEmpty) {
      const playerIndex = model.players.findIndex(player => player.id === playerId);
      const followingPlayers = [...model.players.slice(playerIndex + 1), ...model.players.slice(0, playerIndex)];
      selectedPlayerId = followingPlayers.find(player => !valueFor(player.id))?.id || playerId;
    }
    saveLocal(); renderHole(); scheduleSync();
  }

  function allHoleScoresPresent() {
    return model.players.every(player => Array.from({length:18},(_,i) => valueFor(player.id,i+1)).every(Boolean));
  }

  function holeComplete() { return model.players.every(player => valueFor(player.id)); }

  function renderCompetition(info) {
    const types=[];
    if(info.longest_drive)types.push({short:"LD",title:"Longest Drive",icon:"🏌️"});
    if(info.nearest_pin)types.push({short:"NP",title:"Nearest the Pin",icon:"⛳"});
    const marker=$("competitionMarker");
    marker.classList.toggle("hidden",!types.length);
    marker.textContent=types.map(type=>`${type.short} · ${type.title.toUpperCase()}`).join("  |  ");
    if(!types.length)return;
    const alertKey=`barford-competition-seen:${model.card.id}:${info.hole_number}:${types.map(type=>type.short).join("-")}`;
    if(sessionStorage.getItem(alertKey))return;
    sessionStorage.setItem(alertKey,"1");
    $("competitionAlertIcon").textContent=types[0].icon;
    $("competitionAlertTitle").textContent=types.map(type=>type.title).join(" & ");
    $("competitionAlertText").textContent=`Hole ${info.hole_number} is today’s ${types.map(type=>type.title).join(" and ")} hole`;
    show("competitionAlert");
    setTimeout(()=>hide("competitionAlert"),3600);
  }

  function renderHole() {
    const info = model.holes.find(item => item.hole_number === hole);
    if (!info) return;
    $("holeProgress").textContent = `Hole ${hole} of 18`;
    $("holeTitle").textContent = `Hole ${hole}`;
    $("holePar").textContent = `Par ${info.par}`;
    $("holeYards").textContent = info.yards ? `${info.yards} yards` : "Yards TBC";
    $("holeIndex").textContent = `SI ${info.stroke_index}`;
    $("yellowTeeSummary").querySelector("b").textContent=info.yellow_tee_name || "Yellow tee";
    $("redHolePar").textContent=`Par ${info.red_par || info.par}`;
    $("redHoleYards").textContent=info.red_yards?`${info.red_yards} yards`:"Yards TBC";
    $("redHoleIndex").textContent=`SI ${info.red_stroke_index || info.stroke_index}`;
    $("redTeeSummary").querySelector("b").textContent=info.red_tee_name || "Red tee";
    renderCompetition(info);
    $("previousHole").textContent = hole === 1 ? "" : `‹ Hole ${hole - 1}`;
    $("nextHoleTop").textContent = hole === 18 ? "Review ›" : `Hole ${hole + 1} ›`;
    $("previousHole").disabled = hole === 1;
    $("previousHoleBottom").disabled = hole === 1;
    $("nextHole").textContent = hole === 18 ? "Review scores" : "Next hole";
    $("playerRows").innerHTML = model.players.map(player => {
      const value = valueFor(player.id);
      const tee=teeHole(player,info);
      const shots = shotsReceived(Number(player.handicap_used), tee.stroke_index);
      const display = value?.picked_up ? "X" : (value?.strokes ?? "");
      const pts = value ? pointsFor(player, info, value) : null;
      return `<button class="score-player-row ${selectedPlayerId===player.id?"is-selected":""}" type="button" data-player="${player.id}">
        <span><span class="player-name">${esc(player.display_name)} <i class="shot-dots" aria-label="${shots} handicap shot${shots===1?"":"s"}">${"•".repeat(shots)}</i></span><small class="player-detail">${esc(tee.tee)} tee · ${tee.yards} yards · HCP ${player.handicap_used}${pts===null?"":` · ${pts} point${pts===1?"":"s"}`}</small></span>
        <span class="gross-value ${value?.picked_up?"is-pickup":""}">${display}</span></button>`;
    }).join("");
    document.querySelectorAll("[data-player]").forEach(button => button.addEventListener("click", () => { selectedPlayerId=button.dataset.player; renderHole(); }));
    const selected = model.players.find(player => player.id === selectedPlayerId);
    $("selectedPlayerPrompt").textContent = selected ? `Enter gross strokes for ${selected.display_name}` : "Select a player";
  }

  function goToHole(next) {
    if (next > hole && !holeComplete()) {
      const missing = model.players.find(player => !valueFor(player.id));
      selectedPlayerId = missing?.id || selectedPlayerId;
      renderHole();
      $("selectedPlayerPrompt").textContent = `Enter a score or X for ${missing?.display_name || "every player"}`;
      return;
    }
    if (next > 18) return showReview();
    hole = Math.max(1, next); selectedPlayerId = model.players.find(player => !valueFor(player.id))?.id || model.players[0]?.id; renderHole();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function showReview() {
    if (!allHoleScoresPresent()) {
      const firstMissing = Array.from({length:18},(_,i)=>i+1).find(h => model.players.some(player => !valueFor(player.id,h)));
      hole = firstMissing || 1; hide("roundReview"); show("scoreReady"); renderHole(); return;
    }
    hide("scoreReady"); show("roundReview");
    $("reviewPlayers").innerHTML = model.players.map(player => {
      let total = 0;
      const holes = model.holes.map(info => { const value=valueFor(player.id,info.hole_number); const pts=pointsFor(player,info,value); total+=pts; return `<span>${info.hole_number}<b>${value.picked_up?"X":value.strokes}</b></span>`; }).join("");
      return `<section class="review-player"><header><strong>${esc(player.display_name)}</strong><b>${total} pts</b></header><div class="review-holes">${holes}</div></section>`;
    }).join("");
  }

  function pendingChanges() {
    return Object.values(model.scores).map(value => ({player_id:value.player_id,hole:value.hole,strokes:value.picked_up?null:Number(value.strokes),picked_up:Boolean(value.picked_up)}));
  }

  async function syncNow() {
    if (!model?.dirty || !navigator.onLine || model.card.status === "locked") return;
    clearTimeout(syncTimer); updateSyncBadge("Saving…");
    const { error } = await client.rpc("sync_scorecard", {target_scorecard_id:model.card.id,score_changes:pendingChanges()});
    if (error) { updateSyncBadge("Saved offline", true); return; }
    model.dirty=false; model.syncedAt=localNow(); saveLocal(); updateSyncBadge("Saved");
  }
  function scheduleSync() { clearTimeout(syncTimer); syncTimer=setTimeout(syncNow,500); }

  async function loadOnline(userId) {
    const { data: memberships, error: membershipError } = await client.from("event_scorecard_players")
      .select("scorecard_id").eq("member_id",userId);
    if (membershipError || !memberships?.length) throw new Error(membershipError?.message || "Your event scorecard has not been prepared yet.");
    const { data: cards, error: cardError } = await client.from("event_scorecards").select("*")
      .in("id",memberships.map(item=>item.scorecard_id)).in("status",["ready","in_progress","submitted"]).order("updated_at",{ascending:false}).limit(1);
    const card=cards?.[0];
    if (cardError) throw cardError;
    if (!card) throw new Error("There is no active scorecard for your group.");
    const [{data:players,error:playersError},{data:holes,error:holesError}] = await Promise.all([
      client.from("event_scorecard_players").select("id,member_id,display_name,handicap_used,position,playing_category,tee_name").eq("scorecard_id",card.id).order("position"),
      client.from("event_holes").select("hole_number,par,yards,stroke_index,red_par,red_yards,red_stroke_index,yellow_tee_name,red_tee_name,longest_drive,nearest_pin").eq("event_id",card.event_id).order("hole_number")
    ]);
    if (playersError || holesError) throw (playersError||holesError);
    const {data:scores,error:scoresError}=await client.from("event_hole_scores").select("scorecard_player_id,hole_number,strokes,picked_up,updated_at").in("scorecard_player_id",players.map(player=>player.id));
    if(scoresError) throw scoresError;
    if (holes?.length !== 18) throw new Error("The administrator has not entered all 18 course holes yet.");
    let claimed=card;
    if (card.status === "ready" || (card.status === "in_progress" && card.scorer_id === userId)) {
      const result=await client.rpc("claim_scorecard",{target_scorecard_id:card.id});
      if (result.error) throw result.error; claimed=result.data;
    } else if (card.scorer_id && card.scorer_id !== userId && card.status !== "submitted" && card.status !== "locked") {
      throw new Error("Another member of your group is the official scorer for this card.");
    }
    const scoreMap={};
    (scores||[]).forEach(item=>scoreMap[`${item.scorecard_player_id}:${item.hole_number}`]={player_id:item.scorecard_player_id,hole:item.hole_number,strokes:item.strokes,picked_up:item.picked_up});
    return {card:claimed,players,holes,scores:scoreMap,dirty:false,savedAt:localNow()};
  }

  async function initialise() {
    if (!client) return unavailable("The scoring service could not start.");
    const auth=await client.auth.getSession(); session=auth.data.session;
    if (!session) return unavailable("Sign in to your member account before opening the scorecard.");
    const cached=readLocal(session.user.id);
    if (!navigator.onLine) {
      if (!cached) return unavailable("Open your scorecard once while you have signal so it can be prepared for offline use.");
      model=cached;
    } else {
      try {
        const online=await loadOnline(session.user.id);
        if (cached?.card?.id===online.card.id && cached.dirty) {
          online.scores={...online.scores,...cached.scores}; online.dirty=true;
        }
        model=online; saveLocal(); await syncNow();
      } catch (error) {
        const missingCard=/no group scorecard|not in a tee group|not been prepared/i.test(String(error.message||""));
        if(missingCard){localStorage.removeItem(cacheKey(session.user.id));return unavailable(error.message);}
        if (cached) model=cached; else return unavailable(error.message);
      }
    }
    hide("scoreLoading");
    if (["submitted","locked"].includes(model.card.status)) return show("roundSubmitted");
    show("scoreReady"); selectedPlayerId=model.players[0]?.id; renderHole();
  }

  function unavailable(message) { hide("scoreLoading"); $("scoreUnavailableMessage").textContent=message; show("scoreUnavailable"); }

  document.querySelectorAll("[data-score]").forEach(button=>button.addEventListener("click",()=>{if(selectedPlayerId)setValue(selectedPlayerId,{strokes:Number(button.dataset.score),picked_up:false});}));
  $("pickupScore")?.addEventListener("click",()=>{if(selectedPlayerId)setValue(selectedPlayerId,{strokes:null,picked_up:true});});
  $("clearScore")?.addEventListener("click",()=>{if(selectedPlayerId){delete model.scores[`${selectedPlayerId}:${hole}`];model.dirty=true;saveLocal();renderHole();}});
  $("nextHole")?.addEventListener("click",()=>goToHole(hole+1)); $("nextHoleTop")?.addEventListener("click",()=>goToHole(hole+1));
  $("previousHole")?.addEventListener("click",()=>goToHole(hole-1)); $("previousHoleBottom")?.addEventListener("click",()=>goToHole(hole-1));
  $("returnToCard")?.addEventListener("click",()=>{hide("roundReview");show("scoreReady");renderHole();});
  $("scoreSyncButton")?.addEventListener("click",syncNow);
  $("finaliseScores")?.addEventListener("click",async()=>{
    if(!confirm("Has the group checked and agreed every score on this card?\n\nAfter submission, only an administrator can reopen it."))return;
    const button=$("finaliseScores"); button.disabled=true; $("finaliseStatus").textContent="Synchronising the final card…";
    if (!navigator.onLine) { $("finaliseStatus").textContent="Your scores are safely saved. Connect to signal before final submission."; button.disabled=false; return; }
    await syncNow(); if(model.dirty){$("finaliseStatus").textContent="Could not synchronise yet. Please try again when signal improves.";button.disabled=false;return;}
    const {error}=await client.rpc("submit_scorecard",{target_scorecard_id:model.card.id});
    if(error){$("finaliseStatus").textContent=error.message;button.disabled=false;return;}
    model.card.status="submitted";saveLocal();hide("roundReview");show("roundSubmitted");
  });
  window.addEventListener("online",syncNow); window.addEventListener("offline",()=>updateSyncBadge("Saved offline"));
  initialise();
})();
