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
  if(MODE==="raster"){ const rg=119,cg=7.5,gb=238; cells.forEach(c=>{c.showAt=off+c.r*rg;c.lockAt=c.showAt+c.c*cg+gb;}); } /* 25% slower than demo */
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
  const availW=stage.clientWidth*0.9, availH=Math.max(150,stage.clientHeight*0.46);
  const trial=20; document.documentElement.style.setProperty("--lf",trial+"px");
  // Measure against the FINAL glyphs, not the mid-reveal grid of spaces (whose
  // advance width underestimates and inflates --lf, clipping narrow screens).
  for(const p of curPanels) renderPanel(p,1e9);
  const dr=document.getElementById("driftrow");
  const w=Math.max(vec.scrollWidth, dr.scrollWidth)*1.1;
  const h=logo.scrollHeight*1.03;
  let lf=Math.min(trial*availW/w, trial*availH/h);
  document.documentElement.style.setProperty("--lf",Math.max(4,Math.min(30,lf))+"px"); }
function finalizeLogo(){ if(curPanels) for(const p of curPanels) renderPanel(p,1e9);
  logo.classList.add("flash"); setTimeout(()=>logo.classList.remove("flash"),520); }
function reveal(id){ logo.style.opacity="1";
  const vP=makePanel(vec,"VECTOR",0);
  const dOff=MODE==="raster"?vP.h*119+175:(MODE==="wipe"?200:240);
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

// Logo SFX: shimmer during the reveal, flash on completion. (Audio is unlocked
// by then — the user pressed keys for the connect + continue gates.)
const shimmerSfx = new Audio("assets/vd_logo_shimmer_on.wav");
const flashSfx = new Audio("assets/vd_logo_flash.wav");
shimmerSfx.volume = 0.5;
flashSfx.volume = 0.5;
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

// A file-read progress gauge that fills 0 -> 100% over totalMs (demo style).
async function gaugeBar(host, file, totalMs) {
  const W = 24, N = 12;
  const el = document.createElement("div");
  el.className = "vd-gauge-line";
  host.appendChild(el);
  const label = "READING A: " + (file + "            ").slice(0, 12);
  for (let i = 1; i <= N; i++) {
    const p = (i === N) ? 1 : Math.max(0, Math.min(0.96, i / N + (Math.random() - 0.5) * 0.18));
    const fl = Math.round(p * W);
    el.textContent = label + " [" + "█".repeat(fl) + "░".repeat(W - fl) + "] " + String(Math.round(p * 100)).padStart(3) + "%";
    const out = OUT(); if (out) out.scrollTop = out.scrollHeight;
    await sleep(totalMs / N);
  }
}

// End-of-boot loading gauges (<=2250ms total), rendered into the boot output.
window.renderBootGauges = async function () {
  const out = OUT();
  if (!out) return;
  const host = document.createElement("div");
  host.className = "vd-loading";
  out.appendChild(host);
  const files = ["VDRENDER.SYS", "VDSCOPE.COM", "COMBAT.MOD", "LATTICE.BIN"];
  const perBar = 500;   // 4 x 500 = 2000ms + LOAD COMPLETE < 2250ms total
  for (const f of files) { await gaugeBar(host, f, perBar); }
  gaugeLine(host, "LOAD COMPLETE — DECODING VECTOR TABLE");
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
    '<div class="vd-meta"><span class="vd-version">vector_drift.sim v0.9.3 alpha build</span><hr class="vd-divider"></div>';
  return b;
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
  const noAnim = params.has("noanim") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  logo.style.opacity = "1";
  playSfx(shimmerSfx);   // shimmer-on sound as the logo animates in
  const shimmerStop = setTimeout(function () { stopSfx(shimmerSfx); }, 1800);
  const showStatic = function () {
    const vP = makePanel(vec, "VECTOR", 0), dP = makePanel(dft, "DRIFT", 0);
    curPanels = [vP, dP];
    renderPanel(vP, 1e9); renderPanel(dP, 1e9); fitLogo(); logo.classList.add("reveal");
  };
  try {
    if (noAnim) {
      showStatic();
    } else {
      await Promise.race([reveal(id), sleep(5600)]);
      if (curPanels) { for (const p of curPanels) renderPanel(p, 1e9); }
      else { showStatic(); }
    }
  } catch (e) {
    showStatic();   // any failure -> the logo still shows
  }
  clearTimeout(shimmerStop);
  stopSfx(shimmerSfx);   // shimmer never overruns the logo completion
  playSfx(flashSfx);     // flash sound on logo completion

  // 3) Version + divider fade in beneath the logo.
  await sleep(300);
  if (metaEl) metaEl.classList.add("show");
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
if (document.body) mountDriftToggle();
else document.addEventListener("DOMContentLoaded", mountDriftToggle);
})();
