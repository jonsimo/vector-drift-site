/* Runs first (blocking, in <head>) so the very first paint of a boot handoff is
   black instead of a flash of the finished page. arrive.js does the animation;
   the timer below guarantees the page can never stay hidden. */
(function () {
  try { sessionStorage.setItem("vd_site_entered", "1"); } catch (e) {}
  try {
    if (!new URLSearchParams(location.search).has("from")) return;
    // the browser's view transition does the handoff when it can (see handoff.js); the manual fly-in is the fallback
    if (typeof window.onpagereveal !== "undefined" && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) { sessionStorage.removeItem("vd_handoff"); return; }
    var raw = sessionStorage.getItem("vd_handoff");
    if (!raw) return;
    sessionStorage.removeItem("vd_handoff");
    var h = JSON.parse(raw);
    if (!h || Date.now() - h.t > 15000 || !(h.w > 0)) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.__vdHandoff = h;
    var root = document.documentElement;
    root.classList.add("vd-arriving");
    setTimeout(function () { root.classList.remove("vd-arriving", "vd-landing"); }, 3500);
  } catch (e) {}
})();
