// === SAFE RESET app.js ===
// This version MUST show circles and play sound if loaded correctly

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ---------- Resize ----------
function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---------- Circles ----------
const N = 99;
const circles = [];

for (let i = 0; i < N; i++) {
  circles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 6 + Math.random() * 16,
    a: Math.random() * Math.PI * 2,
    s: 0.5 + Math.random() * 1.5,
    h: Math.random() * 360
  });
}

// ---------- Audio ----------
let audioCtx = null;
let osc = [];

const btnAudio = document.getElementById("btn-audio");
if (btnAudio) {
  btnAudio.onclick = () => {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const gain = audioCtx.createGain();
    gain.gain.value = 0.05;
    gain.connect(audioCtx.destination);

    // simple chord (C minor)
    [261.6, 311.1, 392.0].forEach(f => {
      const o = audioCtx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      osc.push(o);
    });

    btnAudio.textContent = "Audio ON";
  };
}

// ---------- Loop ----------
let last = performance.now();

function loop(t) {
  const dt = (t - last) / 1000;
  last = t;

  // background
  ctx.fillStyle = "rgb(20,30,45)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // draw circles
  ctx.lineWidth = 3;

  for (const c of circles) {
    c.a += dt * c.s;

    c.x += Math.cos(c.a) * 20 * dt;
    c.y += Math.sin(c.a) * 20 * dt;

    if (c.x < 0) c.x = window.innerWidth;
    if (c.x > window.innerWidth) c.x = 0;
    if (c.y < 0) c.y = window.innerHeight;
    if (c.y > window.innerHeight) c.y = 0;

    ctx.strokeStyle = `hsl(${c.h},80%,60%)`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // debug text
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.fillText("π Weather Circles — SAFE MODE",
