/* Vector Drift — scratch logo-reveal beta.
   Ported verbatim from vector_drift_ascii/vector_drift_boot.html (Option 1: filled DRIFT).
   Exposes window.runLogoReveal(). Isolated — no edits to the live site. */
(function () {
"use strict";
const GLYPHS = "!<>-_\\/[]{}=+*^?#%$&@01:;~".split("");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SOUND = false;
const beep = () => {};
let MODE = "raster", WEIGHT = "bold", curPanels = null, runId = 0;
let logo = null, vec = null, dft = null;

/* ---- data + engine (verbatim from Option 1 demo) ---- */
const ASCII = {"bold": {"VECTOR": "\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \n\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\n\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551        \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\n\u255a\u2588\u2588\u2557 \u2588\u2588\u2554\u255d\u2588\u2588\u2554\u2550\u2550\u255d  \u2588\u2588\u2551        \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\n \u255a\u2588\u2588\u2588\u2588\u2554\u255d \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551  \u2588\u2588\u2551\n  \u255a\u2550\u2550\u2550\u255d  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d   \u255a\u2550\u255d    \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d  \u255a\u2550\u255d", "DRIFT": "\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\n\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\n\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557     \u2588\u2588\u2551   \n\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255d     \u2588\u2588\u2551   \n\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551        \u2588\u2588\u2551   \n\u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d\u255a\u2550\u255d        \u255a\u2550\u255d   "}, "thin": {"VECTOR": "\u2588\u2588    \u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588  \n\u2588\u2588    \u2588\u2588 \u2588\u2588      \u2588\u2588         \u2588\u2588    \u2588\u2588    \u2588\u2588 \u2588\u2588   \u2588\u2588 \n\u2588\u2588    \u2588\u2588 \u2588\u2588\u2588\u2588\u2588   \u2588\u2588         \u2588\u2588    \u2588\u2588    \u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588  \n \u2588\u2588  \u2588\u2588  \u2588\u2588      \u2588\u2588         \u2588\u2588    \u2588\u2588    \u2588\u2588 \u2588\u2588   \u2588\u2588 \n  \u2588\u2588\u2588\u2588   \u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588    \u2588\u2588     \u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588   \u2588\u2588 ", "DRIFT": "\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 \n\u2588\u2588   \u2588\u2588 \u2588\u2588   \u2588\u2588 \u2588\u2588 \u2588\u2588         \u2588\u2588    \n\u2588\u2588   \u2588\u2588 \u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588 \u2588\u2588\u2588\u2588\u2588      \u2588\u2588    \n\u2588\u2588   \u2588\u2588 \u2588\u2588   \u2588\u2588 \u2588\u2588 \u2588\u2588         \u2588\u2588    \n\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588   \u2588\u2588 \u2588\u2588 \u2588\u2588         \u2588\u2588    "}};
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function buildGrid(word){ let lines=ASCII[WEIGHT][word].split("\n");
  while(lines.length && lines[lines.length-1].trim()==="") lines.pop();
  const w=Math.max.apply(null,lines.map(l=>l.length)); lines=lines.map(l=>l+" ".repeat(w-l.length));
  return {lines,w,h:lines.length}; }
function schedule(cells,off){
  if(MODE==="raster"){ const rg=137,cg=8.6,gb=274; cells.forEach(c=>{c.showAt=off+c.r*rg;c.lockAt=c.showAt+c.c*cg+gb;}); } /* ~44% slower than demo (25% + another 15%) */
  else if(MODE==="decode"){ const sp=1400; cells.forEach(c=>{c.showAt=off;c.lockAt=off+200+Math.random()*sp;}); }
  else { const cg=15,gb=150; cells.forEach(c=>{c.showAt=off+c.c*cg;c.lockAt=c.showAt+gb;}); }
}
function makePanel(el,word,off){ const {lines,w,h}=buildGrid(word); const cells=[];
  for(let r=0;r<h;r++)for(let c=0;c<w;c++){ const ch=lines[r][c]; if(ch===" ") continue; cells.push({r,c,ch,showAt:0,lockAt:0}); }
  schedule(cells,off); return {el,lines,w,h,cells}; }
function renderPanel(p,t){
  const grid=[],cls=[]; for(let r=0;r<p.h;r++){grid.push(new Array(p.w).fill(" "));cls.push(new Array(p.w).fill(0));}
  let all=true;
  for(const c of p.cells){ if(t<c.showAt){ all=false; continue; }
    if(t<c.lockAt){ const gi=(((t/50)|0)*37+c.r*13+c.c*7)%GLYPHS.length; grid[c.r][c.c]=GLYPHS[(gi+GLYPHS.length)%GLYPHS.length]; cls[c.r][c.c]=1; all=false; }
    else { grid[c.r][c.c]=c.ch; cls[c.r][c.c]=(t-c.lockAt<120)?2:0; } }
  let html=""; for(let r=0;r<p.h;r++){ for(let c=0;c<p.w;c++){ const e=esc(grid[r][c]),k=cls[r][c];
    if(k===1) html+="<span class='g'>"+e+"</span>"; else if(k===2) html+="<span class='hot'>"+e+"</span>"; else html+=e; }
    if(r<p.h-1) html+="\n"; } p.el.innerHTML=html; return all;
}
let CHAR_RATIO=0.6;
function measureRatio(){ const s=document.createElement("span");
  s.style.cssText='position:absolute;visibility:hidden;white-space:pre;font-size:200px;font-family:"VD Logo Mono","DejaVu Sans Mono","Courier New",monospace;';
  s.textContent="0000000000"; document.body.appendChild(s); const w=s.getBoundingClientRect().width; document.body.removeChild(s); if(w>0) CHAR_RATIO=w/10/200; }
function fitLogo(){ if(!curPanels) return;
  const stage=document.getElementById("stage");
  // Mobile: fill nearly the full width + a taller allowance + a higher cap so the
  // logo makes better use of the upper screen. All ratios of clientWidth/Height,
  // so it scales across phone sizes/resolutions. Desktop unchanged.
  const mobile = window.innerWidth <= 600;
  const availW=stage.clientWidth*(mobile?1.0:0.9), availH=Math.max(150,stage.clientHeight*(mobile?0.5:0.46));
  const trial=20; document.documentElement.style.setProperty("--lf",trial+"px");
  // Measure against the FINAL glyphs, not the mid-reveal grid of spaces (whose
  // advance width underestimates and inflates --lf, clipping narrow screens).
  for(const p of curPanels) renderPanel(p,1e9);
  const dr=document.getElementById("driftrow");
  const w=Math.max(vec.scrollWidth, dr.scrollWidth)*(mobile?1.05:1.1);
  const h=logo.scrollHeight*1.03;
  let lf=Math.min(trial*availW/w, trial*availH/h);
  document.documentElement.style.setProperty("--lf",Math.max(4,Math.min(mobile?48:30,lf))+"px"); }
function finalizeLogo(){ if(curPanels) for(const p of curPanels) renderPanel(p,1e9); }
function reveal(id){ logo.style.opacity="1";
  const vP=makePanel(vec,"VECTOR",0);
  const dOff=MODE==="raster"?vP.h*137+201:(MODE==="wipe"?200:240);
  const dP=makePanel(dft,"DRIFT",dOff);
  curPanels=[vP,dP]; renderPanel(vP,0); renderPanel(dP,0); fitLogo();
  requestAnimationFrame(()=>{ if(id===runId) logo.classList.add("reveal"); });
  const t0=performance.now();
  return new Promise(res=>{ (function frame(){ if(id!==runId) return res();
    const t=performance.now()-t0; let done=true;
    for(const p of curPanels){ if(!renderPanel(p,t)) done=false; }
    if(SOUND && Math.random()<0.06) beep(1200+Math.random()*600,0.02,0.02,"square");
    if(!done) requestAnimationFrame(frame); else { finalizeLogo(); res(); } })(); });
}

/* ---- scratch wrapper: render the logo as a top banner in the console flow ---- */
const OUT = () => document.getElementById("terminal-output");

// Logo write-on SFX — two options for A/B: ?writeon=1 (default) or ?writeon=2.
// No completion flash sound (removed). Audio is unlocked by now (the user pressed
// keys for the connect + continue gates).
const writeOnChoice = new URLSearchParams(location.search).get("writeon") === "1" ? "1" : "2";
const writeOnSfx = new Audio("assets/vector_drift_logo_write_on_" + writeOnChoice + ".wav");
writeOnSfx.volume = 0.5;
function playSfx(a) { try { a.currentTime = 0; a.play().catch(function () {}); } catch (e) {} }
function stopSfx(a) { try { a.pause(); a.currentTime = 0; } catch (e) {} }

// A static gauge line (used for the LOAD COMPLETE notice).
function gaugeLine(host, text) {
  const el = document.createElement("div");
  el.className = "vd-gauge-line";
  el.textContent = text;
  host.appendChild(el);
  const out = OUT(); if (out) out.scrollTop = out.scrollHeight;
}

// A retro ASCII load gauge that fills 0 -> 100% over totalMs. Pure ASCII (# / -)
// so every column stays monospace-aligned (no block-glyph font fallback).
async function gaugeBar(host, file, totalMs) {
  const W = 20, N = 12;
  const el = document.createElement("div");
  el.className = "vd-gauge-line";
  host.appendChild(el);
  const item = (file + "            ").slice(0, 12);   // pad items to 12 -> columns align
  for (let i = 1; i <= N; i++) {
    const p = (i === N) ? 1 : Math.max(0, Math.min(0.96, i / N + (Math.random() - 0.5) * 0.18));
    const fl = Math.round(p * W);
    const bar = "#".repeat(fl) + "-".repeat(W - fl);
    el.textContent = "LOADING:/ " + item + "  [" + bar + "]  " + String(Math.round(p * 100)).padStart(3) + "%";
    const out = OUT(); if (out) out.scrollTop = out.scrollHeight;
    await sleep(totalMs / N);
  }
}

// End-of-boot loading gauges (<=2250ms total), rendered into the boot output.
window.renderBootGauges = async function () {
  const out = OUT();
  if (!out) return;
  if (window.__vdSkip) return;   // 3-Enter skip: no gauges
  const host = document.createElement("div");
  host.className = "vd-loading";
  out.appendChild(host);
  const files = ["VDRENDER.SYS", "VDSCOPE.COM", "COMBAT.MOD", "LATTICE.BIN"];
  const perBar = 500;   // 4 x 500 = 2000ms + LOAD COMPLETE < 2250ms total
  for (const f of files) { await gaugeBar(host, f, perBar); }
  gaugeLine(host, "LOAD COMPLETE - VECTOR TABLE DECODED");
  const o = OUT(); if (o) o.scrollTop = o.scrollHeight;
  if (new URLSearchParams(location.search).has("gaugehold")) { await sleep(3600000); } // dev: freeze on gauges
};

function buildBanner(driftMode) {
  const b = document.createElement("div");
  b.className = "vd-banner" + (driftMode === "outline" ? " drift-outline" : "");
  b.innerHTML =
    '<div id="stage"><div id="logo"><pre id="vec"></pre>' +
    '<div id="driftrow"><div id="speed"><i></i><i></i><i></i><i></i></div>' +
    '<pre id="dft"></pre></div></div></div>' +
    '<div class="vd-meta"><span class="vd-version"></span><hr class="vd-divider"></div>';
  return b;
}

// Scramble->lock reveal for a single text line, using the SAME GLYPHS engine as
// the VECTOR DRIFT words: every char scrambles, then locks left-to-right; each
// char flashes .hot for a beat as it settles (matches the logo's glitch style).
function glitchText(el, text, opts) {
  opts = opts || {};
  const perChar = opts.perChar || 20;    // stagger between chars locking
  const scramble = opts.scramble || 240; // how long each char scrambles first
  if (opts.noAnim) { el.textContent = text; return Promise.resolve(); }
  const chars = text.split("");
  const t0 = performance.now();
  const rg = (t, i) => { const gi = (((t / 50) | 0) * 37 + i * 13) % GLYPHS.length; return GLYPHS[(gi + GLYPHS.length) % GLYPHS.length]; };
  return new Promise((res) => {
    (function frame() {
      const t = performance.now() - t0;
      let done = true, html = "";
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === " ") { html += " "; continue; }
        const lockAt = i * perChar + scramble;
        if (t < lockAt) { html += "<span class='g'>" + esc(rg(t, i)) + "</span>"; done = false; }
        else if (t - lockAt < 120) { html += "<span class='hot'>" + esc(ch) + "</span>"; }
        else { html += esc(ch); }
      }
      el.innerHTML = html;
      if (!done) requestAnimationFrame(frame); else res();
    })();
  });
}

