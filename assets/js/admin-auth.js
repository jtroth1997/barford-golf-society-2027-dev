(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const login = document.querySelector("#adminLoginPanel");
  const dashboard = document.querySelector("#adminDashboard");
  const denied = document.querySelector("#adminDenied");
  const status = document.querySelector("#adminLoginStatus");

  const display = async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      login.classList.remove("hidden");
      dashboard.classList.add("hidden");
      denied.classList.add("hidden");
      return;
    }
    const { data: profile } = await client.from("profiles").select("is_admin").eq("id", session.user.id).single();
    login.classList.add("hidden");
    dashboard.classList.toggle("hidden", !profile?.is_admin);
    denied.classList.toggle("hidden", Boolean(profile?.is_admin));
  };

  document.querySelector("#adminLoginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const { error } = await client.auth.signInWithPassword({
      email: document.querySelector("#adminEmail").value.trim().toLowerCase(),
      password: document.querySelector("#adminPassword").value
    });
    if (error) { status.textContent = "Email or password not recognised."; return; }
    display();
  });

  document.querySelector("#adminSignOut")?.addEventListener("click", async () => {
    await client.auth.signOut();
    display();
  });
  if (client) display();
})();
