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
    ["soundtrack/", "soundtrack", "SYNTH SOUNDTRACK"],
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

  function line(text, cls, parent) {
    var d = document.createElement("div");
    d.className = "output-line" + (cls ? " " + cls : "");
    if (text) d.textContent = text;
    (parent || out()).appendChild(d);
    out().scrollTop = out().scrollHeight;
    return d;
  }
  // The logo and the directory are pinned at the top of the console: they never
  // scroll away, console text scrolls up and off under the rule below them.
  function pinEl() {
    var o = out(), pin = o.querySelector(".vd-pin");
    if (pin) return pin;
    pin = document.createElement("div");
    pin.className = "vd-pin";
    var banner = o.querySelector(".vd-banner");
    if (banner) { o.insertBefore(pin, banner); pin.appendChild(banner); } else o.insertBefore(pin, o.firstChild);
    try { pin.style.background = getComputedStyle(document.body).backgroundColor; } catch (e) {}
    return pin;
  }

  // The outline must never push the big logo off the top. Fit it to the room the
  // console has: tighter rows, then no intro line. The list stays one column (Jon 2026-11-10); a very short window scrolls instead. Mobile flows
  // naturally (the page scrolls), so it is left alone.
  function fitOutline() {
    var o = out();
    if (!o || document.body.classList.contains("mobile")) return;
    var cls = ["hand-snug", "hand-tight", "hand-nointro"];
    cls.forEach(function (c) { o.classList.remove(c); });
    o.classList.remove("pin-off");
    var pin = o.querySelector(".vd-pin");
    // the pinned block may use at most ~66% of the window's console room; console text needs the rest
    function tooTall() { return pin ? pin.offsetHeight > (window.innerHeight - 118) * 0.66 : o.scrollHeight - o.clientHeight > 1; }
    for (var i = 0; i < cls.length && tooTall(); i++) o.classList.add(cls[i]);
    if (tooTall()) o.classList.add("pin-off");   // a very short window: let everything scroll instead
    o.scrollTop = o.classList.contains("pin-off") ? 0 : o.scrollHeight;
  }
  var fitTimer = 0;
  window.addEventListener("resize", function () { if (document.querySelector(".hand-outline")) { clearTimeout(fitTimer); fitTimer = setTimeout(fitOutline, 120); } });

  api.printOutline = async function () {
    var o = out();
    if (!o || o.querySelector(".hand-outline")) return;
    var pin = pinEl();
    // first console line is the command that produced the directory: console>root:/ dir
    var cmd = line("", "hand-outline hand-cmd", pin);
    var pc = document.createElement("span"); pc.className = "prompt-console"; pc.textContent = "console>";
    var typed = document.createElement("span"); typed.className = "hand-typed";
    cmd.append(pc, document.createTextNode(" "), typed);
    await sleep(220);
    for (var ci = 0; ci < 3; ci++) { typed.textContent += "dir".charAt(ci); await sleep(110); }
    await sleep(180);
    var list = document.createElement("div"); list.className = "hand-list"; pin.appendChild(list);
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
    // Cross-page view transitions: the browser holds this page and morphs the logo, so leave straight away.
    if (typeof window.onpageswap !== "undefined" && !reduced()) {
      await new Promise(function (r) { setTimeout(r, 90); });
      location.assign(urlFor(section));
      resetTimer = setTimeout(resetDeparture, 6000);
      return;
    }
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
