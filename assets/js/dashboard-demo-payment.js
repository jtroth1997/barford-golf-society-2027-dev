(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;
  const list = document.getElementById("dashboardPaymentList");
  if (!list) return;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const money = value => Number.isFinite(Number(value)) ? `£${Number(value).toFixed(2)}` : "Amount TBC";
  let busy = false;

  const ensureSheet = () => {
    let sheet = document.getElementById("demoApplePaySheet");
    if (sheet) return sheet;
    document.body.insertAdjacentHTML("beforeend", `<div id="demoApplePayBackdrop" class="demo-pay-backdrop" hidden></div><section id="demoApplePaySheet" class="demo-pay-sheet" hidden aria-modal="true" role="dialog" aria-labelledby="demoPayTitle"><div class="demo-pay-grabber"></div><div class="demo-pay-brand"> Pay</div><div id="demoPayBody"></div></section>`);
    return document.getElementById("demoApplePaySheet");
  };
  const close = () => { const s=document.getElementById("demoApplePaySheet"),b=document.getElementById("demoApplePayBackdrop"); if(s)s.hidden=true;if(b)b.hidden=true; };
  const showPaidOnce = (eventName, price) => {
    list.innerHTML = `<div class="dashboard-good dashboard-payment-confirmation"><span>✓</span><div><strong>Payment confirmed</strong><small>${escapeHtml(money(price))} paid for ${escapeHtml(eventName)}.</small></div></div>`;
    const count=document.getElementById("dashboardPaymentCount"); if(count) count.textContent="0";
  };
  const openPayment = async (eventId,eventName,price,memberId) => {
    if (busy) return; busy=true;
    const sheet=ensureSheet(),backdrop=document.getElementById("demoApplePayBackdrop"),body=document.getElementById("demoPayBody");
    backdrop.hidden=false;sheet.hidden=false;
    body.innerHTML=`<div class="demo-pay-merchant"><span>Barford Golf Society</span><strong>${escapeHtml(money(price))}</strong></div><div class="demo-pay-event"><small>EVENT</small><strong id="demoPayTitle">${escapeHtml(eventName)}</strong></div><div class="demo-pay-card"><span class="demo-card-chip"></span><div><small>PAY WITH</small><strong>Apple Pay</strong><span>•••• 2027</span></div></div><button id="demoPayConfirm" class="demo-pay-confirm" type="button"><span>Double Click to Pay</span><b> Pay</b></button><button id="demoPayCancel" class="demo-pay-cancel" type="button">Cancel</button><p class="demo-pay-note">Presentation demo — no real payment is taken.</p>`;
    const cancel=()=>{busy=false;close();}; document.getElementById("demoPayCancel")?.addEventListener("click",cancel,{once:true});
    document.getElementById("demoPayConfirm")?.addEventListener("click",async()=>{
      const button=document.getElementById("demoPayConfirm");button.disabled=true;button.innerHTML='<span class="demo-pay-spinner"></span><span>Processing…</span>';
      await new Promise(r=>setTimeout(r,800));
      const {error}=await client.from("rsvps").update({payment_status:"paid",updated_at:new Date().toISOString()}).eq("event_id",eventId).eq("member_id",memberId);
      if(error){button.disabled=false;button.textContent="Try again";busy=false;return;}
      body.innerHTML=`<div class="demo-pay-success"><div class="demo-pay-tick">✓</div><h2>Payment Confirmed</h2><p>You’ve paid <strong>${escapeHtml(money(price))}</strong> for</p><h3>${escapeHtml(eventName)}</h3><small>Demo payment — no money was charged.</small><button id="demoPayDone" class="demo-pay-done" type="button">Done</button></div>`;
      document.getElementById("demoPayDone")?.addEventListener("click",()=>{close();showPaidOnce(eventName,price);busy=false;},{once:true});
    },{once:true});
  };

  const wire = async () => {
    const {data:{session}}=await client.auth.getSession(); if(!session)return;
    const links=[...list.querySelectorAll('a[href^="payments.html?event="]')];
    for(const link of links){
      if(link.dataset.dashboardPayWired)return;
      const eventId=new URL(link.href,location.href).searchParams.get("event"); if(!eventId)continue;
      const {data:event}=await client.from("events").select("name,price").eq("id",eventId).maybeSingle(); if(!event)continue;
      link.dataset.dashboardPayWired="1";link.href="#";link.textContent=`Pay ${money(event.price)} ·  Pay`;
      link.addEventListener("click",e=>{e.preventDefault();openPayment(eventId,event.name,event.price,session.user.id);});
    }
  };
  let timer; const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(wire,80);}); observer.observe(list,{childList:true,subtree:true});
  window.addEventListener("DOMContentLoaded",()=>setTimeout(wire,250),{once:true});
})();