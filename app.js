// π Weather Circles — GitHub Pages (no build tools)
// Data: Open-Meteo (free, no API key)
// Visual: Canvas 2D

const PI = Math.PI;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const statusEl = document.getElementById("status");
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

// ----- Weather state -----
const rome = { lat: 41.9028, lon: 12.4964 };

// Live state updated by fetch
const weather = {
  tempC: 15,
  isDay: true,
  cloudCover: 20,      // %
  fog: 0,              // 0..1 approx
  rainMm: 0,           // mm/h
  windMs: 1,           // m/s
  windDirDeg: 0,       // degrees
  code: 0,             // weather code
  lastUpdate: 0
};

// ----- Season + seed -----
function getSeasonKey(date = new Date()) {
  const m = date.getMonth(); // 0-11
  // Northern hemisphere: DJF winter, MAM spring, JJA summer, SON autumn
  if (m === 11 || m <= 1) return "winter";
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  return "autumn";
}

function seasonSeed(seasonKey) {
  // deterministic seasonal seed (stable within season, changes across seasons)
  // Using π digits pattern + season mapping
  const base = {
    winter: 314159,
    spring: 265358,
    summer: 979323,
    autumn: 846264
  }[seasonKey] || 314159;
  return base;
}

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----- Circles -----
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

    const r = lerp(4, 24, Math.pow(rng(), 1.8)); // many small, few larger
    const x = u * W;
    const y = v * H;

    // Unique π-based phase offset
    const phi = (i + 1) * PI * (1 + (rng() - 0.5) * 0.12);

    circles.push({
      id: i,
      x, y,
      r,
      baseR: r,
      phase: phi,
      rot: rng() * 2 * PI,
      spin: lerp(-0.8, 0.8, rng()),  // internal rotation factor
      hueOffset: Math.floor(rng() * 40) - 20,
      alpha: lerp(0.35, 0.85, rng()),
      trail: [] // for visual logging
    });
  }
}
initCircles();

// Update season seed at runtime (e.g. midnight crossing into new season)
let currentSeason = getSeasonKey();

// ----- Helpers -----
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// Map temperature [-15..50] to [0..1]
function tempNorm(tC) {
  return clamp((tC - (-15)) / (50 - (-15)), 0, 1);
}

// Background: blu/grigio based on sun height proxy + fog
function computeBackground() {
  // Sun height proxy: use isDay + cloudCover as approximation
  // If isDay: "higher sun" look = brighter blue; else darker.
  // We do not calculate solar elevation here to keep it simple & free.
  const day = weather.isDay ? 1 : 0;
  const clouds = clamp(weather.cloudCover / 100, 0, 1);
  const fog = clamp(weather.fog, 0, 1);

  // Blue component stronger with day, weaker with clouds.
  let blueT = day * (1 - 0.6 * clouds);

  // Grey stronger with fog + clouds + night
  let greyT = clamp(0.15 + 0.55 * fog + 0.35 * clouds + (1 - day) * 0.25, 0, 1);

  // Blend between deep blue and blue-grey
  const r = Math.floor(lerp(10, 80, greyT));
  const g = Math.floor(lerp(16, 95, greyT));
  const b = Math.floor(lerp(28, 150, greyT + blueT * 0.4));

  return `rgb(${r},${g},${b})`;
}

// Circle color: warm if hot, cool if cold
function circleColor(circle) {
  const t = tempNorm(weather.tempC);
  // cold ~ 200-240 hue (blue/cyan), hot ~ 10-50 hue (red/orange/yellow)
  const hue = lerp(220, 30, t) + circle.hueOffset;

  // season tweaks: summer brighter, winter more muted
  const season = getSeasonKey();
  const seasonSat = (season === "summer") ? 0.85 : (season === "winter") ? 0.55 : 0.7;
  const sat = clamp(lerp(0.45, 0.9, seasonSat), 0.35, 0.95);

  // Lightness: slightly higher when day
  const light = clamp(lerp(0.35, 0.62, t) + (weather.isDay ? 0.06 : -0.04), 0.18, 0.78);

  return `hsla(${hue.toFixed(0)}, ${(sat*100).toFixed(0)}%, ${(light*100).toFixed(0)}%, ${circle.alpha.toFixed(2)})`;
}

