/* π Weather Art — app.js (stable + musical)
   - Picker initial: circles / splash / diamonds
   - Pink dot opens menu (overlay)
   - Bottom-right tap returns to picker
   - Weather: Open-Meteo + geolocation
   - Visual: circles/splash/diamonds adapt to meteo (rain/wind/cloud/fog/day-night)
   - Splash: day -> white bg + black splashes, night -> black bg + white splashes
   - Footer: ONLY "MB" bottom-right (no motif label)
   - Audio: rich generative music (multi-voice, chord progressions, arps, evolving motifs)
*/

(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  // ---------- DOM ----------
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

  // ---------- Helpers ----------
  const PI = Math.PI;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad2 = (n) => String(n).padStart(2, "0");
  const mmToPx = (mm) => mm * (96 / 25.4);

  function tempNorm(tC) { return clamp((tC - (-15)) / (50 - (-15)), 0, 1); }

  function seasonKey(d = new Date()) {
    const m = d.getMonth();
    if (m === 11 || m <= 1) return "winter";
    if (m >= 2 && m <= 4) return "spring";
    if (m >= 5 && m <= 7) return "summer";
    return "autumn";
  }
  function seasonSeed(sk) {
    return ({ winter: 314159, spring: 271828, summer: 161803, autumn: 141421 }[sk] || 314159) >>> 0;
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

  // ---------- Pointer Events routing ----------
  function isPickerOpen() { return modePicker && !modePicker.classList.contains("hidden"); }
  function isMenuOpen() { return overlay && !overlay.classList.contains("hidden"); }

  function showPicker() {
    if (!modePicker) return;
    modePicker.classList.remove("hidden");
    modePicker.setAttribute("aria-hidden", "false");
    canvas.style.pointerEvents = "none";
  }
  function hidePicker() {
    if (!modePicker) return;
    modePicker.classList.add("hidden");
    modePicker.setAttribute("aria-hidden", "true");
    canvas.style.pointerEvents = isMenuOpen() ? "none" : "auto";
  }
  function openMenu() {
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    canvas.style.pointerEvents = "none";
    updateConsoleValues();
  }
  function closeMenu() {
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    canvas.style.pointerEvents = isPickerOpen() ? "none" : "auto";
  }

  if (btnExit) btnExit.addEventListener("click", closeMenu);
  if (overlay) overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) closeMenu();
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
  window.addEventListener("resize", () => { resize(); initArt(currentMode); });
  resize();

  // ---------- Weather ----------
  const weather = {
    tempC: 18,
    cloud: 30,     // 0..100
    rain: 0,       // mm/h
    wind: 1.5,     // m/s
    windDir: 0,    // deg
    fog: 0.1,      // 0..1
    isDay: true
  };

  function isDayEffective() {
    const forcedNight = !!(toggleNight && toggleNight.checked);
    return forcedNight ? false : weather.isDay;
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
    weather.cloud = d.hourly.cloud_cover[i] ?? 30;
    weather.rain = d.hourly.precipitation[i] ?? 0;

    const vis = d.hourly.visibility[i];
    weather.fog = (typeof vis === "number") ? clamp(1 - vis / 20000, 0, 1) : 0;

    updateConsoleValues();
    music.forceNewSection = true;
  }

  function requestGeoAndWeather() {
    const geo = navigator.geolocation;
    if (!geo) { fetchWeather().catch(()=>{}); return; }
    geo.getCurrentPosition(
      (p) => fetchWeather(p.coords.latitude, p.coords.longitude).catch(()=>{}),
      () => fetchWeather().catch(()=>{})
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

  // ---------- Background ----------
  function backgroundColor(mode) {
    const day = isDayEffective();
    const clouds = clamp(weather.cloud / 100, 0, 1);
    const fog = clamp(weather.fog, 0, 1);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const windN = clamp(weather.wind / 14, 0, 1);

    // Special for splash: strict black/white requirement
    if (mode === "splash") {
      return day ? "rgb(255,255,255)" : "rgb(0,0,0)";
    }

    // Other modes: white day, very light grey on clouds/fog, darker on storm, night dark greys
    if (!day) {
      const lift = clamp(clouds * 0.35 + fog * 0.55, 0, 1);
      const v = Math.floor(lerp(8, 50, lift));
      return `rgb(${v},${v},${v})`;
    }

    const sunny = (clouds < 0.22 && fog < 0.20 && rainN < 0.03);
    if (sunny) return "rgb(255,255,255)";

    const storm = clamp(rainN * 0.75 + windN * 0.20 + clouds * 0.30, 0, 1);
    if (storm > 0.62) {
      const t = clamp((storm - 0.62) / 0.38, 0, 1);
      const v = Math.floor(lerp(238, 150, t));
      return `rgb(${v},${v},${v})`;
    }

    // very light greys for cloud/fog
    const lightMix = clamp(clouds * 0.65 + fog * 0.85, 0, 1);
    const v = Math.floor(lerp(255, 238, lightMix));
    return `rgb(${v},${v},${v})`;
  }

  // ---------- Modes ----------
  const MODES = ["circles", "splash", "diamonds"];
  let currentMode = "circles";

  function loadMode() {
    try {
      const m = localStorage.getItem("pi_mode");
      if (m && MODES.includes(m)) currentMode = m;
    } catch {}
  }
  function saveMode(m) {
    currentMode = m;
    try { localStorage.setItem("pi_mode", m); } catch {}
  }
  loadMode();

  // ---------- Art State ----------
  const DIAMOND_PALETTE = [
    "#BA5900", "#FF8100", "#088DEF", "#0B24C5", "#7B1DEF", "#62027D",
    "#D245D3", "#AE048F", "#FA01A9", "#E40674", "#CC021C", "#F17677"
  ];

  let circles = [];
  let splashes = [];
  let diamonds = [];
  let pink = null;

  function initArt(mode) {
    const rng = mulberry32((seasonSeed(seasonKey()) ^ 0x9E3779B9) >>> 0);

    circles = [];
    splashes = [];
    diamonds = [];

    // Pink dot (always)
    pink = {
      x: rng() * W,
      y: rng() * H,
      r: mmToPx(3),
      vx: (rng() < 0.5 ? -1 : 1) * lerp(60, 110, rng()),
      vy: (rng() < 0.5 ? -1 : 1) * lerp(60, 110, rng()),
      squashP: rng() * TAU,
      rotP: rng() * TAU,
      squash: 0,
      rot: 0
    };

    if (mode === "circles") {
      const N = 199;
      for (let i = 0; i < N; i++) {
        const baseR = lerp(22, 70, rng());
        circles.push({
          x: rng() * W,
          y: rng() * H,
          r: baseR,
          phase: rng() * TAU,
          squashP: rng() * TAU,
          rotP: rng() * TAU,
          squash: 0,
          rot: 0,
          speedMul: lerp(0.92, 1.08, rng())
        });
      }
    }

    if (mode === "splash") {
      const N = 70;
      for (let i = 0; i < N; i++) {
        const points = Math.floor(lerp(7, 12, rng()));
        splashes.push({
          x: rng() * W,
          y: rng() * H,
          base: lerp(22, 80, rng()),
          points,
          amps: Array.from({ length: points }, () => lerp(0.14, 0.55, rng())),
          phs: Array.from({ length: points }, () => rng() * TAU),
          p: rng() * TAU,
          rot: rng() * TAU,
          rotSpeed: lerp(-0.10, 0.10, rng()),
          drift: lerp(0.60, 1.35, rng())
        });
      }
    }

    if (mode === "diamonds") {
      const N = 130;
      for (let i = 0; i < N; i++) {
        diamonds.push({
          x: rng() * W,
          y: rng() * H,
          size: lerp(16, 80, rng()),
          a: rng() * TAU,
          spin: lerp(-0.22, 0.22, rng()),
          skewP: rng() * TAU,
          skewSpeed: lerp(0.35, 1.2, rng()),
          skewAmt: lerp(0.08, 0.22, rng()),
          alpha: lerp(0.65, 0.95, rng()),
          color: DIAMOND_PALETTE[i % DIAMOND_PALETTE.length]
        });
      }
    }

    music.forceNewSection = true;
  }

  initArt(currentMode);

  // ---------- Input ----------
  function hitBottomRight(x, y) {
    const zone = Math.max(72, Math.min(120, Math.min(W, H) * 0.12));
    return (x >= W - zone && y >= H - zone);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (isMenuOpen()) return;
    if (isPickerOpen()) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (hitBottomRight(x, y)) { showPicker(); return; }

    if (!pink) return;
    const dx = x - pink.x;
    const dy = y - pink.y;
    if (Math.hypot(dx, dy) <= pink.r + 30) openMenu();
  }, { passive: true });

  // Picker buttons
  if (modePicker) {
    modePicker.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mode]");
      if (!btn) return;
      const m = btn.getAttribute("data-mode");
      if (!MODES.includes(m)) return;
      saveMode(m);
      initArt(currentMode);
      hidePicker();
    });
  }

  // ---------- Motion ----------
  function windVec() {
    const windN = clamp(weather.wind / 12, 0, 1);
    const dir = (weather.windDir || 0) * PI / 180;
    return { wx: Math.cos(dir) * windN, wy: Math.sin(dir) * windN, windN };
  }

  function step(dt, ms) {
    const tN = tempNorm(weather.tempC);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const clouds = clamp(weather.cloud / 100, 0, 1);
    const fog = clamp(weather.fog, 0, 1);
    const { wx, wy, windN } = windVec();

    // Global energy
    const energy = clamp(tN * 0.55 + rainN * 0.55 + windN * 0.20, 0, 1);
    const calm = 1 - energy;

    // Pink dot motion (slower rotation feel)
    if (pink) {
      pink.squashP += dt * (0.8 + 1.2 * rainN);
      pink.rotP    += dt * (0.20 + 0.30 * windN);
      pink.squash = Math.sin(pink.squashP) * (0.03 + 0.14 * (rainN + windN * 0.4));
      pink.rot = Math.sin(pink.rotP) * 0.25;

      const speed = lerp(0.85, 1.15, energy);
      pink.x += (pink.vx * dt) * speed + wx * 30 * dt;
      pink.y += (pink.vy * dt) * speed + wy * 30 * dt;

      const r = pink.r;
      if (pink.x <= r) { pink.x = r; pink.vx = Math.abs(pink.vx); }
      if (pink.x >= W - r) { pink.x = W - r; pink.vx = -Math.abs(pink.vx); }
      if (pink.y <= r) { pink.y = r; pink.vy = Math.abs(pink.vy); }
      if (pink.y >= H - r) { pink.y = H - r; pink.vy = -Math.abs(pink.vy); }
    }

    // Circles
    if (currentMode === "circles") {
      for (const c of circles) {
        c.phase += dt * (0.55 + 1.55 * energy) * c.speedMul;

        c.squashP += dt * (0.65 + 1.8 * (rainN + windN * 0.7));
        c.rotP    += dt * (0.35 + 1.0 * windN);
        c.squash = Math.sin(c.squashP) * (0.04 + 0.18 * (rainN + windN * 0.6));
        c.rot = Math.sin(c.rotP) * (0.12 + 0.35 * windN);

        // sun-day harmonic: drift upward a bit, settle toward top band
        const sunMode = isDayEffective() && rainN < 0.02 && clouds < 0.35 && fog < 0.35;
        if (sunMode) {
          c.x += (Math.cos(c.phase) * 14 + wx * 22) * dt;
          c.y += (Math.sin(c.phase) * 9 + wy * 12) * dt;
          c.y -= dt * (4 + 12 * tN);
          c.y += (H * 0.34 - c.y) * dt * 0.04;
        } else {
          // rain: vertical drift, speed with rain
          c.y += dt * (12 + 55 * rainN + 12 * (1 - calm));
          c.x += Math.sin(c.phase) * dt * 10;
          // wind drift
          c.x += wx * (18 + 48 * windN) * dt;
          c.y += wy * (18 + 48 * windN) * dt;
        }

        // wrap
        const pad = c.r + 40;
        if (c.x < -pad) c.x = W + pad;
        if (c.x > W + pad) c.x = -pad;
        if (c.y < -pad) c.y = H + pad;
        if (c.y > H + pad) c.y = -pad;
      }
    }

    // Splash
    if (currentMode === "splash") {
      for (const s of splashes) {
        s.p += dt * (0.55 + 2.25 * (rainN + windN * 0.25));
        s.rot += dt * s.rotSpeed * (0.35 + 1.35 * windN);

        // rain expands, wind drifts
        s.x += wx * (22 + 75 * windN) * dt * s.drift;
        s.y += (12 + 70 * rainN) * dt * 0.38 + wy * (22 + 75 * windN) * dt * s.drift;

        // wrap
        const pad = 160;
        if (s.x < -pad) s.x = W + pad;
        if (s.x > W + pad) s.x = -pad;
        if (s.y < -pad) s.y = H + pad;
        if (s.y > H + pad) s.y = -pad;
      }
    }

    // Diamonds
    if (currentMode === "diamonds") {
      const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);
      for (const d of diamonds) {
        d.a += dt * d.spin * (0.75 + 1.8 * windN);
        d.skewP += dt * d.skewSpeed * (0.7 + 1.6 * storm);

        d.x += wx * (18 + 68 * windN) * dt + Math.sin(d.a) * dt * 8;
        d.y += (8 + 55 * rainN) * dt * 0.35 + wy * (18 + 68 * windN) * dt;

        // wrap
        const pad = 160;
        if (d.x < -pad) d.x = W + pad;
        if (d.x > W + pad) d.x = -pad;
        if (d.y < -pad) d.y = H + pad;
        if (d.y > H + pad) d.y = -pad;
      }
    }
  }

  // ---------- Draw ----------
  function hexToRgba(hex, a) {
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map(ch => ch + ch).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function rotatePoint(x, y, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function draw(ms) {
    ctx.fillStyle = backgroundColor(currentMode);
    ctx.fillRect(0, 0, W, H);

    if (currentMode === "circles") {
      const day = isDayEffective();
      ctx.strokeStyle = day ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.92)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (const c of circles) {
        const rx = c.r * (1 + c.squash);
        const ry = c.r * (1 - c.squash);
        ctx.moveTo(c.x + rx, c.y);
        ctx.ellipse(c.x, c.y, Math.max(1, rx), Math.max(1, ry), c.rot, 0, TAU);
      }
      ctx.stroke();
    }

    if (currentMode === "splash") {
      const day = isDayEffective();
      // strict: day -> black, night -> white
      ctx.fillStyle = day ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.88)";
      const rainN = clamp(weather.rain / 10, 0, 1);

      for (const s of splashes) {
        const pts = s.points;
        const step = TAU / pts;
        const expand = 1 + Math.sin(s.p) * (0.12 + 0.62 * rainN);

        ctx.beginPath();
        for (let i = 0; i < pts; i++) {
          const a = i * step + s.rot;
          const wave = Math.sin(s.p * 0.9 + s.phs[i]) * (s.amps[i] * (0.10 + 0.42 * rainN));
          const r = s.base * expand * (1 + wave);
          const x = s.x + Math.cos(a) * r;
          const y = s.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    if (currentMode === "diamonds") {
      const rainN = clamp(weather.rain / 10, 0, 1);
      const { windN } = windVec();
      const storm = clamp(rainN * 0.7 + windN * 0.4, 0, 1);

      for (const d of diamonds) {
        const skew = Math.sin(d.skewP) * d.skewAmt * (0.35 + 0.95 * storm);
        const sx = 1 + skew;
        const sy = 1 - skew;

        const size = d.size * lerp(0.95, 1.10, tempNorm(weather.tempC));
        const w = size * sx;
        const h = size * sy;

        const a = isDayEffective() ? d.alpha : d.alpha * 0.78;
        ctx.fillStyle = hexToRgba(d.color, a);

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

    // Pink dot (solid, no stroke)
    if (pink) {
      const pulse = 0.10 + 0.08 * Math.sin(ms / 850);
      ctx.fillStyle = `rgba(255,70,170,${0.92 + pulse})`;
      const rx = pink.r * (1 + pink.squash);
      const ry = pink.r * (1 - pink.squash);
      ctx.beginPath();
      ctx.ellipse(pink.x, pink.y, Math.max(1, rx), Math.max(1, ry), pink.rot, 0, TAU);
      ctx.fill();
    }

    // Signature only (bottom-right)
    drawSignature();
  }

  function drawSignature() {
    const pad = 18;
    const day = isDayEffective();
    ctx.save();
    ctx.fillStyle = day ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = "italic 700 18px Arial";
    ctx.fillText("MB", W - pad, H - pad);
    ctx.restore();
  }

  // =========================
  // AUDIO — Rich Generative Music (hours, no obvious loop)
  // =========================
  let audioOn = false;
  let audioCtx = null;

  let master = null;
  let limiter = null;
  let comp = null;
  let lp = null;
  let reverb = null;
  let wet = null;
  let dry = null;

  let busPad = null;
  let busArp = null;
  let busMel = null;
  let busCtr = null;
  let busBass = null;
  let busPerc = null;

  let userVol = 0.78; // default higher

  // Restore volume + genre if present
  try {
    const v = Number(localStorage.getItem("pi_volume"));
    if (!Number.isNaN(v)) userVol = clamp(v, 0, 1);
  } catch {}
  if (volSlider) {
    volSlider.value = String(Math.round(userVol * 100));
    volSlider.addEventListener("input", () => {
      userVol = clamp(Number(volSlider.value) / 100, 0, 1);
      try { localStorage.setItem("pi_volume", String(userVol)); } catch {}
    });
  }
  if (genreSel) {
    try {
      const g = localStorage.getItem("pi_genre");
      if (g) genreSel.value = g;
    } catch {}
    genreSel.addEventListener("change", () => {
      try { localStorage.setItem("pi_genre", genreSel.value); } catch {}
      music.forceNewSection = true;
    });
  }

  function setAudioButton() {
    if (!btnAudio) return;
    btnAudio.textContent = audioOn ? "🎶 Audio ON" : "🎶 Audio OFF";
  }
  setAudioButton();

  function makeImpulse(ctx, seconds = 2.4, decay = 2.8) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * env * (0.70 + 0.30 * Math.sin(i * 0.001));
      }
    }
    return buf;
  }

  function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  const SCALES = {
    ionian:    [0,2,4,5,7,9,11],
    dorian:    [0,2,3,5,7,9,10],
    aeolian:   [0,2,3,5,7,8,10],
    lydian:    [0,2,4,6,7,9,11],
    mixolyd:   [0,2,4,5,7,9,10],
    pentMaj:   [0,2,4,7,9],
    pentMin:   [0,3,5,7,10],
    blues:     [0,3,5,6,7,10]
  };

  function chooseScale() {
    const sk = seasonKey();
    const g = (genreSel && genreSel.value) ? genreSel.value : "jazz";
    const rainN = clamp(weather.rain / 10, 0, 1);
    const fogN = clamp(weather.fog, 0, 1);
    const dark = clamp(fogN*0.8 + rainN*0.6 + (!isDayEffective()?0.55:0), 0, 1);

    if (g === "blues") return { mode: "blues", scale: SCALES.blues };
    if (g === "soul")  return { mode: dark>0.55 ? "dorian" : "mixolyd", scale: dark>0.55 ? SCALES.dorian : SCALES.mixolyd };
    if (g === "classical") return { mode: dark>0.55 ? "aeolian" : "ionian", scale: dark>0.55 ? SCALES.aeolian : SCALES.ionian };

    // jazz ambient:
    if (sk === "winter") return { mode: dark>0.45 ? "dorian" : "lydian", scale: dark>0.45 ? SCALES.dorian : SCALES.lydian };
    if (sk === "summer") return { mode: dark>0.45 ? "mixolyd" : "pentMaj", scale: dark>0.45 ? SCALES.mixolyd : SCALES.pentMaj };
    if (sk === "spring") return { mode: dark>0.45 ? "dorian" : "ionian", scale: dark>0.45 ? SCALES.dorian : SCALES.ionian };
    return { mode: dark>0.45 ? "aeolian" : "dorian", scale: dark>0.45 ? SCALES.aeolian : SCALES.dorian };
  }

  function weatherTempoBpm() {
    const tN = tempNorm(weather.tempC);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const windN = clamp(weather.wind / 12, 0, 1);
    const cloudN = clamp(weather.cloud / 100, 0, 1);
    const energy = clamp(tN*0.60 + rainN*0.55 + windN*0.25 + cloudN*0.10, 0, 1);

    let bpm = lerp(52, 110, energy);
    const g = (genreSel && genreSel.value) ? genreSel.value : "jazz";
    if (g === "classical") bpm *= 0.88;
    if (g === "blues") bpm *= 0.92;
    if (!isDayEffective()) bpm *= 0.82;
    return clamp(bpm, 42, 118);
  }

  // richer chord colors (avoid monotone)
  const QUAL = {
    maj7: [0,4,7,11],
    min7: [0,3,7,10],
    dom9: [0,4,7,10,14],
    m9:   [0,3,7,10,14],
    M9:   [0,4,7,11,14],
    sus9: [0,5,7,10,14],
    dim7: [0,3,6,9],
    add6: [0,4,7,9],
  };

  // Markov-like degree flow per season (keeps evolving)
  const MARKOV = {
    winter: { 1:[4,6], 2:[5], 3:[6], 4:[1,2,5], 5:[1,6], 6:[2,4], 7:[1,3] },
    spring: { 1:[4,5,6], 2:[5,7], 3:[6], 4:[1,2,5], 5:[1,6], 6:[2,4,5], 7:[1] },
    summer: { 1:[4,5,6], 2:[5], 3:[6,4], 4:[1,2,5], 5:[1,6], 6:[2,4,5], 7:[1,3] },
    autumn: { 1:[4,6], 2:[5,7], 3:[6], 4:[1,2,5], 5:[1,6], 6:[2,4], 7:[1] }
  };

  // music RNG: changes each season + drifts over time
  let rngMusic = mulberry32((seasonSeed(seasonKey()) ^ 0xC0FFEE) >>> 0);
  const rnd = () => rngMusic();
  const chance = (p) => rnd() < p;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

  function degreeToMidi(keyMidi, scale, deg, oct=0) {
    const d = ((deg - 1) % 7 + 7) % 7;
    const semi = scale[d % scale.length];
    return keyMidi + semi + oct * 12;
  }
  function clampMidi(m){ return clamp(m, 30, 96); }

  function chooseChordQuality() {
    const g = (genreSel && genreSel.value) ? genreSel.value : "jazz";
    const rainN = clamp(weather.rain / 10, 0, 1);
    const fogN = clamp(weather.fog, 0, 1);
    const dark = clamp(fogN*0.8 + rainN*0.6 + (!isDayEffective()?0.6:0), 0, 1);

    if (g === "classical") return dark > 0.5 ? QUAL.min7 : QUAL.maj7;
    if (g === "blues") return QUAL.dom9;
    if (g === "soul")  return dark > 0.55 ? QUAL.m9 : QUAL.M9;

    // jazz ambient: rich but soft
    if (dark > 0.70 && chance(0.18)) return QUAL.dim7;
    if (chance(0.25)) return QUAL.sus9;
    if (chance(0.28)) return QUAL.m9;
    if (chance(0.28)) return QUAL.M9;
    if (chance(0.18)) return QUAL.add6;
    return chance(0.5) ? QUAL.min7 : QUAL.maj7;
  }

  function makeVoice({ type="sine", freq=440, when=0, dur=0.3, vel=0.05, bus, detune=0, cutoff=12000, pan=0 }) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const f = audioCtx.createBiquadFilter();
    const p = audioCtx.createStereoPanner();

    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    o.detune.setValueAtTime(detune, when);

    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff, when);
    f.Q.setValueAtTime(0.8, when);

    p.pan.setValueAtTime(pan, when);

    o.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(bus);

    // envelope (no clicking, musical)
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.02);
    g.gain.setTargetAtTime(0.0001, when + dur, 0.06);

    o.start(when);
    o.stop(when + dur + 0.35);
  }

  function noiseHit(when, dur, vel, hpHz=2200, pan=0) {
    if (!audioCtx) return;
    const sr = audioCtx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = audioCtx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, 2.2);
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
    g.gain.setTargetAtTime(0.0001, when + dur, 0.05);

    const p = audioCtx.createStereoPanner();
    p.pan.setValueAtTime(pan, when);

    src.connect(hp);
    hp.connect(g);
    g.connect(p);
    p.connect(busPerc);

    src.start(when);
    src.stop(when + dur + 0.1);
  }

  function kick(when, vel=0.10) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(95, when);
    o.frequency.exponentialRampToValueAtTime(46, when + 0.12);

    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel, when + 0.01);
    g.gain.setTargetAtTime(0.0001, when + 0.18, 0.06);

    o.connect(g);
    g.connect(busPerc);

    o.start(when);
    o.stop(when + 0.35);
  }

  // Music state: schedules bars continuously
  const music = {
    ready: false,
    forceNewSection: true,
    bpm: 72,
    beat: 60/72,
    bar: (60/72)*4,
    nextTime: 0,
    lookAhead: 0.9,

    keyMidi: 57,     // A3-ish
    degree: 1,
    scale: SCALES.dorian,
    modeName: "dorian",
    sectionEndsAt: 0,
    motif: null,

    reset() {
      if (!audioCtx) return;
      this.ready = true;
      this.forceNewSection = true;
      this.nextTime = audioCtx.currentTime + 0.12;
      this.sectionEndsAt = audioCtx.currentTime + 0.1;
      rngMusic = mulberry32(((Date.now() ^ seasonSeed(seasonKey())) >>> 0) ^ 0xC0FFEE);
    },

    newSection() {
      if (!audioCtx) return;

      const { mode, scale } = chooseScale();
      this.modeName = mode;
      this.scale = scale;

      this.bpm = weatherTempoBpm();
      this.beat = 60 / this.bpm;
      this.bar  = this.beat * 4;

      // slowly drift key (prevents repetition)
      const tN = tempNorm(weather.tempC);
      const rainN = clamp(weather.rain / 10, 0, 1);
      const drift = Math.floor(lerp(-2, 3, rnd()) + lerp(-2, 2, tN) + lerp(0, 2, rainN));
      this.keyMidi = clampMidi(this.keyMidi + drift);

      // pick starting degree + motif style
      this.degree = pick([1,1,4,6,2,5,1]);
      this.motif = pickMotif();

      // section length (minutes) — long-form evolving
      const baseMin = isDayEffective() ? 2.5 : 3.8;
      const extra = isDayEffective() ? 5.5 : 6.5;
      this.sectionEndsAt = audioCtx.currentTime + (baseMin + rnd()*extra) * 60;

      this.forceNewSection = false;
    }
  };

  function pickMotif() {
    const g = (genreSel && genreSel.value) ? genreSel.value : "jazz";
    // a few motif skeletons (melodic contour + rhythm choices) — keeps variety
    const motifs = {
      jazz: [
        { steps:[0,2,1,3,2], dens:0.55, arp:0.70 },
        { steps:[0,1,-1,2,1], dens:0.45, arp:0.78 },
        { steps:[0,3,2,4,2], dens:0.50, arp:0.74 },
        { steps:[0,2,4,2,1], dens:0.48, arp:0.68 },
      ],
      soul: [
        { steps:[0,2,1,2,0], dens:0.50, arp:0.60 },
        { steps:[0,1,2,1,0], dens:0.45, arp:0.58 },
      ],
      blues: [
        { steps:[0,3,0,2,0], dens:0.55, arp:0.55 },
        { steps:[0,2,0,3,0], dens:0.52, arp:0.52 },
      ],
      classical: [
        { steps:[0,2,4,2,1], dens:0.42, arp:0.74 },
        { steps:[0,1,2,3,2], dens:0.40, arp:0.72 },
      ]
    };
    const key = (genreSel && motifs[genreSel.value]) ? genreSel.value : "jazz";
    return pick(motifs[key]);
  }

  function nextDegreeMarkov(cur) {
    const sk = seasonKey();
    const table = MARKOV[sk] || MARKOV.spring;
    const opts = table[cur] || [1,4,5,6];
    let d = pick(opts);
    if (d === cur && opts.length > 1) d = pick(opts);
    return d;
  }

  function updateAudioTimbreAndGain() {
    if (!audioCtx) return;

    const cloudN = clamp(weather.cloud / 100, 0, 1);
    const fogN = clamp(weather.fog, 0, 1);
    const rainN = clamp(weather.rain / 10, 0, 1);
    const windN = clamp(weather.wind / 12, 0, 1);
    const tN = tempNorm(weather.tempC);

    // timbre: fog/cloud -> more muffled
    const muffle = clamp(fogN*0.85 + cloudN*0.55, 0, 1);
    let cutoff = lerp(11000, 1200, muffle);
    if (!isDayEffective()) cutoff *= 0.75;
    lp.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.18);

    // reverb wetness
    let wetAmt = lerp(0.16, 0.46, clamp(muffle*0.85 + rainN*0.25, 0, 1));
    if (!isDayEffective()) wetAmt *= 1.10;
    wet.gain.setTargetAtTime(clamp(wetAmt, 0.10, 0.60), audioCtx.currentTime, 0.20);

    // master loudness (higher than before, but safe)
    const energy = clamp(tN*0.55 + rainN*0.55 + windN*0.20, 0, 1);
    let g = lerp(0.075, 0.125, energy); // <-- louder base
    if (!isDayEffective()) g *= 0.85;
    g *= userVol;
    master.gain.setTargetAtTime(clamp(g, 0.0001, 0.16), audioCtx.currentTime, 0.22);
  }

  function scheduleBar(tBarStart) {
    if (!audioCtx) return;

    if (music.forceNewSection || tBarStart >= music.sectionEndsAt) {
      music.newSection();
    }

    // smooth tempo drift to weather
    const targetBpm = weatherTempoBpm();
    music.bpm = lerp(music.bpm, targetBpm, 0.06);
    music.beat = 60 / music.bpm;
    music.bar = music.beat * 4;

    updateAudioTimbreAndGain();

    const rainN = clamp(weather.rain / 10, 0, 1);
    const windN = clamp(weather.wind / 12, 0, 1);
    const fogN  = clamp(weather.fog, 0, 1);
    const cloudN = clamp(weather.cloud / 100, 0, 1);
    const tN = tempNorm(weather.tempC);

    const energy = clamp(tN*0.55 + rainN*0.55 + windN*0.20, 0, 1);
    const calm = 1 - energy;
    const night = !isDayEffective();

    // next chord degree
    music.degree = nextDegreeMarkov(music.degree);

    const scale = music.scale;
    const rootMidi = degreeToMidi(music.keyMidi, scale, music.degree, 0);
    const qual = chooseChordQuality();
    const chordMidis = qual.map(semi => clampMidi(rootMidi + semi));

    // cutoff hint per voice
    const cutoff = lerp(12000, 2400, clamp(fogN*0.9 + cloudN*0.45, 0, 1));

    // PAD: 4-6 voices, swells (no drone)
    const swellCount = night ? (chance(0.6) ? 1 : 2) : (chance(0.35 + calm*0.35) ? 2 : 3);
    for (let i = 0; i < swellCount; i++) {
      const t0 = tBarStart + rnd() * (music.bar * 0.60);
      const dur = lerp(music.beat*1.8, music.beat*3.8, rnd()) * (night ? 1.25 : 1.0);
      const vel = (0.030 + 0.040*calm) * (night ? 0.78 : 1.0);
      const voices = pick([4,5,5,6]); // richer

      for (let v = 0; v < voices; v++) {
        const midi = chordMidis[v % chordMidis.length] + (v >= 3 ? 12 : 0) + (chance(0.20) ? 12 : 0);
        const hz = midiToHz(clampMidi(midi));
        const type = chance(0.55) ? "sine" : "triangle";
        const pan = lerp(-0.55, 0.55, rnd());
        makeVoice({ type, freq: hz, when: t0, dur, vel: vel/voices, bus: busPad, detune: lerp(-7,7,rnd()), cutoff: cutoff*0.95, pan });
      }
    }

    // ARP: dense when energetic, sparse at night
    const arpDensity = clamp((music.motif?.arp ?? 0.70) * (0.22 + energy*0.75), 0.10, 0.95) * (night ? 0.55 : 1.0);
    const steps = pick([8, 12, 16]);
    const stepDur = music.bar / steps;

    // build arp pattern: chord tones + passing scale tones
    const arpPattern = [];
    for (let i = 0; i < steps; i++) {
      const base = chordMidis[i % chordMidis.length] + (chance(0.40) ? 12 : 0) + (chance(0.12) ? 24 : 0);
      arpPattern.push(clampMidi(base));
    }

    for (let i = 0; i < steps; i++) {
      if (!chance(arpDensity)) continue;
      const t = tBarStart + i * stepDur + (chance(0.50) ? stepDur * lerp(0.02,0.12,rnd()) : 0);
      const midi = arpPattern[i] + (chance(0.18) ? pick([-2,2,3,-3]) : 0);
      const hz = midiToHz(clampMidi(midi));
      const dur = stepDur * lerp(0.55, 0.95, rnd());
      const vel = (0.030 + 0.050*energy) * (night ? 0.72 : 1.0);
      makeVoice({ type: chance(0.65) ? "triangle" : "sine", freq: hz, when: t, dur, vel, bus: busArp, detune: lerp(-5,5,rnd()), cutoff, pan: lerp(-0.35,0.35,rnd()) });
    }

    // MELODY: motif-based contour (avoids monotone)
    const dens = (music.motif?.dens ?? 0.50);
    const phraseChance = clamp((0.18 + energy*0.55) * dens, 0.10, 0.70) * (night ? 0.60 : 1.0);
    const phrases = chance(phraseChance) ? 1 : (chance(phraseChance*0.45) ? 2 : 0);

    // current melody anchor
    if (music._melMidi == null) music._melMidi = clampMidi(68 + Math.floor(lerp(-6,6,rnd())));
    if (music._melIdx == null) music._melIdx = 0;

    for (let p = 0; p < phrases; p++) {
      let t = tBarStart + rnd() * (music.bar * 0.60);
      const phraseLen = pick([4,5,6,7]);
      for (let n = 0; n < phraseLen; n++) {
        const step = music.motif.steps[music._melIdx % music.motif.steps.length];
        music._melIdx++;

        let midi = music._melMidi + step + (chance(0.18) ? pick([-2,2,3,-3]) : 0);
        // snap to scale (simple)
        midi = snapToScale(midi, music.keyMidi, scale);
        midi = clampMidi(midi);
        music._melMidi = midi;

        const hz = midiToHz(midi);
        const dur = lerp(music.beat*0.30, music.beat*0.85, rnd()) * (night ? 1.18 : 1.0);
        const vel = (0.034 + 0.030*calm + 0.018*energy) * (night ? 0.72 : 1.0);

        const type = ((genreSel && genreSel.value) === "classical") ? "sine" : (chance(0.65) ? "triangle" : "sine");
        makeVoice({ type, freq: hz, when: t, dur, vel, bus: busMel, detune: lerp(-3,3,rnd()), cutoff: cutoff*0.98, pan: lerp(-0.18,0.18,rnd()) });

        // counter-melody: occasional soft response
        if (!night && chance(0.22 + calm*0.20)) {
          const hz2 = midiToHz(clampMidi(midi + pick([7,12,-5,5])));
          makeVoice({ type: "sine", freq: hz2, when: t + lerp(0.03,0.10,rnd()), dur: dur*0.85, vel: vel*0.55, bus: busCtr, detune: lerp(-2,2,rnd()), cutoff: cutoff*0.9, pan: lerp(-0.25,0.25,rnd()) });
        }

        t += lerp(music.beat*0.25, music.beat*0.75, rnd());
        if (t > tBarStart + music.bar*0.95) break;
      }
    }

    // BASS: soft, non-drone
    if (chance(night ? 0.35 : (0.45 + energy*0.28))) {
      const t0 = tBarStart + (chance(0.65) ? 0 : music.beat * pick([1,2]));
      const bassMidi = clampMidi(rootMidi - 12 - (chance(0.25) ? 12 : 0));
      makeVoice({ type: "sine", freq: midiToHz(bassMidi), when: t0, dur: music.beat*lerp(1.2,2.4,rnd()), vel: (0.032 + 0.040*energy)*(night?0.70:1.0), bus: busBass, cutoff: 2200, pan: lerp(-0.12,0.12,rnd()) });
    }

    // PERC: light, breathable (no annoying tick)
    const percDensity = clamp(0.06 + energy*0.55 + rainN*0.25, 0.05, 0.92) * (night ? 0.55 : 1.0);
    const subSteps = 16;
    const subDur = music.bar / subSteps;

    for (let i = 0; i < subSteps; i++) {
      const tt = tBarStart + i * subDur;
      if (chance(percDensity * 0.55)) {
        const vel = (0.012 + 0.030*percDensity) * (1 - fogN*0.35);
        noiseHit(tt, subDur*0.55, vel, lerp(2400, 1600, fogN), lerp(-0.6,0.6,rnd()));
      }
      if (chance(percDensity * (night ? 0.08 : 0.16)) && (i === 0 || i === 8 || chance(0.10))) {
        kick(tt, (night ? 0.055 : 0.085) + 0.05*energy);
      }
    }

    // occasional cadence sparkle (prevents sameness)
    if (chance(0.10)) {
      const tCad = tBarStart + music.bar * lerp(0.62, 0.92, rnd());
      const cadMidi = clampMidi(rootMidi + pick([7,12,-5]));
      makeVoice({ type:"sine", freq:midiToHz(cadMidi), when:tCad, dur:music.beat*0.45, vel:(night?0.012:0.016), bus: busArp, cutoff: 5200, pan: lerp(-0.25,0.25,rnd()) });
    }
  }

  function snapToScale(midi, keyMidi, scale) {
    const pc = ((midi - keyMidi) % 12 + 12) % 12;
    let best = scale[0], bestDist = 999;
    for (const s of scale) {
      const d = Math.abs(pc - s);
      const dist = Math.min(d, 12 - d);
      if (dist < bestDist) { bestDist = dist; best = s; }
    }
    let delta = (best - pc);
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    return midi + delta;
  }

  function audioScheduler() {
    if (!audioOn || !audioCtx || !music.ready) return;
    const now = audioCtx.currentTime;
    while (music.nextTime < now + music.lookAhead) {
      scheduleBar(music.nextTime);
      music.nextTime += music.bar;
    }
  }

  async function enableAudio() {
    if (audioOn) return;
    audioOn = true;
    setAudioButton();

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    master = audioCtx.createGain();
    master.gain.value = 0.0001;

    // gentle limiter chain
    comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 24;
    comp.ratio.value = 3.6;
    comp.attack.value = 0.01;
    comp.release.value = 0.20;

    limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 0;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.08;

    lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 9000;
    lp.Q.value = 0.8;

    reverb = audioCtx.createConvolver();
    reverb.buffer = makeImpulse(audioCtx, 2.6, 3.0);
    wet = audioCtx.createGain();
    dry = audioCtx.createGain();
    wet.gain.value = 0.30;
    dry.gain.value = 0.92;

    busPad  = audioCtx.createGain();  busPad.gain.value  = 0.72;
    busArp  = audioCtx.createGain();  busArp.gain.value  = 0.70;
    busMel  = audioCtx.createGain();  busMel.gain.value  = 0.82;
    busCtr  = audioCtx.createGain();  busCtr.gain.value  = 0.62;
    busBass = audioCtx.createGain();  busBass.gain.value = 0.68;
    busPerc = audioCtx.createGain();  busPerc.gain.value = 0.58;

    const buses = [busPad, busArp, busMel, busCtr, busBass, busPerc];
    for (const b of buses) {
      b.connect(dry);
      b.connect(wet);
    }

    wet.connect(reverb);
    reverb.connect(lp);
    dry.connect(lp);

    lp.connect(comp);
    comp.connect(limiter);
    limiter.connect(master);
    master.connect(audioCtx.destination);

    // resume
    if (audioCtx.state === "suspended") {
      try { await audioCtx.resume(); } catch {}
    }

    // tiny chirp to ensure audio unlock (very short)
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = 660;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + 0.01;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.02, t0 + 0.02);
      g.gain.setTargetAtTime(0.0001, t0 + 0.06, 0.02);
      o.start(t0);
      o.stop(t0 + 0.12);
    } catch {}

    music.reset();
    updateAudioTimbreAndGain();
  }

  async function disableAudio() {
    if (!audioOn) return;
    audioOn = false;
    setAudioButton();
    try {
      if (audioCtx && audioCtx.state !== "closed") {
        master.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.04);
        setTimeout(() => { try { audioCtx.close(); } catch {} }, 220);
      }
    } catch {}
    audioCtx = null;
  }

  // audio button + unlock on gestures
  if (btnAudio) {
    btnAudio.addEventListener("click", async () => {
      if (!audioOn) await enableAudio();
      else await disableAudio();
    });
  }
  const unlock = async () => {
    if (!audioCtx) return;
    try { if (audioCtx.state !== "running") await audioCtx.resume(); } catch {}
  };
  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("touchend", unlock, { passive: true });
  document.addEventListener("click", unlock, { passive: true });

  // ---------- Night toggle -> refresh timbre ----------
  if (toggleNight) {
    toggleNight.addEventListener("change", () => {
      music.forceNewSection = true;
      updateConsoleValues();
    });
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function loop(ms) {
    const dt = clamp((ms - last) / 1000, 0, 0.05);
    last = ms;

    step(dt, ms);
    draw(ms);
    audioScheduler();

    requestAnimationFrame(loop);
  }

  // ---------- Start ----------
  // Show picker at boot
  if (modePicker) showPicker();
  else canvas.style.pointerEvents = "auto";

  // If you want to auto-enter last mode after a few seconds, remove this (we keep picker)
  // hidePicker();

  requestAnimationFrame(loop);
})();