// Reveal the speed lines with the SAME scramble->lock language as the logo words:
// each bar flickers random width/opacity + glitch-cyan (the "scramble"), then locks
// bright (hot) and settles to phosphor. All lock (nearly) together -> uniform
// brightness, no per-line variance. Caller times this to the DRIFT panel finishing.
function runSpeedGlitch(bars, id) {
  if (!bars || !bars.length) return;
  var start = performance.now();
  var SCRAMBLE = 300;          // ms of flicker before a bar locks
  var STEP = 28;               // tiny per-bar cascade
  var lockFull = function (b) {
    b.style.opacity = "1"; b.style.transform = "scaleX(1)";
    b.style.background = "var(--phos)"; b.style.filter = "brightness(1)";
  };
  (function frame() {
    if (id !== runId) return;                     // superseded (re-run / skip) -> stop
    var t = performance.now() - start;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], lockAt = SCRAMBLE + i * STEP;
      if (t < lockAt) {                            // scramble
        b.style.opacity = (0.25 + Math.random() * 0.7).toFixed(2);
        b.style.transform = "scaleX(" + (0.12 + Math.random() * 0.9).toFixed(2) + ")";
        b.style.background = Math.random() < 0.5 ? "var(--glitch)" : "var(--phos)";
        b.style.filter = "brightness(" + (1 + Math.random() * 0.5).toFixed(2) + ")";
      } else if (t < lockAt + 100) {               // lock flash (hot)
        b.style.opacity = "1"; b.style.transform = "scaleX(1)";
        b.style.background = "var(--hot)"; b.style.filter = "brightness(1.7)";
      } else { lockFull(b); }                       // settled (uniform)
    }
    if (t <= SCRAMBLE + bars.length * STEP + 110) requestAnimationFrame(frame);
    else for (var j = 0; j < bars.length; j++) lockFull(bars[j]);
  })();
}

