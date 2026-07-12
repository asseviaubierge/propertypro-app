import { NextRequest, NextResponse } from "next/server";
import { PaymentReceipt } from "@/models";
import { AuthenticatedAccessUser, withPermissionAndDB } from "@/lib/api-utils";

export const GET = withPermissionAndDB("payment_history")(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const receipt = await PaymentReceipt.findOne({
        _id: params.id,
      }).populate({
        path: "paymentId",
        select:
          "amount type dueDate paidDate propertyId tenantId stripePaymentIntentId",
        populate: [
          { path: "propertyId", select: "name address" },
          { path: "tenantId", select: "name email" },
        ],
      });

      if (!receipt) {
        return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
      }

      const payment = receipt.paymentId as any;
      if (payment?.tenantId?._id?.toString() !== user.id) {
        return NextResponse.json(
          { error: "Access denied. Receipt does not belong to you." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "PDF generation not yet implemented" },
        { status: 501 }
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to download receipt",
        },
        { status: 500 }
      );
    }
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/* TODO: Implement PDF generation once pdfkit is installed
async function generateReceiptPDF(receipt: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const payment = receipt.paymentId;
      const property = payment.propertyId;
      const tenant = payment.tenantId;

      // Header
      doc.fontSize(20).text("PAYMENT RECEIPT", 50, 50, { align: "center" });
      doc
        .fontSize(12)
        .text(`Receipt #${receipt.receiptNumber}`, 50, 80, { align: "center" });

      // Company Info (you can customize this)
      doc.fontSize(14).text("PropertyPro", 50, 120);
      doc.fontSize(10).text("Property Management Services", 50, 140);
      doc.text("Email: support@PropertyPro.com", 50, 155);

      // Receipt Details Box
      doc.rect(50, 180, 500, 120).stroke();
      doc.fontSize(12).text("Receipt Details", 60, 190);

      doc.fontSize(10);
      doc.text(`Receipt Number: ${receipt.receiptNumber}`, 60, 210);
      doc.text(
        `Generated Date: ${new Date(
          receipt.generatedDate
        ).toLocaleDateString()}`,
        60,
        225
      );
      doc.text(
        `Payment Date: ${new Date(payment.paidDate).toLocaleDateString()}`,
        60,
        240
      );
      doc.text(
        `Due Date: ${new Date(payment.dueDate).toLocaleDateString()}`,
        60,
        255
      );

      if (payment.stripePaymentIntentId) {
        doc.text(`Transaction ID: ${payment.stripePaymentIntentId}`, 60, 270);
      }

      // Tenant Information
      doc.rect(50, 320, 240, 100).stroke();
      doc.fontSize(12).text("Tenant Information", 60, 330);
      doc.fontSize(10);
      doc.text(`Name: ${tenant.name}`, 60, 350);
      doc.text(`Email: ${tenant.email}`, 60, 365);

      // Property Information
      doc.rect(310, 320, 240, 100).stroke();
      doc.fontSize(12).text("Property Information", 320, 330);
      doc.fontSize(10);
      doc.text(`Property: ${property.name}`, 320, 350);
      doc.text(`Address: ${property.address.street}`, 320, 365);
      doc.text(
        `${property.address.city}, ${property.address.state} ${property.address.zipCode}`,
        320,
        380
      );

      // Payment Details
      doc.rect(50, 440, 500, 80).stroke();
      doc.fontSize(12).text("Payment Details", 60, 450);

      doc.fontSize(10);
      doc.text(
        `Payment Type: ${payment.type.replace("_", " ").toUpperCase()}`,
        60,
        470
      );
      doc.text(`Amount Paid: ${formatCurrency(payment.amount)}`, 60, 485);
      doc.text(`Payment Method: Credit Card`, 60, 500);

      // Total Amount (highlighted)
      doc.rect(350, 460, 180, 40).fillAndStroke("#f0f0f0", "#000000");
      doc.fillColor("#000000");
      doc.fontSize(14).text("TOTAL PAID", 360, 470);
      doc.fontSize(16).text(formatCurrency(payment.amount), 360, 485);

      // Footer
      doc.fontSize(8).fillColor("#666666");
      doc.text(
        "This is an official receipt for your payment. Please keep this for your records.",
        50,
        560,
        {
          align: "center",
        }
      );
      doc.text(
        "For questions about this receipt, please contact your property manager.",
        50,
        575,
        {
          align: "center",
        }
      );

      // Watermark (optional)
      doc.fontSize(60).fillColor("#f0f0f0").text("PAID", 200, 300, {
        rotate: 45,
        align: "center",
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
*/
