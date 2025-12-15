// π Weather Art — Cerchi / Splash / Diamanti
// + Menu via pallino rosa
// + Tap bottom-right => picker
// + Audio endless generativo (meteo)
// + Microfono (solo se audio OFF): loudness => vibrazione/scale
// + Pitch detection (voce -> colore)
// + Voice vs noise gating
// + Meditation (solo respiro): envelope lenta, no pitch
// + Splash night: white on dark background

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

// Mic UI
const toggleMic = document.getElementById("toggle-mic");
const toggleMeditation = document.getElementById("toggle-meditation");
const micStatus = document.getElementById("mic-status");

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

function windVec() {
  const windN = clamp(weather.windMs / 12, 0, 1);
  const dir = (weather.windDirDeg || 0) * PI / 180;
  return { wx: Math.cos(dir) * windN, wy: Math.sin(dir) * windN, windN, dir };
}
function rainAngleForDraw() {
  const { wx, wy } = windVec();
  const dx = wx * 0.9;
  const dy = 1.0 + wy * 0.7;
  return Math.atan2(dy, dx);
}

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

function showModePicker() {
  modePicker.classList.remove("hidden");
  modePicker.setAttribute("aria-hidden", "false");
}
function hideModePicker() {
  modePicker.classList.add("hidden");
  modePicker.setAttribute("aria-hidden", "true");
}
function isModePickerOpen() {
  return !modePicker.classList.contains("hidden");
}

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
    const v = Math.floor(lerp(230, 155, t));
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
function modeLabel(mode) {
  if (mode === "circles") return "CERCHI";
  if (mode === "splash") return "SPLASH";
  return "DIAMANTI";
}

// picker click handlers
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
let circles = [];
let splashes = [];
let diamonds = [];

// Diamonds palette (background polygons)
const DIAMOND_PALETTE = [
  "#BA5900", "#FF8100", "#088DEF", "#0B24C5", "#7B1DEF", "#62027D",
  "#D245D3", "#AE048F", "#FA01A9", "#E40674", "#CC021C", "#F17677"
];

