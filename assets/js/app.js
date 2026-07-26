
const body = document.body;
const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector("#primary-navigation");
if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const open = navigation.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  navigation.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    navigation.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  }));
}

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
  btn.addEventListener("click", () => alert("Demo only — this action is not connected to live data."));
});

const installBtn = document.querySelector("#installHelpBtn");
const installHelp = document.querySelector("#installHelp");
if (installBtn && installHelp) {
  installBtn.addEventListener("click", () => {
    installHelp.classList.toggle("hidden");
    installBtn.textContent = installHelp.classList.contains("hidden") ? "Show instructions" : "Hide instructions";
  });
}

let basketCount = 0;
let basketTotal = 0;
const prices = [12,18,15];
document.querySelectorAll(".add-to-basket").forEach((btn,index) => {
  btn.addEventListener("click", () => {
    basketCount += 1;
    basketTotal += prices[index] || 0;
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

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reducedMotion) {
  const revealTargets = document.querySelectorAll(".section-heading,.event-card,.event-list-card,.feature-card,.install-panel,.cta-panel,.form-card,.upload-card,.table-wrap,.story-grid,.signup-grid,.chart-placeholder,.media-card,.product-card");
  revealTargets.forEach(el => el.classList.add("reveal"));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:.12});
  revealTargets.forEach(el => observer.observe(el));
}

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const mobileNav = document.createElement("nav");
mobileNav.className = "mobile-quick-nav";
mobileNav.setAttribute("aria-label","Quick navigation");
mobileNav.innerHTML = `
  <a href="index.html" class="${currentPage==="index.html"?"active":""}">⌂<span>Home</span></a>
  <a href="events.html" class="${currentPage==="events.html"?"active":""}">◷<span>Events</span></a>
  <a href="scores.html" class="${currentPage==="scores.html"?"active":""}">★<span>Scores</span></a>
  <a href="gallery.html" class="${currentPage==="gallery.html"?"active":""}">▦<span>Gallery</span></a>
`;
body.appendChild(mobileNav);

// Cinematic home-page intro using the official Barford logo.
const isHome = currentPage === "index.html";
if (false && isHome && !reducedMotion && !sessionStorage.getItem("bgsElegantIntroPlayed")) {
  const intro = document.createElement("div");
  intro.className = "site-intro";
  intro.setAttribute("aria-hidden","true");
  intro.innerHTML = `
    <div class="intro-stage">
      <div class="intro-brand">
        <img src="assets/images/barford-golf-society-logo.png" alt="">
        <p>Relax. Play. Enjoy.</p>
      </div>
      <div class="intro-fairway"></div>
      <div class="intro-green"></div>
      <div class="intro-ball"></div>
      <div class="intro-shadow"></div>
      <div class="intro-cup"></div>
      <div class="intro-flag"></div>
    </div>
    <div class="intro-dark"></div>
  `;
  body.appendChild(intro);
  body.style.overflow = "hidden";

  setTimeout(() => intro.classList.add("is-rolling"), 1050);
  setTimeout(() => intro.classList.add("is-zooming"), 4300);
  setTimeout(() => intro.classList.add("is-darkening"), 5050);
  setTimeout(() => {
    intro.classList.add("is-hidden");
    body.style.overflow = "";
    sessionStorage.setItem("bgsElegantIntroPlayed","true");
  }, 5750);
}

// Premium cinematic intro video.
if (isHome && !reducedMotion && !sessionStorage.getItem("bgsPremiumIntroPlayed")) {
  const overlay = document.createElement("div");
  overlay.className = "premium-video-intro";
  overlay.innerHTML = `
    <video autoplay muted playsinline preload="auto" aria-label="Barford Golf Society opening animation">
      <source src="assets/video/intro.mp4" type="video/mp4">
    </video>
    <button class="premium-intro-skip" type="button">Skip intro</button>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const video = overlay.querySelector("video");
  const skip = overlay.querySelector("button");

  const finish = () => {
    overlay.classList.add("is-hidden");
    document.body.style.overflow = "";
    sessionStorage.setItem("bgsPremiumIntroPlayed","true");
    setTimeout(() => overlay.remove(), 900);
  };

  video.addEventListener("ended", finish, { once:true });
  video.addEventListener("error", finish, { once:true });
  skip.addEventListener("click", finish, { once:true });

  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(finish);
  }
}
