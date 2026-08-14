/**
 * Actions navigateur pour les factures.
 *
 * L'affichage, le téléchargement et l'impression doivent tous consommer le
 * PDF canonique généré par /api/invoices/[id]/pdf. Cela évite qu'une ancienne
 * reconstruction côté client remplace l'émetteur réel par la plateforme.
 */

async function fetchInvoicePdf(invoiceId: string): Promise<Blob> {
  const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, {
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Impossible de générer la facture PDF.";
    try {
      const payload = await response.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // La réponse d'erreur n'est pas nécessairement au format JSON.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("Le document PDF généré est vide.");
  }
  return blob;
}

function safeInvoiceNumber(value: string): string {
  return String(value || "facture")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

export async function downloadCanonicalInvoicePdf(
  invoiceId: string,
  invoiceNumber: string,
): Promise<void> {
  const blob = await fetchInvoicePdf(invoiceId);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = `facture-${safeInvoiceNumber(invoiceNumber)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

export async function printCanonicalInvoicePdf(invoiceId: string): Promise<void> {
  // Ouvrir la fenêtre pendant le clic utilisateur pour éviter le blocage des
  // fenêtres surgissantes après l'attente de la réponse réseau.
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    throw new Error("Autorisez l'ouverture de la fenêtre d'impression.");
  }

  previewWindow.document.title = "Préparation de la facture";
  previewWindow.document.body.innerHTML =
    '<p style="font:14px system-ui;padding:24px;color:#334155">Préparation de la facture…</p>';

  try {
    const blob = await fetchInvoicePdf(invoiceId);
    const url = URL.createObjectURL(blob);
    let printStarted = false;
    const startPrint = () => {
      if (printStarted || previewWindow.closed) return;
      printStarted = true;
      previewWindow.focus();
      previewWindow.print();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
    };

    previewWindow.onload = startPrint;
    previewWindow.location.replace(url);
    // Certains lecteurs PDF intégrés ne déclenchent pas onload de façon fiable.
    window.setTimeout(startPrint, 1_500);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}
