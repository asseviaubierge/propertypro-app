/**
 * PropertyPro - Lease Payment Synchronization API
 * Comprehensive API for managing synchronized payment processing, status updates, and invoice generation
 */

import { NextRequest } from "next/server";
import {
  AuthenticatedAccessUser,
  withAccessAndDB,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { UserRole } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { leasePaymentSyncService } from "@/lib/services/lease-payment-sync.service";
import { Lease, Payment } from "@/models";
import { Types } from "mongoose";

const PAYMENT_SYNC_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["lease_view", "lease_management", "payment_processing"],
  match: "any" as const,
};

// ============================================================================
// POST /api/leases/[id]/payment-sync - Setup comprehensive payment system
// ============================================================================
export const POST = withPermissionAndDB([
  "payment_processing",
  "lease_management",
])(
  async (
    _user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const leaseId = params.id;

      if (!Types.ObjectId.isValid(leaseId)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      // Verify lease exists and user has access
      const lease = await Lease.findById(leaseId);
      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      const body = await request.json();
      const {
        autoGenerateInvoices = true,
        autoEmailInvoices = true,
        updateLeaseStatus = true,
        notifyTenant = true,
        createRecurringPayments = true,
        invoiceConfig = {},
      } = body;

      // Setup comprehensive payment system
      const syncResult = await leasePaymentSyncService.setupLeasePaymentSystem(
        leaseId,
        {
          autoGenerateInvoices,
          autoEmailInvoices,
          updateLeaseStatus,
          notifyTenant,
          createRecurringPayments,
        }
      );

      if (!syncResult.success) {
        return createErrorResponse(
          `Payment system setup failed: ${syncResult.errors.join(", ")}`,
          500
        );
      }

      return createSuccessResponse(
        {
          syncResult,
          message: "Payment system setup completed successfully",
          details: {
            paymentsCreated: syncResult.paymentsCreated,
            invoicesGenerated: syncResult.invoicesGenerated,
            emailsSent: syncResult.emailsSent,
            leaseStatusUpdated: syncResult.leaseStatusUpdated,
          },
        },
        "Payment system synchronized successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PUT /api/leases/[id]/payment-sync - Update payment status with synchronization
// ============================================================================
export const PUT = withPermissionAndDB([
  "payment_processing",
  "lease_management",
])(
  async (
    _user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const leaseId = params.id;

      if (!Types.ObjectId.isValid(leaseId)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      const body = await request.json();
      const {
        paymentId,
        oldStatus,
        newStatus,
        metadata = {},
        processPayment = false,
        paymentData = {},
      } = body;

      if (!paymentId || !newStatus) {
        return createErrorResponse(
          "Payment ID and new status are required",
          400
        );
      }

      // Verify payment belongs to this lease
      const payment = await Payment.findOne({
        _id: new Types.ObjectId(paymentId),
        leaseId: new Types.ObjectId(leaseId),
      });

      if (!payment) {
        return createErrorResponse("Payment not found for this lease", 404);
      }

      let result;

      if (processPayment) {
        // Process payment with full synchronization
        result = await leasePaymentSyncService.processPaymentWithSync(
          paymentId,
          paymentData
        );
      } else {
        // Just update status with synchronization
        await leasePaymentSyncService.handlePaymentStatusChange(
          paymentId,
          oldStatus,
          newStatus,
          metadata
        );

        result = {
          payment: await Payment.findById(paymentId),
          invoiceGenerated: false,
          leaseUpdated: false,
        };
      }

      return createSuccessResponse(
        {
          payment: result.payment,
          invoiceGenerated: result.invoiceGenerated,
          leaseUpdated: result.leaseUpdated,
          message: "Payment status updated and synchronized successfully",
        },
        "Payment synchronized successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// GET /api/leases/[id]/payment-sync - Get payment synchronization status
// ============================================================================
export const GET = withAccessAndDB(PAYMENT_SYNC_READ_ACCESS)(
  async (
    _user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const leaseId = params.id;

      if (!Types.ObjectId.isValid(leaseId)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      // Verify lease exists and user has access
      const lease = await Lease.findById(leaseId)
        .populate({
          path: "tenantId",
          populate: { path: "userId", select: "firstName lastName email" },
        })
        .populate("propertyId", "name address");

      if (!lease) {
        return createErrorResponse("Bail introuvable", 404);
      }

      // Get all payments for this lease
      const payments = await Payment.find({
        leaseId: new Types.ObjectId(leaseId),
      }).sort({ dueDate: 1 });

      // Calculate payment summary
      const now = new Date();
      const summary = payments.reduce(
        (acc, payment) => {
          acc.totalDue += payment.amount;
          acc.totalPaid += payment.amountPaid || 0;

          if (payment.status === "overdue") {
            acc.totalOverdue += payment.amount - (payment.amountPaid || 0);
          }

          if (payment.dueDate > now && payment.status === "pending") {
            acc.upcomingPayments += 1;
          }

          return acc;
        },
        { totalDue: 0, totalPaid: 0, totalOverdue: 0, upcomingPayments: 0 }
      );

      // Calculate invoice status
      const invoiceStatus = {
        generated: payments.filter((p) => p.invoices?.length > 0)
          .length,
        sent: payments.filter((p) => p.invoiceEmailSent).length,
        pending: payments.filter((p) => p.status === "pending").length,
        overdue: payments.filter((p) => p.status === "overdue").length,
      };

      // Get automation status from lease configuration
      const automationStatus = {
        autoCreatePayments:
          lease.terms?.paymentConfig?.autoCreatePayments ?? false,
        autoGenerateInvoices:
          lease.terms?.paymentConfig?.autoGenerateInvoices ?? false,
        autoEmailInvoices:
          lease.terms?.paymentConfig?.autoEmailInvoices ?? false,
        prorationEnabled: lease.terms?.paymentConfig?.prorationEnabled ?? false,
      };

      return createSuccessResponse({
        lease: {
          _id: lease._id,
          status: lease.status,
          startDate: lease.startDate,
          endDate: lease.endDate,
          tenant: lease.tenantId,
          property: lease.propertyId,
        },
        payments,
        summary: {
          ...summary,
          paymentProgress:
            summary.totalDue > 0
              ? (summary.totalPaid / summary.totalDue) * 100
              : 0,
        },
        invoiceStatus,
        automationStatus,
        syncEnabled: true,
        lastSyncDate: new Date(),
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// PATCH /api/leases/[id]/payment-sync - Generate and sync invoices
// ============================================================================
export const PATCH = withPermissionAndDB([
  "payment_processing",
  "lease_management",
])(
  async (
    _user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    try {
      const leaseId = params.id;

      if (!Types.ObjectId.isValid(leaseId)) {
        return createErrorResponse("Invalid lease ID", 400);
      }

      const body = await request.json();
      const {
        generateOnPaymentCreation = true,
        generateOnPaymentDue = false,
        generateOnPaymentOverdue = true,
        autoEmailToTenant = true,
        includePaymentInstructions = true,
        reminderSchedule = [7, 3, 1],
      } = body;

      // Generate and sync invoices
      const result = await leasePaymentSyncService.generateAndSyncInvoices(
        leaseId,
        {
          generateOnPaymentCreation,
          generateOnPaymentDue,
          generateOnPaymentOverdue,
          autoEmailToTenant,
          includePaymentInstructions,
          reminderSchedule,
        }
      );

      if (result.errors.length > 0) {
        return createErrorResponse(
          `Invoice generation completed with errors: ${result.errors.join(
            ", "
          )}`,
          207 // Multi-status
        );
      }

      return createSuccessResponse(
        {
          generated: result.generated,
          emailsSent: result.emailsSent,
          errors: result.errors,
          message: "Invoices generated and synchronized successfully",
        },
        "Invoices synchronized successfully"
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);
