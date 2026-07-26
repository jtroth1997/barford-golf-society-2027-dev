
(() => {
  const menuButton = document.querySelector(".menu-button");
  const navigation = document.querySelector("#primary-navigation");

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const open = navigation.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
    });

    navigation.addEventListener("click", event => {
      if (event.target.closest("a")) {
        navigation.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
