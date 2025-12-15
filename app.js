// π Weather Circles — Vivaldi concept (classical-style generative)
// - Day background: PURE WHITE with sun, very light greys for clouds/fog, strong grey for storms
// - Trigger circle: PINK FILLED (no border) opens a fullscreen console (EXIT returns)
// - Circles size: 3x diameter (radius * 3)
// - Colors: warm palette
// - Audio: 6-voice "strings" pad + continuo "harpsichord" + violin melody + counterpoint
// - Timbre: muffled by fog/clouds (low-pass)
// - Wind: tremolo modulation
// - Rain: pizzicato / impulses density
// - Alarm: circles vibrate + siren/trumpet

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

// ---------- Overlay UI ----------
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
const toggleNight = document.getElementById("toggle-night");

const alarmEnabled = document.getElementById("alarm-enabled");
const alarmTime = document.getElementById("alarm-time");
const alarmSound = document.getElementById("alarm-sound");
const alarmTest = document.getElementById("alarm-test");
const alarmStop = document.getElementById("alarm-stop");

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
window.addEventListener("resize", () => { resize(); initCircles(); });
resize();

// ---------- Helpers ----------
const PI = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const pad2 = (n) => String(n).padStart(2, "0");

function tempNorm(tC) { return clamp((tC - (-15)) / (50 - (-15)), 0, 1); }

function seasonKey(d = new Date()) {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  return "autumn";
}

// deterministic RNG to keep trigger circle stable per season
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

// ---------- Circles + PINK trigger circle ----------
const N = 99;
let circles = [];
let infoCircle = null;

function initCircles() {
  const rng = mulberry32(seasonSeed(seasonKey()));

  circles = [];
  for (let i = 0; i < N; i++) {
    const baseR = 8 + rng() * 16;          // old radius range
    const r = baseR * 3;                  // NEW: diameter 3x => radius * 3
    circles.push({
      x: rng() * W,
      y: rng() * H,
      r,
      p: (i + 1) * PI,
      s: 0.4 + rng() * 1.6,
      h: rng() * 360,
      isInfo: false
    });
  }

  infoCircle = circles[Math.floor(rng() * circles.length)];
  infoCircle.isInfo = true;

  // make it even more tappable/visible
  infoCircle.r = Math.max(infoCircle.r, 60);
}
initCircles();

// tap/click pink circle -> open console
canvas.addEventListener("pointerdown", (e) => {
  if (!overlay.classList.contains("hidden")) return;
  if (!infoCircle) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const dx = x - infoCircle.x;
  const dy = y - infoCircle.y;
  const d = Math.sqrt(dx*dx + dy*dy);

  if (d <= infoCircle.r + 16) {
    updateConsoleValues();
    openConsole();
  }
}, { passive: true });

// ---------- Background + stroke color ----------
function bg() {
  const day = isDayEffective();

  const clouds = clamp(weather.cloudCover / 100, 0, 1);
  const fog = clamp(weather.fog, 0, 1);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 14, 0, 1);

  // "Sun" condition: day + clear air + little cloud + no rain
  const sunny = day && clouds < 0.25 && fog < 0.25 && rainN < 0.03;

  // Storm intensity: rain + wind + clouds
  const stormN = clamp(rainN * 0.75 + windN * 0.25 + clouds * 0.35, 0, 1);

  if (!day) {
    // night stays dark (slightly lifted by cloud/fog)
    const lift = clamp(clouds * 0.35 + fog * 0.55, 0, 1);
    const v = Math.floor(lerp(10, 55, lift));
    return `rgb(${v},${v},${v})`;
  }

  // day:
  if (sunny) {
    // requested: white when it's day AND sunny
    return `rgb(255,255,255)`;
  }

  if (stormN > 0.65) {
    // strong storm => clearly grey (but not night)
    const t = clamp((stormN - 0.65) / 0.35, 0, 1);
    const v = Math.floor(lerp(210, 140, t));
    return `rgb(${v},${v},${v})`;
  }

  // cloudy/foggy => VERY LIGHT greys
  // fog slightly stronger influence on "milky" grey
  const lightGreyMix = clamp(clouds * 0.65 + fog * 0.85, 0, 1);
  const v = Math.floor(lerp(255, 235, lightGreyMix)); // very light grey range
  return `rgb(${v},${v},${v})`;
}

