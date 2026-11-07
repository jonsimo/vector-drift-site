/* Arrival half of the boot handoff. The boot's big logo box arrives in
   sessionStorage (read by arrive-head.js); the masthead logo starts there and
   settles into place, then the page loads in line by line, console style. */
(function () {
  "use strict";
  var h = window.__vdHandoff, root = document.documentElement;
  if (!h) return;
  var logo = document.querySelector(".small-logo");
  function reveal() { root.classList.remove("vd-arriving"); }
  if (!logo) { reveal(); return; }
  var fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]) : Promise.resolve();
  fonts.then(function () {
    var r = logo.getBoundingClientRect();
    if (!(r.width > 0)) { reveal(); return; }
    var s = h.w / r.width;
    logo.style.transformOrigin = "0 0";
    logo.style.transition = "none";
    logo.style.transform = "translate(" + (h.x - r.left) + "px," + (h.y - r.top) + "px) scale(" + s + ")";
    root.classList.add("vd-landing");
    void logo.offsetWidth;
    logo.style.transition = "transform 900ms cubic-bezier(.22,.8,.2,1)";
    logo.style.transform = "none";
    setTimeout(function () {
      var targets = [].concat(
        [].slice.call(document.querySelectorAll(".site-status, .social, .mobile-toggle, .command-form")),
        [].slice.call(document.querySelectorAll("#directory .rail-heading, #directory .root-link, #directory .vd-row, #directory .rail-actions > *, #directory > .vd-quick")),
        [].slice.call(document.querySelectorAll(".content-top > *, #section-content > *")),
        [].slice.call(document.querySelectorAll(".site-foot > *"))
      ).filter(function (n) { return n.offsetParent !== null || n.closest(".masthead"); });
      targets.forEach(function (n) { n.classList.add("vd-wait"); });
      reveal();
      var step = Math.min(48, 1100 / Math.max(1, targets.length));
      targets.forEach(function (n, i) {
        n.style.animationDelay = Math.round(i * step) + "ms";
        n.classList.add("vd-in");
        setTimeout(function () { n.classList.remove("vd-wait", "vd-in"); n.style.animationDelay = ""; }, i * step + 420);
      });
      setTimeout(function () { logo.style.transition = ""; logo.style.transformOrigin = ""; root.classList.remove("vd-landing"); }, 1100);
    }, 520);
  });
})();
