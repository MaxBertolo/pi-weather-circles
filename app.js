// π Weather Circles — evolved music + seasonal chords + alarm + vibration (free, no deps)

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

// ---------- UI ----------
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

const alarmEnabled = document.getElementById("alarm-enabled");
const alarmTime = document.getElementById("alarm-time");
const alarmSound = document.getElementById("alarm-sound");
const alarmTest = document.getElementById("alarm-test");
const alarmStop = document.getElementById("alarm-stop");

btnInfo.onclick = () => {
  const show = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !show);
  btnInfo.classList.toggle("active", show);
};

// ---------- Resize ----------
let W=0, H=0, DPR=1;
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
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const lerp = (a,b,t)=>a+(b-a)*t;
const pad2 = n => String(n).padStart(2,"0");
function tempNorm(tC){ return clamp((tC - (-15)) / (50 - (-15)), 0, 1); } // -15..50 -> 0..1

function seasonKey(d=new Date()){
  const m=d.getMonth();
  if (m===11 || m<=1) return "winter";
  if (m>=2 && m<=4) return "spring";
  if (m>=5 && m<=7) return "summer";
  return "autumn";
}

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
function isDayEffective(){ return toggleNight.checked ? false : weather.isDay; }

async function fetchWeather(lat=41.9, lon=12.5) {
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
  weather.fog = (typeof vis === "number") ? clamp(1 - vis/20000, 0, 1) : 0;

  updateHud();
  updatePanel();
}

btnGeo.onclick = () => {
  navigator.geolocation?.getCurrentPosition(
    p => fetchWeather(p.coords.latitude, p.coords.longitude),
    () => fetchWeather()
  );
};

fetchWeather().catch(()=>{});
setInterval(()=>fetchWeather().catch(()=>{}), 10*60*1000);

// ---------- HUD + Panel ----------
function updateHud(){
  const now = new Date();
  hudTime.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  hudTemp.textContent = `${Math.round(weather.tempC)}°`;
  hudCloud.textContent = `${Math.round(weather.cloudCover)}%`;
  hudRain.textContent = weather.rainMm.toFixed(1);
  hudWind.textContent = weather.windMs.toFixed(1);
  hudFog.textContent = `${Math.round(weather.fog*100)}%`;
}
setInterval(updateHud, 10_000);

function updatePanel(){
  panelText.innerHTML =
    `<b>Season:</b> ${seasonKey()}<br>` +
    `<b>Mode:</b> ${isDayEffective() ? "Day" : "Night"}<br>` +
    `<b>Temp:</b> ${weather.tempC.toFixed(1)}°C<br>` +
    `<b>Cloud:</b> ${Math.round(weather.cloudCover)}%<br>` +
    `<b>Rain:</b> ${weather.rainMm.toFixed(1)} mm/h<br>` +
    `<b>Wind:</b> ${weather.windMs.toFixed(1)} m/s<br>` +
    `<b>Fog:</b> ${(weather.fog*100).toFixed(0)}%<br>` +
    `<b>Audio:</b> ${audioCtx ? audioCtx.state : "off"}<br>` +
    `<b>Alarm:</b> ${alarmEnabled.checked ? (alarmTime.value || "set time") : "disabled"} (${alarmSound.value})`;
}

// ---------- Visual circles ----------
const N=99;
let circles=[];

function initCircles(){
  circles=[];
  for (let i=0;i<N;i++){
    circles.push({
      x: Math.random()*W,
      y: Math.random()*H,
      r: 8 + Math.random()*16,
      p: (i+1)*PI,
      s: 0.4 + Math.random()*1.6,
      h: Math.random()*360
    });
  }
}
initCircles();

function bg(){
  const day = isDayEffective()?1:0;
  const clouds = clamp(weather.cloudCover/100,0,1);
  const fog = clamp(weather.fog,0,1);

  const greyT = clamp(0.10 + 0.65*fog + 0.25*clouds + (1-day)*0.35,0,1);
  const blueT = day * (1 - 0.6*clouds);

  const r = Math.floor(lerp(8, 92, greyT));
  const g = Math.floor(lerp(12, 102, greyT));
  const b = Math.floor(lerp(26, 170, greyT + 0.5*blueT));
  return `rgb(${r},${g},${b})`;
}

