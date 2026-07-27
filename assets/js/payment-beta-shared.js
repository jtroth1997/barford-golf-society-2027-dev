(() => {
  "use strict";
  const STORAGE = "bgs-2027-payment-beta";
  const getPayments = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "[]"); }
    catch (_) { return []; }
  };
  const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

  document.querySelectorAll(".compact-event-card").forEach(card => {
    const name = card.querySelector("h3")?.textContent.trim() || "Event";
    const eventId = slug(name);
    const venue = (card.querySelector(".event-venue")?.textContent || "").replace(/^📍\s*/,"").trim();
    const amount = Number((card.querySelector(".event-price")?.textContent || "0").replace(/[^0-9.]/g,""));
    const button = card.querySelector(".rsvp-event-button");
    const paid = getPayments().find(payment => payment.eventId === eventId && payment.status === "paid");
    if (paid && button) {
      button.textContent = "Payment received ✓";
      button.classList.add("payment-complete");
    }
    button?.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (paid) {
        window.showSiteMessage?.(`${name}: payment received.`);
        return;
      }
      const target = new URL("payment-beta.html", location.href);
      target.searchParams.set("event", eventId);
      target.searchParams.set("name", name);
      target.searchParams.set("venue", venue);
      target.searchParams.set("amount", String(amount));
      location.href = target.href;
    }, true);
  });

  const adminDashboard = document.querySelector("#adminDashboard");
  if (adminDashboard) {
    const payments = getPayments();
    const total = payments.filter(item => item.status === "paid").reduce((sum,item) => sum + Number(item.amount || 0),0);
    const section = document.createElement("section");
    section.className = "admin-card beta-payment-admin";
    section.innerHTML = `
      <div class="admin-heading">
        <div><p class="eyebrow">Payment beta</p><h3>Test transactions</h3><p>Demonstration payments saved on this device only.</p></div>
        <strong class="access-pill">£${total.toFixed(2)} collected</strong>
      </div>
      <div class="beta-payment-list">
        ${payments.length ? payments.map(item => `<article><div><strong>${item.memberName}</strong><small>${item.eventName} · ${item.method}</small></div><b>£${Number(item.amount).toFixed(2)}</b><span class="status active">Paid</span><small>${item.reference}</small></article>`).join("") : `<p class="empty-state">No test payments yet. Complete a payment from the Events page and it will appear here.</p>`}
      </div>
      ${payments.length ? `<button id="clearBetaPayments" class="button button-outline" type="button">Clear test payments</button>` : ""}
    `;
    adminDashboard.appendChild(section);
    section.querySelector("#clearBetaPayments")?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE);
      location.reload();
    });
  }
})();
