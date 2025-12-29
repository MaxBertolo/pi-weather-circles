(() => {
  /* =========================
     π Weather Art — app.js (SOFT MUSIC EDITION)
     - Modes: circles / splash / diamonds / cloud / cola
     - Picker robust
     - Pink dot opens menu overlay
     - Bottom-right tap -> picker
     - Weather: Open-Meteo + geolocation
     - City: OpenStreetMap Nominatim reverse
     - Splash day/night invert rule
     - Signature MB bottom-right (RED)
     - MIC: ON => Audio OFF (voice-band filtered). Shapes scale 1x..10x (vol+pitch)
     - AUDIO: softer, lower, muffled, pleasant. Volume can be set high.
     - Option A: open YouTube Jazz/Soul in new tab from menu buttons

     NEW:
     - CLOUD: 3000 watercolor dots, multi-cluster density, day white+blue, night black+white
     - COLA: dripping paint from top, day blue on white, night inverted, speed follows storm
  ========================= */

  const PI = Math.PI, TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad2 = (n) => String(n).padStart(2, "0");
  const mmToPx = (mm) => mm * (96 / 25.4);
  const tempNorm = (tC) => clamp((tC - (-15)) / (50 - (-15)), 0, 1);

  // ===== DOM =====
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  const modePicker = document.getElementById("modePicker");
  const overlay = document.getElementById("overlay");
  const btnExit = document.getElementById("btn-exit");

  const ovCity  = document.getElementById("ov-city");
  const ovTime  = document.getElementById("ov-time");
  const ovTemp  = document.getElementById("ov-temp");
  const ovCloud = document.getElementById("ov-cloud");
  const ovRain  = document.getElementById("ov-rain");
  const ovWind  = document.getElementById("ov-wind");
  const ovFog   = document.getElementById("ov-fog");

  const btnAudio = document.getElementById("btn-audio");
  const genreSel = document.getElementById("audio-genre");
  const volSlider = document.getElementById("audio-volume");
  const toggleNight = document.getElementById("toggle-night");
  const toggleMic = document.getElementById("toggle-mic");

  // --- Option A (YouTube open buttons) ---
  const btnOpenJazz = document.getElementById("btn-open-jazz");
  const btnOpenSoul = document.getElementById("btn-open-soul");

  const YT_JAZZ_URL = "https://www.youtube.com/watch?v=EIw8SO6dadQ&list=RDEIw8SO6dadQ&start_radio=1";
  const YT_SOUL_URL = "https://www.youtube.com/watch?v=gQRtAnPL6HM&list=RDgQRtAnPL6HM&start_radio=1";

  function openYouTube(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ===== Resize =====
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

  // ===== UI show/hide =====
  const isPickerOpen = () => modePicker && !modePicker.classList.contains("hidden");
  const isMenuOpen = () => overlay && !overlay.classList.contains("hidden");

  function showPicker() {
    if (!modePicker) return;
    modePicker.classList.remove("hidden");
    modePicker.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "none";
  }
  function hidePicker() {
    if (!modePicker) return;
    modePicker.classList.add("hidden");
    canvas.style.pointerEvents = isMenuOpen() ? "none" : "auto";
  }
  function openMenu() {
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.style.pointerEvents = "auto";
    canvas.style.pointerEvents = "none";
    updateConsoleValues();
  }
  function closeMenu() {
    if (!overlay) return;
    overlay.classList.add("hidden");
    canvas.style.pointerEvents = isPickerOpen() ? "none" : "auto";
  }

  if (btnExit) btnExit.addEventListener("pointerdown", (e) => { e.preventDefault(); closeMenu(); }, { passive: false });
  if (overlay) overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) closeMenu(); }, { passive: true });

  // ===== Modes =====
  const MODES = ["circles", "splash", "diamonds", "cloud", "cola"];
  let currentMode = "circles";
  try {
    const m = localStorage.getItem("pi_mode");
    if (m && MODES.includes(m)) currentMode = m;
  } catch {}

  function saveMode(m) {
    currentMode = m;
    try { localStorage.setItem("pi_mode", m); } catch {}
  }

  function bindPicker() {
    if (!modePicker) return;
    const btns = modePicker.querySelectorAll("[data-mode]");
    btns.forEach((btn) => {
      const go = (e) => {
        e?.preventDefault?.();
        const m = btn.getAttribute("data-mode");
        if (!MODES.includes(m)) return;
        saveMode(m);
        initArt(currentMode);
        hidePicker();
      };
      btn.addEventListener("pointerdown", go, { passive: false });
      btn.addEventListener("click", go, { passive: true });
    });
  }
  bindPicker();

  // ===== Weather =====
  const weather = {
    tempC: 18,
    cloud: 40,
    rain: 0.2,
    wind: 2.0,
    windDir: 0,
    fog: 0.2,
    isDay: true
  };

  let cityName = "—";

  function isDayEffective() {
    return (toggleNight && toggleNight.checked) ? false : !!weather.isDay;
  }

  async function fetchWeather(lat = 41.9, lon = 12.5) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,is_day,wind_speed_10m,wind_direction_10m` +
      `&hourly=cloud_cover,visibility,precipitation&timezone=auto`;

    const r = await fetch(url, { cache: "no-store" });
    const d = await r.json();

    weather.tempC = d.current.temperature_2m;
    weather.isDay = !!d.current.is_day;
    weather.wind = (d.current.wind_speed_10m ?? 5) / 3.6;
    weather.windDir = d.current.wind_direction_10m ?? 0;

    const i = d.hourly.time.length - 1;
    weather.cloud = d.hourly.cloud_cover[i] ?? 40;
    weather.rain = d.hourly.precipitation[i] ?? 0;

    const vis = d.hourly.visibility[i];
    weather.fog = (typeof vis === "number") ? clamp(1 - vis / 20000, 0, 1) : 0;

    updateConsoleValues();
  }

  async function fetchCityName(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const r = await fetch(url, { headers: { "Accept-Language": "it" } });
      const d = await r.json();
      cityName =
        d?.address?.city ||
        d?.address?.town ||
        d?.address?.village ||
        d?.address?.municipality ||
        d?.address?.county ||
        "—";
      if (ovCity) ovCity.textContent = cityName;
    } catch {
      cityName = "—";
      if (ovCity) ovCity.textContent = cityName;
    }
  }

  function requestGeoAndWeather() {
    const geo = navigator.geolocation;
    if (!geo) { fetchWeather().catch(()=>{}); return; }
    geo.getCurrentPosition(
      (p) => {
        const { latitude, longitude } = p.coords;
        fetchWeather(latitude, longitude).catch(()=>{});
        fetchCityName(latitude, longitude);
      },
      () => fetchWeather().catch(()=>{})
    );
  }

  requestGeoAndWeather();
  setInterval(() => fetchWeather().catch(()=>{}), 10 * 60 * 1000);

  function updateConsoleValues() {
    const now = new Date();
    if (ovCity)  ovCity.textContent  = cityName;
    if (ovTime)  ovTime.textContent  = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    if (ovTemp)  ovTemp.textContent  = `${Math.round(weather.tempC)}°C`;
    if (ovCloud) ovCloud.textContent = `${Math.round(weather.cloud)}%`;
    if (ovRain)  ovRain.textContent  = `${weather.rain.toFixed(1)} mm/h`;
    if (ovWind)  ovWind.textContent  = `${weather.wind.toFixed(1)} m/s`;
    if (ovFog)   ovFog.textContent   = `${Math.round(weather.fog * 100)}%`;
  }
  setInterval(updateConsoleValues, 10_000);

  // ===== Background =====
  function backgroundColor(mode) {
    const day = isDayEffective();
    const clouds = clamp(weather.cloud / 100, 0, 1);
    const fog = clamp(weather.fog, 0, 1);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const windN = clamp(weather.wind / 14, 0, 1);

    // Cloud & Cola: pure invert day/night background
    if (mode === "cloud" || mode === "cola") return day ? "#fff" : "#000";

    if (mode === "splash") return day ? "#fff" : "#000";

    if (!day) {
      const lift = clamp(clouds * 0.35 + fog * 0.55, 0, 1);
      const v = Math.floor(lerp(8, 55, lift));
      return `rgb(${v},${v},${v})`;
    }

    const sunny = (clouds < 0.22 && fog < 0.20 && rainN < 0.03);
    if (sunny) return "#fff";

    const storm = clamp(rainN * 0.75 + windN * 0.20 + clouds * 0.30, 0, 1);
    if (storm > 0.62) {
      const t = clamp((storm - 0.62) / 0.38, 0, 1);
      const v = Math.floor(lerp(238, 150, t));
      return `rgb(${v},${v},${v})`;
    }

    const lightMix = clamp(clouds * 0.65 + fog * 0.85, 0, 1);
    const v = Math.floor(lerp(255, 238, lightMix));
    return `rgb(${v},${v},${v})`;
  }

  // ===== Art =====
  const DIAMOND_PALETTE = [
    "#BA5900","#FF8100","#088DEF","#0B24C5","#7B1DEF","#62027D",
    "#D245D3","#AE048F","#FA01A9","#E40674","#CC021C","#F17677"
  ];

  let circles = [];
  let splashes = [];
  let diamonds = [];
  let clouds = [];  // NEW
  let colas = [];   // NEW
  let pink = null;

  // small gaussian helper (Box-Muller)
  function randN() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(TAU * v);
  }

  function initArt(mode) {
    circles = [];
    splashes = [];
    diamonds = [];
    clouds = [];
    colas = [];

    pink = {
      x: Math.random() * W,
      y: Math.random() * H,
      r: mmToPx(3),
      vx: (Math.random() < 0.5 ? -1 : 1) * lerp(70, 120, Math.random()),
      vy: (Math.random() < 0.5 ? -1 : 1) * lerp(70, 120, Math.random()),
      sp: Math.random() * TAU,
      rp: Math.random() * TAU,
      squash: 0,
      rot: 0
    };

    if (mode === "circles") {
      for (let i = 0; i < 199; i++) {
        circles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: lerp(22, 70, Math.random()),
          p: Math.random() * TAU,
          sp: Math.random() * TAU,
          rp: Math.random() * TAU,
          squash: 0,
          rot: 0,
          mul: lerp(0.92, 1.08, Math.random())
        });
      }
    }

    if (mode === "splash") {
      for (let i = 0; i < 70; i++) {
        const pts = Math.floor(lerp(7, 12, Math.random()));
        splashes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          base: lerp(22, 80, Math.random()),
          pts,
          amps: Array.from({ length: pts }, () => lerp(0.14, 0.55, Math.random())),
          phs: Array.from({ length: pts }, () => Math.random() * TAU),
          p: Math.random() * TAU,
          rot: Math.random() * TAU,
          rotSp: lerp(-0.10, 0.10, Math.random()),
          drift: lerp(0.60, 1.35, Math.random())
        });
      }
    }

    if (mode === "diamonds") {
      for (let i = 0; i < 130; i++) {
        diamonds.push({
          x: Math.random() * W,
          y: Math.random() * H,
          s: lerp(16, 80, Math.random()),
          a: Math.random() * TAU,
          spin: lerp(-0.22, 0.22, Math.random()),
          k: Math.random() * TAU,
          ka: lerp(0.35, 1.2, Math.random()),
          amt: lerp(0.08, 0.22, Math.random()),
          alpha: lerp(0.65, 0.95, Math.random()),
          c: DIAMOND_PALETTE[i % DIAMOND_PALETTE.length]
        });
      }
    }

    // ===== CLOUD (multi-cluster watercolor dots) =====
    if (mode === "cloud") {
      const N = 3000;

      // Create multiple cluster centers (like a real cloud mass)
      const clusterCount = 6;
      const centers = [];
      for (let k = 0; k < clusterCount; k++) {
        centers.push({
          cx: W * 0.5 + (Math.random() - 0.5) * W * 0.22,
          cy: H * 0.45 + (Math.random() - 0.5) * H * 0.18,
          sx: lerp(W * 0.04, W * 0.12, Math.random()),
          sy: lerp(H * 0.03, H * 0.10, Math.random()),
          w: lerp(0.10, 0.28, Math.random())
        });
      }
      // Normalize weights
      const sumW = centers.reduce((s, c) => s + c.w, 0);
      centers.forEach(c => c.w /= sumW);

      function pickCenter() {
        let r = Math.random();
        for (const c of centers) {
          r -= c.w;
          if (r <= 0) return c;
        }
        return centers[centers.length - 1];
      }

      for (let i = 0; i < N; i++) {
        const c = pickCenter();
        const x = c.cx + randN() * c.sx;
        const y = c.cy + randN() * c.sy;

        // watercolor: varying alpha + small sizes
        const rr = lerp(0.6, 2.3, Math.random());
        const a = lerp(0.10, 0.35, Math.random()); // delicate wash
        const hueJ = lerp(-18, 14, Math.random());  // small hue drift in “blue range”

        clouds.push({
          x, y,
          // anchor offsets for “breathing”/cohesion
          ox: x - W * 0.5,
          oy: y - H * 0.45,
          r: rr,
          a,
          hueJ,
          p: Math.random() * TAU,
          sp: lerp(0.5, 1.6, Math.random()),
          drift: lerp(0.4, 1.35, Math.random())
        });
      }
    }

    // ===== COLA (dripping paint from top) =====
    if (mode === "cola") {
      const K = Math.max(18, Math.floor(W / 26)); // number of drip columns
      for (let i = 0; i < K; i++) {
        const x = (i + 0.5) * (W / K);
        colas.push({
          x,
          w: lerp(10, 30, Math.random()),
          len: lerp(10, 140, Math.random()),
          v: lerp(10, 34, Math.random()),
          wob: Math.random() * TAU,
          wobSp: lerp(0.6, 1.7, Math.random()),
          ph: Math.random() * TAU
        });
      }
    }
  }

  initArt(currentMode);

  // ===== Canvas interaction =====
  function hitBottomRight(x, y) {
    const zone = Math.max(72, Math.min(120, Math.min(W, H) * 0.12));
    return (x >= W - zone && y >= H - zone);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (isMenuOpen() || isPickerOpen()) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    if (hitBottomRight(x, y)) { showPicker(); return; }

    const dx = x - pink.x;
    const dy = y - pink.y;
    if (Math.hypot(dx, dy) <= pink.r + 30) openMenu();
  }, { passive: true });

  function windVec() {
    const windN = clamp(weather.wind / 12, 0, 1);
    const dir = (weather.windDir || 0) * PI / 180;
    return { wx: Math.cos(dir) * windN, wy: Math.sin(dir) * windN, windN };
  }

  // =========================
  // MICROPHONE
  // =========================
  let micOn = false;
  let micStream = null;
  let micCtx = null;
  let micSource = null;
  let micAnalyser = null;
  let micFreq = null;
  let micTime = null;

  let micGain = 0;     // 0..1
  let micPitch = 0;    // 0..1
  let micSmooth = 0;   // smoothed energy

  async function enableMic() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });

      micCtx = micCtx || new (window.AudioContext || window.webkitAudioContext)();
      await micCtx.resume();

      micSource = micCtx.createMediaStreamSource(micStream);

      const bandpass = micCtx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 1200;
      bandpass.Q.value = 0.8;

      micAnalyser = micCtx.createAnalyser();
      micAnalyser.fftSize = 1024;

      micFreq = new Uint8Array(micAnalyser.frequencyBinCount);
      micTime = new Uint8Array(micAnalyser.fftSize);

      micSource.connect(bandpass);
      bandpass.connect(micAnalyser);

      micOn = true;
      micGain = micPitch = micSmooth = 0;
    } catch (err) {
      console.warn("Mic denied/failed:", err);
      micOn = false;
      if (toggleMic) toggleMic.checked = false;
    }
  }

  function disableMic() {
    micOn = false;
    micGain = micPitch = micSmooth = 0;
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
    micSource = null;
    micAnalyser = null;
    micFreq = null;
    micTime = null;
  }

  function updateMic() {
    if (!micOn || !micAnalyser || !micFreq || !micTime) return;

    micAnalyser.getByteTimeDomainData(micTime);
    let sumSq = 0;
    for (let i = 0; i < micTime.length; i++) {
      const v = (micTime[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / micTime.length);
    micGain = clamp(rms * 3.2, 0, 1);

    micAnalyser.getByteFrequencyData(micFreq);
    let magSum = 0;
    let weighted = 0;
    for (let i = 0; i < micFreq.length; i++) {
      const m = micFreq[i] / 255;
      magSum += m;
      weighted += m * i;
    }
    const centroid = weighted / (magSum + 1e-6);
    micPitch = clamp(centroid / micFreq.length, 0, 1);

    micSmooth = micSmooth * 0.65 + micGain * 0.35;
  }

  if (toggleMic) {
    toggleMic.addEventListener("change", async () => {
      if (toggleMic.checked) {
        if (audioOn) await audioDisable();
        await enableMic();
      } else {
        disableMic();
      }
    });
  }

  // =========================
  // AUDIO — SOFT, LOW, MUFFLED
  // =========================
  let audioOn = false;
  let audioCtx = null;

  let master = null;
  let comp = null;
  let makeup = null;
  let lp = null;

  // subtle “air” reverb (very light)
  let revIn = null;
  let revOut = null;
  let revDelay = null;
  let revFB = null;
  let revLP = null;

  let chordTimer = null;
  let userVol = 0.8;

  if (volSlider) {
    userVol = clamp(Number(volSlider.value) / 100, 0, 1);
    volSlider.addEventListener("input", () => {
      userVol = clamp(Number(volSlider.value) / 100, 0, 1);
      if (master && audioCtx) {
        const volCurve = Math.pow(userVol, 0.6);
        master.gain.setTargetAtTime(3.2 * volCurve, audioCtx.currentTime, 0.06);
      }
    });
  }

  function setAudioButton() {
    if (!btnAudio) return;
    btnAudio.textContent = audioOn ? "🎶 Audio ON" : "🎶 Audio OFF";
  }
  setAudioButton();

  function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function timbreCutoff() {
    const muffle = clamp(weather.fog * 0.95 + (weather.cloud / 100) * 0.70, 0, 1);
    let c = lerp(5200, 650, muffle);
    if (!isDayEffective()) c *= 0.70;
    return c;
  }

  function clampHz(hz) {
    return clamp(hz, 55, 520);
  }

  function getGenre() {
    return (genreSel && genreSel.value) ? genreSel.value : "jazz";
  }

  function scaleForGenre(g) {
    if (g === "classical") return [0,2,4,5,7,9,11];
    if (g === "blues")     return [0,3,5,6,7,10];
    if (g === "soul")      return [0,2,3,5,7,9,10];
    return [0,2,3,5,7,9,10];
  }

  function chordTonesForGenre(g) {
    if (g === "classical") return [0,4,7,11,14];
    if (g === "soul")      return [0,3,7,10,14];
    if (g === "blues")     return [0,4,7,10,14];
    return Math.random() < 0.5 ? [0,3,7,10,14] : [0,4,7,11,14];
  }

  function chooseRootStep() {
    const opts = [0, 2, 4, 5, 7, 9, 10];
    const r = Math.random();
    if (r < 0.55) return opts[0];
    if (r < 0.75) return opts[2];
    if (r < 0.88) return opts[4];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  function buildSoftReverb() {
    revIn = audioCtx.createGain();
    revOut = audioCtx.createGain();
    revDelay = audioCtx.createDelay(0.5);
    revFB = audioCtx.createGain();
    revLP = audioCtx.createBiquadFilter();

    revDelay.delayTime.value = 0.18;
    revFB.gain.value = 0.25;
    revLP.type = "lowpass";
    revLP.frequency.value = 2200;

    revIn.connect(revDelay);
    revDelay.connect(revLP);
    revLP.connect(revFB);
    revFB.connect(revDelay);

    revDelay.connect(revOut);
    revOut.gain.value = 0.10;
  }

  function updateReverbByWeather() {
    if (!revOut || !revLP) return;
    const fog = clamp(weather.fog, 0, 1);
    const cloudsN = clamp(weather.cloud / 100, 0, 1);
    const rainN = clamp(weather.rain / 10, 0, 1);

    revLP.frequency.setTargetAtTime(lerp(2600, 900, clamp(fog + cloudsN * 0.6, 0, 1)), audioCtx.currentTime, 0.2);
    revOut.gain.setTargetAtTime(lerp(0.08, 0.14, clamp(fog + rainN * 0.4, 0, 1)), audioCtx.currentTime, 0.2);
    if (revDelay) revDelay.delayTime.setTargetAtTime(lerp(0.16, 0.22, clamp(rainN + fog, 0, 1)), audioCtx.currentTime, 0.2);
    if (revFB) revFB.gain.setTargetAtTime(lerp(0.22, 0.32, clamp(rainN + fog, 0, 1)), audioCtx.currentTime, 0.2);
  }

  function scheduleSoftPhrase() {
    if (!audioCtx) return;

    const g = getGenre();

    const tN = tempNorm(weather.tempC);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const windN = clamp(weather.wind / 12, 0, 1);
    const fogN = clamp(weather.fog, 0, 1);
    const cloudN = clamp(weather.cloud / 100, 0, 1);

    const energy = clamp(tN * 0.35 + rainN * 0.30 + windN * 0.15, 0, 1);
    let bpm = lerp(34, 62, energy);
    if (!isDayEffective()) bpm *= 0.86;

    const beat = 60 / bpm;
    const phraseDur = beat * lerp(6.0, 10.0, Math.random());

    const scale = scaleForGenre(g);
    const chordTones = chordTonesForGenre(g);

    const baseKey = 38;
    const root = baseKey + chooseRootStep() + (Math.random() < 0.25 ? 12 : 0);

    lp.frequency.setTargetAtTime(timbreCutoff(), audioCtx.currentTime, 0.35);
    updateReverbByWeather();

    const voices = (g === "classical") ? 6 : 7;

    const softness = clamp(0.35 + fogN * 0.35 + cloudN * 0.20 + (!isDayEffective() ? 0.20 : 0), 0, 1);
    const baseVel = lerp(0.050, 0.026, softness);

    const now = audioCtx.currentTime;

    for (let i = 0; i < voices; i++) {
      const useChord = Math.random() < 0.78;
      const semi = useChord
        ? chordTones[i % chordTones.length]
        : scale[Math.floor(Math.random() * scale.length)];

      const octave = (Math.random() < 0.85) ? 12 : 19;
      const extraHigh = (Math.random() < 0.02) ? 12 : 0;

      const midi = root + semi + octave + extraHigh;

      const o = audioCtx.createOscillator();
      const gN = audioCtx.createGain();
      const p = audioCtx.createStereoPanner();

      o.type = (g === "classical") ? "sine" : (Math.random() < 0.65 ? "triangle" : "sine");

      const hz = clampHz(midiToHz(midi));
      o.frequency.value = hz;

      o.detune.value = lerp(-5, 5, Math.random());
      p.pan.value = lerp(-0.55, 0.55, Math.random());

      const t0 = now + i * beat * 0.35 + lerp(0, 0.08, Math.random());
      const vel = (baseVel / voices) * lerp(0.85, 1.10, Math.random());

      gN.gain.setValueAtTime(0.0001, t0);
      gN.gain.linearRampToValueAtTime(vel, t0 + lerp(0.18, 0.35, softness));
      gN.gain.setTargetAtTime(0.0001, t0 + phraseDur, lerp(0.55, 0.85, softness));

      o.connect(gN);
      gN.connect(p);
      p.connect(lp);

      if (revIn) p.connect(revIn);

      o.start(t0);
      o.stop(t0 + phraseDur + 1.2);
    }

    chordTimer = setTimeout(scheduleSoftPhrase, phraseDur * 1000);
  }

  async function audioEnable() {
    if (micOn) {
      disableMic();
      if (toggleMic) toggleMic.checked = false;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();

    master = audioCtx.createGain();
    const volCurve = Math.pow(userVol, 0.6);
    master.gain.value = 3.2 * volCurve;

    comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -30;
    comp.knee.value = 32;
    comp.ratio.value = 4.5;
    comp.attack.value = 0.02;
    comp.release.value = 0.28;

    makeup = audioCtx.createGain();
    makeup.gain.value = 1.35;

    lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = timbreCutoff();
    lp.Q.value = 0.85;

    const hs = audioCtx.createBiquadFilter();
    hs.type = "highshelf";
    hs.frequency.value = 2200;
    hs.gain.value = -5.5;

    buildSoftReverb();

    lp.connect(hs);
    hs.connect(comp);
    comp.connect(makeup);
    makeup.connect(master);
    master.connect(audioCtx.destination);

    if (revOut) revOut.connect(comp);

    audioOn = true;
    if (btnAudio) btnAudio.textContent = "🎶 Audio ON";

    if (chordTimer) clearTimeout(chordTimer);
    chordTimer = null;
    scheduleSoftPhrase();
  }

  async function audioDisable() {
    audioOn = false;
    if (btnAudio) btnAudio.textContent = "🎶 Audio OFF";

    try { if (chordTimer) clearTimeout(chordTimer); } catch {}
    chordTimer = null;

    try { if (audioCtx) await audioCtx.close(); } catch {}
    audioCtx = null;
    master = null; comp = null; makeup = null; lp = null;
    revIn = revOut = revDelay = revFB = revLP = null;
  }

  if (btnAudio) {
    btnAudio.addEventListener("pointerdown", async (e) => {
      e.preventDefault();
      if (!audioOn) await audioEnable();
      else await audioDisable();
    }, { passive: false });
  }

  if (genreSel) {
    genreSel.addEventListener("change", () => {
      if (audioOn) {
        try { if (chordTimer) clearTimeout(chordTimer); } catch {}
        chordTimer = null;
        scheduleSoftPhrase();
      }
    });
  }

  document.addEventListener("pointerdown", async () => {
    try { if (audioCtx && audioCtx.state !== "running") await audioCtx.resume(); } catch {}
    try { if (micCtx && micCtx.state !== "running") await micCtx.resume(); } catch {}
  }, { passive: true });

  if (btnOpenJazz) {
    btnOpenJazz.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (audioOn) audioDisable();
      if (micOn) { disableMic(); if (toggleMic) toggleMic.checked = false; }
      openYouTube(YT_JAZZ_URL);
    }, { passive: false });
  }

  if (btnOpenSoul) {
    btnOpenSoul.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (audioOn) audioDisable();
      if (micOn) { disableMic(); if (toggleMic) toggleMic.checked = false; }
      openYouTube(YT_SOUL_URL);
    }, { passive: false });
  }

  // ===== Motion =====
  function step(dt, ms) {
    updateMic();

    const tN = tempNorm(weather.tempC);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const { wx, wy, windN } = windVec();
    const cloudN = clamp(weather.cloud / 100, 0, 1);
    const fogN = clamp(weather.fog, 0, 1);

    const energy = clamp(tN * 0.55 + rainN * 0.55 + windN * 0.20, 0, 1);

    // pink
    pink.sp += dt * (0.8 + 1.2 * rainN);
    pink.rp += dt * (0.20 + 0.30 * windN);
    pink.squash = Math.sin(pink.sp) * (0.03 + 0.14 * (rainN + windN * 0.4));
    pink.rot = Math.sin(pink.rp) * 0.25;

    const speed = lerp(0.85, 1.15, energy);
    pink.x += pink.vx * dt * speed + wx * 30 * dt;
    pink.y += pink.vy * dt * speed + wy * 30 * dt;

    const pr = pink.r;
    if (pink.x <= pr) { pink.x = pr; pink.vx = Math.abs(pink.vx); }
    if (pink.x >= W - pr) { pink.x = W - pr; pink.vx = -Math.abs(pink.vx); }
    if (pink.y <= pr) { pink.y = pr; pink.vy = Math.abs(pink.vy); }
    if (pink.y >= H - pr) { pink.y = H - pr; pink.vy = -Math.abs(pink.vy); }

    if (currentMode === "circles") {
      for (const c of circles) {
        c.p += dt * (0.55 + 1.55 * energy) * c.mul;
        c.sp += dt * (0.65 + 1.8 * (rainN + windN * 0.7));
        c.rp += dt * (0.35 + 1.0 * windN);
        c.squash = Math.sin(c.sp) * (0.04 + 0.18 * (rainN + windN * 0.6));
        c.rot = Math.sin(c.rp) * (0.12 + 0.35 * windN);

        c.y += dt * (10 + 55 * rainN);
        c.x += Math.sin(c.p) * dt * 10 + wx * (18 + 48 * windN) * dt;
        c.y += wy * (18 + 48 * windN) * dt;

        const pad = c.r + 40;
        if (c.x < -pad) c.x = W + pad;
        if (c.x > W + pad) c.x = -pad;
        if (c.y < -pad) c.y = H + pad;
        if (c.y > H + pad) c.y = -pad;
      }
    }

    if (currentMode === "splash") {
      for (const s of splashes) {
        s.p += dt * (0.55 + 2.25 * (rainN + windN * 0.25));
        s.rot += dt * s.rotSp * (0.35 + 1.35 * windN);

        s.x += wx * (22 + 75 * windN) * dt * s.drift;
        s.y += (12 + 70 * rainN) * dt * 0.38 + wy * (22 + 75 * windN) * dt * s.drift;

        const pad = 160;
        if (s.x < -pad) s.x = W + pad;
        if (s.x > W + pad) s.x = -pad;
        if (s.y < -pad) s.y = H + pad;
        if (s.y > H + pad) s.y = -pad;
      }
    }

    if (currentMode === "diamonds") {
      const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);
      for (const d of diamonds) {
        d.a += dt * d.spin * (0.75 + 1.8 * windN);
        d.k += dt * d.ka * (0.7 + 1.6 * storm);

        d.x += wx * (18 + 68 * windN) * dt + Math.sin(d.a) * dt * 8;
        d.y += (8 + 55 * rainN) * dt * 0.35 + wy * (18 + 68 * windN) * dt;

        const pad = 160;
        if (d.x < -pad) d.x = W + pad;
        if (d.x > W + pad) d.x = -pad;
        if (d.y < -pad) d.y = H + pad;
        if (d.y > H + pad) d.y = -pad;
      }
    }

    // ===== CLOUD motion (multi-cluster cohesion + chaos) =====
    if (currentMode === "cloud") {
      const day = isDayEffective();
      const sunny = (cloudN < 0.22 && fogN < 0.25 && rainN < 0.05 && day);
      const storm = clamp(rainN * 0.85 + windN * 0.35 + cloudN * 0.35, 0, 1);
      const chaos = sunny ? 0.12 : lerp(0.28, 1.0, storm);

      // breathing & expansion (bad weather expands + jitter)
      const breathe = 1 + Math.sin(ms / 1400) * lerp(0.02, 0.09, chaos);
      const expand = lerp(0.92, 1.18, chaos);

      for (const d of clouds) {
        d.p += dt * d.sp * (0.6 + 2.4 * chaos);

        const targetX = W * 0.5 + d.ox * breathe * expand;
        const targetY = H * 0.45 + d.oy * breathe * expand;

        const pull = lerp(0.55, 2.2, chaos);   // cohesion pull increases with chaos (so it “trembles” around center)
        const jitter = lerp(3, 95, chaos) * (0.35 + d.drift);

        d.x += (targetX - d.x) * dt * pull + Math.cos(d.p) * jitter * dt + wx * (30 + 110 * windN) * dt;
        d.y += (targetY - d.y) * dt * pull + Math.sin(d.p) * jitter * dt + wy * (30 + 110 * windN) * dt;

        if (d.x < -80) d.x = W + 80;
        if (d.x > W + 80) d.x = -80;
        if (d.y < -80) d.y = H + 80;
        if (d.y > H + 80) d.y = -80;
      }
    }

    // ===== COLA motion =====
    if (currentMode === "cola") {
      const storm = clamp(rainN * 0.90 + windN * 0.35 + cloudN * 0.22, 0, 1);
      const speedMul = lerp(0.45, 3.0, storm);

      for (const c of colas) {
        c.wob += dt * c.wobSp;
        c.ph += dt * (0.7 + 1.6 * storm);

        // “flow”
        c.len += dt * c.v * speedMul;
        c.len += Math.sin(c.ph) * lerp(0.15, 1.4, storm);

        // reset when too long
        const maxLen = H * lerp(0.50, 1.10, storm);
        if (c.len > maxLen) {
          c.len = lerp(10, 160, Math.random());
          c.w = lerp(10, 30, Math.random());
          c.v = lerp(10, 34, Math.random());
          c.wobSp = lerp(0.6, 1.7, Math.random());
        }
      }
    }
  }

  // ===== Draw helpers =====
  function hexToRgba(hex, a) {
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map(ch => ch + ch).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  function rotPt(x, y, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }
  function roundRectPath(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  // watercolor blue (slight hue drift)
  function watercolorBlueAlpha(alpha, hueJ = 0) {
    // base around: rgb(35, 120, 255) but softened
    const r = Math.floor(clamp(35 + hueJ * 0.15, 0, 255));
    const g = Math.floor(clamp(120 + hueJ * 0.35, 0, 255));
    const b = Math.floor(clamp(245 + hueJ * 0.10, 0, 255));
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function draw(ms) {
    const micMix = clamp((micSmooth * 0.75) + (micPitch * 0.25), 0, 1);
    const micScale = micOn ? lerp(1, 10, micMix) : 1;

    ctx.fillStyle = backgroundColor(currentMode);
    ctx.fillRect(0, 0, W, H);

    if (currentMode === "circles") {
      const day = isDayEffective();
      ctx.strokeStyle = day ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.92)";
      ctx.lineWidth = 2.6;

      ctx.beginPath();
      for (const c of circles) {
        const rx = c.r * micScale * (1 + c.squash);
        const ry = c.r * micScale * (1 - c.squash);
        ctx.moveTo(c.x + rx, c.y);
        ctx.ellipse(c.x, c.y, Math.max(1, rx), Math.max(1, ry), c.rot, 0, TAU);
      }
      ctx.stroke();
    }

    if (currentMode === "splash") {
      const day = isDayEffective();
      ctx.fillStyle = day ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.88)";
      const rainN = clamp(weather.rain / 10, 0, 1);
      const micExpand = 1 + (micScale - 1) * 0.75;

      for (const s of splashes) {
        const step = TAU / s.pts;
        const expand = micExpand * (1 + Math.sin(s.p) * (0.12 + 0.62 * rainN));

        ctx.beginPath();
        for (let i = 0; i < s.pts; i++) {
          const a = i * step + s.rot;
          const wave = Math.sin(s.p * 0.9 + s.phs[i]) * (s.amps[i] * (0.10 + 0.42 * rainN));
          const rr = s.base * expand * (1 + wave);
          const x = s.x + Math.cos(a) * rr;
          const y = s.y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    if (currentMode === "diamonds") {
      const rainN = clamp(weather.rain / 10, 0, 1);
      const windN = clamp(weather.wind / 12, 0, 1);
      const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);
      const micMul = 1 + (micScale - 1) * 0.85;

      for (const d of diamonds) {
        const skew = Math.sin(d.k) * d.amt * (0.35 + 0.95 * storm);
        const sx = 1 + skew, sy = 1 - skew;

        const size = d.s * micMul * lerp(0.95, 1.10, tempNorm(weather.tempC));
        const w = size * sx, h = size * sy;

        const a = isDayEffective() ? d.alpha : d.alpha * 0.78;
        ctx.fillStyle = hexToRgba(d.c, a);

        const p0 = rotPt(0, -h, d.a);
        const p1 = rotPt(w, 0, d.a);
        const p2 = rotPt(0, h, d.a);
        const p3 = rotPt(-w, 0, d.a);

        ctx.beginPath();
        ctx.moveTo(d.x + p0.x, d.y + p0.y);
        ctx.lineTo(d.x + p1.x, d.y + p1.y);
        ctx.lineTo(d.x + p2.x, d.y + p2.y);
        ctx.lineTo(d.x + p3.x, d.y + p3.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ===== CLOUD draw (watercolor dots) =====
    if (currentMode === "cloud") {
      const day = isDayEffective();

      // “wash” feel
      ctx.save();
      ctx.globalCompositeOperation = day ? "multiply" : "source-over";

      for (const d of clouds) {
        const rr = d.r * (0.85 + 0.25 * micScale);
        const a = day ? d.a : Math.max(0.10, d.a + 0.15);

        ctx.fillStyle = day
          ? watercolorBlueAlpha(a, d.hueJ)
          : `rgba(255,255,255,${clamp(a + 0.15, 0, 0.75)})`;

        ctx.beginPath();
        ctx.arc(d.x, d.y, rr, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }

    // ===== COLA draw (dripping paint) =====
    if (currentMode === "cola") {
      const day = isDayEffective();
      const rainN = clamp(weather.rain / 10, 0, 1);
      const windN = clamp(weather.wind / 12, 0, 1);
      const cloudN = clamp(weather.cloud / 100, 0, 1);
      const storm = clamp(rainN * 0.90 + windN * 0.35 + cloudN * 0.22, 0, 1);

      const paint = day ? "rgba(25,90,255,0.88)" : "rgba(255,255,255,0.90)";
      ctx.fillStyle = paint;

      // top “pool band”
      const bandH = lerp(10, 26, storm);
      ctx.fillRect(0, 0, W, bandH);

      for (const c of colas) {
        const wob = Math.sin(c.wob) * 3;
        const w = Math.max(6, c.w + wob);
        const len = c.len * (0.85 + 0.25 * micScale);

        // main drip
        roundRectPath(c.x - w * 0.5, 0, w, len, w * 0.45);
        ctx.fill();

        // drop bulb
        ctx.beginPath();
        ctx.ellipse(c.x, len, w * 0.58, w * 0.74, 0, 0, TAU);
        ctx.fill();
      }
    }

    // Pink dot
    const pulse = 0.10 + 0.08 * Math.sin(ms / 850);
    ctx.fillStyle = `rgba(255,70,170,${0.92 + pulse})`;
    const prx = pink.r * (1 + pink.squash);
    const pry = pink.r * (1 - pink.squash);
    ctx.beginPath();
    ctx.ellipse(pink.x, pink.y, Math.max(1, prx), Math.max(1, pry), pink.rot, 0, TAU);
    ctx.fill();

    // Signature MB (RED) — fixed bottom-right
    ctx.save();
    ctx.fillStyle = "rgba(200,0,0,0.95)";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = "italic 700 24px 'Playfair Display', serif";
    ctx.fillText("MB", W - 18, H - 18);
    ctx.restore();
  }

  // ===== Boot =====
  showPicker();

  // ===== Main loop =====
  let last = performance.now();
  function loop(ms) {
    const dt = clamp((ms - last) / 1000, 0, 0.05);
    last = ms;
    step(dt, ms);
    draw(ms);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
