// π Weather Circles — Artwork + Fullscreen console via WHITE circle (no HUD)
// Rich music: 6-voice pad + 2-voice arpeggio, timbre muffled by fog/clouds
// Alarm: vibrate circles + siren/trumpet
// Background: DAY = WHITE -> GREY by clouds/fog (NO BLUE), NIGHT = dark

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

// click outside the card closes (optional)
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

// deterministic RNG to keep white circle stable per season
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

// ---------- Circles + WHITE trigger circle ----------
const N = 99;
let circles = [];
let infoCircle = null;

function initCircles() {
  const rng = mulberry32(seasonSeed(seasonKey()));

  circles = [];
  for (let i = 0; i < N; i++) {
    circles.push({
      x: rng() * W,
      y: rng() * H,
      r: 8 + rng() * 16,
      p: (i + 1) * PI,
      s: 0.4 + rng() * 1.6,
      h: rng() * 360,
      isInfo: false
    });
  }
  infoCircle = circles[Math.floor(rng() * circles.length)];
  infoCircle.isInfo = true;
}
initCircles();

// tap white circle -> open console
canvas.addEventListener("pointerdown", (e) => {
  if (!overlay.classList.contains("hidden")) return;
  if (!infoCircle) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const dx = x - infoCircle.x;
  const dy = y - infoCircle.y;
  const d = Math.sqrt(dx*dx + dy*dy);

  if (d <= infoCircle.r + 10) {
    updateConsoleValues();
    openConsole();
  }
}, { passive: true });

// ---------- Background + stroke color ----------
function bg() {
  const isDay = isDayEffective();
  const clouds = clamp(weather.cloudCover / 100, 0, 1);
  const fog = clamp(weather.fog, 0, 1);

  // White -> Grey factor (fog weighs more than clouds)
  const greyMix = clamp(clouds * 0.6 + fog * 0.9, 0, 1);

  if (isDay) {
    // DAY: pure white -> soft grey
    const v = Math.floor(lerp(255, 165, greyMix));
    return `rgb(${v},${v},${v})`;
  } else {
    // NIGHT: dark -> slightly lighter with clouds/fog
    const v = Math.floor(lerp(18, 55, greyMix));
    return `rgb(${v},${v},${Math.min(255, v + 6)})`;
  }
}

function strokeColor(c) {
  const t = tempNorm(weather.tempC);
  const baseHue = lerp(220, 25, t);
  const hue = (baseHue + c.h) % 360;
  const light = isDayEffective() ? lerp(52, 72, t) : lerp(40, 58, t);
  return `hsla(${hue.toFixed(0)},75%,${light.toFixed(0)}%,0.95)`;
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
  ctx.fillStyle = toggleNight.checked ? "rgb(8,10,14)" : bg();
  ctx.fillRect(0, 0, W, H);

  for (const c of circles) {
    if (c.isInfo) {
      const breathe = 0.12 + 0.10 * Math.sin(ms / 900);
      ctx.strokeStyle = `rgba(255,255,255,${(0.78 + breathe).toFixed(3)})`;
      ctx.lineWidth = 3.8;
    } else {
      ctx.strokeStyle = strokeColor(c);
      ctx.lineWidth = 3;
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, PI * 2);
    ctx.stroke();
  }
}

// ===================== AUDIO (rich pad 6 voices + 2 arp + timbre filter) =====================
let audioCtx = null;
let master = null;
let compressor = null;
let timbreFilter = null;
let padPan = null;
let arpPan = null;

let pad = [];
let arpA = null, arpB = null;
let nextChordAt = 0;
let nextArpAt = 0;
let arpIndex = 0;
let lastChord = null;
let alarmNode = null;

const CHORDS6 = {
  winter: { day: [0,3,7,10,14,17],  night: [0,2,7,10,14,19] },
  spring: { day: [0,4,7,11,14,16],  night: [0,3,7,10,14,17] },
  summer: { day: [0,4,7,9,14,16],   night: [0,5,9,12,14,19] },
  autumn: { day: [0,3,7,10,14,17],  night: [0,3,10,14,17,21] }
};

function ensureAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 20;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;

  timbreFilter = audioCtx.createBiquadFilter();
  timbreFilter.type = "lowpass";
  timbreFilter.frequency.value = 3500;
  timbreFilter.Q.value = 0.7;

  master = audioCtx.createGain();
  master.gain.value = 0.05;

  const canPan = !!audioCtx.createStereoPanner;
  padPan = canPan ? audioCtx.createStereoPanner() : null;
  arpPan = canPan ? audioCtx.createStereoPanner() : null;

  if (padPan && arpPan) { padPan.connect(timbreFilter); arpPan.connect(timbreFilter); }
  timbreFilter.connect(compressor);
  compressor.connect(master);
  master.connect(audioCtx.destination);

  pad = [];
  for (let i = 0; i < 6; i++) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = (i % 2 === 0) ? "sawtooth" : "triangle";
    osc.detune.value = (i - 2.5) * 4;
    g.gain.value = 0.0001;
    osc.connect(g);
    (padPan ? g.connect(padPan) : g.connect(timbreFilter));
    osc.start();
    pad.push({ osc, g });
  }

  arpA = makeArpVoice("triangle", -6);
  arpB = makeArpVoice("sine", +6);

  btnAudio.textContent = "Audio enabled";
}

