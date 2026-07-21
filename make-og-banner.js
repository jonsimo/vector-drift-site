// Build tool (not shipped): emits og-banner.html using the EXACT ASCII glyphs
// from logo-reveal.js so the share banner always matches the live boot logo.
// Rendered to og-image.png by headless Chrome, then this + the html are removed.
const fs = require("fs");

const src = fs.readFileSync("logo-reveal.js", "utf8");
const m = src.match(/const ASCII = (\{.*?\});/s);
if (!m) { throw new Error("ASCII block not found in logo-reveal.js"); }
const ASCII = JSON.parse(m[1]);

const VECTOR = ASCII.bold.VECTOR;
const DRIFT = ASCII.bold.DRIFT;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="vd-font.css">
<style>
  :root{
    --phos:#11cab8; --hot:#aef9e6;
    --glow:0 0 2px rgba(17,202,184,0.82), 0 0 8px rgba(17,202,184,0.36), 0 0 16px rgba(17,202,184,0.12);
  }
  html,body{margin:0;padding:0;}
  body{
    width:1200px; height:630px; overflow:hidden;
    background:
      radial-gradient(120% 90% at 50% 42%, #061a15 0%, #040d0b 55%, #020504 100%);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    font-family:"VD Logo Mono","DejaVu Sans Mono","Menlo","Consolas","Courier New",monospace;
  }
  .logo{ display:flex; flex-direction:column; align-items:center; gap:10px; }
  pre{
    margin:0; color:var(--phos); text-shadow:var(--glow);
    font-family:inherit; line-height:1.0; letter-spacing:0;
    white-space:pre; font-size:19px;
  }
  .drift{ font-size:23px; }
  .tag{
    margin-top:30px; color:var(--hot); text-shadow:var(--glow);
    font-family:"Glass TTY VT220","Courier New",monospace;
    font-size:22px; letter-spacing:0.42em; padding-left:0.42em;
    text-transform:uppercase; opacity:0.92;
  }
  .url{
    margin-top:12px; color:var(--phos); text-shadow:var(--glow);
    font-family:"Glass TTY VT220","Courier New",monospace;
    font-size:17px; letter-spacing:0.32em; padding-left:0.32em; opacity:0.70;
  }
  /* faint scanlines to match the CRT look */
  .scan{position:fixed; inset:0; pointer-events:none;
    background:repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,0.16) 2px 3px);
    mix-blend-mode:multiply;}
</style>
</head>
<body>
  <div class="logo">
    <pre class="vector">${esc(VECTOR)}</pre>
    <pre class="drift">${esc(DRIFT)}</pre>
  </div>
  <div class="tag">Retro Vector Space Shooter</div>
  <div class="url">vectordrift.io</div>
  <div class="scan"></div>
</body>
</html>`;

fs.writeFileSync("og-banner.html", html);
console.log("og-banner.html written (VECTOR", VECTOR.split("\\n").length, "rows / DRIFT", DRIFT.split("\\n").length, "rows)");
