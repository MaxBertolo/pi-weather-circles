// π Weather Circles — GitHub Pages (no build tools)
// Data: Open-Meteo (free, no API key)
// Visual: Canvas 2D

const PI = Math.PI;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const statusEl = document.getElementById("status");
const btnGeo = document.getElementById("btn-geo");
const btnAudio = document.getElementById("btn-audio");
const toggleNight = document.getElementById("toggle-night");

let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// -------------------- Location (Geo + fallback) --------------------
const defaultLoc = { lat: 41.9028, lon: 12.4964, label: "Rome (fallback)" };

const loc = {
  lat: defaultLoc.lat,
  lon: defaultLoc.lon,
  label: defaultLoc.label
};

// restore last saved location if available
try {
  const saved = JSON.parse(localStorage.getItem("pi_weather_loc") || "null");
  if (saved && typeof saved.lat === "number" && typeof saved.lon === "number") {
    loc.lat = saved.lat;
    loc.lon = saved.lon;
    loc.label = saved.label || "Saved location";
  }
} catch {}

function useGeolocation() {
  if (!("geolocation" in navigator)) {
    statusEl.textContent = "Geolocation not supported. Using fallback/saved location.";
    return;
  }

  statusEl.textContent = "Requesting location permission…";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      loc.lat = pos.coords.latitude;
      loc.lon = pos.coords.longitude;
      loc.label = "My location";

      try {
        localStorage.setItem("pi_weather_loc", JSON.stringify(loc));
      } catch {}

      statusEl.textContent = `Location set: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}. Updating weather…`;
      fetchWeather().catch(() => {});
    },
    (err) => {
      statusEl.textContent = `Location denied/unavailable (${err.code}). Using ${loc.label}.`;
    },
    {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 10 * 60 * 1000
    }
  );
}

btnGeo.addEventListener("click", () => {
  useGeolocation();
});

// -------------------- Weather state --------------------
const weather = {
  tempC: 15,
  isDay: true,
  cloudCover: 20,      // %
  fog: 0,              // 0..1 approx
  rainMm: 0,           // mm/h
  windMs: 1,           // m/s
  windDirDeg: 0,       // degrees
  code: 0,
  lastUpdate: 0
};

// -------------------- Season + seed --------------------
function getSeasonKey(date = new Date()) {
  const m = date.getMonth(); // 0-11
  if (m === 11 || m <= 1) return "winter";
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  return "autumn";
}

function seasonSeed(seasonKey) {
  const base = {
    winter: 314159,
    spring: 265358,
    summer: 979323,
    autumn: 846264
  }[seasonKey] || 314159;
  return base;
}

// Seeded PRNG (Mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -------------------- Circles --------------------
const N = 99;
let circles = [];
let rng = mulberry32(seasonSeed(getSeasonKey()));

function initCircles() {
  circles = [];
  const season = getSeasonKey();
  rng = mulberry32(seasonSeed(season));

  for (let i = 0; i < N; i++) {
    const u = rng();
    const v = rng();

    const r = lerp(4, 24, Math.pow(rng(), 1.8));
    const x = u * W;
    const y = v * H;

    // π-based unique phase
    const phi = (i + 1) * PI * (1 + (rng() - 0.5) * 0.12);

    circles.push({
      id: i,
      x, y,
      r,
      baseR: r,
      phase: phi,
      rot: rng() * 2 * PI,
      spin: lerp(-0.8, 0.8, rng()),
      hueOffset: Math.floor(rng() * 40) - 20,
      alpha: lerp(0.35, 0.85, rng()),
      trail: []
    });
  }
}
initCircles();

let currentSeason = getSeasonKey();

// -------------------- Helpers --------------------
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function tempNorm(tC) {
  return clamp((tC - (-15)) / (50 - (-15)), 0, 1);
}

function computeBackground() {
  const day = weather.isDay ? 1 : 0;
  const clouds = clamp(weather.cloudCover / 100, 0, 1);
  const fog = clamp(weather.fog, 0, 1);

  let blueT = day * (1 - 0.6 * clouds);
  let greyT = clamp(0.15 + 0.55 * fog + 0.35 * clouds + (1 - day) * 0.25, 0, 1);

  const r = Math.floor(lerp(10, 80, greyT));
  const g = Math.floor(lerp(16, 95, greyT));
  const b = Math.floor(lerp(28, 150, greyT + blueT * 0.4));

  return `rgb(${r},${g},${b})`;
}

