// π Weather Circles — clean restart (password + visible circles + audio + meteo + geo)

const PI = Math.PI;

// ---------------- Password gate ----------------
const ACCESS_PASS = "MAX72!";

const gate = document.getElementById("gate");
const gatePass = document.getElementById("gate-pass");
const gateBtn = document.getElementById("gate-btn");
const gateErr = document.getElementById("gate-err");

function normalizePass(s) {
  return (s ?? "").trim().replace(/\s+/g, "").normalize("NFKC");
}
function unlockGate() {
  const ok = normalizePass(gatePass.value) === normalizePass(ACCESS_PASS);
  if (ok) {
    gate.classList.add("hidden");
    gateErr.textContent = "";
    start(); // start animation only after unlock
  } else {
    gateErr.textContent = "Wrong password.";
  }
}
gateBtn.addEventListener("click", unlockGate);
gatePass.addEventListener("keydown", (e) => { if (e.key === "Enter") unlockGate(); });

// ---------------- DOM ----------------
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const hudTime  = document.getElementById("hud-time");
const hudTemp  = document.getElementById("hud-temp");
const hudCloud = document.getElementById("hud-cloud");
const hudRain  = document.getElementById("hud-rain");
const hudWind  = document.getElementById("hud-wind");
const hudFog   = document.getElementById("hud-fog");

const btnInfo = document.getElementById("btn-info");
const panel = document.getElementById("panel");
const panelText = document.getElementById("panel-text");

const btnGeo = document.getElementById("btn-geo");
const btnAudio = document.getElementById("btn-audio");
const toggleNight = document.getElementById("toggle-night");

// panel toggle
btnInfo.addEventListener("click", () => {
  const show = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !show);
  btnInfo.classList.toggle("active", show);
});

// ---------------- Canvas sizing ----------------
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
window.addEventListener("resize", () => {
  resize();
  initCircles();
});
resize();

// ---------------- Helpers ----------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
function pad2(n){ return String(n).padStart(2,"0"); }
function tempNorm(tC){ return clamp((tC - (-15)) / (50 - (-15)), 0, 1); } // -15..50 -> 0..1

function isDayEffective() {
  return toggleNight.checked ? false : weather.isDay;
}

// ---------------- Location + Weather ----------------
const defaultLoc = { lat: 41.9028, lon: 12.4964, label: "Rome (fallback)" };
const loc = { ...defaultLoc };

try {
  const saved = JSON.parse(localStorage.getItem("pi_weather_loc") || "null");
  if (saved && typeof saved.lat === "number" && typeof saved.lon === "number") Object.assign(loc, saved);
} catch {}

const weather = {
  tempC: 15,
  isDay: true,
  cloudCover: 30,
  fog: 0,
  rainMm: 0,
  windMs: 1,
  windDirDeg: 0,
  lastUpdate: 0
};

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
  const h = data.hourly;

  // closest hour index
  let idx = (h?.time?.length || 1) - 1;
  if (h?.time?.length) {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < h.time.length; i++) {
      const tt = new Date(h.time[i]).getTime();
      const d = Math.abs(Date.now() - tt);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    idx = best;
  }

  weather.tempC = cur.temperature_2m;
  weather.isDay = !!cur.is_day;

  // Open-Meteo: wind_speed_10m usually km/h -> m/s
  weather.windMs = (cur.wind_speed_10m != null) ? (cur.wind_speed_10m / 3.6) : 1;
  weather.windDirDeg = cur.wind_direction_10m || 0;

  weather.cloudCover = typeof h.cloud_cover?.[idx] === "number" ? h.cloud_cover[idx] : 30;
  weather.rainMm = typeof h.precipitation?.[idx] === "number" ? h.precipitation[idx] : 0;

  const vis = h.visibility?.[idx];
  weather.fog = typeof vis === "number" ? clamp(1 - (vis / 20000), 0, 1) : 0;

  weather.lastUpdate = Date.now();
  updateHud();
  updatePanel();
}

function scheduleWeather() {
  fetchWeather().catch((e) => {
    panelText.textContent = `Weather error: ${String(e.message || e)}`;
  }).finally(() => setTimeout(scheduleWeather, 10 * 60 * 1000));
}

