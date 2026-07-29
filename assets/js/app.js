

const body = document.body;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js?v=mobile3").catch(() => {});
  }, { once:true });
}
document.querySelectorAll(".menu-button").forEach(menuButton => {
  const navigationId = menuButton.getAttribute("aria-controls");
  const navigation = navigationId ? document.getElementById(navigationId) : menuButton.closest(".site-header")?.querySelector(".site-nav");
  if (!navigation) return;
  const closeMenu = () => {
    navigation.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    body.classList.remove("mobile-menu-open");
  };
  menuButton.addEventListener("click", event => {
    event.stopPropagation();
    const open = navigation.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
    body.classList.toggle("mobile-menu-open", open);
  });
  navigation.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
  document.addEventListener("click", event => { if (!navigation.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { closeMenu(); menuButton.focus(); } });
});

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

document.querySelectorAll(".admin-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const panel = document.getElementById(btn.dataset.target);
    if (!panel) return;
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) panel.scrollIntoView({ behavior:"smooth", block:"start" });
  });
});

document.querySelectorAll(".demo-form").forEach(form => {
  form.addEventListener("submit", event => {
    event.preventDefault();
    const status = form.querySelector(".form-status");
    if (status) status.textContent = "Demo only — nothing has been sent or saved.";
  });
});

document.querySelectorAll(".demo-action").forEach(btn => {
  btn.addEventListener("click", () => {
    const message = "This is a preview. Nothing has been submitted.";
    if (window.showSiteMessage) window.showSiteMessage(message); else alert(message);
  });
});

const installBtn = document.querySelector("#installHelpBtn");
const installHelp = document.querySelector("#installHelp");
if (installBtn && installHelp) installBtn.addEventListener("click", () => {
  installHelp.classList.toggle("hidden");
  installBtn.textContent = installHelp.classList.contains("hidden") ? "Show instructions" : "Hide instructions";
});

let basketCount = 0;
let basketTotal = 0;
const prices = [12,18,15];
document.querySelectorAll(".add-to-basket").forEach((btn,index) => {
  btn.addEventListener("click", () => {
    basketCount += 1; basketTotal += prices[index] || 0;
    const count = document.querySelector("#basketCount");
    const summary = document.querySelector("#basketSummary");
    const total = document.querySelector("#basketTotal");
    if (count) count.textContent = String(basketCount);
    if (summary) summary.textContent = `${basketCount} item${basketCount===1?"":"s"} in your demo basket.`;
    if (total) total.textContent = `£${basketTotal.toFixed(2)}`;
    btn.textContent = "Added ✓";
    setTimeout(() => btn.textContent = "Add to basket", 1200);
  });
});
const basketBtn = document.querySelector("#basketBtn");
const basketPanel = document.querySelector("#basketPanel");
if (basketBtn && basketPanel) basketBtn.addEventListener("click", () => {
  basketPanel.classList.toggle("hidden");
  if (!basketPanel.classList.contains("hidden")) basketPanel.scrollIntoView({behavior:"smooth",block:"start"});
});

const eventCards = document.querySelectorAll(".compact-event-card");
if (eventCards.length) {
  const videoSearches = ["The Belfry Derby Course", "Forest of Arden golf course", "The Warwickshire golf course"];
  let selectedEventButton = null;
  const dialog = document.createElement("dialog");
  dialog.style.cssText = "width:min(92vw,500px);border:0;border-radius:20px;padding:0;box-shadow:0 24px 70px rgba(0,0,0,.3)";
  dialog.innerHTML = `<form method="dialog" style="display:grid;gap:12px;padding:24px"><div style="display:flex;justify-content:space-between;gap:12px"><div><p class="eyebrow">Reserve your place</p><h2 id="quickRsvpTitle">Event RSVP</h2></div><button type="button" id="quickRsvpClose" aria-label="Close" style="border:0;background:none;font-size:2rem">×</button></div><input name="name" autocomplete="name" placeholder="Your full name" required style="min-height:48px;padding:10px;border:1px solid #ccd8d2;border-radius:10px;font:inherit"><input name="phone" autocomplete="tel" placeholder="Mobile number" required style="min-height:48px;padding:10px;border:1px solid #ccd8d2;border-radius:10px;font:inherit"><select name="playing" style="min-height:48px;padding:10px;border:1px solid #ccd8d2;border-radius:10px;font:inherit"><option>Walking</option><option>Buggy required</option><option>Happy to share a buggy</option></select><p class="muted">Preview only — saved on this device until the live database is connected.</p><p id="quickRsvpStatus" role="status"></p><button class="button" type="submit">Save RSVP</button></form>`;
  body.appendChild(dialog);
  const closeDialog = () => dialog.close();
  dialog.querySelector("#quickRsvpClose").addEventListener("click", closeDialog);
  dialog.querySelector("form").addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.event = dialog.querySelector("#quickRsvpTitle").textContent;
    try { localStorage.setItem("bgs-2027-preview-rsvp", JSON.stringify(data)); } catch (_) {}
    dialog.querySelector("#quickRsvpStatus").textContent = "RSVP saved on this device ✓";
    if (selectedEventButton) selectedEventButton.textContent = "RSVP saved ✓";
    setTimeout(closeDialog, 800);
  });
  eventCards.forEach((card,index) => {
    const eventName = card.querySelector("h3")?.textContent || "Event RSVP";
    card.querySelector(".rsvp-event-button")?.addEventListener("click", event => {
      selectedEventButton = event.currentTarget;
      dialog.querySelector("#quickRsvpTitle").textContent = eventName;
      dialog.querySelector("#quickRsvpStatus").textContent = "";
      dialog.showModal();
    });
    const buttons = [...card.querySelectorAll(".event-button-row button")];
    buttons[0]?.addEventListener("click", () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(videoSearches[index] || eventName)}`, "_blank", "noopener"));
    buttons[1]?.addEventListener("click", event => {
      let details = card.querySelector(".quick-event-details");
      if (!details) {
        details = document.createElement("div");
        details.className = "quick-event-details";
        details.style.cssText = "margin-top:12px;padding:14px;border-radius:12px;background:#f2f7f4";
        const summary = card.querySelector(".event-summary-row")?.textContent.trim() || "";
        const description = card.querySelector(".event-description")?.textContent || "";
        details.textContent = `${description} · ${summary}`;
        event.currentTarget.closest(".event-button-row").after(details);
      } else details.hidden = !details.hidden;
      const open = !details.hidden;
      event.currentTarget.textContent = open ? "Hide details" : "More details";
      event.currentTarget.setAttribute("aria-expanded", String(open));
    });
  });
}

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const mobileNav = document.createElement("nav");
mobileNav.className = "mobile-quick-nav";
mobileNav.setAttribute("aria-label","Quick navigation");
mobileNav.innerHTML = `
  <a href="index.html" class="${currentPage==="index.html"?"active":""}">⌂<span>Home</span></a>
  <a href="events.html" class="${currentPage==="events.html"?"active":""}">◷<span>Events</span></a>
  <a href="scores.html" class="${currentPage==="scores.html"?"active":""}">★<span>Scores</span></a>
  <a href="account.html" class="${currentPage==="account.html"?"active":""}">●<span>My Account</span></a>
`;
body.appendChild(mobileNav);
