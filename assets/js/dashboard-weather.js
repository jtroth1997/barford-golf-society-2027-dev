(() => {
  "use strict";
  const client = window.BarfordSupabase;
  const host = document.getElementById("dashboardEventFacts");
  if (!client || !host) return;
  const localDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const friendlyDate = value => new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short"}).format(new Date(value+"T12:00:00"));
  const card = document.createElement("section");
  card.id = "dashboardWeather";
  card.className = "dashboard-weather-card hidden";
  card.setAttribute("aria-live","polite");
  card.innerHTML = '<span aria-hidden="true">⛅</span><div><small>Event-day weather</small><strong>Checking forecast…</strong><p></p></div>';
  host.after(card);
  const set = (title, detail) => { card.querySelector("strong").textContent=title; card.querySelector("p").textContent=detail; card.classList.remove("hidden"); };
  const icon = code => code === 0 ? "☀️" : [1,2].includes(code) ? "🌤️" : code === 3 ? "☁️" : [51,53,55,61,63,65,80,81,82].includes(code) ? "🌧️" : [95,96,99].includes(code) ? "⛈️" : "🌥️";
  (async () => {
    const { data:{session} } = await client.auth.getSession();
    if (!session) return;
    const { data:event } = await client.from("events").select("name,event_date,first_tee_time,latitude,longitude,status").gte("event_date",localDate()).eq("status","scheduled").order("event_date").limit(1).maybeSingle();
    if (!event?.event_date || event.latitude == null || event.longitude == null) return;
    const days = Math.ceil((new Date(event.event_date+"T12:00:00") - new Date()) / 86400000);
    if (days > 16) { set("Forecast will appear nearer the day", friendlyDate(event.event_date)+" · reliable tee-time weather is normally available within 16 days."); return; }
    try {
      const params = new URLSearchParams({latitude:event.latitude,longitude:event.longitude,current:"temperature_2m,weather_code,wind_speed_10m",timezone:"Europe/London"});
      const response = await fetch("https://api.open-meteo.com/v1/forecast?"+params,{cache:"no-store"});
      if (!response.ok) throw Error();
      const weather = (await response.json()).current;
      card.querySelector("span").textContent=icon(weather.weather_code);
      set(Math.round(weather.temperature_2m)+"°C · "+Math.round(weather.wind_speed_10m)+" mph wind", event.name+" · latest conditions for the course area");
    } catch { set("Weather update unavailable", "We will try again automatically when you revisit the dashboard."); }
  })();
})();