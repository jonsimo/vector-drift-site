/* Vector Drift — loadable pi streamer. Self-contained; window.VDPi.
   Streams the digits of pi one at a time into the console output (matching the
   console look), starting after "3.", until the user hits ENTER (or Q/ESC).
   Digits come from Gibbons' unbounded spigot algorithm (BigInt, no deps), so it
   can run indefinitely. launch() resolves on stop, so the prompt returns after. */
(function () {
  "use strict";

  var DIGITS_PER_SEC = 7;   // stream pace (~40% faster than 5)

  // Subtle per-digit tick — quiet + ultra-short so a fast stream of them stays gentle.
  var _actx = null;
  function _ac() { if (!_actx) { try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return _actx; }
  function playTick() {
    var ac = _ac(); if (!ac) return;
    try {
      if (ac.state === "suspended") ac.resume();
      var t = ac.currentTime;
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(1250, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.022, t + 0.002);   // very quiet
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);  // ultra-fast decay
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.032);
    } catch (e) {}
  }

  // Gibbons unbounded spigot: returns the next pi digit each call (3, 1, 4, 1, ...).
  function makePiGen() {
    var q = 1n, r = 0n, t = 1n, k = 1n, n = 3n, l = 3n;
    return function next() {
      while (true) {
        if (4n * q + r - t < n * t) {
          var d = n;
          var nr = 10n * (r - n * t);
          var nn = (10n * (3n * q + r)) / t - 10n * n;
          q = 10n * q; r = nr; n = nn;
          return d;
        }
        var nr2 = (2n * q + r) * l;
        var nn2 = (q * (7n * k + 2n) + r * l) / (t * l);
        q = q * k; t = t * l; n = nn2; r = nr2; k = k + 1n; l = l + 2n;
      }
    };
  }

  function launch(opts) {
    opts = opts || {};
    var output = opts.output || document.getElementById("terminal-output");
    if (!output) return Promise.resolve({ digits: 0 });

    return new Promise(function (resolve) {
      var el = document.createElement("div");
      el.className = "vd-pi";
      var head = document.createElement("div");
      head.className = "vd-pi-head";
      head.textContent = "pi.exe   ·   streaming π   ·   ENTER to stop";
      var bodyEl = document.createElement("div");
      bodyEl.className = "vd-pi-body";
      var statEl = document.createElement("div");
      statEl.className = "vd-pi-stat";
      el.appendChild(head);
      el.appendChild(bodyEl);
      el.appendChild(statEl);
      output.appendChild(el);

      var gen = makePiGen();
      gen();                       // consume the leading 3 (rendered as the "3." prefix)
      var body = "", count = 0, stopped = false, t0 = performance.now();

      function draw() {
        bodyEl.textContent = "π = 3." + body;   // chain leads with the symbol
        statEl.textContent = "π digits: " + count;
        output.scrollTop = output.scrollHeight;
      }
      draw();

      var timer = setInterval(function () {
        var d = gen();
        count++;
        body += d.toString();          // continuous digits — wrap at the container width
        playTick();
        draw();
      }, Math.round(1000 / DIGITS_PER_SEC));

      function stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        document.removeEventListener("keydown", onKey, true);
        head.textContent = "pi.exe   ·   stopped   ·   " + count + " digits";
        output.scrollTop = output.scrollHeight;
        resolve({ digits: count });
      }

      function onKey(e) {
        var k = e.key;
        if (k === "Enter" || k === "Escape" || k === "q" || k === "Q") {
          e.preventDefault(); e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          if (performance.now() - t0 < 350) return;   // ignore the command's own submit-Enter
          stop();
        }
      }
      document.addEventListener("keydown", onKey, true);
    });
  }

  window.VDPi = { launch: launch };

  // Dev: ?pidemo clears the output + launches for a quick look.
  if (new URLSearchParams(location.search).has("pidemo")) {
    window.addEventListener("load", function () {
      setTimeout(function () {
        var out = document.getElementById("terminal-output");
        if (out) out.innerHTML = "";
        launch({});
      }, 500);
    });
  }
})();
