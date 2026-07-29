

const body = document.body;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith("barford-golf-")).map(key => caches.delete(key)));
      }
    } catch (_) {}
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

const installBtn = document.querySelector("#installHelpBtn");
const installHelp = document.querySelector("#installHelp");
if (installBtn && installHelp) installBtn.addEventListener("click", () => {
  installHelp.classList.toggle("hidden");
  installBtn.textContent = installHelp.classList.contains("hidden") ? "Show instructions" : "Hide instructions";
});

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
