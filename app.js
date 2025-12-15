// π Weather Circles — NO PASSWORD, SAFE BASE

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

// ---------- Resize ----------
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", () => { resize(); initCircles(); });
resize();

// ---------- HUD ----------
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

btnInfo.onclick = () => {
  const show = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !show);
  btnInfo.classList.toggle("active", show);
};

// ---------- Helpers ----------
const PI = Math.PI;
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const lerp = (a,b,t)=>a+(b-a)*t;
const pad2 = n => String(n).padStart(2,"0");

// ---------- Weather (safe defaults) ----------
const weather = {
  tempC: 18,
  cloudCover: 40,
  rainMm: 0,
  windMs: 1,
  fog: 0.1,
  isDay: true
};

async function fetchWeather(lat=41.9, lon=12.5) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,is_day,wind_speed_10m` +
    `&hourly=cloud_cover,visibility,precipitation&timezone=auto`;

  const r = await fetch(url);
  const d = await r.json();

  weather.tempC = d.current.temperature_2m;
  weather.isDay = !!d.current.is_day;
  weather.windMs = d.current.wind_speed_10m / 3.6;

  const i = d.hourly.time.length - 1;
  weather.cloudCover = d.hourly.cloud_cover[i];
  weather.rainMm = d.hourly.precipitation[i];
  const vis = d.hourly.visibility[i];
  weather.fog = clamp(1 - vis / 20000, 0, 1);

  updateHud();
  updatePanel();
}

btnGeo.onclick = () => {
  navigator.geolocation?.getCurrentPosition(
    p => fetchWeather(p.coords.latitude, p.coords.longitude),
    () => fetchWeather()
  );
};
fetchWeather();

// ---------- HUD update ----------
function updateHud() {
  const now = new Date();
  hudTime.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  hudTemp.textContent = `${Math.round(weather.tempC)}°`;
  hudCloud.textContent = `${Math.round(weather.cloudCover)}%`;
  hudRain.textContent = weather.rainMm.toFixed(1);
  hudWind.textContent = weather.windMs.toFixed(1);
  hudFog.textContent = `${Math.round(weather.fog*100)}%`;
}
setInterval(updateHud, 10000);

function updatePanel() {
  panelText.innerHTML =
    `<b>Temp:</b> ${weather.tempC.toFixed(1)}°C<br>` +
    `<b>Cloud:</b> ${weather.cloudCover}%<br>` +
    `<b>Rain:</b> ${weather.rainMm} mm/h<br>` +
    `<b>Wind:</b> ${weather.windMs.toFixed(1)} m/s<br>` +
    `<b>Fog:</b> ${(weather.fog*100).toFixed(0)}%`;
}

// ---------- Circles ----------
const N = 99;
let circles = [];

function initCircles() {
  circles = [];
  for (let i=0;i<N;i++) {
    circles.push({
      x: Math.random()*W,
      y: Math.random()*H,
      r: 8 + Math.random()*16,
      a: Math.random()*PI*2,
      s: 0.4 + Math.random()*1.6,
      h: Math.random()*360
    });
  }
}
initCircles();

// ---------- Audio ----------
let audioCtx=null;
btnAudio.onclick = () => {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  const g = audioCtx.createGain();
  g.gain.value = 0.04;
  g.connect(audioCtx.destination);

  [261.6,311.1,392].forEach(f=>{
    const o = audioCtx.createOscillator();
    o.frequency.value = f;
    o.type="sine";
    o.connect(g);
    o.start();
  });
  btnAudio.textContent="Audio ON";
};

// ---------- Loop ----------
let last=performance.now();
function loop(t){
  const dt=(t-last)/1000; last=t;

  // background
  ctx.fillStyle = toggleNight.checked ? "rgb(8,10,14)" : "rgb(20,30,45)";
  ctx.fillRect(0,0,W,H);

  ctx.lineWidth = 3;

  for (const c of circles){
    c.a += dt*c.s;
    c.x += Math.cos(c.a)*20*dt;
    c.y += Math.sin(c.a)*20*dt;

    if (c.x<0) c.x=W;
    if (c.x>W) c.x=0;
    if (c.y<0) c.y=H;
    if (c.y>H) c.y=0;

    ctx.strokeStyle=`hsl(${c.h},75%,60%)`;
    ctx.beginPath();
    ctx.arc(c.x,c.y,c.r,0,PI*2);
    ctx.stroke();
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
