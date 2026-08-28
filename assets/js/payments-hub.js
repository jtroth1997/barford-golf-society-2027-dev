(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const panel = document.querySelector("#main-content .account-panel");
  if (!panel) return;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[character]);
  const money = value => Number.isFinite(Number(value)) ? `£${Number(value).toFixed(2)}` : "Amount TBC";

  const showMessage = (eyebrow, title, copy, actions = "") => {
    panel.innerHTML = `<p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p>${actions}`;
  };

  const load = async () => {
    if (!client) {
      showMessage("Payment status", "Payment details unavailable", "Please refresh the page and try again.");
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      showMessage("Member payment", "Sign in to continue", "Your payment status is private and linked to your member account.", '<a class="button button-primary" href="account.html">Sign in</a>');
      return;
    }
    const eventId = new URLSearchParams(location.search).get("event");
    if (!eventId) {
      showMessage("Payment status", "Choose an event", "Open an event from your dashboard to see its payment status.", '<a class="button button-primary" href="index.html">Return to dashboard</a>');
      return;
    }
    const [{ data: event, error: eventError }, { data: rsvp, error: rsvpError }] = await Promise.all([
      client.from("events").select("id,name,event_date,price,status").eq("id", eventId).maybeSingle(),
      client.from("rsvps").select("status,payment_status,updated_at").eq("event_id", eventId).eq("member_id", session.user.id).maybeSingle()
    ]);
    if (eventError || rsvpError || !event || !rsvp || rsvp.status !== "playing") {
      showMessage("Payment status", "No payment is attached to this account", "Confirm that you are playing the event before opening its payment page.", '<a class="button button-primary" href="events.html">View events</a>');
      return;
    }
    if (rsvp.payment_status === "paid") {
      panel.innerHTML = `<div class="payment-page-success" aria-hidden="true">✓</div><p class="eyebrow">Payment confirmed</p><h2>You have paid</h2><p><strong>${escapeHtml(money(event.price))}</strong> is recorded as paid for ${escapeHtml(event.name)}.</p><div class="dashboard-button-row"><a class="button button-primary" href="index.html">Return to dashboard</a><a class="button button-outline" href="events.html">View event</a></div>`;
      return;
    }
    panel.innerHTML = `<p class="eyebrow">Payment due</p><h2>${escapeHtml(event.name)}</h2><div class="payment-page-amount"><span>Amount to pay</span><strong>${escapeHtml(money(event.price))}</strong></div><p>Your place is confirmed, but payment is still shown as outstanding. Online card checkout is being prepared; use the society’s current payment method and the committee can confirm it here.</p><div class="dashboard-button-row"><button class="button button-primary" type="button" disabled>Online payment opening soon</button><a class="button button-outline" href="events.html">Back to event</a></div>`;
  };
  load();
})();