function initArt(mode) {
  const rng = mulberry32(seasonSeed(seasonKey()));
  circles = [];
  splashes = [];
  diamonds = [];

  infoDot = {
    x: rng() * W,
    y: rng() * H,
    r: mmToPx(3),
    p: rng() * TAU,
    s: 1.0,
    speedMul: 1.55,
    vx: (rng() < 0.5 ? -1 : 1) * lerp(80, 150, rng()),
    vy: (rng() < 0.5 ? -1 : 1) * lerp(80, 150, rng()),
    squashPhase: rng() * TAU,
    squashSpeed: 0.85,
    squashBase: 0.02,
    squashMax: 0.18,
    rotPhase: rng() * TAU,
    rotSpeed: 0.28,
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
    const N = 70;
    for (let i = 0; i < N; i++) {
      const base = lerp(22, 70, rng());
      const points = Math.floor(lerp(7, 12, rng()));
      const amps = Array.from({ length: points }, () => lerp(0.15, 0.55, rng()));
      const phases = Array.from({ length: points }, () => rng() * TAU);
      const dropSeeds = Array.from({ length: 10 }, () => rng() * TAU);

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
        p: rng() * TAU,
        dropSeeds
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

  musicState.forceNewSection = true;
}

// initial
loadMode();
showModePicker();
initArt(currentMode);

// ---------- Tap bottom-right to reopen picker ----------
function hitBottomRight(x, y) {
  const zone = Math.max(72, Math.min(120, Math.min(W, H) * 0.12));
  return (x >= W - zone && y >= H - zone);
}

// pointer handler: bottom-right => picker; pink dot => menu
canvas.addEventListener("pointerdown", (e) => {
  if (!overlay.classList.contains("hidden")) return;
  if (isModePickerOpen()) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (hitBottomRight(x, y)) {
    showModePicker();
    return;
  }

  if (!infoDot) return;
  const dx = x - infoDot.x;
  const dy = y - infoDot.y;
  const d = Math.sqrt(dx*dx + dy*dy);
  if (d <= infoDot.r + 40) {
    updateConsoleValues();
    openConsole();
  }
}, { passive: true });

// ===================== MICROPHONE (exclusive with audio) =====================
let micEnabled = false;
let meditationEnabled = false;
let micCtx = null;
let micStream = null;
let micSource = null;
let micAnalyserTD = null;
let micAnalyserFD = null;
let micTimeData = null;
let micFreqData = null;

let micLevel = 0;          // 0..1 raw loudness (fast)
let micBreath = 0;         // 0..1 slow envelope (meditation)
let voiceLikely = false;   // voice vs noise
let pitchHz = 0;           // detected pitch (Hz)
let pitchConf = 0;         // 0..1 confidence
let pitchHue = 320;        // mapped hue

function setMicStatus() {
  const v = voiceLikely ? "VOICE" : (micEnabled ? "NOISE/AMBIENT" : "OFF");
  const p = (pitchHz > 0 && pitchConf > 0.35) ? ` • ${Math.round(pitchHz)} Hz` : "";
  micStatus.textContent = `Mic: ${micEnabled ? "ON" : "OFF"} • ${v}${p}${meditationEnabled ? " • Meditation" : ""}`;
}

toggleMeditation.addEventListener("change", () => {
  meditationEnabled = !!toggleMeditation.checked;
  setMicStatus();
});

toggleMic.addEventListener("change", async () => {
  if (toggleMic.checked) {
    // if audio ON => turn it OFF (required)
    if (audioOn) await disableAudio();
    await enableMic();
  } else {
    disableMic();
  }
  setMicStatus();
});

async function enableMic() {
  if (micEnabled) return;

  micCtx = new (window.AudioContext || window.webkitAudioContext)();
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  micSource = micCtx.createMediaStreamSource(micStream);

  // time domain for RMS + pitch
  micAnalyserTD = micCtx.createAnalyser();
  micAnalyserTD.fftSize = 2048;
  micAnalyserTD.smoothingTimeConstant = 0.25;

  // freq domain for “voice vs noise” hints
  micAnalyserFD = micCtx.createAnalyser();
  micAnalyserFD.fftSize = 2048;
  micAnalyserFD.smoothingTimeConstant = 0.35;

  micSource.connect(micAnalyserTD);
  micSource.connect(micAnalyserFD);

  micTimeData = new Float32Array(micAnalyserTD.fftSize);
  micFreqData = new Float32Array(micAnalyserFD.frequencyBinCount);

  micEnabled = true;
  micLevel = 0;
  micBreath = 0;
  pitchHz = 0;
  pitchConf = 0;
  voiceLikely = false;

  if (micCtx.state !== "running") {
    try { await micCtx.resume(); } catch {}
  }
}

function disableMic() {
  micEnabled = false;
  micLevel = 0;
  micBreath = 0;
  pitchHz = 0;
  pitchConf = 0;
  voiceLikely = false;

  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (micCtx) {
    try { micCtx.close(); } catch {}
    micCtx = null;
  }

  micSource = null;
  micAnalyserTD = null;
  micAnalyserFD = null;
  micTimeData = null;
  micFreqData = null;
}

function updateMicAnalysis() {
  if (!micEnabled || !micAnalyserTD || !micAnalyserFD) return;

  // RMS loudness
  micAnalyserTD.getFloatTimeDomainData(micTimeData);
  let sum = 0;
  for (let i = 0; i < micTimeData.length; i++) {
    const v = micTimeData[i];
    sum += v * v;
  }
  const rms = Math.sqrt(sum / micTimeData.length);
  const loud = clamp(rms * 3.4, 0, 1); // scale
  // smooth fast level
  micLevel = lerp(micLevel, loud, 0.35);

  // “breath” envelope: much slower low-pass
  micBreath = lerp(micBreath, micLevel, 0.06);

  // Voice vs Noise + Pitch detection:
  // We run pitch autocorrelation; if confidence is high => voiceLikely
  const { hz, conf } = detectPitchAC(micTimeData, micCtx.sampleRate);
  pitchHz = hz;
  pitchConf = conf;

  // Simple noise/voice decision:
  // - voice if pitchConf good AND energy not too extreme high-frequency
  micAnalyserFD.getFloatFrequencyData(micFreqData);
  const flat = spectralFlatness(micFreqData);
  const centroid = spectralCentroid(micFreqData, micCtx.sampleRate);

  // voice heuristic:
  // pitchConf high, centroid moderate, flatness low-ish
  voiceLikely = (pitchConf > 0.45 && centroid > 250 && centroid < 2600 && flat < 0.55);

  // Hue from pitch: map 80..700 Hz to 210..20 (blue -> warm)
  if (voiceLikely && pitchHz > 60 && pitchHz < 900) {
    const pn = clamp((pitchHz - 80) / (700 - 80), 0, 1);
    pitchHue = lerp(210, 20, pn);
  } else {
    // fallback hue (gentle pink-ish)
    pitchHue = lerp(pitchHue, 320, 0.02);
  }

  setMicStatus();
}

// Autocorrelation pitch (robust enough for voice)
function detectPitchAC(buf, sampleRate) {
  // remove DC
  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length;

  // energy gate
  let energy = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] - mean;
    energy += v * v;
  }
  energy /= buf.length;
  if (energy < 0.00002) return { hz: 0, conf: 0 };

  // search lag range for voice
  const minHz = 80, maxHz = 700;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < buf.length - lag; i++) {
      corr += (buf[i] - mean) * (buf[i + lag] - mean);
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag < 0) return { hz: 0, conf: 0 };

  // normalize correlation into [0..1]
  const conf = clamp(bestCorr / (buf.length * energy), 0, 1);
  const hz = sampleRate / bestLag;

  // reject unstable
  if (hz < minHz || hz > maxHz) return { hz: 0, conf: 0 };
  return { hz, conf };
}

function spectralCentroid(dbArray, sampleRate) {
  // dbArray: negative dB values, convert to linear magnitude
  let num = 0, den = 0;
  const nyq = sampleRate / 2;
  const n = dbArray.length;
  for (let i = 0; i < n; i++) {
    const mag = Math.pow(10, dbArray[i] / 20);
    const f = (i / n) * nyq;
    num += f * mag;
    den += mag;
  }
  return den > 1e-9 ? num / den : 0;
}

function spectralFlatness(dbArray) {
  // geometric mean / arithmetic mean
  let geo = 0, ari = 0;
  const n = dbArray.length;
  for (let i = 0; i < n; i++) {
    const mag = Math.max(1e-8, Math.pow(10, dbArray[i] / 20));
    geo += Math.log(mag);
    ari += mag;
  }
  geo = Math.exp(geo / n);
  ari = ari / n;
  return ari > 1e-9 ? clamp(geo / ari, 0, 1) : 1;
}

// ===================== AUDIO (ENDLESS GENERATIVE) =====================
// (same as earlier endless engine, but with: if mic ON => audio disabled)
let audioCtx = null;
let master = null;
let timbreLP = null;
let compressor = null;
let reverb = null;
let reverbWet = null;
let reverbDry = null;

let busPad = null;
let busArp = null;
let busMel = null;
let busBass = null;
let busPerc = null;

let audioOn = false;
let userVolume = 0.65;

let rngMusic = mulberry32(((seasonSeed(seasonKey()) ^ 0xA5A5A5A5) >>> 0));
function rand() { return rngMusic(); }
function randRange(a,b){ return lerp(a,b,rand()); }
function pick(arr){ return arr[Math.floor(rand()*arr.length) % arr.length]; }
function chance(p){ return rand() < p; }