function strokeColor(c){
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
function step(dt, ms){
  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm/10,0,1);
  const windN = clamp(weather.windMs/12,0,1);

  const base = lerp(12, 65, tN);

  const windDir = (weather.windDirDeg||0)*PI/180;
  const wx = Math.cos(windDir)*windN;
  const wy = Math.sin(windDir)*windN;

  const vibr = alarmRinging ? (3.5 + 6.0*rainN) : 0;

  for (const c of circles){
    c.p += dt*(PI*0.22 + c.s*0.02);

    const hx = Math.sin(c.p) * (0.8 + 1.6*(1-rainN));
    const hy = Math.cos(c.p/PI) * (0.8 + 1.6*(1-rainN));

    const sunMode = isDayEffective() && rainN < 0.02;

    if (sunMode) {
      c.x += (Math.cos(c.p)*18 + hx) * dt;
      c.y += (Math.sin(c.p)*10 + hy) * dt;
      c.y -= dt*(6 + 10*tN);
      c.y += (H*0.35 - c.y) * dt * 0.05;
    } else {
      c.y += base*(0.3 + 2.0*rainN)*dt;
      c.x += hx*dt*2;
    }

    // wind drift
    c.x += wx*base*(0.5 + 1.2*windN)*dt;
    c.y += wy*base*(0.5 + 1.2*windN)*dt;

    // alarm vibration jitter
    if (vibr>0){
      c.x += Math.sin(ms/35 + c.h) * vibr * dt * 60;
      c.y += Math.cos(ms/41 + c.h) * vibr * dt * 60;
    }

    // wrap
    if (c.x < -c.r) c.x = W + c.r;
    if (c.x > W + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = H + c.r;
    if (c.y > H + c.r) c.y = -c.r;
  }

  if (alarmRinging && ms >= alarmEndsAt) stopAlarm();
}

function draw(ms){
  ctx.fillStyle = toggleNight.checked ? "rgb(8,10,14)" : bg();
  ctx.fillRect(0,0,W,H);

  ctx.lineWidth = 3;

  for (const c of circles){
    ctx.strokeStyle = strokeColor(c);
    ctx.beginPath();
    ctx.arc(c.x,c.y,c.r,0,PI*2);
    ctx.stroke();
  }
}

// ===================== AUDIO (evolved harmony) =====================
let audioCtx = null;
let master = null;
let voices = [];
let lfo = null;
let nextHitAt = 0;
let alarmNode = null;

const CHORDS = {
  winter: { day: [0,3,7],   night: [0,2,7]   }, // minor / sus2
  spring: { day: [0,4,7],   night: [0,3,7]   }, // major -> minor
  summer: { day: [0,4,7],   night: [0,5,9]   }, // major -> add6-ish
  autumn: { day: [0,3,7],   night: [0,3,10]  }  // minor -> minor7
};

function ensureAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0.02;
  master.connect(audioCtx.destination);

  // 3 poly voices
  for (let i=0;i<3;i++){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    g.gain.value = 0.0001;
    o.connect(g); g.connect(master);
    o.start();
    voices.push({o,g});
  }

  // LFO adds life (not monotone)
  lfo = audioCtx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.35;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 10;
  lfo.connect(lfoGain);
  lfoGain.connect(voices[0].o.frequency);
  lfo.start();

  btnAudio.textContent = "Audio enabled";
  updatePanel();
}

btnAudio.onclick = () => ensureAudio();

