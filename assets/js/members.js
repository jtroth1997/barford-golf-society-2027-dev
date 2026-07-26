
(() => {
  "use strict";

  const ACCOUNT_KEY = "bgs-2027-member-account";
  const SESSION_KEY = "bgs-2027-member-session";

  const loggedOutView = document.querySelector("#loggedOutView");
  const loggedInView = document.querySelector("#loggedInView");

  const readAccount = () => {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"); }
    catch { return null; }
  };

  const saveAccount = account => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    localStorage.setItem("bgs-2027-member-profile", JSON.stringify({
      name: account.name,
      email: account.email,
      phone: account.phone
    }));
  };

  const isLoggedIn = () => sessionStorage.getItem(SESSION_KEY) === "yes";

  const initials = name => String(name || "BG")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");

  const render = () => {
    const account = readAccount();
    const loggedIn = Boolean(account && isLoggedIn());

    loggedOutView.classList.toggle("hidden", loggedIn);
    loggedInView.classList.toggle("hidden", !loggedIn);

    if (!loggedIn) return;

    document.querySelector("#welcomeHeading").textContent = `Welcome, ${account.name.split(" ")[0]}`;
    document.querySelector("#memberName").textContent = account.name;
    document.querySelector("#memberEmail").textContent = account.email;
    document.querySelector("#memberPhone").textContent = account.phone;
    document.querySelector("#memberInitials").textContent = initials(account.name);
    document.querySelector("#profileName").value = account.name;
    document.querySelector("#profileEmail").value = account.email;
    document.querySelector("#profilePhone").value = account.phone;
  };

  document.querySelector("#registerForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const account = {
      name: document.querySelector("#registerName").value.trim(),
      email: document.querySelector("#registerEmail").value.trim().toLowerCase(),
      phone: document.querySelector("#registerPhone").value.trim(),
      password: document.querySelector("#registerPassword").value
    };

    saveAccount(account);
    sessionStorage.setItem(SESSION_KEY, "yes");
    document.querySelector("#registerStatus").textContent = "Account created.";
    render();
  });

  document.querySelector("#loginForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const account = readAccount();
    const email = document.querySelector("#loginEmail").value.trim().toLowerCase();
    const password = document.querySelector("#loginPassword").value;
    const status = document.querySelector("#loginStatus");

    if (!account || account.email !== email || account.password !== password) {
      status.textContent = "Email or password not recognised.";
      return;
    }

    sessionStorage.setItem(SESSION_KEY, "yes");
    status.textContent = "";
    render();
  });

  document.querySelector("#profileForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const account = readAccount();
    if (!account) return;

    account.name = document.querySelector("#profileName").value.trim();
    account.email = document.querySelector("#profileEmail").value.trim().toLowerCase();
    account.phone = document.querySelector("#profilePhone").value.trim();
    saveAccount(account);

    document.querySelector("#profileStatus").textContent = "Details updated.";
    render();
  });

  document.querySelector("#logoutButton")?.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    render();
  });

  render();
})();
