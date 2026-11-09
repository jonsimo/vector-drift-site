/* Vector Drift — boot -> site handoff. After the logo, the first console message
   is a rough directory outline; clicking a file pushes the console away, keeps
   the big logo on screen, and carries it into the site (revamp/) where it
   settles into the masthead (revamp/arrive.js reads what we save here).
   Pure helpers are exported for tests; the DOM part only runs in a browser. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.VDHandoff = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var KEY = "vd_handoff", SITE = "revamp/", MAX_AGE = 15000;
  // [file name shown, site section, description]
  var OUTLINE = [
    ["about.txt", "about", "ABOUT THE GAME"],
    ["media/", "media", "STILLS + VIDEO"],
    ["audio/", "soundtrack", "SYNTH SOUNDTRACK"],
    ["devlog/", "devlog", "DEVELOPMENT UPDATES"],
    ["links.lnk", "links", "COMMUNITY + UPDATES"],
    ["download.exe", "download", "DEMO STATUS"],
  ];
  function urlFor(section) { return SITE + "?from=boot#" + section; }
  function build(section, rect, vw, vh, now) {
    return { t: now, section: section, x: rect.left, y: rect.top, w: rect.width, h: rect.height, vw: vw, vh: vh };
  }
  function isFresh(h, now) {
    return !!h && typeof h.t === "number" && now - h.t >= 0 && now - h.t <= MAX_AGE && h.w > 0 && h.h > 0;
  }
  var api = { OUTLINE: OUTLINE, KEY: KEY, urlFor: urlFor, build: build, isFresh: isFresh };
  if (typeof document === "undefined") return api;

  var leaving = false;
  function out() { return document.getElementById("terminal-output"); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, window.__vdSkip ? 0 : ms); }); }
  function reduced() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function line(text, cls) {
    var d = document.createElement("div");
    d.className = "output-line" + (cls ? " " + cls : "");
    if (text) d.textContent = text;
    out().appendChild(d);
    out().scrollTop = out().scrollHeight;
    return d;
  }

  // The outline must never push the big logo off the top. Fit it to the room the
  // console has: tighter rows, then no intro line, then two columns. Mobile flows
  // naturally (the page scrolls), so it is left alone.
  function fitOutline() {
    var o = out();
    if (!o || document.body.classList.contains("mobile")) return;
    var cls = ["hand-snug", "hand-tight", "hand-nointro", "hand-cols"];
    cls.forEach(function (c) { o.classList.remove(c); });
    for (var i = 0; i < cls.length && o.scrollHeight - o.clientHeight > 1; i++) o.classList.add(cls[i]);
    if (o.scrollHeight - o.clientHeight > 1) o.scrollTop = 0; else o.scrollTop = o.scrollHeight;
  }
  var fitTimer = 0;
  window.addEventListener("resize", function () { if (document.querySelector(".hand-outline")) { clearTimeout(fitTimer); fitTimer = setTimeout(fitOutline, 120); } });

  api.printOutline = async function () {
    var o = out();
    if (!o || o.querySelector(".hand-outline")) return;
    prepClick();
    line("10.0.1.00> click a file to enter", "hand-outline");
    await sleep(160);
    var list = document.createElement("div"); list.className = "hand-list"; o.appendChild(list);
    for (var i = 0; i < OUTLINE.length; i++) {
      var f = OUTLINE[i];
      var row = document.createElement("div"); row.className = "output-line hand-line"; row.dataset.go = f[1];
      var a = document.createElement("a"); a.className = "hand-row"; a.href = urlFor(f[1]); a.dataset.go = f[1];
      var mark = document.createElement("span"); mark.className = "hand-mark";
      var name = document.createElement("span"); name.className = "hand-name"; name.textContent = f[0];
      a.append(mark, name);
      var head = document.createElement("span"); head.className = "hand-head";
      var dots = document.createElement("span"); dots.className = "hand-dots"; dots.setAttribute("aria-hidden", "true");
      head.append(a, dots);
      var desc = document.createElement("span"); desc.className = "hand-desc"; desc.textContent = f[2];
      a.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); api.go(this.dataset.go, this);
      });
      // the description is part of the same target for a tap or click, but only the name carries the reticle
      var viaRow = function () { var r = this.closest(".hand-line").querySelector(".hand-row"); api.go(this.closest(".hand-line").dataset.go, r); };
      desc.addEventListener("click", viaRow);
      dots.addEventListener("click", viaRow);
      row.append(head, desc); list.appendChild(row);
      o.scrollTop = o.scrollHeight;
      await sleep(70);
    }
    fitOutline();
  };

  // Departure: console lines clear away bottom-up, the logo stays put, and the
  // logo's on-screen box travels with us so the site can pick it up from there.
  // Quiet confirmation beep on a click, unless the visitor turned sound off.
  // A short, trimmed click (the old beep file had ~0.33 s of near-silence before
  // the tone, which read as lag) kept loaded so a tap sounds immediately.
  var clickAudio = null;
  function prepClick() {
    if (clickAudio) return;
    try { clickAudio = new Audio("assets/console_click_v1.mp3"); clickAudio.preload = "auto"; clickAudio.volume = 0.2; clickAudio.load(); } catch (e) {}
  }
  function clickBeep() {
    try {
      if (localStorage.getItem("vd_sound") === "off") return;
      prepClick();
      clickAudio.currentTime = 0;
      clickAudio.play().catch(function () {});
    } catch (e) {}
  }
  // Back/forward can restore this page frozen mid-departure (bfcache), and a slow
  // connection can leave it half faded: put the outline back so it is usable.
  var resetTimer = 0;
  function resetDeparture() {
    clearTimeout(resetTimer);
    if (!leaving && !document.body.classList.contains("vd-leaving")) return;
    leaving = false;
    document.body.classList.remove("vd-leaving");
    var o = out();
    if (o) {
      [].forEach.call(o.querySelectorAll(".vd-line-out"), function (n) { n.classList.remove("vd-line-out"); n.style.transitionDelay = ""; });
      [].forEach.call(o.querySelectorAll(".picked"), function (n) { n.classList.remove("picked"); });
    }
    var input = document.getElementById("terminal-input");
    if (input) { input.disabled = false; }
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    if (window.VDResumeAmbient) { try { window.VDResumeAmbient(); } catch (e) {} }
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted || leaving) resetDeparture(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && leaving) resetDeparture(); });
  api.go = async function (section, rowEl) {
    if (leaving) return;
    leaving = true;
    clickBeep();
    var o = out();
    var logo = o && (o.querySelector(".vd-banner #logo") || o.querySelector(".vd-banner"));
    var now = Date.now();
    try {
      if (logo && !reduced()) sessionStorage.setItem(KEY, JSON.stringify(build(section, logo.getBoundingClientRect(), window.innerWidth, window.innerHeight, now)));
      sessionStorage.setItem("vd_site_entered", "1");
    } catch (e) {}
    if (rowEl) rowEl.classList.add("picked");
    var input = document.getElementById("terminal-input");
    if (input) { input.disabled = true; input.blur(); }
    document.body.classList.add("vd-leaving");
    if (window.VDFadeOutAudio) window.VDFadeOutAudio(520);
    var lines = reduced() ? [] : Array.prototype.filter.call(o.querySelectorAll(".output-line, .mobile-prompt"), function (n) { return !n.closest(".vd-banner") && !(rowEl && n.contains(rowEl)); }).reverse();
    var step = Math.min(26, 420 / Math.max(1, lines.length));
    lines.forEach(function (n, i) { n.style.transitionDelay = Math.round(i * step) + "ms"; n.classList.add("vd-line-out"); });
    await new Promise(function (r) { setTimeout(r, reduced() ? 0 : Math.min(760, lines.length * step + 320)); });
    location.assign(urlFor(section));
    // if the page is still here after a few seconds (poor connection), make it usable again
    resetTimer = setTimeout(resetDeparture, 6000);
  };
  return api;
});
