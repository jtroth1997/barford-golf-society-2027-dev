
(() => {
  "use strict";

  const STORAGE_KEY = "bgs-2027-events-demo-v3";

  const seed = {
    events: [
      {
        id: "event-1",
        name: "Season Opener",
        date: "2027-03-26",
        venue: "The Belfry – Derby Course",
        description: "Friday society golf · 18 holes",
        price: "£45",
        places: 24,
        teeTimes: "09:00",
        courseVideo: "https://www.youtube.com/results?search_query=The+Belfry+Derby+Course",
        rsvps: [
          { id:"r1", name:"David Smith", paid:true }, { id:"r2", name:"Steve Jones", paid:false },
          { id:"r3", name:"Mark Taylor", paid:true }, { id:"r4", name:"Chris Brown", paid:true },
          { id:"r5", name:"Andy Green", paid:false }, { id:"r6", name:"Paul Roberts", paid:true },
          { id:"r7", name:"Ben Harris", paid:true }, { id:"r8", name:"John Close", paid:false },
          { id:"r9", name:"Richard Jones", paid:true }, { id:"r10", name:"Tim Sewards", paid:true },
          { id:"r11", name:"Nick Benbow", paid:true }, { id:"r12", name:"Derek Lewis", paid:false },
          { id:"r13", name:"Adam Betteridge", paid:true }, { id:"r14", name:"Michael Evans", paid:true },
          { id:"r15", name:"Simon Clarke", paid:false }, { id:"r16", name:"James Wilson", paid:true },
          { id:"r17", name:"Lee Walker", paid:true }, { id:"r18", name:"Tom Harrison", paid:false }
        ]
      },
      {
        id: "event-2",
        name: "Captain's Day",
        date: "2027-05-28",
        venue: "Forest of Arden",
        description: "Captain's Day · 18 holes · prizes after golf",
        price: "£50",
        places: 32,
        teeTimes: "08:30",
        courseVideo: "https://www.youtube.com/results?search_query=Forest+of+Arden+golf+course",
        rsvps: [
          { id:"r19", name:"Ben Harris", paid:true }, { id:"r20", name:"Paul Roberts", paid:true },
          { id:"r21", name:"John Close", paid:false }, { id:"r22", name:"Richard Jones", paid:true },
          { id:"r23", name:"David Smith", paid:true }, { id:"r24", name:"Steve Jones", paid:false },
          { id:"r25", name:"Mark Taylor", paid:true }, { id:"r26", name:"Chris Brown", paid:true },
          { id:"r27", name:"Andy Green", paid:true }, { id:"r28", name:"Tim Sewards", paid:true },
          { id:"r29", name:"Nick Benbow", paid:false }, { id:"r30", name:"Derek Lewis", paid:true },
          { id:"r31", name:"Adam Betteridge", paid:true }, { id:"r32", name:"Michael Evans", paid:true },
          { id:"r33", name:"Simon Clarke", paid:false }, { id:"r34", name:"James Wilson", paid:true },
          { id:"r35", name:"Lee Walker", paid:true }, { id:"r36", name:"Tom Harrison", paid:true },
          { id:"r37", name:"Matt Cooper", paid:false }, { id:"r38", name:"Daniel King", paid:true },
          { id:"r39", name:"Peter Hall", paid:true }, { id:"r40", name:"Robert Moore", paid:true },
          { id:"r41", name:"Gary Turner", paid:false }, { id:"r42", name:"Martin Hill", paid:true }
        ]
      },
      {
        id: "event-3",
        name: "Summer Stableford",
        date: "2027-07-30",
        venue: "The Warwickshire",
        description: "Summer Stableford · 18 holes",
        price: "£48",
        places: 24,
        teeTimes: "09:15",
        courseVideo: "https://www.youtube.com/results?search_query=The+Warwickshire+golf+course",
        rsvps: [
          { id:"r43", name:"Tim Sewards", paid:true }, { id:"r44", name:"Nick Benbow", paid:true },
          { id:"r45", name:"Derek Lewis", paid:false }, { id:"r46", name:"Adam Betteridge", paid:true },
          { id:"r47", name:"David Smith", paid:true }, { id:"r48", name:"Steve Jones", paid:false },
          { id:"r49", name:"Mark Taylor", paid:true }, { id:"r50", name:"Chris Brown", paid:true },
          { id:"r51", name:"Ben Harris", paid:true }, { id:"r52", name:"Paul Roberts", paid:false },
          { id:"r53", name:"John Close", paid:true }, { id:"r54", name:"Richard Jones", paid:true }
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
        <article class="event-card-enhanced compact-event-card">
          <div class="event-date-block">
            <span>${date.month}</span>
            <strong>${date.day}</strong>
            <small>${new Date(`${event.date}T12:00:00`).getFullYear()}</small>
          </div>

          <div class="event-main">
            <div class="event-title-row">
              <div class="event-heading-copy">
                <h3>${escapeHtml(event.name)}</h3>
                <p class="event-venue">📍 ${escapeHtml(event.venue)}</p>
              </div>
              <div class="event-heading-actions">
                <button class="button button-small rsvp-event-button" type="button" data-event-id="${event.id}">RSVP</button>
                <span class="event-price">${escapeHtml(event.price)}</span>
              </div>
            </div>

            <div class="event-summary-row">
              <span><b>First tee</b> ${escapeHtml(event.teeTimes)}</span>
              <span><b>Slots available</b> ${Math.max(0, event.places - event.rsvps.length)}/${event.places}</span>
            </div>

            <p class="event-description">${escapeHtml(event.description)}</p>

            <div class="event-button-row">
              ${event.courseVideo ? `<button class="button button-outline course-video-button" type="button" data-video="${escapeHtml(event.courseVideo)}">Course video</button>` : ""}
              <button class="button button-outline event-details-button" type="button" data-event-id="${event.id}">More details</button>
            </div>

            <div class="event-more-details hidden" id="event-details-${event.id}">
              <div class="detail-grid">
                <span><b>Date</b>${escapeHtml(date.long)}</span>
                <span><b>Places</b>${event.rsvps.length}/${event.places} booked</span>
                <span><b>Tee times</b>${escapeHtml(event.teeTimes)}</span>
                <span><b>Price</b>${escapeHtml(event.price)}</span>
              </div>
            </div>
          </div>

          <aside class="event-rsvp-section">
            <div class="rsvp-list-heading">
              <h4>Players attending</h4>
              <span>${event.rsvps.length}</span>
            </div>
            <div class="public-rsvp-list">
              ${event.rsvps.map(rsvp => `
                <div class="public-rsvp-row">
                  <strong>${escapeHtml(rsvp.name)}</strong>
                  ${paymentBadge(rsvp.paid)}
                </div>
              `).join("") || `<p class="muted">No RSVPs yet.</p>`}
            </div>
          </aside>
        </article>
      `;
    }).join("");

    bindPublicButtons();
  };

  const bindPublicButtons = () => {

    document.querySelectorAll(".event-details-button").forEach(button => {
      button.addEventListener("click", () => {
        const panel = document.querySelector(`#event-details-${button.dataset.eventId}`);
        const hidden = panel.classList.toggle("hidden");
        button.textContent = hidden ? "More details" : "Hide details";
      });
    });

    document.querySelectorAll(".course-video-button").forEach(button => {
      button.addEventListener("click", () => {
        window.open(button.dataset.video, "_blank", "noopener,noreferrer");
      });
    });


    document.querySelectorAll(".rsvp-event-button").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelector("#rsvpEvent").value = button.dataset.eventId;
        document.querySelector("#rsvp").scrollIntoView({ behavior:"smooth", block:"start" });
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
          <div class="muted">${escapeHtml(rsvp.buggy || "No")} buggy · ${escapeHtml(rsvp.teeTime || "No preference")}</div>
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
