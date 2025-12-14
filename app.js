// π Weather Circles — Robust build (visible circles + stable audio + safe loop)

const PI = Math.PI;

// ----- Password gate (client-side) -----
const ACCESS_PASS = "MAX72!";

const gate = document.getElementById("gate");
const gatePass = document.getElementById("gate-pass");
const gateBtn = document.getElementById("gate-btn");
const gateErr = document.getElementById("gate-err");

function normalizePass(s) {
  return (s ?? "")
    .trim()
    .replace(/\s+/g, "")
    .normalize("NFKC");
}
function unlockIfSession() {
  const ok = sessionStorage.getItem("pi_access_ok") === "1";
  gate.classList.toggle("hidden", ok);
  return ok;
}
function tryUnlock() {
  const input = normalizePass(gatePass.value);
  const target = normalizePass(ACCESS_PASS);
  if (input === target) {
    sessionStorage.setItem("pi_access_ok", "1");
    gate.classList.add("hidden");
    gateErr.textContent = "";
  } else {
    gateErr.textContent = "Wrong password.";
  }
}
gateBtn?.addEventListener("click", tryUnlock);
gatePass?.addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
unlockIfSession();

// ----- DOM -----
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
const panelLines = document.getElementById("panel-lines");

const btnGeo = document.getElementById("btn-geo");
const btnAudio = document.getElementById("btn-audio");
const toggleNight = document.getElementById("toggle-night");

const alarmEnabled = document.getElementById("alarm-enabled");
const alarmTime = document.getElementById("alarm-time");
const alarmSound = document.getElementById("alarm-sound");
const alarmTest = document.getElementById("alarm-test");
const alarmStop = document.getElementById("alarm-stop");

// Toggle details panel via full circle
btnInfo?.addEventListener("click", () => {
  const show = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !show);
  btnInfo.classList.toggle("active", show);
});

// ----- Canvas sizing -----
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

  // IMPORTANT: re-init circles when size changes
  initCircles();
}
window.addEventListener("resize", resize);
resize();

// ----- Helpers -----
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
function tempNorm(tC) { return clamp((tC - (-15)) / (50 - (-15)), 0, 1); } // [-15..50] -> [0..1]
function pad2(n){ return String(n).padStart(2,"0"); }

// ----- Location -----
const defaultLoc = { lat: 41.9028, lon: 12.4964, label: "Rome (fallback)" };
const loc = { ...defaultLoc };

try {
  const saved = JSON.parse(localStorage.getItem("pi_weather_loc") || "null");
  if (saved && typeof saved.lat === "number" && typeof saved.lon === "number") Object.assign(loc, saved);
} catch {}

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
btnGeo?.addEventListener("click", useGeolocation);

// ----- Weather -----
const weather = {
  tempC: 15,
  isDay: true,
  cloudCover: 30, // %
  fog: 0,         // 0..1 approx
  rainMm: 0,      // mm/h
  windMs: 1,      // m/s
  windDirDeg: 0,  // deg
  lastUpdate: 0
};

