(() => {
  "use strict";
  const PAYMENT_STORAGE = "bgs-2027-payment-beta";
  const RSVP_STORAGE = "bgs-2027-event-commitments";
  const params = new URLSearchParams(location.search);
  const eventId = params.get("event") || "season-opener";
  const eventName = params.get("name") || "Season Opener";
  const venue = params.get("venue") || "The Belfry – Derby Course";
  const eventDate = params.get("date") || "2027-03-26";
  const fullAmount = Number(params.get("amount") || 45);
  const existingCommitment = readCommitments().find(item => item.eventId === eventId);
  const payingBalance = existingCommitment?.status === "deposit_paid";
  let selectedAmount = payingBalance ? Number(existingCommitment?.balanceDue || Math.max(0, fullAmount - 5)) : Math.min(5, fullAmount);
  let selectedType = payingBalance ? "balance" : "deposit";
  let memberName = "Jack Troth";

  try {
    const account = JSON.parse(localStorage.getItem("bgs-2027-member-account") || "{}");
    memberName = account.name || account.fullName || memberName;
  } catch (_) {}

  function readCommitments() {
    try { return JSON.parse(localStorage.getItem(RSVP_STORAGE) || "[]"); }
    catch (_) { return []; }
  }
  const read = key => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (_) { return []; }
  };
  const writeCommitment = updates => {
    const commitments = read(RSVP_STORAGE).filter(item => item.eventId !== eventId);
    commitments.unshift({
      eventId, eventName, venue, eventDate, fullAmount, memberName,
      updatedAt: new Date().toISOString(), ...updates
    });
    localStorage.setItem(RSVP_STORAGE, JSON.stringify(commitments.slice(0, 30)));
  };
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  const money = value => `£${Number(value).toFixed(2)}`;

  setText("#paymentEventName", eventName);
  setText("#paymentVenue", venue);
  setText("#paymentAmount", money(fullAmount));
  setText("#paymentMember", memberName);
  setText("#checkoutActionTitle", payingBalance ? "Pay your remaining balance" : "Confirm your RSVP");
  setText("#checkoutActionCopy", payingBalance
    ? "Complete payment before the event to change your status from Payment due to Paid."
    : "A £5 non-refundable deposit confirms your place and is deducted from the event total.");
  setText("#paymentChoiceBadge", payingBalance ? "Balance payment" : "RSVP deposit");
  setText("#paymentChoiceTitle", payingBalance ? `Pay remaining ${money(selectedAmount)}` : "Pay £5 to confirm my place");
  setText("#paymentChoiceNote", payingBalance ? "This will clear your event balance" : `${money(Math.max(0, fullAmount - 5))} will remain to pay`);
  setText("#paymentChoiceAmount", money(selectedAmount));

  const checkout = document.querySelector("#paymentCheckout");
  const choices = document.querySelector("#paymentChoices");
  const methods = document.querySelector("#paymentMethods");
  const success = document.querySelector("#paymentSuccess");
  const declined = document.querySelector("#paymentDeclined");
  const progress = document.querySelector("#paymentProgress");

  const show = target => {
    [checkout, success, declined].forEach(section => section?.classList.toggle("hidden", section !== target));
    scrollTo({ top: 0, behavior: "smooth" });
  };

  document.querySelector("#continueToPayment")?.addEventListener("click", () => {
    setText("#selectedPaymentTitle", payingBalance ? "Remaining balance" : "£5 RSVP deposit");
    setText("#selectedPaymentAmount", money(selectedAmount));
    choices.classList.add("hidden");
    methods.classList.remove("hidden");
    methods.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  document.querySelector("#changePaymentChoice")?.addEventListener("click", () => {
    methods.classList.add("hidden");
    choices.classList.remove("hidden");
    progress.textContent = "";
  });

  const completePayment = method => {
    document.querySelectorAll("[data-method]").forEach(button => { button.disabled = true; });
    progress.textContent = `Processing ${method} test payment…`;
    setTimeout(() => {
      const reference = `BGS-TEST-${Date.now().toString().slice(-8)}`;
      const existing = read(PAYMENT_STORAGE);
      const payment = {
        eventId, eventName, venue, eventDate, fullAmount, memberName, method, reference,
        paymentType: selectedType, amount: selectedAmount, status: "paid", paidAt: new Date().toISOString()
      };
      existing.unshift(payment);
      localStorage.setItem(PAYMENT_STORAGE, JSON.stringify(existing.slice(0, 40)));
      const previousPaid = Number(existingCommitment?.amountPaid || 0);
      const amountPaid = selectedType === "balance" ? fullAmount : Math.min(fullAmount, previousPaid + selectedAmount);
      writeCommitment({
        status: selectedType === "balance" || amountPaid >= fullAmount ? "paid" : "deposit_paid",
        amountPaid,
        balanceDue: Math.max(0, fullAmount - amountPaid)
      });
      setText("#successAmount", money(selectedAmount));
      setText("#successEvent", eventName);
      setText("#successMember", memberName);
      setText("#successMethod", method);
      setText("#successReference", reference);
      setText("#successBalance", selectedType === "deposit"
        ? `${money(fullAmount - selectedAmount)} remains to be paid before the event.`
        : "Your event is paid in full.");
      show(success);
    }, 700);
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
