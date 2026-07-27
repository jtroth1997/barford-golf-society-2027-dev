(() => {
  "use strict";

  const panel = document.querySelector("#eventWeather");
  if (!panel) return;

  const eventDate = panel.dataset.eventDate;
  const latitude = panel.dataset.latitude;
  const longitude = panel.dataset.longitude;
  const updated = document.querySelector("#weatherUpdated");
  const summary = document.querySelector("#weatherSummary");
  const unavailable = document.querySelector("#weatherUnavailable");
  const hours = document.querySelector("#weatherHours");
  let lastUpdated = null;

  const dayMs = 86400000;
  const dateAtNoon = value => new Date(`${value}T12:00:00`);
  const daysUntil = () => Math.ceil((dateAtNoon(eventDate) - new Date()) / dayMs);

  const codeInfo = code => {
    if (code === 0) return ["Sunny", "☀️"];
    if ([1,2].includes(code)) return ["Sunny intervals", "🌤️"];
    if (code === 3) return ["Cloudy", "☁️"];
    if ([45,48].includes(code)) return ["Foggy", "🌫️"];
    if ([51,53,55,56,57].includes(code)) return ["Drizzle", "🌦️"];
    if ([61,63,65,66,67,80,81,82].includes(code)) return ["Rain", "🌧️"];
    if ([71,73,75,77,85,86].includes(code)) return ["Snow", "🌨️"];
    if ([95,96,99].includes(code)) return ["Thunderstorms", "⛈️"];
    return ["Mixed conditions", "🌥️"];
  };

  const combinedCondition = (code, wind, rainChance) => {
    const [base] = codeInfo(code);
    const windText = wind >= 30 ? "windy" : wind >= 20 ? "breezy" : "";
    const rainText = rainChance >= 60 && !/Rain|Drizzle|Thunder/.test(base) ? "rain likely" : "";
    return [base, rainText, windText].filter(Boolean).join(" and ");
  };

  const ageText = () => {
    if (!lastUpdated) return;
    const minutes = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 60000));
    updated.textContent = minutes < 1 ? "Updated just now" : minutes === 1 ? "Updated 1 minute ago" : `Updated ${minutes} minutes ago`;
  };

  const showUnavailable = message => {
    unavailable.classList.remove("hidden");
    hours.classList.add("hidden");
    summary.innerHTML = `<span class="weather-icon" aria-hidden="true">◷</span><div><strong>Forecast not available yet</strong><small>${message}</small></div>`;
    updated.textContent = "Waiting for the reliable forecast window";
  };

  const render = data => {
    const indexes = data.hourly.time.map((time, index) => ({time,index}))
      .filter(item => item.time.startsWith(eventDate) && Number(item.time.slice(11,13)) >= 8 && Number(item.time.slice(11,13)) <= 14);

    if (!indexes.length) {
      showUnavailable("Hourly event data has not been released");
      return;
    }

    const first = indexes[0].index;
    const condition = combinedCondition(data.hourly.weather_code[first], data.hourly.wind_speed_10m[first], data.hourly.precipitation_probability[first]);
    const [,icon] = codeInfo(data.hourly.weather_code[first]);

    summary.innerHTML = `<span class="weather-icon" aria-hidden="true">${icon}</span><div><strong>${condition}</strong><small>${Math.round(data.hourly.temperature_2m[first])}°C · ${Math.round(data.hourly.precipitation_probability[first])}% rain · ${Math.round(data.hourly.wind_speed_10m[first])} mph wind</small></div>`;
    hours.innerHTML = indexes.map(({time,index}) => {
      const [,hourIcon] = codeInfo(data.hourly.weather_code[index]);
      const label = combinedCondition(data.hourly.weather_code[index], data.hourly.wind_speed_10m[index], data.hourly.precipitation_probability[index]);
      return `<div class="weather-hour"><time>${time.slice(11,16)}</time><span class="hour-icon" aria-hidden="true">${hourIcon}</span><strong>${Math.round(data.hourly.temperature_2m[index])}°</strong><small>${label}<br>${Math.round(data.hourly.precipitation_probability[index])}% rain · ${Math.round(data.hourly.wind_speed_10m[index])} mph</small></div>`;
    }).join("");

    unavailable.classList.add("hidden");
    hours.classList.remove("hidden");
    lastUpdated = new Date();
    ageText();
  };

  const load = async () => {
    const remaining = daysUntil();
    if (remaining > 16) {
      showUnavailable("Available from 10 March 2027");
      return;
    }
    if (remaining < 0) {
      showUnavailable("This event has already taken place");
      return;
    }

    try {
      const params = new URLSearchParams({
        latitude, longitude,
        hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
        temperature_unit: "celsius",
        wind_speed_unit: "mph",
        timezone: "Europe/London",
        start_date: eventDate,
        end_date: eventDate,
        models: "best_match"
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {cache:"no-store"});
      if (!response.ok) throw new Error("Weather request failed");
      render(await response.json());
    } catch {
      updated.textContent = "Unable to update right now";
      summary.innerHTML = '<span class="weather-icon" aria-hidden="true">!</span><div><strong>Weather temporarily unavailable</strong><small>The site will try again automatically.</small></div>';
    }
  };

  load();
  setInterval(load, 10 * 60 * 1000);
  setInterval(ageText, 60 * 1000);
})();