function strokeColor(c) {
  // requested: warm colors always (temp still slightly shifts warmth)
  const t = tempNorm(weather.tempC);

  // warm palette: yellow/orange/red
  const baseHue = lerp(38, 6, t);         // 38° (gold) -> 6° (red-orange)
  const hue = (baseHue + (c.h * 0.22)) % 360; // small variation but stays warm
  const sat = 88;
  const light = isDayEffective() ? lerp(52, 68, 0.5 + t * 0.5) : lerp(42, 58, 0.5 + t * 0.5);

  return `hsla(${hue.toFixed(0)},${sat}%,${light.toFixed(0)}%,0.92)`;
}

// ---------- Alarm state + vibration ----------
let alarmRinging = false;
let alarmEndsAt = 0;

// ---------- Motion ----------
function step(dt, ms) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const base = lerp(12, 65, tN);
  const windDir = (weather.windDirDeg || 0) * PI / 180;
  const wx = Math.cos(windDir) * windN;
  const wy = Math.sin(windDir) * windN;

  const vibr = alarmRinging ? (3.5 + 6.0 * rainN) : 0;

  for (const c of circles) {
    c.p += dt * (PI * 0.22 + c.s * 0.02);

    const hx = Math.sin(c.p) * (0.8 + 1.6 * (1 - rainN));
    const hy = Math.cos(c.p / PI) * (0.8 + 1.6 * (1 - rainN));

    const sunMode = isDayEffective() && rainN < 0.02;

    if (sunMode) {
      c.x += (Math.cos(c.p) * 18 + hx) * dt;
      c.y += (Math.sin(c.p) * 10 + hy) * dt;
      c.y -= dt * (6 + 10 * tN);
      c.y += (H * 0.35 - c.y) * dt * 0.05;
    } else {
      c.y += base * (0.3 + 2.0 * rainN) * dt;
      c.x += hx * dt * 2;
    }

    c.x += wx * base * (0.5 + 1.2 * windN) * dt;
    c.y += wy * base * (0.5 + 1.2 * windN) * dt;

    if (vibr > 0) {
      c.x += Math.sin(ms / 35 + c.h) * vibr * dt * 60;
      c.y += Math.cos(ms / 41 + c.h) * vibr * dt * 60;
    }

    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;
  }

  if (alarmRinging && ms >= alarmEndsAt) stopAlarm();
}

