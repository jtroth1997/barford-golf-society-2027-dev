(() => {
  "use strict";

  const client = window.BarfordSupabase;
  const list = document.querySelector("#eventList");
  const summary = document.querySelector("#eventCalendarSummary");
  if (!list) return;

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const friendlyDate = value => new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));

  const dateParts = value => {
    const date = new Date(`${value}T12:00:00`);
    return {
      month: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date).toUpperCase(),
      day: new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(date),
      year: new Intl.DateTimeFormat("en-GB", { year: "numeric" }).format(date)
    };
  };

  const friendlyTime = value => value ? String(value).slice(0, 5) : "To be confirmed";
  const friendlyPrice = value => value == null || value === ""
    ? "Price TBC"
    : Number(value) === 0 ? "Free" : `£${Number(value).toFixed(2)}`;

  const emptyState = (title, message) => {
    list.innerHTML = `
      <article class="empty-state account-panel">
        <p class="eyebrow">No events yet</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
      </article>`;
  };

  const renderEvent = event => {
    const date = dateParts(event.event_date);
    const address = event.address
      ? `<span><b>Address</b>${escapeHtml(event.address)}</span>`
      : "";
    const notes = event.notes
      ? `<p class="event-description">${escapeHtml(event.notes)}</p>`
      : "";
    const video = event.course_video_url
      ? `<a class="button button-outline" href="${escapeHtml(event.course_video_url)}" target="_blank" rel="noopener">Course video</a>`
      : "";

    return `
      <article class="compact-event-card">
        <div class="event-date-block" aria-label="${escapeHtml(friendlyDate(event.event_date))}">
          <span>${date.month}</span><strong>${date.day}</strong><small>${date.year}</small>
        </div>
        <div class="event-main">
          <div class="event-title-row">
            <div class="event-heading-copy">
              <h3>${escapeHtml(event.name)}</h3>
              <p class="event-venue">${escapeHtml(event.venue)}</p>
            </div>
            <span class="event-price">${friendlyPrice(event.price)}</span>
          </div>
          <div class="event-summary-row">
            <span><b>Date:</b> ${escapeHtml(friendlyDate(event.event_date))}</span>
            <span><b>First tee:</b> ${escapeHtml(friendlyTime(event.first_tee_time))}</span>
            <span><b>Places:</b> ${event.capacity ? escapeHtml(event.capacity) : "TBC"}</span>
          </div>
          ${notes}
          <div class="event-button-row">
            <a class="button button-primary rsvp-event-button" href="account.html">RSVP / My Account</a>
            ${video}
            <button class="button button-outline" type="button" data-event-details aria-expanded="false">More details</button>
          </div>
          <div class="event-more-details hidden">
            <div class="detail-grid">
              <span><b>Course</b>${escapeHtml(event.venue)}</span>
              ${address}
              <span><b>Date</b>${escapeHtml(friendlyDate(event.event_date))}</span>
              <span><b>First tee</b>${escapeHtml(friendlyTime(event.first_tee_time))}</span>
            </div>
          </div>
        </div>
      </article>`;
  };

  const loadEvents = async () => {
    if (!client) {
      emptyState("Events could not be loaded", "Please refresh the page and try again.");
      return;
    }

    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const { data, error } = await client
      .from("events")
      .select("id,name,venue,address,event_date,first_tee_time,price,capacity,course_video_url,notes,status")
      .eq("status", "scheduled")
      .gte("event_date", localToday)
      .order("event_date", { ascending: true });

    if (error) {
      emptyState("Events could not be loaded", "Please refresh the page and try again.");
      return;
    }

    const events = data || [];
    if (!events.length) {
      emptyState("The 2027 calendar is empty", "Once an administrator publishes an event, members will be able to see it here.");
      if (summary) summary.textContent = "The committee has not published any upcoming events yet.";
      return;
    }

    list.innerHTML = events.map(renderEvent).join("");
    if (summary) {
      summary.textContent = `${events.length} upcoming event${events.length === 1 ? "" : "s"} published.`;
    }

    list.querySelectorAll("[data-event-details]").forEach(button => {
      button.addEventListener("click", () => {
        const details = button.closest(".event-main")?.querySelector(".event-more-details");
        if (!details) return;
        const willOpen = details.classList.contains("hidden");
        details.classList.toggle("hidden", !willOpen);
        button.setAttribute("aria-expanded", String(willOpen));
        button.textContent = willOpen ? "Hide details" : "More details";
      });
    });
  };

  loadEvents();
})();