function setAudioButton() { btnAudio.textContent = audioOn ? "Audio: ON" : "Audio: OFF"; }

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

audioGenreSel.addEventListener("change", () => {
  try { localStorage.setItem("pi_genre", audioGenreSel.value); } catch {}
  musicState.forceNewSection = true;
});
(function loadGenre() {
  try {
    const g = localStorage.getItem("pi_genre");
    if (g) audioGenreSel.value = g;
  } catch {}
})();

async function hardResumeAudio() {
  try { if (audioCtx && audioCtx.state !== "running") await audioCtx.resume(); } catch {}
}
document.addEventListener("pointerdown", () => { hardResumeAudio(); }, { passive: true });
document.addEventListener("touchend",  () => { hardResumeAudio(); }, { passive: true });
document.addEventListener("click",     () => { hardResumeAudio(); }, { passive: true });

btnAudio.addEventListener("click", async () => {
  if (!audioOn) await enableAudio();
  else await disableAudio();
});
setAudioButton();

function makeImpulse(ctx, seconds = 2.2, decay = 2.6) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, decay);
      data[i] = (Math.random() * 2 - 1) * env * (0.65 + 0.35 * Math.sin(i * 0.001));
    }
  }
  return buf;
}

async function enableAudio() {
  if (audioOn) return;

  // If mic is ON, turn it OFF (exclusive)
  if (micEnabled) {
    toggleMic.checked = false;
    disableMic();
    setMicStatus();
  }

  audioOn = true;
  setAudioButton();

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0.0001;

  timbreLP = audioCtx.createBiquadFilter();
  timbreLP.type = "lowpass";
  timbreLP.frequency.value = 8000;
  timbreLP.Q.value = 0.8;

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 24;
  compressor.ratio.value = 3.3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.20;

  reverb = audioCtx.createConvolver();
  reverb.buffer = makeImpulse(audioCtx, 2.4, 2.8);
  reverbWet = audioCtx.createGain();
  reverbDry = audioCtx.createGain();
  reverbWet.gain.value = 0.28;
  reverbDry.gain.value = 0.92;

  busPad  = audioCtx.createGain();  busPad.gain.value  = 0.55;
  busArp  = audioCtx.createGain();  busArp.gain.value  = 0.60;
  busMel  = audioCtx.createGain();  busMel.gain.value  = 0.68;
  busBass = audioCtx.createGain();  busBass.gain.value = 0.60;
  busPerc = audioCtx.createGain();  busPerc.gain.value = 0.42;

  const buses = [busPad, busArp, busMel, busBass, busPerc];
  for (const b of buses) {
    b.connect(reverbDry);
    b.connect(reverbWet);
  }
  reverbWet.connect(reverb);
  reverb.connect(timbreLP);

  reverbDry.connect(timbreLP);
  timbreLP.connect(compressor);
  compressor.connect(master);
  master.connect(audioCtx.destination);

  musicState.reset(audioCtx);

  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }

  // small test beep
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = 440;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.02, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    o.start(t0);
    o.stop(t0 + 0.18);
  } catch {}
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
  reverb = null;
  reverbWet = null;
  reverbDry = null;

  busPad = busArp = busMel = busBass = busPerc = null;
}

function updateTimbreAndGain() {
  if (!audioCtx) return;

  const cloudN = clamp(weather.cloudCover / 100, 0, 1);
  const fogN = clamp(weather.fog, 0, 1);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);
  const tN = tempNorm(weather.tempC);

  const muffle = clamp(fogN * 0.80 + cloudN * 0.55, 0, 1);
  let cutoff = lerp(9000, 900, muffle);
  if (!isDayEffective()) cutoff *= 0.72;
  timbreLP.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.18);

  let wet = lerp(0.18, 0.42, clamp(muffle * 0.9 + rainN * 0.25, 0, 1));
  if (!isDayEffective()) wet *= 1.10;
  reverbWet.gain.setTargetAtTime(clamp(wet, 0.10, 0.55), audioCtx.currentTime, 0.20);

  const energy = clamp(tN * 0.55 + rainN * 0.50 + windN * 0.20, 0, 1);
  let g = lerp(0.050, 0.095, energy);
  if (!isDayEffective()) g *= 0.78;
  g *= userVolume;
  master.gain.setTargetAtTime(clamp(g, 0.0001, 0.14), audioCtx.currentTime, 0.25);
}

