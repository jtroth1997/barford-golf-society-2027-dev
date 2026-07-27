(() => {
  "use strict";

  const panel = document.querySelector("#eventWeather");
  if (!panel) return;
  if (panel.closest(".member-home-dashboard")?.classList.contains("hidden")) return;

  const eventDate = panel.dataset.eventDate;
  const teeTime = panel.dataset.teeTime || "09:00";
  const roundHours = Number(panel.dataset.roundHours || 4);
  const latitude = panel.dataset.latitude;
  const longitude = panel.dataset.longitude;
  const summary = document.querySelector("#weatherSummary");
  const tip = document.querySelector("#weatherTip");
  const updated = document.querySelector("#weatherUpdated");
  let lastUpdated = null;

  const dayMs = 86400000;
  const daysUntil = () => Math.ceil((new Date(`${eventDate}T12:00:00`) - new Date()) / dayMs);

  const weather = code => {
    if (code === 0) return {label:"Sunny", icon:"☀️", wet:false};
    if ([1,2].includes(code)) return {label:"Sunny intervals", icon:"🌤️", wet:false};
    if (code === 3) return {label:"Cloudy", icon:"☁️", wet:false};
    if ([45,48].includes(code)) return {label:"Foggy", icon:"🌫️", wet:false};
    if ([51,53,55,56,57].includes(code)) return {label:"Drizzle", icon:"🌦️", wet:true};
    if ([61,63,65,66,67,80,81,82].includes(code)) return {label:"Rain", icon:"🌧️", wet:true};
    if ([71,73,75,77,85,86].includes(code)) return {label:"Snow", icon:"🌨️", wet:true};
    if ([95,96,99].includes(code)) return {label:"Thunderstorms", icon:"⛈️", wet:true};
    return {label:"Mixed", icon:"🌥️", wet:false};
  };

  const updateAge = () => {
    if (!lastUpdated) return;
    const minutes = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 60000));
    updated.textContent = minutes < 1 ? "Updated just now" : minutes === 1 ? "Updated 1 minute ago" : `Updated ${minutes} minutes ago`;
  };

  const unavailable = message => {
    summary.innerHTML = '<span class="weather-icon" aria-hidden="true">◷</span><strong>Not available yet</strong>';
    tip.textContent = message;
    updated.textContent = "Waiting for the reliable forecast window";
  };

  const makeTip = points => {
    const midpoint = Math.max(1, Math.floor(points.length / 2));
    const front = points.slice(0, midpoint);
    const back = points.slice(midpoint);
    const max = (items, key) => Math.max(...items.map(item => item[key]));
    const avg = (items, key) => items.reduce((sum,item) => sum + item[key], 0) / items.length;
    const frontRain = max(front, "rain");
    const backRain = max(back, "rain");
    const frontWind = avg(front, "wind");
    const backWind = avg(back, "wind");
    const minTemp = Math.min(...points.map(item => item.temp));
    const maxTemp = Math.max(...points.map(item => item.temp));

    if (frontRain < 40 && backRain >= 55) return "Rain may arrive halfway through your round, so take a waterproof jacket.";
    if (frontRain >= 55) return "Rain is likely around your tee time, so take waterproofs and a towel.";
    if (backWind >= 20 && backWind >= frontWind + 5) return "It is due to get windy on the second half of your round, so take a jumper or light jacket.";
    if (Math.max(...points.map(item => item.wind)) >= 25) return "Strong winds are expected during your round, so a light jacket may be useful.";
    if (maxTemp - minTemp >= 4 && points[points.length - 1].temp < points[0].temp) return "It should turn cooler as you play, so keep a jumper in your bag.";
    if (minTemp <= 9) return "It will feel cool during your round, so take a jumper or light jacket.";
    if (maxTemp >= 22) return "It should feel warm during your round, so take water and sun protection.";
    return "Conditions should stay fairly settled throughout your round.";
  };

  const render = data => {
    const teeHour = Number(teeTime.slice(0,2));
    const endHour = teeHour + roundHours;
    const points = data.hourly.time.map((time,index) => ({
      time,
      hour:Number(time.slice(11,13)),
      temp:data.hourly.temperature_2m[index],
      rain:data.hourly.precipitation_probability[index],
      wind:data.hourly.wind_speed_10m[index],
      code:data.hourly.weather_code[index]
    })).filter(point => point.time.startsWith(eventDate) && point.hour >= teeHour && point.hour <= endHour);

    if (!points.length) {
      unavailable("The hourly forecast for your tee time has not been released yet.");
      return;
    }

    const tee = points[0];
    const condition = weather(tee.code);
    const extra = tee.wind >= 20 ? " · Breezy" : tee.rain >= 55 && !condition.wet ? " · Rain possible" : "";
    summary.innerHTML = `<span class="weather-icon" aria-hidden="true">${condition.icon}</span><strong>${Math.round(tee.temp)}°C · ${condition.label}${extra}</strong>`;
    tip.textContent = makeTip(points);
    lastUpdated = new Date();
    updateAge();
  };

  const load = async () => {
    const remaining = daysUntil();
    if (remaining > 16) {
      unavailable("Accurate tee-time advice will appear automatically from 10 March 2027.");
      return;
    }
    if (remaining < 0) {
      unavailable("This event has already taken place.");
      return;
    }

    try {
      const params = new URLSearchParams({
        latitude, longitude,
        hourly:"temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
        temperature_unit:"celsius",
        wind_speed_unit:"mph",
        timezone:"Europe/London",
        start_date:eventDate,
        end_date:eventDate,
        models:"best_match"
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {cache:"no-store"});
      if (!response.ok) throw new Error("Weather request failed");
      render(await response.json());
    } catch {
      summary.innerHTML = '<span class="weather-icon" aria-hidden="true">!</span><strong>Update unavailable</strong>';
      tip.textContent = "The site will try the weather service again automatically.";
      updated.textContent = "Unable to update right now";
    }
  };

  load();
  setInterval(load, 10 * 60 * 1000);
  setInterval(updateAge, 60 * 1000);
})();