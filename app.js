// DIAGNOSTIC app.js — MUST show something if loaded

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// kill the gate visually (so you can see the canvas)
const gate = document.getElementById("gate");
if (gate) gate.style.display = "none";

// big visible draw
let t0 = performance.now();

function loop(t) {
  const W = window.innerWidth;
  const H = window.innerHeight;

  // background
  ctx.fillStyle = "rgb(20,30,40)";
  ctx.fillRect(0, 0, W, H);

  // BIG text
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 48px Arial";
  ctx.fillText("JS OK ✅", 40, 80);

  ctx.font = "20px Arial";
  ctx.fillText("If you see this, app.js is loaded correctly.", 40, 120);

  // draw many circles (VERY visible)
  const time = (t - t0) / 1000;
  for (let i = 0; i < 99; i++) {
    const x = (W * 0.1) + (i % 11) * (W * 0.08);
    const y = (H * 0.25) + Math.floor(i / 11) * (H * 0.06);
    const r = 10 + (i % 7) * 2;

    ctx.strokeStyle = `hsla(${(i * 12 + time * 60) % 360}, 80%, 60%, 0.95)`;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x + Math.sin(time + i) * 8, y + Math.cos(time + i) * 8, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
