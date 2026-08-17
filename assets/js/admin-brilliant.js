(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client || !document.getElementById("adminDashboard")) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dashboard = document.getElementById("adminDashboard");
  let seasonData = null;
  let pendingTestEvent = null;

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

    const testDialog = document.createElement("dialog");
    testDialog.id = "testEventWarningDialog";
    testDialog.className = "test-event-dialog";
    testDialog.innerHTML = `
      <div class="test-event-dialog-inner">
        <div class="test-event-warning-mark">TEST</div>
        <p class="eyebrow">Test Event Mode</p>
        <h2 id="testEventWarningTitle">Start test event?</h2>
        <p id="testEventWarningCopy">This will run the event as a full live-event simulation.</p>
        <div class="test-event-warning-box">
          <strong>This is a test event.</strong>
          <span>The site will temporarily treat this round as happening today. You can RSVP, publish tee times, choose a scorer, use the event camera, score all 18 holes, test poor signal, hand scoring over and submit the card exactly as a member would.</span>
          <span>The real scheduled date is stored safely and restored when Test Mode ends.</span>
        </div>
        <div class="test-event-dialog-actions"><button id="testEventCancel" class="button button-outline" type="button">Cancel</button><button id="testEventConfirm" class="button button-primary" type="button">Start test & open member view</button></div>
        <p id="testEventDialogStatus" class="form-status" aria-live="polite"></p>
      </div>`;
    document.body.appendChild(testDialog);
    document.getElementById("testEventCancel")?.addEventListener("click", () => testDialog.close());
    document.getElementById("testEventConfirm")?.addEventListener("click", async event => {
      if (!pendingTestEvent) return;
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Starting Test Mode…";
      const status = document.getElementById("testEventDialogStatus");
      if (status) status.textContent = "Making this event behave as today’s live round…";
      const { error } = await client.rpc("set_event_test_mode", { target_event_id: pendingTestEvent.id, make_active: true });
      if (error) {
        if (status) status.textContent = error.message;
        button.disabled = false;
        button.textContent = "Start test & open member view";
        return;
      }
      testDialog.close();
      window.location.href = "index.html?test=1";
    });

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
    const activeTest = events.find(item => item.test_mode_active);
    const summary = document.getElementById("seasonSetupSummary");
    if (summary) summary.innerHTML = `<div><strong>${created}/7</strong><span>Events created</span></div><div><strong>${courseReady}/7</strong><span>Course cards ready</span></div><div><strong>${eventReady}/7</strong><span>Event-day ready</span></div>`;

    const byRound = new Map(events.map(item => [Number(item.round_number), item]));
    list.innerHTML = Array.from({ length: 7 }, (_, index) => {
      const round = index + 1;
      const item = byRound.get(round);
      if (!item) return `<article class="season-round-row season-missing"><div class="season-round-number">R${round}</div><div class="season-round-copy"><strong>Round ${round} not created</strong><small>Create the event and its course card in Events.</small></div><div class="season-round-actions"><button class="button button-outline" type="button" data-go-events>Open Events</button></div></article>`;
      const eventDayReady = item.course_ready && item.tee_players > 0 && item.scorecards > 0;
      const realDate = item.display_event_date || item.test_original_event_date || item.event_date;
      return `<article class="season-round-row ${item.test_mode_active ? "test-mode-active" : ""}" data-season-event="${item.id}">
        <div class="season-round-number">R${round}</div>
        <div class="season-round-copy"><strong>${esc(item.name)}${item.test_mode_active ? ' <span class="season-test-live">TEST LIVE</span>' : ""}</strong><small>${esc(realDate || "Date TBC")}${item.test_mode_active ? " · temporarily running as today" : ""}</small><div class="season-round-flags">${flag("Course ready", item.course_ready, "Course needed")}${flag(`${item.rsvps} players`, item.rsvps > 0, "No RSVPs")}${flag("Tee times", item.tee_players > 0, "Tee times waiting")}${flag("Cards ready", item.scorecards > 0, "Cards waiting")}${flag("Complete", item.round_locked, eventDayReady ? "Ready for event" : "Not event-ready")}</div><div class="season-preflight hidden"></div></div>
        <div class="season-round-actions"><button class="button button-outline" type="button" data-preflight="${item.id}">Check</button><button class="button button-primary" type="button" data-open-scoring="${item.id}">Scoring</button>${item.test_mode_active ? `<button class="button button-outline test-end-button" type="button" data-end-test="${item.id}" data-name="${esc(item.name)}">End test</button>` : `<button class="button button-outline test-start-button" type="button" data-start-test="${item.id}" data-name="${esc(item.name)}" data-date="${esc(realDate || "")}">Test event</button>`}${item.is_test || item.test_mode_active ? `<button class="button button-outline danger-link" type="button" data-reset-test="${item.id}" data-name="${esc(item.name)}">Reset test</button>` : ""}</div>
      </article>`;
    }).join("");
    if (status) status.textContent = activeTest
      ? `TEST MODE ACTIVE — ${activeTest.name}. End the test when you have finished so its real date is restored.`
      : courseReady === 7 ? "All seven course cards are prepared." : `${7 - courseReady} course card${7 - courseReady === 1 ? "" : "s"} still need preparing.`;
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

  const cleanTestPhotos = async eventId => {
    const { data: photos } = await client.from("gallery_photos").select("id,storage_path").eq("event_id", eventId);
    if (!photos?.length) return;
    const paths = photos.map(photo => photo.storage_path).filter(Boolean);
    if (paths.length) await client.storage.from("gallery-images").remove(paths);
    await client.from("gallery_photos").delete().eq("event_id", eventId);
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
    document.querySelectorAll("[data-start-test]").forEach(button => button.addEventListener("click", () => {
      pendingTestEvent = { id: button.dataset.startTest, name: button.dataset.name, date: button.dataset.date };
      const title = document.getElementById("testEventWarningTitle");
      const copy = document.getElementById("testEventWarningCopy");
      const status = document.getElementById("testEventDialogStatus");
      const confirmButton = document.getElementById("testEventConfirm");
      if (title) title.textContent = `Test ${pendingTestEvent.name}?`;
      if (copy) copy.textContent = pendingTestEvent.date ? `Its real event date is ${pendingTestEvent.date}. That date will not be lost.` : "Its real event date will be kept safely.";
      if (status) status.textContent = "";
      if (confirmButton) { confirmButton.disabled = false; confirmButton.textContent = "Start test & open member view"; }
      document.getElementById("testEventWarningDialog")?.showModal();
    }));
    document.querySelectorAll("[data-end-test]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm(`End Test Mode for ${button.dataset.name}?\n\nThe real event date will be restored. Test RSVPs, tee times and scores will remain until you use Reset test.`)) return;
      button.disabled = true; button.textContent = "Ending…";
      const { error } = await client.rpc("set_event_test_mode", { target_event_id: button.dataset.endTest, make_active: false });
      if (error) { alert(error.message); button.disabled = false; button.textContent = "End test"; return; }
      await loadSeason();
    }));
    document.querySelectorAll("[data-reset-test]").forEach(button => button.addEventListener("click", async () => {
      const name = button.dataset.name;
      const typed = prompt(`Reset ${name} back to a fresh test round while keeping its course card?\n\nThis clears test RSVPs, tee times, group scorecards, scores and event-linked test photos.\n\nType the full event name to confirm.`);
      if (typed !== name) return;
      button.disabled = true; button.textContent = "Resetting…";
      await cleanTestPhotos(button.dataset.resetTest);
      const { error } = await client.rpc("reset_test_event", { target_event_id: button.dataset.resetTest, preserve_course: true, confirmation_name: typed });
      if (error) { button.disabled = false; button.textContent = "Reset test"; alert(error.message); return; }
      await loadSeason();
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