function useGeolocation() {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      loc.lat = pos.coords.latitude;
      loc.lon = pos.coords.longitude;
      loc.label = "My location";
      try { localStorage.setItem("pi_weather_loc", JSON.stringify(loc)); } catch {}
      fetchWeather().catch(()=>{});
    },
    () => {},
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
  );
}
btnGeo.addEventListener("click", useGeolocation);

// ---------------- HUD + panel ----------------
function updateHud() {
  const now = new Date();
  hudTime.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  hudTemp.textContent = `${weather.tempC.toFixed(0)}°`;
  hudCloud.textContent = `${Math.round(weather.cloudCover)}%`;
  hudRain.textContent = `${weather.rainMm.toFixed(1)}`;
  hudWind.textContent = `${weather.windMs.toFixed(1)}`;
  hudFog.textContent = `${Math.round(weather.fog * 100)}%`;
}
setInterval(updateHud, 10_000);

function updatePanel() {
  const day = isDayEffective() ? "Day" : "Night";
  panelText.innerHTML = `
    <div><b>Location:</b> ${loc.label} (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)})</div>
    <div><b>Time:</b> ${new Date().toLocaleString()}</div>
    <div><b>Temp:</b> ${weather.tempC.toFixed(1)} °C</div>
    <div><b>Cloud:</b> ${weather.cloudCover.toFixed(0)} %</div>
    <div><b>Rain:</b> ${weather.rainMm.toFixed(1)} mm/h</div>
    <div><b>Wind:</b> ${weather.windMs.toFixed(1)} m/s @ ${Math.round(weather.windDirDeg)}°</div>
    <div><b>Fog:</b> ${(weather.fog * 100).toFixed(0)} % (proxy)</div>
    <div><b>Mode:</b> ${day}</div>
    <div><b>Audio:</b> ${audioCtx ? audioCtx.state : "off"}</div>
  `;
}

// ---------------- Visual: 99 circles ----------------
const N = 99;
let circles = [];

function initCircles() {
  circles = [];
  for (let i = 0; i < N; i++) {
    circles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 6 + Math.random() * 18,
      phase: (i + 1) * PI,
      spin: -0.8 + Math.random() * 1.6,
      hue: Math.random() * 360,
      a: 0.65 + Math.random() * 0.35,
      trail: []
    });
  }
}
initCircles();

function computeBackground() {
  const day = isDayEffective() ? 1 : 0;
  const clouds = clamp(weather.cloudCover / 100, 0, 1);
  const fog = clamp(weather.fog, 0, 1);

  const blueT = day * (1 - 0.65 * clouds);
  const greyT = clamp(0.12 + 0.62 * fog + 0.30 * clouds + (1 - day) * 0.34, 0, 1);

  const r = Math.floor(lerp(8, 92, greyT));
  const g = Math.floor(lerp(12, 102, greyT));
  const b = Math.floor(lerp(26, 165, greyT + blueT * 0.50));
  return `rgb(${r},${g},${b})`;
}

function circleStroke(c) {
  // warm/cool by temperature
  const t = tempNorm(weather.tempC);
  const baseHue = lerp(220, 25, t); // cold->blue, hot->orange
  const hue = (baseHue + c.hue) % 360;
  const light = isDayEffective() ? lerp(52, 72, t) : lerp(40, 58, t);
  return `hsla(${hue.toFixed(0)}, 72%, ${light.toFixed(0)}%, ${c.a.toFixed(2)})`;
}

