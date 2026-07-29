(() => {
  "use strict";

  const client = window.BarfordSupabase;
  const $ = selector => document.querySelector(selector);
  const message = (selector, text, isError = false) => {
    const element = $(selector);
    if (!element) return;
    element.textContent = text;
    element.classList.toggle("error", isError);
  };

  if (!client) {
    message(".form-status", "The secure account connection is unavailable. Please refresh the page.", true);
    return;
  }

  const initials = name => String(name || "BG").split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0].toUpperCase()).join("");

  const setAvatar = (element, profile) => {
    if (!element) return;
    element.textContent = initials(profile?.full_name);
  };

  const signupForm = $("#memberSignupForm");
  signupForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const button = signupForm.querySelector("button[type=submit]");
    const fullName = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim().toLowerCase();
    const phone = $("#signupPhone").value.trim();
    const password = $("#signupPassword").value;
    const confirmation = $("#signupPasswordConfirm").value;

    if (password !== confirmation) {
      message("#signupStatus", "Those passwords do not match. Please try again.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "Creating account…";
    message("#signupStatus", "");

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } }
    });

    if (error) {
      message("#signupStatus", error.message, true);
      button.disabled = false;
      button.textContent = "Create my account";
      return;
    }

    if (!data.session) {
      message("#signupStatus", "Your account was created, but automatic sign-in is not enabled yet.", true);
      button.disabled = false;
      button.textContent = "Create my account";
      return;
    }

    const dialog = $("#passkeySetupDialog");
    if (dialog && window.BarfordPasskeys?.supported) {
      button.textContent = "Account created";
      dialog.showModal();
      return;
    }
    window.location.href = "index.html";
  });

  $("#setupPasskeyAfterSignup")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Waiting for your device…";
    try {
      await window.BarfordPasskeys.register();
      message("#signupPasskeyStatus", "Device sign-in is ready.");
      window.setTimeout(() => { window.location.href = "index.html"; }, 650);
    } catch (error) {
      message("#signupPasskeyStatus", error.name === "NotAllowedError" ? "Setup was cancelled. You can add it later." : error.message, true);
      button.disabled = false;
      button.textContent = "Set up device sign-in";
    }
  });
  $("#skipPasskeyAfterSignup")?.addEventListener("click", () => { window.location.href = "index.html"; });

  const loginForm = $("#accountLoginForm");
  loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Signing in…";

    const { error } = await client.auth.signInWithPassword({
      email: $("#accountLoginEmail").value.trim().toLowerCase(),
      password: $("#accountLoginPassword").value
    });

    if (error) {
      message("#accountLoginStatus", "Email or password not recognised.", true);
      button.disabled = false;
      button.textContent = "Sign in";
      return;
    }
    window.location.href = "index.html";
  });

  $("#accountPasskeyLogin")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    if (!window.BarfordPasskeys?.supported) {
      message("#accountLoginStatus", "This browser does not support device sign-in. Please use email and password.", true);
      return;
    }
    button.disabled = true;
    button.textContent = "Waiting for your device…";
    try {
      await window.BarfordPasskeys.login();
      window.location.reload();
    } catch (error) {
      message("#accountLoginStatus", error.name === "NotAllowedError" ? "Device sign-in was cancelled." : error.message, true);
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">⌁</span> Use Face ID or device sign-in';
    }
  });

  $("#accountAddPasskey")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    if (!window.BarfordPasskeys?.supported) {
      message("#accountPasskeyStatus", "This browser does not support device sign-in.", true);
      return;
    }
    button.disabled = true;
    button.textContent = "Waiting for your device…";
    try {
      await window.BarfordPasskeys.register();
      message("#accountPasskeyStatus", "This device is ready for quick secure sign-in.");
      button.textContent = "Device added";
    } catch (error) {
      message("#accountPasskeyStatus", error.name === "NotAllowedError" ? "Setup was cancelled." : error.message, true);
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">⌁</span> Add this device';
    }
  });

  const loadAccount = async () => {
    const signedOut = $("#accountSignedOut");
    const content = $("#accountContent");
    if (!signedOut || !content) return;

    const { data: { session } } = await client.auth.getSession();
    signedOut.classList.toggle("hidden", Boolean(session));
    content.classList.toggle("hidden", !session);
    if (!session) return;

    const { data: profile, error } = await client
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error || !profile) {
      message("#accountSaveStatus", "Your profile could not be loaded. Please refresh.", true);
      return;
    }

    $("#accountHeroName").textContent = profile.full_name;
    $("#accountMemberNumber").textContent = `Member ${profile.id.slice(0, 8).toUpperCase()}`;
    $("#accountName").value = profile.full_name || "";
    $("#accountEmail").value = profile.email || "";
    $("#accountPhone").value = profile.phone || "";
    $("#accountHomeClub").value = profile.home_club || "";
    $("#accountHandicap").value = profile.handicap ?? "";
    $("#accountPreference").value = profile.playing_preference || "walker";
    setAvatar($("#accountHeroAvatar"), profile);
    setAvatar($("#accountPhotoPreview"), profile);
  };

  $("#accountProfileForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    const changes = {
      full_name: $("#accountName").value.trim(),
      phone: $("#accountPhone").value.trim() || null,
      home_club: $("#accountHomeClub").value.trim() || null,
      handicap: $("#accountHandicap").value || null,
      playing_preference: $("#accountPreference").value,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("profiles").update(changes).eq("id", user.id);
    if (error) {
      message("#accountSaveStatus", error.message, true);
      return;
    }
    $("#accountHeroName").textContent = changes.full_name;
    setAvatar($("#accountHeroAvatar"), changes);
    message("#accountSaveStatus", "Your changes have been saved.");
  });

  $("#accountSignOut")?.addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.reload();
  });

  loadAccount();
})();
