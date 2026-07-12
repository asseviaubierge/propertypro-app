/**
 * PropertyPro - Invoice PDF Generation API
 * Generate and download PDF invoices
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { Types } from "mongoose";
import { generateInvoicePdfBuffer } from "@/lib/services/invoice-pdf.service";

// ============================================================================
// GET /api/invoices/[id]/pdf - Generate and download invoice PDF
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    const invoice = await Invoice.findById(id)
      .populate("tenantId", "firstName lastName email phone")
      .populate("propertyId", "name address")
      .populate("leaseId", "startDate endDate terms");

    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    // Generate the PDF using the same design used in the lease module
    const pdfData = await generateInvoicePdfBuffer(invoice);

    // Update invoice to mark PDF as generated
    invoice.pdfGenerated = true;
    invoice.pdfPath = `/invoices/${invoice._id}.pdf`;
    await invoice.save();

    return new NextResponse(pdfData, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to generate PDF");
  }
}

// ============================================================================
// POST /api/invoices/[id]/pdf - Generate PDF and save to server
// ============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    if (!Types.ObjectId.isValid(id)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    const invoice = await Invoice.findById(id)
      .populate("tenantId", "firstName lastName email phone")
      .populate("propertyId", "name address")
      .populate("leaseId", "startDate endDate terms");

    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    // Generate PDF and save to server
    const pdfPath = await generateAndSaveInvoicePDF(invoice);

    // Update invoice record
    invoice.pdfGenerated = true;
    invoice.pdfPath = pdfPath;
    await invoice.save();

    return createSuccessResponse(
      {
        pdfPath,
        pdfGenerated: true,
        downloadUrl: `/api/invoices/${id}/pdf`,
      },
      "PDF generated successfully"
    );
  } catch (error) {
    return handleApiError(error, "Failed to generate PDF");
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateAndSaveInvoicePDF(invoice: any): Promise<string> {
  // Generate PDF
  const pdfBuffer = await generateInvoicePdfBuffer(invoice);

  // In a real implementation, you would save this to a file system or cloud storage
  // For now, we'll just return a mock path
  const fileName = `invoice-${invoice.invoiceNumber}-${Date.now()}.pdf`;
  const filePath = `/uploads/invoices/${fileName}`;

  // TODO: Implement actual file saving
  // await fs.writeFile(path.join(process.cwd(), 'public', filePath), pdfBuffer);

  return filePath;
}
