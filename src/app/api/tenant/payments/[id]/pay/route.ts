/**
 * PropertyPro - Payment Processing API
 * API endpoint for processing tenant payments
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Payment } from "@/models";
import { UserRole, PaymentStatus } from "@/types";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
  isValidObjectId,
} from "@/lib/api-utils";
import { tenantPaymentProcessSchema, validateSchema } from "@/lib/validations";

// ============================================================================
// POST /api/tenant/payments/[id]/pay - Process payment
// ============================================================================

export const POST = withPermissionAndDB("payment_portal")(
  async (
    user,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
    context?: { tenantProfile?: any }
  ) => {
    try {
      const { id } = await params;

      if (!isValidObjectId(id)) {
        return createErrorResponse("Invalid payment ID", 400);
      }

      const { success, data: body } = await parseRequestBody(request);
      if (!success) {
        return createErrorResponse("Invalid request body", 400);
      }

      // Validate request body
      const validationResult = validateSchema(tenantPaymentProcessSchema, {
        ...body,
        paymentId: id,
      });

      if (!validationResult.success) {
        return createErrorResponse(validationResult.error!, 400);
      }

      const {
        paymentMethod,
        savePaymentMethod = false,
        confirmAmount,
      } = validationResult.data!;

      const tenant = context?.tenantProfile;
      if (!tenant) {
        return createErrorResponse("Tenant profile unavailable", 500);
      }

      if (
        typeof tenant.populated === "function" &&
        !tenant.populated("userId")
      ) {
        await tenant.populate("userId", "firstName lastName email");
      }

      // Find the payment
      const payment = await Payment.findById(id);
      if (!payment) {
        return createErrorResponse("Payment not found", 404);
      }

      // Verify payment belongs to this tenant
      if (payment.tenantId.toString() !== tenant._id.toString()) {
        return createErrorResponse("Access denied", 403);
      }

      // Check if payment can be processed
      if (
        ![PaymentStatus.PENDING, PaymentStatus.OVERDUE].includes(payment.status)
      ) {
        return createErrorResponse(
          "Payment cannot be processed in its current status",
          400
        );
      }

      // Validate payment method
      if (!paymentMethod) {
        return createErrorResponse("Payment method is required", 400);
      }

      const validPaymentMethods = [
        "credit_card",
        "debit_card",
        "bank_transfer",
        "ach",
      ];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return createErrorResponse("Invalid payment method", 400);
      }

      // Calculate total amount (including late fees)
      const totalAmount = payment.amount + (payment.lateFee || 0);

      // Validate confirmed amount matches total amount
      if (confirmAmount && Math.abs(confirmAmount - totalAmount) > 0.01) {
        return createErrorResponse(
          `Amount confirmation failed. Expected ${totalAmount.toFixed(
            2
          )}, received ${confirmAmount.toFixed(2)}`,
          400
        );
      }

      // Process payment (mock implementation)
      // In a real implementation, this would integrate with payment processors like Stripe, Square, etc.
      const paymentResult = await processPayment({
        amount: totalAmount,
        paymentMethod,
        description: payment.description,
        tenantId: tenant._id.toString(),
        paymentId: payment._id.toString(),
      });

      if (!paymentResult.success) {
        // Update payment status to failed
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = paymentResult.error;
        await payment.save();

        return createErrorResponse(
          paymentResult.error || "Payment processing failed",
          400
        );
      }

      // Update payment record
      payment.status = PaymentStatus.PAID;
      payment.paidDate = new Date();
      payment.paymentMethod = paymentMethod;
      payment.transactionId = paymentResult.transactionId;
      payment.receiptUrl = paymentResult.receiptUrl;

      await payment.save();

      // Generate receipt (mock implementation)
      const tenantUser = tenant.userId as {
        firstName?: string;
        lastName?: string;
        email?: string;
      };

      const receiptData = {
        paymentId: payment._id,
        transactionId: paymentResult.transactionId,
        amount: totalAmount,
        paymentMethod,
        paidDate: payment.paidDate,
        description: payment.description,
        tenant: {
          name: `${tenantUser?.firstName ?? ""} ${
            tenantUser?.lastName ?? ""
          }`.trim(),
          email: tenantUser?.email ?? "",
        },
      };

      // In a real implementation, you would:
      // 1. Send payment confirmation email
      // 2. Update accounting records
      // 3. Generate PDF receipt
      // 4. Send notifications to property manager

      return createSuccessResponse(
        {
          payment,
          transaction: {
            id: paymentResult.transactionId,
            amount: totalAmount,
            status: "paid",
            receiptUrl: paymentResult.receiptUrl,
          },
          receipt: receiptData,
        },
        "Payment processed successfully"
      );
    } catch (error) {
      return handleApiError(error, "Failed to process payment");
    }
  }
);

// ============================================================================
// PAYMENT PROCESSING HELPER FUNCTIONS
// ============================================================================

interface PaymentProcessingRequest {
  amount: number;
  paymentMethod: string;
  description: string;
  tenantId: string;
  paymentId: string;
}

interface PaymentProcessingResult {
  success: boolean;
  transactionId?: string;
  receiptUrl?: string;
  error?: string;
}

/**
 * Mock payment processing function
 * In a real implementation, this would integrate with actual payment processors
 */
async function processPayment(
  request: PaymentProcessingRequest
): Promise<PaymentProcessingResult> {
  // Simulate payment processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mock payment processing logic
  // In reality, this would call Stripe, Square, or other payment processor APIs

  // Simulate random payment failures (5% failure rate for testing)
  if (Math.random() < 0.05) {
    return {
      success: false,
      error: "Payment declined by bank",
    };
  }

  // Generate mock transaction ID
  const transactionId = `txn_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Generate mock receipt URL
  const receiptUrl = `/api/tenant/payments/${request.paymentId}/receipt`;

  return {
    success: true,
    transactionId,
    receiptUrl,
  };
}

/**
 * Mock function to validate payment method details
 * In a real implementation, this would validate credit card numbers, bank accounts, etc.
 */
function validatePaymentMethod(paymentMethod: string, details: any): boolean {
  // Mock validation - always return true for demo
  return true;
}

/**
 * Mock function to calculate processing fees
 * In a real implementation, this would calculate actual processor fees
 */
function calculateProcessingFee(amount: number, paymentMethod: string): number {
  const feeRates = {
    credit_card: 0.029, // 2.9%
    debit_card: 0.015, // 1.5%
    bank_transfer: 0.005, // 0.5%
    ach: 0.008, // 0.8%
  };

  const rate = feeRates[paymentMethod as keyof typeof feeRates] || 0.029;
  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
}
