(() => {
  "use strict";

  // The event card already contains the useful event information. Remove the duplicate
  // top-level directions control entirely so it cannot reappear on event day.
  document.getElementById("dashboardEventDirections")?.remove();

  // Keep the scorecard action with the tee-group/event information rather than beside
  // the event title at the top of the card.
  const scoreLink = document.querySelector(".event-scorecard-cta");
  const teeActions = document.querySelector("#dashboardTeeGroup .tee-group-actions");
  if (scoreLink && teeActions && scoreLink.parentElement !== teeActions) {
    scoreLink.classList.add("button", "button-primary");
    scoreLink.querySelector("span")?.remove();
    const label = scoreLink.querySelector("strong");
    if (label) label.textContent = "Open today’s scorecard";
    teeActions.prepend(scoreLink);
  }

  // Load the scorer workflow once. This replaces the old mutation-observer loop that
  // could repeatedly re-render the dashboard and make the page jump uncontrollably.
  if (!document.querySelector('script[data-dashboard-scorer-selection]')) {
    const script = document.createElement("script");
    script.src = "assets/js/dashboard-scorer-selection.js?v=stable2";
    script.defer = true;
    script.dataset.dashboardScorerSelection = "1";
    document.head.appendChild(script);
  }
})();