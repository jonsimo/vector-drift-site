/* Vector Drift — OST preview player. Self-contained; window.VDOst.
   Plays ~45 s clips of the soundtrack with each track's own cover art, mounted
   straight into the soundtrack/ page (no iframe, so the reticle pointer works).
   mount(el, {base}) returns {destroy}. Clips and covers are ost/NN.mp3 +
   ost/NN.jpg, built by build-ost-previews.sh (full tracks are never shipped).
   Audio only starts from a visitor gesture; if the browser blocks the first
   autoplay the player waits for Enter / a click / the play button. */
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

  // Pixel icons: '#' is a lit cell. Drawn as a grid of cells so the font never matters.
  function tri(side, withBar) {
    var rows = [], w = [1, 2, 3, 4, 5, 4, 3, 2, 1];
    for (var i = 0; i < w.length; i++) {
      var t = "#".repeat(w[i]), gap = ".".repeat(5 - w[i]);
      if (!withBar) rows.push(t + gap);
      else rows.push(side === "left" ? "#." + gap + t : t + gap + ".#");
    }
    return rows;
  }
  var ICONS = {
    play: tri("right", false),
    pause: ["##.##", "##.##", "##.##", "##.##", "##.##", "##.##", "##.##", "##.##", "##.##"],
    next: tri("right", true),
    prev: tri("left", true)
  };
  function icon(name) {
    var rows = ICONS[name], cols = rows[0].length, ico = el("span", "ost-ico");
    ico.style.setProperty("--cols", cols);
    rows.forEach(function (r) { for (var i = 0; i < r.length; i++) ico.append(el("i", r.charAt(i) === "#" ? "on" : "")); });
    return ico;
  }

  function mount(out, opts) {
    var base = (opts && opts.base) || "ost/";
    var audio = new Audio();
    audio.preload = "auto";
    audio.vdKeepPlaying = true;   // the one sound the audio guard lets run in a background tab
    audio.volume = 0.8;
    var index = 0, played = 0, done = false, blocked = false, failed = false;
    var heard = {};

    var root = el("div", "vd-ost");
    var now = el("div", "ost-now");
    var art = el("img", "ost-art"); art.width = 480; art.height = 480; art.alt = "";
    var info = el("div", "ost-info");
    var lblTrack = el("div", "ost-track");
    var lblTitle = el("div", "ost-title");
    var ctl = el("div", "ost-ctl");
    var bPrev = el("button", "ost-btn"); bPrev.type = "button"; bPrev.setAttribute("aria-label", "Previous track"); bPrev.append(icon("prev"));
    var bPlay = el("button", "ost-btn ost-btn-main"); bPlay.type = "button";
    var bNext = el("button", "ost-btn"); bNext.type = "button"; bNext.setAttribute("aria-label", "Next track"); bNext.append(icon("next"));
    ctl.append(bPrev, bPlay, bNext);
    var lblStatus = el("div", "ost-status");
    info.append(lblTrack, lblTitle, ctl, lblStatus);
    now.append(art, info);
    var list = el("div", "ost-list"); list.setAttribute("role", "list");
    var rows = TRACKS.map(function (t, i) {
      var b = el("button", "ost-row"); b.type = "button"; b.setAttribute("role", "listitem");
      var lead = el("span", "ost-lead"); lead.setAttribute("aria-hidden", "true");
      b.append(el("span", "ost-mark", " "), el("span", "ost-n", pad2(i + 1)), el("span", "ost-t", t[0]), lead, el("span", "ost-d", fmt(t[1])));
      b.addEventListener("click", function () { play(i); });
      list.append(b);
      return b;
    });
    // progress gauge, drawn like the boss HP bar: lit cells, then a dithered, darker unfilled run
    var gauge = el("div", "ost-gauge");
    var tCur = el("span", "ost-gt", "0:00");
    var seekBar = el("button", "ost-seek"); seekBar.type = "button";
    seekBar.setAttribute("role", "slider"); seekBar.setAttribute("aria-label", "Seek within preview"); seekBar.setAttribute("aria-valuemin", "0");
    var fill = el("span", "ost-fill"); seekBar.append(fill);
    var tEnd = el("span", "ost-gt ost-gt-end", "--:--");
    gauge.append(tCur, seekBar, tEnd);
    var side = el("div", "ost-side");
    side.append(list, gauge);
    root.append(now, side);
    out.replaceChildren(root);

    function setStatus(text) { lblStatus.textContent = text; }
    function renderPlayIcon() {
      var playing = !audio.paused && !failed && !blocked;
      bPlay.replaceChildren(icon(playing ? "pause" : "play"));
      bPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
    }
    function renderBar() {
      var d = audio.duration, c = audio.currentTime || 0;
      var frac = d > 0 ? Math.min(1, c / d) : 0;
      fill.style.width = (frac * 100).toFixed(3) + "%";
      tCur.textContent = fmt(c);
      tEnd.textContent = d > 0 ? fmt(d) : "--:--";
      seekBar.setAttribute("aria-valuemax", String(Math.round(d || 0)));
      seekBar.setAttribute("aria-valuenow", String(Math.round(c)));
      seekBar.setAttribute("aria-valuetext", fmt(c) + " of " + (d > 0 ? fmt(d) : "unknown"));
    }
    function renderTrack() {
      var t = TRACKS[index];
      lblTrack.textContent = "TRACK " + pad2(index + 1) + " | 45s Preview";
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
      if (list.scrollHeight > list.clientHeight && (top < list.scrollTop || top + h > list.scrollTop + list.clientHeight)) list.scrollTop = Math.max(0, top - list.clientHeight / 2 + h / 2);
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({ title: t[0], artist: ARTIST, album: ALBUM, artwork: [{ src: new URL(base + pad2(index + 1) + ".jpg", document.baseURI).href, sizes: "480x480", type: "image/jpeg" }] });
        } catch (e) {}
      }
      renderBar(); renderPlayIcon();
    }
    // Scrolled the list away and gone quiet for 5 s: bring the current track back into view.
    var idleTimer = null;
    function recentre() {
      var row = rows[index];
      if (!row || !list.isConnected || list.scrollHeight <= list.clientHeight) return;
      var top = row.offsetTop, h = row.offsetHeight;
      if (top >= list.scrollTop && top + h <= list.scrollTop + list.clientHeight) return;
      var to = Math.max(0, top - list.clientHeight / 2 + h / 2);
      try { list.scrollTo({ top: to, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } catch (e) { list.scrollTop = to; }
    }
    function armIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(recentre, 5000); }
    ["scroll", "wheel", "touchstart", "touchmove", "pointerdown", "pointermove", "keydown"].forEach(function (ev) { list.addEventListener(ev, armIdle, { passive: true }); });
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
        if (err && err.name === "NotAllowedError") { blocked = true; setStatus("PRESS PLAY"); }
        else { failed = true; setStatus("SIGNAL LOST // TRY THE NEXT TRACK"); }
        renderPlayIcon();
      });
    }
    function toggle() {
      if (failed || blocked || !audio.src) { play(index); return; }
      if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } else audio.pause();
    }
    function seekTo(t) { if (audio.duration > 0) audio.currentTime = Math.max(0, Math.min(audio.duration - 0.25, t)); }
    function seekBy(delta) { seekTo((audio.currentTime || 0) + delta); }
    function seekFromPointer(e) {
      var r = seekBar.getBoundingClientRect();
      if (r.width) seekTo((e.clientX - r.left) / r.width * audio.duration);
    }
    function destroy() {
      if (done) return;
      done = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      document.removeEventListener("keydown", onKey);
      audio.pause(); audio.removeAttribute("src"); audio.load();
      if ("mediaSession" in navigator) { try { navigator.mediaSession.metadata = null; ["play", "pause", "nexttrack", "previoustrack"].forEach(function (a) { navigator.mediaSession.setActionHandler(a, null); }); } catch (e) {} }
      return { played: played };
    }
    // Space, N/P and the arrow keys work anywhere on the page except while typing
    // or while a button has focus (a focused button turns Space/Enter into a click).
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      var k = e.key;
      if ((k === " " || k === "Enter") && tag === "BUTTON") return;
      var handled = true;
      if (k === " " || k === "Spacebar") toggle();
      else if (k === "n" || k === "N") play(index + 1);
      else if (k === "p" || k === "P") play(index - 1);
      else if (k === "ArrowRight") seekBy(5);
      else if (k === "ArrowLeft") seekBy(-5);
      else handled = false;
      if (handled) e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    bPlay.addEventListener("click", toggle);
    bPrev.addEventListener("click", function () { play(index - 1); });
    bNext.addEventListener("click", function () { play(index + 1); });
    var dragging = false;
    seekBar.addEventListener("pointerdown", function (e) { dragging = true; try { seekBar.setPointerCapture(e.pointerId); } catch (x) {} seekFromPointer(e); });
    seekBar.addEventListener("pointermove", function (e) { if (dragging) seekFromPointer(e); });
    seekBar.addEventListener("pointerup", function () { dragging = false; });
    seekBar.addEventListener("pointercancel", function () { dragging = false; });
    seekBar.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { seekBy(5); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === "ArrowLeft") { seekBy(-5); e.preventDefault(); e.stopPropagation(); }
    });
    audio.addEventListener("timeupdate", renderBar);
    audio.addEventListener("loadedmetadata", renderBar);
    // timeupdate only fires ~4x a second, so while audio plays the gauge is driven per frame
    var raf = 0;
    function frame() { raf = 0; renderBar(); if (!audio.paused && !done) raf = requestAnimationFrame(frame); }
    function startFrames() { if (!raf && !done) raf = requestAnimationFrame(frame); }
    audio.addEventListener("playing", function () { setStatus("PLAYING"); renderPlayIcon(); startFrames(); });
    audio.addEventListener("pause", function () { if (!audio.ended && !failed && !blocked && !done) setStatus("PAUSED"); renderPlayIcon(); renderBar(); });
    audio.addEventListener("waiting", function () { setStatus("LOADING"); });
    audio.addEventListener("ended", function () { play(index + 1); });
    audio.addEventListener("error", function () { if (done) return; failed = true; setStatus("SIGNAL LOST // TRY THE NEXT TRACK"); renderPlayIcon(); });
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("play", function () { toggle(); });
        navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
        navigator.mediaSession.setActionHandler("nexttrack", function () { play(index + 1); });
        navigator.mediaSession.setActionHandler("previoustrack", function () { play(index - 1); });
      } catch (e) {}
    }
    play(0);
    return { destroy: destroy };
  }
  window.VDOst = { mount: mount, TRACKS: TRACKS };
})();
