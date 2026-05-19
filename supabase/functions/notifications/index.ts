import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Platform = "ios" | "android";

interface RegisterBody {
  fcmToken?: string;
  platform?: Platform;
  appVersion?: string;
}

interface UnregisterBody {
  fcmToken?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function getRoute(req: Request) {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    throw new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    if (!payload.sub) {
      throw new Error("JWT is missing subject");
    }
    return payload.sub;
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}

async function readJson<T>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}

async function registerDevice(userId: string, req: Request) {
  const body = await readJson<RegisterBody>(req);
  const fcmToken = body.fcmToken?.trim();

  if (!fcmToken || (body.platform !== "ios" && body.platform !== "android")) {
    return json({ error: "Missing or invalid fields: fcmToken, platform" }, 400);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notification_devices")
    .upsert(
      {
        user_id: userId,
        fcm_token: fcmToken,
        platform: body.platform,
        app_version: body.appVersion ?? null,
        enabled: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "fcm_token" },
    );

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ registered: true });
}

async function unregisterDevice(userId: string, req: Request) {
  const body = await readJson<UnregisterBody>(req);
  const now = new Date().toISOString();
  let query = supabase
    .from("notification_devices")
    .update({ enabled: false, last_seen_at: now, updated_at: now })
    .eq("user_id", userId);

  if (body.fcmToken?.trim()) {
    query = query.eq("fcm_token", body.fcmToken.trim());
  }

  const { error } = await query;
  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ unregistered: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const userId = await authenticate(req);
    const route = getRoute(req);

    if (route === "register") {
      return await registerDevice(userId, req);
    }
    if (route === "unregister") {
      return await unregisterDevice(userId, req);
    }

    return json({ error: "Unknown notifications route" }, 404);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return json({ error: String(error) }, 500);
  }
});
