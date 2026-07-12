export type SupportedLogoFormat = "PNG" | "JPEG";

function sanitizeFallback(fallback?: string): string {
  return typeof fallback === "string" && fallback.trim().length > 0
    ? fallback.trim().slice(0, 2).toUpperCase()
    : "PP";
}

export function deriveCompanyInitials(
  name?: string,
  fallback = "PP"
): string {
  if (typeof name !== "string") {
    return sanitizeFallback(fallback);
  }

  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return sanitizeFallback(fallback);
  }

  const segments = cleaned
    .split(/[\s\-_,.]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase());

  if (segments.length >= 2) {
    return `${segments[0]}${segments[1]}`.slice(0, 2);
  }

  if (segments.length === 1) {
    const alphanumeric = cleaned.replace(/[^a-zA-Z0-9]/g, "");
    const second = alphanumeric.charAt(1).toUpperCase();
    return `${segments[0]}${second}`.slice(0, 2) || segments[0];
  }

  return sanitizeFallback(fallback);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let chunkString = "";
    for (let j = 0; j < chunk.length; j += 1) {
      chunkString += String.fromCharCode(chunk[j]);
    }
    binary += chunkString;
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return "";
}

function detectFormat(
  mime: string | null,
  dataUrl?: string
): SupportedLogoFormat {
  const normalizedMime = (mime || "").toLowerCase();
  const normalizedDataUrl = (dataUrl || "").toLowerCase();

  if (
    normalizedMime.includes("jpeg") ||
    normalizedMime.includes("jpg") ||
    normalizedDataUrl.includes("jpeg") ||
    normalizedDataUrl.includes("jpg")
  ) {
    return "JPEG";
  }

  return "PNG";
}

export async function fetchLogoAsDataUrl(
  logo?: string
): Promise<{ dataUrl?: string; format?: SupportedLogoFormat }> {
  const source = typeof logo === "string" ? logo.trim() : "";
  if (!source) {
    return {};
  }

  if (source.startsWith("data:")) {
    return { dataUrl: source, format: detectFormat(null, source) };
  }

  try {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Logo fetch failed with status ${response.status}`);
    }

    const mime = response.headers.get("content-type");
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    if (!base64) {
      return {};
    }

    const resolvedMime = mime && mime.startsWith("image/") ? mime : "image/png";
    const dataUrl = `data:${resolvedMime};base64,${base64}`;
    return { dataUrl, format: detectFormat(resolvedMime, dataUrl) };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to load company logo", error);
    }
    return {};
  }
}
