
const body = document.body;
const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector("#primary-navigation");
const siteHeader = document.querySelector(".site-header");

const transitionLayer = document.createElement("div");
transitionLayer.className = "page-transition";
transitionLayer.setAttribute("aria-hidden", "true");
body.appendChild(transitionLayer);

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  navigation.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

window.addEventListener("scroll", () => {
  if (siteHeader) siteHeader.classList.toggle("is-scrolled", window.scrollY > 12);
}, { passive: true });

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

document.querySelectorAll(".admin-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const panel = document.getElementById(btn.dataset.target);
    if (!panel) return;
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
    alert("Demo only — this action is not connected to live data.");
  });
});

const installBtn = document.querySelector("#installHelpBtn");
const installHelp = document.querySelector("#installHelp");
if (installBtn && installHelp) {
  installBtn.addEventListener("click", () => {
    installHelp.classList.toggle("hidden");
    installBtn.textContent = installHelp.classList.contains("hidden")
      ? "Show instructions"
      : "Hide instructions";
  });
}

let basketCount = 0;
let basketTotal = 0;
const prices = [12, 18, 15];

document.querySelectorAll(".add-to-basket").forEach((btn, index) => {
  btn.addEventListener("click", () => {
    basketCount += 1;
    basketTotal += prices[index] || 0;
    const count = document.querySelector("#basketCount");
    const summary = document.querySelector("#basketSummary");
    const total = document.querySelector("#basketTotal");

    if (count) count.textContent = String(basketCount);
    if (summary) summary.textContent = `${basketCount} item${basketCount === 1 ? "" : "s"} in your demo basket.`;
    if (total) total.textContent = `£${basketTotal.toFixed(2)}`;

    btn.textContent = "Added ✓";
    setTimeout(() => { btn.textContent = "Add to basket"; }, 1200);
  });
});

const basketBtn = document.querySelector("#basketBtn");
const basketPanel = document.querySelector("#basketPanel");
if (basketBtn && basketPanel) {
  basketBtn.addEventListener("click", () => {
    basketPanel.classList.toggle("hidden");
    if (!basketPanel.classList.contains("hidden")) {
      basketPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

const motionAllowed = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (motionAllowed) {
  const revealTargets = document.querySelectorAll(
    ".section-heading,.event-card,.event-list-card,.install-panel,.cta-panel,.form-card,.upload-card,.table-wrap,.story-grid,.signup-grid,.chart-placeholder,.admin-heading"
  );
  revealTargets.forEach(el => el.classList.add("reveal"));

  const staggerTargets = document.querySelectorAll(
    ".feature-grid,.product-grid,.gallery-grid,.stat-grid,.admin-grid,.cards-list"
  );
  staggerTargets.forEach(el => el.classList.add("reveal-stagger"));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal,.reveal-stagger").forEach(el => observer.observe(el));
}

document.querySelectorAll('a[href$=".html"]').forEach(link => {
  link.addEventListener("click", event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    event.preventDefault();
    body.classList.add("is-leaving");
    setTimeout(() => { window.location.href = href; }, 420);
  });
});

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const mobileNav = document.createElement("nav");
mobileNav.className = "mobile-quick-nav";
mobileNav.setAttribute("aria-label", "Quick navigation");
mobileNav.innerHTML = `
  <a href="index.html" class="${currentPage === "index.html" ? "active" : ""}">⌂<span>Home</span></a>
  <a href="events.html" class="${currentPage === "events.html" ? "active" : ""}">◷<span>Events</span></a>
  <a href="scores.html" class="${currentPage === "scores.html" ? "active" : ""}">★<span>Scores</span></a>
  <a href="gallery.html" class="${currentPage === "gallery.html" ? "active" : ""}">▦<span>Gallery</span></a>
`;
body.appendChild(mobileNav);
