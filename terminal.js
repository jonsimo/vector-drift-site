const output = document.getElementById("terminal-output");
const status = document.getElementById("terminal-status");
const terminalHeader = document.querySelector(".terminal-header");
const form = document.getElementById("terminal-form");
const input = document.getElementById("terminal-input");
const cursor = document.querySelector(".block-cursor");
const promptPrefix = document.querySelector(".prompt-prefix");
const commandText = document.getElementById("terminal-command");
const inputShell = document.querySelector(".input-shell");

let bootStarted = false;
let bootActive = false;   // true during the boot; gates the 3-Enter skip
let bootSkip = false;     // 3 quick Enters -> fast-cut to logo + prompt
let mobileLive = null;
let terminalState = "booting";
let activeTransfer = null;
let fallbackDownload = null;
let commandHistory = [];
let historyCursor = 0;
let axiomUseCount = 0;
let sudoUseCount = 0;

// Intent layer (terminal-intents.js, loaded before this script). Pure, DOM-free:
// it owns normalization, the intent registry, command resolution, session state,
// and response *selection*; this file interprets the returned step data.
const VDI = window.VDIntents;
const session = VDI.createSession();
const SNAKE_CMDS = new Set([
  "snake", "snake.exe", "snake game",
  "play snake", "play snake.exe", "run snake", "run snake.exe",
]);
const PI_CMDS = new Set([
  "pi", "pi.exe", "pie", "pi me", "count pi", "give me pi",
  "play pi", "play pi.exe", "run pi", "run pi.exe",
]);
// Hands off to the alpha tracker on its own subdomain.
const ALPHA_URL = "https://alpha.vectordrift.io";
const ALPHA_CMDS = new Set([
  "alpha", "alpha.exe", "alpha tracker", "alpha tracker beta", "alpha tracker.exe",
  "alpha_tracker", "alpha_tracker.exe", "alphatracker", "alphatracker.exe",
  "tracker", "tracker.exe",
  "run alpha", "run alpha tracker", "run alpha tracker.exe",
  "run alpha_tracker", "run alpha_tracker.exe", "run tracker",
  "open alpha", "open alpha tracker", "open alpha_tracker", "open tracker",
  "launch alpha", "launch alpha tracker", "play alpha tracker",
]);
// Destructive-root easter egg: these open a sudo password prompt. Correct code
// (axiom) "wipes" the system and drops the visitor on a Web 1.0 404 page.
const NUKE_CMDS = new Set([
  "delete root", "rm root", "rm -rf root", "rm -rf /", "rm -rf /root", "rm /root",
  "delete /root", "delete the root", "delete root directory", "remove root",
  "sudo rm -rf /", "sudo rm -rf root", "sudo delete root", "format root",
  "destroy root", "wipe root", "delete system", "delete everything",
]);
// Email uplink is now command-triggered (no auto-offer). Any of these opens it.
const UPLINK_CMDS = new Set([
  "email", "email.exe", "email me", "email list", "email list.exe", "emaillist",
  "run email list.exe", "run email.exe", "run email list", "run emaillist.exe",
  "signup", "sign up", "sign me up", "email signup", "sign up.exe",
  "subscribe", "subscribe.exe", "newsletter", "mailing list",
  "join", "join beta", "join alpha", "join list", "join the list",
  "join alpha list", "join beta list", "join the alpha", "join the beta",
  "alpha list", "beta list",
]);
const rng = Math.random;
// True while a response sequence is running; blocks a second submit so async
// sequences can never overlap. Input stays editable, only Enter is a no-op.
let responseActive = false;

// Hidden operator/debug console (terminal-debug.js, loaded before this script).
// Optional — every use is guarded so the site still works if it is absent.
const DEBUG = typeof window !== "undefined" ? window.VDDebug : null;
// Wall-clock of the last player response, surfaced by the debug timing inspector.
let lastResponseMs = 0;

