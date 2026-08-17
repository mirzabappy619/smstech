import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    // Fetch image from original source (e.g. Supabase Storage)
    const imageRes = await fetch(imageUrl, {
      next: { revalidate: 31536000 },
    });

    if (!imageRes.ok) {
      return new NextResponse("Failed to fetch image", { status: imageRes.status });
    }

    const contentType = imageRes.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await imageRes.arrayBuffer();

    // Return with aggressive Cloudflare Edge Cache headers
    return new NextResponse(Buffer.from(imageBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable",
        "CDN-Cache-Control": "public, max-age=31536000, immutable",
        "Cloudflare-CDN-Cache-Control": "public, max-age=31536000, immutable",
        "CF-Cache-Status": "DYNAMIC",
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message || "Failed to proxy image", { status: 500 });
  }
}
