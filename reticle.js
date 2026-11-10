/* Vector Drift — reticle pointer. Corner brackets follow the mouse and expand
   to frame whatever is clickable underneath (a target lock), with a faint
   phosphor trail. Fine pointers only; touch devices keep their normal behaviour.
   Hidden through the boot and shown (with the connect-gate style flicker) when
   the page fires "vd:console-ready". CSS lives in reticle.css (CSP-safe). */
(function () {
  "use strict";
  if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;
  var CLICKABLE = "a[href], button:not(:disabled), summary, [role=button], .vd-row, .vd-quick, .vd-thumb, .hand-row";
  var html = document.documentElement;
  var layer = document.createElement("div");
  layer.id = "vd-cursor-layer";
  layer.className = "idle";   // stay invisible until the first real mouse move
  document.body.appendChild(layer);
  html.classList.add("vd-cur-boot", "vd-cur-hide");

  var mx = -100, my = -100, started = false;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function flickerIn() {
    await wait(rnd(380, 620));
    for (var i = 0, seq = [true, false, true, false, true]; i < seq.length; i++) {
      html.classList.toggle("vd-cur-boot", !seq[i]);
      await wait(seq[i] ? rnd(40, 90) : rnd(50, 110));
    }
    html.classList.remove("vd-cur-boot");
  }
  window.addEventListener("vd:console-ready", flickerIn, { once: true });

  function mkRet(opacity) {
    var r = document.createElement("div");
    r.className = "vd-cur-ret";
    r.style.opacity = String(opacity);
    r.innerHTML = "<i></i><i></i><i></i><i></i>";
    return r;
  }
  function mkDot(opacity) { var d = document.createElement("div"); d.className = "vd-cur-dot"; d.style.opacity = String(opacity); return d; }
  var rets = [mkRet(0.12), mkRet(0.22), mkRet(0.36), mkRet(1)];   // ghosts first so the lead draws on top
  var dots = [mkDot(0.1), mkDot(0.16), mkDot(0.24), mkDot(0.34), mkDot(0.46), mkDot(1)];
  rets.concat(dots).forEach(function (n) { layer.appendChild(n); });
  var box = rets.map(function () { return { x: mx - 11, y: my - 11, w: 22, h: 22 }; });
  var pts = dots.map(function () { return { x: mx, y: my }; });
  var target = { x: mx - 11, y: my - 11, w: 22, h: 22 };

  // Moving between neighbouring targets must not drop the reticle back to its small
  // pointer size in the gap between them: a pointer within MAG px of a target counts
  // as on it, so the box glides from one target straight to the next.
  var MAG = 28;
  function magnet() {
    var best = null, bestD = Infinity, list = document.querySelectorAll(CLICKABLE);
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var dx = mx < r.left ? r.left - mx : mx > r.right ? mx - r.right : 0;
      var dy = my < r.top ? r.top - my : my > r.bottom ? my - r.bottom : 0;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= MAG && d < bestD) { best = list[i]; bestD = d; }
    }
    return best;
  }
  // Rows have a tall hit-area (easy to press); the reticle frames just their text, without the marker glyph.
  var SNUG = ".vd-row, .hand-row, .file-link";
  function snug(t) {
    if (t.matches && t.matches(SNUG)) {
      var w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        return /\S/.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest(".mark, .hand-mark")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
      var first = w.nextNode(), last = first, n;
      while ((n = w.nextNode())) last = n;
      if (first) {
        var rg = document.createRange(); rg.setStartBefore(first); rg.setEndAfter(last);
        var rr = rg.getBoundingClientRect();
        if (rr.width && rr.height) return rr;
      }
    }
    return t.getBoundingClientRect();
  }
  function aim(el) {
    var t = el && el.closest && el.closest(CLICKABLE);
    if (!t) t = magnet();
    rets[rets.length - 1].classList.toggle("lock", !!t);
    if (t) {
      var r = snug(t), pad = 4;
      target = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
    } else target = { x: mx - 11, y: my - 11, w: 22, h: 22 };
  }
  function ease(a, b, k) {
    a.x += (b.x - a.x) * k; a.y += (b.y - a.y) * k;
    if (b.w !== undefined) { a.w += (b.w - a.w) * k; a.h += (b.h - a.h) * k; }
  }
  function tick() {
    for (var i = box.length - 1; i >= 0; i--) {
      var lead = i === box.length - 1;
      ease(box[i], lead ? target : box[i + 1], lead ? 0.5 : 0.24);
      var b = box[i], el = rets[i];
      el.style.width = b.w + "px"; el.style.height = b.h + "px";
      el.style.transform = "translate(" + b.x + "px," + b.y + "px)";
    }
    for (var j = pts.length - 1; j >= 0; j--) {
      var last = j === pts.length - 1;
      ease(pts[j], last ? { x: mx, y: my } : pts[j + 1], last ? 1 : 0.32);
      dots[j].style.transform = "translate(" + (pts[j].x - 1.5) + "px," + (pts[j].y - 1.5) + "px)";
    }
    requestAnimationFrame(tick);
  }
  document.addEventListener("mousemove", function (e) {
    mx = e.clientX; my = e.clientY;
    if (!started) { started = true; box.forEach(function (b) { b.x = mx - 11; b.y = my - 11; }); pts.forEach(function (p) { p.x = mx; p.y = my; }); requestAnimationFrame(tick); }
    layer.classList.remove("idle");
    aim(e.target);
  }, { passive: true });
  // Keyboard is driving: hide until the mouse moves again.
  window.addEventListener("keydown", function (e) { if (e.key && e.key.indexOf("Arrow") === 0) layer.classList.add("idle"); }, true);
  document.addEventListener("mouseleave", function () { layer.classList.add("idle"); });
  // Re-aim after the page redraws under a still mouse (rows appearing, sections changing).
  var pending = false;
  new MutationObserver(function () {
    if (!started || pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; aim(document.elementFromPoint(mx, my)); });
  }).observe(document.body, { childList: true, subtree: true });
})();
