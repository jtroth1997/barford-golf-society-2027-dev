(() => {
  "use strict";
  const PAYMENT_STORAGE = "bgs-2027-payment-beta";
  const RSVP_STORAGE = "bgs-2027-event-commitments";
  const read = key => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (_) { return []; }
  };
  const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const money = value => `£${Number(value || 0).toFixed(2)}`;
  const monthNumber = { JAN:"01", FEB:"02", MAR:"03", APR:"04", MAY:"05", JUN:"06", JUL:"07", AUG:"08", SEP:"09", OCT:"10", NOV:"11", DEC:"12" };
  const cardDate = card => {
    const block = card.querySelector(".event-date-block");
    const month = monthNumber[block?.querySelector("span")?.textContent.trim().toUpperCase()] || "01";
    const day = (block?.querySelector("strong")?.textContent.trim() || "1").padStart(2, "0");
    const year = block?.querySelector("small")?.textContent.trim() || "2027";
    return `${year}-${month}-${day}`;
  };
  const eventClosed = date => Date.now() >= new Date(`${date}T23:59:59`).getTime();
  const statusLabel = commitment => {
    if (!commitment) return "RSVP / Pay";
    if (commitment.status === "paid") return "Paid in full ✓";
    if (commitment.status === "deposit_paid") return `£${commitment.balanceDue} to pay`;
    return "Place reserved · Pay later";
  };

  document.querySelectorAll(".compact-event-card").forEach(card => {
    const name = card.querySelector("h3")?.textContent.trim() || "Event";
    const eventId = slug(name);
    const venue = (card.querySelector(".event-venue")?.textContent || "").replace(/^📍\s*/, "").trim();
    const amount = Number((card.querySelector(".event-price")?.textContent || "0").replace(/[^0-9.]/g, ""));
    const date = cardDate(card);
    const button = card.querySelector(".rsvp-event-button");
    const commitment = read(RSVP_STORAGE).find(item => item.eventId === eventId);
    if (button) {
      button.textContent = eventClosed(date) ? "Event closed" : statusLabel(commitment);
      button.classList.toggle("payment-complete", commitment?.status === "paid");
      button.disabled = eventClosed(date);
    }
    button?.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (eventClosed(date)) return;
      const target = new URL("payment-beta.html", location.href);
      [["event", eventId], ["name", name], ["venue", venue], ["amount", amount], ["date", date]].forEach(([key, value]) => target.searchParams.set(key, String(value)));
      location.href = target.href;
    }, true);
  });

  const accountContent = document.querySelector("#accountContent");
  if (accountContent) {
    const commitments = read(RSVP_STORAGE).filter(item => !eventClosed(item.eventDate));
    const outstanding = commitments.filter(item => Number(item.balanceDue) > 0);
    const section = document.createElement("section");
    section.className = "account-section beta-account-payments";
    section.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">Event payments</p><h2>Events to be paid for</h2><p>Places you have reserved with an outstanding balance.</p></div><strong class="payment-total">${money(outstanding.reduce((sum, item) => sum + Number(item.balanceDue || 0), 0))} due</strong></div>
      <div class="account-payment-list">
        ${outstanding.length ? outstanding.map(item => `<article><div><strong>${escapeHtml(item.eventName)}</strong><small>${escapeHtml(item.venue)} · ${escapeHtml(item.eventDate)}</small><span>${item.status === "deposit_paid" ? `${money(item.amountPaid)} deposit paid` : "Place reserved"}</span></div><div><b>${money(item.balanceDue)} due</b><a class="button button-primary" href="payment-beta.html?event=${encodeURIComponent(item.eventId)}&name=${encodeURIComponent(item.eventName)}&venue=${encodeURIComponent(item.venue)}&amount=${item.fullAmount}&date=${item.eventDate}">Pay now</a></div></article>`).join("") : `<p class="empty-state">You have no outstanding event payments.</p>`}
      </div>`;
    accountContent.prepend(section);
  }

  const adminDashboard = document.querySelector("#adminDashboard");
  if (adminDashboard) {
    const payments = read(PAYMENT_STORAGE);
    const commitments = read(RSVP_STORAGE);
    const upcoming = commitments.filter(item => !eventClosed(item.eventDate));
    const history = commitments.filter(item => eventClosed(item.eventDate));
    const paymentRows = records => records.length ? records.map(item => {
      const related = payments.filter(payment => payment.eventId === item.eventId);
      return `<article><div><strong>${escapeHtml(item.memberName)}</strong><small>${escapeHtml(item.eventName)} · ${escapeHtml(item.eventDate)}</small><span>${item.status === "paid" ? "Paid in full" : item.status === "deposit_paid" ? `${money(item.amountPaid)} deposit paid` : "RSVP only"}</span></div><div><b>${money(item.amountPaid)} paid</b><small>${money(item.balanceDue)} due</small></div><div>${related.map(payment => `<small>${escapeHtml(payment.reference)} · ${escapeHtml(payment.method)}</small>`).join("") || "<small>No payment reference</small>"}</div></article>`;
    }).join("") : `<p class="empty-state">Nothing to show here yet.</p>`;

    const section = document.createElement("section");
    section.className = "admin-card beta-payment-admin";
    section.innerHTML = `
      <div class="admin-heading"><div><p class="eyebrow">Payment management</p><h3>Member payments</h3><p>RSVPs, deposits, full payments and outstanding balances.</p></div><strong class="access-pill">${money(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0))} collected</strong></div>
      <div class="payment-admin-tabs" role="tablist" aria-label="Payment records">
        <button class="active" type="button" role="tab" aria-selected="true" data-payment-tab="upcoming">Next event payments <span>${upcoming.length}</span></button>
        <button type="button" role="tab" aria-selected="false" data-payment-tab="history">Event payment history <span>${history.length}</span></button>
      </div>
      <div class="payment-admin-panel" data-payment-panel="upcoming"><div class="beta-payment-list">${paymentRows(upcoming)}</div></div>
      <div class="payment-admin-panel hidden" data-payment-panel="history"><div class="beta-payment-list">${paymentRows(history)}</div></div>
      <div class="refund-policy"><strong>Cancellation and refunds</strong><p>The £5 place deposit is non-refundable. Any last-minute refund is a committee decision and can be processed manually, less the payment provider’s card fee.</p></div>
      ${(payments.length || commitments.length) ? `<button id="clearBetaPayments" class="button button-outline" type="button">Clear all test payment data</button>` : ""}`;
    adminDashboard.appendChild(section);
    section.querySelectorAll("[data-payment-tab]").forEach(tab => tab.addEventListener("click", () => {
      section.querySelectorAll("[data-payment-tab]").forEach(button => {
        const active = button === tab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      section.querySelectorAll("[data-payment-panel]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.paymentPanel !== tab.dataset.paymentTab));
    }));
    section.querySelector("#clearBetaPayments")?.addEventListener("click", () => {
      localStorage.removeItem(PAYMENT_STORAGE);
      localStorage.removeItem(RSVP_STORAGE);
      location.reload();
    });
  }
})();
