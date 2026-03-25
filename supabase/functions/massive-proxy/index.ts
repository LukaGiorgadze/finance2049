import "@supabase/functions-js/edge-runtime.d.ts";
import { createRemoteJWKSet, jwtVerify } from "jose";

const MASSIVE_BASE_URL = "https://api.massive.com";
const MASSIVE_API_KEY = Deno.env.get("MASSIVE_API_KEY")!;
const JWKS = createRemoteJWKSet(
  new URL(`${Deno.env.get("SUPABASE_URL")}/auth/v1/.well-known/jwks.json`),
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    await jwtVerify(token, JWKS);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Proxy ─────────────────────────────────────────────────────────────────
  try {
    const url = new URL(req.url);

    // The client sends the Massive API path as a query param: ?path=/v2/snapshot/...
    const massivePath = url.searchParams.get("path");
    if (!massivePath) {
      return new Response(JSON.stringify({ error: "Missing 'path' parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build the upstream URL, forwarding all query params except "path"
    const upstream = new URL(massivePath, MASSIVE_BASE_URL);
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "path") {
        upstream.searchParams.set(key, value);
      }
    }
    upstream.searchParams.set("apiKey", MASSIVE_API_KEY);

    const response = await fetch(upstream.toString());

    return new Response(response.body, {
      status: response.status,
      headers: {
        ...CORS,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Proxy error", detail: String(error) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
