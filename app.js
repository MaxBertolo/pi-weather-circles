(() => {
  const VERSION = "JS OK v1";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  const debug = document.getElementById("debugBadge");
  if (debug) debug.textContent = VERSION;

  const modePicker = document.getElementById("modePicker");
  const overlay = document.getElementById("overlay");
  const btnExit = document.getElementById("btn-exit");

  const btnCircles = document.getElementById("btnCircles");
  const btnSplash = document.getElementById("btnSplash");
  const btnDiamonds = document.getElementById("btnDiamonds");

  const btnAudio = document.getElementById("btn-audio");
  const volSlider = document.getElementById("audio-volume");
  const toggleNight = document.getElementById("toggle-night");

  const ovTime  = document.getElementById("ov-time");
  const ovTemp  = document.getElementById("ov-temp");
  const ovCloud = document.getElementById("ov-cloud");
  const ovRain  = document.getElementById("ov-rain");
  const ovWind  = document.getElementById("ov-wind");
  const ovFog   = document.getElementById("ov-fog");

  // Hard fail if buttons are missing
  if (!btnCircles || !btnSplash || !btnDiamonds) {
    alert("ERROR: Picker buttons not found. Check index.html IDs.");
  }

  const TAU = Math.PI * 2;
  const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
  const mmToPx = mm => mm*(96/25.4);

  let W=0,H=0,DPR=1;
  function resize(){
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W*DPR);
    canvas.height = Math.floor(H*DPR);
    canvas.style.width = W+"px";
    canvas.style.height = H+"px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener("resize", resize);
  resize();

  let mode = "circles";

  function showPicker(){
    if(!modePicker) return;
    modePicker.classList.remove("hidden");
    modePicker.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "none";
  }
  function hidePicker(){
    if(!modePicker) return;
    modePicker.classList.add("hidden");
    canvas.style.pointerEvents = overlay && !overlay.classList.contains("hidden") ? "none" : "auto";
  }
  function openMenu(){
    if(!overlay) return;
    overlay.classList.remove("hidden");
    canvas.style.pointerEvents = "none";
    updateConsole();
  }
  function closeMenu(){
    if(!overlay) return;
    overlay.classList.add("hidden");
    canvas.style.pointerEvents = modePicker && !modePicker.classList.contains("hidden") ? "none" : "auto";
  }

  if (btnExit) btnExit.addEventListener("pointerdown", (e)=>{ e.preventDefault(); closeMenu(); }, {passive:false});
  if (overlay) overlay.addEventListener("pointerdown", (e)=>{ if(e.target===overlay) closeMenu(); }, {passive:true});

  // Bind picker: BOTH pointerdown and click
  function bindPick(btn, m){
    const go = (e)=>{
      if(e){ e.preventDefault?.(); e.stopPropagation?.(); }
      mode = m;
      try { localStorage.setItem("pi_mode", mode); } catch {}
      initScene();
      hidePicker();
    };
    btn.addEventListener("pointerdown", go, { passive:false });
    btn.addEventListener("click", go, { passive:true });
  }
  bindPick(btnCircles, "circles");
  bindPick(btnSplash, "splash");
  bindPick(btnDiamonds, "diamonds");

  // Restore last mode
  try {
    const m = localStorage.getItem("pi_mode");
    if (m) mode = m;
  } catch {}

  // Minimal “weather” placeholders (we re-add full meteo after UI works)
  const wx = { tempC: 18, cloud: 40, rain: 0.2, wind: 2.0, fog: 0.2, isDay: true };

  function isDay() {
    return (toggleNight && toggleNight.checked) ? false : wx.isDay;
  }

  function bg(){
    if (mode === "splash") return isDay() ? "#fff" : "#000";
    return isDay() ? "#fff" : "#111";
  }

  function updateConsole(){
    const now = new Date();
    if(ovTime) ovTime.textContent = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    if(ovTemp) ovTemp.textContent = `${Math.round(wx.tempC)}°C`;
    if(ovCloud) ovCloud.textContent = `${Math.round(wx.cloud)}%`;
    if(ovRain) ovRain.textContent = `${wx.rain.toFixed(1)} mm/h`;
    if(ovWind) ovWind.textContent = `${wx.wind.toFixed(1)} m/s`;
    if(ovFog) ovFog.textContent = `${Math.round(wx.fog*100)}%`;
  }
  setInterval(updateConsole, 5000);

  // Scene
  let pink = null;
  let items = [];

  function initScene(){
    items = [];
    pink = {
      x: Math.random()*W, y: Math.random()*H,
      r: mmToPx(3),
      vx: (Math.random()<0.5?-1:1)*120,
      vy: (Math.random()<0.5?-1:1)*120,
    };

    const N = (mode==="circles") ? 120 : (mode==="splash") ? 60 : 90;
    for(let i=0;i<N;i++){
      items.push({
        x: Math.random()*W, y: Math.random()*H,
        r: 10 + Math.random()*50,
        a: Math.random()*TAU,
        vx: (Math.random()<0.5?-1:1)*(20+Math.random()*40),
        vy: (Math.random()<0.5?-1:1)*(20+Math.random()*40),
      });
    }
  }
  initScene();

  // Bottom-right to picker + pink dot to menu
  function hitBR(x,y){
    const zone = 120;
    return x>W-zone && y>H-zone;
  }

  canvas.addEventListener("pointerdown", (e)=>{
    if(overlay && !overlay.classList.contains("hidden")) return;
    if(modePicker && !modePicker.classList.contains("hidden")) return;

    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if(hitBR(x,y)) { showPicker(); return; }

    const dx = x-pink.x, dy = y-pink.y;
    if(Math.hypot(dx,dy) < pink.r + 30) openMenu();
  }, {passive:true});

  // ===== AUDIO (audible, louder) =====
  let audioOn=false, audioCtx=null, osc=null, gain=null;
  function setAudioBtn(){ if(btnAudio) btnAudio.textContent = audioOn ? "🎶 Audio ON" : "🎶 Audio OFF"; }
  setAudioBtn();

  async function audioEnable(){
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    await audioCtx.resume();
    gain = audioCtx.createGain();
    const v = volSlider ? Number(volSlider.value)/100 : 0.8;
    gain.gain.value = 0.18 * v; // loud enough
    gain.connect(audioCtx.destination);

    osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 220;
    osc.connect(gain);
    osc.start();

    audioOn=true;
    setAudioBtn();
  }
  async function audioDisable(){
    audioOn=false;
    setAudioBtn();
    try { osc && osc.stop(); } catch {}
    try { audioCtx && audioCtx.close(); } catch {}
    osc=null; gain=null; audioCtx=null;
  }

  if (btnAudio) {
    btnAudio.addEventListener("pointerdown", async (e)=>{
      e.preventDefault();
      if(!audioOn) await audioEnable();
      else await audioDisable();
    }, {passive:false});
  }
  if (volSlider) {
    volSlider.addEventListener("input", ()=>{
      if(gain && audioCtx){
        gain.gain.setTargetAtTime(0.18*(Number(volSlider.value)/100), audioCtx.currentTime, 0.05);
      }
    });
  }

  // Loop
  let last = performance.now();
  function step(dt){
    // move items
    for(const it of items){
      it.x += it.vx*dt;
      it.y += it.vy*dt;
      if(it.x < -60) it.x = W+60;
      if(it.x > W+60) it.x = -60;
      if(it.y < -60) it.y = H+60;
      if(it.y > H+60) it.y = -60;
      it.a += dt*0.6;
    }
    // move pink
    pink.x += pink.vx*dt;
    pink.y += pink.vy*dt;
    if(pink.x < pink.r || pink.x > W-pink.r) pink.vx *= -1;
    if(pink.y < pink.r || pink.y > H-pink.r) pink.vy *= -1;
  }

  function draw(){
    ctx.fillStyle = bg();
    ctx.fillRect(0,0,W,H);

    if(mode==="circles"){
      ctx.strokeStyle = isDay() ? "rgba(0,0,0,.9)" : "rgba(255,255,255,.9)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for(const it of items){
        ctx.moveTo(it.x+it.r, it.y);
        ctx.ellipse(it.x, it.y, it.r, it.r, 0, 0, TAU);
      }
      ctx.stroke();
    }

    if(mode==="splash"){
      ctx.fillStyle = isDay() ? "rgba(0,0,0,.9)" : "rgba(255,255,255,.9)";
      for(const it of items){
        ctx.beginPath();
        for(let i=0;i<10;i++){
          const a = (i/10)*TAU + it.a;
          const rr = it.r * (0.65 + Math.random()*0.7);
          ctx.lineTo(it.x + Math.cos(a)*rr, it.y + Math.sin(a)*rr);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    if(mode==="diamonds"){
      for(const it of items){
        ctx.fillStyle = "rgba(255, 80, 120, .55)";
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.a);
        ctx.beginPath();
        ctx.moveTo(0, -it.r);
        ctx.lineTo(it.r, 0);
        ctx.lineTo(0, it.r);
        ctx.lineTo(-it.r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // pink dot
    ctx.fillStyle = "rgb(255,70,170)";
    ctx.beginPath();
    ctx.arc(pink.x, pink.y, pink.r, 0, TAU);
    ctx.fill();

    // MB signature
    ctx.fillStyle = isDay() ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.65)";
    ctx.font = "italic 700 18px Arial";
    ctx.textAlign = "right";
    ctx.fillText("MB", W-18, H-18);
  }

  function loop(t){
    const dt = clamp((t-last)/1000, 0, 0.05);
    last = t;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Start
  showPicker();
  requestAnimationFrame(loop);
})();
