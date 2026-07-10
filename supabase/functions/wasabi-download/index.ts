import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { key } = await req.json();
    if (!key) return new Response(JSON.stringify({ error: "key es obligatorio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const endpoint = Deno.env.get("WASABI_ENDPOINT") ?? "";
    const bucket = Deno.env.get("WASABI_BUCKET_NAME") ?? "";
    const accessKey = Deno.env.get("WASABI_ACCESS_KEY") ?? "";
    const secretKey = Deno.env.get("WASABI_SECRET_KEY") ?? "";

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      return new Response(JSON.stringify({ error: "Configuración de Wasabi incompleta" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const region = "us-east-1";
    const service = "s3";
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const amzDate = now.toISOString().replace(/[:-]/g, "").slice(0, 15) + "Z";
    const expiresSeconds = 3600;
    const host = endpoint.replace(/^https?:\/\//, "");
    const objectKey = key.startsWith("/") ? key.slice(1) : key;
    const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${accessKey}/${credentialScope}`;

    const canonicalQueryString = [
      "X-Amz-Algorithm=AWS4-HMAC-SHA256",
      `X-Amz-Credential=${encodeURIComponent(credential)}`,
      `X-Amz-Date=${amzDate}`,
      `X-Amz-Expires=${expiresSeconds}`,
      "X-Amz-SignedHeaders=host",
    ].join("&");

    const canonicalRequest = ["GET", `/${bucket}/${encodedKey}`, canonicalQueryString, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
    const hashedCanonical = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)));
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hashedCanonical].join("\n");

    const enc = new TextEncoder();
    const kDate = await hmacSha256(enc.encode(`AWS4${secretKey}`), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, "aws4_request");
    const signature = toHex(await hmacSha256(kSigning, stringToSign));

    const url = `${endpoint}/${bucket}/${encodedKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    return new Response(JSON.stringify({ url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
