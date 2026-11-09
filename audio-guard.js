/* Vector Drift — audio guard. Nothing may make noise while the page is not on
   screen (background tab, minimised window, locked phone). Loaded first on the
   site pages; it wraps HTMLMediaElement.play and AudioContext so every sound the
   site makes is covered, now or later, and puts it back when the page returns.
   A play() that arrives while hidden is held, not dropped, and starts on return.
   The one exception is the OST player: it sets audio.vdKeepPlaying so a listener
   can switch tabs and keep the music. */
(function () {
  "use strict";
  var seen = new Set();        // every media element that has been played
  var held = new Set();        // media paused or held by the guard
  var suspended = new Set();   // audio contexts suspended by the guard
  var contexts = new Set();

  var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
  var realPlay = proto && proto.play;
  if (realPlay) {
    proto.play = function () {
      seen.add(this);
      if (document.hidden && !this.vdKeepPlaying) { held.add(this); return Promise.resolve(); }
      return realPlay.apply(this, arguments);
    };
  }

  ["AudioContext", "webkitAudioContext"].forEach(function (name) {
    var Real = window[name];
    if (!Real) return;
    function Guarded() {
      var c = new Real(arguments[0]);
      contexts.add(c);
      if (document.hidden) { try { c.suspend(); } catch (e) {} suspended.add(c); }
      return c;
    }
    Guarded.prototype = Real.prototype;
    window[name] = Guarded;
  });

  function hide() {
    contexts.forEach(function (c) {
      if (c.state === "running") { try { c.suspend(); suspended.add(c); } catch (e) {} }
    });
    seen.forEach(function (m) { if (!m.paused && !m.vdKeepPlaying) { held.add(m); try { m.pause(); } catch (e) {} } });
  }
  function show() {
    suspended.forEach(function (c) { try { c.resume(); } catch (e) {} });
    suspended.clear();
    held.forEach(function (m) {
      try { var p = realPlay.call(m); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    });
    held.clear();
  }
  // read-only status, used by the tests: how much is making noise right now
  window.VDAudioGuard = {
    playing: function () {
      var n = 0;
      seen.forEach(function (m) { if (!m.paused) n++; });
      contexts.forEach(function (c) { if (c.state === "running") n++; });
      return n;
    },
    held: function () { return held.size + suspended.size; }
  };
  document.addEventListener("visibilitychange", function () { if (document.hidden) hide(); else show(); });
  window.addEventListener("pagehide", hide);
})();
