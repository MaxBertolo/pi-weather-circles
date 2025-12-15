// π Weather Art — 3 modes: circles / splash / diamonds
// - same background, weather, audio, alarm, menu
// - pink dot always present; opens menu; bounces; rotates slower

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

// MODE PICKER UI
const modePicker = document.getElementById("modePicker");
const btnSkip = document.getElementById("btn-skip");

// MENU UI
const overlay = document.getElementById("overlay");
const btnExit = document.getElementById("btn-exit");

const ovTime  = document.getElementById("ov-time");
const ovTemp  = document.getElementById("ov-temp");
const ovCloud = document.getElementById("ov-cloud");
const ovRain  = document.getElementById("ov-rain");
const ovWind  = document.getElementById("ov-wind");
const ovFog   = document.getElementById("ov-fog");

const btnGeo = document.getElementById("btn-geo");
const btnAudio = document.getElementById("btn-audio");
const audioGenreSel = document.getElementById("audio-genre");
const artModeSel = document.getElementById("art-mode");

const volSlider = document.getElementById("audio-volume");
const volVal = document.getElementById("audio-volume-val");
const toggleNight = document.getElementById("toggle-night");

const alarmEnabled = document.getElementById("alarm-enabled");
const alarmTime = document.getElementById("alarm-time");
const alarmSound = document.getElementById("alarm-sound");
const alarmTest = document.getElementById("alarm-test");
const alarmStop = document.getElementById("alarm-stop");

// ---------- Helpers ----------
const PI = Math.PI;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const pad2 = (n) => String(n).padStart(2, "0");
function tempNorm(tC) { return clamp((tC - (-15)) / (50 - (-15)), 0, 1); }
function mmToPx(mm) { return mm * (96 / 25.4); }

