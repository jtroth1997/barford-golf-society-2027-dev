(() => {
  "use strict";
  const backdrop = document.querySelector("#homePhotoBackdrop");
  if (!backdrop) return;
  const layers = [...backdrop.querySelectorAll("span")];
  const photos = Array.from({ length: 26 }, (_, index) =>
    `assets/images/gallery-2026/legacy-${String(index + 1).padStart(2, "0")}.webp`
  );
  for (let index = photos.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [photos[index], photos[swap]] = [photos[swap], photos[index]];
  }
  let photoIndex = 0;
  let layerIndex = 0;
  const nextPhoto = () => {
    const layer = layers[layerIndex];
    layer.style.backgroundImage = `url("${photos[photoIndex]}")`;
    layers.forEach(item => item.classList.toggle("active", item === layer));
    photoIndex = (photoIndex + 1) % photos.length;
    layerIndex = (layerIndex + 1) % layers.length;
  };
  nextPhoto();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(nextPhoto, 8000);
  }
})();
