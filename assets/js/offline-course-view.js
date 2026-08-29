(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const activeCard = (() => { try { return JSON.parse(localStorage.getItem("barford-fast-scorecard-v4") || "null"); } catch { return null; } })();
  const eventId = params.get("event") || activeCard?.card?.event_id || null;
  let hole = Math.min(18, Math.max(1, Number(params.get("hole")) || 1));
  let data = null;
  let active = false;

  const readCourse = () => {
    const candidates = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith("barford-course-")) continue;
      if (eventId && !key.endsWith(`:${eventId}`)) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        if (value?.holes?.length) candidates.push(value);
      } catch {}
    }
    return candidates.sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0] || null;
  };
  const view = () => data?.views?.find(item => Number(item.hole_number) === hole);
  const holeData = () => data?.holes?.find(item => Number(item.hole_number) === hole) || activeCard?.holes?.find(item => Number(item.hole_number) === hole);
  const distance = (a, b, c, d) => {
    const radians = Math.PI / 180;
    const x = (c - a) * radians;
    const y = (d - b) * radians * Math.cos((a + c) * radians / 2);
    return Math.round(Math.sqrt(x * x + y * y) * 6371000 * 1.09361);
  };
  const routeSvg = item => {
    if (!item?.tee_lat || !item?.green_lat) return '<div class="offline-hole-empty">Hole positions have not been mapped yet.</div>';
    const points = [{ lat: Number(item.tee_lat), lng: Number(item.tee_lng) }, ...(item.route_points || []).filter(point => point.type === "corner").map(point => ({ lat: Number(point.lat), lng: Number(point.lng) })), { lat: Number(item.green_lat), lng: Number(item.green_lng) }];
    const minLat = Math.min(...points.map(point => point.lat)), maxLat = Math.max(...points.map(point => point.lat));
    const minLng = Math.min(...points.map(point => point.lng)), maxLng = Math.max(...points.map(point => point.lng));
    const spanLat = Math.max(maxLat - minLat, .00001), spanLng = Math.max(maxLng - minLng, .00001);
    const plotted = points.map(point => `${30 + ((point.lng - minLng) / spanLng) * 240},${300 - ((point.lat - minLat) / spanLat) * 260}`).join(" ");
    const plottedPoints = plotted.split(" "), first = plottedPoints[0].split(","), last = plottedPoints[plottedPoints.length - 1].split(",");
    return `<svg viewBox="0 0 300 330" role="img" aria-label="Saved route for hole ${hole}"><path d="M20 315 Q150 250 280 315 L280 15 Q150 75 20 15 Z" fill="#315c4a" opacity=".28"/><polyline points="${plotted}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${first[0]}" cy="${first[1]}" r="12" fill="#e6c75a" stroke="#fff" stroke-width="4"/><circle cx="${last[0]}" cy="${last[1]}" r="13" fill="#315c4a" stroke="#fff" stroke-width="4"/><text x="${first[0]}" y="${Number(first[1]) - 20}" text-anchor="middle">TEE</text><text x="${last[0]}" y="${Number(last[1]) - 21}" text-anchor="middle">GREEN</text></svg>`;
  };
  const paint = () => {
    const details = holeData(), mapped = view();
    $("holeNumber").firstChild.nodeValue = String(hole);
    $("bottomHole").textContent = hole;
    $("holePar").textContent = details?.par ?? "—";
    $("teeYards").textContent = details?.yards ?? "—";
    $("teeLabel").textContent = (details?.yellow_tee_name || "Yellow").replace(/^Men\s+/, "");
    $("holeSI").textContent = details?.stroke_index ?? "—";
    const yards = mapped?.tee_lat && mapped?.green_lat ? distance(Number(mapped.tee_lat), Number(mapped.tee_lng), Number(mapped.green_lat), Number(mapped.green_lng)) : details?.yards;
    $("totalYards").textContent = yards ? `${yards} yds` : "—";
    $("toPinDistance").textContent = yards ? `${yards} yds` : "—";
    $("toTargetDistance").textContent = "—";
    $("frontGreen").textContent = "—";
    $("midGreen").textContent = yards ? `${yards}y` : "—";
    $("backGreen").textContent = "—";
    $("previousHole").disabled = hole === 1;
    $("nextHole").disabled = hole === 18;
    $("quickScore").textContent = params.get("from") === "scoring" ? "‹ Back to scoring" : `Hole ${hole} · Enter score`;
    const visual = document.querySelector(".offline-hole-visual");
    if (visual) visual.innerHTML = routeSvg(mapped);
    const message = document.querySelector(".offline-fallback-card p");
    if (message) message.textContent = mapped ? "Tee, green and hole route saved on this phone." : "Scorecard details are saved; this hole has no saved map positions yet.";
  };
  const start = () => {
    if (active || window.google?.maps) return;
    active = true;
    data = readCourse() || { holes: activeCard?.holes || [], views: [] };
    const fallback = document.createElement("div");
    fallback.className = "offline-fallback";
    fallback.innerHTML = '<div class="offline-hole-visual"></div><div class="offline-fallback-card"><strong>Offline hole view</strong><p>Your saved course details remain available.</p></div>';
    document.body.prepend(fallback);
    $("previousHole").onclick = () => { if (hole > 1) { hole--; paint(); } };
    $("nextHole").onclick = () => { if (hole < 18) { hole++; paint(); } };
    $("quickScore").onclick = () => history.length > 1 ? history.back() : location.href = `scoring.html?hole=${hole}`;
    $("exitGps").onclick = () => history.length > 1 ? history.back() : location.href = "index.html";
    $("recenterMap").disabled = true;
    paint();
  };
  window.addEventListener("offline", () => setTimeout(start, 250));
  setTimeout(() => { if (!navigator.onLine || !window.google?.maps) start(); }, 5000);
})();
