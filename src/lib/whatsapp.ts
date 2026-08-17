/** Utilitaires WhatsApp côté client et serveur. */
export function normalizeWhatsAppPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // WhatsApp attend un numéro international composé uniquement de chiffres.
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;

  // Depuis 2024, les numéros mobiles béninois saisis localement commencent
  // généralement par 01. WhatsApp exige le format international sans « + ».
  if (digits.length === 10 && digits.startsWith("01")) {
    return `229${digits}`;
  }

  return digits;
}

export interface WhatsAppDocumentShareOptions {
  phone?: string | null;
  documentUrl: string;
  fileName: string;
  title: string;
  message: string;
}

export type WhatsAppDocumentShareResult =
  | "shared"
  | "opened"
  | "cancelled"
  | "unavailable";

/**
 * Partage gratuit d’un document :
 * - sur mobile compatible, le PDF réel est transmis au menu de partage natif ;
 * - sinon, WhatsApp Web/App s’ouvre sur le numéro avec le lien du document.
 * Aucun fournisseur WhatsApp payant n’est utilisé.
 */
export async function shareDocumentViaWhatsApp(
  options: WhatsAppDocumentShareOptions
): Promise<WhatsAppDocumentShareResult> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "unavailable";
  }

  const absoluteUrl = new URL(options.documentUrl, window.location.origin).toString();

  try {
    if (typeof navigator.share === "function") {
      const response = await fetch(absoluteUrl, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Document indisponible");

      const blob = await response.blob();
      const file = new File([blob], options.fileName, {
        type: blob.type || "application/pdf",
      });
      const shareData = {
        title: options.title,
        text: options.message,
        files: [file],
      };
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (!nav.canShare || nav.canShare(shareData)) {
        await navigator.share(shareData);
        return "shared";
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled";
    }
    // Repli ci-dessous vers le lien WhatsApp ciblé.
  }

  const whatsappUrl = buildWhatsAppUrl(
    options.phone,
    `${options.message}\n\nDocument : ${absoluteUrl}`
  );
  if (!whatsappUrl) return "unavailable";

  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  return "opened";
}

export function buildWhatsAppUrl(
  phone?: string | null,
  message?: string
): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const text = message?.trim();
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
