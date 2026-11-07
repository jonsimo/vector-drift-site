/* Vector Drift — ambient hum + quiet click beeps for the site. Window.VDAmbient.
   Same loop as the boot page's hum bed (assets/computer_hum_looping_v5.mp3, -2 dB),
   so the sound carries on after the boot hands over. The sound toggle persists in
   localStorage ("vd_sound"), shared with the boot page. Browsers that block audio
   before a gesture start the hum on the first tap or key. */
(function () {
  "use strict";
  var KEY = "vd_sound", VOL = 0.5, FADE = 1.8, DUCK = 0.1, BEEP = 0.2;
  var off = false, duck = false, ctx = null, gain = null, src = null, buf = null, loading = false;
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) {}

  function makeLoop(buffer, fadeSec) {
    try {
      var sr = buffer.sampleRate, fade = Math.max(1, Math.min(Math.floor(fadeSec * sr), Math.floor(buffer.length / 2)));
      var len = buffer.length - fade;
      if (len <= fade) return buffer;
      var out = ctx.createBuffer(buffer.numberOfChannels, len, sr);
      for (var ch = 0; ch < buffer.numberOfChannels; ch++) {
        var s = buffer.getChannelData(ch), d = out.getChannelData(ch), i;
        for (i = fade; i < len; i++) d[i] = s[i];
        for (i = 0; i < fade; i++) { var k = i / fade; d[i] = s[i] * Math.sin(k * Math.PI / 2) + s[len + i] * Math.cos(k * Math.PI / 2); }
      }
      return out;
    } catch (e) { return buffer; }
  }
  function level() { return off ? 0 : (duck ? VOL * DUCK : VOL); }
  function ramp(to, sec) {
    if (!gain || !ctx) return;
    try { var t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t); gain.gain.linearRampToValueAtTime(Math.max(0.0001, to), t + sec); } catch (e) {}
  }
  function play() {
    if (src || !buf || !ctx) return;
    try { src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start(); ramp(level(), FADE); } catch (e) { src = null; }
  }
  function init() {
    if (ctx || loading) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    gain = ctx.createGain(); gain.gain.value = 0.0001; gain.connect(ctx.destination);
    loading = true;
    fetch("../assets/computer_hum_looping_v5.mp3").then(function (r) { return r.arrayBuffer(); })
      .then(function (d) { return new Promise(function (res, rej) { ctx.decodeAudioData(d, res, rej); }); })
      .then(function (b) { buf = makeLoop(b, 0.45); loading = false; play(); })
      .catch(function () { loading = false; });
  }
  function wake() { if (ctx && ctx.state === "suspended" && !off) { try { ctx.resume(); } catch (e) {} } }
  ["pointerdown", "keydown", "touchend", "click"].forEach(function (ev) { window.addEventListener(ev, wake, true); });

  function paint() {
    var btn = document.getElementById("sound-toggle");
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(!off));
    btn.setAttribute("aria-label", off ? "Sound is off. Turn sound on" : "Sound is on. Turn sound off");
    var st = btn.querySelector(".sound-state");
    if (st) st.textContent = off ? "[OFF]" : "[ON]";
  }
  function set(on) {
    off = !on;
    try { localStorage.setItem(KEY, off ? "off" : "on"); } catch (e) {}
    paint();
    if (off) { ramp(0.0001, 0.25); setTimeout(function () { if (off && ctx) { try { ctx.suspend(); } catch (e) {} } }, 320); return; }
    init(); wake(); try { if (ctx) ctx.resume(); } catch (e) {}
    play(); ramp(level(), 0.8);
  }
  var lastBeep = 0, clickA = null;
  try { clickA = new Audio("../assets/console_click_v1.mp3"); clickA.preload = "auto"; clickA.volume = BEEP; clickA.load(); } catch (e) {}
  function beep() {
    if (off) return;
    var now = Date.now(); if (now - lastBeep < 90) return; lastBeep = now;
    try {
      if (!clickA) { clickA = new Audio("../assets/console_click_v1.mp3"); clickA.preload = "auto"; clickA.volume = BEEP; }
      clickA.currentTime = 0; clickA.play().catch(function () {});
    } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest("a[href], button, summary, .vd-row, .vd-quick, .thumb");
    if (!el || el.id === "sound-toggle" || el.closest(".console-dock")) return;
    beep();
  }, true);
  document.addEventListener("DOMContentLoaded", function () {
    paint();
    var btn = document.getElementById("sound-toggle");
    if (btn) btn.addEventListener("click", function () { set(off); beep(); });
  });
  window.VDAmbient = {
    setDuck: function (v) { duck = !!v; ramp(level(), 0.6); },
    isOff: function () { return off; },
    beep: beep
  };
  if (!off) init();
})();
