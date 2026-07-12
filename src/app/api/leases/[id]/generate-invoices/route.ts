/**
 * PropertyPro - Lease Invoice Generation API
 * API endpoint to generate invoices for a specific lease
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Lease } from "@/models";
import { autoInvoiceGenerationService } from "@/lib/services/auto-invoice-generation.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { Types } from "mongoose";

// ============================================================================
// POST /api/leases/[id]/generate-invoices - Generate invoices for lease
// ============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id: leaseId } = params;

    if (!Types.ObjectId.isValid(leaseId)) {
      return createErrorResponse("Invalid lease ID", 400);
    }

    // Verify lease exists
    const lease = await Lease.findById(leaseId);
    if (!lease) {
      return createErrorResponse("Lease not found", 404);
    }

    const body = await request.json();
    const {
      generateOnLeaseCreation = true,
      generateMonthlyRent = true,
      generateSecurityDeposit = true,
      advanceMonths = 0,
      gracePeriodDays = 5,
      autoIssue = false,
      autoEmail = false,
    } = body;

    // Generate invoices using the service
    const result = await autoInvoiceGenerationService.generateInvoicesForLease(
      leaseId,
      {
        generateOnLeaseCreation,
        generateMonthlyRent,
        generateSecurityDeposit,
        advanceMonths,
        gracePeriodDays,
        autoIssue,
        autoEmail,
      }
    );

    if (!result.success && result.errors.length > 0) {
      return createErrorResponse(
        `Invoice generation failed: ${result.errors.join(", ")}`,
        400
      );
    }

    return createSuccessResponse(
      {
        invoicesGenerated: result.invoicesGenerated,
        invoiceIds: result.invoiceIds,
        errors: result.errors,
        lease: {
          id: lease._id,
          startDate: lease.startDate,
          endDate: lease.endDate,
          rentAmount: lease.terms.rentAmount,
        },
      },
      `Successfully generated ${result.invoicesGenerated} invoices`
    );
  } catch (error) {
    return handleApiError(error, "Failed to generate invoices");
  }
}

// ============================================================================
// GET /api/leases/[id]/generate-invoices - Preview invoice generation
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id: leaseId } = params;

    if (!Types.ObjectId.isValid(leaseId)) {
      return createErrorResponse("Invalid lease ID", 400);
    }

    // Verify lease exists
    const lease = await Lease.findById(leaseId).populate("tenantId propertyId");
    if (!lease) {
      return createErrorResponse("Lease not found", 404);
    }

    const { searchParams } = new URL(request.url);
    const generateSecurityDeposit =
      searchParams.get("generateSecurityDeposit") === "true";
    const advanceMonths = parseInt(searchParams.get("advanceMonths") || "0");
    const gracePeriodDays = parseInt(
      searchParams.get("gracePeriodDays") || "5"
    );

    // Calculate what invoices would be generated
    const preview = calculateInvoicePreview(lease, {
      generateSecurityDeposit,
      advanceMonths,
      gracePeriodDays,
    });

    return createSuccessResponse(
      {
        lease: {
          id: lease._id,
          tenantName: `${lease.tenantId.firstName} ${lease.tenantId.lastName}`,
          propertyName: lease.propertyId.name,
          startDate: lease.startDate,
          endDate: lease.endDate,
          rentAmount: lease.terms.rentAmount,
          securityDeposit: lease.terms.securityDeposit,
        },
        preview,
      },
      "Invoice generation preview calculated"
    );
  } catch (error) {
    return handleApiError(error, "Failed to calculate invoice preview");
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface InvoicePreviewItem {
  type: string;
  description: string;
  amount: number;
  dueDate: Date;
  issueDate: Date;
}

function calculateInvoicePreview(
  lease: any,
  config: {
    generateSecurityDeposit: boolean;
    advanceMonths: number;
    gracePeriodDays: number;
  }
): {
  totalInvoices: number;
  totalAmount: number;
  invoices: InvoicePreviewItem[];
} {
  const invoices: InvoicePreviewItem[] = [];
  let totalAmount = 0;

  // Security deposit invoice
  if (config.generateSecurityDeposit && lease.terms.securityDeposit > 0) {
    const dueDate = new Date(lease.startDate);
    dueDate.setDate(dueDate.getDate() - 7);

    const issueDate = new Date();

    invoices.push({
      type: "security_deposit",
      description: "Security Deposit",
      amount: lease.terms.securityDeposit,
      dueDate,
      issueDate,
    });

    totalAmount += lease.terms.securityDeposit;
  }

  // Advance payment invoices
  if (config.advanceMonths > 0) {
    const dueDate = new Date(lease.startDate);
    dueDate.setDate(dueDate.getDate() - 7);

    for (let i = 0; i < config.advanceMonths; i++) {
      invoices.push({
        type: "advance_rent",
        description: `Advance Rent Payment - Month ${i + 1}`,
        amount: lease.terms.rentAmount,
        dueDate,
        issueDate: new Date(),
      });

      totalAmount += lease.terms.rentAmount;
    }
  }

  // Monthly rent invoices
  const startDate = new Date(lease.startDate);
  const endDate = new Date(lease.endDate);
  const rentDueDay = lease.terms.paymentConfig?.rentDueDay || 1;

  let currentDate = new Date(startDate);
  currentDate.setDate(rentDueDay);

  if (currentDate < startDate) {
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  while (currentDate <= endDate) {
    const issueDate = new Date(currentDate);
    issueDate.setDate(issueDate.getDate() - 7);

    // Check if this is the first month and needs proration
    const isFirstMonth =
      currentDate.getMonth() === startDate.getMonth() &&
      currentDate.getFullYear() === startDate.getFullYear();

    let rentAmount = lease.terms.rentAmount;
    let description = "Monthly Rent";

    if (isFirstMonth && lease.terms.paymentConfig?.prorationEnabled) {
      const moveInDate = new Date(lease.startDate);
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );

      const daysInMonth = monthEnd.getDate();
      const daysOccupied = daysInMonth - moveInDate.getDate() + 1;

      const dailyRate = lease.terms.rentAmount / daysInMonth;
      rentAmount = Math.round(dailyRate * daysOccupied * 100) / 100;
      description = "Monthly Rent (Prorated)";
    }

    invoices.push({
      type: "monthly_rent",
      description,
      amount: rentAmount,
      dueDate: new Date(currentDate),
      issueDate,
    });

    totalAmount += rentAmount;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return {
    totalInvoices: invoices.length,
    totalAmount,
    invoices: invoices.sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
    ),
  };
}
