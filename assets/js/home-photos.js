(() => {
  "use strict";
  const backdrop = document.querySelector("#homePhotoBackdrop");
  if (!backdrop) return;
  const layers = [...backdrop.querySelectorAll("span")];
  const legacyPhotoNumbers = [1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
  const legacyPhotos = legacyPhotoNumbers.map(number =>
    `assets/images/gallery-2026/legacy-${String(number).padStart(2, "0")}.webp`
  );
  const fallbackFaceY = {
    1: 24, 2: 27, 4: 27, 6: 31, 7: 29, 8: 32, 9: 30, 10: 76, 11: 30, 12: 61,
    13: 29, 14: 27, 15: 46, 16: 42, 17: 48, 18: 28, 19: 27, 20: 27, 21: 28, 22: 27,
    23: 28, 24: 29, 25: 30, 26: 28
  };
  const focusCache = new Map();
  legacyPhotoNumbers.forEach(number => {
    const url = `assets/images/gallery-2026/legacy-${String(number).padStart(2, "0")}.webp`;
    focusCache.set(url, fallbackFaceY[number] || 32);
  });
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
  let faceDetector;
  try {
    if ("FaceDetector" in window) faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
  } catch {}
  const detectFaceFocus = async (layer, photo) => {
    const fallback = focusCache.get(photo) ?? 32;
    layer.style.setProperty("--photo-face-y", `${fallback}%`);
    if (!faceDetector) return;
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = photo;
      await image.decode();
      const faces = await faceDetector.detect(image);
      if (!faces.length || layer.dataset.photo !== photo) return;
      const centres = faces.map(face => face.boundingBox.y + (face.boundingBox.height / 2));
      const faceY = Math.max(14, Math.min(76, centres.reduce((sum, value) => sum + value, 0) / centres.length / image.naturalHeight * 100));
      focusCache.set(photo, faceY);
      layer.style.setProperty("--photo-face-y", `${faceY.toFixed(1)}%`);
    } catch {}
  };
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
    layer.dataset.photo = photo;
    layer.style.backgroundImage = `url("${photo}")`;
    detectFaceFocus(layer, photo);
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
    const currentPhoto = layers.find(layer => layer.classList.contains("active"))?.dataset.photo || "";
    photos = shuffle([...new Set([...uploadedPhotos, ...legacyPhotos])]).filter(photo => photo !== currentPhoto);
    if (currentPhoto) photos.unshift(currentPhoto);
    photoIndex = Math.min(1, photos.length - 1);
  };
  includeNewGalleryPhotos();

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(nextPhoto, 14000);
  }
})();
