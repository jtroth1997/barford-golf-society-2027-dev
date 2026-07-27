(() => {
  "use strict";
  const panel = document.querySelector("#eventCountdown");
  if (!panel) return;

  const date = panel.dataset.eventDate;
  const teeTime = panel.dataset.teeTime || "09:00";
  const eventStart = new Date(date + "T" + teeTime + ":00");
  const eventDayStart = new Date(date + "T00:00:00");
  const eventDayEnd = new Date(date + "T23:59:59");
  const days = document.querySelector("#countdownDays");
  const hours = document.querySelector("#countdownHours");
  const minutes = document.querySelector("#countdownMinutes");
  const eyebrow = document.querySelector("#countdownEyebrow");
  const headline = document.querySelector("#countdownHeadline");

  const update = () => {
    const now = new Date();
    if (now >= eventDayStart && now <= eventDayEnd) {
      panel.classList.add("is-today");
      eyebrow.textContent = "Event day";
      if (now < eventStart) {
        const totalMinutes = Math.max(0, Math.ceil((eventStart - now) / 60000));
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        headline.textContent = h ? `Tee time in ${h}h ${m}m` : `Tee time in ${m} minutes`;
      } else {
        headline.textContent = "Event day is here — enjoy your round!";
      }
      return;
    }

    panel.classList.remove("is-today");
    const remaining = eventStart - now;
    if (remaining <= 0) {
      eyebrow.textContent = "Latest event";
      headline.textContent = "Event completed";
      days.textContent = "0"; hours.textContent = "0"; minutes.textContent = "0";
      return;
    }

    const totalMinutes = Math.floor(remaining / 60000);
    const d = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    const m = totalMinutes % 60;
    days.textContent = String(d);
    hours.textContent = String(h).padStart(2, "0");
    minutes.textContent = String(m).padStart(2, "0");
    headline.textContent = d === 1 ? "Tomorrow — get ready!" : d < 7 ? "Not long to go!" : "Your next society day";
  };

  update();
  window.setInterval(update, 30000);
})();