function circleColor(circle) {
  const t = tempNorm(weather.tempC);
  const hue = lerp(220, 30, t) + circle.hueOffset;

  const season = getSeasonKey();
  const seasonSat = (season === "summer") ? 0.85 : (season === "winter") ? 0.55 : 0.7;
  const sat = clamp(lerp(0.45, 0.9, seasonSat), 0.35, 0.95);

  const light = clamp(lerp(0.35, 0.62, t) + (weather.isDay ? 0.06 : -0.04), 0.18, 0.78);

  return `hsla(${hue.toFixed(0)}, ${(sat*100).toFixed(0)}%, ${(light*100).toFixed(0)}%, ${circle.alpha.toFixed(2)})`;
}

// -------------------- Motion + Logging --------------------
function step(dt, nowMs) {
  const s = getSeasonKey();
  if (s !== currentSeason) {
    currentSeason = s;
    initCircles();
  }

  const nightPermanent = toggleNight.checked;
  const isDay = nightPermanent ? false : weather.isDay;

  const tN = tempNorm(weather.tempC);
  const rain = clamp(weather.rainMm, 0, 30);
  const rainN = clamp(rain / 10, 0, 1);
  const wind = clamp(weather.windMs, 0, 25);
  const windN = clamp(wind / 12, 0, 1);

  const baseSpeed = lerp(10, 55, tN);

  const sunFactor = (isDay && rain < 0.2) ? 1 : 0;
  const rainFactor = rainN;

  const windDir = (weather.windDirDeg || 0) * PI / 180;
  const wx = Math.cos(windDir) * windN;
  const wy = Math.sin(windDir) * windN;

  for (const c of circles) {
    c.phase += dt * (PI * 0.15 + c.id * 0.0007);
    c.rot += dt * c.spin * (0.8 + 1.2 * tN);

    const micro = 0.6 + 1.8 * (1 - rainN);
    const hx = Math.sin(c.phase) * micro;
    const hy = Math.cos(c.phase / PI) * micro;

    if (sunFactor > 0) {
      const rad = (18 + c.baseR * 1.3) * (0.6 + 0.6 * Math.sin(c.phase / (PI*2)));
      c.x += (Math.cos(c.phase) * rad + hx) * dt;
      c.y += (Math.sin(c.phase) * rad * 0.55 + hy) * dt;

      c.y -= dt * 6 * (0.3 + tN);

      const targetY = H * 0.35;
      c.y += (targetY - c.y) * dt * 0.05;
    }

    if (rainFactor > 0) {
      const v = baseSpeed * (0.5 + 2.2 * rainFactor);
      c.y += v * dt;
      c.x += (hx * 0.4) * dt;
    }

    if (windN > 0.05) {
      const drift = baseSpeed * (0.2 + 1.2 * windN);
      c.x += wx * drift * dt;
      c.y += wy * drift * dt;
    }

    if (sunFactor === 0 && rainFactor === 0) {
      const calm = baseSpeed * 0.12;
      c.x += (hx * calm) * dt;
      c.y += (hy * calm) * dt;
    }

    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;

    const keep = 22;
    c.trail.push({ x: c.x, y: c.y, t: nowMs });
    if (c.trail.length > keep) c.trail.shift();
  }
}

function draw(nowMs) {
  const nightPermanent = toggleNight.checked;
  const bg = computeBackground();

  ctx.fillStyle = nightPermanent ? "rgb(8,10,14)" : bg;
  ctx.fillRect(0, 0, W, H);

  // time bar (visual logging)
  const minute = Math.floor(nowMs / 60000);
  const xBar = (minute % 120) / 120 * W;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, H - 12, W, 12);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(xBar, H - 12, Math.max(2, W * 0.01), 12);

  // trails
  for (const c of circles) {
    const col = circleColor(c);
    for (let i = 0; i < c.trail.length - 1; i++) {
      const a = i / c.trail.length;
      ctx.strokeStyle = col.replace(/[\d.]+\)$/, `${(0.10 * a).toFixed(3)})`);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.trail[i].x, c.trail[i].y);
      ctx.lineTo(c.trail[i+1].x, c.trail[i+1].y);
      ctx.stroke();
    }
  }

  // circles
  for (const c of circles) {
    const pulse = 1 + 0.06 * Math.sin(c.phase / PI);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);

    ctx.fillStyle = circleColor(c);
    ctx.beginPath();
    ctx.arc(0, 0, c.r * pulse, 0, 2 * PI);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(c.r * pulse, 0);
    ctx.stroke();

    ctx.restore();
  }
}

