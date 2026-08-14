import { NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import { withPermissionAndDB } from "@/lib/api-utils";
import SubscriptionContract from "@/models/SubscriptionContract";

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
}

export const GET = withPermissionAndDB("system_settings")(
  async (_user: any, _req: NextRequest, context: any) => {
    const { id } = await context.params;
    const contract = await SubscriptionContract.findById(id)
      .populate("accountId", "firstName lastName businessName email phone")
      .lean();

    if (!contract) {
      return Response.json({ success: false, error: "Contrat introuvable" }, { status: 404 });
    }

    const account: any = contract.accountId || {};
    const accountName = account.businessName || `${account.firstName || ""} ${account.lastName || ""}`.trim() || account.email || "Contractant";
    let body = String(contract.contractBody || "Contrat E-IMMO.BJ à compléter.");
    if ((contract as any).signatureStatus === "signed") {
      body += `\n\nSIGNATURE ÉLECTRONIQUE DU CONTRACTANT\nStatut : Signé\nSignataire : ${(contract as any).signatoryName || accountName}\nDate : ${(contract as any).signedAt ? new Date((contract as any).signedAt).toLocaleString("fr-FR") : "—"}\nLe contractant a confirmé avoir lu le document avant signature.`;
    } else if ((contract as any).signatureStatus === "pending_signature") {
      body += `\n\nSTATUT DE SIGNATURE\nDocument envoyé au contractant pour lecture et signature.\nCe document n'est pas encore signé.`;
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 16;
    const top = 23;
    const bottom = 18;
    const usableWidth = pageWidth - marginX * 2;
    const lineHeight = 4.6;
    let y = top;
    let pageNumber = 1;

    const drawHeader = () => {
      pdf.setFillColor(225, 29, 46);
      pdf.rect(0, 0, pageWidth, 6, "F");
      pdf.setTextColor(23, 32, 51);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("E-IMMO.BJ", marginX, 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(91, 101, 119);
      pdf.text(`${contract.contractNumber}  •  ${accountName}`, marginX, 19);
    };

    const drawFooter = () => {
      pdf.setDrawColor(220, 224, 230);
      pdf.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(91, 101, 119);
      pdf.text("E-IMMO.BJ — Document contractuel généré depuis GESTION E-IMMO", marginX, pageHeight - 8);
      pdf.text(`Page ${pageNumber}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
    };

    const nextPage = () => {
      drawFooter();
      pdf.addPage();
      pageNumber += 1;
      drawHeader();
      y = top;
    };

    drawHeader();
    pdf.setTextColor(23, 32, 51);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.2);

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        y += 2.8;
        if (y > pageHeight - bottom) nextPage();
        continue;
      }

      const isHeading = /^ARTICLE\s+\d+|^E-IMMO\.BJ$|^POUR E-IMMO\.BJ|^DOCUMENT À LIRE|^CONTRAT|^MANDAT/.test(line.trim());
      pdf.setFont("helvetica", isHeading ? "bold" : "normal");
      pdf.setFontSize(isHeading ? 9.6 : 8.8);
      const wrapped = pdf.splitTextToSize(line, usableWidth) as string[];
      const blockHeight = wrapped.length * lineHeight + (isHeading ? 1.2 : 0);
      if (y + blockHeight > pageHeight - bottom) nextPage();
      pdf.text(wrapped, marginX, y);
      y += blockHeight;
    }

    drawFooter();
    const bytes = pdf.output("arraybuffer");
    const filename = `${safeName(contract.contractNumber)}-${safeName(accountName)}.pdf`;

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }
);
