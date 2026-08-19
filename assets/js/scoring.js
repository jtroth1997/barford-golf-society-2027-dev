(() => {
  "use strict";
  // Temporary loader: the full scoring app is loaded from its preserved revision while the cache guard runs first.
  const script = document.createElement("script");
  script.src = "https://raw.githubusercontent.com/jtroth1997/barford-golf-society-2027-dev/29d8cda451ba754e7bbff380bf2f39468ccdbefc/assets/js/scoring.js";
  document.head.appendChild(script);
})();