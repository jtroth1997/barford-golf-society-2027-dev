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
  let selectedAmount = fullAmount;
  let selectedType = "full";
  let memberName = "Jack Troth";

  try {
    const account = JSON.parse(localStorage.getItem("bgs-2027-member-account") || "{}");
    memberName = account.name || account.fullName || memberName;
  } catch (_) {}

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
  setText("#fullPaymentLabel", `Pay ${money(fullAmount)} in full`);
  setText("#depositBalance", `${money(Math.max(0, fullAmount - 5))} remains due`);

  const checkout = document.querySelector("#paymentCheckout");
  const choices = document.querySelector("#paymentChoices");
  const methods = document.querySelector("#paymentMethods");
  const success = document.querySelector("#paymentSuccess");
  const reserved = document.querySelector("#reservationSuccess");
  const declined = document.querySelector("#paymentDeclined");
  const progress = document.querySelector("#paymentProgress");

  const show = target => {
    [checkout, success, reserved, declined].forEach(section => section?.classList.toggle("hidden", section !== target));
    scrollTo({ top: 0, behavior: "smooth" });
  };

  document.querySelector("#reserveWithoutPayment")?.addEventListener("click", () => {
    writeCommitment({ status: "reserved", amountPaid: 0, balanceDue: fullAmount });
    setText("#reservedEvent", eventName);
    setText("#reservedBalance", money(fullAmount));
    show(reserved);
  });

  document.querySelectorAll("[data-payment-choice]").forEach(button => {
    button.addEventListener("click", () => {
      selectedType = button.dataset.paymentChoice;
      selectedAmount = selectedType === "deposit" ? Math.min(5, fullAmount) : fullAmount;
      setText("#selectedPaymentTitle", selectedType === "deposit" ? "Pay £5 place deposit" : "Pay in full");
      setText("#selectedPaymentAmount", money(selectedAmount));
      choices.classList.add("hidden");
      methods.classList.remove("hidden");
      methods.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
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
      const existing = read(PAYMENT_STORAGE).filter(item => !(item.eventId === eventId && item.paymentType === selectedType));
      const payment = {
        eventId, eventName, venue, eventDate, fullAmount, memberName, method, reference,
        paymentType: selectedType, amount: selectedAmount, status: "paid", paidAt: new Date().toISOString()
      };
      existing.unshift(payment);
      localStorage.setItem(PAYMENT_STORAGE, JSON.stringify(existing.slice(0, 40)));
      const amountPaid = selectedType === "deposit" ? selectedAmount : fullAmount;
      writeCommitment({
        status: selectedType === "deposit" ? "deposit_paid" : "paid",
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