async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,is_day,wind_speed_10m,wind_direction_10m` +
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

  // Open-Meteo wind_speed_10m default is km/h → convert to m/s
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
  updatePanel();
}

function scheduleWeather() {
  fetchWeather().catch((e)=> {
    // show small error only in panel (if open)
    if (panelLines) {
      panelLines.innerHTML = `<div><b>Weather error:</b> ${String(e.message || e)}</div>`;
    }
  }).finally(() => setTimeout(scheduleWeather, 10 * 60 * 1000));
}
scheduleWeather();
useGeolocation(); // best effort

// ----- HUD + Panel -----
function isDayEffective() { return toggleNight?.checked ? false : weather.isDay; }

function updateHud() {
  const now = new Date();
  hudTime.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  hudTemp.textContent  = `${weather.tempC.toFixed(0)}°`;
  hudCloud.textContent = `${Math.round(weather.cloudCover)}%`;
  hudRain.textContent  = `${weather.rainMm.toFixed(1)}`;
  hudWind.textContent  = `${weather.windMs.toFixed(1)}`;
  hudFog.textContent   = `${Math.round(weather.fog * 100)}%`;
}
setInterval(updateHud, 10_000);

function updatePanel() {
  if (!panelLines) return;
  const s = getSeasonKey();
  const day = isDayEffective() ? "Day" : "Night";
  panelLines.innerHTML = `
    <div><b>Location:</b> ${loc.label} (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)})</div>
    <div><b>Local time:</b> ${new Date().toLocaleString("it-IT")}</div>
    <div><b>Temp:</b> ${weather.tempC.toFixed(1)} °C</div>
    <div><b>Cloud cover:</b> ${weather.cloudCover.toFixed(0)} %</div>
    <div><b>Rain:</b> ${weather.rainMm.toFixed(1)} mm/h</div>
    <div><b>Wind:</b> ${weather.windMs.toFixed(1)} m/s @ ${Math.round(weather.windDirDeg)}°</div>
    <div><b>Fog (proxy):</b> ${(weather.fog*100).toFixed(0)} %</div>
    <div><b>Harmony mode:</b> ${s} / ${day}</div>
    <div><b>Audio status:</b> ${audioCtx ? audioCtx.state : "off"}</div>
  `;
}

// ----- Season + seed -----
function getSeasonKey(date = new Date()) {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  return "autumn";
}
function seasonSeed(seasonKey) {
  return ({ winter: 314159, spring: 265358, summer: 979323, autumn: 846264 }[seasonKey] || 314159);
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

// ----- Visual system -----
const N = 99;
let circles = [];
let rng = mulberry32(seasonSeed(getSeasonKey()));
let currentSeason = getSeasonKey();

// make circles clearly visible:
const STROKE_PX = 2; // more visible than 1
const MIN_ALPHA = 0.62;
const MAX_ALPHA = 0.96;

function initCircles() {
  if (W <= 0 || H <= 0) return;

  currentSeason = getSeasonKey();
  rng = mulberry32(seasonSeed(currentSeason));

  circles = [];
  for (let i = 0; i < N; i++) {
    const r = lerp(6, 22, Math.pow(rng(), 1.6));
    circles.push({
      id: i,
      x: rng() * W,
      y: rng() * H,
      r,
      baseR: r,
      phase: (i + 1) * PI * (1 + (rng() - 0.5) * 0.12),
      rot: rng() * 2 * PI,
      spin: lerp(-0.9, 0.9, rng()),
      hueOffset: Math.floor(rng() * 360),
      alpha: lerp(MIN_ALPHA, MAX_ALPHA, rng()),
      trail: []
    });
  }
}

// background: blue/grey; grey more with fog; brightness with day
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

// circle stroke color: warm when hot, cool when cold (+ unique hue offsets)
function circleStrokeColor(c) {
  const t = tempNorm(weather.tempC);
  const baseHue = lerp(220, 25, t);
  const hue = (baseHue + c.hueOffset) % 360;

  const season = getSeasonKey();
  const sat = (season === "summer") ? 75 : (season === "winter") ? 60 : 68;
  const light = isDayEffective() ? lerp(54, 70, t) : lerp(40, 58, t);

  return `hsla(${hue.toFixed(0)}, ${sat}%, ${light.toFixed(0)}%, ${c.alpha.toFixed(2)})`;
}

// alarm vibration state
let alarmRinging = false;
let alarmEndsAt = 0;

// motion model
function step(dt, nowMs) {
  const s = getSeasonKey();
  if (s !== currentSeason) initCircles();

  const day = isDayEffective();
  const tN = tempNorm(weather.tempC);
  const rain = clamp(weather.rainMm, 0, 30);
  const rainN = clamp(rain / 10, 0, 1);
  const wind = clamp(weather.windMs, 0, 25);
  const windN = clamp(wind / 12, 0, 1);

  const baseSpeed = lerp(10, 55, tN);
  const sunMode = (day && rain < 0.2) ? 1 : 0;

  const windDir = (weather.windDirDeg || 0) * PI / 180;
  const wx = Math.cos(windDir) * windN;
  const wy = Math.sin(windDir) * windN;

  const vibrate = alarmRinging ? (3.0 + 4.0 * rainN) : 0;

  for (const c of circles) {
    c.phase += dt * (PI * 0.15 + c.id * 0.0007);
    c.rot += dt * c.spin * (0.8 + 1.2 * tN);

    const micro = 0.6 + 1.8 * (1 - rainN);
    const hx = Math.sin(c.phase) * micro;
    const hy = Math.cos(c.phase / PI) * micro;

    if (sunMode) {
      const rad = (18 + c.baseR * 1.3) * (0.6 + 0.6 * Math.sin(c.phase / (PI*2)));
      c.x += (Math.cos(c.phase) * rad + hx) * dt;
      c.y += (Math.sin(c.phase) * rad * 0.55 + hy) * dt;
      c.y -= dt * 6 * (0.3 + tN);

      const targetY = H * 0.35;
      c.y += (targetY - c.y) * dt * 0.05;
    }

    if (rainN > 0) {
      const v = baseSpeed * (0.5 + 2.2 * rainN);
      c.y += v * dt;
      c.x += (hx * 0.4) * dt;
    }

    if (windN > 0.05) {
      const drift = baseSpeed * (0.2 + 1.2 * windN);
      c.x += wx * drift * dt;
      c.y += wy * drift * dt;
    }

    if (!sunMode && rainN === 0) {
      const calm = baseSpeed * 0.12;
      c.x += (hx * calm) * dt;
      c.y += (hy * calm) * dt;
    }

    // alarm jitter
    if (vibrate > 0) {
      c.x += (Math.sin(nowMs / 37 + c.id) * vibrate) * dt * 60;
      c.y += (Math.cos(nowMs / 41 + c.id) * vibrate) * dt * 60;
    }

    // wrap
    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;

    // trail
    const keep = 18;
    c.trail.push({ x: c.x, y: c.y });
    if (c.trail.length > keep) c.trail.shift();
  }

  if (alarmRinging && nowMs >= alarmEndsAt) stopAlarm();
}

function draw(nowMs) {
  ctx.fillStyle = toggleNight?.checked ? "rgb(8,10,14)" : computeBackground();
  ctx.fillRect(0, 0, W, H);

  // time bar
  const minute = Math.floor(nowMs / 60000);
  const xBar = (minute % 120) / 120 * W;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, H - 12, W, 12);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(xBar, H - 12, Math.max(2, W * 0.01), 12);

  ctx.lineWidth = STROKE_PX;

  for (const c of circles) {
    const col = circleStrokeColor(c);

    // trails
    for (let i = 0; i < c.trail.length - 1; i++) {
      const a = i / c.trail.length;
      ctx.strokeStyle = col.replace(/[\d.]+\)$/, `${(0.10 * a).toFixed(3)})`);
      ctx.beginPath();
      ctx.moveTo(c.trail[i].x, c.trail[i].y);
      ctx.lineTo(c.trail[i+1].x, c.trail[i+1].y);
      ctx.stroke();
    }

    // circle stroke
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);

    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, c.r * (1 + 0.05 * Math.sin(c.phase / PI)), 0, 2 * PI);
    ctx.stroke();

    // marker
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(c.r, 0);
    ctx.stroke();

    ctx.restore();
  }
}

// ----- Audio: harmonic chords by season + day/night -----
let audioCtx = null;
let master = null;
let chordOscs = [];
let chordGains = [];
let lfo = null;
let lfoGain = null;
let nextHitAt = 0;
let alarmNode = null;

function startAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0.02;
  master.connect(audioCtx.destination);

  // 3-voice chord
  for (let i = 0; i < 3; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    g.gain.value = 0.0;
    o.connect(g);
    g.connect(master);
    o.start();
    chordOscs.push(o);
    chordGains.push(g);
  }

  // subtle LFO
  lfo = audioCtx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.35;
  lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 12; // Hz depth
  lfo.connect(lfoGain);
  lfoGain.connect(chordOscs[0].frequency);
  lfo.start();

  btnAudio.textContent = "Audio enabled";
  updatePanel();
}

async function resumeAudioIfNeeded() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}

btnAudio?.addEventListener("click", async () => {
  startAudio();
  await resumeAudioIfNeeded();
});

// If user clicks anywhere, and audio was already created, try resume (fix “enabled but silent”)
document.addEventListener("pointerdown", () => {
  resumeAudioIfNeeded();
}, { passive: true });

const CHORDS = {
  winter: { day: [0, 3, 7], night: [0, 2, 7] },
  spring: { day: [0, 4, 7], night: [0, 3, 7] },
  summer: { day: [0, 4, 7], night: [0, 5, 9] },
  autumn: { day: [0, 3, 7], night: [0, 3, 10] }
};

function setChordFrequencies(baseHz, intervals) {
  const t = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    const semis = intervals[i] ?? intervals[intervals.length - 1];
    const hz = baseHz * Math.pow(2, semis / 12);
    chordOscs[i].frequency.setTargetAtTime(hz, t, 0.03);
  }
}

function hitChord(velocity = 0.03) {
  const t = audioCtx.currentTime;
  for (const g of chordGains) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(velocity, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  }
}

function updateHarmony(nowMs) {
  if (!audioCtx) return;

  const season = getSeasonKey();
  const mode = isDayEffective() ? "day" : "night";
  const intervals = CHORDS[season]?.[mode] || [0, 3, 7];

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const baseHz = lerp(140, 520, tN);

  const bpm = lerp(38, 110, clamp(tN + rainN * 0.55 + windN * 0.15, 0, 1));
  const intervalMs = 60000 / bpm;

  const nightSoft = (toggleNight?.checked || !weather.isDay);
  const velocity = nightSoft ? 0.018 : 0.03;

  master.gain.setTargetAtTime(clamp(velocity + rainN * 0.010, 0.012, 0.05), audioCtx.currentTime, 0.08);
  lfo.frequency.setTargetAtTime(lerp(0.20, 0.90, clamp(tN + rainN * 0.4, 0, 1)), audioCtx.currentTime, 0.1);

  setChordFrequencies(baseHz, intervals);

  if (nowMs >= nextHitAt) {
    nextHitAt = nowMs + intervalMs;
    const flip = (Math.sin(nowMs / 1000) > 0.6);
    if (flip) setChordFrequencies(baseHz * 0.5, [intervals[1], intervals[2], (intervals[0] + 12)]);
    hitChord(master.gain.value);
  }
}

// ----- Alarm -----
let alarmTimer = null;

function loadAlarmPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem("pi_alarm") || "null");
    if (!saved) return;
    alarmEnabled.checked = !!saved.enabled;
    alarmTime.value = saved.time || "";
    alarmSound.value = saved.sound || "siren";
  } catch {}
}
function saveAlarmPrefs() {
  try {
    localStorage.setItem("pi_alarm", JSON.stringify({
      enabled: alarmEnabled.checked,
      time: alarmTime.value,
      sound: alarmSound.value
    }));
  } catch {}
}
alarmEnabled?.addEventListener("change", saveAlarmPrefs);
alarmTime?.addEventListener("change", saveAlarmPrefs);
alarmSound?.addEventListener("change", saveAlarmPrefs);
loadAlarmPrefs();

function startAlarm(durationMs = 30000) {
  startAudio();
  resumeAudioIfNeeded();

  alarmRinging = true;
  alarmEndsAt = performance.now() + durationMs;

  if (alarmSound.value === "siren") playSiren(durationMs);
  else playTrumpet(durationMs);
}

function stopAlarm() {
  alarmRinging = false;
  alarmEndsAt = 0;
  if (alarmNode) {
    try { alarmNode.stop(); } catch {}
    alarmNode = null;
  }
}

alarmTest?.addEventListener("click", () => startAlarm(8000));
alarmStop?.addEventListener("click", stopAlarm);

function scheduleAlarmTick() {
  if (alarmTimer) clearInterval(alarmTimer);
  alarmTimer = setInterval(() => {
    if (!alarmEnabled?.checked) return;
    if (!alarmTime?.value) return;

    const now = new Date();
    const [hh, mm] = alarmTime.value.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;

    if (now.getHours() === hh && now.getMinutes() === mm && now.getSeconds() < 3) {
      startAlarm(30000);
    }
  }, 1000);
}
scheduleAlarmTick();
alarmEnabled?.addEventListener("change", scheduleAlarmTick);
alarmTime?.addEventListener("change", scheduleAlarmTick);

function playSiren(durationMs) {
  const t0 = audioCtx.currentTime;
  const dur = durationMs / 1000;

  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sawtooth";
  g.gain.value = 0.0;

  o.connect(g);
  g.connect(audioCtx.destination);

  o.frequency.setValueAtTime(520, t0);

  const sweeps = Math.max(1, Math.floor(dur / 1.2));
  for (let i = 0; i < sweeps; i++) {
    const a = t0 + i * 1.2;
    o.frequency.linearRampToValueAtTime(880, a + 0.55);
    o.frequency.linearRampToValueAtTime(520, a + 1.10);
  }

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  o.start(t0);
  o.stop(t0 + dur + 0.05);
  alarmNode = o;
}

function playTrumpet(durationMs) {
  const t0 = audioCtx.currentTime;
  const dur = durationMs / 1000;

  const g = audioCtx.createGain();
  g.gain.value = 0.0;
  g.connect(audioCtx.destination);

  const o1 = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  o1.type = "square";
  o2.type = "triangle";

  o1.connect(g);
  o2.connect(g);

  const notes = [392, 494, 587, 784, 587, 494, 392]; // ceremonial-ish
  const step = 0.32;

  for (let i = 0; i < Math.floor(dur / step); i++) {
    const tt = t0 + i * step;
    const n = notes[i % notes.length];

    o1.frequency.setValueAtTime(n, tt);
    o2.frequency.setValueAtTime(n * 0.5, tt);

    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(0.14, tt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.22);
  }

  o1.start(t0);
  o2.start(t0);
  o1.stop(t0 + dur + 0.05);
  o2.stop(t0 + dur + 0.05);

  alarmNode = o1;
}

// ----- Safe main loop -----
let last = performance.now();

function loop(now) {
  try {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    step(dt, now);
    draw(now);
    updateHud();
    if (audioCtx) updateHarmony(now);

  } catch (e) {
    // If something breaks, show it in panel to avoid "silent freeze"
    if (panelLines) {
      panelLines.innerHTML = `<div><b>Runtime error:</b> ${String(e?.message || e)}</div>`;
    }
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

toggleNight?.addEventListener("change", () => {
  updateHud();
  updatePanel();
});

// initial HUD
updateHud();
updatePanel();
