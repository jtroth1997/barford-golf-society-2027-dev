(() => {
  const mobileQuery = window.matchMedia("(max-width: 850px)");
  const currentPage = location.pathname.split("/").pop() || "index.html";

  if (currentPage === "gallery.html") {
    document.title = "Photos | Barford Golf Society";
    const heading = document.querySelector(".page-hero h1");
    if (heading) heading.textContent = "Photos";
    document.querySelectorAll("h2").forEach(title => {
      if (title.textContent.trim() === "Society gallery") title.textContent = "Society photos";
      if (title.textContent.trim() === "Upload your golf photos") title.textContent = "Add your golf photos";
    });
    const upload = document.querySelector(".upload-card button");
    if (upload) upload.textContent = "Choose photos";
  }
  if (currentPage === "worldevents.html") {
    document.title = "Society Trips | Barford Golf Society";
    const heading = document.querySelector(".page-hero h1");
    if (heading) heading.textContent = "Society trips";
    const featured = [...document.querySelectorAll("h2")].find(title => title.textContent.trim() === "Featured trip ideas");
    if (featured) featured.textContent = "Future society trips";
  }
  if (currentPage === "events.html") {
    const preview = document.querySelector(".events-toolbar .muted");
    if (preview) preview.textContent = "The 2027 calendar is ready for the committee to add the first event.";
  }
  if (currentPage === "index.html") {
    document.querySelectorAll('a[href="events.html"]').forEach(link => {
      if (link.textContent.trim() === "RSVP to next event") link.textContent = "Book my place";
      if (link.textContent.trim() === "RSVP now") link.textContent = "View event";
    });
  }

  document.querySelectorAll(".menu-button").forEach(button => {
    if (button.querySelector(".menu-button-label")) return;
    const bars = document.createElement("span");
    bars.className = "menu-button-lines";
    [...button.children].filter(child => !child.classList.contains("sr-only")).forEach(child => bars.appendChild(child));
    const label = document.createElement("span");
    label.className = "menu-button-label";
    label.textContent = "Menu";
    button.append(bars, label);
    button.setAttribute("aria-label", "Open website menu");
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      label.textContent = open ? "Close" : "Menu";
      button.setAttribute("aria-label", open ? "Close website menu" : "Open website menu");
    });
  });

  document.querySelectorAll('a[href="gallery.html"]').forEach(link => {
    if (link.textContent.trim() === "Gallery" || link.textContent.includes("Member gallery")) link.textContent = "Photos";
  });
  document.querySelectorAll('a[href="worldevents.html"]').forEach(link => {
    if (link.textContent.trim() === "World Events") link.textContent = "Society Trips";
  });

  const quickNav = document.querySelector(".mobile-quick-nav");
  if (quickNav) {
    const items = [
      ["index.html", "⌂", "Home"],
      ["events.html", "◷", "Events"],
      ["scores.html", "★", "Scores"],
      ["account.html", "●", "My Account"]
    ];
    const current = currentPage;
    quickNav.innerHTML = items.map(([href, icon, label]) =>
      `<a href="${href}" class="${current === href ? "active" : ""}"${current === href ? ' aria-current="page"' : ""}><span class="quick-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`
    ).join("");
  }

  document.querySelectorAll(".rsvp-event-button").forEach(button => {
    if (button.textContent.trim() === "RSVP") button.textContent = "Book my place";
  });
  document.querySelectorAll(".event-button-row button").forEach(button => {
    if (button.textContent.trim() === "Course video") button.textContent = "Watch course video";
    if (button.textContent.trim() === "More details") button.textContent = "View event details";
  });
  document.querySelectorAll(".payment-status.due").forEach(status => {
    status.textContent = "Payment required";
  });

  document.querySelectorAll(".event-rsvp-section").forEach(section => {
    const list = section.querySelector(".public-rsvp-list");
    if (!list || list.children.length <= 5) return;
    const button = document.createElement("button");
    button.className = "button button-outline players-toggle";
    button.type = "button";
    const total = list.children.length;
    button.textContent = `View all ${total} players`;
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const open = list.classList.toggle("is-expanded");
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Show fewer players" : `View all ${total} players`;
    });
    section.appendChild(button);
  });

  const accountLayout = document.querySelector(".account-layout");
  if (accountLayout) {
    const main = accountLayout.querySelector(".account-main");
    const side = accountLayout.querySelector(".account-side");
    const panels = main ? [...main.querySelectorAll(":scope > .account-panel")] : [];
    const profile = side?.querySelector(".profile-panel");
    const membership = side?.querySelector(".account-membership");
    const groups = {
      overview: [main?.querySelector(".account-section-heading"), main?.querySelector(".account-stat-grid")],
      performance: panels,
      profile: [profile],
      membership: [membership, side?.querySelector(".account-panel:last-child")]
    };
    Object.values(groups).flat().filter(Boolean).forEach(el => el.classList.add("account-mobile-section"));
    const tabs = document.createElement("div");
    tabs.className = "account-mobile-tabs mobile-only";
    [["overview","Overview"],["performance","My scores"],["profile","My details"],["membership","Membership"]].forEach(([key,text], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `button ${index ? "button-outline" : "button-primary"}`;
      button.textContent = text;
      button.addEventListener("click", () => {
        Object.entries(groups).forEach(([group,elements]) => elements.filter(Boolean).forEach(el => {
          el.hidden = mobileQuery.matches && group !== key;
        }));
        tabs.querySelectorAll("button").forEach(tab => {
          const active = tab === button;
          tab.className = `button ${active ? "button-primary" : "button-outline"}`;
          tab.setAttribute("aria-pressed", String(active));
        });
      });
      button.setAttribute("aria-pressed", String(index === 0));
      tabs.appendChild(button);
    });
    accountLayout.prepend(tabs);
    if (mobileQuery.matches) Object.entries(groups).forEach(([key,elements]) => elements.filter(Boolean).forEach(el => { el.hidden = key !== "overview"; }));
  }

  const message = document.createElement("div");
  message.className = "site-message";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  document.body.appendChild(message);
  window.showSiteMessage = text => {
    message.textContent = text;
    message.classList.add("show");
    clearTimeout(window.siteMessageTimer);
    window.siteMessageTimer = setTimeout(() => message.classList.remove("show"), 2600);
  };
})();
