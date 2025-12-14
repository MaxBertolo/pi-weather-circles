// π Weather Circles — PASSWORD + PANEL + ICON HUD + POLYPHONIC CHORDS + ALARM
const PI = Math.PI;

// -------------------- PASSWORD GATE --------------------
const REQUIRED_PASS = "MAX72!";
const gate = document.getElementById("gate");
const gatePass = document.getElementById("gate-pass");
const gateBtn = document.getElementById("gate-btn");
const gateErr = document.getElementById("gate-err");

function unlockIfOk(pass) {
  if (pass === REQUIRED_PASS) {
    sessionStorage.setItem("pi_gate_ok", "1");
    gate.classList.add("hidden");
    return true;
  }
  return false;
}

function initGate() {
  if (sessionStorage.getItem("pi_gate_ok") === "1") {
    gate.classList.add("hidden");
    return;
  }
  gate.classList.remove("hidden");

  const submit = () => {
    gateErr.textContent = "";
    if (!unlockIfOk(gatePass.value)) {
      gateErr.textContent = "Wrong password.";
      gatePass.value = "";
      gatePass.focus();
    }
  };

  gateBtn.addEventListener("click", submit);
  gatePass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}
initGate();

// -------------------- CANVAS --------------------
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

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

// -------------------- UI --------------------
const panel = document.getElementById("panel");
const toggleBtn = document.getElementById("toggle-btn");
const btnDetails = document.getElementById("btn-details");
const panelDetails = document.getElementById("panel-details");

const btnGeo = document.getElementById("btn-geo");
const btnAudio = document.getElementById("btn-audio");
const toggleNight = document.getElementById("toggle-night");

const vTemp = document.getElementById("v-temp");
const vWind = document.getElementById("v-wind");
const vCloud = document.getElementById("v-cloud");
const vRain = document.getElementById("v-rain");
const vFog = document.getElementById("v-fog");
const vDayIcon = document.getElementById("v-dayicon");
const panelTime = document.getElementById("panel-time");

const statusEl = document.getElementById("status");

// Alarm UI
const alarmTime = document.getElementById("alarm-time");
const alarmSound = document.getElementById("alarm-sound");
const alarmSet = document.getElementById("alarm-set");
const alarmCancel = document.getElementById("alarm-cancel");
const alarmStop = document.getElementById("alarm-stop");
const alarmInfo = document.getElementById("alarm-info");

// Panel hidden by default
panel.classList.add("hidden");
panelDetails.classList.add("hidden");

toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("hidden");
});

btnDetails.addEventListener("click", () => {
  panelDetails.classList.toggle("hidden");
});

// Local time display (always updates, even if panel hidden)
function updateClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  panelTime.textContent = `${hh}:${mm}`;
}
updateClock();
setInterval(updateClock, 1000);

// -------------------- LOCATION (Geo + fallback) --------------------
const defaultLoc = { lat: 41.9028, lon: 12.4964, label: "Rome (fallback)" };
const loc = { ...defaultLoc };

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

      try { localStorage.setItem("pi_weather_loc", JSON.stringify(loc)); } catch {}

      statusEl.textContent = `Location set: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}. Updating weather…`;
      fetchWeather().catch(() => {});
    },
    (err) => {
      statusEl.textContent = `Location denied/unavailable (${err.code}). Using ${loc.label}.`;
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
  );
}
btnGeo.addEventListener("click", useGeolocation);

