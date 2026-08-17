(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client || !document.getElementById("memberHomeDashboard")) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  const injectUpdates = notices => {
    if (!notices?.length || document.querySelector(".member-updates-button")) return;
    const welcome = document.querySelector(".mobile-dashboard-welcome");
    const avatar = document.getElementById("dashboardHeroAvatar");
    if (!welcome || !avatar) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "member-updates-button";
    button.setAttribute("aria-label", `${notices.length} account update${notices.length===1?"":"s"}`);
    button.innerHTML = `<span aria-hidden="true">Updates</span><b class="member-updates-count">${notices.length}</b>`;
    avatar.before(button);

    const dialog = document.createElement("dialog");
    dialog.className = "member-updates-dialog";
    dialog.innerHTML = `<div class="member-updates-inner"><p class="eyebrow">Useful updates</p><h2>What needs your attention</h2><div class="member-update-list">${notices.slice(0,4).map(item => `<a class="member-update-item priority-${Number(item.priority)||1}" href="${esc(item.action_url || "index.html")}"><strong>${esc(item.title)}</strong><small>${esc(item.body)}</small></a>`).join("")}</div><form method="dialog"><button class="button button-primary full-button">Close</button></form></div>`;
    document.body.appendChild(dialog);
    button.addEventListener("click", () => dialog.showModal());

    const highest = [...notices].sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0))[0];
    if (highest && Number(highest.priority) >= 3) {
      const grid = document.querySelector(".member-home-grid");
      if (grid) {
        const banner = document.createElement("a");
        banner.className = "member-update-item priority-3";
        banner.href = highest.action_url || "events.html";
        banner.innerHTML = `<strong>${esc(highest.title)}</strong><small>${esc(highest.body)}</small>`;
        grid.prepend(banner);
      }
    }
  };

  const enableEventDay = async userId => {
    const today = localDate();
    const { data: events } = await client.from("events").select("id,name,event_date,status").eq("event_date", today).neq("status","cancelled").order("first_tee_time");
    if (!events?.length) return;
    let selected = null, teeTime = null;
    for (const event of events) {
      const { data: rsvp } = await client.from("rsvps").select("status").eq("event_id",event.id).eq("member_id",userId).eq("status","playing").maybeSingle();
      if (!rsvp) continue;
      selected = event;
      const { data: tee } = await client.from("tee_times").select("tee_time").eq("event_id",event.id).eq("member_id",userId).order("tee_time").limit(1).maybeSingle();
      teeTime = tee?.tee_time ? String(tee.tee_time).slice(0,5) : null;
      break;
    }
    if (!selected) return;
    document.body.classList.add("event-day-focus");
    const grid = document.querySelector(".member-home-grid");
    if (!grid || document.querySelector(".event-day-focus-banner")) return;
    const banner = document.createElement("section");
    banner.className = "event-day-focus-banner";
    banner.innerHTML = `<div><strong>TODAY · ${esc(selected.name)}</strong><span>${teeTime ? `Your tee time ${esc(teeTime)}` : "Tee time details are on your event card"}</span></div><div class="event-day-focus-actions"><button id="eventDayDirectionsQuick" class="button button-gold" type="button">Directions</button><a class="button button-primary" href="scoring.html">Scorecard</a></div>`;
    grid.prepend(banner);
    banner.querySelector("#eventDayDirectionsQuick")?.addEventListener("click", () => document.getElementById("dashboardEventDirections")?.click());
    const heading = document.querySelector(".dashboard-welcome-copy h1");
    if (heading) heading.innerHTML = `Today’s golf, <span>${esc(document.getElementById("dashboardFirstName")?.textContent || "member")}</span>`;
  };

  const start = async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    for (let i=0;i<30;i+=1) {
      if (!document.getElementById("memberHomeDashboard")?.classList.contains("hidden")) break;
      await wait(100);
    }
    const work = async () => {
      const [{ data: notices }] = await Promise.all([client.rpc("get_member_notices")]);
      injectUpdates(notices || []);
      await enableEventDay(session.user.id);
    };
    if ("requestIdleCallback" in window) requestIdleCallback(() => work(), { timeout: 1600 }); else setTimeout(work, 350);
  };
  start();
})();
