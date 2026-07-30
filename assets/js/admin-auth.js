(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;

  const login = document.querySelector("#adminLoginPanel");
  const dashboard = document.querySelector("#adminDashboard");
  const denied = document.querySelector("#adminDenied");
  const status = document.querySelector("#adminLoginStatus");
  const dialog = document.querySelector("#adminAccessDialog");
  const confirmCheck = document.querySelector("#adminAccessConfirmCheck");
  const confirmButton = document.querySelector("#adminAccessConfirm");
  let signedInProfile;
  let pendingChange;
  let adminEvents = [];
  let adminRounds = [];
  let teeGroups = [];

  const initials = name => String(name || "BG").split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0].toUpperCase()).join("");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const setStatus = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  const timeValue = value => value ? String(value).slice(0, 5) : "";
  const eventOptions = () => `<option value="">Select event</option>${adminEvents.map(event =>
    `<option value="${event.id}">${escapeHtml(event.name)} · ${escapeHtml(event.event_date)}</option>`
  ).join("")}`;

  document.querySelectorAll("[data-admin-view]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-view]").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll("[data-admin-panel]").forEach(panel =>
      panel.classList.toggle("hidden", panel.dataset.adminPanel !== button.dataset.adminView)
    );
  }));

  const resetEventForm = () => {
    document.querySelector("#adminEventForm")?.reset();
    document.querySelector("#adminEventId").value = "";
  };

  const loadEvents = async () => {
    const { data, error } = await client.from("events").select("*").order("event_date");
    if (error) {
      setStatus("#adminEventStatus", error.message);
      return;
    }
    adminEvents = data || [];
    document.querySelector("#adminEventCount").textContent = `${adminEvents.length} event${adminEvents.length === 1 ? "" : "s"}`;
    document.querySelector("#adminRsvpEvent").innerHTML = eventOptions();
    document.querySelector("#adminTeeEvent").innerHTML = eventOptions();
    refreshRoundEventOptions();
    const list = document.querySelector("#adminEventList");
    list.innerHTML = adminEvents.length ? adminEvents.map(event => `
      <article>
        <div><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.event_date)} · ${escapeHtml(event.venue)} · ${escapeHtml(event.status)}</small></div>
        <div class="admin-row-actions">
          <button type="button" data-edit-event="${event.id}">Edit</button>
          <button type="button" data-toggle-event="${event.id}">${event.status === "cancelled" ? "Restore" : "Cancel"}</button>
          <button class="danger-link" type="button" data-delete-event="${event.id}">Delete</button>
        </div>
      </article>`).join("") : "<p>No events have been created.</p>";
    list.querySelectorAll("[data-edit-event]").forEach(button => button.addEventListener("click", () => {
      const event = adminEvents.find(item => item.id === button.dataset.editEvent);
      if (!event) return;
      document.querySelector("#adminEventId").value = event.id;
      document.querySelector("#adminEventName").value = event.name || "";
      document.querySelector("#adminEventVenue").value = event.venue || "";
      document.querySelector("#adminEventAddress").value = event.address || "";
      document.querySelector("#adminEventDate").value = event.event_date || "";
      document.querySelector("#adminEventFirstTee").value = timeValue(event.first_tee_time);
      document.querySelector("#adminEventPrice").value = event.price ?? "";
      document.querySelector("#adminEventCapacity").value = event.capacity ?? "";
      document.querySelector("#adminEventVideo").value = event.course_video_url || "";
      document.querySelector("#adminEventNotes").value = event.notes || "";
      document.querySelector("#adminEventForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    list.querySelectorAll("[data-toggle-event]").forEach(button => button.addEventListener("click", async () => {
      const event = adminEvents.find(item => item.id === button.dataset.toggleEvent);
      const status = event.status === "cancelled" ? "scheduled" : "cancelled";
      const { error: updateError } = await client.from("events").update({ status, updated_at: new Date().toISOString() }).eq("id", event.id);
      setStatus("#adminEventStatus", updateError ? updateError.message : `${event.name} is now ${status}.`);
      if (!updateError) await loadEvents();
    }));
    list.querySelectorAll("[data-delete-event]").forEach(button => button.addEventListener("click", async () => {
      const event = adminEvents.find(item => item.id === button.dataset.deleteEvent);
      if (!confirm(`Permanently delete ${event.name} and its related RSVPs and tee times?`)) return;
      const { error: deleteError } = await client.from("events").delete().eq("id", event.id);
      setStatus("#adminEventStatus", deleteError ? deleteError.message : `${event.name} was deleted.`);
      if (!deleteError) await loadEvents();
    }));
  };

  document.querySelector("#adminEventForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const id = document.querySelector("#adminEventId").value;
    const payload = {
      name: document.querySelector("#adminEventName").value.trim(),
      venue: document.querySelector("#adminEventVenue").value.trim(),
      address: document.querySelector("#adminEventAddress").value.trim() || null,
      event_date: document.querySelector("#adminEventDate").value,
      first_tee_time: document.querySelector("#adminEventFirstTee").value || null,
      price: document.querySelector("#adminEventPrice").value || null,
      capacity: document.querySelector("#adminEventCapacity").value || null,
      course_video_url: document.querySelector("#adminEventVideo").value.trim() || null,
      notes: document.querySelector("#adminEventNotes").value.trim() || null,
      status: id ? undefined : "scheduled",
      updated_at: new Date().toISOString()
    };
    if (id) delete payload.status;
    const query = id ? client.from("events").update(payload).eq("id", id) : client.from("events").insert(payload);
    const { error } = await query;
    setStatus("#adminEventStatus", error ? error.message : id ? "Event updated." : "Event created.");
    if (!error) {
      if (id) {
        await client.from("rounds").update({
          name: payload.name,
          played_on: payload.event_date
        }).eq("event_id", id);
      }
      resetEventForm();
      await Promise.all([loadEvents(), loadRounds()]);
    }
  });
  document.querySelector("#adminEventReset")?.addEventListener("click", resetEventForm);

  const loadRsvps = async eventId => {
    const playing = document.querySelector("#adminPlayingList");
    const reserve = document.querySelector("#adminReserveList");
    if (!eventId) {
      playing.innerHTML = reserve.innerHTML = "<p>Select an event.</p>";
      return;
    }
    const { data, error } = await client.from("rsvps")
      .select("id,status,payment_status,buggy_requested,preferred_tee_time,guest_name,profiles(full_name,phone)")
      .eq("event_id", eventId).order("created_at");
    if (error) { setStatus("#adminRsvpStatus", error.message); return; }
    const preferenceLabel = value => ({ first: "First", middle: "Middle", end: "End" })[value] || "Middle";
    const row = item => `<article><div><strong>${escapeHtml(item.profiles?.full_name || item.guest_name || "Guest")}</strong><small>${escapeHtml(item.profiles?.phone || "No phone")} · ${item.buggy_requested ? "Buggy requested" : "Walking"} · prefers ${preferenceLabel(item.preferred_tee_time)} · ${escapeHtml(item.payment_status)}</small></div><button class="danger-link" type="button" data-remove-rsvp="${item.id}">Remove</button></article>`;
    const active = (data || []).filter(item => item.status === "playing");
    const reserves = (data || []).filter(item => item.status === "reserve");
    playing.innerHTML = active.length ? active.map(row).join("") : "<p>No confirmed players.</p>";
    reserve.innerHTML = reserves.length ? reserves.map(row).join("") : "<p>No reserves.</p>";
    document.querySelectorAll("[data-remove-rsvp]").forEach(button => button.addEventListener("click", async () => {
      const { error: removeError } = await client.from("rsvps").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", button.dataset.removeRsvp);
      setStatus("#adminRsvpStatus", removeError ? removeError.message : "Player removed. Regenerate tee times when ready.");
      if (!removeError) loadRsvps(eventId);
    }));
  };
  document.querySelector("#adminRsvpEvent")?.addEventListener("change", event => loadRsvps(event.target.value));

  const minutesToTime = total => `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  const teeWindowRank = value => ({ first: 0, middle: 1, end: 2 })[value] ?? 1;
  const teeWindowName = value => ({ first: "First", middle: "Middle", end: "End" })[value] || "Middle";
  const pairingKey = (first, second) => [first, second].sort().join("|");

  const buildPairingHistory = rows => {
    const savedGroups = new Map();
    (rows || []).forEach(row => {
      if (!row.member_id) return;
      const key = `${row.event_id}|${row.tee_time}`;
      if (!savedGroups.has(key)) savedGroups.set(key, []);
      savedGroups.get(key).push(row.member_id);
    });
    const pairings = new Map();
    savedGroups.forEach(members => {
      for (let first = 0; first < members.length; first += 1) {
        for (let second = first + 1; second < members.length; second += 1) {
          const key = pairingKey(members[first], members[second]);
          pairings.set(key, (pairings.get(key) || 0) + 1);
        }
      }
    });
    return pairings;
  };

  const groupSizes = count => {
    if (count <= 4) return count ? [count] : [];
    const numberOfGroups = Math.ceil(count / 4);
    if (count < numberOfGroups * 3) return [3, count - 3];
    const threeballs = numberOfGroups * 4 - count;
    return [
      ...Array(threeballs).fill(3),
      ...Array(numberOfGroups - threeballs).fill(4)
    ];
  };

  const mixCohort = (players, pairings) => {
    const remaining = [...players].sort((first, second) =>
      teeWindowRank(first.preferred_tee_time) - teeWindowRank(second.preferred_tee_time) ||
      String(first.profiles?.full_name || first.guest_name || "").localeCompare(String(second.profiles?.full_name || second.guest_name || ""))
    );
    return groupSizes(remaining.length).map(size => {
      const group = [remaining.shift()];
      while (group.length < size && remaining.length) {
        let bestIndex = 0;
        let bestScore = Infinity;
        remaining.forEach((candidate, index) => {
          const preferredDistance = group.reduce((total, member) =>
            total + Math.abs(teeWindowRank(candidate.preferred_tee_time) - teeWindowRank(member.preferred_tee_time)), 0);
          const repeatPairings = group.reduce((total, member) => {
            if (!candidate.member_id || !member.member_id) return total;
            return total + (pairings.get(pairingKey(candidate.member_id, member.member_id)) || 0);
          }, 0);
          const score = preferredDistance * 1000 + repeatPairings * 10 + index / 1000;
          if (score < bestScore) {
            bestScore = score;
            bestIndex = index;
          }
        });
        group.push(remaining.splice(bestIndex, 1)[0]);
      }
      return group.filter(Boolean);
    });
  };

  const groupPlayers = (players, pairings) => {
    const buggy = players.filter(item => item.buggy_requested);
    const walkers = players.filter(item => !item.buggy_requested);
    return [...mixCohort(buggy, pairings), ...mixCohort(walkers, pairings)];
  };
  document.querySelector("#adminGenerateTeeTimes")?.addEventListener("click", async () => {
    const eventId = document.querySelector("#adminTeeEvent").value;
    if (!eventId) { setStatus("#adminTeeStatus", "Select an event first."); return; }
    const [{ data, error }, { data: history, error: historyError }] = await Promise.all([
      client.from("rsvps")
        .select("member_id,guest_name,buggy_requested,preferred_tee_time,profiles(full_name,phone)")
        .eq("event_id", eventId).eq("status", "playing"),
      client.from("tee_times").select("event_id,tee_time,member_id,events(event_date)").neq("event_id", eventId)
    ]);
    if (error) { setStatus("#adminTeeStatus", error.message); return; }
    const selectedEvent = adminEvents.find(item => item.id === eventId);
    const previousGroups = (history || []).filter(row =>
      row.events?.event_date && selectedEvent?.event_date && row.events.event_date < selectedEvent.event_date
    );
    const pairings = historyError ? new Map() : buildPairingHistory(previousGroups);
    const [hours, minutes] = document.querySelector("#adminTeeStart").value.split(":").map(Number);
    const gap = Number(document.querySelector("#adminTeeGap").value) || 8;
    teeGroups = groupPlayers([...(data || [])], pairings).map((players, index) => ({
      time: minutesToTime(hours * 60 + minutes + index * gap), players
    }));
    document.querySelector("#adminTeePreview").innerHTML = teeGroups.length ? teeGroups.map((group, index) => `
      <article><strong>${group.time}</strong><span>Group ${index + 1}</span><div>${group.players.map(player => `<b>${escapeHtml(player.profiles?.full_name || player.guest_name || "Guest")}${player.buggy_requested ? " · buggy" : ""} · ${teeWindowName(player.preferred_tee_time)}</b>`).join("")}</div></article>
    `).join("") : "<p>No confirmed players to organise.</p>";
    document.querySelector("#adminSaveTeeTimes").disabled = !teeGroups.length;
    setStatus("#adminTeeStatus", teeGroups.length ? "Preview ready. Buggy groups are first, tee-window requests are applied, and previous pairings are minimised." : "");
  });
  document.querySelector("#adminSaveTeeTimes")?.addEventListener("click", async () => {
    const eventId = document.querySelector("#adminTeeEvent").value;
    const rows = teeGroups.flatMap((group, groupIndex) => group.players.map((player, position) => ({
      event_id: eventId, tee_time: group.time, tee_number: 1, position: position + 1,
      member_id: player.member_id || null, guest_name: player.member_id ? null : player.guest_name
    })));
    const { error: deleteError } = await client.from("tee_times").delete().eq("event_id", eventId);
    const { error } = deleteError ? { error: deleteError } : await client.from("tee_times").insert(rows);
    setStatus("#adminTeeStatus", error ? error.message : "Tee times saved.");
  });
  document.querySelector("#adminWhatsAppTeeTimes")?.addEventListener("click", async () => {
    const event = adminEvents.find(item => item.id === document.querySelector("#adminTeeEvent").value);
    const message = [`⛳ ${event?.name || "Barford tee times"}`, ...teeGroups.map(group =>
      `${group.time} — ${group.players.map(player => player.profiles?.full_name || player.guest_name || "Guest").join(", ")}`
    )].join("\n");
    await navigator.clipboard.writeText(message);
    setStatus("#adminTeeStatus", "WhatsApp tee-time message copied.");
  });

  const refreshRoundEventOptions = () => {
    const select = document.querySelector("#adminRoundEvent");
    if (!select) return;
    const linkedEventIds = new Set(adminRounds.map(round => round.event_id).filter(Boolean));
    const availableEvents = adminEvents.filter(event =>
      !linkedEventIds.has(event.id) && event.status !== "cancelled"
    );
    select.innerHTML = `<option value="">Select event</option>${availableEvents.map(event =>
      `<option value="${event.id}">${escapeHtml(event.name)} · ${escapeHtml(event.event_date)}</option>`
    ).join("")}`;
    const nextNumber = Math.max(0, ...adminRounds.map(round => Number(round.round_number) || 0)) + 1;
    document.querySelector("#adminRoundNumber").value = nextNumber;
  };

  const loadRounds = async () => {
    const { data, error } = await client.from("rounds").select("*,events(name,venue,event_date)").eq("season", 2027).order("round_number");
    if (error) { setStatus("#adminRoundStatus", error.message); return; }
    const rounds = data || [];
    adminRounds = rounds;
    refreshRoundEventOptions();
    document.querySelector("#adminScoreRound").innerHTML = `<option value="">Select round</option>${rounds.map(round =>
      `<option value="${round.id}">Round ${round.round_number} · ${escapeHtml(round.events?.name || round.name)}</option>`).join("")}`;
    const list = document.querySelector("#adminRoundList");
    list.innerHTML = rounds.length ? rounds.map(round => `<article><div><strong>Round ${round.round_number} · ${escapeHtml(round.events?.name || round.name)}</strong><small>${escapeHtml(round.events?.event_date || round.played_on || "Date not set")} · ${escapeHtml(round.events?.venue || "")} · ${round.locked ? "Locked" : "Open"}</small></div><button type="button" data-lock-round="${round.id}" data-locked="${round.locked}">${round.locked ? "Unlock" : "Lock round"}</button></article>`).join("") : "<p>No rounds created. Choose a published event above to make Round 1.</p>";
    list.querySelectorAll("[data-lock-round]").forEach(button => button.addEventListener("click", async () => {
      const locked = button.dataset.locked !== "true";
      const { error: lockError } = await client.from("rounds").update({ locked }).eq("id", button.dataset.lockRound);
      setStatus("#adminRoundStatus", lockError ? lockError.message : locked ? "Round locked." : "Round unlocked.");
      if (!lockError) loadRounds();
    }));
  };
  document.querySelector("#adminRoundForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const eventId = document.querySelector("#adminRoundEvent").value;
    const linkedEvent = adminEvents.find(item => item.id === eventId);
    if (!linkedEvent) {
      setStatus("#adminRoundStatus", "Choose a published event first.");
      return;
    }
    const payload = {
      event_id: linkedEvent.id,
      season: 2027,
      round_number: Number(document.querySelector("#adminRoundNumber").value),
      name: linkedEvent.name,
      played_on: linkedEvent.event_date
    };
    const { error } = await client.from("rounds").insert(payload);
    setStatus("#adminRoundStatus", error ? error.message : `Round ${payload.round_number} is now ${linkedEvent.name} on ${linkedEvent.event_date}.`);
    if (!error) await loadRounds();
  });

  const loadScoreEditor = async roundId => {
    const editor = document.querySelector("#adminScoreEditor");
    if (!roundId) { editor.innerHTML = "<p>Select a round.</p>"; return; }
    const [{ data: round }, { data: players }, { data: scores }] = await Promise.all([
      client.from("rounds").select("round_number,locked").eq("id", roundId).single(),
      client.from("profiles").select("id,full_name,handicap,leaderboard_from_round").eq("leaderboard_active", true).order("full_name"),
      client.from("scores").select("*").eq("round_id", roundId)
    ]);
    const eligible = (players || []).filter(player => Number(player.leaderboard_from_round || 1) <= Number(round?.round_number || 1));
    const byMember = new Map((scores || []).map(score => [score.member_id, score]));
    editor.innerHTML = eligible.length ? eligible.map(player => {
      const score = byMember.get(player.id) || {};
      return `<article class="admin-score-row" data-score-member="${player.id}">
        <strong>${escapeHtml(player.full_name)}</strong>
        <label>HCP<input data-field="handicap_used" type="number" step=".1" value="${score.handicap_used ?? player.handicap ?? ""}"></label>
        <label>Points<input data-field="points" type="number" min="0" value="${score.points ?? ""}"></label>
        <label>Adjustment<input data-field="adjustment" type="number" step=".5" value="${score.adjustment ?? ""}"></label>
        <label>Next HCP<input data-field="next_handicap" type="number" step=".1" value="${score.next_handicap ?? ""}"></label>
        <label class="score-check"><input data-field="dnp" type="checkbox" ${score.dnp ? "checked" : ""}> DNP</label>
        <label class="score-check"><input data-field="winner" type="checkbox" ${score.winner ? "checked" : ""}> Winner</label>
      </article>`;
    }).join("") : "<p>No eligible leaderboard players for this round.</p>";
    document.querySelector("#adminSaveScores").disabled = Boolean(round?.locked) || !eligible.length;
    setStatus("#adminScoreStatus", round?.locked ? "Unlock this round before changing scores." : "");
  };
  document.querySelector("#adminScoreRound")?.addEventListener("change", event => loadScoreEditor(event.target.value));
  document.querySelector("#adminSaveScores")?.addEventListener("click", async () => {
    const roundId = document.querySelector("#adminScoreRound").value;
    const rows = [...document.querySelectorAll("[data-score-member]")].map(row => {
      const value = name => row.querySelector(`[data-field="${name}"]`).value;
      const number = name => value(name) === "" ? null : Number(value(name));
      return {
        round_id: roundId,
        member_id: row.dataset.scoreMember,
        handicap_used: number("handicap_used"),
        points: number("points"),
        adjustment: number("adjustment"),
        next_handicap: number("next_handicap"),
        dnp: row.querySelector('[data-field="dnp"]').checked,
        winner: row.querySelector('[data-field="winner"]').checked,
        updated_at: new Date().toISOString()
      };
    });
    const { error } = await client.from("scores").upsert(rows, { onConflict: "round_id,member_id" });
    setStatus("#adminScoreStatus", error ? error.message : "All round scores saved.");
  });
  document.querySelector("#adminExportLeaderboard")?.addEventListener("click", async () => {
    const { data } = await client.rpc("get_2027_leaderboard_snapshot");
    const rows = [["Player", "Round", "Points", "Handicap", "Next Handicap"]];
    (data?.rounds || []).forEach(round => (round.results || []).forEach(result => {
      const player = (data.players || []).find(item => item.id === result.playerId);
      rows.push([player?.name || "", round.name, result.points ?? "DNP", result.handicapUsed ?? "", result.nextHandicap ?? ""]);
    }));
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "barford-2027-leaderboard.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });
  document.querySelector("#adminClearScores")?.addEventListener("click", async () => {
    if (!confirm("Clear every 2027 score? Member accounts, events and rounds will remain. This cannot be undone.")) return;
    if (!confirm("Final confirmation: permanently delete all 2027 score entries?")) return;
    const { data: rounds } = await client.from("rounds").select("id").eq("season", 2027);
    const roundIds = (rounds || []).map(round => round.id);
    if (!roundIds.length) { setStatus("#adminRoundStatus", "There are no 2027 rounds to clear."); return; }
    const { error } = await client.from("scores").delete().in("round_id", roundIds);
    setStatus("#adminRoundStatus", error ? error.message : "All 2027 scores were cleared. Rounds and members remain.");
  });

  const loadGallery = async () => {
    const { data, error } = await client.from("gallery_photos").select("*").order("created_at", { ascending: false });
    if (error) { setStatus("#adminGalleryStatus", error.message); return; }
    document.querySelector("#adminGalleryCount").textContent = `${(data || []).filter(item => !item.approved).length} awaiting approval`;
    const list = document.querySelector("#adminGalleryList");
    const photos = await Promise.all((data || []).map(async photo => {
      const { data: signed } = await client.storage.from("gallery-images").createSignedUrl(photo.storage_path, 900);
      return { ...photo, url: signed?.signedUrl };
    }));
    list.innerHTML = photos.length ? photos.map(photo => `<article><div class="admin-photo">${photo.url ? `<img loading="lazy" src="${photo.url}" alt="">` : ""}</div><strong>${escapeHtml(photo.caption || "Society photo")}</strong><small>${photo.approved ? "Approved" : "Waiting for approval"}</small><div class="admin-row-actions">${photo.approved ? "" : `<button type="button" data-approve-photo="${photo.id}">Approve</button>`}<button class="danger-link" type="button" data-delete-photo="${photo.id}" data-photo-path="${escapeHtml(photo.storage_path)}">Delete</button></div></article>`).join("") : "<p>No photographs uploaded.</p>";
    list.querySelectorAll("[data-approve-photo]").forEach(button => button.addEventListener("click", async () => {
      const { error: approveError } = await client.from("gallery_photos").update({ approved: true }).eq("id", button.dataset.approvePhoto);
      setStatus("#adminGalleryStatus", approveError ? approveError.message : "Photo approved.");
      if (!approveError) loadGallery();
    }));
    list.querySelectorAll("[data-delete-photo]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Delete this photograph permanently?")) return;
      const storageResult = await client.storage.from("gallery-images").remove([button.dataset.photoPath]);
      const { error: rowError } = storageResult.error ? { error: storageResult.error } : await client.from("gallery_photos").delete().eq("id", button.dataset.deletePhoto);
      setStatus("#adminGalleryStatus", rowError ? rowError.message : "Photo deleted.");
      if (!rowError) loadGallery();
    }));
  };

  const loadContent = async () => {
    const [{ data: products, error: productError }, { data: trips, error: tripError }] = await Promise.all([
      client.from("products").select("*").order("created_at"),
      client.from("world_events").select("*,world_event_votes(vote)").order("created_at", { ascending: false })
    ]);
    const productList = document.querySelector("#adminProductList");
    productList.innerHTML = productError ? `<p>${escapeHtml(productError.message)}</p>` : (products || []).map(product => `<article><div><strong>${escapeHtml(product.name)}</strong><small>£${Number(product.price).toFixed(2)} · ${product.stock} in stock</small></div><button class="danger-link" type="button" data-remove-product="${product.id}">Remove</button></article>`).join("") || "<p>No products.</p>";
    const tripList = document.querySelector("#adminTripList");
    tripList.innerHTML = tripError ? `<p>${escapeHtml(tripError.message)}</p>` : (trips || []).map(trip => {
      const votes = trip.world_event_votes || [];
      return `<article><div><strong>${escapeHtml(trip.name)}</strong><small>${votes.filter(v => v.vote === "yes").length} yes · ${votes.filter(v => v.vote === "maybe").length} maybe · ${votes.filter(v => v.vote === "no").length} no</small></div><button class="danger-link" type="button" data-remove-trip="${trip.id}">Delete</button></article>`;
    }).join("") || "<p>No trip events.</p>";
    document.querySelectorAll("[data-remove-product]").forEach(button => button.addEventListener("click", async () => {
      await client.from("products").update({ active: false }).eq("id", button.dataset.removeProduct); loadContent();
    }));
    document.querySelectorAll("[data-remove-trip]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Delete this trip and its votes?")) return;
      await client.from("world_events").delete().eq("id", button.dataset.removeTrip); loadContent();
    }));
  };
  document.querySelector("#adminProductForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const { error } = await client.from("products").insert({
      name: document.querySelector("#adminProductName").value.trim(),
      price: Number(document.querySelector("#adminProductPrice").value),
      stock: Number(document.querySelector("#adminProductStock").value),
      description: document.querySelector("#adminProductDescription").value.trim() || null
    });
    setStatus("#adminContentStatus", error ? error.message : "Product added.");
    if (!error) { event.currentTarget.reset(); loadContent(); }
  });
  document.querySelector("#adminTripForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const { error } = await client.from("world_events").insert({
      name: document.querySelector("#adminTripName").value.trim(),
      video_url: document.querySelector("#adminTripVideo").value.trim() || null
    });
    setStatus("#adminContentStatus", error ? error.message : "Trip event created.");
    if (!error) { event.currentTarget.reset(); loadContent(); }
  });

  const loadAccounts = async () => {
    const list = document.querySelector("#adminAccountList");
    const accountCount = document.querySelector("#adminAccountCount");
    accountCount.textContent = "Loading…";

    const coreColumns = "id,full_name,email,phone,photo_url,is_admin,leaderboard_active,leaderboard_from_round,created_at";
    let contactedAvailable = true;
    let result = await client.from("profiles")
      .select(`${coreColumns},committee_contacted`)
      .order("full_name");

    if (result.error && /committee_contacted|column .* does not exist/i.test(result.error.message || "")) {
      contactedAvailable = false;
      result = await client.from("profiles").select(coreColumns).order("full_name");
    }

    if (result.error) {
      accountCount.textContent = "Could not load";
      list.innerHTML = '<p class="form-status error">Member accounts could not be loaded. Please refresh the page.</p>';
      setStatus("#adminAccountStatus", result.error.message);
      return;
    }

    const accounts = result.data || [];
    accountCount.textContent = `${accounts.length} account${accounts.length === 1 ? "" : "s"}`;
    list.innerHTML = accounts.map(account => `
      <article class="admin-account-row">
        <span class="admin-avatar">${escapeHtml(initials(account.full_name))}</span>
        <div class="admin-account-name"><strong>${escapeHtml(account.full_name)}</strong><small>${escapeHtml(account.email)} · ${escapeHtml(account.phone || "No phone")}</small></div>
        <span class="status ${account.is_admin ? "active" : "member"}">${account.is_admin ? "Administrator" : "Member"}</span>
        ${contactedAvailable ? `<label class="admin-access-toggle">
          <input type="checkbox" data-contacted-id="${escapeHtml(account.id)}" ${account.committee_contacted ? "checked" : ""}>
          <span>${account.committee_contacted ? "Contacted" : "Mark contacted"}</span>
        </label>` : ""}
        <label class="admin-access-toggle leaderboard-toggle">
          <input type="checkbox" data-leaderboard-id="${escapeHtml(account.id)}" data-leaderboard-name="${escapeHtml(account.full_name)}" ${account.leaderboard_active !== false ? "checked" : ""}>
          <span>${account.leaderboard_active !== false ? `Leaderboard · from round ${account.leaderboard_from_round || 1}` : "Add to leaderboard"}</span>
        </label>
        <label class="admin-access-toggle">
          <input type="checkbox" data-admin-id="${escapeHtml(account.id)}" data-admin-name="${escapeHtml(account.full_name)}" ${account.is_admin ? "checked" : ""} ${account.id === signedInProfile.id ? "disabled" : ""}>
          <span>${account.is_admin ? "Admin access on" : "Give admin access"}</span>
        </label>
      </article>`).join("");
    if (!contactedAvailable) {
      setStatus("#adminAccountStatus", "Admin and leaderboard controls are ready. Run admin-controls-add-on.sql to also enable the contacted marker.");
    } else {
      setStatus("#adminAccountStatus", "");
    }

    list.querySelectorAll("[data-admin-id]").forEach(input => input.addEventListener("change", event => {
      const control = event.currentTarget;
      pendingChange = {
        id: control.dataset.adminId,
        name: control.dataset.adminName,
        grant: control.checked,
        control
      };
      control.checked = !control.checked;
      document.querySelector("#adminAccessTitle").textContent = pendingChange.grant
        ? `Give ${pendingChange.name} admin access?`
        : `Remove ${pendingChange.name}’s admin access?`;
      document.querySelector("#adminAccessMessage").textContent = pendingChange.grant
        ? `${pendingChange.name} will be able to view and edit all member, event, score, RSVP and payment information.`
        : `${pendingChange.name} will immediately lose access to the Admin page and all protected controls.`;
      document.querySelector("#adminAccessConfirmLabel").textContent = `I confirm I selected ${pendingChange.name}`;
      confirmCheck.checked = false;
      confirmButton.disabled = true;
      document.querySelector("#adminAccessDialogStatus").textContent = "";
      dialog.showModal();
    }));
    list.querySelectorAll("[data-leaderboard-id]").forEach(input => input.addEventListener("change", async event => {
      const control = event.currentTarget;
      const makeActive = control.checked;
      control.disabled = true;
      const { error: membershipError } = await client.rpc("set_member_leaderboard_access", {
        target_user_id: control.dataset.leaderboardId,
        make_active: makeActive
      });
      if (membershipError) {
        control.checked = !makeActive;
        control.disabled = false;
        document.querySelector("#adminAccountStatus").textContent = membershipError.message;
        return;
      }
      document.querySelector("#adminAccountStatus").textContent = makeActive
        ? `${control.dataset.leaderboardName} has joined from the next eligible round.`
        : `${control.dataset.leaderboardName} has been removed from future leaderboard participation. Historical scores are preserved.`;
      await loadAccounts();
    }));
    list.querySelectorAll("[data-contacted-id]").forEach(input => input.addEventListener("change", async event => {
      const control = event.currentTarget;
      const { error: contactedError } = await client.from("profiles")
        .update({ committee_contacted: control.checked, updated_at: new Date().toISOString() })
        .eq("id", control.dataset.contactedId);
      if (contactedError) {
        control.checked = !control.checked;
        setStatus("#adminAccountStatus", contactedError.message);
        return;
      }
      setStatus("#adminAccountStatus", control.checked ? "Member marked as contacted." : "Contacted marker removed.");
      await loadAccounts();
    }));
  };

  confirmCheck?.addEventListener("change", () => {
    confirmButton.disabled = !confirmCheck.checked;
  });

  confirmButton?.addEventListener("click", async () => {
    if (!pendingChange || !confirmCheck.checked) return;
    confirmButton.disabled = true;
    confirmButton.textContent = "Saving…";
    const { error } = await client.rpc("set_member_admin_access", {
      target_user_id: pendingChange.id,
      grant_access: pendingChange.grant,
      confirmation_name: pendingChange.name
    });
    if (error) {
      document.querySelector("#adminAccessDialogStatus").textContent = error.message;
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirm change";
      return;
    }
    dialog.close();
    document.querySelector("#adminAccountStatus").textContent = pendingChange.grant
      ? `${pendingChange.name} now has administrator access.`
      : `${pendingChange.name}’s administrator access has been removed.`;
    confirmButton.textContent = "Confirm change";
    pendingChange = null;
    await loadAccounts();
  });

  const display = async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      login.classList.remove("hidden");
      dashboard.classList.add("hidden");
      denied.classList.add("hidden");
      return;
    }
    const { data: profile } = await client.from("profiles").select("id,full_name,is_admin").eq("id", session.user.id).single();
    signedInProfile = profile;
    login.classList.add("hidden");
    dashboard.classList.toggle("hidden", !profile?.is_admin);
    denied.classList.toggle("hidden", Boolean(profile?.is_admin));
    if (profile?.is_admin) {
      await Promise.allSettled([
        loadEvents(),
        loadRounds(),
        loadGallery(),
        loadContent(),
        loadAccounts()
      ]);
    }
  };

  document.querySelector("#adminLoginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    status.textContent = "Signing in…";
    const { error } = await client.auth.signInWithPassword({
      email: document.querySelector("#adminEmail").value.trim().toLowerCase(),
      password: document.querySelector("#adminPassword").value
    });
    if (error) {
      status.textContent = "Email or password not recognised.";
      return;
    }
    status.textContent = "";
    await display();
  });

  document.querySelector("#adminSignOut")?.addEventListener("click", async () => {
    await client.auth.signOut();
    display();
  });
  display();
})();
