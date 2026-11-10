/* Vector Drift — small logo, now and then. Every so often the masthead logo
   redraws itself the way the big boot logo appears: row by row, each character
   scrambles through glyphs and then locks into place, left to right, with a
   brief bright flash as it lands. About a second long. Skipped for reduced
   motion, while the tab is hidden and while the boot handoff is still arriving. */
(function () {
  "use strict";
  var logo = document.querySelector(".small-logo");
  if (!logo) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var GLYPHS = "!<>-_\\/[]{}=+*^?#%$&@01:;~".split("");
  var ROW_GAP = 48, COL_GAP = 3.2, SCRAMBLE = 120, FLASH = 110;   // ms
  var running = false;

  function esc(s) { return s === "&" ? "&amp;" : s === "<" ? "&lt;" : s === ">" ? "&gt;" : s; }

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
    var cells = [];   // {r, c, ch, side, showAt, lockAt}
    var lastLock = 0;
    rows.forEach(function (row, r) {
      [row[0], row[1]].forEach(function (text, side) {
        var base = side ? row[0].length : 0;
        for (var c = 0; c < text.length; c++) {
          if (text[c] === " ") continue;
          var showAt = r * ROW_GAP + (base + c) * COL_GAP * .5;
          var lockAt = showAt + SCRAMBLE + c * COL_GAP;
          cells.push({ r: r, c: c, ch: text[c], side: side, showAt: showAt, lockAt: lockAt, seed: (r * 31 + c * 17 + side * 7) % 97 });
          if (lockAt > lastLock) lastLock = lockAt;
        }
      });
    });
    var end = lastLock + FLASH + 40;
    var t0 = performance.now();

    function frame(now) {
      var t = now - t0;
      if (t >= end || document.hidden) { logo.replaceChildren.apply(logo, saved); running = false; return; }
      var grid = rows.map(function (row) { return [new Array(row[0].length).fill(" "), new Array(row[1].length).fill(" ")]; });
      var cls = rows.map(function (row) { return [new Array(row[0].length).fill(0), new Array(row[1].length).fill(0)]; });
      cells.forEach(function (k) {
        if (t < k.showAt) return;
        if (t < k.lockAt) { grid[k.r][k.side][k.c] = GLYPHS[(((t / 50) | 0) * 37 + k.seed) % GLYPHS.length]; cls[k.r][k.side][k.c] = 1; }
        else { grid[k.r][k.side][k.c] = k.ch; cls[k.r][k.side][k.c] = (t - k.lockAt < FLASH) ? 2 : 0; }
      });
      var html = "";
      rows.forEach(function (row, r) {
        [0, 1].forEach(function (side) {
          var out = "";
          grid[r][side].forEach(function (ch, c) {
            var e = esc(ch), k = cls[r][side][c];
            out += k === 1 ? "<span class='lg'>" + e + "</span>" : k === 2 ? "<span class='lh'>" + e + "</span>" : e;
          });
          html += side ? "<span class='drift'>" + out + "</span>" : out;
        });
        if (r < rows.length - 1) html += "\n";
      });
      logo.innerHTML = html;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // first one a few seconds after arriving, then every 20-30 s
  function later(ms) { setTimeout(function () { play(); later(20000 + Math.random() * 10000); }, ms); }
  later(8000);
  window.VDLogoFlicker = { play: play };
})();
