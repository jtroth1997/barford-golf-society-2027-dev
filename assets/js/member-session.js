(() => {
  "use strict";

  const ACCOUNT_KEY = "bgs-2027-member-account";
  const SESSION_KEY = "bgs-2027-member-persistent-session";
  const LEGACY_SESSION_KEY = "bgs-2027-member-session";

  const demoAccount = {
    name: "Jack Troth",
    email: "jack@example.com",
    phone: "07123 456789",
    photo: ""
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

  const setAvatar = (element, account) => {
    if (!element) return;
    element.classList.toggle("has-photo", Boolean(account.photo));
    if (account.photo) {
      const image = document.createElement("img");
      image.src = account.photo;
      image.alt = "";
      element.replaceChildren(image);
    } else {
      element.textContent = initials(account.name);
    }
  };

  const resizePhoto = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That photo could not be opened."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Please choose a JPG, PNG or HEIC photo supported by your device."));
      image.onload = () => {
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - size) / 2;
        const sourceY = (image.naturalHeight - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = 480;
        canvas.getContext("2d").drawImage(image, sourceX, sourceY, size, size, 0, 0, 480, 480);
        resolve(canvas.toDataURL("image/jpeg", .82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  if (sessionStorage.getItem(LEGACY_SESSION_KEY) === "yes" && readAccount()) {
    localStorage.setItem(SESSION_KEY, "yes");
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  }

  const signupForm = document.querySelector("#memberSignupForm");
  const photoInput = document.querySelector("#signupPhoto");
  const photoPreview = document.querySelector("#signupPhotoPreview");
  const removePhotoButton = document.querySelector("#removeSignupPhoto");
  let selectedPhoto = "";

  photoInput?.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    const status = signupForm?.querySelector(".form-status");
    try {
      if (status) status.textContent = "Preparing your photo…";
      selectedPhoto = await resizePhoto(file);
      const image = document.createElement("img");
      image.src = selectedPhoto;
      image.alt = "Your selected profile photo";
      photoPreview?.replaceChildren(image);
      photoPreview?.classList.add("has-photo");
      removePhotoButton?.classList.remove("hidden");
      if (status) status.textContent = "";
    } catch (error) {
      selectedPhoto = "";
      if (status) status.textContent = error.message;
    }
  });

  removePhotoButton?.addEventListener("click", () => {
    selectedPhoto = "";
    if (photoInput) photoInput.value = "";
    photoPreview?.classList.remove("has-photo");
    if (photoPreview) photoPreview.innerHTML = "<span>+</span>";
    removePhotoButton.classList.add("hidden");
  });

  signupForm?.addEventListener("submit", event => {
    event.preventDefault();
    const account = {
      name: document.querySelector("#signupName").value.trim(),
      email: document.querySelector("#signupEmail").value.trim(),
      phone: document.querySelector("#signupPhone").value.trim(),
      photo: selectedPhoto
    };
    try {
      remember(account);
      const status = signupForm.querySelector(".form-status");
      if (status) status.textContent = "Account created — opening your dashboard…";
      window.setTimeout(() => { window.location.href = "index.html"; }, 450);
    } catch {
      const status = signupForm.querySelector(".form-status");
      if (status) status.textContent = "The photo is too large for this preview. Please choose a different photo.";
    }
  });

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
      document.querySelector("#homeWelcome").textContent = `Welcome back, ${firstName}`;
      document.querySelector("#homeMemberName").textContent = account.name;
      setAvatar(document.querySelector("#homeInitials"), account);
      setAvatar(document.querySelector("#fourballInitials"), account);
      document.querySelector("#fourballMemberName").textContent = account.name;
      document.title = "Dashboard | Barford Golf Society";
    }
  }

  document.querySelector("#memberSignOut")?.addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  });
})();