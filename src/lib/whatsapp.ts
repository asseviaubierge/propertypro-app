/** Utilitaires WhatsApp côté client et serveur. */
export function normalizeWhatsAppPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // WhatsApp attend un numéro international composé uniquement de chiffres.
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
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
