(() => {
  /* =========================
     π Weather Art — app.js (FULL)
     - Modes: circles / splash / diamonds
     - Robust picker (pointerdown + click)
     - Pink dot opens menu overlay
     - Bottom-right tap -> back to picker
     - Weather: Open-Meteo + geolocation
     - Splash: day bg white + splashes black; night inverse
     - Signature: MB bottom-right
     - MIC: ON => Audio OFF, voice-band filtered. Shapes scale 1x..10x (volume+pitch)
     - AUDIO: louder (~10x perceived) + soft compressor + rich arpeggiated multi-voice music
  ========================= */

  const VERSION = "JS OK + MIC + MUSIC v2";

  const PI = Math.PI, TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad2 = (n) => String(n).padStart(2, "0");
  const mmToPx = (mm) => mm * (96 / 25.4);

  function tempNorm(tC) { return clamp((tC - (-15)) / (50 - (-15)), 0, 1); }

  // ===== DOM =====
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  const debug = document.getElementById("debugBadge");
  if (debug) debug.textContent = VERSION;

  const modePicker = document.getElementById("modePicker");
  const overlay = document.getElementById("overlay");
  const btnExit = document.getElementById("btn-exit");

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
  function isPickerOpen() { return modePicker && !modePicker.classList.contains("hidden"); }
  function isMenuOpen() { return overlay && !overlay.classList.contains("hidden"); }

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
  const MODES = ["circles", "splash", "diamonds"];
  let currentMode = "circles";
  try {
    const m = localStorage.getItem("pi_mode");
    if (m && MODES.includes(m)) currentMode = m;
  } catch {}

  function saveMode(m) {
    currentMode = m;
    try { localStorage.setItem("pi_mode", m); } catch {}
  }

  // Robust picker binding
  function bindPicker() {
    if (!modePicker) return;

    const btns = modePicker.querySelectorAll("[data-mode]");
    if (btns && btns.length) {
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
      return;
    }

    // fallback IDs
    const bC = document.getElementById("btnCircles");
    const bS = document.getElementById("btnSplash");
    const bD = document.getElementById("btnDiamonds");
    const bind = (btn, m) => {
      if (!btn) return;
      const go = (e) => {
        e?.preventDefault?.();
        saveMode(m);
        initArt(currentMode);
        hidePicker();
      };
      btn.addEventListener("pointerdown", go, { passive: false });
      btn.addEventListener("click", go, { passive: true });
    };
    bind(bC, "circles");
    bind(bS, "splash");
    bind(bD, "diamonds");
  }
  bindPicker();

  // ===== Weather (Open-Meteo) =====
  const weather = {
    tempC: 18,
    cloud: 40,
    rain: 0.2,
    wind: 2.0,
    windDir: 0,
    fog: 0.2,
    isDay: true
  };

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

  function requestGeoAndWeather() {
    const geo = navigator.geolocation;
    if (!geo) { fetchWeather().catch(()=>{}); return; }
    geo.getCurrentPosition(
      (p) => fetchWeather(p.coords.latitude, p.coords.longitude).catch(()=>{}),
      ()  => fetchWeather().catch(()=>{})
    );
  }

  requestGeoAndWeather();
  setInterval(() => fetchWeather().catch(()=>{}), 10 * 60 * 1000);

  function updateConsoleValues() {
    const now = new Date();
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
  let pink = null;

  function initArt(mode) {
    circles = [];
    splashes = [];
    diamonds = [];

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
  }

  initArt(currentMode);

  // ===== Interaction on canvas =====
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
  // MICROPHONE: ON => AUDIO OFF
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

    // Time-domain RMS -> volume
    micAnalyser.getByteTimeDomainData(micTime);
    let sumSq = 0;
    for (let i = 0; i < micTime.length; i++) {
      const v = (micTime[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / micTime.length);
    micGain = clamp(rms * 3.2, 0, 1);

    // Freq centroid -> pitch-ish
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

    // smoothing: instant but stable
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
  // AUDIO: Loud + Soft + Rich
  // =========================
  let audioOn = false;
  let audioCtx = null;

  let master = null;
  let comp = null;
  let lp = null;
  let chordTimer = null;

  let userVol = 0.8;
  if (volSlider) {
    userVol = clamp(Number(volSlider.value) / 100, 0, 1);
    volSlider.addEventListener("input", () => {
      userVol = clamp(Number(volSlider.value) / 100, 0, 1);
      if (master && audioCtx) {
        const volCurve = Math.pow(userVol, 0.6);
        master.gain.setTargetAtTime(1.8 * volCurve, audioCtx.currentTime, 0.06);
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
    const muffle = clamp(weather.fog * 0.85 + (weather.cloud / 100) * 0.55, 0, 1);
    let c = lerp(15000, 1800, muffle);
    if (!isDayEffective()) c *= 0.75;
    return c;
  }

  function currentScale() {
    const g = (genreSel && genreSel.value) ? genreSel.value : "jazz";
    if (g === "blues") return [0,3,5,6,7,10];
    if (g === "classical") return [0,2,4,5,7,9,11];
    if (g === "soul") return [0,2,3,5,7,9,10];   // dorian
    return [0,2,3,5,7,9,10];                      // jazz ambient dorian
  }

  function chooseRootStep() {
    // gentle Markov-ish flow (keeps moving without loops)
    const opts = [0, 2, 4, 5, 7, 9, 10];
    const bias = Math.random() < 0.55 ? 0 : (Math.random() < 0.5 ? 2 : -2);
    const idx = (Math.floor(Math.random() * opts.length) + bias + opts.length) % opts.length;
    return opts[idx];
  }

  function scheduleChord() {
    if (!audioCtx) return;

    // weather tempo
    const tN = tempNorm(weather.tempC);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const windN = clamp(weather.wind / 12, 0, 1);
    const cloudN = clamp(weather.cloud / 100, 0, 1);
    const energy = clamp(tN * 0.55 + rainN * 0.55 + windN * 0.20 + cloudN * 0.10, 0, 1);

    let bpm = lerp(45, 95, clamp(energy, 0, 1));
    if (!isDayEffective()) bpm *= 0.80;

    const beat = 60 / bpm;
    const dur = beat * lerp(3.5, 7.0, Math.random());

    const g = (genreSel && genreSel.value) ? genreSel.value : "jazz";
    const scale = currentScale();

    // slowly drifting key center
    const baseKey = 48; // C2-ish base
    const root = baseKey + chooseRootStep() + (Math.random() < 0.30 ? 12 : 0);

    // chord color: soft, many notes (6–8)
    const chordTones = (g === "blues")
      ? [0, 4, 7, 10, 14, 17]      // dom-ish extended
      : (Math.random() < 0.5 ? [0, 3, 7, 10, 14, 17, 21] : [0, 4, 7, 11, 14, 16, 21]);

    const now = audioCtx.currentTime;

    // timbre follows fog/cloud
    lp.frequency.setTargetAtTime(timbreCutoff(), now, 0.25);

    const voices = Math.floor(lerp(6, 8, Math.random()));
    const baseVel = lerp(0.020, 0.040, 1 - energy) * (isDayEffective() ? 1.0 : 0.75);

    for (let i = 0; i < voices; i++) {
      // build arpeggio notes: chord + scale passing
      const useChord = Math.random() < 0.72;
      const semi = useChord
        ? chordTones[i % chordTones.length]
        : scale[Math.floor(Math.random() * scale.length)];

      const octave = (Math.random() < 0.55) ? 12 : 24;
      const midi = root + semi + octave + (Math.random() < 0.12 ? 12 : 0);

      const o = audioCtx.createOscillator();
      const gN = audioCtx.createGain();
      const p = audioCtx.createStereoPanner();

      o.type = (g === "classical")
        ? "sine"
        : (Math.random() < 0.55 ? "triangle" : "sine");

      o.frequency.value = midiToHz(midi);
      o.detune.value = lerp(-9, 9, Math.random());
      p.pan.value = lerp(-0.75, 0.75, Math.random());

      const t0 = now + i * beat * 0.22;
      const vel = baseVel * lerp(0.75, 1.15, Math.random());

      gN.gain.setValueAtTime(0.0001, t0);
      gN.gain.linearRampToValueAtTime(vel / voices, t0 + 0.10);
      gN.gain.setTargetAtTime(0.0001, t0 + dur, 0.35);

      o.connect(gN);
      gN.connect(p);
      p.connect(lp);

      o.start(t0);
      o.stop(t0 + dur + 1.0);
    }

    chordTimer = setTimeout(scheduleChord, dur * 1000);
  }

  async function audioEnable() {
    // mic has priority
    if (micOn) {
      disableMic();
      if (toggleMic) toggleMic.checked = false;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();

    master = audioCtx.createGain();

    // 10x perceived volume with curve + headroom + compressor
    const volCurve = Math.pow(userVol, 0.6);
    master.gain.value = 1.8 * volCurve;

    comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 24;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.02;
    comp.release.value = 0.25;

    lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = timbreCutoff();
    lp.Q.value = 0.8;

    // routing: voices -> lp -> comp -> master -> destination
    lp.connect(comp);
    comp.connect(master);
    master.connect(audioCtx.destination);

    audioOn = true;
    setAudioButton();

    if (chordTimer) clearTimeout(chordTimer);
    chordTimer = null;
    scheduleChord();
  }

  async function audioDisable() {
    audioOn = false;
    setAudioButton();

    try { if (chordTimer) clearTimeout(chordTimer); } catch {}
    chordTimer = null;

    try { if (audioCtx) await audioCtx.close(); } catch {}
    audioCtx = null;
    master = null;
    comp = null;
    lp = null;
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
        scheduleChord();
      }
    });
  }

  // ===== Night toggle affects timbre =====
  if (toggleNight) {
    toggleNight.addEventListener("change", () => {
      // no restart necessary; cutoff follows weather
    });
  }

  // ===== Motion =====
  function step(dt, ms) {
    updateMic();

    const tN = tempNorm(weather.tempC);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const { wx, wy, windN } = windVec();
    const energy = clamp(tN * 0.55 + rainN * 0.55 + windN * 0.20, 0, 1);

    // Pink motion
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

  function draw(ms) {
    // mic-driven scale: volume dominates, pitch adds extra
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

    // Pink dot (solid)
    const pulse = 0.10 + 0.08 * Math.sin(ms / 850);
    ctx.fillStyle = `rgba(255,70,170,${0.92 + pulse})`;
    const prx = pink.r * (1 + pink.squash);
    const pry = pink.r * (1 - pink.squash);
    ctx.beginPath();
    ctx.ellipse(pink.x, pink.y, Math.max(1, prx), Math.max(1, pry), pink.rot, 0, TAU);
    ctx.fill();

    // Signature MB only
    ctx.save();
    ctx.fillStyle = isDayEffective() ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = "italic 700 18px Arial";
    ctx.fillText("MB", W - 18, H - 18);
    ctx.restore();
  }

  // ===== Boot =====
  // Start with picker visible
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

  // ===== Audio / Mic interaction buttons =====
  // Keep audio unlocked on user gesture
  document.addEventListener("pointerdown", async () => {
    try { if (audioCtx && audioCtx.state !== "running") await audioCtx.resume(); } catch {}
    try { if (micCtx && micCtx.state !== "running") await micCtx.resume(); } catch {}
  }, { passive: true });

  if (btnAudio) {
    // already bound inside audio section
  }

})();
