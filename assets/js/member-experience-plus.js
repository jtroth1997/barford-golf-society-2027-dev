(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client || !document.getElementById("memberHomeDashboard")) return;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  };
  const friendlyDate = value => value ? new Intl.DateTimeFormat("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" }).format(new Date(`${value}T12:00:00`)) : "the scheduled date";
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

  const injectActiveTestStrip = async () => {
    const { data: testEvent } = await client.from("events").select("id,name,test_original_event_date").eq("test_mode_active", true).limit(1).maybeSingle();
    if (!testEvent) return null;
    document.body.classList.add("event-test-mode");
    const grid = document.querySelector(".member-home-grid");
    if (grid && !document.querySelector(".test-event-member-strip")) {
      const strip = document.createElement("section");
      strip.className = "test-event-member-strip";
      strip.innerHTML = `<div><strong>TEST EVENT ACTIVE</strong><span>${esc(testEvent.name)} is running as a full live-event simulation. Real date: ${esc(friendlyDate(testEvent.test_original_event_date))}.</span></div><b>Nothing here changes the real event date.</b>`;
      grid.prepend(strip);
    }
    return testEvent;
  };

  const enableEventDay = async userId => {
    const today = localDate();
    const { data: events } = await client.from("events").select("id,name,event_date,status,test_mode_active,test_original_event_date").eq("event_date", today).neq("status","cancelled").order("first_tee_time");
    if (!events?.length) return;
    let selected = null;
    for (const event of events) {
      const { data: rsvp } = await client.from("rsvps").select("status").eq("event_id",event.id).eq("member_id",userId).eq("status","playing").maybeSingle();
      if (!rsvp) continue;
      selected = event;
      break;
    }
    if (!selected) return;
    document.body.classList.add("event-day-focus");
    if (selected.test_mode_active) document.body.classList.add("event-test-mode");
    // Do not add a separate green event-day banner. Directions and scorecard controls
    // already live in the main event information card below, avoiding duplication.
    document.querySelector(".event-day-focus-banner")?.remove();
    const heading = document.querySelector(".dashboard-welcome-copy h1");
    if (heading) heading.innerHTML = selected.test_mode_active
      ? `Test event, <span>${esc(document.getElementById("dashboardFirstName")?.textContent || "member")}</span>`
      : `Today’s golf, <span>${esc(document.getElementById("dashboardFirstName")?.textContent || "member")}</span>`;
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
      await injectActiveTestStrip();
      await enableEventDay(session.user.id);
    };
    if ("requestIdleCallback" in window) requestIdleCallback(() => work(), { timeout: 1600 }); else setTimeout(work, 350);
  };
  start();
})();