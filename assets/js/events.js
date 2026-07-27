
(() => {
  "use strict";

  const STORAGE_KEY = "bgs-2027-events-demo-v2";

  const seed = {
    events: [
      {
        id: "event-1",
        name: "Season Opener",
        date: "2027-03-26",
        venue: "Venue to be confirmed",
        description: "Friday · 18 holes · coffee and bacon roll",
        price: "£TBC",
        places: 24,
        teeTimes: "TBC",
        rsvps: [
          { id:"r1", name:"David Smith", email:"david@example.com", phone:"07111 111111", buggy:"No", teeTime:"Early", paid:true },
          { id:"r2", name:"Steve Jones", email:"steve@example.com", phone:"07222 222222", buggy:"Yes", teeTime:"Middle", paid:false },
          { id:"r3", name:"Mark Taylor", email:"mark@example.com", phone:"07333 333333", buggy:"No", teeTime:"No preference", paid:true },
          { id:"r4", name:"Chris Brown", email:"chris@example.com", phone:"07444 444444", buggy:"No", teeTime:"Late", paid:false }
        ]
      },
      {
        id: "event-2",
        name: "Monthly Event",
        date: "2027-04-30",
        venue: "Venue to be confirmed",
        description: "Friday · 18 holes · friendly competition",
        price: "£TBC",
        places: 24,
        teeTimes: "TBC",
        rsvps: [
          { id:"r5", name:"Paul Roberts", email:"paul@example.com", phone:"07555 555555", buggy:"No", teeTime:"Early", paid:true },
          { id:"r6", name:"Andy Green", email:"andy@example.com", phone:"07666 666666", buggy:"Yes", teeTime:"Middle", paid:false }
        ]
      }
    ]
  };

  const clone = value => JSON.parse(JSON.stringify(value));

  const readData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return clone(seed);
      }
      return JSON.parse(saved);
    } catch {
      return clone(seed);
    }
  };

  const writeData = data => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  let data = readData();

  const formatDate = value => {
    const date = new Date(`${value}T12:00:00`);
    return {
      day: String(date.getDate()).padStart(2, "0"),
      month: date.toLocaleDateString("en-GB", { month:"short" }).toUpperCase(),
      long: date.toLocaleDateString("en-GB", {
        weekday:"long", day:"numeric", month:"long", year:"numeric"
      })
    };
  };

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[char]);

  const paymentBadge = paid =>
    `<span class="payment-status ${paid ? "paid" : "due"}">${paid ? "Paid" : "Payment Due"}</span>`;

  const renderEvents = () => {
    const list = document.querySelector("#eventList");
    list.innerHTML = data.events.map(event => {
      const date = formatDate(event.date);
      return `
        <article class="event-card-enhanced">
          <div class="date-badge">
            <span>${date.month}</span>
            <strong>${date.day}</strong>
          </div>

          <div>
            <p class="event-label">${escapeHtml(event.name)}</p>
            <h3>${escapeHtml(event.venue)}</h3>
            <p>${escapeHtml(event.description)}</p>
            <div class="chip-row">
              <span class="chip">${escapeHtml(event.price)}</span>
              <span class="chip">${event.places} places</span>
              <span class="chip">Tee times ${escapeHtml(event.teeTimes)}</span>
            </div>
          </div>

          <div class="event-actions">
            <button class="button button-small rsvp-event-button" type="button" data-event-id="${event.id}">RSVP</button>
            <button class="button button-outline show-rsvps-button" type="button" data-event-id="${event.id}">Who's playing</button>
          </div>

          <div class="event-rsvp-section hidden" id="public-rsvps-${event.id}">
            <h4>Who's playing</h4>
            <div class="public-rsvp-list">
              ${event.rsvps.map(rsvp => `
                <div class="public-rsvp-row">
                  <strong>${escapeHtml(rsvp.name)}</strong>
                  ${paymentBadge(rsvp.paid)}
                </div>
              `).join("") || `<p class="muted">No RSVPs yet.</p>`}
            </div>
          </div>
        </article>
      `;
    }).join("");

    bindPublicButtons();
  };

  const bindPublicButtons = () => {
    document.querySelectorAll(".rsvp-event-button").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelector("#rsvpEvent").value = button.dataset.eventId;
        document.querySelector("#rsvp").scrollIntoView({ behavior:"smooth", block:"start" });
      });
    });

    document.querySelectorAll(".show-rsvps-button").forEach(button => {
      button.addEventListener("click", () => {
        const panel = document.querySelector(`#public-rsvps-${button.dataset.eventId}`);
        const hidden = panel.classList.toggle("hidden");
        button.textContent = hidden ? "Who's playing" : "Hide players";
      });
    });
  };

  const renderEventOptions = () => {
    const options = data.events.map(event =>
      `<option value="${event.id}">${escapeHtml(event.name)} — ${escapeHtml(formatDate(event.date).long)}</option>`
    ).join("");

    document.querySelector("#rsvpEvent").innerHTML = options;
    document.querySelector("#adminEventSelect").innerHTML = options;
  };

  const renderAdminRsvps = () => {
    const eventId = document.querySelector("#adminEventSelect").value;
    const event = data.events.find(item => item.id === eventId);
    const list = document.querySelector("#adminRsvpList");

    if (!event) {
      list.innerHTML = `<p class="muted">Choose an event.</p>`;
      return;
    }

    list.innerHTML = event.rsvps.map(rsvp => `
      <div class="admin-rsvp-row">
        <div>
          <strong>${escapeHtml(rsvp.name)}</strong>
          <div class="muted">${escapeHtml(rsvp.buggy)} buggy · ${escapeHtml(rsvp.teeTime)}</div>
        </div>

        <label class="payment-toggle">
          <input type="checkbox" data-rsvp-id="${rsvp.id}" ${rsvp.paid ? "checked" : ""}>
          <span class="toggle-track" aria-hidden="true"></span>
          <span class="payment-toggle-text">${rsvp.paid ? "Paid" : "Payment Due"}</span>
        </label>
      </div>
    `).join("") || `<p class="muted">No RSVPs for this event.</p>`;

    list.querySelectorAll("input[type='checkbox']").forEach(toggle => {
      toggle.addEventListener("change", () => {
        const rsvp = event.rsvps.find(item => item.id === toggle.dataset.rsvpId);
        if (!rsvp) return;

        rsvp.paid = toggle.checked;
        writeData(data);

        toggle.parentElement.querySelector(".payment-toggle-text").textContent =
          rsvp.paid ? "Paid" : "Payment Due";

        renderEvents();
      });
    });
  };

  const fillMemberProfile = () => {
    try {
      const profile = JSON.parse(localStorage.getItem("bgs-2027-member-profile") || "null");
      if (!profile) return;

      document.querySelector("#rsvpName").value = profile.name || "";
      document.querySelector("#rsvpEmail").value = profile.email || "";
      document.querySelector("#rsvpPhone").value = profile.phone || "";
    } catch {}
  };

  document.querySelector("#rsvpForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const eventId = document.querySelector("#rsvpEvent").value;
    const selectedEvent = data.events.find(item => item.id === eventId);
    if (!selectedEvent) return;

    const name = document.querySelector("#rsvpName").value.trim();

    const existing = selectedEvent.rsvps.find(item =>
      item.name.toLowerCase() === name.toLowerCase()
    );

    const record = {
      id: existing?.id || crypto.randomUUID(),
      name,
      email: document.querySelector("#rsvpEmail").value.trim(),
      phone: document.querySelector("#rsvpPhone").value.trim(),
      buggy: document.querySelector("#rsvpBuggy").value,
      teeTime: document.querySelector("#rsvpTeeTime").value,
      paid: existing?.paid ?? false
    };

    if (existing) Object.assign(existing, record);
    else selectedEvent.rsvps.push(record);

    writeData(data);
    document.querySelector("#rsvpStatus").textContent =
      "RSVP saved. Payment status is currently Payment Due.";

    renderEvents();
    renderAdminRsvps();
  });

  document.querySelector("#adminEventSelect")?.addEventListener("change", renderAdminRsvps);

  renderEventOptions();
  fillMemberProfile();
  renderEvents();
  renderAdminRsvps();
})();
