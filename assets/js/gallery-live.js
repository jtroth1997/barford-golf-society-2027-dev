(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const config = window.BARFORD_2027_CONFIG;
  const grid = document.querySelector("#galleryGrid");
  const count = document.querySelector("#galleryCount");
  const form = document.querySelector("#galleryUploadForm");
  const note = document.querySelector("#galleryLoginNote");
  const status = document.querySelector("#galleryUploadStatus");
  const lightbox = document.querySelector("#galleryLightbox");
  const lightboxImage = document.querySelector("#galleryLightboxImage");
  const legacyPhotos = Array.from({ length: 26 }, (_, index) => ({
    url: `assets/images/gallery-2026/legacy-${String(index + 1).padStart(2, "0")}.webp`,
    caption: "Barford Golf Society 2026 photograph"
  }));
  const showStatus = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle("error", error);
  };
  const loadGallery = async () => {
    const { data, error } = await client.from("gallery_photos")
      .select("id,storage_path,caption,taken_at,created_at").eq("approved", true)
      .order("created_at", { ascending: false });

    const currentPhotos = error ? [] : (data || []).map(photo => ({
      url: client.storage.from(config.galleryBucket).getPublicUrl(photo.storage_path).data.publicUrl,
      caption: photo.caption || "Barford Golf Society photograph"
    }));
    const photos = [...currentPhotos, ...legacyPhotos];

    count.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
    if (!photos.length) {
      grid.innerHTML = '<div class="empty-state"><strong>No photos yet</strong><span>New society photos will appear here.</span></div>';
      return;
    }

    grid.innerHTML = "";
    photos.forEach((photo, index) => {
      const button = document.createElement("button");
      button.className = "gallery-live-photo";
      button.type = "button";
      const image = document.createElement("img");
      image.loading = index < 4 ? "eager" : "lazy";
      image.decoding = "async";
      image.src = photo.url;
      image.alt = photo.caption;
      button.append(image);
      button.addEventListener("click", () => {
        lightboxImage.src = photo.url;
        lightboxImage.alt = image.alt;
        lightbox.showModal();
      });
      grid.append(button);
    });
  };
  const initialise = async () => {
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    form.classList.toggle("hidden", !session);
    note.textContent = session ? "Choose one or more images to add to the society gallery." : "Sign in to upload photographs.";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const files = [...document.querySelector("#galleryFiles").files];
      if (!files.length || !session) return;
      const button = form.querySelector("button");
      button.disabled = true;
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        showStatus(`Uploading ${index + 1} of ${files.length}…`);
        const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from(config.galleryBucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) { showStatus(uploadError.message, true); button.disabled = false; return; }
        const { error: recordError } = await client.from("gallery_photos").insert({
          storage_path: path, uploaded_by: session.user.id, approved: true
        });
        if (recordError) { showStatus(recordError.message, true); button.disabled = false; return; }
      }
      form.reset();
      button.disabled = false;
      showStatus("Your photos have been added.");
      loadGallery();
    });
    loadGallery();
  };
  initialise();
})();
