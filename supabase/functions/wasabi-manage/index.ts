import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function env(key: string): string {
  return Deno.env.get(key) || Deno.env.get(key.replace("VITE_", "")) || "";
}

const endpoint = env("VITE_WASABI_ENDPOINT");
const bucket = env("VITE_WASABI_BUCKET_NAME");
const accessKey = env("VITE_WASABI_ACCESS_KEY");
const secretKey = env("VITE_WASABI_SECRET_KEY");
const region = "eu-central-2";

const aws = new AwsClient({
  accessKeyId: accessKey,
  secretAccessKey: secretKey,
  region,
  service: "s3",
});

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlUnescape(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

interface S3Object { key: string; size: number; lastModified: string; }
interface S3Prefix { prefix: string; }

function parseListXml(xml: string): { objects: S3Object[]; prefixes: S3Prefix[]; isTruncated: boolean; nextToken?: string } {
  const objects: S3Object[] = [];
  const prefixes: S3Prefix[] = [];

  const objRegex = /<Contents>\s*<Key>([^<]+)<\/Key>\s*<LastModified>([^<]+)<\/LastModified>\s*<Size>([^<]+)<\/Size>/g;
  let m;
  while ((m = objRegex.exec(xml)) !== null) {
    objects.push({ key: xmlUnescape(m[1]), size: parseInt(m[3], 10), lastModified: m[2] });
  }

  const preRegex = /<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>/g;
  while ((m = preRegex.exec(xml)) !== null) {
    prefixes.push({ prefix: xmlUnescape(m[1]) });
  }

  const truncMatch = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/);
  const isTruncated = truncMatch?.[1] === "true";
  let nextToken: string | undefined;
  if (isTruncated) {
    const tokMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    nextToken = tokMatch?.[1];
  }
  return { objects, prefixes, isTruncated, nextToken };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // ── LIST ──────────────────────────────────────────────────────────────
    if (action === "list" && req.method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";
      const delimiter = url.searchParams.get("delimiter") || undefined;
      const maxKeys = parseInt(url.searchParams.get("maxKeys") || "1000", 10);
      const continuationToken = url.searchParams.get("continuationToken") || undefined;

      let listUrl = `${endpoint}/${bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`;
      if (delimiter) listUrl += `&delimiter=${encodeURIComponent(delimiter)}`;
      if (continuationToken) listUrl += `&continuation-token=${encodeURIComponent(continuationToken)}`;

      const signed = await aws.sign(new Request(listUrl, { method: "GET" }));
      const upstream = await fetch(signed);
      if (!upstream.ok) {
        const body = await upstream.text();
        return new Response(JSON.stringify({ error: `Wasabi list returned ${upstream.status}`, detail: body }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const xml = await upstream.text();
      const parsed = parseListXml(xml);
      return new Response(JSON.stringify(parsed), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPLOAD ─────────────────────────────────────────────────────────────
    if (action === "upload" && req.method === "PUT") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key parameter" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentType = url.searchParams.get("contentType") || "application/octet-stream";
      const body = await req.arrayBuffer();

      const encodedKey = key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
      const objectUrl = `${endpoint}/${bucket}/${encodedKey}`;
      const signed = await aws.sign(new Request(objectUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType, "Content-Length": String(body.byteLength) },
        body,
      }));
      const upstream = await fetch(signed);
      if (!upstream.ok) {
        const errBody = await upstream.text();
        return new Response(JSON.stringify({ error: `Wasabi upload returned ${upstream.status}`, detail: errBody }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, key }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (action === "delete" && req.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key parameter" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const objectUrl = `${endpoint}/${bucket}/${key}`;
      const signed = await aws.sign(new Request(objectUrl, { method: "DELETE" }));
      const upstream = await fetch(signed);
      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: `Wasabi delete returned ${upstream.status}` }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── COPY ────────────────────────────────────────────────────────────────
    if (action === "copy" && req.method === "POST") {
      const srcKey = url.searchParams.get("src");
      const dstKey = url.searchParams.get("dst");
      if (!srcKey || !dstKey) {
        return new Response(JSON.stringify({ error: "Missing src or dst parameter" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const objectUrl = `${endpoint}/${bucket}/${dstKey}`;
      const signed = await aws.sign(new Request(objectUrl, {
        method: "PUT",
        headers: { "x-amz-copy-source": `${bucket}/${srcKey}` },
      }));
      const upstream = await fetch(signed);
      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: `Wasabi copy returned ${upstream.status}` }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