// Cuts to the VECTOR DRIFT logo: clears the boot/gauges, then reveals the logo
// as a banner at the TOP of the output (prompt is reordered below via .vd-console
// so typing scrolls the banner off top). No gauges, no prompt here.
window.renderLogoBanner = async function (opts) {
  opts = opts || {};
  const out = OUT();
  if (!out) return;
  out.innerHTML = "";                 // CUT: clear the boot text + gauges
  document.body.classList.add("vd-banner-active");
  const content = document.querySelector(".terminal-content");
  if (content) content.classList.add("vd-console");
  const driftMode = (new URLSearchParams(location.search).get("drift") || "outline").toLowerCase();

  const banner = buildBanner(driftMode);
  out.insertBefore(banner, out.firstChild);
  logo = banner.querySelector("#logo");
  vec = banner.querySelector("#vec");
  dft = banner.querySelector("#dft");
  const metaEl = banner.querySelector(".vd-meta");

  // Wait for the logo's display font — TIMEOUT-GUARDED so a slow/stuck font load
  // can never hang the banner (that was the "cuts to blank prompt" bug).
  if (document.fonts && document.fonts.load) {
    try {
      await Promise.race([
        document.fonts.load('1em "VD Logo Mono"').then(function () { return document.fonts.ready; }),
        sleep(1200),
      ]);
    } catch (e) {}
  }
  try { measureRatio(); } catch (e) {}

  // 2) Reveal the logo (engine timing is already 25% slower than the demo).
  const id = ++runId;
  const params = new URLSearchParams(location.search);
  const noAnim = window.__vdSkip || params.has("noanim") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  logo.style.opacity = "1";
  setTimeout(function () { playSfx(writeOnSfx); }, 150);   // write-on, delayed 150ms
  const bars = Array.prototype.slice.call(banner.querySelectorAll("#speed i"));
  const lockBars = function () {
    bars.forEach(function (b) { b.style.opacity = "1"; b.style.transform = "scaleX(1)"; b.style.background = "var(--phos)"; b.style.filter = "brightness(1)"; });
  };
  const showStatic = function () {
    const vP = makePanel(vec, "VECTOR", 0), dP = makePanel(dft, "DRIFT", 0);
    curPanels = [vP, dP];
    renderPanel(vP, 1e9); renderPanel(dP, 1e9); fitLogo(); logo.classList.add("reveal");
    lockBars();
  };
  try {
    if (noAnim) {
      showStatic();
    } else {
      // Fire the speed-line scramble so it LOCKS as the DRIFT panel finishes
      // (~2.25s into the reveal); the ~0.3s scramble runs just before that.
      setTimeout(function () { runSpeedGlitch(bars, id); }, 1950);
      await Promise.race([reveal(id), sleep(5600)]);
      if (curPanels) { for (const p of curPanels) renderPanel(p, 1e9); }
      else { showStatic(); }
    }
  } catch (e) {
    showStatic();   // any failure -> the logo still shows
  }

  // 3) Version glitches in (same style as the words); divider fades in beneath it.
  await sleep(300);
  if (metaEl) metaEl.classList.add("show");
  const verEl = banner.querySelector(".vd-version");
  if (verEl) await glitchText(verEl, "vector_drift.sim v0.9.3 alpha build", { noAnim, perChar: 24, scramble: 320 });
  const out2 = OUT(); if (out2) out2.scrollTop = out2.scrollHeight;
};

