(() => {
  "use strict";
  const backdrop = document.querySelector("#homePhotoBackdrop");
  if (!backdrop) return;
  const layers = [...backdrop.querySelectorAll("span")];
  const legacyPhotos = Array.from({ length: 26 }, (_, index) =>
    `assets/images/gallery-2026/legacy-${String(index + 1).padStart(2, "0")}.webp`
  );
  const shuffle = values => {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled;
  };
  const lastPhotoKey = "barford-home-background-photo";
  let photos = shuffle(legacyPhotos);
  let photoIndex = 0;
  let layerIndex = 0;
  const avoidLastPhoto = () => {
    let lastPhoto = "";
    try { lastPhoto = localStorage.getItem(lastPhotoKey) || ""; } catch {}
    if (photos.length > 1 && photos[0] === lastPhoto) {
      [photos[0], photos[1]] = [photos[1], photos[0]];
    }
  };
  const nextPhoto = () => {
    if (!photos.length || !layers.length) return;
    const layer = layers[layerIndex];
    const photo = photos[photoIndex];
    layer.style.backgroundImage = `url("${photo}")`;
    layers.forEach(item => item.classList.toggle("active", item === layer));
    try { localStorage.setItem(lastPhotoKey, photo); } catch {}
    photoIndex = (photoIndex + 1) % photos.length;
    layerIndex = (layerIndex + 1) % layers.length;
  };
  avoidLastPhoto();
  nextPhoto();

  const includeNewGalleryPhotos = async () => {
    const client = window.BarfordSupabase;
    const config = window.BARFORD_2027_CONFIG;
    if (!client || !config?.galleryBucket) return;
    const { data, error } = await client.from("gallery_photos")
      .select("storage_path")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error || !data?.length) return;
    const uploadedPhotos = data.map(photo =>
      client.storage.from(config.galleryBucket).getPublicUrl(photo.storage_path).data.publicUrl
    ).filter(Boolean);
    const currentPhoto = photos[(photoIndex - 1 + photos.length) % photos.length];
    photos = shuffle([...new Set([...uploadedPhotos, ...legacyPhotos])])
      .filter(photo => photo !== currentPhoto);
    if (currentPhoto) photos.unshift(currentPhoto);
    photoIndex = Math.min(1, photos.length - 1);
  };
  includeNewGalleryPhotos();

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(nextPhoto, 14000);
  }
})();
