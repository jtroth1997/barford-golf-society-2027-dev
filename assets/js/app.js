

const body = document.body;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const register = () => navigator.serviceWorker.register("./sw.js?v=speed2").catch(() => {});
    if ("requestIdleCallback" in window) requestIdleCallback(register, { timeout: 2000 });
    else setTimeout(register, 250);
  }, { once: true });
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

const warmedPages = new Set();
const warmPage = link => {
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || warmedPages.has(url.href)) return;
  warmedPages.add(url.href);
  fetch(url.href, { credentials: "same-origin", priority: "low" }).catch(() => {});
};
document.addEventListener("pointerover", event => {
  const link = event.target.closest("a[href]");
  if (link) warmPage(link);
}, { passive: true });
document.addEventListener("touchstart", event => {
  const link = event.target.closest("a[href]");
  if (link) warmPage(link);
}, { passive: true });


// Enlarge profile photos consistently anywhere they appear.
document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.createElement("dialog");
  dialog.className = "profile-photo-lightbox";
  dialog.setAttribute("aria-label", "Profile photo");
  dialog.innerHTML = '<form method="dialog"><button class="profile-photo-lightbox-close" value="cancel" aria-label="Close profile photo">×</button><img alt="Enlarged profile photo"><a class="button button-primary profile-photo-change hidden" href="account.html#profile-photo">Change profile picture</a><button class="button button-outline" value="cancel">Close</button></form>';
  document.body.append(dialog);
  const openPhoto = element => {
    const source = element?.dataset?.profilePhoto || element?.querySelector?.("img")?.src;
    if (!source) { window.location.href = "account.html#profile-photo"; return; }
    dialog.querySelector("img").src = source;
    dialog.querySelector(".profile-photo-change")?.classList.toggle("hidden", element.dataset.profileOwner !== "self");
    dialog.showModal();
  };
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-profile-photo], [data-profile-owner=\"self\"]");
    if (target) openPhoto(target);
  });
  document.addEventListener("profile-photo:open", event => openPhoto(event.target));
  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-profile-photo], [data-profile-owner=\"self\"]")) {
      event.preventDefault();
      openPhoto(event.target);
    }
  });
});
