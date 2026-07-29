(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;

  let session;
  let nextEvent;
  let currentRsvp;
  const set = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  const show = (id, visible = true) => document.getElementById(id)?.classList.toggle("hidden", !visible);
  const initials = name => String(name || "BG").split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0].toUpperCase()).join("");
  const money = value => Number.isFinite(Number(value)) ? `£${Number(value).toFixed(2)}` : "TBC";
  const friendlyDate = value => value
    ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      .format(new Date(`${value}T12:00:00`))
    : "Date TBC";
  const friendlyTime = value => value ? String(value).slice(0, 5) : "Not announced";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const setAvatar = async profile => {
    const avatar = document.getElementById("dashboardAvatar");
    if (!avatar) return;
    avatar.textContent = initials(profile.full_name);
    if (!profile.photo_url) return;
    const { data } = await client.storage.from("profile-images").createSignedUrl(profile.photo_url, 3600);
    if (data?.signedUrl) {
      avatar.innerHTML = `<img src="${data.signedUrl}" alt="">`;
      avatar.classList.add("has-photo");
    }
  };

  const feedback = stats => {
    if (!stats) return "We could not find a matching name in the 2026 scores. If you are a new member, this is completely normal and your 2027 results will build here.";
    if (!stats.rounds) return "Your name is on the 2026 list, but no completed score was found. Your new 2027 results will appear here.";
    if (stats.position === 1) return `Outstanding season — you currently lead the 2026 table with ${stats.points} points from your best five rounds.`;
    if (stats.position <= 3) return `Excellent season — you are currently ${stats.position === 2 ? "2nd" : "3rd"} with ${stats.points} points and ${stats.topThreeFinishes} top-three finish${stats.topThreeFinishes === 1 ? "" : "es"}.`;
    if (stats.best >= 36) return `Your best round is an excellent ${stats.best} points. You sit ${stats.position}${stats.position === 11 ? "th" : stats.position % 10 === 1 ? "st" : stats.position % 10 === 2 ? "nd" : stats.position % 10 === 3 ? "rd" : "th"} overall with an average of ${stats.average}.`;
    return `You have completed ${stats.rounds} round${stats.rounds === 1 ? "" : "s"}, averaging ${stats.average} points. Your best score so far is ${stats.best}.`;
  };

  const loadLegacyStats = async fullName => {
    try {
      const { data: stats, error } = await client.functions.invoke("legacy-2026-stats");
      if (error) throw error;
      if (!stats) {
        set("legacyPlayerName", "No 2026 score match");
        set("legacyFeedback", feedback(null));
        return;
      }
      set("legacyPlayerName", stats.name);
      set("legacyPosition", stats.position ? `#${stats.position}` : "N/A");
      set("legacyPoints", stats.points ?? "N/A");
      set("legacyBest", stats.best ?? "N/A");
      set("legacyAverage", stats.average ?? "N/A");
      set("legacyRounds", stats.rounds ?? "N/A");
      set("legacyHandicap", stats.handicap ?? "N/A");
      set("legacyWins", stats.wins ?? 0);
      set("legacyTopThree", stats.topThreeFinishes ?? 0);
      set("legacyTrend", Number.isFinite(stats.trend) ? `${stats.trend > 0 ? "+" : ""}${stats.trend} pts` : "N/A");
      set("legacyFeedback", feedback(stats));
    } catch (error) {
      console.warn("The read-only 2026 season summary could not be loaded.", error);
      set("legacyPlayerName", "2026 data temporarily unavailable");
      set("legacyFeedback", "Your 2027 account is working. The current-season summary could not be reached just now, so please try again later.");
    }
  };

  const loadPayments = async () => {
    const { data, error } = await client
      .from("rsvps")
      .select("id,payment_status,event_id,events(name,event_date,price)")
      .eq("member_id", session.user.id)
      .eq("status", "playing")
      .eq("payment_status", "payment_due");
    const due = error ? [] : (data || []).filter(item => item.events && new Date(`${item.events.event_date}T23:59:59`) >= new Date());
    set("dashboardPaymentCount", due.length);
    const list = document.getElementById("dashboardPaymentList");
    if (!list) return;
    if (!due.length) {
      list.innerHTML = '<div class="dashboard-good"><span>✓</span><div><strong>Nothing to pay</strong><small>You are all up to date.</small></div></div>';
      return;
    }
    list.innerHTML = due.map(item => `
      <article>
        <div><strong>${escapeHtml(item.events.name)}</strong><small>${escapeHtml(friendlyDate(item.events.event_date))}</small></div>
        <b>${escapeHtml(money(item.events.price))}</b>
        <a class="button button-small" href="events.html#event-${encodeURIComponent(item.event_id)}">View payment</a>
      </article>`).join("");
  };

  const loadNextEvent = async () => {
    const today = localDate();
    const { data: events, error } = await client.from("events")
      .select("*").gte("event_date", today).eq("status", "scheduled").order("event_date").limit(1);
    if (error || !events?.length) {
      set("dashboardEventName", "No upcoming event announced");
      set("dashboardEventDetail", "The committee has not published the next 2027 event yet.");
      set("dashboardRsvpBadge", "Nothing due");
      return;
    }
    nextEvent = events[0];
    const [{ data: rsvp }, { data: teeTime }] = await Promise.all([
      client.from("rsvps").select("*").eq("event_id", nextEvent.id).eq("member_id", session.user.id).maybeSingle(),
      client.from("tee_times").select("tee_time").eq("event_id", nextEvent.id).eq("member_id", session.user.id).maybeSingle()
    ]);
    currentRsvp = rsvp;
    set("dashboardEventName", nextEvent.name);
    set("dashboardEventDetail", `${nextEvent.venue}${nextEvent.address ? ` · ${nextEvent.address}` : ""}`);
    set("dashboardEventDate", friendlyDate(nextEvent.event_date));
    set("dashboardTeeTime", friendlyTime(teeTime?.tee_time));
    set("dashboardEventPrice", money(nextEvent.price));
    set("dashboardRsvpBadge", rsvp?.status === "playing" ? "You’re playing" : rsvp?.status === "not_playing" ? "Not playing" : "RSVP needed");
    show("dashboardEventFacts");
    show("dashboardRsvpActions");
  };

  const saveRsvp = async status => {
    if (!nextEvent) return;
    const statusLine = document.getElementById("dashboardRsvpStatus");
    if (statusLine) statusLine.textContent = "Saving your RSVP…";
    const payload = {
      event_id: nextEvent.id,
      member_id: session.user.id,
      status,
      payment_status: currentRsvp?.payment_status || "payment_due",
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client.from("rsvps").upsert(payload, { onConflict: "event_id,member_id" }).select().single();
    if (error) {
      if (statusLine) statusLine.textContent = "Your RSVP could not be saved. Please try again.";
      return;
    }
    currentRsvp = data;
    set("dashboardRsvpBadge", status === "playing" ? "You’re playing" : "Not playing");
    if (statusLine) statusLine.textContent = status === "playing" ? "You are on the playing list." : "The committee now knows you cannot attend.";
    await loadPayments();
  };

  const load = async () => {
    const result = await client.auth.getSession();
    session = result.data.session;
    if (!session) return;
    document.getElementById("publicHome")?.classList.add("hidden");
    document.getElementById("memberHomeDashboard")?.classList.remove("hidden");
    const { data: profile } = await client.from("profiles").select("*").eq("id", session.user.id).single();
    const name = profile?.full_name || session.user.user_metadata?.full_name || "Member";
    set("dashboardFirstName", name.split(/\s+/)[0]);
    set("dashboardFullName", name);
    set("dashboardMembershipStatus", profile?.is_admin ? "2027 member · Administrator" : "2027 member");
    await Promise.all([
      profile ? setAvatar(profile) : Promise.resolve(),
      loadLegacyStats(name),
      loadNextEvent(),
      loadPayments()
    ]);
  };

  document.querySelectorAll("[data-rsvp]").forEach(button => button.addEventListener("click", () => saveRsvp(button.dataset.rsvp)));
  document.getElementById("dashboardAddPasskey")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Waiting for your device…";
    try {
      await window.BarfordPasskeys.register();
      localStorage.setItem("barford-passkey-offered", "complete");
      set("dashboardPasskeyStatus", "Face ID or device sign-in is ready.");
      button.textContent = "Device sign-in ready";
    } catch (error) {
      set("dashboardPasskeyStatus", error.name === "NotAllowedError" ? "Setup was cancelled. You can try again any time." : error.message);
      button.disabled = false;
      button.textContent = "Set up now";
    }
  });
  document.getElementById("dashboardDismissPasskey")?.addEventListener("click", () => {
    localStorage.setItem("barford-passkey-offered", "later");
    document.getElementById("dashboardPasskeyCard")?.classList.add("hidden");
  });
  load();
})();