// Motion model:
// Sun: slow circular in upper half + harmonic micro-motions
// Rain: vertical downward speed proportional to rain
// Wind: diagonal drift based on wind speed + direction
function step(dt, nowMs) {
  // check season change
  const s = getSeasonKey();
  if (s !== currentSeason) {
    currentSeason = s;
    initCircles();
  }

  // permanent night mode override
  const nightPermanent = toggleNight.checked;
  const isDay = nightPermanent ? false : weather.isDay;

  const tN = tempNorm(weather.tempC);
  const rain = clamp(weather.rainMm, 0, 30); // cap
  const rainN = clamp(rain / 10, 0, 1);      // 0..1
  const wind = clamp(weather.windMs, 0, 25);
  const windN = clamp(wind / 12, 0, 1);

  // Base speed: hotter -> slightly faster
  const baseSpeed = lerp(10, 55, tN); // pixels/sec-ish scale

  // Sun mode factor
  const sunFactor = (isDay && rain < 0.2) ? 1 : 0;

  // Rain factor
  const rainFactor = rainN;

  // Wind drift vector
  const windDir = (weather.windDirDeg || 0) * PI / 180;
  const wx = Math.cos(windDir) * windN;
  const wy = Math.sin(windDir) * windN;

  for (const c of circles) {
    c.phase += dt * (PI * 0.15 + c.id * 0.0007); // π-linked phase advance
    c.rot += dt * c.spin * (0.8 + 1.2 * tN);     // internal rotation

    // Harmonic micro jitter (π-based)
    const micro = 0.6 + 1.8 * (1 - rainN); // calmer when not raining
    const hx = Math.sin(c.phase) * micro;
    const hy = Math.cos(c.phase / PI) * micro;

    // Sun behavior: gentle circular paths biased to upper area
    if (sunFactor > 0) {
      const rad = (18 + c.baseR * 1.3) * (0.6 + 0.6 * Math.sin(c.phase / (PI*2)));
      c.x += (Math.cos(c.phase) * rad + hx) * dt;
      c.y += (Math.sin(c.phase) * rad * 0.55 + hy) * dt;

      // float slightly upward overall (staying upper half)
      c.y -= dt * 6 * (0.3 + tN);

      // pull toward upper half gently
      const targetY = H * 0.35;
      c.y += (targetY - c.y) * dt * 0.05;
    }

    // Rain behavior: vertical down, faster with rain
    if (rainFactor > 0) {
      const v = baseSpeed * (0.5 + 2.2 * rainFactor);
      c.y += v * dt;
      c.x += (hx * 0.4) * dt; // still a little organic
    }

    // Wind behavior: diagonal drift
    if (windN > 0.05) {
      const drift = baseSpeed * (0.2 + 1.2 * windN);
      c.x += wx * drift * dt;
      c.y += wy * drift * dt;
    }

    // If neither sun nor rain, just mild harmonic motion
    if (sunFactor === 0 && rainFactor === 0) {
      const calm = baseSpeed * 0.12;
      c.x += (hx * calm) * dt;
      c.y += (hy * calm) * dt;
    }

    // Wrap around edges
    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;

    // Visual logging: store trail points (time passing)
    const keep = 22; // trail length
    c.trail.push({ x: c.x, y: c.y, t: nowMs });
    if (c.trail.length > keep) c.trail.shift();
  }
}

// ----- Rendering -----
function draw(nowMs) {
  const nightPermanent = toggleNight.checked;
  const bg = computeBackground();

  // Background fill
  ctx.fillStyle = nightPermanent ? "rgb(8,10,14)" : bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle time bar (visual logging of passing time)
  // A thin timeline that moves every minute.
  const minute = Math.floor(nowMs / 60000);
  const xBar = (minute % 120) / 120 * W; // cycles
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, H - 12, W, 12);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(xBar, H - 12, Math.max(2, W * 0.01), 12);

  // Trails (time history)
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

  // Circles
  for (const c of circles) {
    // Slight pulsation with π
    const pulse = 1 + 0.06 * Math.sin(c.phase / PI);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);

    // Fill
    ctx.fillStyle = circleColor(c);
    ctx.beginPath();
    ctx.arc(0, 0, c.r * pulse, 0, 2 * PI);
    ctx.fill();

    // Minimal inner marker to show rotation
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(c.r * pulse, 0);
    ctx.stroke();

    ctx.restore();
  }
}