function makeArpVoice(type, detuneCents) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.detune.value = detuneCents;
  g.gain.value = 0.0001;
  osc.connect(g);
  (arpPan ? g.connect(arpPan) : g.connect(timbreFilter));
  osc.start();
  return { osc, g };
}

btnAudio.addEventListener("click", ensureAudio);

document.addEventListener("pointerdown", async () => {
  if (audioCtx && audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}, { passive: true });

function updateTimbreFilter() {
  if (!audioCtx) return;

  const fogN = clamp(weather.fog, 0, 1);
  const cloudN = clamp(weather.cloudCover / 100, 0, 1);
  const muffle = clamp(fogN * 0.75 + cloudN * 0.45, 0, 1);

  const cutoff = lerp(6500, 650, muffle);
  const q = lerp(0.6, 1.2, muffle);

  timbreFilter.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.12);
  timbreFilter.Q.setTargetAtTime(q, audioCtx.currentTime, 0.12);

  const tN = tempNorm(weather.tempC);
  const baseGain = lerp(0.035, 0.055, clamp(tN, 0, 1));
  const gainAdj = lerp(1.0, 0.85, muffle);
  master.gain.setTargetAtTime(baseGain * gainAdj, audioCtx.currentTime, 0.15);

  if (arpPan) {
    const panAmt = lerp(0.30, 0.06, muffle);
    arpPan.pan.setTargetAtTime(Math.sin(performance.now() / 7000) * panAmt, audioCtx.currentTime, 0.25);
  }
  if (padPan) {
    const panAmt = lerp(0.18, 0.04, muffle);
    padPan.pan.setTargetAtTime(Math.sin(performance.now() / 12000) * panAmt, audioCtx.currentTime, 0.35);
  }
}

function setPadChord(rootHz, semis) {
  const t = audioCtx.currentTime;
  for (let i = 0; i < 6; i++) {
    const hz = rootHz * Math.pow(2, (semis[i] ?? semis[semis.length - 1]) / 12);
    pad[i].osc.frequency.setTargetAtTime(hz, t, 0.06);
  }
}
function padOn(level) {
  const t = audioCtx.currentTime;
  for (const v of pad) {
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), t);
    v.g.gain.linearRampToValueAtTime(level, t + 1.4);
  }
}
function padOff() {
  const t = audioCtx.currentTime;
  for (const v of pad) {
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), t);
    v.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  }
}
function arpPluck(gainNode, vel) {
  const t = audioCtx.currentTime;
  gainNode.gain.cancelScheduledValues(t);
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(vel, t + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
}

function updateMusic(ms) {
  if (!audioCtx || alarmRinging) return;

  updateTimbreFilter();

  const s = seasonKey();
  const mode = isDayEffective() ? "day" : "night";
  const semis = CHORDS6[s][mode];

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm / 10, 0, 1);
  const windN = clamp(weather.windMs / 12, 0, 1);

  const rootHz = lerp(110, 330, tN);

  const chordBpm = lerp(6, 16, clamp(rainN * 0.8 + windN * 0.3 + tN * 0.2, 0, 1));
  const chordIntervalMs = 60000 / chordBpm;

  const arpBpm = lerp(42, 168, clamp(tN + rainN * 0.6 + windN * 0.2, 0, 1));
  const arpIntervalMs = 60000 / arpBpm;

  const nightSoft = !isDayEffective();
  const padLevel = clamp((nightSoft ? 0.010 : 0.016) + rainN * 0.004, 0.008, 0.024);
  const arpVel = clamp((nightSoft ? 0.010 : 0.016) + rainN * 0.006, 0.008, 0.032);

  if (ms >= nextChordAt) {
    nextChordAt = ms + chordIntervalMs;

    const wobble = Math.sin(ms / 8000) + Math.cos(ms / 11000);
    const ratio = (wobble > 1.0) ? Math.pow(2, 7 / 12) : (wobble < -1.0 ? Math.pow(2, 3 / 12) : 1.0);
    const newRoot = rootHz * ratio;

    setPadChord(newRoot, semis);
    if (!lastChord) padOn(padLevel);
    lastChord = { newRoot, semis };
  } else {
    padOn(padLevel);
  }

  if (ms >= nextArpAt) {
    nextArpAt = ms + arpIntervalMs;

    const pattern = [0,1,2,3,4,5,4,3,2,1];
    const idx = pattern[arpIndex % pattern.length];
    arpIndex++;

    const cloudN = clamp(weather.cloudCover / 100, 0, 1);
    const drift = lerp(1.0, Math.pow(2, -2 / 12), cloudN * 0.4);

    const hz = rootHz * Math.pow(2, (semis[idx] / 12)) * drift;

    arpA.osc.frequency.setTargetAtTime(hz, audioCtx.currentTime, 0.01);
    arpB.osc.frequency.setTargetAtTime(hz * 2, audioCtx.currentTime, 0.01);

    arpPluck(arpA.g, arpVel);
    arpPluck(arpB.g, arpVel * 0.7);
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
  if (audioCtx) lastChord = null;
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
  updateMusic(ms);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

toggleNight.onchange = () => updateConsoleValues();
updateConsoleValues();
