(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client || !document.getElementById("adminDashboard")) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dashboard = document.getElementById("adminDashboard");
  let seasonData = null;

  const ensureUi = () => {
    if (document.querySelector('[data-admin-view="season"]')) return;
    const nav = document.querySelector(".admin-section-nav");
    const eventsButton = nav?.querySelector('[data-admin-view="events"]');
    if (!nav || !eventsButton) return;
    const seasonButton = document.createElement("button");
    seasonButton.type = "button";
    seasonButton.dataset.adminView = "season";
    seasonButton.textContent = "Season Setup";
    eventsButton.after(seasonButton);

    const eventsPanel = document.querySelector('[data-admin-panel="events"]');
    const panel = document.createElement("section");
    panel.className = "admin-view hidden";
    panel.dataset.adminPanel = "season";
    panel.innerHTML = `
      <section class="admin-card season-setup-panel">
        <div class="admin-heading"><div><p class="eyebrow">2027 control board</p><h3>Season Setup</h3><p>One view of every round, course card and event-day dependency.</p></div><button id="seasonSetupRefresh" class="button button-outline" type="button">Refresh</button></div>
        <div id="seasonSetupSummary" class="season-setup-summary"><div><strong>—</strong><span>Events created</span></div><div><strong>—</strong><span>Course cards ready</span></div><div><strong>—</strong><span>Event-day ready</span></div></div>
        <div id="seasonReadinessList" class="season-readiness-list"><p>Checking the season…</p></div>
        <p id="seasonSetupStatus" class="form-status" aria-live="polite"></p>
      </section>`;
    eventsPanel.before(panel);

    seasonButton.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-view]").forEach(item => item.classList.toggle("active", item === seasonButton));
      document.querySelectorAll("[data-admin-panel]").forEach(item => item.classList.toggle("hidden", item.dataset.adminPanel !== "season"));
      loadSeason();
    });
    document.getElementById("seasonSetupRefresh")?.addEventListener("click", loadSeason);

    const teeStatus = document.getElementById("adminTeeStatus");
    if (teeStatus && !document.getElementById("adminTeePreflight")) {
      const preflight = document.createElement("div");
      preflight.id = "adminTeePreflight";
      preflight.className = "tee-preflight-banner";
      preflight.textContent = "Select an event to run the pre-event checks.";
      teeStatus.before(preflight);
    }
  };

  const flag = (label, ok, waitingLabel = label) => `<span class="season-flag ${ok ? "ok" : "wait"}">${ok ? "✓ " + esc(label) : esc(waitingLabel)}</span>`;

  const loadSeason = async () => {
    ensureUi();
    const status = document.getElementById("seasonSetupStatus");
    const list = document.getElementById("seasonReadinessList");
    if (!list) return;
    list.innerHTML = "<p>Checking all seven rounds…</p>";
    const { data, error } = await client.rpc("get_season_readiness", { target_season: 2027 });
    if (error) {
      list.innerHTML = `<p>${esc(error.message)}</p>`;
      return;
    }
    seasonData = data || { events: [] };
    const events = seasonData.events || [];
    const created = events.filter(item => Number(item.round_number) >= 1 && Number(item.round_number) <= 7).length;
    const courseReady = events.filter(item => item.course_ready).length;
    const eventReady = events.filter(item => item.tee_players > 0 && item.scorecards > 0 && item.course_ready).length;
    const summary = document.getElementById("seasonSetupSummary");
    if (summary) summary.innerHTML = `<div><strong>${created}/7</strong><span>Events created</span></div><div><strong>${courseReady}/7</strong><span>Course cards ready</span></div><div><strong>${eventReady}/7</strong><span>Event-day ready</span></div>`;

    const byRound = new Map(events.map(item => [Number(item.round_number), item]));
    list.innerHTML = Array.from({ length: 7 }, (_, index) => {
      const round = index + 1;
      const item = byRound.get(round);
      if (!item) return `<article class="season-round-row season-missing"><div class="season-round-number">R${round}</div><div class="season-round-copy"><strong>Round ${round} not created</strong><small>Create the event and its course card in Events.</small></div><div class="season-round-actions"><button class="button button-outline" type="button" data-go-events>Open Events</button></div></article>`;
      const eventDayReady = item.course_ready && item.tee_players > 0 && item.scorecards > 0;
      return `<article class="season-round-row" data-season-event="${item.id}">
        <div class="season-round-number">R${round}</div>
        <div class="season-round-copy"><strong>${esc(item.name)}</strong><small>${esc(item.event_date || "Date TBC")}</small><div class="season-round-flags">${flag("Course ready", item.course_ready, "Course needed")}${flag(`${item.rsvps} players`, item.rsvps > 0, "No RSVPs")}${flag("Tee times", item.tee_players > 0, "Tee times waiting")}${flag("Cards ready", item.scorecards > 0, "Cards waiting")}${flag("Complete", item.round_locked, eventDayReady ? "Ready for event" : "Not event-ready")}</div><div class="season-preflight hidden"></div></div>
        <div class="season-round-actions"><button class="button button-outline" type="button" data-preflight="${item.id}">Check</button><button class="button button-primary" type="button" data-open-scoring="${item.id}">Scoring</button>${item.is_test ? `<button class="button button-outline danger-link" type="button" data-reset-test="${item.id}" data-name="${esc(item.name)}">Reset test</button>` : ""}</div>
      </article>`;
    }).join("");
    if (status) status.textContent = courseReady === 7 ? "All seven course cards are prepared." : `${7 - courseReady} course card${7 - courseReady === 1 ? "" : "s"} still need preparing.`;
    bindRows();
  };

  const runPreflight = async (eventId, target) => {
    target?.classList.remove("hidden", "is-ready", "has-blockers");
    if (target) target.textContent = "Running checks…";
    const { data, error } = await client.rpc("get_event_preflight", { target_event_id: eventId });
    if (error) {
      if (target) target.textContent = error.message;
      return null;
    }
    const blockers = data?.blockers || [];
    const warnings = data?.warnings || [];
    if (target) {
      target.classList.add(blockers.length ? "has-blockers" : "is-ready");
      target.innerHTML = blockers.length
        ? `<strong>Not ready yet</strong><ul>${blockers.map(item => `<li>${esc(item)}</li>`).join("")}</ul>${warnings.length ? `<small>${warnings.map(esc).join(" · ")}</small>` : ""}`
        : `<strong>✓ Pre-event checks passed</strong>${warnings.length ? `<small>${warnings.map(esc).join(" · ")}</small>` : "<small>No blockers found.</small>"}`;
    }
    return data;
  };

  const openAdminView = view => {
    const button = document.querySelector(`[data-admin-view="${view}"]`);
    if (button) button.click();
  };

  const bindRows = () => {
    document.querySelectorAll("[data-go-events]").forEach(button => button.addEventListener("click", () => openAdminView("events")));
    document.querySelectorAll("[data-preflight]").forEach(button => button.addEventListener("click", async () => {
      const row = button.closest(".season-round-row");
      await runPreflight(button.dataset.preflight, row?.querySelector(".season-preflight"));
    }));
    document.querySelectorAll("[data-open-scoring]").forEach(button => button.addEventListener("click", () => {
      const eventId = button.dataset.openScoring;
      openAdminView("scorecards");
      setTimeout(() => {
        const select = document.getElementById("adminScoringEvent");
        if (select) { select.value = eventId; select.dispatchEvent(new Event("change", { bubbles: true })); }
      }, 0);
    }));
    document.querySelectorAll("[data-reset-test]").forEach(button => button.addEventListener("click", async () => {
      const name = button.dataset.name;
      const typed = prompt(`Reset ${name} back to a fresh test round while keeping its course card?\n\nType the full event name to confirm.`);
      if (typed !== name) return;
      button.disabled = true; button.textContent = "Resetting…";
      const { error } = await client.rpc("reset_test_event", { target_event_id: button.dataset.resetTest, preserve_course: true, confirmation_name: typed });
      if (error) { button.disabled = false; button.textContent = "Reset test"; alert(error.message); return; }
      await loadSeason();
      window.location.reload();
    }));
  };

  const teeSelect = document.getElementById("adminTeeEvent");
  const updateTeePreflight = async eventId => {
    const banner = document.getElementById("adminTeePreflight");
    const generate = document.getElementById("adminGenerateTeeTimes");
    if (!banner || !generate) return;
    if (!eventId) { banner.className = "tee-preflight-banner"; banner.textContent = "Select an event to run the pre-event checks."; generate.dataset.preflightReady = "0"; return; }
    banner.className = "tee-preflight-banner"; banner.textContent = "Checking course, players and handicaps…";
    const data = await runPreflight(eventId, null);
    if (!data) return;
    const ready = Boolean(data.ready_to_publish_tee_times);
    generate.dataset.preflightReady = ready ? "1" : "0";
    banner.className = `tee-preflight-banner ${ready ? "ready" : "blocked"}`;
    banner.textContent = ready ? `✓ Ready to generate tee times · ${data.player_count} confirmed players` : `Cannot generate yet: ${(data.blockers || []).join(" · ")}`;
  };
  teeSelect?.addEventListener("change", event => updateTeePreflight(event.target.value));
  document.getElementById("adminGenerateTeeTimes")?.addEventListener("click", event => {
    const button = event.currentTarget;
    if (button.dataset.preflightReady === "0") {
      event.preventDefault(); event.stopImmediatePropagation();
      const banner = document.getElementById("adminTeePreflight");
      banner?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (!dashboard.classList.contains("hidden")) {
      ensureUi();
      if (!seasonData) loadSeason();
      observer.disconnect();
    }
  });
  observer.observe(dashboard, { attributes: true, attributeFilter: ["class"] });
  ensureUi();
  if (!dashboard.classList.contains("hidden")) loadSeason();
})();
