/**
 * PropertyPro - Payment Processing API
 * Process individual payments with authentication and property scope checks.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  AuthenticatedAccessUser,
  createErrorResponse,
  isValidObjectId,
  withAccessAndDB,
} from "@/lib/api-utils";
import { connectToDatabase } from "@/lib/mongodb";
import { canAccessPayment } from "@/lib/payment-access";
import { UserRole } from "@/types";
import { triggerPaymentUpdate } from "../../stream/route";

interface ProcessPaymentRequest {
  paymentMethodId: string;
  amount: number;
  processPayment: boolean;
  paymentMethod: "credit_card" | "bank_transfer" | "check";
  notes?: string;
}

const PAYMENT_PROCESS_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: ["payment_processing", "financial_management"],
  match: "any" as const,
};

export const POST = withAccessAndDB(PAYMENT_PROCESS_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: paymentId } = await params;

      if (!isValidObjectId(paymentId)) {
        return createErrorResponse("Invalid payment ID", 400);
      }

      const body = (await request.json()) as ProcessPaymentRequest;
      if (!body.paymentMethodId || !body.amount || body.amount <= 0) {
        return createErrorResponse("Missing or invalid required fields", 400);
      }

      const { db } = await connectToDatabase();
      const objectId = new ObjectId(paymentId);
      const payment = await db.collection("payments").findOne({ _id: objectId });

      if (!payment) {
        return createErrorResponse("Payment not found", 404);
      }

      if (!(await canAccessPayment(user, payment))) {
        return createErrorResponse("Access denied", 403);
      }

      if (payment.status === "paid") {
        return createErrorResponse("Payment already processed", 400);
      }

      if (body.amount > Number(payment.amount || 0)) {
        return createErrorResponse(
          "Processed amount cannot exceed the payment amount",
          400
        );
      }

      const processingResult = await processPaymentWithProvider(body);
      if (!processingResult.success) {
        return createErrorResponse(
          processingResult.error || "Payment processing failed",
          400
        );
      }

      const updatedPayment = await db.collection("payments").findOneAndUpdate(
        { _id: objectId, status: { $ne: "paid" } },
        {
          $set: {
            status: "paid",
            amountPaid: body.amount,
            paidDate: new Date(),
            paymentMethod: body.paymentMethod,
            paymentMethodId: body.paymentMethodId,
            transactionId: processingResult.transactionId,
            processingFee: processingResult.processingFee,
            notes: body.notes,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      const updated = updatedPayment?.value ?? updatedPayment;
      if (!updated) {
        return createErrorResponse("Failed to update payment", 409);
      }

      if (payment.type === "rent" && payment.leaseId) {
        await updateLeasePaymentStatus(
          db,
          String(payment.leaseId),
          paymentId,
          body.amount
        );
      }

      triggerPaymentUpdate(updated);

      await db.collection("payment_logs").insertOne({
        paymentId: objectId,
        action: "payment_processed",
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        transactionId: processingResult.transactionId,
        performedBy: new ObjectId(user.id),
        timestamp: new Date(),
        notes: body.notes,
      });

      return NextResponse.json({
        success: true,
        data: {
          payment: updated,
          transaction: {
            id: processingResult.transactionId,
            amount: body.amount,
            processingFee: processingResult.processingFee,
            status: "paid",
          },
        },
      });
    } catch (error) {
      console.error("Payment processing error:", error);
      return createErrorResponse("Internal server error", 500);
    }
  }
);

export const GET = withAccessAndDB(PAYMENT_PROCESS_ACCESS)(
  async (
    user: AuthenticatedAccessUser,
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id: paymentId } = await params;
      if (!isValidObjectId(paymentId)) {
        return createErrorResponse("Invalid payment ID", 400);
      }

      const { db } = await connectToDatabase();
      const objectId = new ObjectId(paymentId);
      const payment = await db.collection("payments").findOne({ _id: objectId });

      if (!payment) {
        return createErrorResponse("Payment not found", 404);
      }

      if (!(await canAccessPayment(user, payment))) {
        return createErrorResponse("Access denied", 403);
      }

      const logs = await db
        .collection("payment_logs")
        .find({ paymentId: objectId })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();

      return NextResponse.json({
        success: true,
        data: {
          payment,
          logs,
          canProcess: payment.status !== "paid",
        },
      });
    } catch (error) {
      console.error("Error retrieving payment status:", error);
      return createErrorResponse("Internal server error", 500);
    }
  }
);

async function processPaymentWithProvider(paymentData: ProcessPaymentRequest) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const success = Math.random() > 0.1;

  if (!success) {
    return { success: false, error: "Payment declined by bank" };
  }

  return {
    success: true,
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    processingFee: paymentData.paymentMethod === "credit_card" ? 2.95 : 0,
  };
}

async function updateLeasePaymentStatus(
  db: any,
  leaseId: string,
  paymentId: string,
  amount: number
) {
  if (!ObjectId.isValid(leaseId)) return;

  await db.collection("leases").updateOne(
    { _id: new ObjectId(leaseId) },
    {
      $push: {
        paymentHistory: {
          paymentId: new ObjectId(paymentId),
          paidDate: new Date(),
          amount,
          status: "paid",
        },
      },
      $set: {
        "status.lastPaymentDate": new Date(),
        updatedAt: new Date(),
      },
    }
  );
}
