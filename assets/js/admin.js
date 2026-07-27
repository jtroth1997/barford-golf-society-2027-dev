(() => {
  "use strict";
  const SESSION = "bgs-2027-admin-preview-session";
  const login = document.querySelector("#adminLoginPanel");
  const dashboard = document.querySelector("#adminDashboard");
  const openDashboard = () => {
    localStorage.setItem(SESSION, "yes");
    login?.classList.add("hidden");
    dashboard?.classList.remove("hidden");
  };
  if (localStorage.getItem(SESSION) === "yes") openDashboard();
  document.querySelector("#adminLoginForm")?.addEventListener("submit", event => {
    event.preventDefault();
    openDashboard();
  });
  document.querySelector("#adminSignOut")?.addEventListener("click", () => {
    localStorage.removeItem(SESSION);
    location.reload();
  });
  document.querySelector("#createAdminInvite")?.addEventListener("click", () => {
    const token = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const link = new URL("admin-invite.html", location.href);
    link.searchParams.set("invite", token);
    document.querySelector("#adminInviteLink").value = link.href;
    document.querySelector("#inviteResult").classList.remove("hidden");
  });
  document.querySelector("#copyAdminInvite")?.addEventListener("click", async event => {
    const input = document.querySelector("#adminInviteLink");
    try { await navigator.clipboard.writeText(input.value); }
    catch { input.select(); document.execCommand("copy"); }
    event.currentTarget.textContent = "Copied ✓";
  });
  document.querySelectorAll(".demo-admin-action,.admin-more").forEach(button => button.addEventListener("click", () => alert("This control will become active when secure Supabase admin accounts are connected.")));
  document.querySelector("#adminInviteForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const password = document.querySelector("#invitePassword").value;
    const confirm = document.querySelector("#invitePasswordConfirm").value;
    const status = document.querySelector("#inviteFormStatus");
    if (password !== confirm) { status.textContent = "The passwords do not match."; return; }
    status.textContent = "Admin account created — opening the control centre…";
    localStorage.setItem(SESSION, "yes");
    setTimeout(() => { location.href = "admin.html"; }, 550);
  });
})();
