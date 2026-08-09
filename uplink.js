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

  // Kit form NUMERIC id 9734489 (embed uid 10871da90d maps to this; the
  // /forms/<id>/subscriptions endpoint wants the numeric id). No API key,
  // CORS-enabled (ACAO *), client-safe.
  var FORM_ACTION = "https://app.kit.com/forms/9734489/subscriptions";

  // name@host.tld -- the TLD must be letters (2-24), so "a@b", "a@b.", "a@b.5"
  // and other near-misses are rejected. A dotted host still works, so
  // name@mail.example.co.uk matches.
  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,24}$/;

  function valid(email) {
    return typeof email === "string" && EMAIL_RE.test(email.trim());
  }

  // Clearly an address attempt (single token, something before the @) even if it
  // is malformed -- lets the console answer with a format hint instead of
  // "command not found", without hijacking unrelated input that contains "@".
  function looksLikeAttempt(text) {
    return typeof text === "string" && /^[^\s@]+@\S*$/.test(text.trim());
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
      // Kit answers HTTP 200 even on failure; the JSON body carries the real
      // result (status:"failed" + errors). Parse it — don't trust r.ok alone.
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (j) { return j && typeof j.status === "string" ? j.status !== "failed" : !!(j && j.ok); })
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

  window.VDUplink = { valid: valid, looksLikeAttempt: looksLikeAttempt, subscribe: subscribe };
})();
