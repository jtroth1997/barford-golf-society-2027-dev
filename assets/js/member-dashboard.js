(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;

  let session;
  let nextEvent;
  let currentRsvp;
  let legacyCandidate;
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
    const avatars = [document.getElementById("dashboardAvatar"), document.getElementById("dashboardHeroAvatar")].filter(Boolean);
    avatars.forEach(avatar => {
      avatar.textContent = initials(profile.full_name);
      avatar.classList.remove("has-photo");
    });
    if (!profile.photo_url) return;
    const { data } = await client.storage.from("profile-images").createSignedUrl(profile.photo_url, 3600);
    if (data?.signedUrl) {
      avatars.forEach(avatar => {
        avatar.innerHTML = `<img src="${data.signedUrl}" alt="">`;
        avatar.classList.add("has-photo");
      });
    }
  };

  const ordinal = value => {
    const remainder = value % 100;
    if (remainder >= 11 && remainder <= 13) return `${value}th`;
    return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
  };
  const feedback = (stats, season = 2026) => {
    if (!stats) return "We could not find a matching name in the 2026 scores. If you are a new member, this is completely normal and your 2027 results will build here.";
    if (!stats.rounds) return "Your name is on the 2026 list, but no completed score was found. Your new 2027 results will appear here.";
    if (stats.position === 1) return `Outstanding season — you currently lead the ${season} table with ${stats.points} points from your best five rounds.`;
    if (stats.position <= 3) return `Excellent season — you are currently ${ordinal(stats.position)} with ${stats.points} points and ${stats.topThreeFinishes} top-three finish${stats.topThreeFinishes === 1 ? "" : "es"}.`;
    if (stats.best >= 36) return `Your best round is an excellent ${stats.best} points. You sit ${ordinal(stats.position)} overall with an average of ${stats.average}.`;
    return `You have completed ${stats.rounds} round${stats.rounds === 1 ? "" : "s"}, averaging ${stats.average} points. Your best score so far is ${stats.best}.`;
  };

  const showStats = (stats, season = 2026) => {
    document.getElementById("seasonDashboardCard")?.classList.remove("is-unavailable");
    document.getElementById("seasonDashboardCard")?.classList.remove("is-awaiting-match");
    show("dashboardRetry2026", false);
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
    set("legacyFeedback", feedback(stats, season));
  };

  const get2027Stats = async () => {
    const { data: ownScores, error } = await client.from("scores")
      .select("member_id,points,next_handicap,winner,runner_up,third_place,round_id,rounds!inner(season,round_number)")
      .eq("member_id", session.user.id)
      .eq("rounds.season", 2027)
      .eq("dnp", false);
    if (error || !ownScores?.length) return null;
    const { data: seasonScores } = await client.from("scores")
      .select("member_id,points,winner,rounds!inner(season)")
      .eq("rounds.season", 2027)
      .eq("dnp", false);
    const totals = new Map();
    (seasonScores || []).forEach(score => {
      if (!Number.isFinite(Number(score.points))) return;
      const current = totals.get(score.member_id) || { scores: [], wins: 0 };
      current.scores.push(Number(score.points));
      if (score.winner) current.wins += 1;
      totals.set(score.member_id, current);
    });
    const leaderboard = [...totals.entries()].map(([memberId, value]) => ({
      memberId,
      total: value.scores.sort((a, b) => b - a).slice(0, 5).reduce((sum, points) => sum + points, 0),
      wins: value.wins
    })).sort((a, b) => b.total - a.total || b.wins - a.wins);
    const rows = ownScores.filter(score => Number.isFinite(Number(score.points)))
      .sort((a, b) => Number(a.rounds?.round_number) - Number(b.rounds?.round_number));
    const points = rows.map(score => Number(score.points));
    const total = leaderboard.find(row => row.memberId === session.user.id);
    return {
      name: "Your 2027 performance",
      position: leaderboard.findIndex(row => row.memberId === session.user.id) + 1,
      points: total?.total || 0,
      best: Math.max(...points),
      average: Math.round((points.reduce((sum, value) => sum + value, 0) / points.length) * 10) / 10,
      rounds: rows.length,
      handicap: rows[rows.length - 1]?.next_handicap ?? "N/A",
      wins: rows.filter(row => row.winner).length,
      topThreeFinishes: rows.filter(row => row.winner || row.runner_up || row.third_place).length,
      trend: points[points.length - 1] - points[0],
      latestScore: points[points.length - 1]
    };
  };

  const loadLegacyStats = async () => {
    try {
      const currentSeason = await get2027Stats();
      if (currentSeason) {
        set("seasonDashboardEyebrow", "Your current season");
        set("seasonDashboardYear", "2027");
        set("dashboardDataSource", "Your live 2027 society results");
        show("legacyMatchPrompt", false);
        showStats(currentSeason, 2027);
        return;
      }
      const { data, error } = await client.functions.invoke("legacy-2026-stats", { body: { action: "suggest" } });
      if (error) throw error;
      if (data?.status === "confirm" && data.candidate?.name) {
        legacyCandidate = data.candidate.name;
        set("legacyMatchQuestion", `Are you ${legacyCandidate}?`);
        set("legacyPlayerName", "Confirm your 2026 player name");
        set("legacyFeedback", "Once confirmed, your previous-season figures will stay here until the first 2027 results are published.");
        show("legacyMatchPrompt");
        document.getElementById("seasonDashboardCard")?.classList.add("is-awaiting-match");
        return;
      }
      if (data?.status === "declined") {
        document.getElementById("seasonDashboardCard")?.classList.remove("is-awaiting-match");
        set("legacyPlayerName", "2026 results not linked");
        set("legacyFeedback", "No problem—your dashboard will begin building from your first 2027 event.");
        return;
      }
      const stats = data?.stats;
      if (!stats) {
        set("legacyPlayerName", "No 2026 score match");
        set("legacyFeedback", feedback(null));
        return;
      }
      show("legacyMatchPrompt", false);
      showStats(stats);
    } catch (error) {
      console.warn("The read-only 2026 season summary could not be loaded.", error);
      set("legacyPlayerName", "2026 data temporarily unavailable");
      set("legacyFeedback", "Your account is working, but the previous-season connection needs another try.");
      document.getElementById("seasonDashboardCard")?.classList.add("is-unavailable");
      show("dashboardRetry2026");
    }
  };

  const answerLegacyMatch = async confirmed => {
    const status = document.getElementById("legacyMatchStatus");
    document.getElementById("legacyMatchYes").disabled = true;
    document.getElementById("legacyMatchNo").disabled = true;
    if (status) status.textContent = "Saving your choice…";
    const { data, error } = await client.functions.invoke("legacy-2026-stats", {
      body: { action: confirmed ? "confirm" : "decline", legacyName: legacyCandidate }
    });
    if (error) {
      if (status) status.textContent = "We couldn’t save that just now. Please try again.";
      document.getElementById("legacyMatchYes").disabled = false;
      document.getElementById("legacyMatchNo").disabled = false;
      return;
    }
    show("legacyMatchPrompt", false);
    document.getElementById("seasonDashboardCard")?.classList.remove("is-awaiting-match");
    if (confirmed && data?.stats) showStats(data.stats);
    else {
      set("legacyPlayerName", "2026 results not linked");
      set("legacyFeedback", "No problem—your dashboard will start building when the first 2027 results are published.");
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

  const teeWindowLabel = value => ({ first: "First", middle: "Middle", end: "End" })[value] || "Middle";

  const saveRsvp = async (status, preferences = {}) => {
    if (!nextEvent) return;
    const statusLine = document.getElementById("dashboardRsvpStatus");
    if (statusLine) statusLine.textContent = "Saving your RSVP…";
    const payload = {
      event_id: nextEvent.id,
      member_id: session.user.id,
      status,
      payment_status: currentRsvp?.payment_status || "payment_due",
      buggy_requested: status === "playing" ? preferences.travel === "buggy" : Boolean(currentRsvp?.buggy_requested),
      preferred_tee_time: status === "playing" ? preferences.teeWindow || "middle" : currentRsvp?.preferred_tee_time || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client.from("rsvps").upsert(payload, { onConflict: "event_id,member_id" }).select().single();
    if (error) {
      if (statusLine) statusLine.textContent = "Your RSVP could not be saved. Please try again.";
      return null;
    }
    currentRsvp = data;
    set("dashboardRsvpBadge", status === "playing" ? "You’re playing" : "Not playing");
    if (statusLine) statusLine.textContent = status === "playing"
      ? `You are on the playing list · ${data.buggy_requested ? "Buggy" : "Walking"} · ${teeWindowLabel(data.preferred_tee_time)} tee-time preference.`
      : "The committee now knows you cannot attend.";
    await loadPayments();
    return data;
  };

  const load = async () => {
    const result = await client.auth.getSession();
    session = result.data.session;
    if (!session) {
      document.documentElement.classList.remove("member-session-cached");
      document.getElementById("publicHome")?.classList.remove("hidden");
      document.getElementById("memberHomeDashboard")?.classList.add("hidden");
      return;
    }
    document.getElementById("publicHome")?.classList.add("hidden");
    document.getElementById("memberHomeDashboard")?.classList.remove("hidden");
    const knownName = session.user.user_metadata?.full_name || "Member";
    set("dashboardFirstName", knownName.split(/\s+/)[0]);
    set("dashboardFullName", knownName);

    const profilePromise = client.from("profiles").select("*").eq("id", session.user.id).single();
    const corePromise = Promise.all([loadNextEvent(), loadPayments()]);
    const [{ data: profile }] = await Promise.all([profilePromise, corePromise]);
    const name = profile?.full_name || knownName;
    set("dashboardFirstName", name.split(/\s+/)[0]);
    set("dashboardFullName", name);
    set("dashboardMembershipStatus", profile?.is_admin ? "2027 member · Administrator" : "2027 member");
    if (profile) setAvatar(profile);

    const loadPreviousSeason = () => loadLegacyStats();
    if ("requestIdleCallback" in window) requestIdleCallback(loadPreviousSeason, { timeout: 1200 });
    else setTimeout(loadPreviousSeason, 100);
  };

  const rsvpDialog = document.getElementById("dashboardRsvpDialog");
  document.querySelector('[data-rsvp="playing"]')?.addEventListener("click", () => {
    const walking = rsvpDialog?.querySelector('[name="travel"][value="walking"]');
    const buggy = rsvpDialog?.querySelector('[name="travel"][value="buggy"]');
    if (walking) walking.checked = !currentRsvp?.buggy_requested;
    if (buggy) buggy.checked = Boolean(currentRsvp?.buggy_requested);
    const savedWindow = ["first", "middle", "end"].includes(currentRsvp?.preferred_tee_time)
      ? currentRsvp.preferred_tee_time
      : "middle";
    const preferred = rsvpDialog?.querySelector(`[name="teeWindow"][value="${savedWindow}"]`);
    if (preferred) preferred.checked = true;
    rsvpDialog?.showModal();
  });
  document.querySelector('[data-rsvp="not_playing"]')?.addEventListener("click", () => saveRsvp("not_playing"));
  document.getElementById("dashboardRsvpClose")?.addEventListener("click", () => rsvpDialog?.close());
  document.getElementById("dashboardRsvpCancel")?.addEventListener("click", () => rsvpDialog?.close());
  document.getElementById("dashboardRsvpForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "Saving…";
    const formData = new FormData(event.currentTarget);
    const travel = formData.get("travel");
    const teeWindow = formData.get("teeWindow");
    const saved = await saveRsvp("playing", { travel, teeWindow });
    submit.disabled = false;
    submit.textContent = "Confirm I’m playing";
    if (saved) rsvpDialog?.close();
  });
  document.getElementById("legacyMatchYes")?.addEventListener("click", () => answerLegacyMatch(true));
  document.getElementById("legacyMatchNo")?.addEventListener("click", () => answerLegacyMatch(false));
  document.getElementById("dashboardRetry2026")?.addEventListener("click", event => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "Loading…";
    loadLegacyStats().finally(() => {
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "Try loading again";
    });
  });
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
  if (localStorage.getItem("barford-passkey-offered") === "complete") show("dashboardPasskeyCard", false);
  load();
})();
