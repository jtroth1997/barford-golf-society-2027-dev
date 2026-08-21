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
  card.innerHTML = '<span aria-hidden="true">⛅</span><div><small>Weather at tee-off</small><strong>Checking the course forecast…</strong><p></p></div>';
  host.after(card);
  const set = (title, detail) => { card.querySelector("strong").textContent=title; card.querySelector("p").textContent=detail; card.classList.remove("hidden"); };
  const condition = code => code === 0 ? ["☀️","Sunny"] : [1,2].includes(code) ? ["🌤️","Sunny intervals"] : code === 3 ? ["☁️","Cloudy"] : [45,48].includes(code) ? ["🌫️","Foggy"] : [51,53,55].includes(code) ? ["🌦️","Drizzle"] : [61,63,65,80,81,82].includes(code) ? ["🌧️","Rain"] : [95,96,99].includes(code) ? ["⛈️","Thunderstorms"] : ["🌥️","Mixed conditions"];
  (async () => {
    const { data:{session} } = await client.auth.getSession();
    if (!session) return;
    const { data:event } = await client.from("events").select("id,name,venue,event_date,first_tee_time,latitude,longitude,status").gte("event_date",localDate()).eq("status","scheduled").order("event_date").limit(1).maybeSingle();
    if (!event?.event_date || event.latitude == null || event.longitude == null) return;
    const days = Math.ceil((new Date(event.event_date+"T12:00:00") - new Date()) / 86400000);
    if (days > 16) { set("Forecast will appear nearer the day", friendlyDate(event.event_date)+" · reliable tee-time weather is normally available within 16 days."); return; }
    try {
      const {data:memberTee}=await client.from("tee_times").select("tee_time").eq("event_id",event.id).eq("member_id",session.user.id).maybeSingle();
      const teeTime=String(memberTee?.tee_time||event.first_tee_time||"09:00").slice(0,5);
      const params = new URLSearchParams({latitude:event.latitude,longitude:event.longitude,hourly:"temperature_2m,precipitation_probability,weather_code,wind_speed_10m",temperature_unit:"celsius",wind_speed_unit:"mph",timezone:"Europe/London",start_date:event.event_date,end_date:event.event_date,models:"best_match"});
      const response = await fetch("https://api.open-meteo.com/v1/forecast?"+params,{cache:"no-store"});
      if (!response.ok) throw Error();
      const weather=await response.json();
      const target=new Date(`${event.event_date}T${teeTime}:00`).getTime();
      let index=0,closest=Infinity;
      weather.hourly.time.forEach((time,i)=>{const distance=Math.abs(new Date(time).getTime()-target);if(distance<closest){closest=distance;index=i;}});
      const [weatherIcon,label]=condition(weather.hourly.weather_code[index]);
      const temp=Math.round(weather.hourly.temperature_2m[index]);
      const rain=Math.round(weather.hourly.precipitation_probability[index]||0);
      const wind=Math.round(weather.hourly.wind_speed_10m[index]||0);
      card.querySelector("span").textContent=weatherIcon;
      set(`${temp}°C · ${label}`, `${teeTime} tee-off at ${event.venue||event.name} · ${rain}% rain · ${wind} mph wind`);
    } catch { set("Weather update unavailable", "We will try again automatically when you revisit the dashboard."); }
  })();
})();
