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
    renderLiveCard();
    $("previousHole").textContent = hole === 1 ? "" : `‹ Hole ${hole - 1}`;
    $("nextHoleTop").textContent = hole === 18 ? "Review ›" : `Hole ${hole + 1} ›`;
    $("previousHole").disabled = hole === 1;
    $("previousHoleBottom").disabled = hole === 1;
    $("nextHole").textContent = hole === 18 ? "Review scores" : "Next hole";
    const selected = model.players.find(player => player.id === selectedPlayerId);
    if (selected) {
      const selectedTee = teeHole(selected, info);
      const selectedShots = shotsReceived(Number(selected.handicap_used), selectedTee.stroke_index);
      $("selectedPlayerPrompt").innerHTML = `<strong>${esc(selected.display_name)}</strong><span class="shot-dots" aria-label="${selectedShots} handicap shot${selectedShots===1?"":"s"}">${"•".repeat(selectedShots)}</span><small>HCP ${selected.handicap_used} · ${esc(selectedTee.tee)} · ${selectedTee.yards}yd</small>`;
    } else {
      $("selectedPlayerPrompt").textContent = "Tap a player above";
    }
  }

  function renderLiveCard() {
    const firstHole = hole <= 9 ? 1 : 10;
    const holes = Array.from({length:9}, (_, index) => firstHole + index);
    const header = holes.map(number => `<b class="${number===hole?"is-current":""}">${number}</b>`).join("");
    const rows = model.players.map(player => {
      const cells = holes.map(number => {
        const value = valueFor(player.id, number);
        const info = model.holes.find(item => item.hole_number === number);
        const display = value ? `${value.picked_up ? "X" : value.strokes}/${pointsFor(player, info, value)}` : "–";
        return `<button type="button" class="${number===hole?"is-current":""} ${value?.picked_up?"is-pickup":""}" data-live-hole="${number}" data-live-player="${player.id}" aria-label="${esc(player.display_name)}, hole ${number}: ${value ? display : "not entered"}">${display}</button>`;
      }).join("");
      return `<div class="live-card-row ${selectedPlayerId===player.id?"is-selected-player":""}"><button type="button" class="live-player-name" data-live-player-name="${player.id}" aria-label="Enter a score for ${esc(player.display_name)}">${esc(player.display_name)}</button>${cells}</div>`;
    }).join("");
    $("liveNineStrip").innerHTML = `<div class="live-card-header"><strong>${firstHole===1?"Front 9":"Back 9"}</strong>${header}</div>${rows}`;
    document.querySelectorAll("[data-live-hole]").forEach(button => button.addEventListener("click", () => {
      hole = Number(button.dataset.liveHole);
      selectedPlayerId = button.dataset.livePlayer;
      renderHole();
    }));
    document.querySelectorAll("[data-live-player-name]").forEach(button => button.addEventListener("click", () => {
      selectedPlayerId = button.dataset.livePlayerName;
      renderHole();
    }));
  }

  function goToHole(next) {
    if (next > hole && !holeComplete()) {
      const missing = model.players.find(player => !valueFor(player.id));
      selectedPlayerId = missing?.id || selectedPlayerId;
      renderHole();
      return;
    }
    if (hole === 9 && next === 10) return showHalfwayReview();
    if (next > 18) return showReview();
    hole = Math.max(1, next); selectedPlayerId = model.players.find(player => !valueFor(player.id))?.id || model.players[0]?.id; renderHole();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function pointTotal(player, fromHole, toHole) {
    return model.holes
      .filter(info => info.hole_number >= fromHole && info.hole_number <= toHole)
      .reduce((sum, info) => sum + pointsFor(player, info, valueFor(player.id, info.hole_number)), 0);
  }

  function showHalfwayReview() {
    hide("scoreReady");
    show("halfwayReview");
    $("halfwayPlayers").innerHTML = model.players.map(player => `
      <article><div><strong>${esc(player.display_name)}</strong><small>Front nine complete</small></div><b>${pointTotal(player, 1, 9)} points</b></article>`).join("");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function scorecardSection(title, fromHole, toHole, totalLabel, includeOverall = false) {
    const holes = model.holes.filter(info => info.hole_number >= fromHole && info.hole_number <= toHole);
    const header = holes.map(info => `<span><b>${info.hole_number}</b><small>Par ${info.par}</small></span>`).join("");
    const players = model.players.map(player => {
      const scores = holes.map(info => {
        const value = valueFor(player.id, info.hole_number);
        const points = pointsFor(player, info, value);
        return `<button type="button" class="review-score ${value.picked_up ? "is-pickup" : ""}" data-review-hole="${info.hole_number}" aria-label="Edit ${esc(player.display_name)}, hole ${info.hole_number}">${value.picked_up ? "X" : value.strokes}/${points}</button>`;
      }).join("");
      const sectionPoints = pointTotal(player, fromHole, toHole);
      const overall = includeOverall ? `<b class="review-total review-grand-total">${pointTotal(player, 1, 18)}</b>` : "";
      return `<div class="review-score-row"><strong><span>${esc(player.display_name)}</span><small>HCP ${player.handicap_used}</small></strong>${scores}<b class="review-total">${sectionPoints}</b>${overall}</div>`;
    }).join("");
    return `<section class="review-nine ${includeOverall ? "has-overall" : ""}"><h2>${title}</h2><div class="review-grid"><div class="review-hole-row"><strong>Hole</strong>${header}<b>${totalLabel}</b>${includeOverall ? "<b>Total</b>" : ""}</div>${players}</div><p><strong>Score key:</strong> strokes/points — for example, <b>4/2</b>.</p></section>`;
  }

  function showReview() {
    if (!allHoleScoresPresent()) {
      const firstMissing = Array.from({length:18},(_,i)=>i+1).find(h => model.players.some(player => !valueFor(player.id,h)));
      hole = firstMissing || 1; hide("roundReview"); show("scoreReady"); renderHole(); return;
    }
    hide("scoreReady"); show("roundReview");
    $("reviewPlayers").innerHTML = scorecardSection("Front nine", 1, 9, "Out") + scorecardSection("Back nine", 10, 18, "In", true);
    document.querySelectorAll("[data-review-hole]").forEach(button => button.addEventListener("click", () => {
      hole = Number(button.dataset.reviewHole);
      selectedPlayerId = null;
      hide("roundReview");
      show("scoreReady");
      renderHole();
      window.scrollTo({top:0,behavior:"smooth"});
    }));
    window.scrollTo({top:0,behavior:"smooth"});
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

  async function handoffScorecard(newScorerId) {
    const status = $("handoffStatus");
    if (!navigator.onLine) {
      status.textContent = "Connect to signal before handing over so every score is transferred safely.";
      return;
    }
    status.textContent = "Saving the latest scores…";
    await syncNow();
    if (model.dirty) {
      status.textContent = "The latest scores have not reached the server yet. Try again when the signal improves.";
      return;
    }
    status.textContent = "Handing over the scorecard…";
    const { error } = await client.rpc("handoff_scorecard", {
      target_scorecard_id: model.card.id,
      target_new_scorer_id: newScorerId
    });
    if (error) {
      status.textContent = error.message;
      return;
    }
    const newScorer = model.players.find(player => player.member_id === newScorerId);
    localStorage.removeItem(cacheKey(session.user.id));
    $("handoffDialog")?.close();
    hide("scoreReady");
    $("handoffCompleteName").textContent = newScorer?.display_name || "the new scorer";
    show("scoreHandedOff");
  }

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
    const scorerOptions = model.players.filter(player => player.member_id !== session.user.id);
    $("handoffPlayer").innerHTML = '<option value="">Choose a player…</option>' + scorerOptions
      .map(player => `<option value="${player.member_id}">${esc(player.display_name)}</option>`).join("");
    $("handoffScorecard")?.classList.toggle("hidden", !scorerOptions.length);
  }

  function unavailable(message) { hide("scoreLoading"); $("scoreUnavailableMessage").textContent=message; show("scoreUnavailable"); }

  document.querySelectorAll("[data-score]").forEach(button=>button.addEventListener("click",()=>{if(selectedPlayerId)setValue(selectedPlayerId,{strokes:Number(button.dataset.score),picked_up:false});}));
  $("pickupScore")?.addEventListener("click",()=>{if(selectedPlayerId)setValue(selectedPlayerId,{strokes:null,picked_up:true});});
  $("clearScore")?.addEventListener("click",()=>{if(selectedPlayerId){delete model.scores[`${selectedPlayerId}:${hole}`];model.dirty=true;saveLocal();renderHole();}});
  $("nextHole")?.addEventListener("click",()=>goToHole(hole+1)); $("nextHoleTop")?.addEventListener("click",()=>goToHole(hole+1));
  $("previousHole")?.addEventListener("click",()=>goToHole(hole-1)); $("previousHoleBottom")?.addEventListener("click",()=>goToHole(hole-1));
  $("returnToCard")?.addEventListener("click",()=>{hide("roundReview");show("scoreReady");renderHole();});
  $("continueBackNine")?.addEventListener("click",()=>{hole=10;selectedPlayerId=model.players.find(player=>!valueFor(player.id,10))?.id||model.players[0]?.id;hide("halfwayReview");show("scoreReady");renderHole();window.scrollTo({top:0,behavior:"smooth"});});
  $("backToFrontNine")?.addEventListener("click",()=>{hole=9;selectedPlayerId=model.players[0]?.id;hide("halfwayReview");show("scoreReady");renderHole();window.scrollTo({top:0,behavior:"smooth"});});
  $("scoreSyncButton")?.addEventListener("click",syncNow);
  $("handoffScorecard")?.addEventListener("click",()=>{$("handoffStatus").textContent="";$("handoffPlayer").value="";$("handoffDialog")?.showModal();});
  $("handoffCancel")?.addEventListener("click",()=>$("handoffDialog")?.close());
  $("handoffForm")?.addEventListener("submit",event=>{event.preventDefault();const newScorerId=$("handoffPlayer").value;if(newScorerId)handoffScorecard(newScorerId);});
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