// ===================== MUSIC ENGINE (endless) =====================
const SCALES = {
  ionian:    [0, 2, 4, 5, 7, 9, 11],
  dorian:    [0, 2, 3, 5, 7, 9, 10],
  aeolian:   [0, 2, 3, 5, 7, 8, 10],
  lydian:    [0, 2, 4, 6, 7, 9, 11],
  mixolyd:   [0, 2, 4, 5, 7, 9, 10],
  pentMaj:   [0, 2, 4, 7, 9],
  pentMin:   [0, 3, 5, 7, 10],
  blues:     [0, 3, 5, 6, 7, 10]
};
const QUAL = {
  maj7:  [0, 4, 7, 11],
  min7:  [0, 3, 7, 10],
  dom7:  [0, 4, 7, 10],
  m9:    [0, 3, 7, 10, 14],
  M9:    [0, 4, 7, 11, 14],
  sus9:  [0, 5, 7, 10, 14],
  add9:  [0, 4, 7, 14],
  dim7:  [0, 3, 6, 9],
};
const MARKOV = {
  winter: { 1:[4,6], 2:[5], 3:[6], 4:[1,2,5], 5:[1,6], 6:[2,4], 7:[1,3] },
  spring: { 1:[4,5,6], 2:[5,7], 3:[6], 4:[1,2,5], 5:[1,6], 6:[2,4,5], 7:[1] },
  summer: { 1:[4,5,6], 2:[5], 3:[6,4], 4:[1,2,5], 5:[1,6], 6:[2,4,5], 7:[1,3] },
  autumn: { 1:[4,6], 2:[5,7], 3:[6], 4:[1,2,5], 5:[1,6], 6:[2,4], 7:[1] }
};
function chooseModeAndScale() {
  const sk = seasonKey();
  const genre = (audioGenreSel.value || "jazz");
  const day = isDayEffective();
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const fogN = clamp(weather.fog, 0, 1);
  const dark = clamp((fogN*0.8 + rainN*0.6 + (day?0:0.55)), 0, 1);

  if (genre === "blues") return { mode: "blues", scale: SCALES.blues };
  if (genre === "soul")  return { mode: dark > 0.55 ? "dorian" : "mixolyd", scale: dark > 0.55 ? SCALES.dorian : SCALES.mixolyd };
  if (genre === "classical") return { mode: dark > 0.55 ? "aeolian" : "ionian", scale: dark > 0.55 ? SCALES.aeolian : SCALES.ionian };

  if (sk === "winter") return { mode: dark > 0.45 ? "dorian" : "lydian", scale: dark > 0.45 ? SCALES.dorian : SCALES.lydian };
  if (sk === "summer") return { mode: dark > 0.45 ? "mixolyd" : "pentMaj", scale: dark > 0.45 ? SCALES.mixolyd : SCALES.pentMaj };
  if (sk === "spring") return { mode: dark > 0.45 ? "dorian" : "ionian", scale: dark > 0.45 ? SCALES.dorian : SCALES.ionian };
  return { mode: dark > 0.45 ? "aeolian" : "dorian", scale: dark > 0.45 ? SCALES.aeolian : SCALES.dorian };
}
function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function clampMidi(m){ return clamp(m, 30, 96); }

function weatherTempoBpm() {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);
  const cloudN = clamp(weather.cloudCover / 100, 0, 1);
  const energy = clamp(tN * 0.60 + rainN * 0.55 + windN * 0.25 + cloudN * 0.10, 0, 1);
  let bpm = lerp(52, 104, energy);
  const genre = (audioGenreSel.value || "jazz");
  if (genre === "classical") bpm *= 0.88;
  if (genre === "blues") bpm *= 0.92;
  if (!isDayEffective()) bpm *= 0.82;
  return clamp(bpm, 40, 118);
}

function makeVoice({type="sine", freq=440, when=0, dur=0.3, vel=0.06, bus, detune=0, cutoff=0}) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();

  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  o.detune.setValueAtTime(detune, when);

  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff > 0 ? cutoff : 12000, when);
  f.Q.setValueAtTime(0.7, when);

  o.connect(f);
  f.connect(g);
  g.connect(bus);

  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  o.start(when);
  o.stop(when + dur + 0.06);
}

function noiseHit(when, dur, vel, hpHz=2000) {
  if (!audioCtx) return;
  const sr = audioCtx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = audioCtx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const env = Math.pow(1 - t, 2.3);
    data[i] = (Math.random()*2-1) * env;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(hpHz, when);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  src.connect(hp);
  hp.connect(g);
  g.connect(busPerc);

  src.start(when);
  src.stop(when + dur + 0.02);
}
function kick(when, vel=0.10) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(90, when);
  o.frequency.exponentialRampToValueAtTime(48, when + 0.10);

  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vel, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);

  o.connect(g);
  g.connect(busPerc);
  o.start(when);
  o.stop(when + 0.20);
}

const musicState = {
  ready: false,
  forceNewSection: false,
  bpm: 72,
  beat: 60/72,
  bar: (60/72)*4,
  keyMidi: 57,
  scale: SCALES.dorian,
  modeName: "dorian",
  degree: 1,
  melMidi: 72,
  melDir: 1,
  nextTime: 0,
  lookAhead: 0.9,
  sectionEndsAt: 0,

  reset(ctx) {
    this.ready = true;
    this.forceNewSection = true;
    this.nextTime = ctx.currentTime + 0.12;
    this.sectionEndsAt = ctx.currentTime + 0.1;
    rngMusic = mulberry32(((Date.now() ^ seasonSeed(seasonKey())) >>> 0) ^ 0xC0FFEE);
  },

  newSection(ctx) {
    const { mode, scale } = chooseModeAndScale();
    this.modeName = mode;
    this.scale = scale;

    this.bpm = weatherTempoBpm();
    this.beat = 60 / this.bpm;
    this.bar = this.beat * 4;

    const tN = tempNorm(weather.tempC);
    const rainN = clamp(weather.rainMm / 10, 0, 1);
    const drift = Math.floor(lerp(-3, 4, rand()) + lerp(-2, 2, tN) + lerp(0, 2, rainN));
    this.keyMidi = clampMidi(this.keyMidi + drift);

    this.degree = pick([1,1,1,4,6,2,5]);
    this.melMidi = clampMidi(68 + Math.floor(randRange(-7, 6)));

    const baseMin = isDayEffective() ? 2.0 : 3.2;
    const extra = isDayEffective() ? 4.0 : 5.0;
    const minutes = baseMin + rand() * extra;
    this.sectionEndsAt = ctx.currentTime + minutes * 60;

    this.forceNewSection = false;
  }
};

