(() => {
  "use strict";
  const STORAGE = "bgs-2027-payment-beta";
  const params = new URLSearchParams(location.search);
  const eventId = params.get("event") || "season-opener";
  const eventName = params.get("name") || "Season Opener";
  const venue = params.get("venue") || "The Belfry – Derby Course";
  const amount = Number(params.get("amount") || 45);
  let memberName = "Jack Troth";
  try {
    const account = JSON.parse(localStorage.getItem("bgs-2027-member-account") || "{}");
    memberName = account.name || account.fullName || memberName;
  } catch (_) {}

  const money = `£${amount.toFixed(2)}`;
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  setText("#paymentEventName", eventName);
  setText("#paymentVenue", venue);
  setText("#paymentAmount", money);
  setText("#paymentMember", memberName);

  const checkout = document.querySelector("#paymentCheckout");
  const success = document.querySelector("#paymentSuccess");
  const declined = document.querySelector("#paymentDeclined");
  const progress = document.querySelector("#paymentProgress");

  const show = target => {
    [checkout, success, declined].forEach(section => section?.classList.toggle("hidden", section !== target));
    scrollTo({ top:0, behavior:"smooth" });
  };

  const completePayment = method => {
    document.querySelectorAll("[data-method]").forEach(button => { button.disabled = true; });
    progress.textContent = `Processing ${method} test payment…`;
    setTimeout(() => {
      const reference = `BGS-TEST-${Date.now().toString().slice(-8)}`;
      const payment = { eventId, eventName, venue, amount, memberName, method, reference, status:"paid", paidAt:new Date().toISOString() };
      let payments = [];
      try { payments = JSON.parse(localStorage.getItem(STORAGE) || "[]"); } catch (_) {}
      payments = payments.filter(item => item.eventId !== eventId);
      payments.unshift(payment);
      localStorage.setItem(STORAGE, JSON.stringify(payments.slice(0,20)));
      setText("#successAmount", money);
      setText("#successEvent", eventName);
      setText("#successMember", memberName);
      setText("#successMethod", method);
      setText("#successReference", reference);
      show(success);
    }, 850);
  };

  document.querySelectorAll("[data-method]").forEach(button => {
    button.addEventListener("click", () => completePayment(button.dataset.method));
  });
  document.querySelector("#simulateDecline")?.addEventListener("click", () => show(declined));
  document.querySelector("#tryPaymentAgain")?.addEventListener("click", () => {
    document.querySelectorAll("[data-method]").forEach(button => { button.disabled = false; });
    progress.textContent = "";
    show(checkout);
  });
})();
