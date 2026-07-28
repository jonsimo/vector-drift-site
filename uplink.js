/* Vector Drift — email uplink (Kit / ConvertKit). Self-contained; window.VDUplink.
   The terminal owns the on-screen flow (offer -> email -> confirm); this module only
   holds the Kit config + the network POST + email validation, so nothing Web-2.0 ever
   renders and the only thing to configure lives right here.

   SETUP (one line): open your Kit form -> Embed -> "HTML". Copy the <form action="...">
   URL (it ends in /forms/<id>/subscriptions) and paste it into FORM_ACTION below.
   That endpoint is a PUBLIC form submission URL — no API key, safe on the client, and
   Kit returns CORS headers so a browser fetch to it works cross-origin. */
(function () {
  "use strict";

  // Kit form uid 10871da90d (from the JS embed data-uid). The embed submits to
  // /forms/<uid>/subscriptions; no API key needed, CORS-enabled, client-safe.
  var FORM_ACTION = "https://app.kit.com/forms/10871da90d/subscriptions";

  function valid(email) {
    return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  // Resolves true on accept, false on any failure. Never throws.
  function subscribe(email) {
    if (!valid(email)) return Promise.resolve(false);
    if (FORM_ACTION.indexOf("REPLACE_WITH") === 0) {
      // Not configured yet: fail closed so the console shows the error path, not a fake success.
      try { console.warn("[VDUplink] FORM_ACTION not set in uplink.js"); } catch (e) {}
      return Promise.resolve(false);
    }
    var body = new URLSearchParams();
    body.set("email_address", email.trim());
    return fetch(FORM_ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: body.toString()
    })
      .then(function (r) { return r.ok; })
      // Fallback if a future Kit change drops CORS: opaque no-cors POST still reaches
      // them; we can't read status, so treat a completed request as accepted.
      .catch(function () {
        return fetch(FORM_ACTION, {
          method: "POST", mode: "no-cors",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString()
        }).then(function () { return true; }).catch(function () { return false; });
      });
  }

  window.VDUplink = { valid: valid, subscribe: subscribe };
})();