// Back-compat alias: the earlier boot called window.runLogoReveal.
window.runLogoReveal = window.renderLogoBanner;

/* Live A/B toggle chip: flips DRIFT fill (Option 1 solid <-> Option 2 outline)
   by reloading with ?drift=. Inert dev affordance; not part of the reveal. */
function mountDriftToggle() {
  // Dev-only A/B chip: never shown on the live site.
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  if (document.getElementById("vd-drift-toggle")) return;
  const p = new URLSearchParams(location.search);
  const cur = (p.get("drift") || "outline").toLowerCase() === "outline" ? "outline" : "solid";
  const next = cur === "outline" ? "solid" : "outline";
  const chip = document.createElement("button");
  chip.id = "vd-drift-toggle";
  chip.textContent = "DRIFT: " + cur.toUpperCase() + "  ▸ " + next.toUpperCase();
  chip.style.cssText =
    "position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:200;" +
    "font:12px/1 monospace;letter-spacing:1px;color:#11cab8;background:rgba(17,202,184,0.06);" +
    "border:1px solid rgba(17,202,184,0.4);border-radius:3px;padding:7px 13px;cursor:pointer;" +
    "text-shadow:0 0 6px rgba(17,202,184,0.6);";
  chip.addEventListener("click", () => { p.set("drift", next); location.search = p.toString(); });
  document.body.appendChild(chip);
}
/* Dev-only A/B chip for the two write-on SFX options (?writeon=1|2). */
function mountWriteOnToggle() {
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  if (document.getElementById("vd-writeon-toggle")) return;
  const p = new URLSearchParams(location.search);
  const cur = p.get("writeon") === "2" ? "2" : "1";
  const next = cur === "2" ? "1" : "2";
  const chip = document.createElement("button");
  chip.id = "vd-writeon-toggle";
  chip.textContent = "WRITE-ON SFX: " + cur + "  ▸ " + next;
  chip.style.cssText =
    "position:fixed;bottom:44px;left:50%;transform:translateX(-50%);z-index:200;" +
    "font:12px/1 monospace;letter-spacing:1px;color:#11cab8;background:rgba(17,202,184,0.06);" +
    "border:1px solid rgba(17,202,184,0.4);border-radius:3px;padding:7px 13px;cursor:pointer;" +
    "text-shadow:0 0 6px rgba(17,202,184,0.6);";
  chip.addEventListener("click", () => { p.set("writeon", next); location.search = p.toString(); });
  document.body.appendChild(chip);
}
// Subtle noise-dither overlay to break up gradient/glow banding on the dark bg.
function mountDither() {
  if (document.getElementById("vd-dither")) return;
  const d = document.createElement("div");
  d.id = "vd-dither";
  document.body.appendChild(d);
}
function onReady() { mountDither(); }   // A/B chips removed (choices locked)
if (document.body) onReady();
else document.addEventListener("DOMContentLoaded", onReady);
})();
