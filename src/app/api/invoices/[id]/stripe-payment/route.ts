/**
 * PropertyPro - Invoice Stripe Payment API
 * Handle Stripe payment processing for specific invoices
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invoice, Payment, User, ensurePaymentIndexes } from "@/models";
import { PaymentStatus, PaymentMethod, PaymentType } from "@/types";
import { stripePaymentService } from "@/lib/services/stripe-payment.service";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from "@/lib/api-utils";
import { Types } from "mongoose";
import { resolveAccessProfile } from "@/lib/server-permissions";

// POST /api/invoices/[id]/stripe-payment - Create Stripe payment intent for invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    // Connect to database
    await connectDB();
    await (ensurePaymentIndexes as any)?.();

    // Get session
    const session = await auth();
    if (!session?.user) {
      return createErrorResponse("Authentication required", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);
    const userId = session.user.id;

    // Get invoice
    const { id: invoiceId } = await params;
    if (!Types.ObjectId.isValid(invoiceId)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }
    const tenantIdRef = (invoice.tenantId as { _id?: Types.ObjectId } | null)?._id;
    if (!tenantIdRef) {
      return createErrorResponse(
        "Invoice tenant profile is unavailable. Please record this payment manually.",
        400
      );
    }

    const invoiceTenantId = invoice.tenantId?.toString();
    if (!invoiceTenantId) {
      console.error("Invoice missing tenant reference:", { invoiceId });
      return createErrorResponse(
        "Invoice is missing tenant information. Please contact support.",
        422
      );
    }

    const invoicePropertyId = invoice.propertyId?.toString();
    if (!invoicePropertyId) {
      console.error("Invoice missing property reference:", { invoiceId });
      return createErrorResponse(
        "Invoice is missing property information. Please contact support.",
        422
      );
    }

    // Check permissions - tenant can only pay their own invoices
    if (accessProfile.isTenant && invoiceTenantId !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    // Check if invoice can be paid
    if (invoice.status === "paid") {
      return createErrorResponse("Invoice is already paid", 400);
    }

    if (invoice.status === "cancelled") {
      return createErrorResponse("Cannot pay cancelled invoice", 400);
    }

    if (invoice.balanceRemaining <= 0) {
      return createErrorResponse("Invoice has no remaining balance", 400);
    }

    const body = await request.json();
    const { amount } = body;


    // Validate amount
    if (!amount || amount <= 0) {
      console.error("Invalid payment amount:", { amount, type: typeof amount });
      return createErrorResponse("Invalid payment amount", 400);
    }

    if (amount > invoice.balanceRemaining) {
      console.error("Payment amount exceeds balance:", {
        requestedAmount: amount,
        balanceRemaining: invoice.balanceRemaining,
      });
      return createErrorResponse(
        "Payment amount exceeds remaining balance",
        400
      );
    }

    // Get tenant information (bypass User query middleware so soft-deleted
    // tenants linked to historical invoices can still be paid)
    const tenant = await User.collection.findOne(
      { _id: new Types.ObjectId(invoiceTenantId) },
      {
        projection: {
          _id: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
        },
      }
    );

    if (!tenant) {
      console.error("Tenant not found for invoice:", {
        invoiceId,
        tenantId: invoiceTenantId,
      });
      return createErrorResponse("Tenant not found", 404);
    }

    if (!tenant.email) {
      console.error("Tenant missing email for invoice:", {
        invoiceId,
        tenantId: invoiceTenantId,
      });
      return createErrorResponse("Tenant email not found", 422);
    }

    const tenantName =
      `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() || "Tenant";


    // Create or get Stripe customer
    let customer;
    try {
      customer = await stripePaymentService.createOrGetCustomer(
        tenant._id.toString(),
        tenant.email,
        tenantName
      );

    } catch (error) {
      console.error("Failed to create/get Stripe customer:", error);
      return createErrorResponse(
        "Failed to set up payment customer. Please try again.",
        500
      );
    }

    // Check if there's already a pending Stripe payment for this invoice
    const existingPayment = await Payment.findOne({
      invoiceId: invoice._id,
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      stripePaymentIntentId: { $exists: true },
    });

    let payment;
    let paymentIntent;

    if (existingPayment && existingPayment.stripePaymentIntentId) {
      // Retrieve existing payment intent
      try {
        paymentIntent = await (
          await stripePaymentService.getClient()
        ).paymentIntents.retrieve(existingPayment.stripePaymentIntentId);

        // If the payment intent succeeded, update the payment record and create a new one
        if (paymentIntent.status === "succeeded") {

          // Update the existing payment to completed status
          existingPayment.status = PaymentStatus.PAID;
          existingPayment.paidDate = new Date();
          existingPayment.amountPaid = paymentIntent.amount / 100; // Convert from cents
          await existingPayment.save();

          // Create a new payment intent for this request
          paymentIntent = await stripePaymentService.createPaymentIntent(
            amount,
            customer.id,
            undefined,
            {
              invoiceId: invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
              tenantId: tenant._id.toString(),
              propertyId: invoicePropertyId,
              leaseId: invoice.leaseId?.toString() || "",
            }
          );

          // Create a new payment record for the new payment intent
          payment = new Payment({
            invoiceId: invoice._id,
            tenantId: tenant._id,
            propertyId: invoicePropertyId,
            leaseId: invoice.leaseId,
            amount: amount,
            type: PaymentType.INVOICE,
            status: PaymentStatus.PENDING,
            paymentMethod: PaymentMethod.CREDIT_CARD,
            dueDate: invoice.dueDate,
            description: `Payment for invoice ${invoice.invoiceNumber}`,
            stripePaymentIntentId: paymentIntent.id,
          });
          await payment.save();
        } else if (paymentIntent.status === "canceled") {

          // Create a new payment intent for this request
          paymentIntent = await stripePaymentService.createPaymentIntent(
            amount,
            customer.id,
            undefined,
            {
              invoiceId: invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
              tenantId: tenant._id.toString(),
              propertyId: invoicePropertyId,
              leaseId: invoice.leaseId?.toString() || "",
            }
          );

          // Update existing payment record with new payment intent
          existingPayment.stripePaymentIntentId = paymentIntent.id;
          existingPayment.amount = amount;
          existingPayment.type = PaymentType.INVOICE;
          existingPayment.paymentMethod = PaymentMethod.CREDIT_CARD;
          existingPayment.status = PaymentStatus.PENDING;
          existingPayment.description = `Online payment for invoice ${invoice.invoiceNumber}`;
          existingPayment.createdBy = userId;
          existingPayment.dueDate = invoice.dueDate;
          await existingPayment.save();
          payment = existingPayment;
        } else {
          // Payment intent is still pending/processing, reuse it
          existingPayment.type = PaymentType.INVOICE;
          existingPayment.paymentMethod = PaymentMethod.CREDIT_CARD;
          existingPayment.description =
            existingPayment.description ||
            `Online payment for invoice ${invoice.invoiceNumber}`;
          existingPayment.createdBy = existingPayment.createdBy || userId;
          payment = existingPayment;

        }
      } catch (error) {

        // Create new payment intent if existing one is not retrievable
        paymentIntent = await stripePaymentService.createPaymentIntent(
          amount,
          customer.id,
          undefined,
          {
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            tenantId: tenant._id.toString(),
            propertyId: invoicePropertyId,
            leaseId: invoice.leaseId?.toString() || "",
          }
        );

        // Update existing payment record
        existingPayment.stripePaymentIntentId = paymentIntent.id;
        existingPayment.amount = amount;
        existingPayment.type = PaymentType.INVOICE;
        existingPayment.paymentMethod = PaymentMethod.CREDIT_CARD;
        existingPayment.status = PaymentStatus.PENDING;
        existingPayment.description = `Online payment for invoice ${invoice.invoiceNumber}`;
        existingPayment.createdBy = userId;
        existingPayment.dueDate = invoice.dueDate;
        await existingPayment.save();
        payment = existingPayment;
      }
    } else {
      // Create new payment intent

      try {
        paymentIntent = await stripePaymentService.createPaymentIntent(
          amount,
          customer.id,
          undefined,
          {
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            tenantId: tenant._id.toString(),
            propertyId: invoicePropertyId,
            leaseId: invoice.leaseId?.toString() || "",
          }
        );

      } catch (error) {
        console.error("Failed to create Stripe payment intent:", error);
        return createErrorResponse(
          "Failed to create payment. Please check your Stripe configuration.",
          500
        );
      }

      const paymentData = {
        tenantId: invoiceTenantId,
        propertyId: invoicePropertyId,
        leaseId: invoice.leaseId,
        invoiceId: invoice._id,
        amount,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.PENDING,
        type: PaymentType.INVOICE,
        dueDate: invoice.dueDate,
        stripePaymentIntentId: paymentIntent.id,
        description: `Online payment for invoice ${invoice.invoiceNumber}`,
        createdBy: userId,
      };

      payment = new Payment(paymentData);

      try {
        await payment.save();

      } catch (error) {
        const mongoError = error as { code?: number; message?: string };
        console.error("Error saving payment record:", mongoError);

        if (mongoError?.code === 11000) {

          // Ensure indexes are up-to-date and retry once
          await (ensurePaymentIndexes as any)?.();
          const retryPayment = new Payment(paymentData);

          try {
            await retryPayment.save();
            payment = retryPayment;

          } catch (retryError) {
            const retryMongoError = retryError as { code?: number };

            if (retryMongoError?.code === 11000) {

              const existingInvoicePayment = await Payment.findOne({
                invoiceId: invoice._id,
                stripePaymentIntentId: paymentIntent.id,
              });

              if (existingInvoicePayment) {
                payment = existingInvoicePayment;

              } else {
                console.error("Duplicate error but no existing payment found");
                throw retryError;
              }
            } else {
              throw retryError;
            }
          }
        } else {
          throw mongoError;
        }
      }
    }

    // Log for debugging

    return createSuccessResponse(
      {
        paymentIntent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret, // Stripe uses client_secret with underscore
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        },
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status,
        },
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
        },
      },
      "Payment intent created successfully"
    );
  } catch (error) {
    console.error("Error in POST /api/invoices/[id]/stripe-payment:", error);
    return handleApiError(error);
  }
}

// PATCH /api/invoices/[id]/stripe-payment - Confirm Stripe payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    // Connect to database
    await connectDB();

    // Get session
    const session = await auth();
    if (!session?.user) {
      return createErrorResponse("Authentication required", 401);
    }

    const accessProfile = await resolveAccessProfile(session.user.role);
    const userId = session.user.id;

    // Get invoice
    const { id: invoiceId } = await params;
    if (!Types.ObjectId.isValid(invoiceId)) {
      return createErrorResponse("Invalid invoice ID", 400);
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return createErrorResponse("Invoice not found", 404);
    }

    const invoiceTenantId = invoice.tenantId?.toString();
    if (!invoiceTenantId) {
      console.error("Invoice missing tenant reference:", { invoiceId });
      return createErrorResponse(
        "Invoice is missing tenant information. Please contact support.",
        422
      );
    }

    // Check permissions
    if (accessProfile.isTenant && invoiceTenantId !== userId) {
      return createErrorResponse("Access denied", 403);
    }

    const body = await request.json();
    const { paymentIntentId, paymentMethodId } = body;

    if (!paymentIntentId) {
      return createErrorResponse("Payment intent ID is required", 400);
    }

    // Find payment record
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntentId,
      invoiceId: invoice._id,
    });

    if (!payment) {
      return createErrorResponse("Payment record not found", 404);
    }

    // Confirm payment intent
    const confirmedPayment = await stripePaymentService.confirmPaymentIntent(
      paymentIntentId,
      paymentMethodId
    );

    if (confirmedPayment.status === "succeeded") {
      // Update payment record
      payment.status = PaymentStatus.PAID;
      payment.paidDate = new Date();
      // Amount returned by service helper is already normalized to dollars
      payment.amountPaid = confirmedPayment.amount;
      if (paymentMethodId) {
        payment.stripePaymentMethodId = paymentMethodId;
      }
      await payment.save();

      // Update invoice
      await (invoice as any).addPayment?.(payment._id, confirmedPayment.amount);

      return createSuccessResponse(
        {
          payment: {
            id: payment._id,
            amount: payment.amountPaid,
            status: payment.status,
            paidDate: payment.paidDate,
          },
          invoice: {
            id: invoice._id,
            amountPaid: invoice.amountPaid,
            balanceRemaining: invoice.balanceRemaining,
            status: invoice.status,
          },
          stripePayment: {
            id: confirmedPayment.id,
            status: confirmedPayment.status,
            amount: confirmedPayment.amount,
          },
        },
        "Payment confirmed successfully"
      );
    } else {
      // Update payment status to failed
      payment.status = PaymentStatus.FAILED;
      await payment.save();

      return createErrorResponse(
        `Payment confirmation failed: ${confirmedPayment.status}`,
        400
      );
    }
  } catch (error) {
    console.error("Error in PATCH /api/invoices/[id]/stripe-payment:", error);
    return handleApiError(error);
  }
}
