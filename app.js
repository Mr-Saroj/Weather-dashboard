

const API_KEY = "960cbff6c8b29a2f93026a782d105340";

const $ = (sel) => document.querySelector(sel);

const currentEl = $('#current');
const hourlyList = $('#hourly-list');
const dailyList = $('#daily-list');
const lastUpdated = $('#last-updated');

const form = $('#search-form');
const cityInput = $('#city-input');
const locBtn = $('#loc-btn');

let currentUnit = 'metric'; // 'metric' or 'imperial'
let lastCoords = null;

// Helper: icon URL
function iconUrl(icon) {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

// Fetch by coordinates
async function fetchWeatherByCoords(lat, lon, units = 'metric') {
  try {
    // current
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    const curResp = await fetch(currentUrl);
    if (!curResp.ok) throw new Error("Failed current weather");
    const currentData = await curResp.json();

    // forecast
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    const foreResp = await fetch(forecastUrl);
    if (!foreResp.ok) throw new Error("Failed forecast");
    const forecastData = await foreResp.json();

    renderAll(currentData, forecastData, units);
  } catch (e) {
    showError(e.message || String(e));
  }
}


async function fetchWeatherByCity(city, units = 'metric') {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("City not found");
    const d = await resp.json();
    const { coord } = d;
    if (!coord) throw new Error("No coordinates for city");
    await fetchWeatherByCoords(coord.lat, coord.lon, units);
  } catch (e) {
    showError(e.message || String(e));
  }
}


function renderAll(current, forecast, units) {
  currentEl.innerHTML = '';
  hourlyList.innerHTML = '';
  dailyList.innerHTML = '';

  const tempUnit = units === 'metric' ? '°C' : '°F';

 
  const currentHtml = document.createElement('div');
  currentHtml.className = 'current-inner';
  currentHtml.innerHTML = `
    <div class="curr-left">
      <div class="meta">${escapeHtml(current.name)}, ${escapeHtml(current.sys.country)}</div>
      <div class="temp">${Math.round(current.main.temp)}${tempUnit}</div>
      <div class="conditions">${escapeHtml(current.weather[0].description)}</div>
      <div class="meta">
        Feels: ${Math.round(current.main.feels_like)}${tempUnit} · 
        Humidity: ${current.main.humidity}% · 
        Wind: ${current.wind.speed} ${units === 'metric' ? 'm/s' : 'mph'}
      </div>
    </div>
    <div class="curr-right">
      <img src="${iconUrl(current.weather[0].icon)}" 
           alt="${escapeHtml(current.weather[0].description)}" width="96" height="96"/>
    </div>
  `;
  currentEl.appendChild(currentHtml);

 
  const hours = forecast.list.slice(0, 8);
  hours.forEach(h => {
    const dt = new Date(h.dt * 1000);
    const hourLabel = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item = document.createElement('div');
    item.className = 'hourly-item';
    item.innerHTML = `
      <small>${hourLabel}</small>
      <img src="${iconUrl(h.weather[0].icon)}" alt="${escapeHtml(h.weather[0].description)}" width="48" height="48"/>
      <div><strong>${Math.round(h.main.temp)}${tempUnit}</strong></div>
    `;
    hourlyList.appendChild(item);
  });

  
  const dailyMap = {};
  forecast.list.forEach(f => {
    const date = new Date(f.dt * 1000).toLocaleDateString();
    if (!dailyMap[date]) {
      dailyMap[date] = { min: f.main.temp_min, max: f.main.temp_max, icon: f.weather[0].icon, desc: f.weather[0].description };
    } else {
      dailyMap[date].min = Math.min(dailyMap[date].min, f.main.temp_min);
      dailyMap[date].max = Math.max(dailyMap[date].max, f.main.temp_max);
    }
  });

  const days = Object.entries(dailyMap).slice(0, 7);
  days.forEach(([date, d]) => {
    const dayLabel = new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const el = document.createElement('div');
    el.className = 'daily-item';
    el.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;">
        <div>
          <div style="font-weight:600">${dayLabel}</div>
          <div class="meta" style="font-size:0.9rem">${d.desc}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${iconUrl(d.icon)}" alt="${escapeHtml(d.desc)}" width="44" height="44"/>
        <div style="text-align:right">
          <div><strong>${Math.round(d.max)}${tempUnit}</strong></div>
          <div class="meta">${Math.round(d.min)}${tempUnit}</div>
        </div>
      </div>
    `;
    dailyList.appendChild(el);
  });

  lastUpdated.textContent = new Date().toLocaleString();
}

// Errors
function showError(msg) {
  currentEl.innerHTML = `<div class="loader">Error: ${escapeHtml(msg)}</div>`;
  hourlyList.innerHTML = '';
  dailyList.innerHTML = '';
  lastUpdated.textContent = '-';
}

function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe).replace(/[&<>"'`=\/]/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
  })[s]);
}


form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = cityInput.value.trim();
  if (!q) return;
  localStorage.setItem('lastCity', q);
  fetchWeatherByCity(q, currentUnit);
});

locBtn.addEventListener('click', () => {
  getLocationAndFetch();
});

document.querySelectorAll('input[name="unit"]').forEach(r => {
  r.addEventListener('change', (ev) => {
    currentUnit = ev.target.value;
    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) {
      fetchWeatherByCity(lastCity, currentUnit);
    } else if (lastCoords) {
      fetchWeatherByCoords(lastCoords.lat, lastCoords.lon, currentUnit);
    } else {
      getLocationAndFetch();
    }
  });
});

function getLocationAndFetch() {
  if (!navigator.geolocation) {
    showError('Geolocation not supported');
    return;
  }
  currentEl.innerHTML = `<div class="loader">Fetching location…</div>`;
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    lastCoords = { lat, lon };
    localStorage.removeItem('lastCity');
    fetchWeatherByCoords(lat, lon, currentUnit);
  }, () => {
    showError('Location denied. Try search by city.');
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}


(function init() {
  const lastCity = localStorage.getItem('lastCity');
  if (lastCity) {
    cityInput.value = lastCity;
    fetchWeatherByCity(lastCity, currentUnit);
    return;
  }
  getLocationAndFetch();
})();