function seasonKey(d = new Date()) {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  return "autumn";
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
function seasonSeed(sk) {
  return ({ winter: 314159, spring: 265358, summer: 979323, autumn: 846264 }[sk] || 314159);
}
function isDayEffective() { return toggleNight.checked ? false : weather.isDay; }

// ---------- Overlays ----------
function openConsole() {
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
}
function closeConsole() {
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
}
btnExit.addEventListener("click", closeConsole);
overlay.addEventListener("pointerdown", (e) => {
  if (e.target === overlay) closeConsole();
}, { passive: true });

// ---------- Resize ----------
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", () => { resize(); initArt(currentMode); });
resize();

// ---------- Weather ----------
const weather = {
  tempC: 18,
  cloudCover: 40,
  rainMm: 0,
  windMs: 1,
  windDirDeg: 0,
  fog: 0.1,
  isDay: true
};

async function fetchWeather(lat = 41.9, lon = 12.5) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,is_day,wind_speed_10m,wind_direction_10m` +
    `&hourly=cloud_cover,visibility,precipitation&timezone=auto`;

  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json();

  weather.tempC = d.current.temperature_2m;
  weather.isDay = !!d.current.is_day;
  weather.windMs = (d.current.wind_speed_10m ?? 4) / 3.6;
  weather.windDirDeg = d.current.wind_direction_10m ?? 0;

  const i = d.hourly.time.length - 1;
  weather.cloudCover = d.hourly.cloud_cover[i] ?? 30;
  weather.rainMm = d.hourly.precipitation[i] ?? 0;

  const vis = d.hourly.visibility[i];
  weather.fog = (typeof vis === "number") ? clamp(1 - vis / 20000, 0, 1) : 0;

  updateConsoleValues();
}
btnGeo.addEventListener("click", () => {
  navigator.geolocation?.getCurrentPosition(
    (p) => fetchWeather(p.coords.latitude, p.coords.longitude),
    () => fetchWeather()
  );
});
fetchWeather().catch(()=>{});
setInterval(() => fetchWeather().catch(()=>{}), 10 * 60 * 1000);

// ---------- Console values ----------
function updateConsoleValues() {
  const now = new Date();
  ovTime.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  ovTemp.textContent  = `${Math.round(weather.tempC)}°C`;
  ovCloud.textContent = `${Math.round(weather.cloudCover)}%`;
  ovRain.textContent  = `${weather.rainMm.toFixed(1)} mm/h`;
  ovWind.textContent  = `${weather.windMs.toFixed(1)} m/s`;
  ovFog.textContent   = `${Math.round(weather.fog * 100)}%`;
}
setInterval(updateConsoleValues, 10_000);

// ---------- Background ----------
function bg() {
  const day = isDayEffective();
  const clouds = clamp(weather.cloudCover / 100, 0, 1);
  const fog = clamp(weather.fog, 0, 1);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 14, 0, 1);

  const sunny = day && clouds < 0.25 && fog < 0.25 && rainN < 0.03;
  const stormN = clamp(rainN * 0.75 + windN * 0.25 + clouds * 0.35, 0, 1);

  if (!day) {
    const lift = clamp(clouds * 0.35 + fog * 0.55, 0, 1);
    const v = Math.floor(lerp(10, 55, lift));
    return `rgb(${v},${v},${v})`;
  }
  if (sunny) return `rgb(255,255,255)`;

  if (stormN > 0.65) {
    const t = clamp((stormN - 0.65) / 0.35, 0, 1);
    const v = Math.floor(lerp(215, 150, t));
    return `rgb(${v},${v},${v})`;
  }

  const lightGreyMix = clamp(clouds * 0.65 + fog * 0.85, 0, 1);
  const v = Math.floor(lerp(255, 240, lightGreyMix));
  return `rgb(${v},${v},${v})`;
}

// ===================== ART MODES =====================
const MODES = ["circles", "splash", "diamonds"];
let currentMode = "circles";

function loadMode() {
  try {
    const m = localStorage.getItem("pi_mode");
    if (m && MODES.includes(m)) currentMode = m;
  } catch {}
  artModeSel.value = currentMode;
}
function saveMode(m) {
  currentMode = m;
  artModeSel.value = m;
  try { localStorage.setItem("pi_mode", m); } catch {}
}

function showModePicker() {
  modePicker.classList.remove("hidden");
  modePicker.setAttribute("aria-hidden", "false");
}
function hideModePicker() {
  modePicker.classList.add("hidden");
  modePicker.setAttribute("aria-hidden", "true");
}

modePicker.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  const m = btn.getAttribute("data-mode");
  if (!MODES.includes(m)) return;
  saveMode(m);
  initArt(currentMode);
  hideModePicker();
});

btnSkip.addEventListener("click", () => {
  loadMode();
  initArt(currentMode);
  hideModePicker();
});

artModeSel.addEventListener("change", () => {
  const m = artModeSel.value;
  saveMode(m);
  initArt(currentMode);
});

// ---------- Shared “pink dot” ----------
let infoDot = null;

// ---------- Shapes per mode ----------
let circles = [];   // circles mode
let splashes = [];  // splash mode
let diamonds = [];  // diamonds mode

// Diamonds palette (edit freely if you want to match your slide precisely)
const DIAMOND_PALETTE = [
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759",
  "#0A84FF", "#5E5CE6", "#AF52DE", "#FF2D55",
  "#00C7BE", "#64D2FF"
];

function initArt(mode) {
  const rng = mulberry32(seasonSeed(seasonKey()));
  circles = [];
  splashes = [];
  diamonds = [];

  // keep pink dot always (same)
  infoDot = {
    x: rng() * W,
    y: rng() * H,
    r: mmToPx(3),
    p: rng() * TAU,
    s: 1.0,
    speedMul: 1.75,
    vx: (rng() < 0.5 ? -1 : 1) * lerp(90, 170, rng()),
    vy: (rng() < 0.5 ? -1 : 1) * lerp(90, 170, rng()),
    squashPhase: rng() * TAU,
    squashSpeed: 0.85,
    squashBase: 0.02,
    squashMax: 0.18,
    rotPhase: rng() * TAU,
    rotSpeed: 0.35,   // slow rotation
    squash: 0,
    rot: 0
  };

  if (mode === "circles") {
    const N = 199;
    for (let i = 0; i < N; i++) {
      const baseR = 8 + rng() * 16;
      const r = baseR * 4.0;
      circles.push({
        x: rng() * W,
        y: rng() * H,
        r,
        p: (i + 1) * PI,
        s: lerp(0.92, 1.08, rng()),
        h: rng() * 360,

        squashPhase: rng() * TAU,
        squashSpeed: 0.6 + rng(),
        squashBase: 0.03 + rng() * 0.05,
        squashMax: 0.10 + rng() * 0.18,
        rotPhase: rng() * TAU,
        rotSpeed: 0.2 + rng() * 0.7,
        squash: 0,
        rot: 0
      });
    }
  }

  if (mode === "splash") {
    // Fewer, larger blobs to read well
    const N = 70;
    for (let i = 0; i < N; i++) {
      const base = lerp(22, 70, rng());
      const points = Math.floor(lerp(7, 12, rng()));
      const amps = Array.from({ length: points }, () => lerp(0.15, 0.55, rng()));
      const phases = Array.from({ length: points }, () => rng() * TAU);

      splashes.push({
        x: rng() * W,
        y: rng() * H,
        base,
        points,
        amps,
        phases,
        wob: 0.6 + rng() * 1.3,
        drift: 0.6 + rng() * 0.8,
        rot: rng() * TAU,
        rotSpeed: lerp(-0.10, 0.10, rng()),
        p: rng() * TAU
      });
    }
  }

  if (mode === "diamonds") {
    const N = 130;
    for (let i = 0; i < N; i++) {
      const size = lerp(16, 70, rng());
      diamonds.push({
        x: rng() * W,
        y: rng() * H,
        size,
        a: rng() * TAU,
        spin: lerp(-0.25, 0.25, rng()),
        skewPhase: rng() * TAU,
        skewSpeed: 0.4 + rng() * 1.0,
        skewAmt: 0.08 + rng() * 0.22,
        vx: lerp(-18, 18, rng()),
        vy: lerp(-18, 18, rng()),
        color: DIAMOND_PALETTE[i % DIAMOND_PALETTE.length],
        alpha: lerp(0.65, 0.95, rng())
      });
    }
  }
}

// initial mode logic
loadMode();
showModePicker();

// pink dot click -> open menu
canvas.addEventListener("pointerdown", (e) => {
  if (!overlay.classList.contains("hidden")) return;
  if (!infoDot) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const dx = x - infoDot.x;
  const dy = y - infoDot.y;
  const d = Math.sqrt(dx*dx + dy*dy);

  if (d <= infoDot.r + 40) {
    updateConsoleValues();
    openConsole();
  }
}, { passive: true });

// ===================== ALARM vibration =====================
let alarmRinging = false;
let alarmEndsAt = 0;

// ===================== MOTION =====================
function step(dt, ms) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const base = lerp(14, 60, tN);
  const windDir = (weather.windDirDeg || 0) * PI / 180;
  const wx = Math.cos(windDir) * windN;
  const wy = Math.sin(windDir) * windN;

  const vibr = alarmRinging ? (3.5 + 6.0 * rainN) : 0;
  const squashWeather = clamp(0.15 + windN * 0.75 + rainN * 0.55, 0, 1);

  // ---- Mode: circles ----
  if (currentMode === "circles") {
    for (const c of circles) {
      c.p += dt * (PI * 0.18 + c.s * 0.06);

      c.squashPhase += dt * c.squashSpeed * (0.8 + 1.4 * rainN);
      c.rotPhase    += dt * c.rotSpeed * (0.7 + 1.2 * windN);
      const osc = Math.sin(c.squashPhase);
      c.squash = (c.squashBase + c.squashMax * squashWeather) * osc;
      c.rot = (Math.sin(c.rotPhase) * 0.35) * (0.15 + 0.85 * windN);

      const hx = Math.sin(c.p) * (0.9 + 1.3 * (1 - rainN));
      const hy = Math.cos(c.p / PI) * (0.9 + 1.3 * (1 - rainN));

      const sunMode = isDayEffective() && rainN < 0.02;

      if (sunMode) {
        c.x += (Math.cos(c.p) * 18 + hx) * dt;
        c.y += (Math.sin(c.p) * 10 + hy) * dt;
        c.y -= dt * (6 + 10 * tN) * 0.9;
        c.y += (H * 0.35 - c.y) * dt * 0.05;
      } else {
        c.y += base * (0.3 + 2.0 * rainN) * dt * 0.9;
        c.x += hx * dt * 2;
      }

      c.x += wx * base * (0.5 + 1.2 * windN) * dt;
      c.y += wy * base * (0.5 + 1.2 * windN) * dt;

      if (vibr > 0) {
        c.x += Math.sin(ms / 35 + c.p) * vibr * dt * 60;
        c.y += Math.cos(ms / 41 + c.p) * vibr * dt * 60;
      }

      if (c.x < -c.r) c.x = W + c.r;
      if (c.x > W + c.r) c.x = -c.r;
      if (c.y < -c.r) c.y = H + c.r;
      if (c.y > H + c.r) c.y = -c.r;
    }
  }

  // ---- Mode: splash ----
  if (currentMode === "splash") {
    // pioggia => più espansione (breathing più forte + più instabile)
    const expand = lerp(0.08, 0.55, rainN);
    const storm = clamp(rainN * 0.8 + windN * 0.35, 0, 1);

    for (const s of splashes) {
      s.p += dt * s.wob * (0.7 + 1.6 * storm);
      s.rot += dt * s.rotSpeed * (0.4 + 1.4 * windN);

      // vento sposta lo schizzo
      s.x += wx * base * s.drift * dt * 1.35;
      s.y += wy * base * s.drift * dt * 1.35;

      // gravità lieve quando piove
      s.y += base * (0.12 + 0.55 * rainN) * dt * 0.35;

      // vibrazione sveglia
      if (vibr > 0) {
        s.x += Math.sin(ms / 28 + s.p) * vibr * dt * 55;
        s.y += Math.cos(ms / 33 + s.p) * vibr * dt * 55;
      }

      // wrap
      const pad = 120;
      if (s.x < -pad) s.x = W + pad;
      if (s.x > W + pad) s.x = -pad;
      if (s.y < -pad) s.y = H + pad;
      if (s.y > H + pad) s.y = -pad;

      // breathing factor computed in draw via s.p, expand, storm
      s._expand = expand;
      s._storm = storm;
    }
  }

  // ---- Mode: diamonds ----
  if (currentMode === "diamonds") {
    const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);

    for (const d of diamonds) {
      d.a += dt * d.spin * (0.6 + 1.8 * windN);
      d.skewPhase += dt * d.skewSpeed * (0.7 + 1.3 * storm);

      // drift + wind vector
      d.x += (d.vx + wx * base * 1.6) * dt;
      d.y += (d.vy + wy * base * 1.6) * dt;

      // rain adds down force
      d.y += base * (0.05 + 0.45 * rainN) * dt;

      if (vibr > 0) {
        d.x += Math.sin(ms / 31 + d.a) * vibr * dt * 60;
        d.y += Math.cos(ms / 37 + d.a) * vibr * dt * 60;
      }

      const pad = 140;
      if (d.x < -pad) d.x = W + pad;
      if (d.x > W + pad) d.x = -pad;
      if (d.y < -pad) d.y = H + pad;
      if (d.y > H + pad) d.y = -pad;
    }
  }

  // ---- Pink dot (always bounce) ----
  if (infoDot) {
    const speedWeather = lerp(0.85, 1.25, clamp(tN * 0.7 + rainN * 0.5 + windN * 0.2, 0, 1));
    const speed = infoDot.speedMul * speedWeather;

    infoDot.squashPhase += dt * infoDot.squashSpeed * (1.0 + 1.6 * rainN);
    infoDot.rotPhase    += dt * infoDot.rotSpeed * (0.8 + 1.6 * windN);
    const oscP = Math.sin(infoDot.squashPhase);
    infoDot.squash = (infoDot.squashBase + infoDot.squashMax * squashWeather) * oscP;
    infoDot.rot = (Math.sin(infoDot.rotPhase) * 0.6) * (0.15 + 0.85 * windN);

    infoDot.vx += wx * 12 * dt;
    infoDot.vy += wy * 12 * dt;

    // slow p rotation (so it "turns" slower)
    infoDot.p += dt * (PI * 0.14 + infoDot.s * 0.06) * speed;

    const wobX = Math.sin(infoDot.p) * (14 + 10 * (1 - rainN));
    const wobY = Math.cos(infoDot.p / PI) * (10 + 8 * (1 - rainN));

    infoDot.x += (infoDot.vx * dt) * speed + wobX * dt;
    infoDot.y += (infoDot.vy * dt) * speed + wobY * dt;

    if (vibr > 0) {
      infoDot.x += Math.sin(ms / 35) * vibr * dt * 70;
      infoDot.y += Math.cos(ms / 41) * vibr * dt * 70;
    }

    const r = infoDot.r;
    if (infoDot.x <= r) { infoDot.x = r; infoDot.vx = Math.abs(infoDot.vx); }
    if (infoDot.x >= W - r) { infoDot.x = W - r; infoDot.vx = -Math.abs(infoDot.vx); }
    if (infoDot.y <= r) { infoDot.y = r; infoDot.vy = Math.abs(infoDot.vy); }
    if (infoDot.y >= H - r) { infoDot.y = H - r; infoDot.vy = -Math.abs(infoDot.vy); }
  }

  if (alarmRinging && ms >= alarmEndsAt) stopAlarm();
}

// ===================== DRAW =====================
function draw(ms) {
  ctx.fillStyle = bg();
  ctx.fillRect(0, 0, W, H);

  if (currentMode === "circles") drawCircles(ms);
  if (currentMode === "splash") drawSplashes(ms);
  if (currentMode === "diamonds") drawDiamonds(ms);

  drawPink(ms);
}

function drawCircles(ms) {
  const day = isDayEffective();
  ctx.strokeStyle = day ? "rgba(0,0,0,0.90)" : "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2.6;

  ctx.beginPath();
  for (const c of circles) {
    const rx = c.r * (1 + (c.squash || 0));
    const ry = c.r * (1 - (c.squash || 0));
    ctx.moveTo(c.x + rx, c.y);
    ctx.ellipse(c.x, c.y, Math.max(1, rx), Math.max(1, ry), (c.rot || 0), 0, TAU);
  }
  ctx.stroke();
}

function drawSplashes(ms) {
  // Always BLACK as requested
  // very slightly softer at night
  const alpha = isDayEffective() ? 0.92 : 0.78;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;

  for (const s of splashes) {
    const rainN = clamp(weather.rainMm / 10, 0, 1);
    const windN = clamp(weather.windMs / 12, 0, 1);

    // breathing amplitude grows with rain
    const breathe = 1 + Math.sin(s.p) * (s._expand || 0.2);
    const jitter = 0.10 + 0.25 * (s._storm || 0);
    const base = s.base * breathe;

    const pts = s.points;
    const step = TAU / pts;

    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = i * step + s.rot;
      const wave = Math.sin(s.p * 0.9 + s.phases[i]) * (s.amps[i] * jitter);
      const r = base * (1 + wave);

      const x = s.x + Math.cos(a) * r;
      const y = s.y + Math.sin(a) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Optional “splatter drops” when rain is strong (still black)
    if (rainN > 0.55) {
      const drops = Math.floor(lerp(0, 4, clamp((rainN - 0.55) / 0.45, 0, 1)));
      for (let k = 0; k < drops; k++) {
        const da = Math.random() * TAU;
        const dr = base * lerp(0.9, 1.35, Math.random());
        const dx = Math.cos(da) * dr + wxFromWind(windN);
        const dy = Math.sin(da) * dr;
        ctx.moveTo(s.x + dx, s.y + dy);
        ctx.arc(s.x + dx, s.y + dy, lerp(2, 6, Math.random()), 0, TAU);
      }
    }

    ctx.fill();
  }
}

function wxFromWind(windN) {
  const dir = (weather.windDirDeg || 0) * PI / 180;
  return Math.cos(dir) * windN * 18;
}

function drawDiamonds(ms) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);
  const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);

  for (const d of diamonds) {
    const skew = Math.sin(d.skewPhase) * d.skewAmt * (0.35 + 0.95 * storm);
    const sx = 1 + skew;
    const sy = 1 - skew;

    // diamonds brighten a bit during day, soften at night
    const a = isDayEffective() ? d.alpha : d.alpha * 0.78;
    ctx.fillStyle = hexToRgba(d.color, a);

    const size = d.size * lerp(0.95, 1.15, tN);
    const w = size * sx;
    const h = size * sy;

    // diamond points (rhombus)
    const p0 = rotatePoint(0, -h, d.a);
    const p1 = rotatePoint(w, 0, d.a);
    const p2 = rotatePoint(0, h, d.a);
    const p3 = rotatePoint(-w, 0, d.a);

    ctx.beginPath();
    ctx.moveTo(d.x + p0.x, d.y + p0.y);
    ctx.lineTo(d.x + p1.x, d.y + p1.y);
    ctx.lineTo(d.x + p2.x, d.y + p2.y);
    ctx.lineTo(d.x + p3.x, d.y + p3.y);
    ctx.closePath();
    ctx.fill();
  }
}

function rotatePoint(x, y, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

function hexToRgba(hex, a) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3
    ? h.split("").map(ch => ch + ch).join("")
    : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function drawPink(ms) {
  if (!infoDot) return;
  const pulse = 0.10 + 0.08 * Math.sin(ms / 850);
  ctx.fillStyle = `rgba(255, 70, 170, ${0.92 + pulse})`;

  const rx = infoDot.r * (1 + (infoDot.squash || 0));
  const ry = infoDot.r * (1 - (infoDot.squash || 0));

  ctx.beginPath();
  ctx.ellipse(infoDot.x, infoDot.y, Math.max(1, rx), Math.max(1, ry), (infoDot.rot || 0), 0, TAU);
  ctx.fill();
}

// ===================== AUDIO (same engine: genres + meteo tempo + night soft) =====================
let audioCtx = null;
let master = null;
let timbreLP = null;
let compressor = null;

let padBus = null;
let chordBus = null;
let melodyBus = null;
let percBus = null;

let padOsc = [];
let audioOn = false;

let nextChordAtMs = 0;
let nextMelodyAtMs = 0;
let nextPercAtMs = 0;

let currentChord = [0, 4, 7, 11];
let rootHz = 220;

const GENRE = {
  jazz: {
    chordPool: [
      [0, 4, 7, 11, 14],
      [0, 4, 7, 11, 14, 21],
      [0, 3, 7, 10, 14],
      [0, 3, 7, 10, 14, 21],
      [0, 4, 7, 10, 14],
      [0, 4, 7, 10, 14, 18],
      [0, 3, 6, 10, 14]
    ],
    bpm: [62, 112],
    pad: { typeA: "triangle", typeB: "sine", detune: 4 },
    melody: { density: 0.85, swing: 0.58 },
    perc: { hat: 0.9, kick: 0.35 }
  },
  soul: {
    chordPool: [
      [0, 4, 7, 11, 14],
      [0, 3, 7, 10, 14],
      [0, 4, 7, 10, 14],
      [0, 3, 7, 10, 14, 17]
    ],
    bpm: [58, 102],
    pad: { typeA: "sine", typeB: "triangle", detune: 3 },
    melody: { density: 0.65, swing: 0.54 },
    perc: { hat: 0.7, kick: 0.45 }
  },
  blues: {
    chordPool: [
      [0, 4, 7, 10],
      [0, 4, 7, 10, 14],
      [0, 3, 7, 10],
      [0, 4, 6, 10, 13]
    ],
    bpm: [54, 96],
    pad: { typeA: "triangle", typeB: "sawtooth", detune: 6 },
    melody: { density: 0.55, swing: 0.60 },
    perc: { hat: 0.75, kick: 0.55 }
  },
  classical: {
    chordPool: [
      [0, 4, 7, 11],
      [0, 3, 7, 10],
      [0, 4, 7],
      [0, 3, 7],
      [0, 4, 7, 14]
    ],
    bpm: [48, 92],
    pad: { typeA: "sine", typeB: "sine", detune: 2 },
    melody: { density: 0.45, swing: 0.50 },
    perc: { hat: 0.35, kick: 0.15 }
  }
};

// volume
let userVolume = 0.60;
(function loadVolume() {
  try {
    const v = Number(localStorage.getItem("pi_volume"));
    if (!Number.isNaN(v)) userVolume = clamp(v, 0, 1);
  } catch {}
  volSlider.value = String(Math.round(userVolume * 100));
  volVal.textContent = `${Math.round(userVolume * 100)}%`;
})();
volSlider.addEventListener("input", () => {
  userVolume = clamp(Number(volSlider.value) / 100, 0, 1);
  volVal.textContent = `${Math.round(userVolume * 100)}%`;
  try { localStorage.setItem("pi_volume", String(userVolume)); } catch {}
});

function setAudioButton() {
  btnAudio.textContent = audioOn ? "Audio: ON" : "Audio: OFF";
}

async function enableAudio() {
  if (audioOn) return;
  audioOn = true;
  setAudioButton();

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0.0001;

  timbreLP = audioCtx.createBiquadFilter();
  timbreLP.type = "lowpass";
  timbreLP.frequency.value = 6000;
  timbreLP.Q.value = 0.8;

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 20;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;

  padBus = audioCtx.createGain();   padBus.gain.value = 0.60;
  chordBus = audioCtx.createGain(); chordBus.gain.value = 0.55;
  melodyBus = audioCtx.createGain();melodyBus.gain.value = 0.65;
  percBus = audioCtx.createGain();  percBus.gain.value = 0.45;

  padBus.connect(timbreLP);
  chordBus.connect(timbreLP);
  melodyBus.connect(timbreLP);
  percBus.connect(timbreLP);

  timbreLP.connect(compressor);
  compressor.connect(master);
  master.connect(audioCtx.destination);

  padOsc = [];
  for (let i = 0; i < 6; i++) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 220;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(padBus);
    o.start();
    padOsc.push({ o, g });
  }

  nextChordAtMs = 0;
  nextMelodyAtMs = 0;
  nextPercAtMs = 0;

  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}

async function disableAudio() {
  if (!audioOn) return;
  audioOn = false;
  setAudioButton();

  try {
    if (audioCtx && audioCtx.state !== "closed") {
      master.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.04);
      setTimeout(() => { try { audioCtx.close(); } catch {} }, 200);
    }
  } catch {}

  audioCtx = null;
  master = null;
  timbreLP = null;
  compressor = null;
  padBus = chordBus = melodyBus = percBus = null;
  padOsc = [];
}

btnAudio.addEventListener("click", () => {
  if (!audioOn) enableAudio();
  else disableAudio();
});

audioGenreSel.addEventListener("change", () => {
  try { localStorage.setItem("pi_genre", audioGenreSel.value); } catch {}
});
(function loadGenre() {
  try {
    const g = localStorage.getItem("pi_genre");
    if (g && GENRE[g]) audioGenreSel.value = g;
  } catch {}
})();
setAudioButton();

document.addEventListener("pointerdown", async () => {
  if (audioCtx && audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}, { passive: true });

function weatherDrivenTempo(genreCfg) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const energy = clamp(tN * 0.65 + rainN * 0.55 + windN * 0.20, 0, 1);
  const [b0, b1] = genreCfg.bpm;
  let bpm = lerp(b0, b1, energy);
  if (!isDayEffective()) bpm *= 0.86;
  return clamp(bpm, 38, 132);
}

function updateTimbre() {
  if (!audioCtx) return;

  const cloudN = clamp(weather.cloudCover / 100, 0, 1);
  const fogN = clamp(weather.fog, 0, 1);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const tN = tempNorm(weather.tempC);

  const muffle = clamp(fogN * 0.75 + cloudN * 0.55, 0, 1);
  let cutoff = lerp(8200, 700, muffle);
  if (!isDayEffective()) cutoff *= 0.72;
  timbreLP.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.12);

  let g = (0.045 + 0.020 * tN + 0.012 * rainN);
  if (!isDayEffective()) g *= 0.72;
  g *= userVolume;
  master.gain.setTargetAtTime(clamp(g, 0.0001, 0.10), audioCtx.currentTime, 0.18);
}

function setPadVoicing(root, semis, genreCfg) {
  if (!audioCtx) return;

  const det = genreCfg.pad.detune;
  const aType = genreCfg.pad.typeA;
  const bType = genreCfg.pad.typeB;

  for (let i = 0; i < padOsc.length; i++) {
    const v = padOsc[i];
    v.o.type = (i % 2 === 0) ? aType : bType;
    v.o.detune.value = (i - (padOsc.length - 1) / 2) * det;

    const semi = semis[i % semis.length] + (i >= semis.length ? 12 : 0);
    const hz = root * Math.pow(2, semi / 12);
    v.o.frequency.setTargetAtTime(hz, audioCtx.currentTime, 0.08);

    const base = !isDayEffective() ? 0.010 : 0.014;
    v.g.gain.setTargetAtTime(base, audioCtx.currentTime, 0.18);
  }
}

function pickChord(genreCfg) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const cloudN = clamp(weather.cloudCover / 100, 0, 1);
  const idx = Math.floor((tN * 1.7 + rainN * 2.2 + cloudN * 1.1) * 3.1) % genreCfg.chordPool.length;
  return genreCfg.chordPool[(idx + (seasonKey() === "winter" ? 1 : 0)) % genreCfg.chordPool.length];
}

function playChordStab(root, semis, vel, dur) {
  if (!audioCtx) return;

  const t0 = audioCtx.currentTime + 0.01;
  const g = audioCtx.createGain();
  g.gain.value = 0.0001;
  g.connect(chordBus);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vel, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  semis.slice(0, 5).forEach((s, i) => {
    const o = audioCtx.createOscillator();
    o.type = "sine";
    o.detune.value = (i - 2) * 3.5;
    o.frequency.value = root * Math.pow(2, s / 12);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  });
}

function playNote(freq, when, dur, vel, type = "sine") {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);

  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  o.connect(g);
  g.connect(melodyBus);

  o.start(when);
  o.stop(when + dur + 0.05);
}

function playPerc(ms, bpm, genreCfg) {
  if (!audioCtx) return;

  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  let dens = clamp(0.10 + rainN * 0.55 + windN * 0.25, 0, 0.95);
  if (!isDayEffective()) dens *= 0.65;

  const beatMs = 60000 / bpm;
  const stepMs = beatMs / 2;

  while (ms >= nextPercAtMs) {
    const t0 = audioCtx.currentTime + 0.01;

    if (Math.random() < dens * genreCfg.perc.hat) {
      const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * (1 - i / d.length);

      const src = audioCtx.createBufferSource();
      src.buffer = buf;

      const hp = audioCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2200;

      const g = audioCtx.createGain();
      g.gain.value = 0.0001;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05 + 0.10 * dens, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);

      src.connect(hp);
      hp.connect(g);
      g.connect(percBus);

      src.start(t0);
      src.stop(t0 + 0.07);
    }

    if (Math.random() < dens * genreCfg.perc.kick * (0.35 + rainN)) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t0);
      o.frequency.exponentialRampToValueAtTime(55, t0 + 0.10);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);

      o.connect(g);
      g.connect(percBus);
      o.start(t0);
      o.stop(t0 + 0.18);
    }

    nextPercAtMs += stepMs * (0.85 + Math.random() * 0.5);
  }
}

function playMelody(ms, bpm, genreCfg) {
  if (!audioCtx) return;

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const scale = (audioGenreSel.value === "blues")
    ? [0, 3, 5, 6, 7, 10]
    : [0, 2, 4, 7, 9, 11];

  let dens = clamp(0.20 + genreCfg.melody.density * (tN * 0.65 + rainN * 0.35 + windN * 0.25), 0.15, 0.95);
  if (!isDayEffective()) dens *= 0.60;

  const beatMs = 60000 / bpm;
  const stepMs = beatMs / 2;

  while (ms >= nextMelodyAtMs) {
    const now = audioCtx.currentTime;
    if (Math.random() < dens) {
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const octave = (Math.random() < 0.65) ? 12 : 24;

      const swing = genreCfg.melody.swing;
      const swingOffset = (Math.random() < 0.5) ? 0 : (beatMs/1000) * (swing - 0.5) * 0.35;

      const semi = deg + octave + (Math.random() < 0.15 ? 1 : 0);
      const freq = rootHz * Math.pow(2, semi / 12);

      const vel = (0.03 + 0.05 * dens) * (isDayEffective() ? 1.0 : 0.72);
      const dur = (0.10 + 0.22 * (1 - rainN)) * (isDayEffective() ? 1.0 : 1.15);

      const type = (audioGenreSel.value === "jazz" || audioGenreSel.value === "soul") ? "triangle" : "sine";
      playNote(freq, now + 0.02 + swingOffset, dur, vel, type);
    }

    nextMelodyAtMs += stepMs * (0.85 + Math.random() * 0.7);
  }
}

function updateMusic(ms) {
  if (!audioOn || !audioCtx || alarmRinging) return;

  const gName = audioGenreSel.value || "jazz";
  const genreCfg = GENRE[gName] || GENRE.jazz;

  updateTimbre();

  const tN = tempNorm(weather.tempC);
  rootHz = lerp(196, 294, tN);
  if (!isDayEffective()) rootHz *= 0.92;

  const bpm = weatherDrivenTempo(genreCfg);
  const beatMs = 60000 / bpm;
  const barMs = beatMs * 4;

  if (nextChordAtMs === 0) {
    nextChordAtMs = ms;
    nextMelodyAtMs = ms;
    nextPercAtMs = ms;
  }

  if (ms >= nextChordAtMs) {
    currentChord = pickChord(genreCfg);
    setPadVoicing(rootHz, currentChord, genreCfg);

    const rainN = clamp(weather.rainMm / 10, 0, 1);
    const windN = clamp(weather.windMs / 12, 0, 1);
    let stabProb = clamp(0.15 + rainN * 0.45 + windN * 0.20, 0.10, 0.80);
    if (!isDayEffective()) stabProb *= 0.55;

    if (Math.random() < stabProb) {
      const vel = (0.05 + 0.08 * stabProb) * (isDayEffective() ? 1 : 0.75);
      playChordStab(rootHz, currentChord, vel, 0.9 + Math.random() * 0.7);
    }

    nextChordAtMs += barMs * (0.90 + Math.random() * 0.35);
  }

  playMelody(ms, bpm, genreCfg);
  playPerc(ms, bpm, genreCfg);
}

// ===================== ALARM =====================
let alarmNode = null;

function loadAlarm() {
  try {
    const saved = JSON.parse(localStorage.getItem("pi_alarm") || "null");
    if (!saved) return;
    alarmEnabled.checked = !!saved.enabled;
    alarmTime.value = saved.time || "";
    alarmSound.value = saved.sound || "siren";
  } catch {}
}
function saveAlarm() {
  try {
    localStorage.setItem("pi_alarm", JSON.stringify({
      enabled: alarmEnabled.checked,
      time: alarmTime.value,
      sound: alarmSound.value
    }));
  } catch {}
}
alarmEnabled.onchange = saveAlarm;
alarmTime.onchange = saveAlarm;
alarmSound.onchange = saveAlarm;
loadAlarm();

function startAlarm(durationMs = 30000) {
  enableAudio();
  alarmRinging = true;
  alarmEndsAt = performance.now() + durationMs;
  if (alarmSound.value === "siren") playSiren(durationMs);
  else playTrumpet(durationMs);
}
function stopAlarm() {
  alarmRinging = false;
  alarmEndsAt = 0;
  if (alarmNode) { try { alarmNode.stop(); } catch {} alarmNode = null; }
  nextChordAtMs = 0;
  nextMelodyAtMs = 0;
  nextPercAtMs = 0;
}
alarmTest.onclick = () => startAlarm(8000);
alarmStop.onclick = () => stopAlarm();

setInterval(() => {
  if (!alarmEnabled.checked) return;
  if (!alarmTime.value) return;

  const now = new Date();
  const [hh, mm] = alarmTime.value.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return;

  if (now.getHours() === hh && now.getMinutes() === mm && now.getSeconds() < 2) {
    startAlarm(30000);
  }
}, 1000);

function playSiren(durationMs) {
  if (!audioCtx) return;
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
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const dur = durationMs / 1000;

  const g = audioCtx.createGain();
  g.gain.value = 0.0;
  g.connect(audioCtx.destination);

  const o1 = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  o1.type = "square";
  o2.type = "triangle";
  o1.connect(g); o2.connect(g);

  const notes = [392, 494, 587, 784, 587, 494, 392];
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

  o1.start(t0); o2.start(t0);
  o1.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  alarmNode = o1;
}

// ===================== LOOP =====================
let last = performance.now();
function loop(ms) {
  const dt = clamp((ms - last) / 1000, 0, 0.05);
  last = ms;

  step(dt, ms);
  draw(ms);
  updateConsoleValues();

  if (audioOn) updateMusic(ms);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

toggleNight.onchange = () => updateConsoleValues();
updateConsoleValues();

// ensure art initialized when user chooses “USE LAST”
initArt(currentMode);
