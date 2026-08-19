(() => {
  "use strict";

  const client = window.BarfordSupabase;
  const list = document.querySelector("#eventList");
  if (!client || !list) return;

  let events = [];
  let session = null;

  const localToday = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };

  const loadContext = async () => {
    const sessionResult = await client.auth.getSession();
    session = sessionResult.data?.session || null;
    if (!session) return;

    const { data } = await client
      .from("events")
      .select("id,status")
      .in("status", ["scheduled", "cancelled"])
      .gte("event_date", localToday())
      .order("event_date", { ascending: true });
    events = data || [];
  };

  const saveRsvp = async (eventId, status, button) => {
    if (!session) {
      window.location.href = "account.html";
      return;
    }

    const lock = await client.rpc("get_event_rsvp_lock_status", { target_event_id: eventId });
    if (lock.data) {
      alert("Tee times have already been produced. Please contact an admin to make a change.");
      return;
    }

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Saving…";

    const payload = {
      event_id: eventId,
      member_id: session.user.id,
      status,
      updated_at: new Date().toISOString()
    };
    if (status === "playing") {
      payload.buggy_requested = false;
      payload.preferred_tee_time = "dont_mind";
    }

    const { error } = await client.from("rsvps").upsert(payload, { onConflict: "event_id,member_id" });
    if (error) {
      button.disabled = false;
      button.textContent = original;
      alert(error.message?.includes("locked") ? "Tee times have already been produced. Please contact an admin to make a change." : "We couldn’t save your RSVP. Please try again.");
      return;
    }

    window.location.reload();
  };

  const enhanceCards = () => {
    if (!session || !events.length) return;
    const cards = [...list.querySelectorAll(".compact-event-card")];
    cards.forEach((card, index) => {
      const event = events[index];
      if (!event || event.status === "cancelled") return;
      const state = card.querySelector(".event-member-state");
      const dashboardLink = state?.querySelector('a.button-primary[href="index.html"]');
      if (!dashboardLink || state.dataset.directRsvp === "ready") return;

      state.dataset.directRsvp = "ready";
      const existingChoice = /not playing/i.test(state.querySelector("strong")?.textContent || "");
      const actions = document.createElement("div");
      actions.className = "event-direct-rsvp-actions";
      actions.style.display = "flex";
      actions.style.gap = ".6rem";
      actions.style.flexWrap = "wrap";
      actions.style.marginTop = ".7rem";

      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "button button-primary";
      yes.textContent = existingChoice ? "Change to playing" : "Yes, I’m playing";
      yes.addEventListener("click", () => saveRsvp(event.id, "playing", yes));

      const no = document.createElement("button");
      no.type = "button";
      no.className = "button button-outline";
      no.textContent = "No, I can’t play";
      no.addEventListener("click", () => saveRsvp(event.id, "not_playing", no));

      actions.append(yes, no);
      dashboardLink.replaceWith(actions);
      const hint = state.querySelector("small");
      if (hint) hint.textContent = "RSVP here now. You can change your answer later until tee times are published.";
    });
  };

  const observer = new MutationObserver(() => enhanceCards());
  observer.observe(list, { childList: true, subtree: true });

  loadContext().then(() => enhanceCards());
})();
