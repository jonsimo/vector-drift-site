/* Phones and tablets that open vectordrift.io go straight to the instant /GO/
   page instead of the boot sequence. Runs first, before anything else loads.
   Not redirected: any visit with a query that is not just tracking junk
   (?ref=expo from the GO page's "visit the site" button, ?terminal, dev flags),
   so the full boot stays one tap away and there is never a redirect loop.
   replace() keeps the redirect out of history, so Back does not bounce. */
(function () {
  try {
    var ua = navigator.userAgent || "";
    var mobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|Silk/i.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!mobile) return;
    if (location.pathname !== "/" && location.pathname !== "/index.html") return;
    var q = new URLSearchParams(location.search), plain = true;
    q.forEach(function (v, k) { if (!/^(utm_|fbclid$|igshid$|gclid$)/i.test(k)) plain = false; });
    if (!plain) return;
    location.replace("/GO/");
  } catch (e) {}
})();
