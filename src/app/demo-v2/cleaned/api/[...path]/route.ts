import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_ORIGIN =
  process.env.CLEANED_DEMO_BACKEND_ORIGIN ??
  "https://cleaned-demo-api-347926612645.australia-southeast1.run.app";

const STRIP_REQUEST = ["connection", "content-length", "host", "origin", "referer"];
const STRIP_RESPONSE = ["connection", "content-encoding", "keep-alive", "transfer-encoding"];

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Ctx) {
  const { path } = await context.params;
  const target = new URL(`/api/${path.filter(Boolean).join("/")}${request.nextUrl.search}`, BACKEND_ORIGIN);

  const headers = new Headers(request.headers);
  for (const h of STRIP_REQUEST) headers.delete(h);

  const init: RequestInit = { method: request.method, headers, cache: "no-store", redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    console.error("[cleaned-v2 proxy]", error);
    return NextResponse.json({ error: "Failed to reach backend." }, { status: 502 });
  }

  const rh = new Headers(upstream.headers);
  rh.set("Cache-Control", "no-store");
  for (const h of STRIP_RESPONSE) rh.delete(h);

  const body = request.method === "HEAD" ? null : await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: rh });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