function degreeToMidi(keyMidi, scale, degree1to7, octave=0) {
  const d = ((degree1to7 - 1) % 7 + 7) % 7;
  const semi = scale[d % scale.length];
  return keyMidi + semi + octave*12;
}
function chooseChordQuality() {
  const genre = (audioGenreSel.value || "jazz");
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const fogN = clamp(weather.fog, 0, 1);
  const dark = clamp(fogN*0.8 + rainN*0.6 + (!isDayEffective()?0.6:0), 0, 1);

  if (genre === "classical") return dark > 0.5 ? QUAL.min7 : QUAL.maj7;
  if (genre === "blues") return QUAL.dom7;
  if (genre === "soul") return dark > 0.5 ? QUAL.m9 : QUAL.M9;

  if (dark > 0.65 && chance(0.20)) return QUAL.dim7;
  if (chance(0.30)) return QUAL.m9;
  if (chance(0.30)) return QUAL.M9;
  if (chance(0.25)) return QUAL.sus9;
  return chance(0.5) ? QUAL.min7 : QUAL.maj7;
}
function nextDegreeMarkov(curDeg) {
  const sk = seasonKey();
  const table = MARKOV[sk] || MARKOV.spring;
  const opts = table[curDeg] || [1,4,5,6];
  let d = pick(opts);
  if (d === curDeg && opts.length > 1) d = pick(opts);
  return d;
}
function snapToScale(midi, keyMidi, scale) {
  const pc = ((midi - keyMidi) % 12 + 12) % 12;
  let best = 0, bestDist = 999;
  for (const s of scale) {
    const d = Math.abs(((pc - s + 12) % 12));
    const dist = Math.min(d, 12 - d);
    if (dist < bestDist) { bestDist = dist; best = s; }
  }
  const targetPc = best;
  let delta = ((targetPc - pc + 12) % 12);
  if (delta > 6) delta -= 12;
  return clampMidi(midi + delta);
}

function scheduleBar(tBarStart) {
  if (!audioCtx) return;

  if (musicState.forceNewSection || tBarStart >= musicState.sectionEndsAt) {
    musicState.newSection(audioCtx);
  }

  const targetBpm = weatherTempoBpm();
  musicState.bpm = lerp(musicState.bpm, targetBpm, 0.06);
  musicState.beat = 60 / musicState.bpm;
  musicState.bar = musicState.beat * 4;

  updateTimbreAndGain();

  const prevDeg = musicState.degree;
  musicState.degree = nextDegreeMarkov(musicState.degree);

  const { scale } = musicState;
  const rootMidi = degreeToMidi(musicState.keyMidi, scale, musicState.degree, 0);
  const qual = chooseChordQuality();
  const chordMidis = qual.map(semi => clampMidi(rootMidi + semi));

  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);
  const fogN  = clamp(weather.fog, 0, 1);
  const cloudN = clamp(weather.cloudCover/100, 0, 1);

  const energy = clamp(tempNorm(weather.tempC)*0.55 + rainN*0.55 + windN*0.20, 0, 1);
  const calm = clamp(1 - energy, 0, 1);
  const night = !isDayEffective();

  // PAD swells (no drone)
  const swells = night ? (chance(0.65) ? 1 : 2) : (chance(0.35 + calm*0.35) ? 2 : 3);
  for (let i = 0; i < swells; i++) {
    const t0 = tBarStart + randRange(0.0, musicState.bar * 0.65);
    const dur = randRange(musicState.beat*1.6, musicState.beat*3.6) * (night ? 1.25 : 1.0);
    const vel = (0.030 + 0.040*calm) * (night ? 0.75 : 1.0);
    const noteCount = pick([3,4,4,5]);

    for (let v = 0; v < noteCount; v++) {
      const midi = chordMidis[v % chordMidis.length] + (v >= 3 ? 12 : 0) + (chance(0.25) ? 12 : 0);
      const hz = midiToHz(clampMidi(midi));
      const type = chance(0.5) ? "sine" : "triangle";
      const cutoff = lerp(9000, 1800, clamp(fogN*0.8 + cloudN*0.5, 0, 1));
      makeVoice({ type, freq: hz, when: t0, dur: dur, vel: vel / noteCount, bus: busPad, detune: randRange(-6,6), cutoff });
    }
  }

  // ARP
  const arpDensity = clamp(0.18 + energy*0.75, 0.12, 0.92) * (night ? 0.55 : 1.0);
  const steps = pick([8, 12, 16]);
  const stepDur = musicState.bar / steps;

  const pattern = [];
  const perm = chordMidis.slice();
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i+1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < steps; i++) {
    const base = perm[i % perm.length] + (chance(0.35) ? 12 : 0) + (chance(0.12) ? 24 : 0);
    pattern.push(clampMidi(base));
  }

  for (let i = 0; i < steps; i++) {
    if (!chance(arpDensity)) continue;
    const t = tBarStart + i * stepDur + (chance(0.45) ? stepDur*randRange(0.02,0.10) : 0);
    const midi = pattern[i];
    const hz = midiToHz(midi);
    const dur = stepDur * randRange(0.55, 0.95);
    const vel = (0.028 + 0.045*energy) * (night ? 0.70 : 1.0);
    const cutoff = lerp(12000, 2400, clamp(fogN*0.9 + cloudN*0.45, 0, 1));
    makeVoice({ type: chance(0.65) ? "triangle" : "sine", freq: hz, when: t, dur, vel, bus: busArp, detune: randRange(-4,4), cutoff });
  }

  // MELODY
  const phraseChance = clamp(0.18 + energy*0.50, 0.12, 0.62) * (night ? 0.55 : 1.0);
  const phrases = chance(phraseChance) ? 1 : (chance(phraseChance*0.55) ? 2 : 0);

  for (let p = 0; p < phrases; p++) {
    const phraseLen = pick([3,4,5,6]);
    let t = tBarStart + randRange(0.0, musicState.bar*0.65);
    let cur = musicState.melMidi;

    for (let n = 0; n < phraseLen; n++) {
      const leap = chance(0.12 + energy*0.08);
      const step = leap ? pick([-5,-4,4,5,7,-7]) : pick([-2,-1,1,2,3,-3]);
      const dirBias = (chance(0.60) ? musicState.melDir : -musicState.melDir);
      cur = clampMidi(cur + step * dirBias);
      cur = snapToScale(cur, musicState.keyMidi, scale);
      if (n > 0 && cur === musicState.melMidi) cur = clampMidi(cur + pick([-2,2,3,-3]));
      musicState.melDir = (cur >= musicState.melMidi) ? 1 : -1;
      musicState.melMidi = cur;

      const hz = midiToHz(cur);
      const dur = randRange(musicState.beat*0.30, musicState.beat*0.85) * (night ? 1.15 : 1.0);
      const vel = (0.030 + 0.030*calm + 0.020*energy) * (night ? 0.72 : 1.0);
      const cutoff = lerp(11000, 3200, clamp(fogN*0.85 + cloudN*0.50, 0, 1));
      const type = (audioGenreSel.value === "classical") ? "sine" : (chance(0.6) ? "triangle" : "sine");
      makeVoice({ type, freq: hz, when: t, dur, vel, bus: busMel, detune: randRange(-3,3), cutoff });

      if (chance(0.22 + calm*0.20) && !night) {
        const hz2 = midiToHz(clampMidi(cur + pick([7,12,-5,5])));
        makeVoice({ type: "sine", freq: hz2, when: t + randRange(0.03,0.08), dur: dur*0.85, vel: vel*0.55, bus: busMel, detune: randRange(-2,2), cutoff: cutoff*0.9 });
      }

      t += randRange(musicState.beat*0.25, musicState.beat*0.75);
      if (t > tBarStart + musicState.bar*0.95) break;
    }
  }

  // BASS
  const bassOn = chance(night ? 0.35 : (0.45 + energy*0.25));
  if (bassOn) {
    const t0 = tBarStart + (chance(0.65) ? 0 : musicState.beat * pick([1,2]));
    const bassMidi = clampMidi(rootMidi - 12 - (chance(0.25) ? 12 : 0));
    const hz = midiToHz(bassMidi);
    const dur = musicState.beat * randRange(1.2, 2.3);
    const vel = (0.030 + 0.040*energy) * (night ? 0.65 : 1.0);
    makeVoice({ type: "sine", freq: hz, when: t0, dur, vel, bus: busBass, detune: randRange(-2,2), cutoff: 2200 });
  }

  // PERC
  const percDensity = clamp(0.08 + energy*0.55 + rainN*0.25, 0.06, 0.90) * (night ? 0.55 : 1.0);
  const subSteps = 16;
  const subDur = musicState.bar / subSteps;

  for (let i = 0; i < subSteps; i++) {
    const t = tBarStart + i * subDur;
    if (chance(percDensity * 0.55)) {
      const vel = (0.010 + 0.030*percDensity) * (1 - fogN*0.35);
      noiseHit(t, subDur*0.55, vel, lerp(2400, 1600, fogN));
    }
    if (chance(percDensity * (night ? 0.10 : 0.18)) && (i === 0 || i === 8 || chance(0.12))) {
      kick(t, (night ? 0.05 : 0.08) + 0.05*energy);
    }
  }

  if (chance(0.10) && prevDeg !== musicState.degree) {
    const tCad = tBarStart + musicState.bar * randRange(0.60, 0.92);
    const cadMidi = clampMidi(rootMidi + pick([7, 12, -5]));
    makeVoice({ type:"sine", freq:midiToHz(cadMidi), when:tCad, dur:musicState.beat*0.45, vel:0.018*(night?0.7:1.0), bus: busArp, detune: 0, cutoff: 5200 });
  }
}

