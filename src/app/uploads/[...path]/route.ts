import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBackendUrl(): string {
  const url = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("API_URL or NEXT_PUBLIC_API_URL must be set on Vercel.");
  }
  return url.replace(/\/$/, "");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    const backend = getBackendUrl();
    const target = `${backend}/uploads/${path.join("/")}${request.nextUrl.search}`;
    const upstream = await fetch(target);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload proxy failed";
    return Response.json({ message }, { status: 500 });
  }
}