// ----- Weather fetch (Open-Meteo) -----
async function fetchWeather() {
  // Using current_weather + hourly for cloudcover & visibility proxies
  // Open-Meteo provides: temperature_2m, is_day, weathercode, windspeed_10m, winddirection_10m
  // For cloud cover and fog, use hourly: cloudcover, visibility (fog proxy), precipitation
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${rome.lat}&longitude=${rome.lon}` +
    `&current=temperature_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m` +
    `&hourly=cloud_cover,visibility,precipitation` +
    `&timezone=Europe/Rome`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();

  const cur = data.current;
  const hourly = data.hourly;

  // Find current hour index (same timezone already)
  const nowISO = new Date().toISOString();
  // fallback: pick last
  let idx = (hourly?.time?.length || 1) - 1;
  if (hourly?.time?.length) {
    // choose closest hour
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
  weather.windMs = cur.wind_speed_10m / 3.6; // km/h -> m/s if needed; Open-Meteo is often km/h depending on config.
  weather.windDirDeg = cur.wind_direction_10m;

  const cc = hourly?.cloud_cover?.[idx];
  weather.cloudCover = (typeof cc === "number") ? cc : 30;

  const precip = hourly?.precipitation?.[idx];
  weather.rainMm = (typeof precip === "number") ? precip : 0;

  // Fog proxy via visibility: lower visibility -> more fog.
  const vis = hourly?.visibility?.[idx];
  if (typeof vis === "number") {
    // visibility is in meters. Fog rises as visibility falls.
    weather.fog = clamp(1 - (vis / 20000), 0, 1);
  } else {
    weather.fog = 0;
  }

  weather.lastUpdate = Date.now();

  statusEl.textContent =
    `Rome | ${weather.tempC.toFixed(1)}°C | ` +
    `rain ${weather.rainMm.toFixed(1)} mm/h | wind ${weather.windMs.toFixed(1)} m/s | ` +
    `cloud ${weather.cloudCover.toFixed(0)}% | fog ${(weather.fog*100).toFixed(0)}% | ` +
    `${toggleNight.checked ? "Night(permanent)" : (weather.isDay ? "Day" : "Night")}`;
}

async function scheduleWeather() {
  try {
    await fetchWeather();
  } catch (e) {
    statusEl.textContent = `Weather error (using last known values).`;
    // keep running with previous values
  } finally {
    // refresh every 10 minutes
    setTimeout(scheduleWeather, 10 * 60 * 1000);
  }
}
scheduleWeather();

// ----- Audio (simple, sync with meteo) -----
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

// Audio update: tempo/pitch driven by temperature + rain + wind
function updateAudio(dt) {
  if (!isAudioOn || !audioCtx) return;

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  // Base frequency: cold->lower, hot->higher (simple melodic behavior)
  const baseFreq = lerp(140, 520, tN);

  // Add turbulence on storms/wind
  const wobble = (rainN * 24) + (windN * 18);

  // “tempo” as amplitude pulsing speed (not a true BPM sequencer)
  const pulseHz = lerp(0.4, 2.0, tN) + rainN * 1.2;

  const time = audioCtx.currentTime;
  const f = baseFreq + Math.sin(time * (PI * 0.5)) * wobble;

  osc.frequency.setTargetAtTime(f, time, 0.02);

  // night mode -> quieter
  const night = toggleNight.checked || !weather.isDay;
  const targetGain = night ? 0.015 : 0.03;

  // rain -> more intense (but keep subtle)
  const intensity = clamp(targetGain + rainN * 0.02, 0.0, 0.06);

  // pulse
  const pulsed = intensity * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2 * PI * pulseHz)));

  gain.gain.setTargetAtTime(pulsed, time, 0.04);
}

// ----- Main loop -----
let last = performance.now();

function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  step(dt, now);
  draw(now);
  updateAudio(dt);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Keep status line updated when toggling night
toggleNight.addEventListener("change", () => {
  // update status immediately
  statusEl.textContent = statusEl.textContent.replace(/(Night\(permanent\)|Day|Night)/g, toggleNight.checked ? "Night(permanent)" : (weather.isDay ? "Day" : "Night"));
});

