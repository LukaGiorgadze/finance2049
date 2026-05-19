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
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID") ?? "";
const FCM_CLIENT_EMAIL = Deno.env.get("FCM_CLIENT_EMAIL") ?? "";
const FCM_PRIVATE_KEY = Deno.env.get("FCM_PRIVATE_KEY") ?? "";
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

interface NotificationDevice {
  fcm_token: string;
}

interface CachedAccessToken {
  token: string;
  expiresAtMs: number;
}

let cachedFcmAccessToken: CachedAccessToken | null = null;

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

function base64UrlEncode(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function privateKeyToArrayBuffer(privateKey: string) {
  const normalized = privateKey
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>) {
  const unsigned = [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(payload)),
  ].join(".");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyToArrayBuffer(FCM_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getFcmAccessToken() {
  if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAtMs > Date.now() + 60_000) {
    return cachedFcmAccessToken.token;
  }

  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    throw new Error("Missing FCM service account configuration");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: FCM_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    },
  );

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenBody = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description ?? "Failed to fetch FCM access token");
  }

  cachedFcmAccessToken = {
    token: tokenBody.access_token,
    expiresAtMs: Date.now() + Number(tokenBody.expires_in ?? 3600) * 1000,
  };

  return cachedFcmAccessToken.token;
}

function getFcmErrorCode(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return null;
  }

  const details = (error as { details?: unknown }).details;
  if (!Array.isArray(details)) {
    return null;
  }

  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;

    const errorCode = (detail as { errorCode?: unknown }).errorCode;
    if (typeof errorCode === "string") {
      return errorCode;
    }
  }

  return null;
}

function isInvalidFcmToken(body: unknown) {
  const errorCode = getFcmErrorCode(body);
  return errorCode === "UNREGISTERED" || errorCode === "SENDER_ID_MISMATCH";
}

async function sendFcmTest(accessToken: string, fcmToken: string) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: {
            title: "Finance 2049",
            body: "Push notifications are working.",
          },
          data: {
            type: "test",
            notification_id: crypto.randomUUID(),
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        },
      }),
    },
  );
  const body = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    invalidToken: !response.ok && isInvalidFcmToken(body),
  };
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

async function sendTest(userId: string) {
  const { data, error } = await supabase
    .from("notification_devices")
    .select("fcm_token")
    .eq("user_id", userId)
    .eq("enabled", true)
    .returns<NotificationDevice[]>();

  if (error) {
    return json({ error: error.message }, 500);
  }

  const devices = data ?? [];
  if (devices.length === 0) {
    return json({ sent: 0, failed: 0, disabledTokens: 0 });
  }

  const accessToken = await getFcmAccessToken();
  const results = await Promise.all(
    devices.map((device) => sendFcmTest(accessToken, device.fcm_token)),
  );
  const invalidTokens = devices
    .filter((_, index) => results[index].invalidToken)
    .map((device) => device.fcm_token);

  if (invalidTokens.length > 0) {
    await supabase
      .from("notification_devices")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("fcm_token", invalidTokens);
  }

  return json({
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    disabledTokens: invalidTokens.length,
  });
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
    if (route === "test") {
      return await sendTest(userId);
    }

    return json({ error: "Unknown notifications route" }, 404);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return json({ error: String(error) }, 500);
  }
});