// motion: sun gentle / rain vertical / wind oblique
function step(dt, nowMs) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const baseSpeed = lerp(10, 55, tN);
  const day = isDayEffective();
  const sunMode = day && rainN < 0.02;

  const windDir = (weather.windDirDeg || 0) * PI / 180;
  const wx = Math.cos(windDir) * windN;
  const wy = Math.sin(windDir) * windN;

  for (const c of circles) {
    c.phase += dt * (PI * 0.18 + c.spin * 0.01);

    // harmonic micro motion
    const hx = Math.sin(c.phase) * (0.8 + 1.6 * (1 - rainN));
    const hy = Math.cos(c.phase / PI) * (0.8 + 1.6 * (1 - rainN));

    if (sunMode) {
      c.x += (Math.cos(c.phase) * 18 + hx) * dt;
      c.y += (Math.sin(c.phase) * 10 + hy) * dt;
      c.y -= dt * (6 + 10 * tN);
      c.y += (H * 0.35 - c.y) * dt * 0.05;
    } else {
      // rain vertical
      c.y += baseSpeed * (0.3 + 2.0 * rainN) * dt;
      c.x += hx * dt * 2;
    }

    // wind drift
    c.x += wx * baseSpeed * (0.4 + 1.2 * windN) * dt;
    c.y += wy * baseSpeed * (0.4 + 1.2 * windN) * dt;

    // wrap
    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;

    // trail
    c.trail.push({ x: c.x, y: c.y });
    if (c.trail.length > 14) c.trail.shift();
  }
}

function draw(nowMs) {
  ctx.fillStyle = toggleNight.checked ? "rgb(8,10,14)" : computeBackground();
  ctx.fillRect(0, 0, W, H);

  ctx.lineWidth = 3; // very visible

  for (const c of circles) {
    // trails
    const col = circleStroke(c);
    for (let i = 0; i < c.trail.length - 1; i++) {
      const a = i / c.trail.length;
      ctx.strokeStyle = col.replace(/[\d.]+\)$/, `${(0.12 * a).toFixed(3)})`);
      ctx.beginPath();
      ctx.moveTo(c.trail[i].x, c.trail[i].y);
      ctx.lineTo(c.trail[i+1].x, c.trail[i+1].y);
      ctx.stroke();
    }

    // circle (stroke only)
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, 2 * PI);
    ctx.stroke();
  }

  // tiny debug stamp (to prove JS running)
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "12px Arial";
  ctx.fillText("RUNNING", 12, H - 16);
}

// ---------------- Audio (harmonic chord) ----------------
let audioCtx = null;
let master = null;
let oscs = [];
let nextPulseAt = 0;

function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0.03;
  master.connect(audioCtx.destination);

  // triad (C minor) - will be modulated by temperature
  const freqs = [261.63, 311.13, 392.00];
  for (const f of freqs) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.value = 0.0;
    o.connect(g);
    g.connect(master);
    o.start();
    oscs.push({ o, g });
  }

  btnAudio.textContent = "Audio enabled";
  updatePanel();
}

async function resumeAudio() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}

btnAudio.addEventListener("click", async () => {
  startAudio();
  await resumeAudio();
});

document.addEventListener("pointerdown", () => {
  resumeAudio();
}, { passive: true });

function updateAudio(nowMs) {
  if (!audioCtx) return;

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);

  // pitch shift by temperature
  const base = lerp(150, 420, tN);
  const intervals = [0, 3, 7]; // minor chord
  for (let i = 0; i < oscs.length; i++) {
    const hz = base * Math.pow(2, intervals[i] / 12);
    oscs[i].o.frequency.setTargetAtTime(hz, audioCtx.currentTime, 0.05);
  }

  // pulse rhythm by meteo
  const bpm = lerp(40, 110, clamp(tN + rainN * 0.6, 0, 1));
  const intervalMs = 60000 / bpm;

  if (nowMs >= nextPulseAt) {
    nextPulseAt = nowMs + intervalMs;

    const t = audioCtx.currentTime;
    const vel = lerp(0.015, 0.05, clamp(tN + rainN * 0.5, 0, 1));

    for (const { g } of oscs) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    }
  }
}

// ---------------- Main loop control ----------------
let running = false;
let last = performance.now();

function start() {
  if (running) return;
  running = true;

  // start meteo fetch loop
  fetchWeather().catch(()=>{});
  scheduleWeather();

  // main render loop
  last = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;

  step(dt, now);
  draw(now);
  updateHud();
  updateAudio(now);

  requestAnimationFrame(loop);
}

// toggle night affects immediately
toggleNight.addEventListener("change", () => updatePanel());