function draw(ms) {
  ctx.fillStyle = bg();
  ctx.fillRect(0, 0, W, H);

  for (const c of circles) {
    if (c.isInfo) {
      // PINK filled trigger circle — NO BORDER (requested)
      const pulse = 0.10 + 0.08 * Math.sin(ms / 850);
      ctx.fillStyle = `rgba(255, 70, 170, ${0.90 + pulse})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = strokeColor(c);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, PI * 2);
      ctx.stroke();
    }
  }
}

// ===================== AUDIO (Classical engine) =====================
let audioCtx = null;

// graph:
// pad+melody+harpsichord+rain -> timbreFilter(LPF) -> compressor -> tremoloGain -> master -> destination
let timbreFilter = null;
let compressor = null;
let tremoloGain = null;
let master = null;

let pad = [];             // 6 voices {osc,g}
let harpBus = null;
let melodyBus = null;
let rainBus = null;

let windLFO = null;
let windLFODepth = null;

let noiseBuffer = null;

// Scheduling state
let nextBarAtMs = 0;
let barIndex = 0;
let nextHarpAtMs = 0;
let nextMelodyAtMs = 0;
let nextRainAtMs = 0;

// Harmony state
let currentRootHz = 220;
let currentChordSemis = [0, 4, 7, 11, 14, 17];
let alarmNode = null;

// Modes (semitones)
const MODES = {
  spring:  [0, 2, 4, 5, 7, 9, 11],
  summer:  [0, 2, 4, 5, 7, 9, 10],
  autumn:  [0, 2, 3, 5, 7, 9, 10],
  winter:  [0, 2, 3, 5, 7, 8, 10]
};

// Functional progressions
const PROGRESSION = {
  spring:  [0, 3, 4, 0],
  summer:  [0, 4, 3, 0],
  autumn:  [0, 5, 3, 0],
  winter:  [0, 4, 5, 0]
};

const MELODY = {
  spring: [0,2,4,5,4,2,1,0, 2,4,5,7,5,4,2,0],
  summer: [0,4,5,4,2,0,2,4, 5,7,5,4,2,0,2,0],
  autumn: [0,2,3,5,3,2,1,0, 0,2,5,3,2,1,0,-1],
  winter: [0,1,3,5,3,1,0,-1, 0,2,3,5,3,2,1,0]
};

const COUNTER = {
  spring: [4,5,4,2,1,0,1,2],
  summer: [2,4,5,4,2,0,2,4],
  autumn: [3,2,1,0,1,2,3,2],
  winter: [3,2,1,0,-1,0,1,0]
};

function ensureAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  timbreFilter = audioCtx.createBiquadFilter();
  timbreFilter.type = "lowpass";
  timbreFilter.frequency.value = 5200;
  timbreFilter.Q.value = 0.8;

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 20;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;

  tremoloGain = audioCtx.createGain();
  tremoloGain.gain.value = 1.0;

  master = audioCtx.createGain();
  master.gain.value = 0.07;

  harpBus = audioCtx.createGain();   harpBus.gain.value = 0.22;
  melodyBus = audioCtx.createGain(); melodyBus.gain.value = 0.55;
  rainBus = audioCtx.createGain();   rainBus.gain.value = 0.24;

  harpBus.connect(timbreFilter);
  melodyBus.connect(timbreFilter);
  rainBus.connect(timbreFilter);

  timbreFilter.connect(compressor);
  compressor.connect(tremoloGain);
  tremoloGain.connect(master);
  master.connect(audioCtx.destination);

  pad = [];
  for (let i = 0; i < 6; i++) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = (i % 2 === 0) ? "triangle" : "sawtooth";
    osc.detune.value = (i - 2.5) * 6;

    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(timbreFilter);
    osc.start();

    pad.push({ osc, g });
  }

  windLFO = audioCtx.createOscillator();
  windLFO.type = "sine";
  windLFO.frequency.value = 4.2;

  windLFODepth = audioCtx.createGain();
  windLFODepth.gain.value = 0.0;

  windLFO.connect(windLFODepth);
  windLFODepth.connect(tremoloGain.gain);
  tremoloGain.gain.value = 1.0;
  windLFO.start();

  noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.25, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  btnAudio.textContent = "Audio enabled";
}

btnAudio.addEventListener("click", ensureAudio);

// resume helper (mobile)
document.addEventListener("pointerdown", async () => {
  if (audioCtx && audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}, { passive: true });

function updateTimbreAndDynamics() {
  if (!audioCtx) return;

  const fogN = clamp(weather.fog, 0, 1);
  const cloudN = clamp(weather.cloudCover / 100, 0, 1);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);
  const tN = tempNorm(weather.tempC);

  const muffle = clamp(fogN * 0.75 + cloudN * 0.55, 0, 1);
  const cutoff = lerp(7200, 650, muffle);
  const q = lerp(0.7, 1.3, muffle);

  timbreFilter.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.12);
  timbreFilter.Q.setTargetAtTime(q, audioCtx.currentTime, 0.12);

  const nightSoft = !isDayEffective();
  const baseGain = (nightSoft ? 0.055 : 0.075) * lerp(0.85, 1.10, tN) * lerp(1.00, 1.10, rainN);
  master.gain.setTargetAtTime(clamp(baseGain, 0.035, 0.10), audioCtx.currentTime, 0.18);

  const tremDepth = clamp(0.02 + windN * 0.14, 0.02, 0.18);
  windLFODepth.gain.setTargetAtTime(tremDepth, audioCtx.currentTime, 0.18);
  windLFO.frequency.setTargetAtTime(lerp(3.2, 7.5, windN), audioCtx.currentTime, 0.25);

  harpBus.gain.setTargetAtTime(lerp(0.18, 0.30, rainN), audioCtx.currentTime, 0.18);
  melodyBus.gain.setTargetAtTime(lerp(0.52, 0.62, 1 - muffle), audioCtx.currentTime, 0.22);
  rainBus.gain.setTargetAtTime(lerp(0.10, 0.35, rainN), audioCtx.currentTime, 0.14);
}

function degToSemitone(mode, degree) {
  const len = mode.length;
  const oct = Math.floor(degree / len);
  let d = degree % len;
  if (d < 0) d += len;
  return mode[d] + 12 * oct;
}

function buildChordSemis(mode, triadRootDegree, seasonName) {
  const r = triadRootDegree;
  const triad = [r, r + 2, r + 4];

  let ext;
  if (seasonName === "spring") ext = [r + 6, r + 1, r + 3];
  else if (seasonName === "summer") ext = [r + 6, r + 1, r + 5];
  else if (seasonName === "autumn") ext = [r + 6, r + 3, r + 1];
  else ext = [r + 6, r + 1, r + 3];

  const degrees = [...triad, ...ext].slice(0, 6);
  const semis = degrees.map(d => degToSemitone(mode, d));
  semis.sort((a,b)=>a-b);
  for (let i=1;i<semis.length;i++){
    while (semis[i] - semis[i-1] < 3) semis[i] += 12;
  }
  return semis;
}

function setPadChord(rootHz, semis) {
  const t = audioCtx.currentTime;
  for (let i = 0; i < 6; i++) {
    const hz = rootHz * Math.pow(2, (semis[i] / 12));
    pad[i].osc.frequency.setTargetAtTime(hz, t, 0.06);
  }
}

function padOn(level) {
  const t = audioCtx.currentTime;
  for (const v of pad) {
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), t);
    v.g.gain.linearRampToValueAtTime(level, t + 1.2);
  }
}
function padOff() {
  const t = audioCtx.currentTime;
  for (const v of pad) {
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), t);
    v.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  }
}

function harpPluck(freq, when, vel = 0.12) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const bp = audioCtx.createBiquadFilter();

  o.type = "square";
  o.frequency.setValueAtTime(freq, when);

  bp.type = "bandpass";
  bp.frequency.setValueAtTime(lerp(900, 1800, Math.random()), when);
  bp.Q.value = 1.0;

  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vel, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);

  o.connect(bp);
  bp.connect(g);
  g.connect(harpBus);

  o.start(when);
  o.stop(when + 0.22);
}

function violinNote(freq, when, dur, vel, vibrato = 0.0) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();

  o.type = "sine";
  o.frequency.setValueAtTime(freq, when);

  f.type = "highpass";
  f.frequency.setValueAtTime(220, when);

  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  let lfo = null, lfoG = null;
  if (vibrato > 0.0001) {
    lfo = audioCtx.createOscillator();
    lfoG = audioCtx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 5.4 + Math.random()*1.2;
    lfoG.gain.value = vibrato;
    lfo.connect(lfoG);
    lfoG.connect(o.detune);
    lfo.start(when);
    lfo.stop(when + dur);
  }

  o.connect(f);
  f.connect(g);
  g.connect(melodyBus);

  o.start(when);
  o.stop(when + dur);
}

function playPhrase(rootHz, mode, degrees, startTime, stepDur, vel, ornament = false) {
  for (let i = 0; i < degrees.length; i++) {
    const d = degrees[i];
    if (d === null || d === undefined) continue;

    const when = startTime + i * stepDur;
    const semi = degToSemitone(mode, d) + 12;
    const freq = rootHz * Math.pow(2, semi / 12);

    const dur = stepDur * 0.95;
    const vib = ornament ? (6 + Math.random()*8) : 0;

    violinNote(freq, when, dur, vel, vib);

    if (ornament && i % 4 === 0) {
      const semi2 = semi + 1;
      const f2 = rootHz * Math.pow(2, semi2 / 12);
      violinNote(f2, when + stepDur * 0.25, stepDur * 0.30, vel * 0.55, vib * 0.7);
    }
  }
}

function rainClick(when, intensity) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;

  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.08 * intensity, when + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);

  src.connect(hp);
  hp.connect(g);
  g.connect(rainBus);

  src.start(when);
  src.stop(when + 0.10);
}

function rainPizz(freq, when, intensity) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq, when);

  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.10 * intensity, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);

  o.connect(g);
  g.connect(rainBus);

  o.start(when);
  o.stop(when + 0.14);
}

// ===================== Music scheduler =====================
function updateMusic(ms) {
  if (!audioCtx || alarmRinging) return;

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  updateTimbreAndDynamics();

  const season = seasonKey();
  const mode = MODES[season];

  const bpm = lerp(48, 120, clamp(tN * 0.65 + rainN * 0.45 + windN * 0.15, 0, 1));
  const beatMs = 60000 / bpm;
  const barMs = beatMs * 4;

  currentRootHz = lerp(110, 294, tN);
  const rootHz = currentRootHz;

  const padLevel = clamp((isDayEffective() ? 0.018 : 0.012) + rainN * 0.006, 0.010, 0.030);
  padOn(padLevel);

  if (nextBarAtMs === 0) {
    nextBarAtMs = ms;
    nextHarpAtMs = ms;
    nextMelodyAtMs = ms + barMs;
    nextRainAtMs = ms;
    barIndex = 0;
  }

  if (ms >= nextBarAtMs) {
    const prog = PROGRESSION[season];
    const triadRootDeg = prog[barIndex % prog.length];
    currentChordSemis = buildChordSemis(mode, triadRootDeg, season);
    setPadChord(rootHz, currentChordSemis);

    nextBarAtMs += barMs;
    barIndex++;
  }

  const harpSubdivision = (rainN > 0.35 || windN > 0.35) ? 2 : 1;
  const harpStepMs = beatMs / (2 * harpSubdivision);

  while (ms >= nextHarpAtMs) {
    const pattern = [0, 2, 4, 2, 1, 3, 5, 3];
    const idx = pattern[Math.floor((nextHarpAtMs / harpStepMs) % pattern.length)];
    const semi = currentChordSemis[idx % currentChordSemis.length];

    const f = rootHz * Math.pow(2, (semi - 12) / 12);
    const when = audioCtx.currentTime + 0.02;

    harpPluck(f, when, lerp(0.05, 0.13, clamp(0.35 + rainN, 0, 1)));
    nextHarpAtMs += harpStepMs;
  }

  const phrase = MELODY[season];
  const stepDur = (beatMs / 1000) * lerp(0.55, 0.35, clamp(tN + rainN * 0.6, 0, 1));
  const phraseSec = phrase.length * stepDur;
  const phraseMs = phraseSec * 1000;

  while (ms >= nextMelodyAtMs) {
    const start = audioCtx.currentTime + 0.05;
    const vel = clamp(0.04 + (isDayEffective() ? 0.03 : 0.015) + rainN * 0.02, 0.03, 0.09);
    const ornament = (windN > 0.25) || (rainN > 0.40);

    playPhrase(rootHz, mode, phrase, start, stepDur, vel, ornament);

    const resp = COUNTER[season];
    const respStart = start + (beatMs / 1000) * 2;
    playPhrase(rootHz, mode, resp, respStart, stepDur * 0.95, vel * 0.70, ornament && windN > 0.35);

    const breath = lerp(0.6, 0.15, clamp(tN + rainN, 0, 1));
    nextMelodyAtMs += phraseMs + breath * 1000;
  }

  const rainActive = rainN > 0.05;
  const rainStepMs = beatMs / lerp(1.5, 4.0, rainN);

  if (rainActive) {
    while (ms >= nextRainAtMs) {
      const when = audioCtx.currentTime + 0.02;
      const pick = currentChordSemis[Math.floor(Math.random() * currentChordSemis.length)];
      const f = rootHz * Math.pow(2, (pick) / 12);
      const intensity = clamp(0.35 + rainN * 0.85, 0.35, 1.0);

      if (Math.random() < lerp(0.35, 0.85, rainN)) rainClick(when, intensity);
      if (Math.random() < lerp(0.20, 0.75, rainN)) rainPizz(f, when + 0.01, intensity);

      nextRainAtMs += rainStepMs * lerp(0.85, 0.55, rainN) * (0.75 + Math.random()*0.8);
    }
  } else {
    nextRainAtMs = ms + 250;
  }
}

// ===================== Alarm =====================
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
  ensureAudio();
  padOff();

  alarmRinging = true;
  alarmEndsAt = performance.now() + durationMs;

  if (alarmSound.value === "siren") playSiren(durationMs);
  else playTrumpet(durationMs);
}
function stopAlarm() {
  alarmRinging = false;
  alarmEndsAt = 0;
  if (alarmNode) { try { alarmNode.stop(); } catch {} alarmNode = null; }
  nextBarAtMs = 0;
  nextHarpAtMs = 0;
  nextMelodyAtMs = 0;
  nextRainAtMs = 0;
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

// ---------- Main loop ----------
let last = performance.now();
function loop(ms) {
  const dt = clamp((ms - last) / 1000, 0, 0.05);
  last = ms;

  step(dt, ms);
  draw(ms);
  updateConsoleValues();

  if (audioCtx && audioCtx.state !== "closed") {
    updateMusic(ms);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

toggleNight.onchange = () => updateConsoleValues();
updateConsoleValues();