function audioScheduler() {
  if (!audioOn || !audioCtx || alarmRinging || !musicState.ready) return;
  const now = audioCtx.currentTime;
  while (musicState.nextTime < now + musicState.lookAhead) {
    scheduleBar(musicState.nextTime);
    musicState.nextTime += musicState.bar;
  }
}

// ===================== ALARM =====================
let alarmRinging = false;
let alarmEndsAt = 0;
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
  if (musicState.ready && audioCtx) musicState.reset(audioCtx);
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

// ===================== MOTION (meteo + mic) =====================
function step(dt, ms) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const { wx, wy, windN } = windVec();

  // mic influence
  // - meditation: use slow envelope "breath"
  // - normal: use micLevel; voice adds extra
  const micBase = micEnabled ? (meditationEnabled ? micBreath : micLevel) : 0;
  const micVibe = micEnabled ? (meditationEnabled ? micBreath : (micLevel * (voiceLikely ? 1.25 : 0.85))) : 0;

  const base = lerp(14, 60, tN);
  const vibr = alarmRinging ? (3.5 + 6.0 * rainN) : 0;
  const squashWeather = clamp(0.15 + windN * 0.75 + rainN * 0.55, 0, 1);

  // if meditation, calm down weather motion a bit
  const calmFactor = meditationEnabled ? 0.55 : 1.0;

  if (currentMode === "circles") {
    for (const c of circles) {
      c.p += dt * (PI * 0.18 + c.s * 0.06) * calmFactor;

      c.squashPhase += dt * c.squashSpeed * (0.8 + 1.4 * rainN) * calmFactor;
      c.rotPhase    += dt * c.rotSpeed * (0.7 + 1.2 * windN) * calmFactor;
      const osc = Math.sin(c.squashPhase);
      c.squash = (c.squashBase + c.squashMax * squashWeather) * osc;
      c.rot = (Math.sin(c.rotPhase) * 0.35) * (0.15 + 0.85 * windN);

      // mic expansion + vibration
      c._micScale = 1 + micBase * (voiceLikely ? 0.55 : 0.38);
      c._micVib = micVibe;

      const hx = Math.sin(c.p) * (0.9 + 1.3 * (1 - rainN));
      const hy = Math.cos(c.p / PI) * (0.9 + 1.3 * (1 - rainN));

      const sunMode = isDayEffective() && rainN < 0.02;
      if (sunMode) {
        c.x += (Math.cos(c.p) * 18 + hx) * dt * calmFactor;
        c.y += (Math.sin(c.p) * 10 + hy) * dt * calmFactor;
        c.y -= dt * (6 + 10 * tN) * 0.9 * calmFactor;
        c.y += (H * 0.35 - c.y) * dt * 0.05 * calmFactor;
      } else {
        c.y += base * (0.3 + 2.0 * rainN) * dt * 0.9 * calmFactor;
        c.x += hx * dt * 2 * calmFactor;
      }

      c.x += wx * base * (0.5 + 1.2 * windN) * dt * calmFactor;
      c.y += wy * base * (0.5 + 1.2 * windN) * dt * calmFactor;

      if (c._micVib > 0) {
        const amp = 10 + 26 * c._micVib;
        c.x += Math.sin(ms / 35 + c.p) * amp * dt * 9;
        c.y += Math.cos(ms / 41 + c.p) * amp * dt * 9;
      }

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

  if (currentMode === "splash") {
    const expand = lerp(0.08, 0.55, rainN);
    const storm = clamp(rainN * 0.8 + windN * 0.35, 0, 1);

    for (const s of splashes) {
      s.p += dt * s.wob * (0.7 + 1.6 * storm) * calmFactor;
      s.rot += dt * s.rotSpeed * (0.4 + 1.4 * windN) * calmFactor;

      s.x += wx * base * s.drift * dt * 1.35 * calmFactor;
      s.y += wy * base * s.drift * dt * 1.35 * calmFactor;
      s.y += base * (0.12 + 0.55 * rainN) * dt * 0.35 * calmFactor;

      // mic influences splash expansion + wobble
      s._expand = expand + micBase * (voiceLikely ? 0.95 : 0.70);
      s._storm = storm;
      s._micVib = micVibe;

      if (s._micVib > 0) {
        const amp = 14 + 34 * s._micVib;
        s.x += Math.sin(ms / 28 + s.p) * amp * dt * 6;
        s.y += Math.cos(ms / 33 + s.p) * amp * dt * 6;
        s.rot += (s._micVib * 0.30) * dt * 3.0;
      }

      if (vibr > 0) {
        s.x += Math.sin(ms / 28 + s.p) * vibr * dt * 55;
        s.y += Math.cos(ms / 33 + s.p) * vibr * dt * 55;
      }

      const pad = 140;
      if (s.x < -pad) s.x = W + pad;
      if (s.x > W + pad) s.x = -pad;
      if (s.y < -pad) s.y = H + pad;
      if (s.y > H + pad) s.y = -pad;
    }
  }

  if (currentMode === "diamonds") {
    const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);

    for (const d of diamonds) {
      d.a += dt * d.spin * (0.6 + 1.8 * windN) * calmFactor;
      d.skewPhase += dt * d.skewSpeed * (0.7 + 1.3 * storm) * calmFactor;

      d.x += (d.vx + wx * base * 1.6) * dt * calmFactor;
      d.y += (d.vy + wy * base * 1.6) * dt * calmFactor;
      d.y += base * (0.05 + 0.45 * rainN) * dt * calmFactor;

      d._micScale = 1 + micBase * (voiceLikely ? 0.60 : 0.40);
      d._micVib = micVibe;

      if (d._micVib > 0) {
        const amp = 10 + 28 * d._micVib;
        d.x += Math.sin(ms / 31 + d.a) * amp * dt * 7;
        d.y += Math.cos(ms / 37 + d.a) * amp * dt * 7;
        d.skewPhase += d._micVib * dt * 3.0;
      }

      if (vibr > 0) {
        d.x += Math.sin(ms / 31 + d.a) * vibr * dt * 60;
        d.y += Math.cos(ms / 37 + d.a) * vibr * dt * 60;
      }

      const pad = 160;
      if (d.x < -pad) d.x = W + pad;
      if (d.x > W + pad) d.x = -pad;
      if (d.y < -pad) d.y = H + pad;
      if (d.y > H + pad) d.y = -pad;
    }
  }

  // Pink dot
  if (infoDot) {
    const speedWeather = lerp(0.85, 1.25, clamp(tN * 0.7 + rainN * 0.5 + windN * 0.2, 0, 1));
    const micBoost = micEnabled ? (meditationEnabled ? micBreath : micLevel) : 0;
    const speed = infoDot.speedMul * speedWeather * (1 + micBoost * 0.15);

    infoDot.squashPhase += dt * infoDot.squashSpeed * (1.0 + 1.6 * rainN);
    infoDot.rotPhase    += dt * infoDot.rotSpeed * (0.8 + 1.6 * windN);
    const oscP = Math.sin(infoDot.squashPhase);
    infoDot.squash = (infoDot.squashBase + infoDot.squashMax * squashWeather) * oscP;
    infoDot.rot = (Math.sin(infoDot.rotPhase) * 0.6) * (0.15 + 0.85 * windN);

    infoDot.vx += wx * 12 * dt;
    infoDot.vy += wy * 12 * dt;

    infoDot.p += dt * (PI * 0.14 + infoDot.s * 0.06) * speed;

    const wobX = Math.sin(infoDot.p) * (14 + 10 * (1 - rainN));
    const wobY = Math.cos(infoDot.p / PI) * (10 + 8 * (1 - rainN));

    infoDot.x += (infoDot.vx * dt) * speed + wobX * dt;
    infoDot.y += (infoDot.vy * dt) * speed + wobY * dt;

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
  drawFooter();
}

function hslStroke(alpha=0.9) {
  // pitchHue is meaningful only when voiceLikely, otherwise subtle
  const sat = voiceLikely ? 78 : 10;
  const lig = voiceLikely ? 42 : 50;
  return `hsla(${pitchHue},${sat}%,${lig}%,${alpha})`;
}

function drawCircles(ms) {
  const day = isDayEffective();

  // base black/white, but if voice: tint with pitch color
  const base = day ? "rgba(0,0,0,0.90)" : "rgba(255,255,255,0.95)";
  ctx.strokeStyle = (micEnabled && voiceLikely) ? hslStroke(day ? 0.70 : 0.78) : base;
  ctx.lineWidth = 2.6;

  ctx.beginPath();
  for (const c of circles) {
    const scale = c._micScale || 1;
    const rx = (c.r * scale) * (1 + (c.squash || 0));
    const ry = (c.r * scale) * (1 - (c.squash || 0));
    ctx.moveTo(c.x + rx, c.y);
    ctx.ellipse(c.x, c.y, Math.max(1, rx), Math.max(1, ry), (c.rot || 0), 0, TAU);
  }
  ctx.stroke();
}

function drawSplashes(ms) {
  const alpha = isDayEffective() ? 0.92 : 0.80;

  // IMPORTANT: night => splash WHITE, day => BLACK
  const v = isDayEffective() ? 0 : 255;
  const isVoiceTint = micEnabled && voiceLikely;
  ctx.fillStyle = isVoiceTint ? `hsla(${pitchHue},78%,${isDayEffective()?30:70}%,${alpha})` : `rgba(${v},${v},${v},${alpha})`;

  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const { windN } = windVec();
  const ang = rainAngleForDraw();

  for (const s of splashes) {
    const breathe = 1 + Math.sin(s.p) * (s._expand || 0.2);
    const jitter = 0.10 + 0.25 * (s._storm || 0) + (s._micVib ? s._micVib * 0.35 : 0);
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
    ctx.fill();

    if (rainN > 0.35) drawRainDropletsForSplash(s, ms, base, rainN, windN, ang);
  }
}

function drawRainDropletsForSplash(s, ms, base, rainN, windN, ang) {
  const k = Math.floor(lerp(0, 10, clamp((rainN - 0.35) / 0.65, 0, 1)));
  if (k <= 0) return;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(ang + Math.sin(ms / 1800 + s.p) * 0.08);

  for (let i = 0; i < k; i++) {
    const seed = s.dropSeeds[i % s.dropSeeds.length];
    const t = (ms / 1000);

    const orbit = base * lerp(0.65, 1.45, (Math.sin(seed + t * (0.7 + 1.6 * rainN)) * 0.5 + 0.5));
    const side = (i % 2 === 0) ? -1 : 1;
    const lateral = side * base * lerp(0.15, 0.65, (Math.sin(seed * 1.7 + t * 0.9) * 0.5 + 0.5));

    const r = lerp(2.5, 9.0, rainN) * lerp(0.9, 1.15, windN);
    const x = lateral;
    const y = orbit;

    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.75, r * 1.25, 0, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y + r * 1.15);
    ctx.lineTo(x - r * 0.40, y + r * 1.85);
    ctx.lineTo(x + r * 0.40, y + r * 1.85);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawDiamonds(ms) {
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const { windN } = windVec();
  const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);

  for (const d of diamonds) {
    const micScale = d._micScale || 1;
    const skew = Math.sin(d.skewPhase) * d.skewAmt * (0.35 + 0.95 * storm);
    const sx = 1 + skew;
    const sy = 1 - skew;

    const a = isDayEffective() ? d.alpha : d.alpha * 0.78;

    // if voice => tint diamonds slightly with pitch color
    if (micEnabled && voiceLikely) {
      ctx.fillStyle = `hsla(${pitchHue},78%,52%,${Math.min(0.95, a)})`;
    } else {
      ctx.fillStyle = hexToRgba(d.color, a);
    }

    const size = d.size * lerp(0.95, 1.15, tN) * micScale;
    const w = size * sx;
    const h = size * sy;

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
  const full = h.length === 3 ? h.split("").map(ch => ch + ch).join("") : h;
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

// Footer: left mode label, right signature MB
function drawFooter() {
  const pad = 18;
  const y = H - pad;
  const day = isDayEffective();
  const col = day ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";

  ctx.save();
  ctx.fillStyle = col;
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 14px Arial";
  ctx.fillText(modeLabel(currentMode), pad, y);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = col;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = "italic 700 18px Arial";
  ctx.fillText("MB", W - pad, y);
  ctx.restore();
}

// ===================== Mode picker default =====================
loadMode();
showModePicker();

// ===================== Tap bottom-right => picker (any mode) =====================
function hitBottomRight(x, y) {
  const zone = Math.max(72, Math.min(120, Math.min(W, H) * 0.12));
  return (x >= W - zone && y >= H - zone);
}

// Already handled in pointerdown above (canvas handler)

// ===================== MAIN LOOP =====================
let last = performance.now();
function loop(ms) {
  const dt = clamp((ms - last) / 1000, 0, 0.05);
  last = ms;

  // mic analysis
  updateMicAnalysis();

  step(dt, ms);
  draw(ms);
  updateConsoleValues();

  if (audioOn) audioScheduler();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

toggleNight.onchange = () => { updateConsoleValues(); musicState.forceNewSection = true; };

// ===================== Menu + click rules =====================
function isModePickerOpenNow() { return isModePickerOpen(); }

// tap bottom-right handled already, but we keep it consistent:
canvas.addEventListener("pointerdown", (e) => {
  if (!overlay.classList.contains("hidden")) return;
  if (isModePickerOpenNow()) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (hitBottomRight(x, y)) {
    showModePicker();
  }
}, { passive: true });

// keep init after everything
initArt(currentMode);
setMicStatus();
