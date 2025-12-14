 // π Weather Circles — VISUAL + POLYPHONIC AUDIO
const PI = Math.PI;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

const statusEl = document.getElementById("status");
const btnGeo = document.getElementById("btn-geo");
const btnAudio = document.getElementById("btn-audio");
const toggleNight = document.getElementById("toggle-night");

let W = 0, H = 0, DPR = 1;

// ---------- Resize ----------
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
window.addEventListener("resize", resize);
resize();

// ---------- Location ----------
const defaultLoc = { lat: 41.9028, lon: 12.4964, label: "Rome (fallback)" };
const loc = { ...defaultLoc };

try {
  const saved = JSON.parse(localStorage.getItem("pi_weather_loc"));
  if (saved) Object.assign(loc, saved);
} catch {}

function useGeolocation() {
  navigator.geolocation?.getCurrentPosition(
    pos => {
      loc.lat = pos.coords.latitude;
      loc.lon = pos.coords.longitude;
      loc.label = "My location";
      localStorage.setItem("pi_weather_loc", JSON.stringify(loc));
      fetchWeather();
    },
    () => {}
  );
}
btnGeo.onclick = useGeolocation;

// ---------- Weather ----------
const weather = {
  tempC: 15, isDay: true, cloudCover: 30,
  fog: 0, rainMm: 0, windMs: 1, windDirDeg: 0
};

async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,is_day,wind_speed_10m,wind_direction_10m` +
    `&hourly=cloud_cover,visibility,precipitation` +
    `&timezone=auto`;

  const r = await fetch(url);
  const d = await r.json();
  const cur = d.current;
  const h = d.hourly;

  let i = h.time.length - 1;
  weather.tempC = cur.temperature_2m;
  weather.isDay = !!cur.is_day;
  weather.windMs = cur.wind_speed_10m / 3.6;
  weather.windDirDeg = cur.wind_direction_10m;
  weather.cloudCover = h.cloud_cover[i];
  weather.rainMm = h.precipitation[i];
  weather.fog = Math.max(0, 1 - h.visibility[i] / 20000);

  statusEl.textContent =
    `${loc.label} | ${weather.tempC.toFixed(1)}°C | rain ${weather.rainMm.toFixed(1)} | wind ${weather.windMs.toFixed(1)}`;
}
fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);
useGeolocation();

// ---------- Helpers ----------
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const lerp = (a,b,t)=>a+(b-a)*t;
const tempN = ()=>clamp((weather.tempC+15)/65,0,1);

// ---------- Circles ----------
const N = 99;
let circles = [];

function initCircles() {
  circles = [];
  for (let i=0;i<N;i++) {
    circles.push({
      x: Math.random()*W,
      y: Math.random()*H,
      r: lerp(6,22,Math.random()),
      phase: PI*i,
      rot: Math.random()*PI,
      hue: Math.random()*360,
      trail:[]
    });
  }
}
initCircles();

// ---------- Motion ----------
function step(dt,t) {
  const rain = clamp(weather.rainMm/10,0,1);
  const wind = clamp(weather.windMs/10,0,1);
  const heat = tempN();

  for (const c of circles) {
    c.phase += dt*(0.6+heat)*PI;
    const speed = lerp(10,60,heat);

    let vx = Math.cos(c.phase)*speed*dt;
    let vy = Math.sin(c.phase)*speed*dt;

    if (rain>0) vy += speed*rain*dt*3;
    if (wind>0) {
      vx += Math.cos(weather.windDirDeg*PI/180)*wind*speed*dt;
      vy += Math.sin(weather.windDirDeg*PI/180)*wind*speed*dt;
    }

    c.x = (c.x+vx+W)%W;
    c.y = (c.y+vy+H)%H;

    c.trail.push({x:c.x,y:c.y});
    if (c.trail.length>18) c.trail.shift();
  }
}

// ---------- Draw ----------
function draw() {
  const bgGrey = lerp(20,90,weather.fog);
  ctx.fillStyle = `rgb(${bgGrey},${bgGrey+10},${bgGrey+20})`;
  ctx.fillRect(0,0,W,H);

  for (const c of circles) {
    const colTemp = lerp(220,20,tempN());
    ctx.strokeStyle = `hsl(${(colTemp+c.hue)%360},70%,60%)`;
    ctx.lineWidth = 1; // ≈ 1 mm su tablet

    // trail
    for (let i=1;i<c.trail.length;i++) {
      ctx.globalAlpha = i/c.trail.length*0.4;
      ctx.beginPath();
      ctx.moveTo(c.trail[i-1].x,c.trail[i-1].y);
      ctx.lineTo(c.trail[i].x,c.trail[i].y);
      ctx.stroke();
    }

    // circle
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(c.x,c.y,c.r,0,2*PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------- AUDIO (POLYPHONIC HARMONY) ----------
let audioCtx, masterGain, chordOscs=[], lastNote=0;

const SCALE = [0,3,7]; // minor chord

function startAudio() {
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.03;
  masterGain.connect(audioCtx.destination);

  chordOscs = SCALE.map(()=>{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0;
    o.connect(g); g.connect(masterGain);
    o.start();
    return {o,g};
  });
}
btnAudio.onclick = ()=>startAudio();

// ---------- AUDIO UPDATE ----------
function updateAudio(t) {
  if (!audioCtx) return;

  const heat = tempN();
  const rain = clamp(weather.rainMm/10,0,1);
  const bpm = lerp(40,110,heat+rain*0.5);
  const interval = 60000/bpm;

  if (t-lastNote>interval) {
    lastNote=t;
    const base = lerp(110,440,heat);
    chordOscs.forEach((c,i)=>{
      c.o.frequency.setValueAtTime(base*Math.pow(2,SCALE[i]/12),audioCtx.currentTime);
      c.g.gain.cancelScheduledValues(audioCtx.currentTime);
      c.g.gain.setValueAtTime(0,audioCtx.currentTime);
      c.g.gain.linearRampToValueAtTime(0.04,audioCtx.currentTime+0.05);
      c.g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+1.2);
    });
  }
}

// ---------- Loop ----------
let last=performance.now();
function loop(t){
  const dt=(t-last)/1000; last=t;
  step(dt,t);
  draw();
  updateAudio(t);
  requestAnimationFrame(loop);
}
loop(last);
