/* Vector Drift — in-page "404" takeover. Self-contained; window.VD404.
   Reached by deleting root in the terminal. This deliberately does NOT navigate:
   a real page load would tear down the AudioContext and hard-cut the hum bed, so
   instead a full-viewport overlay is painted over the console and removed again
   on rebuild. Same page, same audio graph -> the hum runs unbroken start to end.
   (The standalone /404.html still exists for genuine missing paths.)
   show() resolves once the rebuild finishes and the overlay is gone. */
(function () {
  "use strict";

  var ART = [
    "+---------------------------------------------------+",
    "|                                                   |",
    "|     ###     ###     #########     ###     ###     |",
    "|     ###     ###    ###     ###    ###     ###     |",
    "|     ###     ###    ###     ###    ###     ###     |",
    "|     ###     ###    ###     ###    ###     ###     |",
    "|     ###########    ###     ###    ###########     |",
    "|     ###########    ###     ###    ###########     |",
    "|             ###    ###     ###            ###     |",
    "|             ###    ###     ###            ###     |",
    "|             ###     #########             ###     |",
    "|                                                   |",
    "|                ?directory not found               |",
    "|                                                   |",
    "+---------------------------------------------------+"
  ].join("\n");

  var W = 20, STEPS = 12;          // gauge geometry, matches renderBootGauges
  var GAUGE_MS = 2700;             // per gauge -> ~19.9s total
  var ITEMS = ["index.db", "console", "ascii.fnt", "assets", "audio.pak", "root.img"];

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // Styles live in logo-reveal.css: the page CSP (style-src 'self') blocks
  // dynamically injected <style> elements, so an inline stylesheet silently
  // does nothing.

  function gaugeText(item, pct) {
    var fl = Math.round(pct / 100 * W);
    return "LOADING:/ " + (item + "            ").slice(0, 12) +
      "  [" + new Array(fl + 1).join("#") + new Array(W - fl + 1).join("-") + "]  " +
      ("  " + Math.round(pct)).slice(-3) + "%";
  }

  // opts: { beep: fn }  -> beep() is the console beep from the terminal.
  function show(opts) {
    opts = opts || {};
    var beep = typeof opts.beep === "function" ? opts.beep : function () {};

    return new Promise(function (resolve) {
      var host = document.createElement("div");
      host.id = "vd404";
      var screen = document.createElement("pre");
      host.appendChild(screen);
      document.body.appendChild(host);

      var lines = (ART + "\n\n@#REBUILD#\n@#RESTORE#").split("\n");
      function paint() {
        screen.innerHTML = lines.map(esc).join("\n")
          .replace("@#REBUILD#", "@<a data-op=\"rebuild\">rebuild site index</a>")
          .replace("@#RESTORE#", "@<a data-op=\"restore\">restore root</a><span class=\"cur\"></span>");
      }
      paint();

      function push(t) { lines.push(t); render(); }
      function setLast(t) { lines[lines.length - 1] = t; render(); }
      function render() { screen.innerHTML = lines.map(esc).join("\n"); }

      function gauge(item) {
        push(gaugeText(item, 0));
        var i = 0;
        return new Promise(function (done) {
          (function step() {
            i += 1;
            var p = (i === STEPS) ? 1 : Math.max(0, Math.min(0.96, i / STEPS + (Math.random() - 0.5) * 0.18));
            setLast(gaugeText(item, p * 100));
            if (i >= STEPS) { setTimeout(done, GAUGE_MS / STEPS); return; }
            setTimeout(step, GAUGE_MS / STEPS);
          })();
        });
      }

      async function run(op) {
        lines = [];
        beep();                              // command accepted
        push("@" + op);
        push("");
        push("congratulations // you deleted the entire site");
        push("thank you for rebuilding from the safety server");
        push("");
        await sleep(900);
        push("%contacting safety server ............... ok");
        await sleep(700);
        push("");
        for (var i = 0; i < ITEMS.length; i++) { await gauge(ITEMS[i]); }
        push("");
        await sleep(450);
        beep();                              // recovery finished
        push("%rebuild complete // remounting <root>");
        await sleep(700);
        push("%reconnecting");
        await sleep(900);
        host.style.transition = "opacity .3s ease";   // fade out, hand back to the console
        host.style.opacity = "0";
        await sleep(320);
        host.remove();
        resolve({ op: op });
      }

      host.addEventListener("click", function (e) {
        var a = e.target && e.target.closest ? e.target.closest("a[data-op]") : null;
        if (!a) return;
        e.preventDefault();
        run(a.getAttribute("data-op") === "restore" ? "restore root" : "rebuild site index");
      });
    });
  }

  window.VD404 = { show: show };

  // Dev: ?fake404 shows the takeover straight away.
  if (new URLSearchParams(location.search).has("fake404")) {
    window.addEventListener("load", function () { setTimeout(function () { show({}); }, 400); });
  }
})();
