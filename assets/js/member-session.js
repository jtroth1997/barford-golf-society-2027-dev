(() => {
  "use strict";

  const ACCOUNT_KEY = "bgs-2027-member-account";
  const SESSION_KEY = "bgs-2027-member-persistent-session";
  const LEGACY_SESSION_KEY = "bgs-2027-member-session";

  const demoAccount = {
    name: "Jack Troth",
    email: "jack@example.com",
    phone: "07123 456789"
  };

  const readAccount = () => {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"); }
    catch { return null; }
  };

  const initials = name => String(name || "BG").split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part.charAt(0).toUpperCase()).join("");

  const remember = account => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    localStorage.setItem(SESSION_KEY, "yes");
  };

  if (sessionStorage.getItem(LEGACY_SESSION_KEY) === "yes" && readAccount()) {
    localStorage.setItem(SESSION_KEY, "yes");
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  }

  const previewButton = document.querySelector("#rememberMemberDevice");
  previewButton?.addEventListener("click", () => {
    const account = readAccount() || demoAccount;
    remember(account);
    window.location.href = "index.html";
  });

  const dashboard = document.querySelector("#memberHomeDashboard");
  const publicHome = document.querySelector("#publicHome");
  const account = readAccount();
  const signedIn = localStorage.getItem(SESSION_KEY) === "yes" && Boolean(account);

  if (dashboard && publicHome) {
    dashboard.classList.toggle("hidden", !signedIn);
    publicHome.classList.toggle("hidden", signedIn);

    if (signedIn) {
      const firstName = account.name.split(/\s+/)[0] || "Member";
      const memberInitials = initials(account.name);
      document.querySelector("#homeWelcome").textContent = `Welcome back, ${firstName}`;
      document.querySelector("#homeMemberName").textContent = account.name;
      document.querySelector("#homeInitials").textContent = memberInitials;
      document.querySelector("#fourballInitials").textContent = memberInitials;
      document.querySelector("#fourballMemberName").textContent = account.name;
      document.title = `Dashboard | Barford Golf Society`;
    }
  }

  document.querySelector("#memberSignOut")?.addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  });
})();