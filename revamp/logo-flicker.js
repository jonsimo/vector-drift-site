/* Vector Drift — small logo glitch sweep. Every 15-30 s (random, counted start to start) a soft band
   of scrambling glyphs travels across the masthead logo from the left edge to the right edge and off.
   The logo never goes blank: only the cells under the band scramble (glitch cyan), the cells it has
   just left flash hot for a moment and settle, and the band enters and leaves from outside the logo,
   so nothing hard-cuts in or out. About 2.6 s per pass. The constant flicker is CSS (sections.css).
   Skipped for reduced motion, while the tab is hidden and while the boot handoff is still arriving. */
(function () {
  "use strict";
  var logo = document.querySelector(".small-logo");
  if (!logo) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var GLYPHS = "!<>-_\\/[]{}=+*^?#%$&@01:;~".split("");
  var DUR = 2600;          // ms for one pass
  var BAND = 20;           // band width in columns
  var SLANT = 1.6;         // columns the band leans per row, like the italic logo
  var TICK = 70;           // ms a scrambled glyph holds before changing
  var running = false;

  function esc(s) { return s === "&" ? "&amp;" : s === "<" ? "&lt;" : s === ">" ? "&gt;" : s; }
  function ease(x) { return 0.5 - 0.5 * Math.cos(Math.PI * x); }
  // cheap deterministic noise in [0,1)
  function rnd(a, b) { var n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return n - Math.floor(n); }

  // Read the logo's rows once: [left text, right ("drift") text]
  function readRows() {
    var rows = [], left = "", right = "";
    logo.childNodes.forEach(function (n) {
      if (n.nodeType === 3) {
        var parts = n.nodeValue.split("\n");
        left += parts[0];
        if (parts.length > 1) { rows.push([left, right]); right = ""; left = parts[parts.length - 1]; }
      } else if (n.nodeType === 1 && n.classList.contains("drift")) right += n.textContent;
    });
    rows.push([left, right]);
    return rows;
  }

  function play() {
    if (running || document.hidden || document.documentElement.classList.contains("vd-arriving")) return;
    var rows = readRows();
    if (rows.length < 2) return;
    running = true;
    var saved = Array.prototype.map.call(logo.childNodes, function (n) { return n.cloneNode(true); });
    var width = 0;
    rows.forEach(function (row) { width = Math.max(width, row[0].length + row[1].length); });
    var t0 = performance.now();

    function frame(now) {
      var t = now - t0;
      if (t >= DUR || document.hidden) { logo.replaceChildren.apply(logo, saved); running = false; return; }
      var centre = -BAND / 2 + (width + BAND + rows.length * SLANT) * ease(t / DUR);
      var step = (t / TICK) | 0, html = "";
      rows.forEach(function (row, r) {
        [0, 1].forEach(function (side) {
          var text = row[side], base = side ? row[0].length : 0, out = "";
          for (var c = 0; c < text.length; c++) {
            var ch = text[c];
            if (ch === " ") { out += ch; continue; }
            var x = base + c + r * SLANT, d = x - centre, a = Math.abs(d) / (BAND / 2);
            if (a >= 1) { out += esc(ch); continue; }
            var p = 1 - a;                                   // 1 at the band's core, 0 at its soft edge
            if (rnd(x * 3 + r, step) < p * 0.8) out += "<span class='lg'>" + esc(GLYPHS[(rnd(r + c * 7, step + 11) * GLYPHS.length) | 0]) + "</span>";
            else if (d < 0 && rnd(x + step, r) < p) out += "<span class='lh'>" + esc(ch) + "</span>";   // just left behind: hot flash
            else out += esc(ch);
          }
          html += side ? "<span class='drift'>" + out + "</span>" : out;
        });
        if (r < rows.length - 1) html += "\n";
      });
      logo.innerHTML = html;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Loops across every 15-30 s, random, counted from the start of each pass.
  function later(ms) { setTimeout(function () { play(); later(15000 + Math.random() * 15000); }, ms); }
  later(8000 + Math.random() * 7000);
  window.VDLogoFlicker = { play: play };
})();
