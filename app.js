/* π Weather Art — app.js
   Versione stabile + artistica
*/

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });

/* ================== DOM ================== */
const modePicker = document.getElementById("modePicker");
const overlay = document.getElementById("overlay");
const btnExit = document.getElementById("btn-exit");
const btnAudio = document.getElementById("btn-audio");
const toggleNight = document.getElementById("toggle-night");

const ovTime  = document.getElementById("ov-time");
const ovTemp  = document.getElementById("ov-temp");
const ovCloud = document.getElementById("ov-cloud");
const ovRain  = document.getElementById("ov-rain");
const ovWind  = document.getElementById("ov-wind");
const ovFog   = document.getElementById("ov-fog");

/* ================== HELPERS ================== */
const PI = Math.PI;
const TAU = Math.PI * 2;
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const lerp = (a,b,t)=>a+(b-a)*t;
const pad2 = n=>String(n).padStart(2,"0");
const mmToPx = mm => mm*(96/25.4);

/* ================== RESIZE ================== */
let W=0,H=0,DPR=1;
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  W=window.innerWidth; H=window.innerHeight;
  canvas.width=W*DPR; canvas.height=H*DPR;
  canvas.style.width=W+"px";
  canvas.style.height=H+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize",resize);
resize();

/* ================== UI ================== */
function showPicker(){
  modePicker.classList.remove("hidden");
  canvas.style.pointerEvents="none";
}
function hidePicker(){
  modePicker.classList.add("hidden");
  canvas.style.pointerEvents="auto";
}
function openMenu(){
  overlay.classList.remove("hidden");
  canvas.style.pointerEvents="none";
}
function closeMenu(){
  overlay.classList.add("hidden");
  canvas.style.pointerEvents="auto";
}
btnExit.onclick=closeMenu;

/* ================== WEATHER (mock + base) ================== */
const weather={
  tempC:18, cloud:40, rain:0, wind:1, fog:0.1, isDay:true
};
function isDay(){ return toggleNight.checked?false:weather.isDay; }

/* ================== BACKGROUND ================== */
function background(){
  if(currentMode==="splash"){
    return isDay()?"#fff":"#000";
  }
  if(!isDay()) return "#111";
  if(weather.rain>4) return "#aaa";
  return "#fff";
}

/* ================== MODES ================== */
let currentMode="circles";

/* ================== ART ================== */
let circles=[], splashes=[], diamonds=[];
let infoDot=null;

function initArt(mode){
  circles=[]; splashes=[]; diamonds=[];
  currentMode=mode;

  infoDot={
    x:Math.random()*W,
    y:Math.random()*H,
    r:mmToPx(3),
    vx:(Math.random()<.5?-1:1)*90,
    vy:(Math.random()<.5?-1:1)*90,
    p:Math.random()*TAU,
    s:0
  };

  if(mode==="circles"){
    for(let i=0;i<199;i++){
      circles.push({
        x:Math.random()*W,
        y:Math.random()*H,
        r:lerp(20,60,Math.random()),
        p:Math.random()*TAU
      });
    }
  }

  if(mode==="splash"){
    for(let i=0;i<70;i++){
      splashes.push({
        x:Math.random()*W,
        y:Math.random()*H,
        r:lerp(20,80,Math.random()),
        p:Math.random()*TAU
      });
    }
  }

  if(mode==="diamonds"){
    const cols=["#BA5900","#FF8100","#088DEF","#0B24C5","#7B1DEF","#E40674"];
    for(let i=0;i<120;i++){
      diamonds.push({
        x:Math.random()*W,
        y:Math.random()*H,
        s:lerp(20,70,Math.random()),
        a:Math.random()*TAU,
        c:cols[i%cols.length]
      });
    }
  }
}

/* ================== INPUT ================== */
canvas.addEventListener("pointerdown",e=>{
  if(!overlay.classList.contains("hidden")) return;
  const r=canvas.getBoundingClientRect();
  const x=e.clientX-r.left;
  const y=e.clientY-r.top;

  if(x>W-120 && y>H-120){ showPicker(); return; }

  const dx=x-infoDot.x, dy=y-infoDot.y;
  if(Math.hypot(dx,dy)<infoDot.r+30) openMenu();
});

/* ================== DRAW ================== */
function draw(){
  ctx.fillStyle=background();
  ctx.fillRect(0,0,W,H);

  if(currentMode==="circles"){
    ctx.strokeStyle=isDay()?"#000":"#fff";
    ctx.lineWidth=2;
    ctx.beginPath();
    circles.forEach(c=>{
      ctx.moveTo(c.x+c.r,c.y);
      ctx.arc(c.x,c.y,c.r,0,TAU);
    });
    ctx.stroke();
  }

  if(currentMode==="splash"){
    ctx.fillStyle=isDay()?"rgba(0,0,0,.9)":"rgba(255,255,255,.9)";
    splashes.forEach(s=>{
      ctx.beginPath();
      for(let i=0;i<10;i++){
        const a=i/10*TAU;
        const rr=s.r*(.7+Math.random()*.6);
        ctx.lineTo(s.x+Math.cos(a)*rr,s.y+Math.sin(a)*rr);
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  if(currentMode==="diamonds"){
    diamonds.forEach(d=>{
      ctx.fillStyle=d.c;
      ctx.save();
      ctx.translate(d.x,d.y);
      ctx.rotate(d.a);
      ctx.beginPath();
      ctx.moveTo(0,-d.s);
      ctx.lineTo(d.s,0);
      ctx.lineTo(0,d.s);
      ctx.lineTo(-d.s,0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  // pallino rosa
  ctx.fillStyle="rgb(255,70,170)";
  ctx.beginPath();
  ctx.arc(infoDot.x,infoDot.y,infoDot.r,0,TAU);
  ctx.fill();

  // firma MB
  ctx.fillStyle=isDay()?"rgba(0,0,0,.5)":"rgba(255,255,255,.6)";
  ctx.font="italic 700 18px Arial";
  ctx.textAlign="right";
  ctx.fillText("MB",W-18,H-18);
}

/* ================== STEP ================== */
function step(dt){
  infoDot.x+=infoDot.vx*dt;
  infoDot.y+=infoDot.vy*dt;
  if(infoDot.x<infoDot.r||infoDot.x>W-infoDot.r) infoDot.vx*=-1;
  if(infoDot.y<infoDot.r||infoDot.y>H-infoDot.r) infoDot.vy*=-1;
}

/* ================== LOOP ================== */
let last=performance.now();
function loop(t){
  const dt=Math.min(.05,(t-last)/1000);
  last=t;
  step(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ================== PICKER ================== */
document.querySelectorAll(".picker-btn").forEach(b=>{
  b.onclick=()=>{
    initArt(b.dataset.mode);
    hidePicker();
  };
});

/* ================== AUDIO (volume più alto) ================== */
let audioOn=false;
let audioCtx=null;
btnAudio.onclick=async()=>{
  if(!audioOn){
    audioCtx=new (window.AudioContext||webkitAudioContext)();
    await audioCtx.resume();
    const o=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    o.type="sine"; o.frequency.value=220;
    g.gain.value=0.12;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    audioOn=true;
    btnAudio.textContent="🎶 Audio ON";
  }else{
    audioCtx.close();
    audioOn=false;
    btnAudio.textContent="🎶 Audio OFF";
  }
};

/* ================== INIT ================== */
initArt("circles");
showPicker();
requestAnimationFrame(loop);
