(() => {
  "use strict";

  const DB_NAME = "bgs-2027-gallery";
  const STORE = "eventPhotos";
  const EVENT_NAME = "Season Opener · The Belfry";
  let selectedFile = null;
  let previewUrl = null;

  const openDb = () => new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:"id",autoIncrement:true});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const savePhoto = async blob => {
    const db = await openDb();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).add({blob,createdAt:new Date().toISOString(),event:EVENT_NAME});
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  };

  const getPhotos = async () => {
    const db = await openDb();
    return new Promise((resolve,reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
      request.onerror = () => reject(request.error);
    });
  };

  const resizePhoto = file => new Promise((resolve,reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      const max = 1800;
      const scale = Math.min(1, max / Math.max(image.width,image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(source);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not prepare photo")), "image/jpeg", .86);
    };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("Could not read photo")); };
    image.src = source;
  });

  const localDate = () => {
    const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type,part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const cameraTab = document.querySelector("#eventDayCameraTab");
  const cameraInput = document.querySelector("#eventCameraInput");
  const dialog = document.querySelector("#photoReviewDialog");
  const preview = document.querySelector("#eventPhotoPreview");
  const status = document.querySelector("#photoSaveStatus");
  const confirm = document.querySelector("#confirmEventPhoto");
  const retake = document.querySelector("#retakeEventPhoto");
  const viewGallery = document.querySelector("#viewSavedPhoto");

  if (cameraTab) {
    const previewMode = new URLSearchParams(location.search).get("preview") === "event-day";
    const demoMode = document.body.classList.contains("demo-event-today");
    cameraTab.classList.toggle("hidden", !(demoMode || localDate() === cameraTab.dataset.eventDate || previewMode));
  }

  document.querySelector("#openEventCamera")?.addEventListener("click", () => cameraInput.click());

  cameraInput?.addEventListener("change", () => {
    selectedFile = cameraInput.files?.[0] || null;
    if (!selectedFile) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(selectedFile);
    preview.src = previewUrl;
    status.textContent = "";
    confirm.classList.remove("hidden");
    retake.classList.remove("hidden");
    viewGallery.classList.add("hidden");
    dialog.showModal();
  });

  retake?.addEventListener("click", () => {
    dialog.close();
    cameraInput.value = "";
    cameraInput.click();
  });

  confirm?.addEventListener("click", async () => {
    if (!selectedFile) return;
    confirm.disabled = true;
    status.textContent = "Adding photo to the gallery…";
    try {
      const blob = await resizePhoto(selectedFile);
      await savePhoto(blob);
      status.textContent = "Photo added to the gallery.";
      confirm.classList.add("hidden");
      retake.classList.add("hidden");
      viewGallery.classList.remove("hidden");
    } catch {
      status.textContent = "The photo could not be saved. Please try again.";
    } finally {
      confirm.disabled = false;
    }
  });

  const grid = document.querySelector("#eventDayGallery");
  if (grid) {
    getPhotos().then(photos => {
      const count = document.querySelector("#eventPhotoCount");
      count.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
      if (!photos.length) return;
      grid.innerHTML = photos.map(photo => {
        const url = URL.createObjectURL(photo.blob);
        const time = new Date(photo.createdAt).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"});
        return `<figure class="event-day-photo"><img src="${url}" alt="Member event-day photograph"><figcaption>${photo.event} · ${time}</figcaption></figure>`;
      }).join("");
    }).catch(() => {
      grid.innerHTML = '<div class="empty-state">Photos stored on this device could not be loaded.</div>';
    });
  }
})();
