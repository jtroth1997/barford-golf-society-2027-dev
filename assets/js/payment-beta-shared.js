(() => {
  "use strict";
  const PAYMENT_STORAGE = "bgs-2027-payment-beta";
  const RSVP_STORAGE = "bgs-2027-event-commitments";
  const DEMO_SEEDED = "bgs-2027-three-event-demo";
  const DEMO_RESET = "bgs-2027-payment-demo-reset-v3";
  const read = key => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (_) { return []; }
  };
  const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const money = value => `£${Number(value || 0).toFixed(2)}`;
  if (!localStorage.getItem(DEMO_RESET)) {
    localStorage.removeItem(PAYMENT_STORAGE);
    localStorage.removeItem(RSVP_STORAGE);
    localStorage.setItem(DEMO_SEEDED, "1");
    localStorage.setItem(DEMO_RESET, "1");
  }
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
    if (!commitment) return "RSVP · £5 deposit";
    if (commitment.status === "paid") return "Paid in full ✓";
    if (commitment.status === "deposit_paid") return `Payment due · £${commitment.balanceDue}`;
    return "RSVP · £5 deposit";
  };
  const memberName = (() => {
    try {
      const account = JSON.parse(localStorage.getItem("bgs-2027-member-account") || "{}");
      return account.name || account.fullName || "Jack Troth";
    } catch (_) { return "Jack Troth"; }
  })();
  const openFastPayment = details => {
    const commitments = read(RSVP_STORAGE);
    const existing = commitments.find(item => item.eventId === details.eventId);
    const isBalance = existing?.status === "deposit_paid";
    const amount = isBalance ? Number(existing.balanceDue) : Math.min(5, Number(details.fullAmount));
    const paymentType = isBalance ? "balance" : "deposit";
    const overlay = document.createElement("div");
    overlay.className = "fast-payment-overlay";
    overlay.innerHTML = `<section class="fast-payment-sheet" role="dialog" aria-modal="true" aria-labelledby="fastPaymentTitle">
      <button class="fast-payment-close" type="button" aria-label="Close payment">×</button>
      <span class="payment-test-pill">TEST MODE</span>
      <p class="eyebrow">${isBalance ? "Remaining balance" : "RSVP deposit"}</p>
      <h2 id="fastPaymentTitle">${isBalance ? `Pay remaining ${money(amount)}` : "Confirm your place for £5"}</h2>
      <p><strong>${escapeHtml(details.eventName)}</strong><br><small>${escapeHtml(details.venue)}</small></p>
      <div class="fast-payment-total"><span>Pay now</span><strong>${money(amount)}</strong></div>
      <p class="fast-payment-note">${isBalance ? "This clears the event balance and changes your status to Paid." : `${money(Number(details.fullAmount) - amount)} will remain to pay in My Account.`}</p>
      <div class="fast-payment-methods">
        <button type="button" data-fast-method="Apple Pay"> Pay</button>
        <button type="button" data-fast-method="Google Pay">G Pay</button>
        <button type="button" data-fast-method="Test card">Test card payment</button>
      </div>
      <p class="fast-payment-status" role="status" aria-live="polite"></p>
    </section>`;
    document.body.appendChild(overlay);
    document.body.classList.add("payment-panel-open");
    const close = () => { overlay.remove(); document.body.classList.remove("payment-panel-open"); };
    overlay.querySelector(".fast-payment-close").addEventListener("click", close);
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    overlay.querySelectorAll("[data-fast-method]").forEach(button => button.addEventListener("click", () => {
      overlay.querySelectorAll("button").forEach(control => { control.disabled = true; });
      const status = overlay.querySelector(".fast-payment-status");
      status.textContent = "Processing test payment…";
      const method = button.dataset.fastMethod;
      setTimeout(() => {
        const now = new Date().toISOString();
        const reference = `BGS-TEST-${Date.now().toString().slice(-8)}`;
        const payments = read(PAYMENT_STORAGE);
        payments.unshift({ ...details, memberName, method, reference, paymentType, amount, status:"paid", paidAt:now });
        localStorage.setItem(PAYMENT_STORAGE, JSON.stringify(payments.slice(0, 40)));
        const updated = commitments.filter(item => item.eventId !== details.eventId);
        updated.unshift({
          ...details, memberName, updatedAt:now,
          status:isBalance ? "paid" : "deposit_paid",
          amountPaid:isBalance ? Number(details.fullAmount) : amount,
          balanceDue:isBalance ? 0 : Number(details.fullAmount) - amount
        });
        localStorage.setItem(RSVP_STORAGE, JSON.stringify(updated.slice(0, 30)));
        overlay.querySelector(".fast-payment-sheet").innerHTML = `<span class="result-icon success">✓</span><p class="eyebrow">Payment received</p><h2>${isBalance ? "Paid in full" : "RSVP confirmed"}</h2><p>${isBalance ? "Your status is now Paid." : `${money(amount)} deposit paid. ${money(Number(details.fullAmount) - amount)} remains due.`}</p><button class="button button-primary fast-payment-done" type="button">Done</button>`;
        overlay.querySelector(".fast-payment-done").addEventListener("click", () => location.reload());
      }, 100);
    }));
    overlay.querySelector("[data-fast-method]")?.focus();
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
      if (commitment?.status === "paid") {
        window.showSiteMessage?.(`${name}: paid in full.`);
        return;
      }
      openFastPayment({ eventId, eventName:name, venue, eventDate:date, fullAmount:amount });
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
        ${outstanding.length ? outstanding.map(item => `<article><div><strong>${escapeHtml(item.eventName)}</strong><small>${escapeHtml(item.venue)} · ${escapeHtml(item.eventDate)}</small><span>${money(item.amountPaid)} RSVP deposit paid</span></div><div><b>${money(item.balanceDue)} due</b><button class="button button-primary" type="button" data-pay-balance="${escapeHtml(item.eventId)}">Pay remaining ${money(item.balanceDue)}</button></div></article>`).join("") : `<p class="empty-state">You have no outstanding event payments.</p>`}
      </div>`;
    accountContent.prepend(section);
    section.querySelectorAll("[data-pay-balance]").forEach(button => button.addEventListener("click", () => {
      const item = outstanding.find(record => record.eventId === button.dataset.payBalance);
      if (item) openFastPayment(item);
    }));
  }

  const adminDashboard = document.querySelector("#adminDashboard");
  if (adminDashboard) {
    const payments = read(PAYMENT_STORAGE);
    const commitments = read(RSVP_STORAGE);
    const upcoming = commitments.filter(item => !eventClosed(item.eventDate));
    const history = commitments.filter(item => eventClosed(item.eventDate));
    const paymentRows = records => records.length ? records.map(item => {
      const related = payments.filter(payment => payment.eventId === item.eventId);
      return `<article><div><strong>${escapeHtml(item.memberName)}</strong><small>${escapeHtml(item.eventName)} · ${escapeHtml(item.eventDate)}</small><span>${item.status === "paid" ? "Paid in full" : `${money(item.amountPaid)} RSVP deposit paid`}</span></div><div><b>${money(item.amountPaid)} paid</b><small>${money(item.balanceDue)} due</small></div><div>${related.map(payment => `<small>${escapeHtml(payment.reference)} · ${escapeHtml(payment.method)}</small>`).join("") || "<small>No payment reference</small>"}</div></article>`;
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
      localStorage.setItem(DEMO_SEEDED, "1");
      location.reload();
    });
  }
})();
