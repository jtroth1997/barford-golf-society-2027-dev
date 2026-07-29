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

  const renderProfilePhoto = async (element, profile) => {
    if (!element) return;
    setAvatar(element, profile);
    element.classList.remove("has-photo");
    if (!profile?.photo_url) return;
    const { data } = await client.storage.from("profile-images").createSignedUrl(profile.photo_url, 3600);
    if (!data?.signedUrl) return;
    element.innerHTML = `<img src="${data.signedUrl}" alt="">`;
    element.classList.add("has-photo");
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
    const usePasskey = $("#signupUsePasskey")?.checked !== false;

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

    localStorage.setItem("barford-login-email", email);
    sessionStorage.setItem("barford-first-login", "1");
    sessionStorage.setItem("barford-use-passkey", usePasskey ? "1" : "0");
    if (data.session) await client.auth.signOut();
    window.location.href = "account.html?account=created";
  });

  const loginForm = $("#accountLoginForm");
  const passkeyChoice = $("#loginUsePasskey");
  const passwordLoginButton = $("#accountPasswordLoginButton");
  const updateLoginButton = () => {
    if (passwordLoginButton) passwordLoginButton.textContent = passkeyChoice?.checked ? "Sign in and set up Face ID" : "Sign in";
  };
  passkeyChoice?.addEventListener("change", updateLoginButton);
  updateLoginButton();

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
      updateLoginButton();
      return;
    }
    if (passkeyChoice?.checked) {
      button.textContent = "Confirm on your device…";
      try {
        await window.BarfordPasskeys.register();
        localStorage.setItem("barford-passkey-offered", "complete");
      } catch (passkeyError) {
        message("#accountLoginStatus", passkeyError.name === "NotAllowedError"
          ? "Face ID setup was cancelled. You are still signed in and can set it up later."
          : `You are signed in. Device setup was not completed: ${passkeyError.message}`, true);
        await new Promise(resolve => setTimeout(resolve, 1400));
      }
    }
    sessionStorage.removeItem("barford-first-login");
    sessionStorage.removeItem("barford-use-passkey");
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
      window.location.href = "index.html";
    } catch (error) {
      message("#accountLoginStatus", error.name === "NotAllowedError" ? "Device sign-in was cancelled." : error.message, true);
      button.disabled = false;
      button.innerHTML = '<span aria-hidden="true">⌁</span> Sign in with Face ID or device';
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
    if (!session) {
      const firstLogin = sessionStorage.getItem("barford-first-login") === "1" ||
        new URLSearchParams(window.location.search).get("account") === "created";
      const savedEmail = localStorage.getItem("barford-login-email");
      if (savedEmail && $("#accountLoginEmail")) $("#accountLoginEmail").value = savedEmail;
      if (firstLogin) {
        $("#accountLoginHeading").textContent = "Account created — secure your login";
        $("#accountLoginIntro").textContent = "Enter your email and password once. Face ID or device sign-in is already selected for the quickest future login.";
        if (passkeyChoice) passkeyChoice.checked = sessionStorage.getItem("barford-use-passkey") !== "0";
        updateLoginButton();
        $("#accountLoginPassword")?.focus();
      }
      return;
    }

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
    await Promise.all([
      renderProfilePhoto($("#accountHeroAvatar"), profile),
      renderProfilePhoto($("#accountPhotoPreview"), profile)
    ]);
    $("#removeAccountPhoto")?.classList.toggle("hidden", !profile.photo_url);
    $("#accountPhotoInput").dataset.currentPath = profile.photo_url || "";
  };

  $("#accountPhotoInput")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      message("#accountPhotoStatus", "Please choose a JPG, PNG or WebP image.", true);
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message("#accountPhotoStatus", "That photo is larger than 5 MB. Please choose a smaller one.", true);
      event.target.value = "";
      return;
    }
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    message("#accountPhotoStatus", "Uploading your photo…");
    const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${user.id}/profile-${Date.now()}.${extension}`;
    const oldPath = event.target.dataset.currentPath;
    const { error: uploadError } = await client.storage.from("profile-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
    if (uploadError) {
      message("#accountPhotoStatus", uploadError.message, true);
      return;
    }
    const { error: profileError } = await client.from("profiles")
      .update({ photo_url: path, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (profileError) {
      await client.storage.from("profile-images").remove([path]);
      message("#accountPhotoStatus", profileError.message, true);
      return;
    }
    if (oldPath) await client.storage.from("profile-images").remove([oldPath]);
    const profile = { full_name: $("#accountName").value, photo_url: path };
    await Promise.all([
      renderProfilePhoto($("#accountHeroAvatar"), profile),
      renderProfilePhoto($("#accountPhotoPreview"), profile)
    ]);
    event.target.dataset.currentPath = path;
    $("#removeAccountPhoto")?.classList.remove("hidden");
    message("#accountPhotoStatus", "Profile photo saved.");
  });

  $("#removeAccountPhoto")?.addEventListener("click", async event => {
    const input = $("#accountPhotoInput");
    const path = input?.dataset.currentPath;
    const { data: { user } } = await client.auth.getUser();
    if (!user || !path) return;
    event.currentTarget.disabled = true;
    const { error } = await client.from("profiles")
      .update({ photo_url: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      message("#accountPhotoStatus", error.message, true);
      event.currentTarget.disabled = false;
      return;
    }
    await client.storage.from("profile-images").remove([path]);
    const profile = { full_name: $("#accountName").value };
    setAvatar($("#accountHeroAvatar"), profile);
    setAvatar($("#accountPhotoPreview"), profile);
    $("#accountHeroAvatar")?.classList.remove("has-photo");
    $("#accountPhotoPreview")?.classList.remove("has-photo");
    input.dataset.currentPath = "";
    event.currentTarget.classList.add("hidden");
    event.currentTarget.disabled = false;
    message("#accountPhotoStatus", "Profile photo removed.");
  });

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
