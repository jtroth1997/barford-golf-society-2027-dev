(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const teeCard = document.getElementById("adminTeeEvent")?.closest(".admin-card");
  const scoringSetup = document.getElementById("adminScoringSetup");
  if (!client || !teeCard || !scoringSetup) return;

  const heading = teeCard.querySelector(".admin-heading > div");
  if (heading) {
    heading.querySelector(".eyebrow").textContent = "Step 3";
    heading.querySelector("h3").textContent = "Tee times & scorecards";
    heading.querySelector("p").textContent = "Set the course scorecard and tees, generate the playing groups, then publish everything together when you are happy.";
  }

  const navButton = document.querySelector('[data-admin-view="scorecards"]');
  if (navButton) navButton.textContent = "Event Day & Results";

  const workflow = document.querySelector('[data-admin-panel="events"] .admin-workflow');
  if (workflow) workflow.innerHTML = '<span><b>1</b>Season setup</span><span><b>2</b>RSVPs</span><span><b>3</b>Tee times + cards</span><span><b>4</b>Event day</span><span><b>5</b>Finish & publish</span>';

  const setupWrap = document.createElement("section");
  setupWrap.className = "admin-combined-scorecard-setup";
  setupWrap.innerHTML = '<div class="admin-heading"><div><p class="eyebrow">Scorecard setup</p><h4>Course & scoring information</h4><p class="admin-score-help">Choose the course, yellow/red tees and competition holes here. This information will be attached to the groups when you publish.</p></div></div>';
  const inlineFields = teeCard.querySelector(".admin-inline-fields");
  teeCard.insertBefore(setupWrap, inlineFields);

  const courseImport = document.querySelector(".admin-course-import");
  const competition = document.querySelector(".admin-competition-setup");
  const advanced = document.querySelector(".admin-advanced-scorecard");
  const savedBox = document.getElementById("adminScorecardSaved");
  [courseImport, savedBox, competition, advanced].forEach(node => { if (node) setupWrap.appendChild(node); });

  const checklist = document.getElementById("adminScoringChecklist");
  if (checklist) checklist.remove();
  const prepare = document.getElementById("adminPrepareScorecards");
  if (prepare) {
    const section = prepare.closest("section");
    prepare.remove();
    document.getElementById("adminScorecardProgress")?.remove();
    const groupHeading = Array.from(section?.querySelectorAll("h4") || []).find(el => /group scorecards/i.test(el.textContent));
    const groupHelp = Array.from(section?.querySelectorAll("p.admin-score-help") || []).find(el => /tee times|handicaps|scorecard/i.test(el.textContent));
    groupHeading?.remove(); groupHelp?.remove();
  }

  const scoringHeading = document.querySelector('[data-admin-panel="scorecards"] .admin-live-scoring .admin-heading > div');
  if (scoringHeading) {
    scoringHeading.querySelector(".eyebrow").textContent = "Event day";
    scoringHeading.querySelector("h3").textContent = "Live scoring & finish round";
    scoringHeading.querySelector("p").textContent = "Scorecards are created with the published tee times. On the day, each group chooses its scorer before entering any scores.";
  }
  document.getElementById("adminScoringEvent")?.closest(".admin-heading")?.querySelector("select")?.classList.add("admin-event-day-select");

  const generate = document.getElementById("adminGenerateTeeTimes");
  const publish = document.getElementById("adminSaveTeeTimes");
  if (generate) generate.textContent = "Generate tee times & scorecards";
  if (publish) publish.textContent = "Publish tee times & scorecards";

  const teeSelect = document.getElementById("adminTeeEvent");
  const scoringSelect = document.getElementById("adminScoringEvent");
  teeSelect?.addEventListener("change", () => {
    if (!scoringSelect) return;
    scoringSelect.value = teeSelect.value;
    scoringSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  generate?.addEventListener("click", async event => {
    const eventId = teeSelect?.value;
    if (!eventId) return;
    const { count } = await client.from("event_holes").select("id", { count: "exact", head: true }).eq("event_id", eventId);
    if (count !== 18) {
      event.stopImmediatePropagation();
      document.getElementById("adminTeeStatus").textContent = "Set and save the course scorecard information above before generating the tee times and scorecards.";
    }
  }, true);

  publish?.addEventListener("click", () => {
    const status = document.getElementById("adminTeeStatus");
    if (status) status.textContent = "Publishing tee times and group scorecards together…";
  }, true);

  const statusObserver = new MutationObserver(() => {
    const status = document.getElementById("adminTeeStatus");
    if (!status) return;
    if (/tee times saved and group scorecards prepared automatically/i.test(status.textContent)) {
      status.textContent = "Published. Tee times and group scorecards are now available to members. Each group must choose its scorer on the day.";
    }
    if (/tee times saved\. load the course/i.test(status.textContent)) {
      status.textContent = "Not published: the course scorecard must be completed first so tee times and scorecards can go live together.";
    }
  });
  const teeStatus = document.getElementById("adminTeeStatus");
  if (teeStatus) statusObserver.observe(teeStatus, { childList: true, subtree: true, characterData: true });
})();