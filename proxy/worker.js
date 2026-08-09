/**
 * billSplitter scan proxy — a tiny Cloudflare Worker (free tier) that lets
 * every phone scan receipts with NO API key on the client. Your Anthropic
 * key lives here as a Worker secret and is injected server-side.
 *
 * Deploy (once):
 *   cd proxy
 *   npx wrangler deploy
 *   npx wrangler secret put ANTHROPIC_API_KEY     # paste your sk-ant-… key
 *
 * Then set the Worker URL as a GitHub Actions repo variable named
 * ANTHROPIC_PROXY_URL and redeploy the site.
 *
 * Guardrails (this endpoint is public — these cap the blast radius):
 *   - Only POST /v1/messages is forwarded
 *   - Origin allowlist (your Pages site + localhost dev)
 *   - Model allowlist + max_tokens cap
 *   - Request body size cap
 *   - Per-isolate rate limit (best-effort; also set a Cloudflare WAF
 *     rate-limiting rule on the route for a hard guarantee)
 */

const ALLOWED_ORIGINS = [
  "https://aunirbhan.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];
const ALLOWED_MODELS = ["claude-opus-5"];
const MAX_BODY_BYTES = 3_000_000; // room for a downscaled receipt photo
const MAX_TOKENS_CAP = 16000;
const RATE_LIMIT_PER_MIN = 30; // per isolate, best-effort

const hits = new Map();

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const allowed = ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o));
    const cors = corsHeaders(allowed ? origin : ALLOWED_ORIGINS[0]);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!allowed) return json({ error: "origin not allowed" }, 403, cors);
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

    const url = new URL(request.url);
    if (url.pathname !== "/v1/messages") return json({ error: "not found" }, 404, cors);

    // best-effort per-IP throttle
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const now = Date.now();
    const windowStart = now - 60_000;
    const list = (hits.get(ip) ?? []).filter((t) => t > windowStart);
    if (list.length >= RATE_LIMIT_PER_MIN) return json({ error: "slow down" }, 429, cors);
    list.push(now);
    hits.set(ip, list);

    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413, cors);

    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return json({ error: "invalid json" }, 400, cors);
    }
    if (!ALLOWED_MODELS.includes(body.model)) return json({ error: "model not allowed" }, 400, cors);
    if (typeof body.max_tokens !== "number" || body.max_tokens > MAX_TOKENS_CAP) {
      body.max_tokens = MAX_TOKENS_CAP;
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": "application/json", ...cors },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
