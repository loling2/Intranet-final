import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response(JSON.stringify({ error: "Missing key parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = Deno.env.get("VITE_WASABI_ENDPOINT") ?? "";
    const bucket = Deno.env.get("VITE_WASABI_BUCKET_NAME") ?? "";
    const accessKey = Deno.env.get("VITE_WASABI_ACCESS_KEY") ?? "";
    const secretKey = Deno.env.get("VITE_WASABI_SECRET_KEY") ?? "";

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region: "eu-central-2",
      service: "s3",
    });

    const objectUrl = `${endpoint}/${bucket}/${key}`;
    const signed = await aws.sign(new Request(objectUrl, { method: "GET" }));
    const upstream = await fetch(signed);

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Wasabi returned ${upstream.status}` }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the original filename from the key (strip folder prefix and timestamp prefix)
    const keyParts = key.split("/");
    const rawName = keyParts[keyParts.length - 1];
    const filename = rawName.replace(/^\d+-/, "");

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    };
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    return new Response(upstream.body, { status: 200, headers: responseHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
