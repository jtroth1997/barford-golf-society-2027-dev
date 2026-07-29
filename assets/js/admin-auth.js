(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;

  const login = document.querySelector("#adminLoginPanel");
  const dashboard = document.querySelector("#adminDashboard");
  const denied = document.querySelector("#adminDenied");
  const status = document.querySelector("#adminLoginStatus");
  const dialog = document.querySelector("#adminAccessDialog");
  const confirmCheck = document.querySelector("#adminAccessConfirmCheck");
  const confirmButton = document.querySelector("#adminAccessConfirm");
  let signedInProfile;
  let pendingChange;

  const initials = name => String(name || "BG").split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0].toUpperCase()).join("");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const loadAccounts = async () => {
    const list = document.querySelector("#adminAccountList");
    const { data: accounts, error } = await client.from("profiles")
      .select("id,full_name,email,photo_url,is_admin,created_at")
      .order("full_name");
    if (error) {
      list.innerHTML = `<p class="form-status error">${error.message}</p>`;
      return;
    }
    document.querySelector("#adminAccountCount").textContent = `${accounts.length} account${accounts.length === 1 ? "" : "s"}`;
    list.innerHTML = accounts.map(account => `
      <article class="admin-account-row">
        <span class="admin-avatar">${escapeHtml(initials(account.full_name))}</span>
        <div class="admin-account-name"><strong>${escapeHtml(account.full_name)}</strong><small>${escapeHtml(account.email)}</small></div>
        <span class="status ${account.is_admin ? "active" : "member"}">${account.is_admin ? "Administrator" : "Member"}</span>
        <label class="admin-access-toggle">
          <input type="checkbox" data-admin-id="${escapeHtml(account.id)}" data-admin-name="${escapeHtml(account.full_name)}" ${account.is_admin ? "checked" : ""} ${account.id === signedInProfile.id ? "disabled" : ""}>
          <span>${account.is_admin ? "Admin access on" : "Give admin access"}</span>
        </label>
      </article>`).join("");
    list.querySelectorAll("[data-admin-id]").forEach(input => input.addEventListener("change", event => {
      const control = event.currentTarget;
      pendingChange = {
        id: control.dataset.adminId,
        name: control.dataset.adminName,
        grant: control.checked,
        control
      };
      control.checked = !control.checked;
      document.querySelector("#adminAccessTitle").textContent = pendingChange.grant
        ? `Give ${pendingChange.name} admin access?`
        : `Remove ${pendingChange.name}’s admin access?`;
      document.querySelector("#adminAccessMessage").textContent = pendingChange.grant
        ? `${pendingChange.name} will be able to view and edit all member, event, score, RSVP and payment information.`
        : `${pendingChange.name} will immediately lose access to the Admin page and all protected controls.`;
      document.querySelector("#adminAccessConfirmLabel").textContent = `I confirm I selected ${pendingChange.name}`;
      confirmCheck.checked = false;
      confirmButton.disabled = true;
      document.querySelector("#adminAccessDialogStatus").textContent = "";
      dialog.showModal();
    }));
  };

  confirmCheck?.addEventListener("change", () => {
    confirmButton.disabled = !confirmCheck.checked;
  });

  confirmButton?.addEventListener("click", async () => {
    if (!pendingChange || !confirmCheck.checked) return;
    confirmButton.disabled = true;
    confirmButton.textContent = "Saving…";
    const { error } = await client.rpc("set_member_admin_access", {
      target_user_id: pendingChange.id,
      grant_access: pendingChange.grant,
      confirmation_name: pendingChange.name
    });
    if (error) {
      document.querySelector("#adminAccessDialogStatus").textContent = error.message;
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirm change";
      return;
    }
    dialog.close();
    document.querySelector("#adminAccountStatus").textContent = pendingChange.grant
      ? `${pendingChange.name} now has administrator access.`
      : `${pendingChange.name}’s administrator access has been removed.`;
    confirmButton.textContent = "Confirm change";
    pendingChange = null;
    await loadAccounts();
  });

  const display = async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      login.classList.remove("hidden");
      dashboard.classList.add("hidden");
      denied.classList.add("hidden");
      return;
    }
    const { data: profile } = await client.from("profiles").select("id,full_name,is_admin").eq("id", session.user.id).single();
    signedInProfile = profile;
    login.classList.add("hidden");
    dashboard.classList.toggle("hidden", !profile?.is_admin);
    denied.classList.toggle("hidden", Boolean(profile?.is_admin));
    if (profile?.is_admin) await loadAccounts();
  };

  document.querySelector("#adminLoginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    status.textContent = "Signing in…";
    const { error } = await client.auth.signInWithPassword({
      email: document.querySelector("#adminEmail").value.trim().toLowerCase(),
      password: document.querySelector("#adminPassword").value
    });
    if (error) {
      status.textContent = "Email or password not recognised.";
      return;
    }
    status.textContent = "";
    await display();
  });

  document.querySelector("#adminSignOut")?.addEventListener("click", async () => {
    await client.auth.signOut();
    display();
  });
  display();
})();
