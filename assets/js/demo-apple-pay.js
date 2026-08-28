(() => {
  "use strict";
  if (document.body.classList.contains("matchday-ui")) return;
  const client = window.BarfordSupabase;
  if (!client) return;

  const money = value => value == null || value === "" ? "Amount TBC" : `£${Number(value).toFixed(2)}`;
  const escapeHtml = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

  const ensureSheet = () => {
    let sheet = document.querySelector("#demoApplePaySheet");
    if (sheet) return sheet;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="demoApplePayBackdrop" class="demo-pay-backdrop" hidden></div>
      <section id="demoApplePaySheet" class="demo-pay-sheet" hidden aria-modal="true" role="dialog" aria-labelledby="demoPayTitle">
        <div class="demo-pay-grabber"></div>
        <div class="demo-pay-brand"> Pay</div>
        <div id="demoPayBody"></div>
      </section>`);
    return document.querySelector("#demoApplePaySheet");
  };

  const close = () => {
    const sheet = document.querySelector("#demoApplePaySheet");
    const backdrop = document.querySelector("#demoApplePayBackdrop");
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
  };

  async function openPayment(eventId, eventName, price, memberId) {
    const sheet = ensureSheet();
    const backdrop = document.querySelector("#demoApplePayBackdrop");
    const body = document.querySelector("#demoPayBody");
    backdrop.hidden = false;
    sheet.hidden = false;
    body.innerHTML = `
      <div class="demo-pay-merchant"><span>Barford Golf Society</span><strong>${escapeHtml(money(price))}</strong></div>
      <div class="demo-pay-event"><small>EVENT</small><strong id="demoPayTitle">${escapeHtml(eventName)}</strong></div>
      <div class="demo-pay-card"><span class="demo-card-chip"></span><div><small>PAY WITH</small><strong>Apple Pay</strong><span>•••• 2027</span></div></div>
      <button id="demoPayConfirm" class="demo-pay-confirm" type="button"><span>Double Click to Pay</span><b> Pay</b></button>
      <button id="demoPayCancel" class="demo-pay-cancel" type="button">Cancel</button>
      <p class="demo-pay-note">Presentation demo — no real payment is taken.</p>`;
    document.querySelector("#demoPayCancel")?.addEventListener("click", close, {once:true});
    backdrop.addEventListener("click", close, {once:true});
    document.querySelector("#demoPayConfirm")?.addEventListener("click", async () => {
      const confirm = document.querySelector("#demoPayConfirm");
      confirm.disabled = true;
      confirm.innerHTML = `<span class="demo-pay-spinner"></span><span>Processing…</span>`;
      await new Promise(r => setTimeout(r, 900));
      const {error} = await client.from("rsvps").update({payment_status:"paid",updated_at:new Date().toISOString()}).eq("event_id",eventId).eq("member_id",memberId);
      if (error) {
        confirm.disabled = false;
        confirm.textContent = "Try again";
        return;
      }
      body.innerHTML = `<div class="demo-pay-success"><div class="demo-pay-tick">✓</div><h2>Payment Confirmed</h2><p>You’ve paid <strong>${escapeHtml(money(price))}</strong> for</p><h3>${escapeHtml(eventName)}</h3><small>Demo payment — no money was charged.</small><button id="demoPayDone" class="demo-pay-done" type="button">Done</button></div>`;
      document.querySelector("#demoPayDone")?.addEventListener("click", () => { close(); decorate(); }, {once:true});
    }, {once:true});
  }

  async function decorate() {
    const {data:{session}} = await client.auth.getSession();
    if (!session) return;
    const cards = [...document.querySelectorAll(".compact-event-card")];
    for (const card of cards) {
      const rsvpButton = card.querySelector('[data-event-rsvp="playing"]');
      const state = card.querySelector(".event-member-state.playing");
      if (!rsvpButton || !state || state.querySelector("[data-demo-pay]")) continue;
      const eventId = rsvpButton.dataset.eventId;
      const [{data:rsvp},{data:event}] = await Promise.all([
        client.from("rsvps").select("payment_status").eq("event_id",eventId).eq("member_id",session.user.id).maybeSingle(),
        client.from("events").select("name,price").eq("id",eventId).maybeSingle()
      ]);
      if (!event) continue;
      if (rsvp?.payment_status === "paid") {
        state.insertAdjacentHTML("beforeend", `<div class="demo-paid-badge">✓ Paid for ${escapeHtml(event.name)}</div>`);
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button demo-apple-pay-button";
        button.dataset.demoPay = eventId;
        button.innerHTML = `<span>Pay ${escapeHtml(money(event.price))}</span><strong> Pay</strong>`;
        button.addEventListener("click", () => openPayment(eventId,event.name,event.price,session.user.id));
        state.appendChild(button);
      }
    }
  }

  const observer = new MutationObserver(() => { clearTimeout(window.__barfordDemoPayTimer); window.__barfordDemoPayTimer=setTimeout(decorate,100); });
  window.addEventListener("DOMContentLoaded", () => {
    const list=document.querySelector("#eventList");
    if(list) observer.observe(list,{childList:true,subtree:true});
    setTimeout(decorate,300);
  });
})();
