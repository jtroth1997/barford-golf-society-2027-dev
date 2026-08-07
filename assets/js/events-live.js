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
  const videoEmbedUrl = value => {
    try {
      const url = new URL(value);
      if (url.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
      if (url.hostname.includes("youtube.com")) {
        const id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
        return id ? `https://www.youtube.com/embed/${id}` : value;
      }
      if (url.hostname.includes("vimeo.com") && !url.hostname.includes("player.")) {
        const id = url.pathname.split("/").filter(Boolean).pop();
        return id ? `https://player.vimeo.com/video/${id}` : value;
      }
      return value;
    } catch {
      return value;
    }
  };
  const friendlyPrice = value => value == null || value === ""
    ? "Price TBC"
    : Number(value) === 0 ? "Free" : `£${Number(value).toFixed(2)}`;
  const cancelMarker = "[BARFORD_CANCEL_REASON] ";
  const cancellationReason = event => event.cancel_reason || (() => {
    const text = String(event.notes || "");
    const index = text.lastIndexOf(cancelMarker);
    return index >= 0 ? text.slice(index + cancelMarker.length).trim() : "";
  })();
  const courseDescription = notes => {
    const text = String(notes || "");
    const index = text.lastIndexOf(cancelMarker);
    return (index >= 0 ? text.slice(0, index) : text).trim();
  };

  const emptyState = (title, message) => {
    list.innerHTML = `
      <article class="empty-state account-panel">
        <p class="eyebrow">No events yet</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
      </article>`;
  };

  const renderEvent = (event, memberState = {}) => {
    const date = dateParts(event.event_date);
    const cancelled = event.status === "cancelled";
    const address = event.address
      ? `<span><b>Address</b>${escapeHtml(event.address)}</span>`
      : "";
    const description = courseDescription(event.notes);
    const notes = description
      ? `<p class="event-description">${escapeHtml(description)}</p>`
      : "";
    const video = event.course_video_url
      ? `<button class="button button-outline" type="button" data-course-video="${escapeHtml(event.course_video_url)}" data-course-name="${escapeHtml(event.name)}">Course video</button>`
      : "";

    const memberRsvp = memberState.rsvp;
    const participation = cancelled
      ? `<div class="event-member-state cancelled"><strong>Event cancelled</strong><small>No action needed.</small></div>`
      : !memberState.signedIn
        ? `<div class="event-member-state"><strong>Want to play?</strong><small>Sign in to manage your RSVP.</small><a class="button button-primary" href="index.html">Sign in</a></div>`
        : memberRsvp?.status === "playing"
          ? `<div class="event-member-state playing"><strong>✓ You’re playing</strong>${memberState.locked ? `<small>Tee times are published. Contact an admin if you need to drop out.</small><span class="rsvp-contact-admin">Contact admin to withdraw</span>` : `<small>Your place is confirmed.</small><button class="button button-outline" type="button" data-withdraw-event="${event.id}">I can’t play now</button>`}</div>`
          : `<div class="event-member-state"><strong>${memberRsvp?.status === "not_playing" || memberRsvp?.status === "cancelled" ? "You’re not playing" : "RSVP not confirmed"}</strong><small>${memberState.locked ? "Tee times are already published." : "Use your dashboard to join this event."}</small>${memberState.locked ? `<span class="rsvp-contact-admin">Contact admin to make a change</span>` : `<a class="button button-primary" href="index.html">${memberRsvp ? "Change RSVP" : "RSVP"}</a>`}</div>`;

    return `
      <article class="compact-event-card ${cancelled ? "event-cancelled-card" : ""}">
        ${cancelled ? `<div class="event-cancelled-banner">CANCELLED${cancellationReason(event) ? `<small>${escapeHtml(cancellationReason(event))}</small>` : ""}</div>` : ""}
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
        <aside class="event-rsvp-section">${participation}</aside>
      </article>`;
  };

  const loadEvents = async () => {
    if (!client) {
      emptyState("Events could not be loaded", "Please refresh the page and try again.");
      return;
    }

    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let result = await client
      .from("events")
      .select("id,name,venue,address,event_date,first_tee_time,price,capacity,course_video_url,notes,status,cancel_reason")
      .in("status", ["scheduled", "cancelled"])
      .gte("event_date", localToday)
      .order("event_date", { ascending: true });
    if (result.error && /cancel_reason|column .* does not exist/i.test(result.error.message || "")) {
      result = await client.from("events")
        .select("id,name,venue,address,event_date,first_tee_time,price,capacity,course_video_url,notes,status")
        .in("status", ["scheduled", "cancelled"]).gte("event_date", localToday).order("event_date", { ascending: true });
    }
    const { data, error } = result;

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

    const { data: { session } } = await client.auth.getSession();
    let ownRsvps = [];
    const lockMap = new Map();
    if (session && events.length) {
      const [{ data: rsvps }, locks] = await Promise.all([
        client.from("rsvps").select("event_id,status").eq("member_id", session.user.id).in("event_id", events.map(event => event.id)),
        Promise.all(events.map(event => client.rpc("get_event_rsvp_lock_status", { target_event_id: event.id })))
      ]);
      ownRsvps = rsvps || [];
      events.forEach((event, index) => lockMap.set(event.id, Boolean(locks[index]?.data)));
    }
    const rsvpByEvent = new Map(ownRsvps.map(rsvp => [rsvp.event_id, rsvp]));
    list.innerHTML = events.map(event => renderEvent(event, { signedIn: Boolean(session), rsvp: rsvpByEvent.get(event.id), locked: lockMap.get(event.id) })).join("");
    if (summary) {
      summary.textContent = `${events.length} upcoming event${events.length === 1 ? "" : "s"} published.`;
    }

    const videoDialog = document.querySelector("#courseVideoDialog");
    const videoFrame = document.querySelector("#courseVideoFrame");
    const videoTitle = document.querySelector("#courseVideoTitle");
    const closeVideo = () => {
      videoDialog?.close();
      if (videoFrame) videoFrame.src = "";
    };
    list.querySelectorAll("[data-course-video]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.courseVideo.includes("youtube.com/results")) {
          window.open(button.dataset.courseVideo, "_blank", "noopener,noreferrer");
          return;
        }
        if (!videoDialog || !videoFrame) return;
        videoTitle.textContent = button.dataset.courseName || "Course video";
        videoFrame.src = videoEmbedUrl(button.dataset.courseVideo);
        videoDialog.showModal();
      });
    });
    document.querySelector("#courseVideoClose")?.addEventListener("click", closeVideo);
    document.querySelector("#courseVideoDone")?.addEventListener("click", closeVideo);
    videoDialog?.addEventListener("click", event => {
      if (event.target === videoDialog) closeVideo();
    });

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
    list.querySelectorAll("[data-withdraw-event]").forEach(button => button.addEventListener("click", async () => {
      if (!session) return;
      const eventId = button.dataset.withdrawEvent;
      if (!confirm("Remove yourself from this event?")) return;
      button.disabled = true;
      button.textContent = "Updating…";
      const { error: withdrawError } = await client.from("rsvps").update({ status: "not_playing", updated_at: new Date().toISOString() }).eq("event_id", eventId).eq("member_id", session.user.id);
      if (withdrawError) {
        button.disabled = false;
        button.textContent = "I can’t play now";
        alert(withdrawError.message.includes("locked") ? "Tee times have already been produced. Please contact an admin to drop out." : "We couldn’t update your RSVP. Please try again.");
        return;
      }
      await loadEvents();
    }));
  };

  loadEvents();
})();
