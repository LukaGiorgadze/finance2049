import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import OpenAI, { toFile } from "openai";

const MODEL = "gpt-5-mini";

const SYSTEM_PROMPT = `You are a financial transaction extractor. Your job is to extract EVERY individual stock/ETF buy and sell transaction from the provided content.

# CRITICAL RULES — violating any of these is a failure:
1. Extract EVERY SINGLE transaction. Never merge, combine, summarize, or deduplicate rows. Multiple buys/sells of the same stock on the same date at the same price are multiple separate transactions.
2. Preserve exact numeric precision. Output quantities and prices exactly as they appear. Never round or truncate.
3. Each transaction has: symbol (ticker in uppercase), date (YYYY-MM-DD), quantity (number of shares), price (price per share), commission (0 if not stated), type ("buy" or "sell").
4. Skip everything that is not a buy or sell — only extract transactions for buys and sells.
5. Do not use any future dates in sell or buy actions. Today's date is ${new Date().toISOString().split("T")[0]}.
6. The input may be in any format: JSON, CSV, plain text, brokerage statement, screenshot, PDF, etc. Adapt accordingly but always follow the rules above.
7. If you find no transactions, return an empty transactions array and explain why in the message field.
8. Always follow the rules above and return a flat array of transactions.
`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          symbol:     { type: "string", description: "Ticker symbol in uppercase, e.g. AAPL" },
          date:       { type: "string", description: "ISO date YYYY-MM-DD" },
          quantity:   { type: "number", description: "Number of shares" },
          price:      { type: "number", description: "Price per share" },
          commission: { type: "number", description: "Fee paid; 0 if not stated" },
          type:       { type: "string", enum: ["buy", "sell"] },
        },
        required: ["symbol", "date", "quantity", "price", "commission", "type"],
        additionalProperties: false,
      },
    },
    message: {
      type: "string",
      description: "Short summary of what was extracted, or reason nothing was found",
    },
  },
  required: ["transactions", "message"],
  additionalProperties: false,
} as const;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const JWKS = createRemoteJWKSet(
  new URL(`${Deno.env.get("SUPABASE_URL")}/auth/v1/.well-known/jwks.json`),
);

const BUCKET = "extractions";

interface ExtractRequest {
  /** Signed URL from supabase storage file */
  signedUrl: string;
  /** MIME type of the uploaded file */
  mimeType: string;
  /** Storage path for optional cleanup after extraction (does not block extraction) */
  storagePath?: string;
  /** Original file name */
  fileName?: string;
}

interface ExtractedTransaction {
  symbol: string;
  date: string;
  quantity: number;
  price: number;
  commission: number;
  type: "buy" | "sell";
}

