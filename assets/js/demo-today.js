(() => {
  "use strict";

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  const displayDate = new Date(`${today}T12:00:00`);
  const month = new Intl.DateTimeFormat("en-GB", {month: "short"}).format(displayDate).toUpperCase();
  const longDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(displayDate);

  document.body.classList.add("demo-event-today");

  if (document.getElementById("memberHomeDashboard")) {
    try {
      const accountKey = "bgs-2027-member-account";
      if (!localStorage.getItem(accountKey)) {
        localStorage.setItem(accountKey, JSON.stringify({
          name: "Jack Troth",
          email: "jack@example.com",
          phone: "07123 456789",
          handicap: "18.4",
          preference: "walker",
          photo: ""
        }));
      }
      localStorage.setItem("bgs-2027-member-persistent-session", "yes");
    } catch (_) {
      // The visible demo still works if private browsing blocks local storage.
    }
  }

  ["eventCountdown", "eventDayCameraTab", "eventWeather"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.dataset.eventDate = today;
  });

  const dashboardDate = document.querySelector(".dashboard-date");
  if (dashboardDate) {
    const monthLabel = dashboardDate.querySelector("span");
    const dayLabel = dashboardDate.querySelector("strong");
    const yearLabel = dashboardDate.querySelector("small");
    if (monthLabel) monthLabel.textContent = month;
    if (dayLabel) dayLabel.textContent = String(Number(values.day));
    if (yearLabel) yearLabel.textContent = values.year;
  }

  const dashboardEyebrow = document.querySelector(".dashboard-event-title .eyebrow");
  if (dashboardEyebrow) dashboardEyebrow.textContent = "Today’s event";

  const firstEvent = document.querySelector("#eventList .compact-event-card");
  if (firstEvent) {
    const dateBlock = firstEvent.querySelector(".event-date-block");
    if (dateBlock) {
      const monthLabel = dateBlock.querySelector("span");
      const dayLabel = dateBlock.querySelector("strong");
      const yearLabel = dateBlock.querySelector("small");
      if (monthLabel) monthLabel.textContent = month;
      if (dayLabel) dayLabel.textContent = String(Number(values.day));
      if (yearLabel) yearLabel.textContent = values.year;
    }
    const description = firstEvent.querySelector(".event-description");
    if (description) description.textContent = `${longDate} · Event today · 18 holes`;
    const headingActions = firstEvent.querySelector(".event-heading-actions");
    if (headingActions && !headingActions.querySelector(".event-today-pill")) {
      const badge = document.createElement("span");
      badge.className = "event-today-pill";
      badge.textContent = "Today";
      headingActions.prepend(badge);
    }
    firstEvent.classList.add("event-is-today");
  }
})();