// -------------------- Weather fetch (Open-Meteo) --------------------
async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m` +
    `&hourly=cloud_cover,visibility,precipitation` +
    `&timezone=Europe/Rome`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();

  const cur = data.current;
  const hourly = data.hourly;

  let idx = (hourly?.time?.length || 1) - 1;
  if (hourly?.time?.length) {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < hourly.time.length; i++) {
      const t = new Date(hourly.time[i]).getTime();
      const d = Math.abs(Date.now() - t);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    idx = best;
  }

  weather.tempC = cur.temperature_2m;
  weather.isDay = !!cur.is_day;
  weather.code = cur.weather_code;

  // Open-Meteo wind_speed_10m is typically km/h unless configured; we keep a safe conversion:
  weather.windMs = (cur.wind_speed_10m != null) ? (cur.wind_speed_10m / 3.6) : 1;
  weather.windDirDeg = cur.wind_direction_10m || 0;

  const cc = hourly?.cloud_cover?.[idx];
  weather.cloudCover = (typeof cc === "number") ? cc : 30;

  const precip = hourly?.precipitation?.[idx];
  weather.rainMm = (typeof precip === "number") ? precip : 0;

  const vis = hourly?.visibility?.[idx];
  if (typeof vis === "number") {
    weather.fog = clamp(1 - (vis / 20000), 0, 1);
  } else {
    weather.fog = 0;
  }

  weather.lastUpdate = Date.now();

  statusEl.textContent =
    `${loc.label} | ${loc.lat.toFixed(2)},${loc.lon.toFixed(2)} | ${weather.tempC.toFixed(1)}°C | ` +
    `rain ${weather.rainMm.toFixed(1)} mm/h | wind ${weather.windMs.toFixed(1)} m/s | ` +
    `cloud ${weather.cloudCover.toFixed(0)}% | fog ${(weather.fog*100).toFixed(0)}% | ` +
    `${toggleNight.checked ? "Night(permanent)" : (weather.isDay ? "Day" : "Night")}`;
}

async function scheduleWeather() {
  try {
    await fetchWeather();
  } catch (e) {
    statusEl.textContent = `Weather error (using last known values).`;
  } finally {
    setTimeout(scheduleWeather, 10 * 60 * 1000);
  }
}
scheduleWeather();

// Try geolocation on start (will show permission prompt if not already granted)
useGeolocation();

// -------------------- Audio (simple sync) --------------------
let audioCtx = null;
let isAudioOn = false;
let osc = null;
let gain = null;

function startAudio() {
  if (isAudioOn) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();

  osc.type = "sine";
  gain.gain.value = 0.0;

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();

  isAudioOn = true;
  btnAudio.textContent = "Audio enabled";
}

btnAudio.addEventListener("click", () => {
  startAudio();
});

function updateAudio() {
  if (!isAudioOn || !audioCtx) return;

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const baseFreq = lerp(140, 520, tN);
  const wobble = (rainN * 24) + (windN * 18);

  const pulseHz = lerp(0.4, 2.0, tN) + rainN * 1.2;

  const time = audioCtx.currentTime;
  const f = baseFreq + Math.sin(time * (PI * 0.5)) * wobble;
  osc.frequency.setTargetAtTime(f, time, 0.02);

  const night = toggleNight.checked || !weather.isDay;
  const targetGain = night ? 0.015 : 0.03;

  const intensity = clamp(targetGain + rainN * 0.02, 0.0, 0.06);
  const pulsed = intensity * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2 * PI * pulseHz)));

  gain.gain.setTargetAtTime(pulsed, time, 0.04);
}

// -------------------- Main loop --------------------
let last = performance.now();

function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  step(dt, now);
  draw(now);
  updateAudio();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Update status immediately when toggling night
toggleNight.addEventListener("change", () => {
  fetchWeather().catch(() => {});
});
