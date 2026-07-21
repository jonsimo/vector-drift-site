// Vector Drift download proxy.
//
// GitHub release-asset host (release-assets.githubusercontent.com) sends no
// Access-Control-Allow-Origin header, so the browser cannot stream the bytes
// cross-origin. This Worker re-streams the asset with CORS headers so the
// terminal can read real progress and hand off a finished Blob.
//
// Usage:  https://dl.vectordrift.io/?url=<browser_download_url>
// Only asset URLs under the codex-jr-downloads release path are allowed
// (this is not an open proxy), AND only requests carrying an allowed browser
// Origin are served (curl, hotlinks, and address-bar hits get 403) so the
// Worker cannot be turned into free re-hosting bandwidth for the assets.

const ALLOWED_ORIGIN = "https://vectordrift.io";
const ALLOWED_PREFIX = "https://github.com/jonsimo/codex-jr-downloads/releases/download/";

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
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Type, Content-Disposition, Accept-Ranges, Content-Range",
    "Access-Control-Max-Age": "86400",
  };
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

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    // Reject non-browser / cross-site callers before touching upstream.
    if (!isAllowedOrigin(origin)) {
      return new Response("forbidden origin", { status: 403, headers: corsHeaders(origin) });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target || !target.startsWith(ALLOWED_PREFIX)) {
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
