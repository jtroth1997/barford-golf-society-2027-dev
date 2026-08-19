(() => {
  const category = document.getElementById("signupPlayingCategory");
  if (!category) return;
  category.required = false;
  category.value = "";
  const label = category.closest("label");
  if (label) label.style.display = "none";
})();