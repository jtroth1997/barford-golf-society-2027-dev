
const menuButton=document.querySelector(".menu-button");const nav=document.querySelector("#primary-navigation");
if(menuButton&&nav){menuButton.addEventListener("click",()=>{const open=nav.classList.toggle("is-open");menuButton.setAttribute("aria-expanded",String(open))})}
const year=document.querySelector("#year");if(year)year.textContent=new Date().getFullYear();
document.querySelectorAll(".admin-toggle").forEach(btn=>btn.addEventListener("click",()=>{const panel=document.getElementById(btn.dataset.target);if(panel)panel.classList.toggle("hidden")}));
document.querySelectorAll(".demo-form").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const status=form.querySelector(".form-status");if(status)status.textContent="Demo only — nothing has been sent or saved."}));
document.querySelectorAll(".demo-action").forEach(btn=>btn.addEventListener("click",()=>alert("Demo only — this action is not connected to live data.")));
const installBtn=document.querySelector("#installHelpBtn");const installHelp=document.querySelector("#installHelp");if(installBtn&&installHelp)installBtn.addEventListener("click",()=>installHelp.classList.toggle("hidden"));
let basketCount=0,basketTotal=0;const prices=[12,18,15];
document.querySelectorAll(".add-to-basket").forEach((btn,i)=>btn.addEventListener("click",()=>{basketCount++;basketTotal+=prices[i]||0;document.querySelector("#basketCount").textContent=basketCount;document.querySelector("#basketSummary").textContent=`${basketCount} item${basketCount===1?"":"s"} in your demo basket.`;document.querySelector("#basketTotal").textContent=`£${basketTotal.toFixed(2)}`;}));
const basketBtn=document.querySelector("#basketBtn"),basketPanel=document.querySelector("#basketPanel");if(basketBtn&&basketPanel)basketBtn.addEventListener("click",()=>basketPanel.classList.toggle("hidden"));