// -------------------- WEATHER --------------------
const weather = {
  tempC: 15,
  isDay: true,
  cloudCover: 30,   // %
  fog: 0,           // 0..1
  rainMm: 0,        // mm/h
  windMs: 1,        // m/s
  windDirDeg: 0,
  lastUpdate: 0
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

function tempNorm(tC) {
  // -15..50 -> 0..1
  return clamp((tC - (-15)) / (50 - (-15)), 0, 1);
}

// Background: blue/grey based on day proxy + fog
function computeBackground() {
  const day = weather.isDay ? 1 : 0;
  const clouds = clamp(weather.cloudCover / 100, 0, 1);
  const fog = clamp(weather.fog, 0, 1);

  const blueT = day * (1 - 0.65 * clouds);
  const greyT = clamp(0.18 + 0.60 * fog + 0.35 * clouds + (1 - day) * 0.22, 0, 1);

  const r = Math.floor(lerp(8, 86, greyT));
  const g = Math.floor(lerp(14, 98, greyT));
  const b = Math.floor(lerp(28, 165, greyT + blueT * 0.45));
  return `rgb(${r},${g},${b})`;
}

// Update icon HUD
function updateHud() {
  vTemp.textContent = `${weather.tempC.toFixed(1)}°`;
  vWind.textContent = `${weather.windMs.toFixed(1)} m/s`;
  vCloud.textContent = `${weather.cloudCover.toFixed(0)}%`;
  vRain.textContent = `${weather.rainMm.toFixed(1)} mm/h`;
  vFog.textContent = `${Math.round(weather.fog * 100)}%`;

  const nightPermanent = toggleNight.checked;
  const dayNow = nightPermanent ? false : weather.isDay;
  vDayIcon.textContent = dayNow ? "☀️" : "🌙";
}

async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,is_day,wind_speed_10m,wind_direction_10m` +
    `&hourly=cloud_cover,visibility,precipitation` +
    `&timezone=auto`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();

  const cur = data.current;
  const hourly = data.hourly;

  // closest hour
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
  weather.windMs = (cur.wind_speed_10m != null) ? (cur.wind_speed_10m / 3.6) : 1;
  weather.windDirDeg = cur.wind_direction_10m || 0;

  const cc = hourly?.cloud_cover?.[idx];
  weather.cloudCover = (typeof cc === "number") ? cc : 30;

  const precip = hourly?.precipitation?.[idx];
  weather.rainMm = (typeof precip === "number") ? precip : 0;

  const vis = hourly?.visibility?.[idx];
  weather.fog = (typeof vis === "number") ? clamp(1 - (vis / 20000), 0, 1) : 0;

  weather.lastUpdate = Date.now();

  updateHud();

  statusEl.textContent =
    `${loc.label} | ${loc.lat.toFixed(2)},${loc.lon.toFixed(2)} | ` +
    `${weather.tempC.toFixed(1)}°C | rain ${weather.rainMm.toFixed(1)} mm/h | ` +
    `wind ${weather.windMs.toFixed(1)} m/s | cloud ${weather.cloudCover.toFixed(0)}% | ` +
    `fog ${(weather.fog*100).toFixed(0)}% | ` +
    `${toggleNight.checked ? "Night(permanent)" : (weather.isDay ? "Day" : "Night")}`;
}

async function scheduleWeather() {
  try { await fetchWeather(); }
  catch { statusEl.textContent = "Weather error (using last known values)."; }
  finally { setTimeout(scheduleWeather, 10 * 60 * 1000); }
}
scheduleWeather();

// Try geo on start (can prompt)
useGeolocation();

// -------------------- SEASON + SEED --------------------
function getSeasonKey(date = new Date()) {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  return "autumn";
}
function seasonSeed(seasonKey) {
  return ({
    winter: 314159,
    spring: 265358,
    summer: 979323,
    autumn: 846264
  }[seasonKey] || 314159);
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -------------------- CIRCLES (99, border only 1mm) --------------------
const N = 99;
let circles = [];
let rng = mulberry32(seasonSeed(getSeasonKey()));
let currentSeason = getSeasonKey();

// alarm vibration state
let alarmActive = false;
let alarmShake = 0; // 0..1

function initCircles() {
  circles = [];
  const season = getSeasonKey();
  rng = mulberry32(seasonSeed(season));

  for (let i = 0; i < N; i++) {
    const r = lerp(6, 22, Math.pow(rng(), 1.6));
    const x = rng() * W;
    const y = rng() * H;

    circles.push({
      id: i,
      x, y,
      r,
      baseR: r,
      phase: (i + 1) * PI * (1 + (rng() - 0.5) * 0.10),
      rot: rng() * 2 * PI,
      spin: lerp(-0.9, 0.9, rng()),
      hueOffset: Math.floor(rng() * 60) - 30,
      alpha: lerp(0.30, 0.85, rng()),
      trail: []
    });
  }
}
initCircles();

function circleStrokeColor(c) {
  const t = tempNorm(weather.tempC);
  const hue = (lerp(215, 25, t) + c.hueOffset + 360) % 360;

  // season mood on saturation/light
  const season = getSeasonKey();
  const sat = (season === "summer") ? 78 : (season === "winter") ? 58 : 68;
  const lightBase = lerp(48, 68, t);
  const light = clamp(lightBase + (weather.isDay ? 4 : -6), 30, 80);

  return `hsla(${hue.toFixed(0)}, ${sat}%, ${light.toFixed(0)}%, ${c.alpha.toFixed(2)})`;
}

// -------------------- MOTION --------------------
function step(dt, nowMs) {
  const s = getSeasonKey();
  if (s !== currentSeason) {
    currentSeason = s;
    initCircles(); // seasonal seed change
  }

  const nightPermanent = toggleNight.checked;
  const isDay = nightPermanent ? false : weather.isDay;

  const tN = tempNorm(weather.tempC);
  const rain = clamp(weather.rainMm, 0, 30);
  const rainN = clamp(rain / 10, 0, 1);
  const wind = clamp(weather.windMs, 0, 25);
  const windN = clamp(wind / 12, 0, 1);

  const baseSpeed = lerp(10, 55, tN);

  const sunMode = (isDay && rain < 0.2);
  const windDir = (weather.windDirDeg || 0) * PI / 180;
  const wx = Math.cos(windDir) * windN;
  const wy = Math.sin(windDir) * windN;

  // alarm shake decays if not active
  if (!alarmActive) alarmShake = Math.max(0, alarmShake - dt * 0.8);

  for (const c of circles) {
    c.phase += dt * (PI * 0.15 + c.id * 0.0007);
    c.rot += dt * c.spin * (0.8 + 1.2 * tN);

    // harmonic micro
    const micro = 0.6 + 1.6 * (1 - rainN);
    let hx = Math.sin(c.phase) * micro;
    let hy = Math.cos(c.phase / PI) * micro;

    // alarm vibration (all circles vibrate)
    if (alarmActive || alarmShake > 0) {
      const vib = (alarmActive ? 1 : alarmShake) * 10;
      hx += (rng() - 0.5) * vib;
      hy += (rng() - 0.5) * vib;
    }

    // Sun: gentle circular biased to upper half
    if (sunMode) {
      const rad = (16 + c.baseR * 1.25) * (0.7 + 0.5 * Math.sin(c.phase / (PI * 2)));
      c.x += (Math.cos(c.phase) * rad + hx) * dt;
      c.y += (Math.sin(c.phase) * rad * 0.55 + hy) * dt;

      c.y -= dt * 6 * (0.25 + tN);
      const targetY = H * 0.35;
      c.y += (targetY - c.y) * dt * 0.05;
    }

    // Rain: vertical down
    if (rainN > 0) {
      const v = baseSpeed * (0.5 + 2.4 * rainN);
      c.y += v * dt;
      c.x += (hx * 0.35) * dt;
    }

    // Wind: diagonal drift
    if (windN > 0.05) {
      const drift = baseSpeed * (0.2 + 1.3 * windN);
      c.x += wx * drift * dt;
      c.y += wy * drift * dt;
    }

    // Calm: mild harmonic only
    if (!sunMode && rainN === 0) {
      const calm = baseSpeed * 0.12;
      c.x += (hx * calm) * dt;
      c.y += (hy * calm) * dt;
    }

    // wrap
    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;

    // visual logging (trail)
    const keep = 18;
    c.trail.push({ x: c.x, y: c.y, t: nowMs });
    if (c.trail.length > keep) c.trail.shift();
  }
}

// -------------------- RENDER --------------------
function draw(nowMs) {
  const nightPermanent = toggleNight.checked;
  const bg = computeBackground();
  ctx.fillStyle = nightPermanent ? "rgb(8,10,14)" : bg;
  ctx.fillRect(0, 0, W, H);

  // subtle time bar (logging time passing)
  const minute = Math.floor(nowMs / 60000);
  const xBar = (minute % 120) / 120 * W;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, H - 10, W, 10);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(xBar, H - 10, Math.max(2, W * 0.01), 10);

  // trails
  for (const c of circles) {
    const col = circleStrokeColor(c);
    for (let i = 0; i < c.trail.length - 1; i++) {
      const a = i / c.trail.length;
      ctx.strokeStyle = col.replace(/[\d.]+\)$/, `${(0.10 * a).toFixed(3)})`);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.trail[i].x, c.trail[i].y);
      ctx.lineTo(c.trail[i + 1].x, c.trail[i + 1].y);
      ctx.stroke();
    }
  }

  // circles (BORDER ONLY, ~1mm)
  for (const c of circles) {
    const pulse = 1 + 0.04 * Math.sin(c.phase / PI);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);

    ctx.strokeStyle = circleStrokeColor(c);
    ctx.lineWidth = 1; // ~1mm perception on most tablets (CSS px)
    ctx.beginPath();
    ctx.arc(0, 0, c.r * pulse, 0, 2 * PI);
    ctx.stroke();

    // tiny rotation marker
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(c.r * pulse, 0);
    ctx.stroke();

    ctx.restore();
  }
}

// -------------------- AUDIO: CHORDS BY SEASON + DAY/NIGHT --------------------
let audioCtx = null;
let master = null;
let chord = []; // oscillators
let noteTimer = 0;

function getModeKey() {
  const season = getSeasonKey();
  const nightPermanent = toggleNight.checked;
  const isDay = nightPermanent ? false : weather.isDay;
  return `${season}-${isDay ? "day" : "night"}`;
}

// intervals in semitones for triads (or 4 notes if you want later)
const MODES = {
  // Winter: darker
  "winter-day":   { name: "winter-day",   intervals: [0, 3, 7], wave: "triangle" }, // minor
  "winter-night": { name: "winter-night", intervals: [0, 3, 10], wave: "sine" },     // minor7 feel

  // Spring: airy
  "spring-day":   { name: "spring-day",   intervals: [0, 4, 7], wave: "sine" },      // major
  "spring-night": { name: "spring-night", intervals: [0, 4, 9], wave: "triangle" },  // major6

  // Summer: bright
  "summer-day":   { name: "summer-day",   intervals: [0, 4, 7], wave: "sawtooth" },  // brighter timbre
  "summer-night": { name: "summer-night", intervals: [0, 5, 7], wave: "triangle" },  // suspended

  // Autumn: warm but introspective
  "autumn-day":   { name: "autumn-day",   intervals: [0, 3, 7], wave: "triangle" },  // minor
  "autumn-night": { name: "autumn-night", intervals: [0, 3, 8], wave: "sine" }       // minor + color
};

function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  master = audioCtx.createGain();
  master.gain.value = 0.0;
  master.connect(audioCtx.destination);

  // create 3 oscillators; update their wave + frequency each note
  for (let i = 0; i < 3; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0.0;
    o.connect(g);
    g.connect(master);
    o.start();
    chord.push({ o, g });
  }

  btnAudio.textContent = "Audio enabled";
}
btnAudio.addEventListener("click", startAudio);

// Note scheduling: BPM depends on temperature + rain + wind (sync to movement mood)
function updateAudio(dt) {
  if (!audioCtx || !master) return;

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const mode = MODES[getModeKey()] || MODES["winter-day"];

  // base frequency range (cold low, hot high)
 