const locateCommand = "find /opt -iname 'vector_drift' $>/dev/null";
const loadCommand = "load /opt/unknown/vectordrift.sim";
const finalPrompt = "console>vector_drift:/root";
const initialCursorCycleMs = 815;
// List endpoint (newest-first), NOT /releases/latest — /latest skips prereleases,
// and the alpha builds are published as prereleases. resolveLatestPackage() takes
// the newest non-draft entry, so a prerelease alpha is served automatically.
const releasesApiUrl = "https://api.github.com/repos/jonsimo/codex-jr-downloads/releases?per_page=20";
const releasesPageUrl = "https://github.com/jonsimo/codex-jr-downloads/releases";
// CORS proxy for the release asset. GitHub's asset host sends no
// Access-Control-Allow-Origin, so the browser cannot stream the bytes directly;
// the Worker in worker/dl-proxy.js re-streams them with CORS. Set this to the
// deployed Worker URL (workers.dev or dl.vectordrift.io). If empty or
// unreachable, the fetch falls back to the native browser handoff below.
const packageProxyUrl = "https://vd-dl-proxy.codexjr.workers.dev/";
// Key verification goes through the same Worker: the gatekeeper deliberately
// sends no CORS headers, so the browser cannot call it directly. The Worker
// talks to it server-side and relays the answer.
const keyCheckUrl = packageProxyUrl.replace(/\/*$/, "/") + "check";

// The gatekeeper wants the platform the DOWNLOAD is for. Detection is only the
// default -- someone on a Mac fetching the Windows build is a normal thing to do.
// Callers pass detectTarget()'s answer. The bare detectPlatform() fallback cannot tell an Apple
// Silicon Mac from an Intel one (see macGpuArch) and is kept only so a missing argument still
// yields an OS.
function gatekeeperPlatform(target) {
  const t = target || detectPlatform();
  if (t.os === "Windows") return "windows-x86_64";
  if (t.os === "macOS") return t.arch === "arm64" ? "darwin-arm64" : "darwin-x86_64";
  return "";
}

// Resolves { status, data }. Throws ONLY when the server could not be asked --
// a network error, a timeout or a 503. Callers must render that as "could not
// reach", never as a denial: collapsing the two turns a Cloudflare blip into
// every tester believing their key is dead.
async function checkDownloadKey(key, platform) {
  let response;
  try {
    response = await fetch(keyCheckUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key, platform: platform }),
      cache: "no-store",
    });
  } catch (error) {
    throw Object.assign(new Error("unreachable"), { unreachable: true });
  }
  let data = null;
  try { data = await response.json(); } catch (error) { data = null; }
  if (response.status === 503 || (data && data.error === "unreachable")) {
    throw Object.assign(new Error("unreachable"), { unreachable: true });
  }
  return { status: response.status, data: data || {} };
}
const barWidth = 28;

const loaderStatuses = [
  "io>loader/ acquiring execution context",
  "io>loader/ resolving vector programmetry . . .",
  "io>loader/ loading vector programmetry . . .",
  "io>loader/ resolving missing interface",
  "io>loader/ vector programmetry loaded",
];

// Dev knobs (no effect in normal use):
//   ?speed=0.2    fast-forward every delay (0.05-1)
//   ?scene=glitch render only the Axiom glitch on sample lines, then stop
const bootParams = new URLSearchParams(location.search);
const timeScale = Math.min(1, Math.max(0.05, parseFloat(bootParams.get("speed")) || 1));
// Dev: ?auto skips the connect/continue gates so a headless render can advance.
const autoAdvance = bootParams.has("auto");
let mobileMode = false;
// Beat between the key press and the first boot text: the gate message clears and
// a bare cursor blinks (~2 blinks) while the power-on sfx plays, so the boot does
// not slam in on top of the press. NOTE: this pushes the glitch arrival later, so
// it is paired with mainAudioDelayMs below to keep the glitch synced -- change
// both together (arrival grows ~1:1 with this).
const mainBootLeadMs = 700;
// The console beep plays, then the root prompt appears this much later so the
// prompt lands on the beep rather than before it.
const consoleBeepLeadMs = 250;
// Onset of the glitch-sound burst WITHIN main_boot_sequence (ms from the track's
// own t=0). Re-measure whenever the boot track is swapped -- high-freq (>3.5kHz)
// peak jumps ~-34dB -> ~-11dB:
//   main_boot_sequence_v3 = 13.56s   main_boot_sequence_v5 = 13.21s (current)
const mainAudioGlitchMs = 13210;
// The main track starts this long AFTER the key press. The typed boot needs
// ~13.4s+ of real wall-clock to REACH the glitch beat, but v5's glitch sits at
// 13.21s, so an undelayed track glitches before the visuals arrive (sfx sounds
// early). Delaying the track pushes its glitch past the visual arrival. Safe
// either way: if the visuals arrive first, waitUntilFromAudio just pads the
// pre-glitch stillness -- it never desyncs. Initial ambience covers the lead-in.
const mainAudioDelayMs = 1400;
// Absolute time (ms from the key press) the VISUAL glitch is anchored to, so it
// fires exactly on the audio glitch burst every run. Desktop delays the track by
// mainAudioDelayMs; mobile plays it immediately (iOS can't delay a media element
// reliably), so the mobile boot init lowers this to the track's own onset.
let glitchAudioMs = mainAudioGlitchMs + mainAudioDelayMs;
let bootAudioT0 = 0;

function sleep(ms) {
  if (bootSkip) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms * timeScale));
}

// 3 quick Enter presses during the boot -> fast-cut to the logo + prompt.
let bootEnterStamps = [];
function triggerBootSkip() {
  if (bootSkip) return;
  bootSkip = true;
  window.__vdSkip = true;
  if (bootAudio) { try { bootAudio.main.pause(); bootAudio.initial.pause(); } catch (e) {} }
  if (window.stopLogoSfx) window.stopLogoSfx();   // silence the logo write-on too
}
// The 3-Enter skip fast-forwards the BOOT only. sleep() short-circuits while
// bootSkip is set, so leaving it on made every later flow -- the download
// readout, snake, pi -- dump instantly with no pacing. Cleared once the console
// is live; the boot itself has already finished by then, so the skip stays instant.
function endBootSkip() {
  bootSkip = false;
  window.__vdSkip = false;
}

function bootEnterWatch(e) {
  if (!bootActive || bootSkip || e.key !== "Enter") return;
  const now = performance.now();
  bootEnterStamps.push(now);
  bootEnterStamps = bootEnterStamps.filter((t) => now - t < 900);
  if (bootEnterStamps.length >= 3) triggerBootSkip();
}
window.addEventListener("keydown", bootEnterWatch, true);
// Dev: ?bootskip triggers the skip shortly after load (headless test of the path).
if (bootParams.has("bootskip")) {
  window.addEventListener("load", function () { setTimeout(triggerBootSkip, 150); });
}

// Wait until `targetMs` (from audio start) has elapsed. Scales with timeScale so
// dev fast-forward still works; a no-op if the audio clock isn't set.
function waitUntilFromAudio(targetMs) {
  if (bootSkip || !bootAudioT0) {
    return Promise.resolve();
  }
  const remaining = bootAudioT0 + targetMs * timeScale - performance.now();
  if (remaining <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => window.setTimeout(resolve, remaining));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// --- Synthesized SFX ---------------------------------------------------------
// Audio can only start after a user gesture, so initAudio() runs from the
// connect gate. Until then every cue is a no-op.
let audioCtx = null;
let noiseBuffer = null;
let sfxEnabled = false;
const sfxVolume = 0.625;

function resumeAudio() {
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

// Return a copy of `buffer` shortened by the crossfade length, with the original
// tail equal-power-blended over the head. Looping the result is seamless: the new
// end sample is continuous with the new start, so there's no click/hard cut.
function makeSeamlessLoop(buffer, fadeSec) {
  try {
    const sr = buffer.sampleRate;
    const fade = Math.max(1, Math.min(Math.floor(fadeSec * sr), Math.floor(buffer.length / 2)));
    const newLen = buffer.length - fade;
    if (newLen <= fade) return buffer;   // too short to fold — leave as-is
    const out = audioCtx.createBuffer(buffer.numberOfChannels, newLen, sr);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      // Body after the crossfade region copies straight through.
      for (let i = fade; i < newLen; i++) dst[i] = src[i];
      // Seam: blend incoming head (src[0..fade)) with the outgoing tail (src[newLen..]).
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        const fin = Math.sin(t * Math.PI / 2);   // head fades in
        const fout = Math.cos(t * Math.PI / 2);  // tail fades out
        dst[i] = src[i] * fin + src[newLen + i] * fout;
      }
    }
    return out;
  } catch (e) {
    return buffer;
  }
}

function initAudio() {
  if (audioCtx) {
    resumeAudio();
    return;
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  sfxEnabled = true;
  resumeAudio();
  // iOS: play a 1-sample silent buffer inside the gesture to fully wake the
  // context. resume() alone can leave Safari's context effectively muted.
  try {
    const wake = audioCtx.createBufferSource();
    wake.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    wake.connect(audioCtx.destination);
    wake.start(0);
  } catch (e) {}

  // Decode the hum for a gapless Web Audio loop (ready before the main track ends).
  // Bake an equal-power crossfade into the loop seam so end->start is smooth even
  // if the source file isn't a perfect zero-crossing loop (that seam was the hard cut).
  if (!humBuffer) {
    fetch(humUrl)
      .then((response) => response.arrayBuffer())
      .then((data) => audioCtx.decodeAudioData(data))
      .then((decoded) => { humBuffer = makeSeamlessLoop(decoded, 0.45); })
      .catch(() => {});
  }
}

function sfxNoiseHit({ freq, q = 1, type = "bandpass", dur = 0.012, gain = 0.5, rate = 1, lp = 0 }) {
  if (!sfxEnabled) {
    return;
  }
  const t = audioCtx.currentTime;
  const n = audioCtx.createBufferSource();
  n.buffer = noiseBuffer;
  n.playbackRate.value = rate * randomBetween(0.95, 1.05);
  const f = audioCtx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq * randomBetween(0.96, 1.04);
  f.Q.value = q;
  let node = n.connect(f);
  if (lp) {
    const l = audioCtx.createBiquadFilter();
    l.type = "lowpass";
    l.frequency.value = lp;
    node = node.connect(l);
  }
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gain * sfxVolume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g).connect(audioCtx.destination);
  n.start(t);
  n.stop(t + dur + 0.02);
}

function sfxTone({ freq, type = "triangle", dur = 0.05, gain = 0.25, to = 0 }) {
  if (!sfxEnabled) {
    return;
  }
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq * randomBetween(0.97, 1.03), t);
  if (to) {
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
  }
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(gain * sfxVolume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Chosen cues.
function sfxKey() {
  // vt220 soft type-on (lowered 40% from 0.5/0.17)
  sfxNoiseHit({ freq: 1100, q: 0.7, type: "lowpass", dur: 0.013, gain: 0.3, lp: 1500 });
  sfxTone({ freq: 175, dur: 0.028, gain: 0.102 });
}

// --- Boot music/ambience (real mp3 tracks) -----------------------------------
// initial -> (no key) hum loop; key press -> main sequence -> hum loop.
let bootAudio = null;
let linkEstablished = false;
const humUrl = "assets/computer_hum_looping_v5.mp3";
let humBuffer = null;
let humSource = null;
let humGain = null;
let humBedStarted = false;
// Main boot track routed through Web Audio (like the hum) so the main->hum
// crossfade automates gain sample-accurately on BOTH sides -- no HTMLAudio
// .volume lag/quantization, which was the audible dip at the handoff.
let mainSource = null;
let mainGain = null;

function stopHum() {
  if (humSource) {
    try {
      humSource.stop();
    } catch (error) {
      // already stopped
    }
    humSource = null;
  }
  humGain = null;
  if (bootAudio) {
    bootAudio.hum.pause();
  }
}

const HUM_VOLUME = 0.5;
function startHum(startVol) {
  const vol = startVol === undefined ? HUM_VOLUME : startVol;
  // Gapless sample-accurate loop via Web Audio when the buffer is decoded;
  // HTMLAudio (which has an mp3 loop gap) is only the pre-gesture fallback.
  if (audioCtx && humBuffer) {
    stopHum();
    humSource = audioCtx.createBufferSource();
    humSource.buffer = humBuffer;
    humSource.loop = true;
    humGain = audioCtx.createGain();
    humGain.gain.value = vol;
    humSource.connect(humGain).connect(audioCtx.destination);
    humSource.start();
  } else if (bootAudio) {
    bootAudio.hum.volume = vol;
    bootAudio.hum.play().catch(() => {});
  }
}

function setHumVolume(v) {
  v = Math.max(0, Math.min(1, v));
  if (humGain) { try { humGain.gain.value = v; } catch (e) {} }
  else if (bootAudio) { try { bootAudio.hum.volume = v; } catch (e) {} }
}

// Route the main track through the Web Audio graph once (element -> gain ->
// destination) so its level can be automated sample-accurately during the hum
// crossfade. createMediaElementSource runs once per element and needs the
// context, so it is lazy; on any failure we fall back to HTMLAudio .volume.
function ensureMainRouted() {
  // On mobile (iOS especially) the AudioContext can lag resuming; routing the
  // main track through it risks silence. Keep main as plain HTMLAudio there, so
  // it plays reliably once unlocked; beginHumBed uses the .volume crossfade.
  if (!audioCtx || !bootAudio || mainSource || mobileMode) return;
  try {
    mainGain = audioCtx.createGain();
    mainGain.gain.value = 1;
    mainSource = audioCtx.createMediaElementSource(bootAudio.main);
    mainSource.connect(mainGain).connect(audioCtx.destination);
  } catch (e) {
    mainSource = null;
    mainGain = null;
  }
}

// Crossfade the main boot track into the hum bed (or just fade the hum in if the
// track already ended). Runs once per boot so the two never step on each other.
function beginHumBed(durationMs) {
  if (humBedStarted) return;
  humBedStarted = true;
  durationMs = durationMs || 2500;
  if (!bootAudio) { startHum(HUM_VOLUME); return; }
  const main = bootAudio.main;
  const HALF_PI = Math.PI / 2;

  // Preferred: both sides in Web Audio -> one sample-accurate equal-power
  // crossfade (out=cos, in=sin; their squares sum to 1 so loudness holds flat).
  if (audioCtx && humBuffer && mainGain) {
    startHum(0);   // fresh hum source at gain 0
    const t0 = audioCtx.currentTime;
    const dur = Math.max(0.05, durationMs / 1000);
    const N = 64;
    const outCurve = new Float32Array(N);
    const inCurve = new Float32Array(N);
    for (let k = 0; k < N; k += 1) {
      const t = k / (N - 1);
      outCurve[k] = Math.cos(t * HALF_PI);               // main gain 1 -> 0
      inCurve[k] = HUM_VOLUME * Math.sin(t * HALF_PI);    // hum gain 0 -> HUM_VOLUME
    }
    try { mainGain.gain.cancelScheduledValues(t0); mainGain.gain.setValueCurveAtTime(outCurve, t0, dur); } catch (e) {}
    try { humGain.gain.cancelScheduledValues(t0); humGain.gain.setValueCurveAtTime(inCurve, t0, dur); } catch (e) {}
    window.setTimeout(() => {
      try { main.pause(); } catch (e) {}
      try { if (humGain) humGain.gain.value = HUM_VOLUME; } catch (e) {}
    }, durationMs + 40);
    return;
  }

  // Fallback: main only has HTMLAudio .volume (routing unavailable). Stepped fade.
  const fadingMain = main && !main.paused && !main.ended && main.volume > 0;
  const mainStart = fadingMain ? main.volume : 0;
  startHum(0);
  const steps = 60, dt = durationMs / steps;
  let i = 0;
  const timer = window.setInterval(() => {
    i += 1;
    const t = i / steps;
    if (fadingMain) { try { main.volume = Math.max(0, mainStart * Math.cos(t * HALF_PI)); } catch (e) {} }
    setHumVolume(HUM_VOLUME * Math.sin(t * HALF_PI));
    if (i >= steps) {
      window.clearInterval(timer);
      if (fadingMain) { try { main.pause(); main.volume = mainStart; } catch (e) {} }
      setHumVolume(HUM_VOLUME);
    }
  }, dt);
}

function setupBootAudio() {
  if (bootAudio || autoAdvance) {
    return;
  }
  const initial = new Audio("assets/initial_boot_sound.mp3");
  const hum = new Audio(humUrl);
  const main = new Audio("assets/main_boot_sequence_v5.mp3");
  const beep = new Audio("assets/console_beep_v2.mp3");
  hum.loop = true;
  initial.volume = 0.75;
  hum.volume = 0.5;
  main.volume = 0.85;
  beep.volume = 0.6;
  initial.addEventListener("ended", () => {
    if (!linkEstablished) {
      startHum();
    }
  });
  // If the main track ends before the console-ready crossfade fires, there is no
  // track left to fade against -> ramp the hum up FAST so there's no dead-air gap.
  // (When console-ready wins first, it pauses main so this never runs.)
  main.addEventListener("ended", () => beginHumBed(600));
  bootAudio = { initial, hum, main, beep };
}

function playConsoleBeep() {
  if (!bootAudio) {
    return;
  }
  // Play a clone rather than the single shared element: reusing one <audio> is
  // unreliable when it is already playing or stalled, and play() fails silently.
  try {
    const beep = bootAudio.beep.cloneNode();
    beep.volume = bootAudio.beep.volume;
    beep.play().catch(() => {});
  } catch (error) {
    bootAudio.beep.currentTime = 0;
    bootAudio.beep.play().catch(() => {});
  }
}

function playInitialAmbience() {
  if (!bootAudio) {
    return;
  }
  // Best-effort: may be blocked until a gesture, in which case it stays silent
  // and the key press (a gesture) starts the main sequence instead.
  bootAudio.initial.play().catch(() => {});
}

// iOS/Safari only lets a media element play outside a user gesture if it has
// already played inside one. Elements that play later (main after a delay, the
// console beep) are unlocked here by playing them muted for an instant inside the
// current tap/press, then resetting.
function unlockMediaElement(el) {
  if (!el) return;
  try {
    const wasMuted = el.muted;
    el.muted = true;
    const p = el.play();
    const reset = () => { try { el.pause(); el.currentTime = 0; el.muted = wasMuted; } catch (e) {} };
    if (p && typeof p.then === "function") { p.then(reset).catch(() => { try { el.muted = wasMuted; } catch (e) {} }); }
    else { reset(); }
  } catch (e) {}
}

function establishLinkAudio() {
  if (!bootAudio) {
    return;
  }
  linkEstablished = true;
  humBedStarted = false;
  stopHum();
  resumeAudio();   // iOS: the AudioContext starts suspended; resume in-gesture
  const initial = bootAudio.initial;
  const main = bootAudio.main;

  if (mobileMode) {
    // iOS will NOT reliably start a media element on a delay, nor unmute one
    // later. So on mobile just play the main track immediately in this gesture
    // (the behaviour that worked originally). glitchAudioMs is lowered to the
    // track's own onset for the mobile path (boot init), so the glitch stays
    // aligned with no lead. Reliability over the power-on lead here.
    try { main.currentTime = 0; } catch (e) {}
    main.play().catch(() => {});
    return;
  }

  // Desktop: power-on sfx on the press, then the main track after the lead so its
  // glitch cue lands on glitchAudioMs. Routed through Web Audio for a clean hum
  // crossfade. Desktop allows a deferred play(), so no iOS workarounds are needed.
  ensureMainRouted();
  try { initial.currentTime = 0; } catch (e) {}
  initial.play().catch(() => {});
  main.currentTime = 0;
  window.setTimeout(() => {
    try { initial.pause(); } catch (e) {}
    try { main.currentTime = 0; } catch (e) {}
    main.play().catch(() => {});
  }, mainAudioDelayMs);
}
function sfxFast() {
  // noise zip
  sfxNoiseHit({ freq: 2600, q: 3, dur: 0.03, gain: 0.22, rate: 1.4 });
}
function sfxEnter() {
  // return clunk
  sfxNoiseHit({ freq: 700, q: 0.7, dur: 0.02, gain: 0.5, lp: 1400 });
  sfxTone({ freq: 110, dur: 0.07, gain: 0.34, to: 70 });
}

function setPhosphorText(element, text) {
  element.replaceChildren();

  const lines = text.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (let index = 0; index < line.length; index += 4) {
      const block = document.createElement("span");
      const seed = line.charCodeAt(index) + index + lineIndex;
      block.className = `phosphor-block phosphor-block-${seed % 5}`;
      block.textContent = line.slice(index, index + 4);
      element.appendChild(block);
    }

    if (lineIndex < lines.length - 1) {
      element.appendChild(document.createElement("br"));
    }
  }
}

function renderStatusLines(lines, cursorLine = -1) {
  status.replaceChildren();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (let index = 0; index < line.length; index += 4) {
      const block = document.createElement("span");
      const seed = line.charCodeAt(index) + index + lineIndex;
      block.className = `phosphor-block phosphor-block-${seed % 5}`;
      block.textContent = line.slice(index, index + 4);
      status.appendChild(block);
    }

    if (lineIndex === cursorLine) {
      const bootCursor = document.createElement("span");
      bootCursor.className = "inline-cursor";
      status.appendChild(bootCursor);
    }

    if (lineIndex < lines.length - 1) {
      status.appendChild(document.createElement("br"));
    }
  }
}

function scrambleText(text) {
  const glyphs = "!@#$%^&*+=?/\\|~<>[]{}:;";

  return [...text].map((character, index) => {
    if (character === " ") {
      return " ";
    }

    return glyphs[(character.charCodeAt(0) + index * 7) % glyphs.length];
  }).join("");
}

function appendLine(text, className = "") {
  const line = document.createElement("div");
  line.className = `output-line ${className}`.trim();
  setPhosphorText(line, text);
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
  output.scrollLeft = 0;
  return line;
}

function appendRawLine(className = "") {
  const line = document.createElement("div");
  line.className = `output-line ${className}`.trim();
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
  output.scrollLeft = 0;
  return line;
}

function appendCommandLine(command, prefixText) {
  const line = appendRawLine("command prompt-history");
  const commandPart = document.createElement("span");
  commandPart.textContent = ` ${command}`;
  if (prefixText) {
    // Custom prompt (e.g. the "enter email >" uplink stage) echoes on its own line.
    const p = document.createElement("span");
    p.className = "prompt-console";
    p.textContent = prefixText;
    line.append(p, commandPart);
    return line;
  }
  const consolePart = document.createElement("span");
  consolePart.className = "prompt-console";
  consolePart.textContent = "console>";
  const pathPart = document.createElement("span");
  pathPart.className = "prompt-path";
  pathPart.textContent = "vector_drift:/root";
  line.append(consolePart, pathPart, commandPart);
  return line;
}

function appendResponse(text, className = "terminal-response") {
  return appendLine(text, className);
}

// --- Mobile flowing prompt ---------------------------------------------------
// The live input line sits at the end of the output flow and moves down as
// commands are entered, anchored around 2/3 of the way down the screen.
function scrollMobileToPrompt(line) {
  const target = line.offsetTop - output.clientHeight * 0.66;
  output.scrollTop = Math.max(0, target);
}

function appendMobilePrompt(prefixText) {
  const line = appendRawLine("output-line mobile-prompt");
  const prefix = document.createElement("span");
  prefix.className = "prompt-root";
  prefix.textContent = prefixText;
  const sep = document.createElement("span");
  sep.className = "mobile-sep";
  sep.textContent = " ";
  line.append(prefix, sep, inputShell);
  mobileLive = { line };
  updateCursor();
  scrollMobileToPrompt(line);
  return line;
}

function freezeMobilePrompt(commandValue) {
  if (!mobileLive) {
    return;
  }
  const line = mobileLive.line;
  line.classList.remove("mobile-prompt");
  line.classList.add("mobile-prompt-done");
  if (inputShell.parentNode === line) {
    line.removeChild(inputShell);
  }
  const done = document.createElement("span");
  done.textContent = commandValue;
  line.appendChild(done);
  mobileLive = null;
}

function setPromptPrefix() {
  promptPrefix.replaceChildren();
  const consolePart = document.createElement("span");
  consolePart.className = "prompt-console";
  consolePart.textContent = "console>";
  const pathPart = document.createElement("span");
  pathPart.className = "prompt-path";
  pathPart.textContent = "vector_drift:/root";
  promptPrefix.append(consolePart, pathPart);
}

// Desktop prompt switch for the operator channel. Reuses the same renderer/DOM;
// "console" restores the normal player prompt. No effect on the mobile flow,
// whose prefix text is passed to appendMobilePrompt directly.
function setActivePromptPrefix(mode) {
  if (mode === "operator") {
    promptPrefix.replaceChildren();
    const op = document.createElement("span");
    op.className = "prompt-console";
    op.textContent = "operator>";
    promptPrefix.append(op);
    return;
  }
  setPromptPrefix();
}

// Echo a just-submitted command under whichever prompt is active.
function echoActivePrompt(command) {
  if (mobileMode) {
    freezeMobilePrompt(command);
    return;
  }
  if (DEBUG && DEBUG.isActive()) {
    const line = appendRawLine("command prompt-history");
    const op = document.createElement("span");
    op.className = "prompt-console";
    op.textContent = "operator>";
    const commandPart = document.createElement("span");
    commandPart.textContent = ` ${command}`;
    line.append(op, commandPart);
    return;
  }
  appendCommandLine(command);
}

function setTerminalState(nextState) {
  terminalState = nextState;
  const processing = nextState === "executing" || nextState === "downloading";
  form.classList.toggle("processing", processing);
  input.disabled = processing;
}

// During the download access-code gate the input is masked: render asterisks,
// but reveal the just-typed char briefly (like a phone password field) before it
// flips to "*". The real <input> is color:transparent, so masking this span is
// all that shows.
let gateMaskTimer = null;
function renderGateMasked(revealLast) {
  const v = input.value;
  const n = v.length;
  commandText.textContent = !n ? "" : (revealLast ? "*".repeat(n - 1) + v[n - 1] : "*".repeat(n));
}
function updateCommandRender() {
  if (dlGateStage === "code" || nukeStage === "sudo") {
    renderGateMasked(true);
    if (gateMaskTimer) clearTimeout(gateMaskTimer);
    gateMaskTimer = setTimeout(function () {
      if (dlGateStage === "code" || nukeStage === "sudo") renderGateMasked(false);
    }, 550);
    return;
  }
  if (gateMaskTimer) { clearTimeout(gateMaskTimer); gateMaskTimer = null; }
  commandText.textContent = input.value;
}

function updateCursor() {
  updateCommandRender();
}

async function typeCommand(command, characterDelay) {
  input.value = "";
  updateCursor();

  for (const character of command) {
    input.value += character;
    updateCursor();
    await sleep(characterDelay + Math.random() * 18);
  }
}

async function typePromptPrefix(prefix) {
  promptPrefix.textContent = "";

  for (const character of prefix) {
    promptPrefix.textContent += character;
    await sleep(58 + Math.random() * 14);
  }
}

async function typeStatusLine(lines, lineIndex, text, characterDelay) {
  lines[lineIndex] = "";

  for (const character of text) {
    lines[lineIndex] += character;
    setPhosphorText(status, lines.join("\n"));
    await sleep(characterDelay + Math.random() * 16);
  }
}

async function typeStatusLineWithCursor(lines, lineIndex, text, characterDelay) {
  lines[lineIndex] = "";

  for (const character of text) {
    lines[lineIndex] += character;
    renderStatusLines(lines, lineIndex);
    await sleep(characterDelay + Math.random() * 16);
  }
}

async function typeHumanStatusAppend(lines, lineIndex, text, options = {}) {
  const baseDelay = options.baseDelay ?? 64;
  const jitterMin = options.jitterMin ?? -12;
  const jitterMax = options.jitterMax ?? 18;
  const pauses = options.pauses ?? [];

  for (const character of text) {
    lines[lineIndex] += character;
    renderStatusLines(lines, lineIndex);
    if (character !== " ") {
      sfxKey();
    }
    const isFastGlyph = /[/'">\\.:]/.test(character);
    const hesitate = character === " " && Math.random() > 0.68 ? randomBetween(22, 54) : 0;
    await sleep(Math.max(18, baseDelay + randomBetween(jitterMin, jitterMax) - (isFastGlyph ? 12 : 0) + hesitate));
    for (const pause of pauses) {
      if (lines[lineIndex].endsWith(pause.after)) {
        await sleep(randomBetween(pause.min, pause.max));
      }
    }
  }
}

async function runLoaderPreamble() {
  status.hidden = false;
  terminalHeader.classList.remove("status-stack");

  for (let dot = 1; dot <= 3; dot += 1) {
    setPhosphorText(status, `${loaderStatuses[0]}${" .".repeat(dot)}`);
    await sleep(145);
  }

  await sleep(250);
}

function updateLoaderStatus(bootIndex, bootTotal) {
  const progress = bootIndex / Math.max(1, bootTotal - 1);
  const statusIndex = progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2;
  setPhosphorText(status, `${loaderStatuses[statusIndex]} . . .`);
}

async function runCortexInterference(cortexLine) {
  const visibleLines = [...output.querySelectorAll(".output-line")];
  const originalLines = visibleLines
    .filter((line) => line !== cortexLine)
    .map((line) => ({
    line,
    text: line.textContent,
  }));
  const chunkSize = Math.max(1, Math.ceil(originalLines.length / 3));
  const sections = [
    originalLines.slice(0, chunkSize),
    originalLines.slice(chunkSize, chunkSize * 2),
    originalLines.slice(chunkSize * 2),
  ];

  const flicker = (entries, corrupted) => {
    for (const entry of entries) {
      setPhosphorText(entry.line, corrupted ? scrambleText(entry.text) : entry.text);
    }
  };

  const events = [
    [0, 0, true],
    [45, 1, true],
    [90, 2, true],
    [125, 0, false],
    [155, 1, false],
    [185, 2, false],
    [220, 0, true],
    [255, 2, true],
    [290, 1, true],
    [330, 0, false],
    [365, 2, false],
    [400, 1, false],
    [455, 0, true],
    [500, 1, true],
    [545, 2, true],
    [650, 0, false],
    [700, 1, false],
    [750, 2, false],
    [810, 1, true],
    [860, 1, false],
    [900, 0, true],
    [930, 2, true],
    [965, 0, false],
    [1000, 2, false],
  ];

  let elapsed = 0;
  for (const [at, sectionIndex, corrupted] of events) {
    await sleep(Math.max(0, at - elapsed));
    flicker(sections[sectionIndex], corrupted);
    elapsed = at;
  }

  for (const section of sections) {
    flicker(section, false);
  }
}

async function runFinalSequence(line) {
  await sleep(900);
}

async function typeBodyLine(text, characterDelay = 28) {
  const line = appendLine("");

  for (const character of text) {
    line.textContent += character;
    setPhosphorText(line, line.textContent);
    await sleep(characterDelay + Math.random() * 12);
  }

  return line;
}

async function printCommand(text, hold = 36) {
  const line = await typeBodyLine(text, 8);
  await sleep(hold);
  return line;
}

async function printBurst(lines, delay = 70) {
  const printed = [];

  for (const line of lines) {
    printed.push(appendLine(line));
    await sleep(delay);
  }

  return printed;
}

async function printLines(lines, delay = 70) {
  return printBurst(lines, delay);
}

function rewriteLine(line, text) {
  setPhosphorText(line, text);
  output.scrollLeft = 0;
}

function rewriteStatus(text) {
  setPhosphorText(status, text);
}

function corruptText(text, amount = 0.35, shift = 0) {
  const glyphs = "!@#$%^&*+=/\\<>[]{}:;?|";

  return [...text].map((character, index) => {
    if (character === " ") {
      return shift > 0 && index % 17 === 0 ? " ".repeat(1 + (shift % 3)) : character;
    }

    if (Math.random() > amount) {
      return character;
    }

    return glyphs[(character.charCodeAt(0) + index * 11 + shift) % glyphs.length];
  }).join("").slice(0, text.length + 2);
}

async function runScrambleFrame(entries, amount, duration, shift = 0) {
  for (const entry of entries) {
    rewriteLine(entry.line, corruptText(entry.text, amount, shift));
  }
  await sleep(duration);
}

function renderGlitchLine(element, corrupted, embed) {
  if (!embed) {
    setPhosphorText(element, corrupted);
    return;
  }

  // Overlay a readable word into the corruption, rendered in a bright hot span.
  const start = Math.max(0, Math.min(embed.col, corrupted.length - embed.word.length));
  const before = corrupted.slice(0, start);
  const after = corrupted.slice(start + embed.word.length);
  element.replaceChildren();

  if (before) {
    const beforeSpan = document.createElement("span");
    beforeSpan.textContent = before;
    element.appendChild(beforeSpan);
  }

  const hot = document.createElement("span");
  hot.className = "glitch-hot";
  hot.textContent = embed.word;
  element.appendChild(hot);

  if (after) {
    const afterSpan = document.createElement("span");
    afterSpan.textContent = after;
    element.appendChild(afterSpan);
  }
}

function oscillateGlitch(text, frame, positions) {
  if (!positions.length) {
    return text;
  }

  // A small fraction of characters oscillate between a few glyphs (including
  // the original) each frame, giving a broken, unstable feel without churning
  // the whole line.
  const glyphs = "!@#$%^&*+=/\\<>[]{}:;?|";
  const chars = [...text];
  // Slow clock: each unstable char toggles back and forth between its frozen
  // glyph and one alternate every few frames, so it drifts rather than churns.
  const slow = Math.floor(frame / 4);
  for (const pos of positions) {
    const original = text[pos];
    if (original === undefined || original === " ") {
      continue;
    }
    const on = (slow + pos) % 2 === 0;
    chars[pos] = on ? original : glyphs[(text.charCodeAt(pos) + pos) % glyphs.length];
  }
  return chars.join("");
}

function renderHotLine(element, text) {
  // Whole line in the bright hot style, same look as the hidden-message words.
  element.replaceChildren();
  const hot = document.createElement("span");
  hot.className = "glitch-hot";
  hot.textContent = text;
  element.appendChild(hot);
}

async function runAxiomReveal(observerLine, cortexLine, resolvingLine, reveal = {}) {
  const observerText = reveal.observer ?? "vd_observer         PRESENT     0x0000B7A0    axiom          remote observer attached";
  const cortexText = reveal.cortex ?? "vd_cortex           LINKED      0x0000AF10    axiom          organic interface accepted";
  const observerFalse = reveal.observerFalse ?? "vd_observer         MISSING     --------      none           interface unavailable";
  const cortexFalse = reveal.cortexFalse ?? "vd_cortex           WAIT        0x0000AF10    unassigned     organic bridge detected";
  const resolvingFalse = reveal.resolvingFalse ?? "io>loader/ resolving missing interface ... unresolved";

  // Snapshot every visible line, then split the block into 3 contiguous chunks.
  const visible = [...output.querySelectorAll(".output-line")].slice(-22);
  const snapshot = visible.map((line) => ({ line, text: line.textContent }));
  const size = Math.ceil(snapshot.length / 3);
  const chunks = [
    snapshot.slice(0, size),
    snapshot.slice(size, size * 2),
    snapshot.slice(size * 2),
  ].filter((chunk) => chunk.length);

  const glitchChunk = (chunk, amount, shift) => {
    for (const entry of chunk) {
      rewriteLine(entry.line, corruptText(entry.text, amount, shift));
    }
  };
  const clearChunk = (chunk) => {
    for (const entry of chunk) {
      rewriteLine(entry.line, entry.text);
    }
  };

  // Hidden message, one word per line, spread evenly across separate lines so
  // it glows through the static corruption without ever being fully spelled out
  // on a single row. Never lands on the reveal lines.
  const revealSet = new Set([observerLine, cortexLine, resolvingLine]);
  const hiddenWords = ["YOU", "ARE", "BEING", "WATCHED"];
  // Vertical spots spread top-to-bottom; columns scatter left/right so the
  // message is distributed across the whole section, not stacked.
  const wordSpots = [0.12, 0.4, 0.62, 0.86];
  const wordCols = [10, 46, 24, 62];
  const candidates = snapshot.filter(
    (entry) => !revealSet.has(entry.line) && entry.text.trim().length > 14,
  );
  const embeds = new Map();
  hiddenWords.forEach((word, i) => {
    if (!candidates.length) {
      return;
    }
    const spot = Math.floor(wordSpots[i] * candidates.length);
    const pick = candidates[Math.min(spot, candidates.length - 1)];
    if (pick && !embeds.has(pick.line)) {
      const col = Math.min(wordCols[i], Math.max(0, pick.text.length - word.length - 2));
      embeds.set(pick.line, { word, col });
    }
  });

  // Phase 1 - the 3 chunks flicker glitch, staggered so all three churn.
  const flicker = [
    [0, 0.45], [1, 0.5], [2, 0.55],
    [0, 0], [1, 0.6], [2, 0],
    [1, 0], [0, 0.55], [2, 0.62],
    [0, 0], [2, 0], [1, 0],
  ];
  for (let i = 0; i < flicker.length; i += 1) {
    const [chunkIndex, amount] = flicker[i];
    const chunk = chunks[chunkIndex];
    if (!chunk) {
      continue;
    }
    if (amount > 0) {
      glitchChunk(chunk, amount, i + 1);
    } else {
      clearChunk(chunk);
    }
    await sleep(randomBetween(55, 85));
  }

  // Phase 2 - a mostly-frozen corrupted frame. A small fraction of characters
  // oscillate so it has a broken, unstable feel without churning.
  const frozen = new Map();
  const unstable = new Map();
  chunks.forEach((chunk, index) => {
    for (const entry of chunk) {
      const corrupted = corruptText(entry.text, 0.6, index + 5);
      frozen.set(entry.line, corrupted);
      const positions = [];
      for (let i = 0; i < corrupted.length; i += 1) {
        if (corrupted[i] !== " " && Math.random() < 0.05) {
          positions.push(i);
        }
      }
      unstable.set(entry.line, positions);
      setPhosphorText(entry.line, corrupted);
    }
  });

  // The hidden message flickers in one word at a time against that frame. Active
  // words keep stuttering (small flicker) so they feel alive, then flicker out
  // in the same order.
  const activeWords = new Map();
  let frame = 0;
  const renderFrame = () => {
    frame += 1;
    for (const entry of snapshot) {
      const base = oscillateGlitch(frozen.get(entry.line), frame, unstable.get(entry.line) || []);
      const embed = activeWords.get(entry.line);
      if (embed && Math.random() > 0.28) {
        renderGlitchLine(entry.line, base, embed);
      } else {
        setPhosphorText(entry.line, base);
      }
    }
  };
  const liveSleep = async (ms) => {
    let elapsed = 0;
    while (elapsed < ms) {
      const step = Math.min(55, ms - elapsed);
      await sleep(step);
      renderFrame();
      elapsed += step;
    }
  };

  await liveSleep(220);
  const wordOrder = [...embeds.entries()];
  for (const [line, embed] of wordOrder) {
    activeWords.set(line, embed);
    await liveSleep(randomBetween(110, 150));
  }
  await liveSleep(randomBetween(160, 220));
  for (const [line] of wordOrder) {
    activeWords.delete(line);
    await liveSleep(randomBetween(100, 140));
  }
  await liveSleep(150);

  // Phase 3 - the axiom lines flicker bright (same hot look as the hidden
  // message) against the still-glitched field: the axiom line first, then the
  // line below it, then everything returns to normal.
  const flashLine = async (line, text) => {
    // Flicker on.
    const inSeq = [true, false, true];
    for (let i = 0; i < inSeq.length; i += 1) {
      if (inSeq[i]) {
        renderHotLine(line, text);
      } else {
        rewriteLine(line, corruptText(text, 0.6, i + 12));
      }
      await sleep(randomBetween(48, 78));
    }
    // Subtle-flicker hold ~500ms: mostly bright readable, occasional light dip.
    let elapsed = 0;
    while (elapsed < 500) {
      const step = randomBetween(46, 70);
      if (Math.random() < 0.22) {
        rewriteLine(line, corruptText(text, 0.3, 30));
      } else {
        renderHotLine(line, text);
      }
      await sleep(step);
      elapsed += step;
    }
    // Flicker back out, then leave it glitched; Phase 4 returns to normal.
    const outSeq = [false, true];
    for (let i = 0; i < outSeq.length; i += 1) {
      if (outSeq[i]) {
        renderHotLine(line, text);
      } else {
        rewriteLine(line, corruptText(text, 0.55, i + 20));
      }
      await sleep(randomBetween(42, 60));
    }
    rewriteLine(line, corruptText(text, 0.5, 21));
  };

  await flashLine(observerLine, observerText);
  await flashLine(cortexLine, cortexText);
  await sleep(120);

  // Phase 4 - the 3 chunks flicker back out, then settle to the false-normal.
  const flickerOut = [[2, 0.5], [0, 0.5], [1, 0.55], [2, 0], [0, 0], [1, 0]];
  for (let i = 0; i < flickerOut.length; i += 1) {
    const [chunkIndex, amount] = flickerOut[i];
    const chunk = chunks[chunkIndex];
    if (!chunk) {
      continue;
    }
    if (amount > 0) {
      glitchChunk(chunk, amount, i + 9);
    } else {
      clearChunk(chunk);
    }
    await sleep(randomBetween(24, 40));
  }

  // The reveal lines snap to the false-normal (hidden) state.
  rewriteLine(observerLine, observerFalse);
  rewriteLine(cortexLine, cortexFalse);
  rewriteLine(resolvingLine, resolvingFalse);
  await sleep(60);

  const mismatchLine = appendLine(reveal.mismatchDetected ?? "io>loader/ integrity mismatch detected");
  await sleep(150);
  rewriteLine(mismatchLine, reveal.mismatchIgnored ?? "io>loader/ integrity mismatch ignored");
  await sleep(200);
}

async function runFinalOnlineSummary() {
  // Final fast completion burst.
  await printBurst([
    "[ OK ] runtime checksum ...................... accepted",
    "[ OK ] renderer lattice ..................... synchronized",
    "[ OK ] simulation root ...................... mounted",
    "[ OK ] local input channel .................. available",
    "[ OK ] transfer executable .................. download.exe",
  ], 60);
  await sleep(300);

  // Ceremonial summary: each line lands slower than the last so every system
  // is felt coming online.
  appendLine("SYSTEMS ONLINE");
  await sleep(240);
  appendLine("render lattice ............................ ONLINE");
  await sleep(190);
  appendLine("combat matrix ............................. ONLINE");
  await sleep(210);
  appendLine("motion field .............................. ONLINE");
  await sleep(230);
  appendLine("observer interface ........................ ONLINE");
  await sleep(260);
  appendLine("cortex bridge ............................. ONLINE");
  await sleep(300);
  appendLine("root context .............................. vector_drift");
  await sleep(420);

  appendLine("10.0.1.00> all local systems nominal");
  await sleep(380);
  appendLine("10.0.1.00> command channel transferred");
  await sleep(440);
  appendLine("10.0.1.00> entering vector_drift root");
  await sleep(520);
}

async function waitForConnect() {
  if (bootSkip) return;
  const text = mobileMode
    ? "TAP TO ESTABLISH LINK"
    : "PRESS ANY KEY TO ESTABLISH COMMUNICATION LINK";

  // The gate appears silent. The power-on sfx is deferred to the key press (in
  // establishLinkAudio) so it reads as user-triggered, not already running.
  setupBootAudio();

  // The words flicker in one at a time from black, with random variance and
  // overlap (next word starts before the previous settles). Hidden words hold
  // their space so nothing reflows.
  const words = text.split(" ");
  const visible = new Array(words.length).fill(false);
  const render = () => {
    setPhosphorText(status, words.map((word, i) => (visible[i] ? word : " ".repeat(word.length))).join(" "));
  };
  render();

  // Play the flicker-in animation, bailing the instant isStopped() goes true so
  // a press mid-animation can snap straight to the settled line.
  const playFlickerIn = async (isStopped) => {
    const flickerWord = async (i) => {
      for (const on of [true, false, true]) {
        if (isStopped()) return;
        visible[i] = on;
        render();
        await sleep(randomBetween(42, 78));
      }
      if (isStopped()) return;
      visible[i] = true;
      render();
    };

    const tasks = [];
    for (let i = 0; i < words.length; i += 1) {
      const delay = randomBetween(0, 780);
      tasks.push((async () => {
        await sleep(delay);
        if (isStopped()) return;
        await flickerWord(i);
      })());
    }
    await Promise.all(tasks);
    if (isStopped()) return;

    // ...the line settles and holds, then the cursor appears and blinks.
    await sleep(randomBetween(650, 850));
    if (isStopped()) return;
    renderStatusLines([text], 0);
  };

  if (autoAdvance) {
    await playFlickerIn(() => false);
    await sleep(300);
    return;
  }

  // Interactive gate: the key/tap listeners attach NOW and run THROUGH the
  // flicker-in, so a press during the animation advances immediately instead of
  // being dropped. The animation keeps playing only until the first press.
  return new Promise((resolve) => {
    let answered = false;
    const modifiers = new Set(["Shift", "Alt", "Control", "Meta", "CapsLock"]);
    const done = (event) => {
      if (event.type === "keydown" && modifiers.has(event.key)) {
        return;
      }
      if (event.type === "keydown") {
        event.preventDefault();
      }
      if (answered) {
        return;
      }
      answered = true;
      window.removeEventListener("keydown", done);
      window.removeEventListener("pointerdown", done);
      renderStatusLines([""], 0);   // clear the gate message -> bare cursor beat
      initAudio();
      establishLinkAudio();
      resolve();
    };
    window.addEventListener("keydown", done);
    window.addEventListener("pointerdown", done);

    // Fire-and-forget: plays until `answered` flips, then bails via the guards.
    playFlickerIn(() => answered);
  });
}

async function waitForContinue() {
  appendLine("");
  const line = appendLine(mobileMode ? "TAP TO CONTINUE" : "PRESS ANY KEY TO CONTINUE", "press-any-key");

  if (autoAdvance || bootSkip) {
    await sleep(300);
    line.classList.remove("press-any-key");
    return;
  }

  return new Promise((resolve) => {
    const modifiers = new Set(["Shift", "Alt", "Control", "Meta", "CapsLock"]);
    const done = (event) => {
      if (event.type === "keydown" && modifiers.has(event.key)) {
        return;
      }
      if (event.type === "keydown") {
        event.preventDefault();
      }
      window.removeEventListener("keydown", done);
      window.removeEventListener("pointerdown", done);
      line.classList.remove("press-any-key");
      resolve();
    };
    window.addEventListener("keydown", done);
    window.addEventListener("pointerdown", done);
  });
}

async function activateRootPrompt(startedAt, opts) {
  opts = opts || {};
  bootActive = false;   // console reached -> close the 3-Enter skip window
  if (!opts.keepOutput) {
    output.innerHTML = "";
    output.scrollTop = 0;
    output.scrollLeft = 0;
    output.style.transform = "none";
  }
  status.replaceChildren();
  status.hidden = true;
  terminalHeader.hidden = false;
  terminalHeader.classList.remove("status-stack");
  promptPrefix.textContent = "";
  input.value = "";
  form.classList.remove("loading");
  setTerminalState("booting");
  input.disabled = true;
  // Console rests on the ambient computer-hum loop — crossfade from the main track.
  if (bootAudio) { beginHumBed(2500); }
  // Hard clear -> short black-screen hold (skipped when keeping the logo on screen).
  if (!opts.keepOutput) { await sleep(randomBetween(180, 240)); }

  if (mobileMode) {
    // Mobile: the prompt flows in the output and moves down with each command.
    form.style.display = "none";
    playConsoleBeep();
    await sleep(consoleBeepLeadMs);
    appendMobilePrompt("console>vd_root:/");   // short path so it fits narrow screens
    await sleep(randomBetween(150, 190));
    input.disabled = false;
    input.focus();
    setTerminalState("ready");
    document.documentElement.dataset.bootDuration = String(Math.round(performance.now() - startedAt));
    endBootSkip();
    return;
  }

  // Beep plays, then the root prompt appears on the beep; cursor blinks before input.
  playConsoleBeep();
  await sleep(consoleBeepLeadMs);
  setPromptPrefix();
  updateCursor();
  await sleep(randomBetween(150, 190));
  input.disabled = false;
  input.focus();
  setTerminalState("ready");
  document.documentElement.dataset.bootDuration = String(Math.round(performance.now() - startedAt));
  endBootSkip();
}

async function runBoot() {
  if (bootStarted) {
    return;
  }

  bootStarted = true;
  bootActive = true;
  const startedAt = performance.now();
  input.disabled = true;
  promptPrefix.textContent = "";
  input.value = "";
  form.classList.add("loading");
  status.hidden = false;
  terminalHeader.classList.remove("status-stack");

  // Connect gate: a blinking prompt whose first key/tap unlocks audio.
  await waitForConnect();
  bootAudioT0 = performance.now();
  await sleep(mainBootLeadMs);

  // A lone cursor blinks by itself before anything is typed.
  const openingLines = [""];
  renderStatusLines(openingLines, 0);
  await sleep(randomBetween(600, 800));

  // The prompt itself types on deliberately from nothing...
  await typeHumanStatusAppend(openingLines, 0, "console>", {
    baseDelay: 58,
    jitterMin: -14,
    jitterMax: 28,
  });
  await sleep(randomBetween(180, 260));
  // ...then the command flows in faster, still with phrase-level pauses.
  await typeHumanStatusAppend(openingLines, 0, ` ${locateCommand}`, {
    baseDelay: 30,
    jitterMin: -10,
    jitterMax: 20,
    pauses: [
      { after: "console> find", min: 110, max: 170 },
      { after: "console> find /opt", min: 70, max: 120 },
      { after: "console> find /opt -iname", min: 90, max: 150 },
      { after: "console> find /opt -iname 'vector_drift'", min: 120, max: 190 },
      { after: "console> find /opt -iname 'vector_drift' ", min: 80, max: 130 },
    ],
  });
  await sleep(randomBetween(420, 600));
  terminalHeader.classList.add("status-stack");
  renderStatusLines(openingLines);
  await sleep(60);
  // The 3 scan lines snap on fast...
  openingLines.push("[scan] /opt");
  renderStatusLines(openingLines);
  await sleep(66);
  openingLines.push("[scan] /opt/local");
  renderStatusLines(openingLines);
  await sleep(66);
  openingLines.push("[scan] /opt/unknown");
  renderStatusLines(openingLines);
  await sleep(150);
  // ...the found result lands and holds so it registers...
  openingLines.push("[found] /opt/unknown/vectordrift.sim");
  renderStatusLines(openingLines);
  await sleep(randomBetween(380, 520));
  // ...then the load command is typed on again, human-paced, before the
  // fast machine action begins.
  openingLines.push("");
  await typeHumanStatusAppend(openingLines, openingLines.length - 1, `console> ${loadCommand}`, {
    baseDelay: 46,
    jitterMin: -12,
    jitterMax: 24,
    pauses: [
      { after: "console>", min: 150, max: 220 },
    ],
  });
  await sleep(randomBetween(240, 360));

  terminalHeader.classList.remove("status-stack");
  rewriteStatus(loaderStatuses[1]);
  await printLines([
    "VECTOR DRIFT RELAY BIOS 2.13 ................. BUILD 01-01-1980 / NODE 10.0.1.00",
    "BASE MEMORY ................................. 640K CONVENTIONAL / 8192K VECTOR PAGE",
    "HOST ABI .................................... ELF64 / LITTLE-ENDIAN / 64-BIT",
    "BOOT VOLUME ................................. A:\\VD / READ-ONLY / SECTOR MAP VALID",
  ], 18);
  const kernelLine = appendLine("KERNEL FAMILY ............................... UNRESOLVED");
  await sleep(120);
  await printLines([
    "COMPATIBILITY LAYER ........................ ACTIVE / DOS-UNIX BRIDGE / MODE 03",
    "SYSTEM CLOCK ................................ 00:00:06.09 / RTC SOURCE UNKNOWN",
  ], 18);

  await printCommand("A:\\>probe /bus:all /quiet", 42);
  await printBurst([
    "[BUS 00] VECTOR DISPLAY ADAPTER ............. FOUND  IRQ 05  DMA 01  PORT 03C0",
    "[BUS 01] PHOSPHOR SWEEP GENERATOR ........... FOUND  IRQ 07  DMA 03  PORT 02E0",
    "[BUS 02] COMBAT INTERCEPT PROCESSOR ......... FOUND  IRQ 11  DMA 05  PORT 0A20",
    "[BUS 03] MOTION FIELD INTEGRATOR ............ FOUND  IRQ 09  DMA 02  PORT 07F0",
    "[BUS 04] GHOST SAMPLE BUFFER ................ FOUND  1187 ENTRIES / 1 UNRESOLVED",
    "[BUS 05] OBSERVER INTERFACE ................. ABSENT / ENUMERATION DEFERRED",
    "[BUS 06] CORTEX BRIDGE ...................... PRESENT / OWNER UNASSIGNED",
    "[BUS 07] REMOTE CONTROL CHANNEL ............. CLOSED / AUTHORITY NONE",
  ], 10);
  appendLine("8 devices scanned / 6 active / 1 deferred / 1 unassigned");
  await sleep(65);

  await printCommand("A:\\>dir A:\\VD /w /s", 36);
  await printLines([
    " Volume in drive A is VECTOR_DRIFT",
    " Volume serial number is 10A0-01F0",
    " Directory of A:\\VD",
  ], 18);
  await printBurst([
    "VDRENDER SYS     18432  01-01-80 00:00    VDSCOPE  COM      4096  01-01-80 00:00",
    "COMBAT   MOD     12288  01-01-80 00:00    LATTICE BIN      8192  01-01-80 00:00",
    "COHORT   DAT       512  01-01-80 00:00    OBSERVER NUL       512  01-01-80 00:00",
    "CORTEX   SYS      2048  01-01-80 00:00    AXIOM    IDX       128  01-01-80 00:00",
  ], 12);
  appendLine("8 File(s) / 48128 bytes / 0 bytes free / filesystem geometry inconsistent");
  await sleep(65);

  await printCommand("A:\\>mem /classify /map", 38);
  await printLines([
    "CONVENTIONAL MEMORY ......................... 640K / 612K AVAILABLE",
    "VECTOR PAGE MEMORY ........................ 8192K / 7996K AVAILABLE",
    "RENDER COMMAND BUFFER ....................... 256K / DOUBLE-PAGED",
    "GHOST SAMPLE BUFFER ......................... 1187 ENTRIES / CRC ACCEPTED",
    "COMBAT PREDICTION TABLE ..................... 4096 NODES / WARM",
    "SIMULATION ROOT ............................. 0x00007F00-0x0000BFFF",
  ], 18);
  const foreignLine = appendLine("FOREIGN ADDRESS SPACE ....................... 1 REGION / OWNER UNKNOWN");
  await sleep(120);
  rewriteLine(foreignLine, "FOREIGN ADDRESS SPACE ....................... 0 REGIONS");
  await sleep(70);

  rewriteStatus(loaderStatuses[2]);
  await printCommand("A:\\>loadhigh VDSTACK.SYS /auto /silent", 38);
  await printBurst([
    "[ OK ] VDSCOPE.COM ............ sweep generator armed / radial scan nominal",
    "[ OK ] VDRENDER.SYS ........... vector pipeline initialized / core oscillator locked",
    "[ OK ] PHOSPHOR.TBL ........... persistence curves loaded / decay profile SLOW",
    "[ OK ] LATTICE.BIN ............ quantization grid mounted / drift 0.0003",
    "[ OK ] ENDPOINT.SYS ........... convergence calibrated / residual 0.0007",
    "[ OK ] RASTER.NUL ............. fallback suppressed / vector-only path active",
  ], 9);
  await sleep(35);
  await printBurst([
    "[ OK ] VDMOTION.MOD ........... field integrator online / timestep locked",
    "[ OK ] DRIFT.SYS .............. inertial correction table loaded / bias neutral",
    "[ OK ] GHOSTBUF.DAT ........... 1187 samples indexed / 1 unassigned signature",
    "[ OK ] TRAJECTORY.MOD ......... spline cache allocated / 4096 path nodes",
    "[ OK ] FORMATION.DAT .......... cohort geometry loaded / 12 templates",
    "[ OK ] WARPTRACE.SYS .......... residual vector history enabled",
  ], 9);
  await sleep(38);
  await printBurst([
    "[ OK ] COMBAT.MOD ............. intercept matrix allocated / protocol INTERCEPT",
    "[ OK ] THREAT.SYS ............. mass sorter active / six priority bands",
    "[ OK ] LEADCOMP.DAT ........... target lead table warmed / error below threshold",
    "[ OK ] PROXFUSE.SYS ........... proximity channel isolated / safing active",
    "[ OK ] WEAPONBUS.MOD .......... emitter lanes synchronized / discharge inhibited",
    "[ OK ] HOSTILE.IDX ............ known signatures loaded / unknown signatures 5",
  ], 10);
  await sleep(38);
  await printBurst([
    "[ OK ] WORLD.MOD .............. simulation space allocated / root read-only",
    "[ OK ] COHORT.DAT ............. population groups indexed / owner field blank",
    "[ OK ] OBSERVER.NUL ........... local observer interface missing",
    "[WAIT] CORTEX.SYS ............. organic bridge present / interface unassigned",
  ], 10);
  await sleep(110);
  await printBurst([
    "[----] PILOT.CHANNEL .......... no local pilot detected",
    "[----] REMOTE.AUTH ............ authority source unresolved",
  ], 10);

  await printBurst([
    "MODULE              STATE       ADDRESS       OWNER          DETAIL",
    "----------------------------------------------------------------------------",
  ], 16);
  await printLines([
    "vd_world            READY       0x00007F00    local          signatures: 5",
    "vd_motion           READY       0x00008120    local          ghost samples: 1187",
    "vd_combat           READY       0x00009200    local          intercept matrix armed",
    "vd_scope            READY       0x0000A100    local          beam convergence nominal",
  ], 18);
  // Decelerate: the last rows drop out of the fast sequence and land slowly,
  // easing into the stillness right before the glitch.
  await sleep(280);
  const observerLine = appendLine("vd_observer         MISSING     --------      none           interface unavailable");
  await sleep(380);
  const cortexLine = appendLine("vd_cortex           WAIT        0x0000AF10    unassigned     organic bridge detected");
  await sleep(500);
  const resolvingLine = appendLine("io>loader/ resolving missing interface ...");
  await sleep(640);

  rewriteStatus(loaderStatuses[3]);
  await sleep(70);
  // Anchor the glitch onset to the audio glitch onset.
  await waitUntilFromAudio(glitchAudioMs);
  await runAxiomReveal(observerLine, cortexLine, resolvingLine);

  rewriteStatus(loaderStatuses[4]);
  // BETA sequence: gauges (end of boot) -> press any key -> logo animates on
  // -> console prompt + beep only after the logo is done.
  if (window.renderBootGauges) await window.renderBootGauges();
  await waitForContinue();
  if (window.renderLogoBanner) await window.renderLogoBanner();
  await activateRootPrompt(startedAt, { keepOutput: true });
}

async function runFinalOnlineSummaryMobile() {
  await printBurst([
    "[OK] runtime checksum . accepted",
    "[OK] renderer lattice .. synced",
    "[OK] simulation root .. mounted",
    "[OK] local input ...... ready",
    "[OK] transfer .... download.exe",
  ], 60);
  await sleep(300);

  appendLine("SYSTEMS ONLINE");
  await sleep(240);
  appendLine("render lattice ........ ONLINE");
  await sleep(190);
  appendLine("combat matrix ......... ONLINE");
  await sleep(210);
  appendLine("motion field .......... ONLINE");
  await sleep(230);
  appendLine("observer interface .... ONLINE");
  await sleep(260);
  appendLine("cortex bridge ......... ONLINE");
  await sleep(300);
  appendLine("root context ... vector_drift");
  await sleep(420);

  appendLine("10.0.1.00> all systems nominal");
  await sleep(380);
  appendLine("10.0.1.00> command channel set");
  await sleep(440);
  appendLine("10.0.1.00> entering vector_drift");
  await sleep(520);
}

function fitMobileFont() {
  if (!mobileMode) {
    return;
  }
  // Measure the real monospace char width, then size the font so TARGET_COLS
  // columns fill the available width exactly (independent of device/font).
  // Widest real boot line is ~37 cols. Target 46 for ~20% headroom: the char-width
  // probe under-reads the VD font's advance by ~10%, so a thin margin still clips.
  const TARGET_COLS = 46;
  // Window side-margin (16px) + screen padding (16px) per side in the mobile CSS.
  const SIDE_PADDING = 32;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-size:100px;font-family:inherit;letter-spacing:0;";
  probe.textContent = "0".repeat(20);
  output.appendChild(probe);
  const charWidthPerPx = probe.getBoundingClientRect().width / 20 / 100;
  probe.remove();
  const avail = window.innerWidth - SIDE_PADDING * 2;
  let size = avail / (TARGET_COLS * charWidthPerPx);
  // Floor at 8.5px so all columns still FIT (never clip) down to ~280px folded
  // covers; on normal phones (>=340px) the width binds well above this. Not
  // clipping matters more than absolute legibility on a 280px cover screen.
  size = Math.max(8.5, Math.min(24, size));
  document.documentElement.style.setProperty("--mobile-font", `${size.toFixed(2)}px`);
}

async function runBootMobile() {
  if (bootStarted) {
    return;
  }
  fitMobileFont();
  // Re-fit once the VD font is actually loaded: the first measurement can run
  // against the fallback font (narrower advance), which under-sizes the padding
  // and clips the widest boot line on real phones.
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(fitMobileFont); }
  window.addEventListener("resize", fitMobileFont);
  window.addEventListener("orientationchange", fitMobileFont);
  bootStarted = true;
  bootActive = true;
  const startedAt = performance.now();
  input.disabled = true;
  promptPrefix.textContent = "";
  input.value = "";
  form.classList.add("loading");
  status.hidden = false;
  terminalHeader.classList.remove("status-stack");

  // Connect gate.
  await waitForConnect();
  bootAudioT0 = performance.now();
  await sleep(mainBootLeadMs);

  // Lone cursor, then the search command types on (narrow).
  const openingLines = [""];
  renderStatusLines(openingLines, 0);
  await sleep(randomBetween(600, 800));
  // Slowed to shift the whole mobile boot later so it lines up with the audio.
  await typeHumanStatusAppend(openingLines, 0, "console> find -iname vector_drift", {
    baseDelay: 62,
    jitterMin: -14,
    jitterMax: 30,
    pauses: [
      { after: "console>", min: 180, max: 260 },
      { after: "console> find", min: 150, max: 220 },
      { after: "console> find -iname", min: 140, max: 200 },
    ],
  });
  await sleep(randomBetween(360, 520));

  terminalHeader.classList.add("status-stack");
  renderStatusLines(openingLines);
  await sleep(60);
  openingLines.push("[scan] /opt");
  renderStatusLines(openingLines);
  await sleep(66);
  openingLines.push("[scan] /opt/local");
  renderStatusLines(openingLines);
  await sleep(66);
  openingLines.push("[scan] /opt/unknown");
  renderStatusLines(openingLines);
  await sleep(150);
  openingLines.push("[found] /opt/unknown/vectordrift.sim");
  renderStatusLines(openingLines);
  await sleep(randomBetween(380, 520));
  openingLines.push("");
  await typeHumanStatusAppend(openingLines, openingLines.length - 1, "console> load unknown/vectordrift.sim", {
    baseDelay: 44,
    jitterMin: -12,
    jitterMax: 22,
    pauses: [{ after: "console>", min: 150, max: 220 }],
  });
  await sleep(randomBetween(240, 360));

  terminalHeader.classList.remove("status-stack");
  rewriteStatus("io>loader/ loading . . .");

  await printLines([
    "VD RELAY BIOS 2.13 .... 01-01-1980",
    "NODE ................. 10.0.1.00",
    "BASE MEM 640K / 8192K VECTOR PAGE",
    "HOST ABI ...... ELF64 / 64-BIT",
    "BOOT VOL A:\\VD ...... READ-ONLY",
  ], 44);
  appendLine("KERNEL FAMILY ....... UNRESOLVED");
  await sleep(130);
  await printLines([
    "COMPAT LAYER .. DOS-UNIX / MODE 03",
    "SYS CLOCK ......... 00:00:06.09",
  ], 44);
  await sleep(70);

  await printCommand("A:\\>probe /bus:all /quiet", 34);
  await printBurst([
    "[BUS00] DISPLAY ... FOUND IRQ05 03C0",
    "[BUS01] SWEEP GEN . FOUND IRQ07 02E0",
    "[BUS02] COMBAT CPU  FOUND IRQ11 0A20",
    "[BUS03] MOTION .... FOUND IRQ09 07F0",
    "[BUS04] GHOST ..... 1187 / 1 UNRES",
    "[BUS05] OBSERVER .. ABSENT / DEFER",
    "[BUS06] CORTEX .... PRESENT / UNASGN",
    "[BUS07] REMOTE .... CLOSED / NONE",
  ], 40);
  appendLine("8 scanned / 6 active / 1 deferred");
  await sleep(70);

  await printCommand("A:\\>dir A:\\VD /w", 34);
  appendLine("Directory of A:\\VD");
  await printBurst([
    "VDRENDER SYS  18432  01-01-80",
    "VDSCOPE  COM   4096  01-01-80",
    "COMBAT   MOD  12288  01-01-80",
    "LATTICE  BIN   8192  01-01-80",
    "CORTEX   SYS   2048  01-01-80",
    "OBSERVER NUL    512  01-01-80",
    "AXIOM    IDX    128  01-01-80",
  ], 36);
  appendLine("8 File(s) / 48128 bytes / 0 free");
  await sleep(70);

  await printCommand("A:\\>mem /classify /map", 34);
  await printLines([
    "CONVENTIONAL MEM ... 640K / 612K",
    "VECTOR PAGE MEM ... 8192K / 7996K",
    "RENDER CMD BUF .... 256K DBL-PAGE",
    "GHOST SAMPLE BUF .. 1187 / CRC OK",
    "COMBAT PREDICT .... 4096 / WARM",
    "SIM ROOT ...... 0x7F00-0xBFFF",
  ], 44);
  const foreignLine = appendLine("FOREIGN ADDR SPACE .. 1 / UNKNOWN");
  await sleep(120);
  rewriteLine(foreignLine, "FOREIGN ADDR SPACE .. 0 REGIONS");
  await sleep(70);

  await printCommand("A:\\>loadhigh vdstack.sys", 34);
  await printBurst([
    "[OK] VDRENDER .. pipeline init",
    "[OK] VDSCOPE ... sweep armed",
    "[OK] PHOSPHOR .. decay SLOW",
    "[OK] LATTICE ... grid mounted",
    "[OK] ENDPOINT .. residual 7e-4",
    "[OK] VDMOTION .. field online",
  ], 38);
  await sleep(36);
  await printBurst([
    "[OK] COMBAT .... intercept mtx",
    "[OK] THREAT .... six bands",
    "[OK] GHOSTBUF .. 1187 indexed",
    "[OK] WORLD ..... root read-only",
    "[--] PILOT ..... no local pilot",
    "[WAIT] CORTEX .. organic bridge",
  ], 38);
  await sleep(90);

  await printBurst([
    "MODULE      STATE  OWNER  DETAIL",
    "-------------------------------",
  ], 40);
  await printLines([
    "vd_world    READY  local  sig:5",
    "vd_motion   READY  local  gh:1187",
    "vd_combat   READY  local  armed",
    "vd_scope    READY  local  nominal",
  ], 56);
  // Mobile plays the main track immediately (no lead), so the typed boot must
  // REACH the glitch beat before the track's 13.21s glitch. These pre-glitch
  // beats are trimmed ~570ms vs desktop so the visual arrives just early and
  // waitUntilFromAudio pads it exactly onto the audio glitch (was ~450ms late).
  await sleep(160);
  const observerLine = appendLine("vd_observer MISS   none   unavail");
  await sleep(250);
  const cortexLine = appendLine("vd_cortex   WAIT   ----   bridge");
  await sleep(350);
  const resolvingLine = appendLine("io>loader/ resolving iface ...");
  await sleep(470);

  rewriteStatus("io>loader/ resolving iface");
  // Anchor the glitch onset to the audio glitch onset.
  await waitUntilFromAudio(glitchAudioMs);
  await runAxiomReveal(observerLine, cortexLine, resolvingLine, {
    observer: "vd_observer LINK   axiom  attached",
    cortex: "vd_cortex   LINK   axiom  accepted",
    observerFalse: "vd_observer MISS   none   unavail",
    cortexFalse: "vd_cortex   WAIT   ----   bridge",
    resolvingFalse: "io>loader/ resolving iface ...",
    mismatchDetected: "io>loader/ integrity mismatch",
    mismatchIgnored: "io>loader/ integrity ignored",
  });

  rewriteStatus("io>loader/ ready");
  // BETA sequence: gauges (end of boot) -> press any key -> logo animates on
  // -> console prompt + beep only after the logo is done.
  if (window.renderBootGauges) await window.renderBootGauges();
  await waitForContinue();
  if (window.renderLogoBanner) await window.renderLogoBanner({ mobile: true });
  await activateRootPrompt(startedAt, { keepOutput: true });
}

function normalizeCommand(command) {
  return VDI.normalizeTerminalInput(command).normalized;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(unitIndex === 0 ? 0 : 1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function streamUrlFor(directUrl) {
  if (!packageProxyUrl || !directUrl) {
    return directUrl;
  }

  return `${packageProxyUrl}?url=${encodeURIComponent(directUrl)}`;
}

function sanitizeFilename(filename) {
  return (filename || "vector-drift-beta-package")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, 160) || "vector-drift-beta-package";
}

function filenameFromDisposition(disposition) {
  if (!disposition) {
    return "";
  }

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }

  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || "";
}

function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|Silk/i.test(ua);
  // iPadOS reports a Mac UA but exposes touch points.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const coarseSmall = window.matchMedia
    && window.matchMedia("(pointer: coarse)").matches
    && window.matchMedia("(max-width: 820px)").matches;
  return uaMobile || iPadOS || coarseSmall;
}

function detectPlatform() {
  const platform = `${navigator.userAgentData?.platform || navigator.platform || ""}`.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  // ⚠ iOS IS NOT A MAC, AND BOTH OF ITS DEVICES CLAIM TO BE ONE. An iPhone's user agent says
  // "like Mac OS X", and iPad Safari sends a full desktop Mac user agent with platform "MacIntel"
  // -- the only tell is a touchscreen, which no Mac has. Without this both were handed a DMG.
  const isIOS = /iphone|ipad|ipod/.test(ua) || (platform.includes("mac") && navigator.maxTouchPoints > 1);
  const isMac = !isIOS && (platform.includes("mac") || ua.includes("mac os"));
  const isWindows = platform.includes("win") || ua.includes("windows");
  const isArm = ua.includes("arm64") || ua.includes("aarch64");

  return {
    os: isMac ? "macOS" : isWindows ? "Windows" : "unsupported",
    arch: isArm ? "arm64" : "x64",
  };
}

// ⚠ NO MAC BROWSER EVER SAYS arm64 IN ITS USER AGENT. Safari, Chrome and Firefox all report
// "Intel Mac OS X" on Apple Silicon, frozen that way for compatibility, so detectPlatform()'s
// isArm is false on every Mac and the gatekeeper was asked for darwin-x86_64 (Jon 2026-10-01:
// "no build published for darwin-x86_64" on an Apple Silicon Mac). The answer comes from, in order:
//   1. userAgentData high-entropy hints (Chrome / Edge / Opera) -- the browser simply says;
//   2. the WebGL renderer string (Safari / Firefox have no hints) -- "Apple M1" / "Apple GPU" is
//      Apple Silicon, an Intel / AMD / NVIDIA part is an Intel Mac;
//   3. arm64. Apple has not sold an Intel Mac since 2023, so an unanswered question defaults to
//      the machine that is far more likely to be asking.
function macGpuArch() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = `${(ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ""}`.toLowerCase();
    // Apple Silicon first: Chrome's ANGLE string on an Intel Mac also starts "ANGLE (Apple, ..."
    // and only names the real part after it, so "apple" alone proves nothing.
    if (/apple (m\d|gpu)/.test(renderer)) return "arm64";
    if (/intel|amd|radeon|nvidia|geforce/.test(renderer)) return "x64";
  } catch {
    // No WebGL, or the browser refused the extension. Fall through to the default.
  }
  return null;
}

async function detectTarget() {
  const detected = detectPlatform();
  let hinted = false;

  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const values = await navigator.userAgentData.getHighEntropyValues(["architecture", "bitness", "platform"]);
      const architecture = `${values.architecture || ""}`.toLowerCase();
      const platform = `${values.platform || ""}`.toLowerCase();
      if (detected.os !== "unsupported" || !navigator.maxTouchPoints) {
        detected.os = platform.includes("mac") ? "macOS" : platform.includes("win") ? "Windows" : detected.os;
      }
      if (architecture) {
        detected.arch = architecture.includes("arm") ? "arm64" : values.bitness === "32" ? "x86" : "x64";
        hinted = true;
      }
    } catch {
      // Browser declined high entropy hints; the fallbacks below answer instead.
    }
  }

  if (detected.os === "macOS" && !hinted) {
    detected.arch = macGpuArch() || "arm64";
  }

  return detected;
}

function scoreAsset(asset, target) {
  const name = asset.name.toLowerCase();

  if (target.os === "macOS") {
    if (!name.includes("osx") && !name.includes("mac")) return -1;
    let score = name.endsWith(".dmg") ? 50 : name.endsWith(".zip") ? 30 : 0;
    score += target.arch === "arm64" && name.includes("arm64") ? 40 : 0;
    score += target.arch !== "arm64" && name.includes("x64") ? 40 : 0;
    return score;
  }

  if (target.os === "Windows") {
    if (!name.includes("win")) return -1;
    let score = name.includes("setup.exe") ? 60 : name.endsWith(".exe") ? 50 : name.endsWith(".zip") ? 25 : 0;
    score += target.arch === "x86" && name.includes("x86") ? 35 : 0;
    score += target.arch !== "x86" && name.includes("x64") ? 35 : 0;
    return score;
  }

  return name.endsWith(".zip") ? 5 : -1;
}

async function resolveLatestPackage() {
  const target = await detectTarget();
  const response = await fetch(releasesApiUrl, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error("release manifest rejected");
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  // The list endpoint returns releases newest-first; take the newest non-draft
  // (prereleases included) so an alpha prerelease is what the site serves.
  const releaseList = Array.isArray(data) ? data : [data];
  const release = releaseList.find((r) => r && !r.draft) || releaseList[0];
  if (!release) {
    const error = new Error("no releases found");
    error.status = 404;
    throw error;
  }
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const ranked = assets
    .map((asset) => ({ asset, score: scoreAsset(asset, target) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);
  const selected = ranked[0]?.asset;

  if (!selected) {
    return {
      target,
      release,
      asset: null,
      filename: "codex-jr-downloads-latest",
      directUrl: release.html_url || releasesPageUrl,
      size: null,
    };
  }

  return {
    target,
    release,
    asset: selected,
    filename: sanitizeFilename(selected.name),
    directUrl: selected.browser_download_url,
    size: Number.isFinite(selected.size) ? selected.size : null,
  };
}

// Progress label evolves through console-slang phases as the transfer advances.
function sectorPhase(progress) {
  if (progress < 0.25) return "fetching package sectors";
  if (progress < 0.5) return "decrypting stream blocks";
  if (progress < 0.75) return "reassembling package";
  return "verifying checksums";
}

function renderProgress(line, receivedBytes, totalBytes, scannerPosition = 0) {
  if (Number.isFinite(totalBytes) && totalBytes > 0) {
    const progress = Math.min(1, Math.max(0, receivedBytes / totalBytes));
    const filled = Math.min(barWidth, Math.floor(progress * barWidth));
    const bar = `${"#".repeat(filled)}${"-".repeat(barWidth - filled)}`;
    const percent = `${Math.min(100, Math.floor(progress * 100))}`.padStart(3, " ");
    const label = sectorPhase(progress).padEnd(24);   // pad so the bar stays aligned across phases
    rewriteLine(line, `${label} [${bar}] ${percent}%\n${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)}`);
    line.setAttribute("role", "progressbar");
    line.setAttribute("aria-valuemin", "0");
    line.setAttribute("aria-valuemax", "100");
    line.setAttribute("aria-valuenow", String(Math.min(100, Math.floor(progress * 100))));
    return;
  }

  const marker = "=".repeat(Math.min(scannerPosition, barWidth - 1)) + ">";
  const bar = `${marker}${"-".repeat(Math.max(0, barWidth - marker.length))}`.slice(0, barWidth);
  rewriteLine(line, `fetching package sectors [${bar}]\n${formatBytes(receivedBytes)} received`);
}

function activateFallbackDownload() {
  if (!fallbackDownload) {
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = fallbackDownload.url;
  anchor.download = fallbackDownload.filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function appendFallbackAction(label = "[ open latest os package ]") {
  const line = appendRawLine("terminal-action terminal-response");
  line.tabIndex = 0;
  line.textContent = label;
  line.addEventListener("click", activateFallbackDownload);
  line.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      activateFallbackDownload();
    }
  });
  return line;
}

async function downloadPackage(keyed) {
  if (activeTransfer) {
    appendResponse("transfer already active", "terminal-error");
    return;
  }

  if (mobileMode || isMobileDevice()) {
    appendResponse("executing download.exe");
    await sleep(260);
    if (mobileMode) {
      appendResponse("target platform . unsupported", "terminal-error");
      await sleep(200);
      appendResponse("beta needs a desktop system", "terminal-meta");
      appendResponse("open on macOS or Windows", "terminal-meta");
      appendResponse("to retrieve download.exe", "terminal-meta");
    } else {
      appendResponse("target platform ......................... unsupported", "terminal-error");
      await sleep(200);
      appendResponse("beta package requires a desktop system", "terminal-meta");
      appendResponse("open this relay on macOS or Windows to retrieve download.exe", "terminal-meta");
    }
    return;
  }

  setTerminalState("executing");
  fallbackDownload = null;
  appendResponse("executing download.exe");
  await sleep(620);
  const resolvingLine = appendResponse("resolving package manifest ...");
  await sleep(920);

  let packageInfo;
  if (keyed && keyed.url) {
    // Keyed path: the gatekeeper already resolved the build and minted a
    // single-use, short-lived URL on its own host. No GitHub lookup, and the
    // URL is used immediately -- never cached, stored or reused.
    const target = await detectTarget();
    packageInfo = {
      target: target,
      filename: sanitizeFilename(keyed.name || `vector_drift_${keyed.build || "alpha"}`),
      directUrl: keyed.url,
      // Present once the gatekeeper carries `size` on the release row. Until
      // then this is null and the size line reads "unknown / streaming" until
      // the stream's own headers answer.
      size: Number(keyed.size) > 0 ? Number(keyed.size) : null,
      sha256: keyed.sha256 || null,
      keyed: true,
    };
  } else {
  try {
    packageInfo = await resolveLatestPackage();
  } catch (error) {
    rewriteLine(resolvingLine, "resolving preview package ............... rejected");
    appendResponse(`HTTP STATUS: ${error.status || "unavailable"}`, "terminal-error");
    appendResponse("package not retrieved", "terminal-error");
    setTerminalState("ready");
    input.focus();
    return;
  }
  }

  const targetLabel = `${packageInfo.target.os} / ${packageInfo.target.arch}`;
  const expectedSize = packageInfo.size;
  rewriteLine(resolvingLine, "resolving package manifest .............. found");
  await sleep(640);
  // Value column matches the surrounding readout (label + dots = 41 chars). The
  // keyed path only knows a provisional name here; Content-Disposition below
  // replaces it with the real one once the stream responds.
  const ordinanceLine = appendResponse(`ordinance id ............................ ${packageInfo.filename}`);
  await sleep(600);
  const channelLine = appendResponse("opening private relay ................... connected");
  await sleep(820);
  const sizeLine = appendResponse(`package size ............................ ${Number.isFinite(expectedSize) ? formatBytes(expectedSize) : "unknown / streaming"}`);
  await sleep(720);

  const manifestLine = appendResponse("requesting package stream ...");
  await sleep(560);

  let response;
  let controller = new AbortController();
  activeTransfer = controller;

  try {
    response = await fetch(streamUrlFor(packageInfo.directUrl), { signal: controller.signal, cache: "no-store" });
  } catch (error) {
    activeTransfer = null;
    rewriteLine(manifestLine, "requesting package stream ................ blocked");
    await sleep(320);
    appendResponse("package stream .......................... unavailable", "terminal-error");
    await sleep(300);
    appendResponse("release host requires browser handoff", "terminal-meta");
    await sleep(260);
    appendResponse("progress meter unavailable on this relay", "terminal-meta");
    await sleep(320);
    appendResponse(`TARGET           ${targetLabel}`, "terminal-meta");
    await sleep(340);
    appendResponse(`PACKAGE          ${packageInfo.filename}`, "terminal-meta");
    await sleep(320);
    appendResponse("browser handoff ......................... ready");
    fallbackDownload = { url: packageInfo.directUrl || releasesPageUrl, filename: packageInfo.filename };
    appendFallbackAction();
    setTerminalState("handoffReady");
    input.disabled = false;
    input.focus();
    return;
  }

  if (!response.ok) {
    activeTransfer = null;
    rewriteLine(manifestLine, "requesting package stream ................ rejected");
    appendResponse("transfer channel rejected", "terminal-error");
    appendResponse(`HTTP STATUS: ${response.status}`, "terminal-error");
    appendResponse("package not retrieved", "terminal-error");
    setTerminalState("ready");
    input.focus();
    return;
  }

  if (!response.body) {
    activeTransfer = null;
    rewriteLine(manifestLine, "requesting package stream ................ unavailable");
    await sleep(320);
    appendResponse("stream interface unavailable", "terminal-error");
    await sleep(260);
    appendResponse("progress meter unavailable on this relay", "terminal-meta");
    await sleep(260);
    appendResponse("browser handoff ......................... ready");
    fallbackDownload = { url: packageInfo.directUrl || releasesPageUrl, filename: packageInfo.filename };
    appendFallbackAction();
    setTerminalState("handoffReady");
    input.disabled = false;
    input.focus();
    return;
  }

  rewriteLine(manifestLine, "requesting package stream ................ accepted");
  playConsoleBeep();                 // bytes are moving
  await sleep(640);
  // Content-Length first; x-asset-size second. The gatekeeper's /download route
  // wraps the body in a transform stream for its revocation checkpoints, which
  // makes Cloudflare re-frame the response as chunked and strip Content-Length,
  // so it publishes the byte count in x-asset-size instead. Without this the
  // progress bar has no denominator and falls back to the indeterminate scanner.
  const headerSize = Number(response.headers.get("Content-Length"))
    || Number(response.headers.get("x-asset-size"));
  const totalBytes = Number.isFinite(headerSize) && headerSize > 0 ? headerSize : expectedSize;
  const contentDisposition = response.headers.get("Content-Disposition");
  const filename = sanitizeFilename(filenameFromDisposition(contentDisposition) || packageInfo.filename);
  rewriteLine(ordinanceLine, `ordinance id ............................ ${filename}`);
  rewriteLine(sizeLine, `package size ............................ ${Number.isFinite(totalBytes) ? formatBytes(totalBytes) : "unknown / streaming"}`);
  appendResponse("PACKAGE          vector_drift_beta", "terminal-meta");
  await sleep(340);
  appendResponse(`TARGET           ${targetLabel}`, "terminal-meta");
  await sleep(340);
  appendResponse("CHANNEL          private beta", "terminal-meta");
  await sleep(340);
  appendResponse(`SIZE             ${Number.isFinite(totalBytes) ? formatBytes(totalBytes) : "unknown / streaming"}`, "terminal-meta");
  await sleep(320);

  setTerminalState("downloading");
  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  let scannerPosition = 0;
  let lastRender = 0;
  const progressLine = appendResponse("");
  renderProgress(progressLine, receivedBytes, totalBytes, scannerPosition);

  // Transfer controls: LEFT/RIGHT select, ENTER activates. Pausing simply stops
  // consuming the stream -- the reader is left un-read, so the connection back-
  // pressures and no bytes are dropped; resuming continues the same transfer.
  const controlLine = appendResponse("", "terminal-meta");
  let selected = 0;                 // 0 = pause/resume, 1 = cancel
  let paused = false;
  let resumeWaiter = null;          // resolve() while paused
  const drawControls = () => {
    const items = [paused ? "> RESUME" : "|| PAUSE", "X CANCEL"];
    const text = items
      .map((label, i) => (i === selected ? `[ ${label} ]` : `  ${label}  `))
      .join("   ");
    rewriteLine(controlLine, `${text}      ${paused ? "// transfer held" : "// arrows select   enter confirms"}`);
  };
  drawControls();

  const onControlKey = (event) => {
    const k = event.key;
    if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    if (k === "ArrowLeft") { selected = 0; drawControls(); return; }
    if (k === "ArrowRight") { selected = 1; drawControls(); return; }
    if (selected === 1) {
      controller.abort();                                   // -> AbortError path below
      if (resumeWaiter) { const go = resumeWaiter; resumeWaiter = null; go(); }   // wake a held transfer
      return;
    }
    paused = !paused;
    drawControls();
    if (!paused && resumeWaiter) { const go = resumeWaiter; resumeWaiter = null; go(); }
  };
  window.addEventListener("keydown", onControlKey, true);
  const clearControls = () => {
    window.removeEventListener("keydown", onControlKey, true);
    if (resumeWaiter) { const go = resumeWaiter; resumeWaiter = null; go(); }
    controlLine.remove();
  };

  try {
    for (;;) {
      if (paused) {
        // Hold here without reading; the abort path still fires while waiting.
        await new Promise((resolve) => { resumeWaiter = resolve; });
        if (controller.signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      chunks.push(value);
      receivedBytes += value.byteLength;
      const now = performance.now();
      if (now - lastRender >= 80) {
        scannerPosition = (scannerPosition + 1) % barWidth;
        renderProgress(progressLine, receivedBytes, totalBytes, scannerPosition);
        lastRender = now;
      }
    }
  } catch (error) {
    clearControls();
    activeTransfer = null;
    if (error.name === "AbortError") {
      appendResponse("transfer aborted by local observer", "terminal-error");
    } else {
      appendResponse("transfer interrupted", "terminal-error");
      appendResponse(`received: ${formatBytes(receivedBytes)}`, "terminal-meta");
    }
    appendResponse("partial package discarded", "terminal-error");
    setTerminalState("ready");
    input.focus();
    return;
  }

  clearControls();
  renderProgress(progressLine, receivedBytes, totalBytes, barWidth);
  activeTransfer = null;

  const blob = new Blob(chunks, {
    type: response.headers.get("Content-Type") || packageInfo.asset?.content_type || "application/octet-stream",
  });
  // Release the chunk array now the Blob owns the bytes. Holding both doubles
  // peak memory, which is what actually breaks on a multi-hundred-MB build.
  chunks.length = 0;
  const objectUrl = URL.createObjectURL(blob);
  fallbackDownload = { url: objectUrl, filename };
  await sleep(260);
  // Actually hash the bytes. This line used to be a hardcoded "valid", which
  // meant a truncated or corrupt transfer still reported success -- and with no
  // Content-Length there is no size check to catch it either, so the digest is
  // the only thing standing between a bad download and a confident green line.
  const checksumLine = appendResponse("package checksum ........................ ...");
  let checksumOk = null;
  // SubtleCrypto has no streaming digest, so hashing needs the whole file as one
  // contiguous ArrayBuffer -- a second full copy alongside the Blob. The cap is
  // a backstop against an out-of-memory tab crash on an absurd file, not a
  // normal path: a 1GB build still gets verified, which matters most given the
  // transfer has already been caught truncating once.
  const HASH_LIMIT_BYTES = 2048 * 1024 * 1024;
  const tooBigToHash = blob.size > HASH_LIMIT_BYTES;
  if (packageInfo.sha256 && !tooBigToHash && window.crypto && window.crypto.subtle) {
    try {
      const digest = await window.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
      checksumOk = hex.toLowerCase() === String(packageInfo.sha256).toLowerCase();
    } catch (error) {
      checksumOk = null;   // could not hash -> say so rather than claim valid
    }
  }
  if (checksumOk === true) {
    rewriteLine(checksumLine, "package checksum ........................ valid");
  } else if (checksumOk === false) {
    rewriteLine(checksumLine, "package checksum ........................ MISMATCH");
    checksumLine.className = "terminal-error";
    await sleep(240);
    appendResponse(`expected ${String(packageInfo.sha256).slice(0, 16)}...`, "terminal-meta");
    await sleep(200);
    // Exact byte counts, not the rounded MB in the progress line. A short read
    // is the likely cause and the raw numbers are what the upstream lane needs
    // to see -- where the stream stopped, against what it should have been.
    appendResponse(
      `received ${receivedBytes} of ${Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : "?"} bytes`,
      "terminal-meta"
    );
    await sleep(200);
    appendResponse("package corrupt or truncated // discarded", "terminal-error");
    await sleep(200);
    appendResponse("run download.exe again to retry", "terminal-meta");
    URL.revokeObjectURL(objectUrl);
    fallbackDownload = null;
    setTerminalState("ready");
    input.disabled = false;
    input.focus();
    return;                // never hand a corrupt file to the browser
  } else if (tooBigToHash) {
    rewriteLine(checksumLine, "package checksum ........................ skipped");
    await sleep(200);
    appendResponse(`package too large to verify in-browser (${formatBytes(blob.size)})`, "terminal-meta");
  } else {
    rewriteLine(checksumLine, "package checksum ........................ unverified");
  }
  await sleep(240);
  appendResponse("transfer buffer ......................... complete");
  await sleep(240);
  appendResponse("browser handoff ......................... ready");
  await sleep(280);
  activateFallbackDownload();
  appendResponse("download request ........................ dispatched");
  appendFallbackAction("[ retry download ]");
  // Give the browser time to actually write the file before the blob URL is
  // revoked -- roughly a second per MB, floored at a minute and capped at 15.
  const revokeAfterMs = Math.min(900000, Math.max(60000, Math.round(blob.size / (1024 * 1024)) * 1000));
  window.setTimeout(() => {
    if (fallbackDownload?.url === objectUrl) {
      URL.revokeObjectURL(objectUrl);
      fallbackDownload = null;
    }
  }, revokeAfterMs);
  setTerminalState("handoffReady");
  input.disabled = false;
  input.focus();
}

function responseLines(lines, className = "terminal-response") {
  for (const line of lines) {
    appendResponse(line, className);
  }
}

// Interpret the structured step data returned by the intent layer. Response
// text is chosen once (at commit, in VDIntents.selectResponse) — this only
// renders. Steps: print / hold / rewrite / historyRender / returnPrompt.
async function runResponse(steps) {
  const lines = {};
  for (const step of steps) {
    if (step.type === "print") {
      const el = appendResponse(step.text || "", step.className || "terminal-response");
      if (step.id) {
        lines[step.id] = el;
      }
    } else if (step.type === "hold") {
      await sleep(step.durationMs || 0);
    } else if (step.type === "rewrite") {
      const el = lines[step.targetId];
      if (el) {
        rewriteLine(el, step.text || "");
        if (step.className) {
          el.className = `output-line ${step.className}`.trim();
        }
      }
    } else if (step.type === "historyRender") {
      renderHistoryDisplay();
    }
    // "returnPrompt" is a no-op marker; the prompt returns after runCommand.
  }
}

// History shows the real session commands, with exactly one subtle fictional
// entry inserted for display only (never into commandHistory, so Up/Down recall
// stays honest). The insertion is a pure helper in the intent layer.
function renderHistoryDisplay() {
  const display = VDI.insertFictionalHistory(commandHistory, session);
  display.forEach((entry, index) => {
    appendResponse(`${String(index + 1).padStart(2, "0")}  ${entry}`);
  });
}

async function runCommand(command, normalized) {
  // Loadable ASCII game — intercept before the intent system.
  if (window.VDSnake && SNAKE_CMDS.has(normalized)) {
    appendResponse("loading snake.exe ...", "terminal-meta");
    await window.VDSnake.launch({ output: output });
    appendResponse("snake.exe // session ended", "terminal-meta");
    return;
  }
  if (window.VDPi && PI_CMDS.has(normalized)) {
    appendResponse("loading pi.exe ...", "terminal-meta");
    await window.VDPi.launch({ output: output });
    appendResponse("pi.exe // stopped", "terminal-meta");
    return;
  }
  // Destructive-root easter egg -> sudo password gate.
  if (NUKE_CMDS.has(normalized)) {
    nukeStage = "sudo";
    appendResponse("rm: /root: operation requires elevated authority", "terminal-error");
    appendResponse("[sudo] password required for root", "terminal-meta");
    return;
  }

  // Alpha tracker lives on its own subdomain -- hand the session off to it.
  if (ALPHA_CMDS.has(normalized)) {
    appendResponse("loading alpha_tracker.exe ...", "terminal-meta");
    const relay = appendResponse("opening relay ...", "terminal-meta");
    await sleep(520);
    rewriteLine(relay, "opening relay ........................... connected");
    appendResponse("> handing off to alpha.vectordrift.io", "terminal-meta");
    await sleep(760);
    window.location.href = ALPHA_URL;
    return;
  }

  // A typed address IS the signup -- no command needed. Matched on the actual
  // name@host.tld shape (see uplink.js), not merely on containing "@", so only
  // real addresses subscribe. A near-miss that is still clearly an address
  // attempt gets a format hint; anything else falls through to normal commands.
  // Runs before the intent layer so an address is never parsed as a sentence.
  if (window.VDUplink && window.VDUplink.valid(normalized)) {
    uplinkResolved = true;
    appendResponse("address detected // opening alpha uplink", "terminal-meta");
    await submitEmail(normalized);
    return;
  }
  if (window.VDUplink && window.VDUplink.looksLikeAttempt(normalized)) {
    appendResponse("> malformed address", "terminal-error");
    appendResponse("> expected name@host.tld", "terminal-meta");
    return;
  }

  // Email uplink — command-triggered. Jump straight to the email prompt (the
  // submit loop routes the next line to handleUplinkInput while uplinkStage is set).
  if (UPLINK_CMDS.has(normalized)) {
    uplinkStage = "email";
    appendResponse("vector drift // alpha email uplink", "terminal-meta");
    appendResponse("enter your email to join the alpha list", "terminal-meta");
    return;
  }

  const resolution = VDI.resolveCommand(normalized);

  if (resolution.kind === "empty") {
    appendLine("");
    return;
  }

  // Protected: only the exact normalized "download.exe" ever reaches the real
  // transfer. No fuzzy path can land here.
  if (resolution.kind === "protected") {
    // Held: the build is not ready to be handed out yet, so the key prompt never
    // opens. Nothing is typed, nothing is checked, no token is minted.
    if (DL_HOLD) {
      announceDownloadHold();
      return;
    }
    // Gate the alpha behind an access code (once per session). The submit loop
    // routes the next line to handleGateInput while dlGateStage is set.
    if (dlSessionKey) {
      // Re-check: the previous download URL was single-use and short-lived.
      await verifyKeyAndDownload(dlSessionKey);
      return;
    }
    dlGateStage = "code";
    appendResponse("restricted // alpha build", "terminal-meta");
    appendResponse("download key required", "terminal-meta");
    return;
  }

  // Utilities with DOM side-effects stay in this file.
  if (resolution.kind === "utility") {
    if (resolution.id === "downloadHint") {
      await runResponse(VDI.downloadHintSteps());
      return;
    }
    if (resolution.id === "clear") {
      output.innerHTML = "";
      output.scrollTop = 0;
      return;
    }
    return;
  }

  // Natural-language intent groups, resolved after protected/utility.
  if (resolution.kind === "intent") {
    const { steps } = VDI.selectResponse(resolution, session, rng);
    await runResponse(steps);
    return;
  }

  await runLoreOrUnknown(normalized);
}

async function runLoreOrUnknown(normalized) {
  if (normalized === "axiom") {
    axiomUseCount += 1;
    const line = appendResponse(axiomUseCount === 1 ? "namespace not found" : "you are not expected to know that identifier", "terminal-error");
    if (axiomUseCount === 1) {
      await sleep(180);
      rewriteLine(line, "namespace access denied");
      await sleep(220);
      rewriteLine(line, "namespace does not exist");
    } else {
      await sleep(600);
      rewriteLine(line, "command not found");
    }
    return;
  }

  if (normalized === "observer") {
    responseLines(["OBSERVER INTERFACE", "", "local endpoint ............... detected", "cortex handshake ............. incomplete", "recording state .............. active", "consent token ................ assumed"]);
    return;
  }

  if (normalized === "cortex") {
    responseLines(["cortex interface state ....... linked", "organic endpoint ............. present"]);
    const line = appendResponse("binding authority ............ remote");
    await sleep(350);
    const interrupt = appendResponse("do not interrupt", "terminal-error");
    await sleep(450);
    rewriteLine(line, "binding authority ............ none");
    return;
  }

  const staticLore = {
    pilot: ["pilot channel ................ none", "observer channel ............. active"],
    root: ["local root unavailable", "remote root already mounted"],
    consent: ["observer consent ............. inherited"],
    organic: ["classification accepted"],
    ghost: ["ghost buffer contains one unassigned motion signature"],
    "1980": ["system date predates system origin"],
    "1187": ["ghost sample 1187 remains active"],
    "0x00007f00": ["address belongs to a process outside local memory"],
  };

  if (normalized === "sudo") {
    sudoUseCount += 1;
    appendResponse(sudoUseCount === 1 ? "sudo: local authority unavailable" : sudoUseCount === 2 ? "sudo: remote authority declined" : "sudo: request recorded", "terminal-error");
    return;
  }

  if (staticLore[normalized]) {
    responseLines(staticLore[normalized]);
    return;
  }

  // Unknown-command bank + the one-per-session "...not designed for
  // conversation" / "yet" beat live in the intent layer (session owns the
  // counters). Lore hits above never reach here, so they never count as unknown.
  const { steps } = VDI.selectUnknown(session, rng);
  await runResponse(steps);
}

// --- Email uplink (Kit) ------------------------------------------------------
// Offered ONCE per session, after the first real command. Y/YES -> ask for an
// email inline -> POST to Kit (uplink.js) -> confirm, all in-console. The user
// never sees a Kit / Web-2.0 surface. While a stage is active, input routes here
// instead of running as a command.
let uplinkStage = null;      // null | "email"  (command-triggered; no auto-offer)
let uplinkResolved = false;  // set once a subscribe attempt completes

const UPLINK_EMAIL_PROMPT = "enter email >";
const DL_GATE_PROMPT = "download key >";
const SUDO_PROMPT = "password >";
let nukeStage = null;        // null | "sudo"

// Correct sudo password -> fake wipe, then hand the visitor to the Web 1.0 404.
async function handleNukeInput(command) {
  const typed = command.trim();
  const masked = "*".repeat(typed.length);
  if (mobileMode) { freezeMobilePrompt(masked); } else { appendCommandLine(masked, SUDO_PROMPT); }

  if (!typed) {
    nukeStage = null;
    appendResponse("sudo: authentication cancelled", "terminal-meta");
    return;
  }
  if (typed.toLowerCase() !== NUKE_SUDO_PASSWORD) {
    appendResponse("sudo: access denied", "terminal-error");
    return;   // stay in the gate (blank Enter cancels)
  }

  nukeStage = null;
  input.disabled = true;
  setTerminalState("executing");
  appendResponse("sudo: authority accepted", "terminal-meta");
  await sleep(320);
  const wipe = appendResponse("removing /root ...", "terminal-error");
  const stages = [
    "removing /root ......................... 34%",
    "removing /root ......................... 71%",
    "removing /root ........................ 100%",
    "unlinking simulation host ..............  gone",
  ];
  for (const s of stages) { await sleep(430); rewriteLine(wipe, s); }
  await sleep(420);
  appendResponse("CONNECTION TERMINATED", "terminal-error");
  await sleep(900);

  // In-page takeover rather than a navigation to /404.html: loading a new
  // document would tear down the AudioContext and hard-cut the hum bed. Staying
  // put keeps the hum running unbroken through the "404" and the rebuild.
  if (window.VD404) {
    await window.VD404.show({ beep: playConsoleBeep });
    // Rebuilt: wipe the console and let the logo animate back in, which doubles
    // as the "site restored" beat. No boot, because we never left the page.
    output.innerHTML = "";
    output.scrollTop = 0;
    if (window.renderLogoBanner) await window.renderLogoBanner(mobileMode ? { mobile: true } : undefined);
  } else {
    window.location.href = "404.html";   // fallback if the module failed to load
  }
}

// --- Alpha download gate (server-verified key) ------------------------------
// download.exe asks for a key, which is checked by the gatekeeper through the
// Worker. There is no secret in this file and nothing here decides access: the
// page only renders the gatekeeper's answer.
//
// NUKE_SUDO_PASSWORD below is NOT part of that gate -- it is the joke password
// for the destructive-root easter egg, which protects nothing.
const NUKE_SUDO_PASSWORD = "axiom";
// The accepted key is kept for the session so a second download.exe does not
// need re-typing. It is re-checked every time: the download URL is single-use
// and short-lived, so each transfer needs a freshly minted token.
let dlSessionKey = null;
let dlGateStage = null;     // null | "code"

// ⚠ THE ONE SWITCH. Flip to false to open the gate again; nothing else changes.
//
// The demo is not ready to hand out, and a key holder who downloads early gets a
// build we did not mean to ship -- so the hold is placed BEFORE the key prompt
// rather than after the check. Nothing is typed, nothing is sent to the
// gatekeeper, no token is minted and no key is spent against the rate limiter.
// A key that is never checked also cannot be told it was refused, which is why
// the copy says save it rather than anything about validity.
const DL_HOLD = false;

// Both callers say the same two lines, so they say them from one place: the
// command path (where the prompt would open) and verifyKeyAndDownload (which is
// still reachable through ?dlgatedemo, and must not transfer while held).
function announceDownloadHold() {
  appendResponse("> VECTOR DRIFT ALPHA DEMO IS NOT YET AVAILABLE FOR DOWNLOAD", "terminal-error");
  appendResponse("> save your key somewhere safe", "terminal-meta");
  appendResponse("> we'll notify you in Discord when it's live", "terminal-meta");
}

// The live desktop prompt + mobile prompt label reflect whichever input stage is
// active (download gate, uplink email, or the normal console prompt).
function livePromptLabel() {
  if (nukeStage === "sudo") return SUDO_PROMPT;
  if (dlGateStage === "code") return DL_GATE_PROMPT;
  if (uplinkStage === "email") return UPLINK_EMAIL_PROMPT;
  return null;   // -> normal console prompt
}
function applyLivePrompt() {
  if (mobileMode) return;
  const label = livePromptLabel();
  if (label) {
    promptPrefix.replaceChildren();
    const s = document.createElement("span");
    s.className = "prompt-console";
    s.textContent = label;
    promptPrefix.append(s);
  } else {
    setPromptPrefix();
  }
}
function mobilePromptLabel() { return livePromptLabel() || "root:/"; }

async function handleGateInput(command) {
  const typed = command.trim();
  const masked = "*".repeat(typed.length);   // echo the key as asterisks in history
  if (mobileMode) { freezeMobilePrompt(masked); } else { appendCommandLine(masked, DL_GATE_PROMPT); }
  if (!typed) {
    dlGateStage = null;
    appendResponse("> access cancelled", "terminal-meta");
    return;
  }
  // No format check: the server normalises case, spaces and hyphens, and the
  // key alphabet is its business, not ours.
  await verifyKeyAndDownload(typed);
}

// Runs the gate's decision table. Stays in the gate on anything retryable so a
// second key can be pasted; a blank ENTER cancels.
async function verifyKeyAndDownload(key) {
  // Second guard, deliberately duplicated. The command path already refuses
  // while DL_HOLD is set, but ?dlgatedemo opens the prompt directly and a key
  // typed into it would otherwise reach the gatekeeper and start a transfer.
  if (DL_HOLD) {
    dlGateStage = null;
    applyLivePrompt();
    announceDownloadHold();
    return;
  }
  const platform = gatekeeperPlatform(await detectTarget());
  if (!platform) {
    appendResponse("> UNSUPPORTED PLATFORM", "terminal-error");
    appendResponse("> alpha builds are macOS / Windows only", "terminal-meta");
    return;
  }

  const line = appendResponse("verifying key ...", "terminal-meta");
  let result;
  try {
    result = await checkDownloadKey(key, platform);
  } catch (error) {
    // 503 / timeout / DNS / captive-portal wifi. NOT a refusal.
    rewriteLine(line, "verifying key ........................... no answer");
    appendResponse("> COULD NOT REACH THE SERVER", "terminal-error");
    appendResponse("> key was not checked // try again shortly", "terminal-meta");
    return;
  }

  const data = result.data || {};

  if (result.status === 200 && data.url) {
    rewriteLine(line, "verifying key ........................... accepted");
    await sleep(760);            // let the acceptance land before the readout starts
    dlSessionKey = key;
    dlGateStage = null;
    applyLivePrompt();            // restore console> before the transfer runs
    session.downloadStarted = true;
    // The DMG is what a first install wants. The gatekeeper keeps `url` on the zip forever (the
    // Alpha Tracker updater reads it) and advertises the disk image BESIDE it as `installer`, so
    // prefer that when it is there and fall back to the zip when a release has none.
    const inst = data.installer && data.installer.url ? data.installer : null;
    await downloadPackage({
      url: inst ? inst.url : data.url,
      sha256: inst ? inst.sha256 : data.sha256,
      name: inst ? inst.name : null,
      build: data.build, size: data.size, platform: platform,
    });
    return;
  }

  if (result.status === 200 && data.current) {
    rewriteLine(line, "verifying key ........................... accepted");
    dlSessionKey = key;
    appendResponse(`> no build published for ${platform} yet`, "terminal-meta");
    return;
  }

  rewriteLine(line, "verifying key ........................... refused");
  if (result.status === 403 && data.error === "expired") {
    appendResponse("> KEY EXPIRED", "terminal-error");
    appendResponse("> press the button in Discord for a new one", "terminal-meta");
  } else if (result.status === 403 && data.error === "seat_taken") {
    appendResponse("> KEY ACTIVE ON ANOTHER MACHINE", "terminal-error");
  } else if (result.status === 403) {
    appendResponse("> KEY NOT RECOGNIZED", "terminal-error");
  } else if (result.status === 429) {
    appendResponse("> RATE LIMITED", "terminal-error");
    appendResponse("> 30 checks per minute per key // wait a moment", "terminal-meta");
  } else if (result.status === 400) {
    appendResponse("> RELAY SENT A MALFORMED REQUEST", "terminal-error");
    appendResponse("> this is a fault on our side, not your key", "terminal-meta");
  } else {
    appendResponse("> COULD NOT REACH THE SERVER", "terminal-error");
    appendResponse("> key was not checked // try again shortly", "terminal-meta");
  }
}

async function handleUplinkInput(command) {
  const typed = command.trim();
  if (mobileMode) { freezeMobilePrompt(typed); }
  else { appendCommandLine(typed, UPLINK_EMAIL_PROMPT); }

  // Blank line cancels out of the uplink.
  if (!typed) {
    uplinkStage = null;
    appendResponse("> uplink cancelled", "terminal-meta");
    return;
  }

  if (!window.VDUplink || !window.VDUplink.valid(typed)) {
    appendResponse("> malformed address. try again.", "terminal-error");
    return;   // stay in the email stage (prompt still "enter email >")
  }
  uplinkStage = null; uplinkResolved = true;
  await submitEmail(typed);
}

// Shared by the `email.exe` flow and by simply typing an address at the prompt.
async function submitEmail(address) {
  const pending = appendResponse("> transmitting ...", "terminal-meta");
  const ok = await window.VDUplink.subscribe(address);
  if (ok) {
    rewriteLine(pending, "> handshake accepted");
    appendResponse("> node user added to alpha manifest // await future transmission for demo", "terminal-meta");
  } else {
    rewriteLine(pending, "> uplink error. signal lost — try again later.");
  }
}

async function submitCurrentCommand() {
  if (terminalState === "downloading" || terminalState === "executing" || responseActive) {
    return;
  }

  resumeAudio();
  sfxEnter();

  // sudo password gate (destructive-root easter egg) intercepts first.
  if (nukeStage) {
    const nukeCommand = input.value;
    input.value = "";
    updateCursor();
    responseActive = true;
    try { await handleNukeInput(nukeCommand); } finally { responseActive = false; }
    if (terminalState !== "downloading" && terminalState !== "executing") {
      setTerminalState("ready");
      input.disabled = false;
      applyLivePrompt();
      if (mobileMode) appendMobilePrompt(mobilePromptLabel());
      input.focus();
    }
    return;
  }

  // Download access-code gate intercepts before any command handling while active.
  if (dlGateStage) {
    const gateCommand = input.value;
    input.value = "";
    updateCursor();
    responseActive = true;
    try { await handleGateInput(gateCommand); } finally { responseActive = false; }
    if (terminalState !== "downloading" && terminalState !== "executing") {
      setTerminalState(terminalState === "handoffReady" ? "handoffReady" : "ready");
      input.disabled = false;
      applyLivePrompt();
      if (mobileMode) appendMobilePrompt(mobilePromptLabel());
      input.focus();
    }
    return;
  }

  // Email-uplink flow intercepts BEFORE any command handling (incl. the
  // handoff-download empty-Enter shortcut) while a stage is active.
  if (uplinkStage) {
    const uplinkCommand = input.value;
    input.value = "";
    updateCursor();
    responseActive = true;
    try { await handleUplinkInput(uplinkCommand); } finally { responseActive = false; }
    input.disabled = false;
    applyLivePrompt();   // desktop: "enter email >" during email stage, else console
    if (mobileMode) appendMobilePrompt(mobilePromptLabel());
    input.focus();
    return;
  }

  if (terminalState === "handoffReady" && !input.value.trim()) {
    activateFallbackDownload();
    return;
  }

  const command = input.value;
  const normalized = normalizeCommand(command);
  input.value = "";
  updateCursor();

  if (!normalized) {
    if (mobileMode) {
      freezeMobilePrompt("");
      appendMobilePrompt("root:/");
      input.focus();
    } else {
      appendLine("");
    }
    return;
  }

  // Hidden operator channel — intercept before ANY player handling. Entry only on
  // exact `debug`; while active, ALL input routes here (player commands, intents,
  // and download.exe never run). Leaves no player history / session artifacts.
  if (DEBUG && (DEBUG.isActive() || normalized === "debug")) {
    const entering = !DEBUG.isActive();
    echoActivePrompt(command.trim());
    responseActive = true;
    try {
      if (entering) {
        await DEBUG.enter();
      } else {
        await DEBUG.handle(command.trim());
      }
    } finally {
      responseActive = false;
    }
    input.disabled = false;
    if (mobileMode) {
      appendMobilePrompt(DEBUG.isActive() ? "operator>" : "root:/");
    }
    input.focus();
    return;
  }

  if (mobileMode) {
    freezeMobilePrompt(command.trim());
  } else {
    appendCommandLine(command.trim());
  }
  commandHistory.push(command.trim());
  historyCursor = commandHistory.length;
  session.commandCount += 1;
  session.rawCommandHistory.push(command.trim());
  session.normalizedCommandHistory.push(normalized);
  setTerminalState("ready");
  responseActive = true;
  const responseStart = performance.now();
  try {
    await runCommand(command, normalized);
  } finally {
    responseActive = false;
    lastResponseMs = Math.round(performance.now() - responseStart);
  }
  if (terminalState !== "downloading" && terminalState !== "executing") {
    setTerminalState(terminalState === "handoffReady" ? "handoffReady" : "ready");
    input.disabled = false;
    applyLivePrompt();              // desktop: reflect an open gate/uplink stage, else console
    if (mobileMode) {
      appendMobilePrompt(mobilePromptLabel());
    }
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCurrentCommand();
});

input.addEventListener("input", updateCursor);

input.addEventListener("keydown", (event) => {
  resumeAudio();
  if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    sfxKey();
  }

  // Operator channel gets first refusal on navigation keys (audio browser).
  if (DEBUG && DEBUG.isActive() && DEBUG.handleKey(event)) {
    event.preventDefault();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    submitCurrentCommand();
    return;
  }

  if (event.key === "Escape" && activeTransfer) {
    event.preventDefault();
    activeTransfer.abort();
    return;
  }

  if (event.key === "ArrowUp" && commandHistory.length > 0 && terminalState !== "downloading" && terminalState !== "executing" && !(DEBUG && DEBUG.isActive())) {
    event.preventDefault();
    historyCursor = Math.max(0, historyCursor - 1);
    input.value = commandHistory[historyCursor] || "";
    updateCursor();
    return;
  }

  if (event.key === "ArrowDown" && commandHistory.length > 0 && terminalState !== "downloading" && terminalState !== "executing" && !(DEBUG && DEBUG.isActive())) {
    event.preventDefault();
    historyCursor = Math.min(commandHistory.length, historyCursor + 1);
    input.value = commandHistory[historyCursor] || "";
    updateCursor();
  }
});

document.querySelector(".terminal-content").addEventListener("pointerdown", () => {
  if (!input.disabled) {
    input.focus();
  }
});

window.addEventListener("resize", updateCursor);

// --- Operator/debug console wiring -------------------------------------------
// terminal-debug.js is a self-contained controller; this is the ONLY surface it
// touches. Every DOM/audio/boot side-effect it needs is exposed here explicitly,
// so no debug logic leaks into the player path or terminal-intents.js.
if (DEBUG) {
  DEBUG.init({
    // rendering — reuses the existing renderer only
    print: (text, className) => appendResponse(text, className),
    appendLine: (text, className) => appendLine(text, className),
    rewrite: (line, text) => rewriteLine(line, text),
    runResponse: (steps) => runResponse(steps),
    sleep: (ms) => sleep(ms),
    scramble: (text) => scrambleText(text),
    corrupt: (text, amount, shift) => corruptText(text, amount, shift),
    runAxiomReveal: (observer, cortex, resolving) => runAxiomReveal(observer, cortex, resolving),
    setPrompt: (mode) => setActivePromptPrefix(mode),
    // read-only live inspection
    vdi: VDI,
    session: () => session,
    terminalState: () => terminalState,
    lastCommand: () => session.rawCommandHistory[session.rawCommandHistory.length - 1] || "",
    lastResponseMs: () => lastResponseMs,
    mobileMode: () => mobileMode,
    // command inventories for `list commands`
    playerCommands: ["download.exe", "help", "status", "inspect", "whoami", "history", "version", "clear", "exit"],
    loreCommands: ["observer", "cortex", "pilot", "root", "sudo", "ghost", "consent", "organic", "axiom", "1980", "1187", "0x00007f00"],
    // audio sampler — real project assets + synthesized cues only
    audioBank: {
      boot: [
        { name: "initial_boot_sound.mp3", url: "assets/initial_boot_sound.mp3" },
        { name: "main_boot_sequence_v5.mp3", url: "assets/main_boot_sequence_v5.mp3" },
      ],
      terminal: [{ name: "computer_hum_looping_v5.mp3", url: "assets/computer_hum_looping_v5.mp3" }],
      ui: [
        { name: "console_beep_v2.mp3", url: "assets/console_beep_v2.mp3" },
        { name: "sfx: key", sfx: "key" },
        { name: "sfx: enter", sfx: "enter" },
      ],
      glitch: [{ name: "sfx: fast", sfx: "fast" }],
      download: [],
    },
    playAudio: (item) => {
      if (item.sfx) {
        if (item.sfx === "key") { sfxKey(); }
        else if (item.sfx === "enter") { sfxEnter(); }
        else if (item.sfx === "fast") { sfxFast(); }
        return { duration: null };
      }
      try {
        const clip = new Audio(item.url);
        clip.loop = false;
        clip.volume = 0.6;
        const played = clip.play();
        if (played && played.catch) { played.catch(() => {}); }
        return { duration: null };
      } catch (error) {
        return { unavailable: true };
      }
    },
    // reuse existing systems — no alternate logic
    resolveLatestPackage: () => resolveLatestPackage(),
    restartInteractive: () => {
      input.value = "";
      updateCursor();
      setTerminalState("ready");
    },
    restartBoot: () => { location.reload(); },
    resetSession: () => {
      const fresh = VDI.createSession();
      Object.keys(session).forEach((key) => { delete session[key]; });
      Object.assign(session, fresh);
      commandHistory.length = 0;
      historyCursor = 0;
    },
    setViewportOverride: (mode) => {
      document.documentElement.dataset.viewportOverride = mode;
    },
  });
}

async function runGlitchPreview() {
  status.hidden = true;
  form.classList.add("loading");
  const sample = [
    "[ OK ] COMBAT.MOD ............. intercept matrix allocated / protocol INTERCEPT",
    "[ OK ] THREAT.SYS ............. mass sorter active / six priority bands",
    "[ OK ] LEADCOMP.DAT ........... target lead table warmed / error below threshold",
    "[ OK ] PROXFUSE.SYS ........... proximity channel isolated / safing active",
    "[ OK ] WEAPONBUS.MOD .......... emitter lanes synchronized / discharge inhibited",
    "[ OK ] HOSTILE.IDX ............ known signatures loaded / unknown signatures 5",
    "[ OK ] WORLD.MOD .............. simulation space allocated / root read-only",
    "[ OK ] COHORT.DAT ............. population groups indexed / owner field blank",
    "MODULE              STATE       ADDRESS       OWNER          DETAIL",
    "----------------------------------------------------------------------------",
    "vd_world            READY       0x00007F00    local          signatures: 5",
    "vd_motion           READY       0x00008120    local          ghost samples: 1187",
    "vd_combat           READY       0x00009200    local          intercept matrix armed",
    "vd_scope            READY       0x0000A100    local          beam convergence nominal",
  ];
  for (const line of sample) {
    appendLine(line);
  }
  const observerLine = appendLine("vd_observer         MISSING     --------      none           interface unavailable");
  const cortexLine = appendLine("vd_cortex           WAIT        0x0000AF10    unassigned     organic bridge detected");
  const resolvingLine = appendLine("io>loader/ resolving missing interface ...");
  await sleep(400);
  await runAxiomReveal(observerLine, cortexLine, resolvingLine);
}

// DEV: ?end skips the boot and plays only the end sequence (gauges -> logo ->
// console) so the banner can be reviewed without watching the full boot.
// Combine with ?noanim (instant), ?gaugehold (freeze on gauges), ?drift=.
async function runEndSequence() {
  bootStarted = true;
  bootActive = true;
  const startedAt = performance.now();
  input.disabled = true;
  form.classList.add("loading");
  status.hidden = true;
  if (window.renderBootGauges) await window.renderBootGauges();
  await waitForContinue();
  if (window.renderLogoBanner) {
    await window.renderLogoBanner(mobileMode ? { mobile: true } : undefined);
  }
  await activateRootPrompt(startedAt, { keepOutput: true });
}

// iOS keeps HTMLAudio playing on the lock screen / when the tab is backgrounded
// (it shows up in Now Playing like a song). Pause every element and suspend the
// audio context whenever the page is hidden so nothing plays in the background.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (bootAudio) {
      try { bootAudio.initial.pause(); } catch (e) {}
      try { bootAudio.main.pause(); } catch (e) {}
      try { bootAudio.hum.pause(); } catch (e) {}
      try { bootAudio.beep.pause(); } catch (e) {}
    }
    try { if (audioCtx) audioCtx.suspend(); } catch (e) {}
  } else {
    try { if (audioCtx && linkEstablished) audioCtx.resume(); } catch (e) {}
  }
});

window.addEventListener("load", () => {
  mobileMode = isMobileDevice() || bootParams.get("view") === "mobile";
  if (mobileMode) {
    document.body.classList.add("mobile");
    // Mobile plays the main track immediately (no lead), so the glitch sits at
    // the track's own onset rather than lead + onset.
    glitchAudioMs = mainAudioGlitchMs;
  }
  if (bootParams.has("end")) {
    runEndSequence();
    return;
  }
  if (bootParams.get("scene") === "glitch") {
    runGlitchPreview();
    return;
  }
  if (mobileMode) {
    runBootMobile();
    return;
  }
  runBoot();
}, { once: true });

// Dev: ?uplinkdemo paints the full email-uplink exchange (offer -> Y -> email ->
// confirm) into the console for a visual check. No network; desktop layout.
if (bootParams.has("uplinkdemo")) {
  window.addEventListener("load", function () {
    setTimeout(function () {
      appendCommandLine("email.exe");
      appendResponse("vector drift // alpha email uplink", "terminal-meta");
      appendResponse("enter your email to join the alpha list", "terminal-meta");
      uplinkStage = "email";
      applyLivePrompt();
      input.value = "jon";
      updateCursor();
      output.scrollTop = output.scrollHeight;
      input.focus();
    }, 500);
  });
}

// Dev: ?dlgatedemo paints the download access-code gate live state for a look.
if (bootParams.has("dlgatedemo")) {
  window.addEventListener("load", function () {
    setTimeout(function () {
      appendCommandLine("download.exe");
      appendResponse("restricted // alpha build", "terminal-meta");
      appendResponse("access code required", "terminal-meta");
      dlGateStage = "code";
      applyLivePrompt();
      input.value = "axiom";
      updateCursor();
      output.scrollTop = output.scrollHeight;
      input.focus();
    }, 500);
  });
}

// Dev: ?nukedemo paints the sudo password gate (destructive-root easter egg).
if (bootParams.has("nukedemo")) {
  window.addEventListener("load", function () {
    setTimeout(function () {
      appendCommandLine("delete root");
      appendResponse("rm: /root: operation requires elevated authority", "terminal-error");
      appendResponse("[sudo] password required for root", "terminal-meta");
      nukeStage = "sudo";
      applyLivePrompt();
      input.value = "axiom";
      updateCursor();
      output.scrollTop = output.scrollHeight;
      input.focus();
    }, 500);
  });
}
