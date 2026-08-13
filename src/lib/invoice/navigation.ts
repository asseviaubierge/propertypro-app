export interface CanonicalInvoiceLookupOptions {
  tenant?: boolean;
}

export async function resolveCanonicalInvoiceUrl(
  leaseId: string,
  options: CanonicalInvoiceLookupOptions = {},
): Promise<string> {
  if (!leaseId) {
    throw new Error("Identifiant de bail manquant");
  }

  const endpoint = options.tenant
    ? `/api/tenant/invoices?leaseId=${encodeURIComponent(leaseId)}&limit=1`
    : `/api/invoices?leaseId=${encodeURIComponent(leaseId)}&limit=1&includeSettled=true`;

  const response = await fetch(endpoint, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Impossible de retrouver la facture liée à ce bail");
  }

  const payload = await response.json();
  const rows = options.tenant
    ? payload?.data?.invoices
    : payload?.data?.invoices || payload?.data;
  const invoice = Array.isArray(rows) ? rows[0] : null;

  if (!invoice?._id) {
    throw new Error("Aucune facture enregistrée pour ce bail");
  }

  return `/dashboard/accounting/invoices/${invoice._id}`;
}
