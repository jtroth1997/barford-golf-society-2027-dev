(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const dashboard = document.getElementById("adminDashboard");
  const eventsPanel = document.querySelector('[data-admin-panel="events"]');
  if (!client || !dashboard || !eventsPanel) return;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let events = [], pending = null, observer;

  const addStyles = () => {
    if (document.getElementById("testEventControlsStyles")) return;
    const style = document.createElement("style");
    style.id = "testEventControlsStyles";
    style.textContent = `
      .admin-test-event-card{margin-bottom:16px;border:2px solid #d9bd72!important;background:linear-gradient(135deg,#fffaf0,#fff)!important}
      .admin-test-event-card .admin-heading{align-items:center}.admin-test-event-card h3{margin-bottom:4px}.admin-test-event-launch{display:flex;gap:9px;align-items:end;flex-wrap:wrap}.admin-test-event-launch label{min-width:220px;flex:1}.admin-test-event-launch select{width:100%;min-height:50px}.admin-test-event-launch .button{min-height:50px}.quick-test-event{border-color:#c7a64d!important;background:#fff9e8!important;color:#4e3a05!important;font-weight:900!important}.quick-test-event.is-live{border-color:#b54d43!important;background:#fff0ee!important;color:#7b2620!important}.admin-test-live-note{padding:10px 12px;border-radius:12px;background:#fff0ee;color:#792e28;font-weight:900;font-size:.82rem}.quick-test-dialog{border:0;border-radius:22px;width:min(92vw,520px);padding:0;box-shadow:0 28px 80px rgba(0,0,0,.28)}.quick-test-dialog::backdrop{background:rgba(4,24,17,.68)}.quick-test-dialog-inner{padding:24px}.quick-test-mark{display:inline-flex;padding:6px 10px;border-radius:999px;background:#b54d43;color:#fff;font-weight:950;letter-spacing:.08em;font-size:.72rem}.quick-test-warning{display:grid;gap:8px;margin:16px 0;padding:14px;border-radius:14px;background:#fff5e7;border:1px solid #ead29b}.quick-test-warning span{font-size:.86rem;line-height:1.45}.quick-test-actions{display:flex;gap:9px}.quick-test-actions .button{flex:1}@media(max-width:650px){.admin-test-event-launch{display:grid;grid-template-columns:1fr}.admin-test-event-launch label{min-width:0}.quick-test-actions{flex-direction:column}}
    `;
    document.head.appendChild(style);
  };

  const ensureDialog = () => {
    let dialog = document.getElementById("quickTestEventDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "quickTestEventDialog";
    dialog.className = "quick-test-dialog";
    dialog.innerHTML = `<div class="quick-test-dialog-inner"><span class="quick-test-mark">TEST EVENT</span><h2 id="quickTestTitle">Start test event?</h2><p id="quickTestIntro">This will simulate the selected event as if it is happening today.</p><div class="quick-test-warning"><strong>This is a test event.</strong><span>You will use the real member workflow: RSVP, tee times, scorer selection, camera, live scoring, offline recovery, handover and submission.</span><span>The real event date is stored and restored when Test Mode ends.</span></div><div class="quick-test-actions"><button id="quickTestCancel" class="button button-outline" type="button">Cancel</button><button id="quickTestConfirm" class="button button-primary" type="button">Start test & open member view</button></div><p id="quickTestStatus" class="form-status" aria-live="polite"></p></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#quickTestCancel")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("#quickTestConfirm")?.addEventListener("click", async event => {
      if (!pending) return;
      const button = event.currentTarget;
      button.disabled = true; button.textContent = "Starting Test Mode…";
      const status = dialog.querySelector("#quickTestStatus");
      status.textContent = "Preparing the full live-event simulation…";
      const { error } = await client.rpc("set_event_test_mode", { target_event_id: pending.id, make_active: true });
      if (error) { status.textContent = error.message; button.disabled = false; button.textContent = "Start test & open member view"; return; }
      location.href = "index.html?test=1";
    });
    return dialog;
  };

  const startWarning = event => {
    pending = event;
    const dialog = ensureDialog();
    dialog.querySelector("#quickTestTitle").textContent = `Test ${event.name}?`;
    dialog.querySelector("#quickTestIntro").textContent = `Real scheduled date: ${event.test_original_event_date || event.event_date}.`;
    dialog.querySelector("#quickTestStatus").textContent = "";
    const confirm = dialog.querySelector("#quickTestConfirm"); confirm.disabled = false; confirm.textContent = "Start test & open member view";
    dialog.showModal();
  };

  const endTest = async event => {
    if (!confirm(`End Test Mode for ${event.name}?\n\nIts real date will be restored. Test scores and tee times stay available until you reset the test.`)) return;
    const { error } = await client.rpc("set_event_test_mode", { target_event_id: event.id, make_active: false });
    if (error) { alert(error.message); return; }
    await refresh();
  };

  const ensureCard = () => {
    if (document.getElementById("adminQuickTestCard")) return;
    const card = document.createElement("section");
    card.id = "adminQuickTestCard";
    card.className = "admin-card admin-test-event-card";
    card.innerHTML = `<div class="admin-heading"><div><p class="eyebrow">Testing</p><h3>Test an event</h3><p>Run any event through the complete member experience without changing its real scheduled date.</p></div><span class="access-pill">Full simulation</span></div><div id="adminTestLiveNote" class="admin-test-live-note hidden"></div><div class="admin-test-event-launch"><label>Event<select id="adminQuickTestSelect"><option value="">Choose event to test</option></select></label><button id="adminQuickTestStart" class="button button-primary" type="button" disabled>Start test event</button></div>`;
    const workflow = eventsPanel.querySelector(".admin-workflow");
    workflow?.insertAdjacentElement("afterend", card);
    card.querySelector("#adminQuickTestSelect")?.addEventListener("change", event => {
      const selected = events.find(item => item.id === event.target.value);
      const button = card.querySelector("#adminQuickTestStart");
      button.disabled = !selected;
      button.textContent = selected?.test_mode_active ? "End active test" : "Start test event";
    });
    card.querySelector("#adminQuickTestStart")?.addEventListener("click", () => {
      const selected = events.find(item => item.id === card.querySelector("#adminQuickTestSelect").value);
      if (!selected) return;
      selected.test_mode_active ? endTest(selected) : startWarning(selected);
    });
  };

  const enhanceRows = () => {
    [document.getElementById("adminEventList"), document.getElementById("adminPastEventList")].filter(Boolean).forEach(list => {
      list.querySelectorAll("[data-edit-event]").forEach(edit => {
        const event = events.find(item => item.id === edit.dataset.editEvent);
        const actions = edit.closest("article")?.querySelector(".admin-row-actions");
        if (!event || !actions) return;
        let button = actions.querySelector(`[data-quick-test-event="${event.id}"]`);
        if (!button) {
          button = document.createElement("button"); button.type = "button"; button.dataset.quickTestEvent = event.id; button.className = "quick-test-event"; edit.after(button);
          button.addEventListener("click", () => event.test_mode_active ? endTest(event) : startWarning(event));
        }
        button.classList.toggle("is-live", Boolean(event.test_mode_active));
        button.textContent = event.test_mode_active ? "End TEST" : "Test event";
      });
    });
  };

  const render = () => {
    ensureCard();
    const select = document.getElementById("adminQuickTestSelect");
    const live = events.find(item => item.test_mode_active);
    if (select) {
      const current = select.value;
      select.innerHTML = `<option value="">Choose event to test</option>${events.filter(item => item.status !== "cancelled").map(item => `<option value="${item.id}">${esc(item.name)} · ${esc(item.test_original_event_date || item.event_date)}${item.test_mode_active ? " · TEST LIVE" : ""}</option>`).join("")}`;
      if (events.some(item => item.id === current)) select.value = current;
    }
    const note = document.getElementById("adminTestLiveNote");
    if (note) { note.classList.toggle("hidden", !live); note.textContent = live ? `TEST MODE ACTIVE — ${live.name}` : ""; }
    enhanceRows();
  };

  const refresh = async () => {
    const { data, error } = await client.from("events").select("id,name,event_date,status,test_mode_active,test_original_event_date").order("event_date");
    if (error) return;
    events = data || [];
    render();
  };

  addStyles(); ensureDialog(); ensureCard();
  observer = new MutationObserver(() => enhanceRows());
  [document.getElementById("adminEventList"), document.getElementById("adminPastEventList")].filter(Boolean).forEach(list => observer.observe(list,{childList:true,subtree:true}));
  const start = async () => {
    for (let i=0;i<50 && dashboard.classList.contains("hidden");i+=1) await new Promise(r=>setTimeout(r,100));
    if (!dashboard.classList.contains("hidden")) await refresh();
  };
  start();
})();