interface ExtractResponse {
  transactions: ExtractedTransaction[];
  message: string;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return json({ transactions: [], message: "Missing Authorization header" }, 401);
  }

  let stepStart = Date.now();
  try {
    await jwtVerify(token, JWKS);
  } catch {
    return json({ transactions: [], message: "Invalid or expired token" }, 401);
  }
  console.debug(`[extract] step jwtVerify took ${Date.now() - stepStart} ms`);

  if (req.method !== "POST") {
    return json({ transactions: [], message: "Method not allowed" }, 405);
  }

  stepStart = Date.now();
  let body: ExtractRequest;
  try {
    body = await req.json();
  } catch {
    return json({ transactions: [], message: "Invalid JSON body" }, 400);
  }
  console.debug(`[extract] step parseBody took ${Date.now() - stepStart} ms`);

  const { signedUrl, storagePath, mimeType, fileName } = body;

  if (!signedUrl || !mimeType) {
    return json({ transactions: [], message: "Missing required fields: signedUrl, mimeType" }, 400);
  }

  stepStart = Date.now();
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ transactions: [], message: "Server misconfiguration: missing API key" }, 500);
  }

  const openai = new OpenAI({ apiKey });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  console.debug(`[extract] step initClients took ${Date.now() - stepStart} ms`);

  stepStart = Date.now();
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  const isText =
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    ["csv", "tsv", "json", "txt"].includes(ext);
  const isImage = mimeType.startsWith("image/");
  console.debug(`[extract] step fileTypeCheck took ${Date.now() - stepStart} ms`);

  let openaiFileId: string | undefined;

  const extractStartMs = Date.now();

  try {
    type ResponseInput =
      | string
      | { type: "message"; role: "user"; content: ({ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail?: string } | { type: "input_file"; file_id: string })[] }[];
    let input: ResponseInput;

    stepStart = Date.now();
    if (isImage) {
      console.debug(`[extract] Image "${fileName}" — passing signed URL to vision`);
      input = [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_image", image_url: signedUrl, detail: "auto" }],
        },
      ];
      console.debug(`[extract] step buildContent (image) took ${Date.now() - stepStart} ms`);
    } else if (isText) {
      let res: Response;
      try {
        res = await fetch(signedUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[extract] Failed to download text file "${fileName}": fetch threw: ${message}`);
        return json({ transactions: [], message: `Failed to download file: ${message}` }, 500);
      }
      if (!res.ok) {
        const details = await getResponseErrorDetails(res);
        console.error(`[extract] Failed to download text file "${fileName}": ${res.status} ${res.statusText}${details ? ` - ${details}` : ""}`);
        return json({
          transactions: [],
          message: `Failed to download file: ${res.status} ${res.statusText}${details ? ` - ${details}` : ""}`,
        }, 500);
      }
      const text = await res.text();
      console.debug(`[extract] step fetch(signedUrl) took ${Date.now() - stepStart} ms`);
      input = `File: ${fileName ?? "unknown"}\n\n${text}`;
    } else {
      let res: Response;
      try {
        res = await fetch(signedUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[extract] Failed to download document "${fileName}": fetch threw: ${message}`);
        return json({ transactions: [], message: `Failed to download file: ${message}` }, 500);
      }
      if (!res.ok) {
        const details = await getResponseErrorDetails(res);
        console.error(`[extract] Failed to download document "${fileName}": ${res.status} ${res.statusText}${details ? ` - ${details}` : ""}`);
        return json({
          transactions: [],
          message: `Failed to download file: ${res.status} ${res.statusText}${details ? ` - ${details}` : ""}`,
        }, 500);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      console.debug(`[extract] step fetchDocument took ${Date.now() - stepStart} ms`);
      const uploadStepStart = Date.now();
      const file = await openai.files.create({
        file: await toFile(bytes, fileName ?? "upload", { type: mimeType }),
        purpose: "user_data",
      });
      openaiFileId = file.id;
      console.debug(`[extract] step openaiFileUpload took ${Date.now() - uploadStepStart} ms`);
      input = [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_file", file_id: file.id }],
        },
      ];
      console.debug(`[extract] step buildContent (document) took ${Date.now() - stepStart} ms total`);
    }

    stepStart = Date.now();
    const response = await openai.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input,
      stream: false,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "transactions_extraction",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    });
    console.debug(`[extract] step openaiResponse took ${Date.now() - stepStart} ms`);

    stepStart = Date.now();
    if (response.incomplete_details?.reason === "max_output_tokens") {
      console.error(`[extract] Output truncated for "${fileName}"`);
      return json({
        transactions: [],
        message: "Output was truncated — the file may be too large. Try splitting it into smaller files.",
      }, 502);
    }

    const raw =
      "output_text" in response && typeof response.output_text === "string"
        ? response.output_text
        : getOutputText(response.output);
    if (!raw) {
      console.error(`[extract] AI returned empty response for "${fileName}"`);
      return json({ transactions: [], message: "AI returned an empty response" }, 502);
    }

    const result = JSON.parse(raw) as ExtractResponse;
    console.debug(`[extract] step parseResponse took ${Date.now() - stepStart} ms`);
    const totalMs = Date.now() - extractStartMs;
    console.debug(`[extract] "${fileName}" → ${result.transactions.length} transactions (total ${totalMs} ms)`);
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const totalMs = Date.now() - extractStartMs;
    console.error(`[extract] Failed for "${fileName}" after ${totalMs} ms:`, message);
    return json({ transactions: [], message: `Extraction failed: ${message}` }, 502);
  } finally {
    stepStart = Date.now();
    await Promise.all([
      storagePath ? supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {}) : Promise.resolve(),
      openaiFileId ? openai.files.del(openaiFileId).catch(() => {}) : Promise.resolve(),
    ]);
    console.debug(`[extract] step cleanup took ${Date.now() - stepStart} ms`);
  }
});

/** Extract first output text from Responses API output array (fallback when output_text is not available). */
function getOutputText(
  output: { type?: string; content?: { type?: string; text?: string }[] }[] | undefined,
): string | null {
  if (!output?.length) return null;
  for (const item of output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === "output_text" && typeof part.text === "string") return part.text;
      }
    }
  }
  return null;
}

async function getResponseErrorDetails(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim().replace(/\s+/g, " ");
    if (!text) return "";
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

function json(body: ExtractResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
