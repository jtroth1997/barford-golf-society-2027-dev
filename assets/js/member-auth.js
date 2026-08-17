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

  const isIPhone = /iPhone|iPod/i.test(navigator.userAgent);
  const faceIdReady = () => localStorage.getItem("barford-passkey-offered") === "complete";

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const friendlyDate = value => value
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
      .format(new Date(`${value}T12:00:00`))
    : "Date not announced";

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
    element.dataset.profilePhoto = data.signedUrl;
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", `View ${profile.full_name || "member"} profile photo`);
  };

  const signupForm = $("#memberSignupForm");
  const signupNameSelect = $("#signupName");
  const signupNewNameWrap = $("#signupNewNameWrap");
  const signupNewName = $("#signupNewName");

  const loadSignupNames = async () => {
    if (!signupNameSelect) return;
    const { data, error } = await client.functions.invoke("legacy-2026-stats", { body: { action: "roster" } });
    const names = !error && Array.isArray(data?.players) ? data.players : [];
    signupNameSelect.innerHTML = '<option value="">Select your name…</option>' +
      names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("") +
      '<option value="__new__">My name isn’t listed / I’m a new member</option>';
    if (error) message("#signupStatus", "We could not load the member list. Choose ‘My name isn’t listed’ to continue.", true);
  };
  signupNameSelect?.addEventListener("change", () => {
    const isNew = signupNameSelect.value === "__new__";
    signupNewNameWrap?.classList.toggle("hidden", !isNew);
    if (signupNewName) signupNewName.required = isNew;
    if (isNew) signupNewName?.focus();
  });
  loadSignupNames();

  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const ids = String(button.dataset.passwordToggle || "").split(",").map(value => value.trim()).filter(Boolean);
      const fields = ids.map(id => document.getElementById(id)).filter(Boolean);
      const show = fields.some(field => field.type === "password");
      fields.forEach(field => { field.type = show ? "text" : "password"; });
      button.textContent = show ? "Hide password" : "Show password";
      button.setAttribute("aria-pressed", String(show));
    });
  });

  signupForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const button = signupForm.querySelector("button[type=submit]");
    const selectedName = signupNameSelect?.value || "";
    const fullName = selectedName === "__new__" ? signupNewName?.value.trim() : selectedName.trim();
    const email = $("#signupEmail").value.trim().toLowerCase();
    const phone = $("#signupPhone").value.trim();
    const playingCategory = $("#signupPlayingCategory").value;
    const password = $("#signupPassword").value;
    const confirmation = $("#signupPasswordConfirm").value;

    if (!fullName) {
      message("#signupStatus", "Please select your name, or choose the new member option.", true);
      return;
    }
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
      options: { data: { full_name: fullName, phone, playing_category: playingCategory } }
    });
    if (error) {
      message("#signupStatus", error.message, true);
      button.disabled = false;
      button.textContent = "Create my account";
      return;
    }

    localStorage.setItem("barford-login-email", email);
    sessionStorage.setItem("barford-first-login", "1");
    if (data.session) await client.auth.signOut();
    window.location.href = "account.html?account=created";
  });

  const loginForm = $("#accountLoginForm");
  const passwordLoginButton = $("#accountPasswordLoginButton");
  const resetLoginButton = () => {
    if (passwordLoginButton) passwordLoginButton.textContent = "Sign in";
  };

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
      resetLoginButton();
      return;
    }
    if (isIPhone && window.BarfordPasskeys?.supported && !faceIdReady()) {
      button.textContent = "Set up Face ID…";
      try {
        await window.BarfordPasskeys.register();
        localStorage.setItem("barford-passkey-offered", "complete");
      } catch (passkeyError) {
        if (passkeyError.name !== "NotAllowedError") {
          console.warn("Face ID setup was not completed.", passkeyError);
        }
      }
    }
    sessionStorage.removeItem("barford-first-login");
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
      button.innerHTML = '<span aria-hidden="true">⌁</span> Sign in with Face ID';
    }
  });

  const loadMemberScores = async memberId => {
    const list = $("#accountRoundList");
    if (!list) return;
    const { data, error } = await client
      .from("scores")
      .select("points,handicap_used,next_handicap,dnp,winner,runner_up,third_place,nearest_pin,longest_drive,rounds(round_number,name,played_on,events(name,venue,event_date))")
      .eq("member_id", memberId);

    if (error) {
      message("#accountScoresStatus", "Your scores could not be loaded. Please refresh the page.", true);
      return;
    }

    const scores = (data || []).sort((a, b) =>
      Number(a.rounds?.round_number || 0) - Number(b.rounds?.round_number || 0));
    const played = scores.filter(score => !score.dnp && Number.isFinite(Number(score.points)));
    const best = played.length ? Math.max(...played.map(score => Number(score.points))) : null;
    const average = played.length
      ? (played.reduce((total, score) => total + Number(score.points), 0) / played.length).toFixed(1)
      : null;
    const latestHandicap = [...scores].reverse().find(score => score.next_handicap != null)?.next_handicap;

    $("#accountRoundsPlayed").textContent = String(played.length);
    $("#accountAveragePoints").textContent = average ?? "N/A";
    $("#accountBestPoints").textContent = best ?? "N/A";
    $("#accountCurrentHandicap").textContent = latestHandicap ?? ($("#accountHandicap")?.value || "N/A");

    if (!scores.length) {
      list.innerHTML = '<p class="account-round-empty">Your round-by-round scores will appear here when results are published.</p>';
      return;
    }

    list.innerHTML = scores.map(score => {
      const round = score.rounds || {};
      const event = round.events || {};
      const honours = [
        score.winner ? "Winner" : "",
        score.runner_up ? "Runner-up" : "",
        score.third_place ? "Third" : "",
        score.nearest_pin ? "Nearest pin" : "",
        score.longest_drive ? "Longest drive" : ""
      ].filter(Boolean);
      return `<article class="account-round-row">
        <div class="account-round-number">R${escapeHtml(round.round_number || "—")}</div>
        <div class="account-round-course">
          <strong>${escapeHtml(event.name || round.name || "Society round")}</strong>
          <small>${escapeHtml(friendlyDate(event.event_date || round.played_on))}${event.venue ? ` · ${escapeHtml(event.venue)}` : ""}</small>
          ${honours.length ? `<span class="account-round-honours">${honours.map(item => `<b>${escapeHtml(item)}</b>`).join("")}</span>` : ""}
        </div>
        <div class="account-round-score">
          <strong>${score.dnp ? "DNP" : score.points ?? "—"}</strong>
          <span>${score.dnp ? "Did not play" : "Points"}</span>
        </div>
        <div class="account-round-handicap">
          <strong>${score.handicap_used ?? "—"}</strong>
          <span>Handicap</span>
        </div>
      </article>`;
    }).join("");
  };

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
      const showFaceId = isIPhone && window.BarfordPasskeys?.supported && faceIdReady();
      $("#accountPasskeyLogin")?.classList.toggle("hidden", !showFaceId);
      $("#accountLoginDivider")?.classList.toggle("hidden", !showFaceId);
      const savedEmail = localStorage.getItem("barford-login-email");
      if (savedEmail && $("#accountLoginEmail")) $("#accountLoginEmail").value = savedEmail;
      if (firstLogin) {
        $("#accountLoginHeading").textContent = "Account created — sign in";
        $("#accountLoginIntro").textContent = isIPhone
          ? "Enter your email and password once. Your iPhone will then ask whether to set up Face ID for future logins."
          : "Enter your email and password to open your account.";
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
    $("#accountPlayingCategory").value = profile.playing_category || "";
    await Promise.all([
      renderProfilePhoto($("#accountHeroAvatar"), profile),
      renderProfilePhoto($("#accountPhotoPreview"), profile),
      loadMemberScores(session.user.id)
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
    if (!confirm("Remove your profile photo?\n\nYou can add another photo at any time.")) return;
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
      playing_category: $("#accountPlayingCategory").value,
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
