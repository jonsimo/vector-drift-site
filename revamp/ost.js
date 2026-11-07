/* Vector Drift — OST preview player. Self-contained; window.VDOst.
   Plays ~45 s clips of the soundtrack with each track's own cover art, inside
   the console program frame. launch() resolves when the visitor quits, so the
   console prompt returns after (same contract as VDSnake / VDPi).
   Clips and covers are ost/NN.mp3 + ost/NN.jpg, built by build-ost-previews.sh
   (full tracks are never shipped). Audio only starts from a visitor gesture;
   if the browser blocks the first autoplay the player waits for Enter / a click. */
(function () {
  "use strict";
  var ARTIST = "root:/vector_drift", ALBUM = "Vector Drift OST";
  // [title, full track length in seconds] — order matches ost/NN.mp3
  var TRACKS = [
    ["ANTIMATTER",120],
    ["BROOD",128],
    ["CALIBRATION HAS FAILED",180],
    ["COURSE UNKNOWN",127],
    ["DATA ERASURE",180],
    ["DEADLOCK",67],
    ["DECAY AND ATTRITION",148],
    ["DRIFT OR DIE",96],
    ["EMPTINESS BETWEEN SIGNALS",120],
    ["FATAL EXCEPTION 0E",90],
    ["FINALITY",179],
    ["GALAXY JUMP",60],
    ["GO TO SPACE THEY SAID",70],
    ["GRAVITY FLUX",113],
    ["INITIALIZE VECTORS",182],
    ["LUX CACHE",180],
    ["OUTGUNNED V2",154],
    ["PULSE WAVES",180],
    ["RACE CONDITION",180],
    ["REBOOT>SAFE MODE",175],
    ["ROOTKIT",210],
    ["SO YOU WANT TO DRIFT…",73],
    ["WARP DRIVE ONLINE",120]
  ];
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + pad2(s % 60); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function launch(opts) {
    var out = opts.output, base = opts.base || "ost/";
    return new Promise(function (resolve) {
      var audio = new Audio();
      audio.preload = "auto";
      audio.volume = 0.8;
      var index = 0, played = 0, done = false, blocked = false, failed = false;
      var heard = {};

      var root = el("div", "vd-ost");
      var now = el("div", "ost-now");
      var art = el("img", "ost-art"); art.width = 480; art.height = 480; art.alt = "";
      var info = el("div", "ost-info");
      var lblTrack = el("div", "ost-track");
      var lblTitle = el("div", "ost-title");
      var bar = el("button", "ost-bar"); bar.type = "button"; bar.setAttribute("aria-label", "Seek within preview");
      var lblTime = el("div", "ost-time");
      var lblStatus = el("div", "ost-status");
      info.append(lblTrack, lblTitle, bar, lblTime, lblStatus);
      now.append(art, info);
      var list = el("div", "ost-list"); list.setAttribute("role", "list");
      var rows = TRACKS.map(function (t, i) {
        var b = el("button", "ost-row"); b.type = "button"; b.setAttribute("role", "listitem");
        b.append(el("span", "ost-mark", " "), el("span", "ost-n", pad2(i + 1)), el("span", "ost-t", t[0]), el("span", "ost-d", fmt(t[1])));
        b.addEventListener("click", function () { play(i); });
        list.append(b);
        return b;
      });
      root.append(now, list);
      out.replaceChildren(root);

      function setStatus(text) { lblStatus.textContent = text; }
      function renderBar() {
        var d = audio.duration, c = audio.currentTime || 0;
        var BAR = window.matchMedia("(max-width:560px)").matches ? 16 : 26;
        var frac = d > 0 ? Math.min(1, c / d) : 0, f = Math.round(frac * BAR);
        bar.textContent = "[" + "#".repeat(f) + "-".repeat(BAR - f) + "]";
        lblTime.textContent = fmt(c) + " / " + (d > 0 ? fmt(d) : "--:--") + "   VOL " + Math.round(audio.volume * 100) + "%";
      }
      function renderTrack() {
        var t = TRACKS[index];
        lblTrack.textContent = "TRACK " + pad2(index + 1) + " / " + TRACKS.length + " // PREVIEW CLIP";
        lblTitle.textContent = t[0];
        art.alt = "Cover art for " + t[0];
        art.src = base + pad2(index + 1) + ".jpg";
        rows.forEach(function (r, i) {
          var on = i === index;
          r.classList.toggle("on", on);
          r.querySelector(".ost-mark").textContent = on ? ">" : " ";
          if (on) r.setAttribute("aria-current", "true"); else r.removeAttribute("aria-current");
        });
        var row = rows[index], top = row.offsetTop, h = row.offsetHeight;
        if (top < list.scrollTop || top + h > list.scrollTop + list.clientHeight) list.scrollTop = Math.max(0, top - list.clientHeight / 2 + h / 2);
        if ("mediaSession" in navigator) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({ title: t[0], artist: ARTIST, album: ALBUM, artwork: [{ src: new URL(base + pad2(index + 1) + ".jpg", document.baseURI).href, sizes: "480x480", type: "image/jpeg" }] });
          } catch (e) {}
        }
        renderBar();
      }
      function play(i) {
        if (done) return;
        index = (i + TRACKS.length) % TRACKS.length;
        failed = false; blocked = false;
        if (!heard[index]) { heard[index] = true; played++; }
        audio.src = base + pad2(index + 1) + ".mp3";
        renderTrack();
        setStatus("LOADING");
        var p = audio.play();
        if (p && p.catch) p.catch(function (err) {
          if (err && err.name === "AbortError") return;
          if (err && err.name === "NotAllowedError") { blocked = true; setStatus("PRESS ENTER OR CLICK A TRACK TO PLAY"); }
          else { failed = true; setStatus("SIGNAL LOST // PRESS N FOR THE NEXT TRACK"); }
        });
      }
      function toggle() {
        if (failed || blocked || !audio.src) { play(index); return; }
        if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } else audio.pause();
      }
      function seek(delta) { if (audio.duration > 0) audio.currentTime = Math.max(0, Math.min(audio.duration - 0.25, audio.currentTime + delta)); }
      function volume(delta) { audio.volume = Math.max(0, Math.min(1, Math.round((audio.volume + delta) * 10) / 10)); renderBar(); }
      function quit() {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey);
        audio.pause(); audio.removeAttribute("src"); audio.load();
        if ("mediaSession" in navigator) { try { navigator.mediaSession.metadata = null; ["play", "pause", "nexttrack", "previoustrack"].forEach(function (a) { navigator.mediaSession.setActionHandler(a, null); }); } catch (e) {} }
        resolve({ played: played });
      }
      function onKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var k = e.key;
        // A focused button turns Space/Enter into its own click; don't act twice.
        if ((k === " " || k === "Enter") && e.target && e.target.tagName === "BUTTON") return;
        var handled = true;
        if (k === " " || k === "Spacebar" || k === "Enter") toggle();
        else if (k === "ArrowDown" || k === "n" || k === "N") play(index + 1);
        else if (k === "ArrowUp" || k === "p" || k === "P") play(index - 1);
        else if (k === "ArrowRight") seek(5);
        else if (k === "ArrowLeft") seek(-5);
        else if (k === "+" || k === "=") volume(0.1);
        else if (k === "-" || k === "_") volume(-0.1);
        else if (k === "Escape" || k === "q" || k === "Q") quit();
        else handled = false;
        if (handled) e.preventDefault();
      }
      document.addEventListener("keydown", onKey);
      bar.addEventListener("click", function (e) {
        var r = bar.getBoundingClientRect();
        if (audio.duration > 0 && r.width) audio.currentTime = Math.max(0, Math.min(audio.duration - 0.25, (e.clientX - r.left) / r.width * audio.duration));
      });
      audio.addEventListener("timeupdate", renderBar);
      audio.addEventListener("loadedmetadata", renderBar);
      audio.addEventListener("volumechange", renderBar);
      audio.addEventListener("playing", function () { setStatus("PLAYING"); });
      audio.addEventListener("pause", function () { if (!audio.ended && !failed && !blocked && !done) setStatus("PAUSED"); });
      audio.addEventListener("waiting", function () { setStatus("LOADING"); });
      audio.addEventListener("ended", function () { play(index + 1); });
      audio.addEventListener("error", function () { if (done) return; failed = true; setStatus("SIGNAL LOST // PRESS N FOR THE NEXT TRACK"); });
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.setActionHandler("play", function () { toggle(); });
          navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
          navigator.mediaSession.setActionHandler("nexttrack", function () { play(index + 1); });
          navigator.mediaSession.setActionHandler("previoustrack", function () { play(index - 1); });
        } catch (e) {}
      }
      play(0);
    });
  }
  window.VDOst = { launch: launch, TRACKS: TRACKS };
})();