// resume helper (fix “enabled but silent” on some browsers)
document.addEventListener("pointerdown", async () => {
  if (audioCtx && audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}, { passive: true });

function setChord(baseHz, semis){
  const t = audioCtx.currentTime;
  for (let i=0;i<3;i++){
    const hz = baseHz * Math.pow(2, (semis[i] ?? semis[semis.length-1]) / 12);
    voices[i].o.frequency.setTargetAtTime(hz, t, 0.03);
  }
}
function hitChord(vel){
  const t = audioCtx.currentTime;
  for (const v of voices){
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(0.0001, t);
    v.g.gain.exponentialRampToValueAtTime(vel, t + 0.04);
    v.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  }
}

function updateMusic(ms){
  if (!audioCtx || alarmRinging) return;

  const s = seasonKey();
  const mode = isDayEffective() ? "day" : "night";
  const semis = CHORDS[s][mode];

  const tN = tempNorm(weather.tempC);
  const rainN = clamp(weather.rainMm/10,0,1);
  const windN = clamp(weather.windMs/12,0,1);

  // tonal center
  const baseHz = lerp(140, 520, tN);

  // tempo (sync with “frenesy”)
  const bpm = lerp(35, 115, clamp(tN + rainN*0.55 + windN*0.15, 0, 1));
  const intervalMs = 60000 / bpm;

  // louder with rain, softer at night
  const nightSoft = !isDayEffective();
  const vel = clamp((nightSoft ? 0.016 : 0.028) + rainN*0.010, 0.012, 0.055);
  master.gain.setTargetAtTime(clamp(vel + rainN*0.01, 0.012, 0.06), audioCtx.currentTime, 0.08);

  setChord(baseHz, semis);

  if (ms >= nextHitAt){
    nextHitAt = ms + intervalMs;

    // occasionally invert to avoid monotony
    const flip = Math.sin(ms/900) > 0.65;
    if (flip) setChord(baseHz*0.5, [semis[1], semis[2], semis[0] + 12]);

    hitChord(vel);
  }
}

// ===================== ALARM =====================
function loadAlarm(){
  try{
    const saved = JSON.parse(localStorage.getItem("pi_alarm")||"null");
    if (!saved) return;
    alarmEnabled.checked = !!saved.enabled;
    alarmTime.value = saved.time || "";
    alarmSound.value = saved.sound || "siren";
  }catch{}
}
function saveAlarm(){
  try{
    localStorage.setItem("pi_alarm", JSON.stringify({
      enabled: alarmEnabled.checked,
      time: alarmTime.value,
      sound: alarmSound.value
    }));
  }catch{}
  updatePanel();
}
alarmEnabled.onchange = saveAlarm;
alarmTime.onchange = saveAlarm;
alarmSound.onchange = saveAlarm;
loadAlarm();

function startAlarm(durationMs=30000){
  ensureAudio();

  alarmRinging = true;
  alarmEndsAt = performance.now() + durationMs;

  if (alarmSound.value === "siren") playSiren(durationMs);
  else playTrumpet(durationMs);
}
function stopAlarm(){
  alarmRinging = false;
  alarmEndsAt = 0;
  if (alarmNode) { try { alarmNode.stop(); } catch {} alarmNode = null; }
}

alarmTest.onclick = () => startAlarm(8000);
alarmStop.onclick = () => stopAlarm();

// check every second
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

function playSiren(durationMs){
  const t0 = audioCtx.currentTime;
  const dur = durationMs/1000;

  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sawtooth";
  g.gain.value = 0.0;
  o.connect(g);
  g.connect(audioCtx.destination);

  o.frequency.setValueAtTime(520, t0);
  const sweeps = Math.max(1, Math.floor(dur / 1.2));
  for (let i=0;i<sweeps;i++){
    const a = t0 + i*1.2;
    o.frequency.linearRampToValueAtTime(880, a+0.55);
    o.frequency.linearRampToValueAtTime(520, a+1.10);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12, t0+0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);

  o.start(t0);
  o.stop(t0+dur+0.05);
  alarmNode = o;
}

function playTrumpet(durationMs){
  const t0 = audioCtx.currentTime;
  const dur = durationMs/1000;

  const g = audioCtx.createGain();
  g.gain.value = 0.0;
  g.connect(audioCtx.destination);

  const o1 = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  o1.type = "square";
  o2.type = "triangle";
  o1.connect(g); o2.connect(g);

  // ceremonial motif
  const notes = [392, 494, 587, 784, 587, 494, 392];
  const step = 0.32;

  for (let i=0;i<Math.floor(dur/step);i++){
    const tt = t0 + i*step;
    const n = notes[i % notes.length];
    o1.frequency.setValueAtTime(n, tt);
    o2.frequency.setValueAtTime(n*0.5, tt);

    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(0.14, tt+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, tt+0.22);
  }

  o1.start(t0); o2.start(t0);
  o1.stop(t0+dur+0.05); o2.stop(t0+dur+0.05);
  alarmNode = o1;
}

// ---------- Main loop ----------
let last = performance.now();
function loop(ms){
  const dt = clamp((ms-last)/1000, 0, 0.05);
  last = ms;

  step(dt, ms);
  draw(ms);
  updateHud();
  updateMusic(ms);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// reactive updates
toggleNight.onchange = () => updatePanel();
