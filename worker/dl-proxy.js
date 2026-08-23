// Vector Drift download proxy.
//
// GitHub release-asset host (release-assets.githubusercontent.com) sends no
// Access-Control-Allow-Origin header, so the browser cannot stream the bytes
// cross-origin. This Worker re-streams the asset with CORS headers so the
// terminal can read real progress and hand off a finished Blob.
//
// Usage:  https://dl.vectordrift.io/?url=<browser_download_url>
// Only asset URLs under the allowlisted release / token paths are allowed
// (this is not an open proxy), AND only requests carrying an allowed browser
// Origin are served (curl, hotlinks, and address-bar hits get 403) so the
// Worker cannot be turned into free re-hosting bandwidth for the assets.

const ALLOWED_ORIGIN = "https://vectordrift.io";
// Upstreams this proxy will stream. Kept as an explicit prefix allowlist, NOT a
// hostname or regex test: the gatekeeper's token URLs need streaming too (it
// sends no CORS on any route, so the browser cannot read those bytes itself and
// the console would lose its transfer readout).
const ALLOWED_PREFIXES = [
  "https://github.com/jonsimo/codex-jr-downloads/releases/download/",
  "https://alpha.vectordrift.io/download/",
];

function isAllowedTarget(target) {
  return typeof target === "string" && ALLOWED_PREFIXES.some((prefix) => target.startsWith(prefix));
}

// Key checking is proxied to the Alpha Tracker gatekeeper. The gatekeeper sends
// NO CORS headers on purpose -- an Access-Control-Allow-Origin there would hand
// every site on the internet a key-testing oracle running in visitors' browsers.
// Calling it from inside this Worker is server-side, so CORS never applies.
const GATEKEEPER_CHECK = "https://alpha.vectordrift.io/check";
const PRODUCT = "vector-drift";

// The site fetches this Worker cross-origin, so the browser always attaches an
// Origin header. Production plus localhost (for local dev) are allowed; anything
// else (missing Origin from curl, or a foreign site hotlinking) is refused.
function isAllowedOrigin(origin) {
  return origin === ALLOWED_ORIGIN
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
}

// Response headers worth forwarding to the browser. Content-Length/Type are
// CORS-safelisted, but Content-Disposition (filename) and range headers are not,
// so they must be named in Access-Control-Expose-Headers below.
const FORWARD_HEADERS = [
  "Content-Length",
  "Content-Type",
  "Content-Disposition",
  "Accept-Ranges",
  "Content-Range",
  "ETag",
  "Last-Modified",
];

function corsHeaders(origin) {
  return {
    // Echo only a validated origin; fall back to the canonical site otherwise.
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ALLOWED_ORIGIN,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Type, Content-Disposition, Accept-Ranges, Content-Range",
    "Access-Control-Max-Age": "86400",
  };
}

// POST /check -- verify a download key and hand back the gatekeeper's answer.
// The response is relayed VERBATIM, status included, so the page can tell a
// refusal (403) apart from "we could not ask" (503/timeout/network).
// The key is never logged: not on success, not in a catch, not behind a flag.
async function handleCheck(request, origin) {
  const json = (status, obj) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "bad request" });
  }

  const key = body && typeof body.key === "string" ? body.key : "";
  const platform = body && typeof body.platform === "string" ? body.platform : "";
  if (!key || !platform) {
    return json(400, { error: "bad request" });
  }

  let upstream;
  try {
    upstream = await fetch(GATEKEEPER_CHECK, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // `product` is set HERE and never taken from the browser: without it an
      // Alpha Tracker key typed into this page would quietly be offered the
      // right build for the wrong gate. `device_id` is deliberately absent --
      // a browser has no vd_device.id, and the seat belongs to the machine that
      // RUNS the game, so the gatekeeper skips seating when it is missing.
      body: JSON.stringify({ key, platform, product: PRODUCT }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Could not ask. This is NOT a refusal and the page must not render it as one.
    return json(503, { error: "unreachable" });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      // Preflight: only advertise CORS access to an allowed origin.
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Reject non-browser / cross-site callers before touching upstream.
    if (!isAllowedOrigin(origin)) {
      return new Response("forbidden origin", { status: 403, headers: corsHeaders(origin) });
    }

    if (request.method === "POST") {
      if (new URL(request.url).pathname !== "/check") {
        return new Response("not found", { status: 404, headers: corsHeaders(origin) });
      }
      return handleCheck(request, origin);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!isAllowedTarget(target)) {
      return new Response("forbidden target", { status: 403, headers: corsHeaders(origin) });
    }

    const range = request.headers.get("Range");
    let upstream;
    try {
      upstream = await fetch(target, {
        method: request.method,
        redirect: "follow",
        headers: range ? { Range: range } : {},
      });
    } catch {
      return new Response("upstream unreachable", { status: 502, headers: corsHeaders(origin) });
    }

    const headers = new Headers(corsHeaders(origin));
    for (const name of FORWARD_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) {
        headers.set(name, value);
      }
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
