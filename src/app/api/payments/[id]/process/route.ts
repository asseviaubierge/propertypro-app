/**
 * PropertyPro - Payment Processing API
 * Process individual payments with real-time synchronization
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { triggerPaymentUpdate } from "../../stream/route";

interface ProcessPaymentRequest {
  paymentMethodId: string;
  amount: number;
  processPayment: boolean;
  paymentMethod: "credit_card" | "bank_transfer" | "check";
  notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentId = params.id;
    const body: ProcessPaymentRequest = await request.json();


    // Validate request
    if (!paymentId || !body.paymentMethodId || !body.amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Find the payment
    const payment = await db.collection("payments").findOne({
      _id: new ObjectId(paymentId),
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Check if payment is already processed
    if (payment.status === "paid") {
      return NextResponse.json(
        { error: "Payment already processed" },
        { status: 400 }
      );
    }

    // Simulate payment processing
    const processingResult = await processPaymentWithProvider(body);

    if (!processingResult.success) {
      return NextResponse.json(
        { error: processingResult.error },
        { status: 400 }
      );
    }

    // Update payment status
    const updatedPayment = await db.collection("payments").findOneAndUpdate(
      { _id: new ObjectId(paymentId) },
      {
        $set: {
          status: "paid",
          paidAmount: body.amount,
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

    if (!updatedPayment.value) {
      return NextResponse.json(
        { error: "Failed to update payment" },
        { status: 500 }
      );
    }

    // Update lease payment status if this is a rent payment
    if (payment.type === "rent" && payment.leaseId) {
      await updateLeasePaymentStatus(db, payment.leaseId, paymentId);
    }

    // Trigger real-time update
    triggerPaymentUpdate(updatedPayment.value);

    // Log payment processing
    await db.collection("payment_logs").insertOne({
      paymentId: new ObjectId(paymentId),
      action: "payment_processed",
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      transactionId: processingResult.transactionId,
      timestamp: new Date(),
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      data: {
        payment: updatedPayment.value,
        transaction: {
          id: processingResult.transactionId,
          amount: body.amount,
          processingFee: processingResult.processingFee,
          status: "paid",
        },
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Simulate payment processing with a payment provider (Stripe, etc.)
async function processPaymentWithProvider(paymentData: ProcessPaymentRequest) {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Simulate random success/failure (90% success rate)
  const success = Math.random() > 0.1;

  if (!success) {
    return {
      success: false,
      error: "Payment declined by bank",
    };
  }

  // Calculate processing fee
  const processingFee = paymentData.paymentMethod === "credit_card" ? 2.95 : 0;

  return {
    success: true,
    transactionId: `txn_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`,
    processingFee,
    amount: paymentData.amount,
  };
}

// Update lease payment status when a payment is processed
async function updateLeasePaymentStatus(
  db: any,
  leaseId: string,
  paymentId: string
) {
  try {
    // Find the lease
    const lease = await db.collection("leases").findOne({
      _id: new ObjectId(leaseId),
    });

    if (!lease) {
      console.warn("Lease not found for payment update:", leaseId);
      return;
    }

    // Update lease payment history
    await db.collection("leases").updateOne(
      { _id: new ObjectId(leaseId) },
      {
        $push: {
          paymentHistory: {
            paymentId: new ObjectId(paymentId),
            paidDate: new Date(),
            amount: 0, // Will be updated with actual amount
            status: "paid",
          },
        },
        $set: {
          "status.lastPaymentDate": new Date(),
          updatedAt: new Date(),
        },
      }
    );


  } catch (error) {
    console.error("Error updating lease payment status:", error);
  }
}

// GET endpoint to retrieve payment processing status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentId = params.id;

    // Connect to database
    const { db } = await connectToDatabase();

    // Find the payment with processing details
    const payment = await db.collection("payments").findOne({
      _id: new ObjectId(paymentId),
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Get processing logs
    const logs = await db
      .collection("payment_logs")
      .find({ paymentId: new ObjectId(paymentId) })
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
