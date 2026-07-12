/**
 * PropertyPro - Branding Logo Proxy
 *
 * Serves the branding logo (or a specific branding asset passed via `src`) from
 * the same origin. Branding logos live on R2, which does not send CORS headers,
 * so the browser cannot fetch them for invoice PDF/print inlining and
 * html2canvas drops the cross-origin <img>. Proxying the bytes server-side
 * (no CORS restriction) lets the client inline the logo as a data URL.
 */

import { readFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_PUBLIC_BRANDING,
  getPublicBranding,
} from "@/lib/utils/public-branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

interface LoadedImage {
  buffer: Buffer;
  contentType: string;
}

function isAllowedRemoteUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  const r2PublicUrl =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;
  if (r2PublicUrl) {
    try {
      const r2Url = new URL(r2PublicUrl);
      if (url.hostname === r2Url.hostname) return true;
    } catch {
      // Fall through to the suffix checks below.
    }
  }

  return (
    url.hostname.endsWith(".r2.dev") ||
    url.hostname.endsWith(".r2.cloudflarestorage.com")
  );
}

function contentTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

async function readPublicAsset(assetUrl: string): Promise<LoadedImage> {
  const publicDir = path.resolve(process.cwd(), "public");
  const pathname = new URL(assetUrl, "https://propertypro.local").pathname;
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const assetPath = path.resolve(publicDir, relativePath);

  if (!assetPath.startsWith(`${publicDir}${path.sep}`)) {
    throw new Error("Invalid public asset path");
  }

  return {
    buffer: await readFile(assetPath),
    contentType: contentTypeFromPath(relativePath),
  };
}

async function fetchRemoteAsset(url: URL): Promise<LoadedImage> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch logo: ${response.status}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
  };
}

function imageResponse(image: LoadedImage, maxAge = 300): Response {
  return new Response(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=86400`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const src = new URL(request.url).searchParams.get("src");

  try {
    // Explicit source: must be an allowed remote (R2) asset.
    if (src) {
      let url: URL;
      try {
        url = new URL(src);
      } catch {
        return new Response("Invalid src", { status: 400 });
      }
      if (!isAllowedRemoteUrl(url)) {
        return new Response("Unsupported logo host", { status: 403 });
      }
      return imageResponse(await fetchRemoteAsset(url));
    }

    // No source: serve the global branding logo (favicon, then logoLight) to
    // match getCompanyInfo()'s selection.
    const branding = await getPublicBranding();
    const target = branding.favicon || branding.logoLight;
    const image = target.startsWith("/")
      ? await readPublicAsset(target)
      : await fetchRemoteAsset(new URL(target));
    return imageResponse(image);
  } catch (error) {
    console.error("Branding logo proxy error:", error);
    try {
      return imageResponse(
        await readPublicAsset(DEFAULT_PUBLIC_BRANDING.favicon),
        60
      );
    } catch {
      return new Response("Unable to load logo", { status: 500 });
    }
  }
}
