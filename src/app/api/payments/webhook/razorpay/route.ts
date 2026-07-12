/**
 * PropertyPro - Razorpay Webhook Handler
 * Verifies and processes Razorpay webhook events (payment.captured / failed).
 * Signature is verified against the configured webhook secret (HMAC-SHA256 of the
 * raw body); events are de-duped by the x-razorpay-event-id header so retries are
 * processed at most once.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  getRazorpayConfig,
  verifyWebhookSignature,
  handleRazorpayWebhookEvent,
} from "@/lib/services/razorpay.service";

const PROCESSED_EVENTS_COLLECTION = "razorpay_webhook_events";
const PROCESSED_EVENTS_TTL_DAYS = 30;

async function ensureProcessedEventsIndexes(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collection = db.collection(PROCESSED_EVENTS_COLLECTION);
  await collection.createIndex({ eventId: 1 }, { unique: true });
  await collection.createIndex(
    { processedAt: 1 },
    { expireAfterSeconds: PROCESSED_EVENTS_TTL_DAYS * 24 * 60 * 60 }
  );
}

async function markEventProcessed(
  eventId: string,
  eventType: string
): Promise<boolean> {
  const db = mongoose.connection.db;
  if (!db) return true;
  try {
    await db.collection(PROCESSED_EVENTS_COLLECTION).insertOne({
      eventId,
      eventType,
      processedAt: new Date(),
    });
    return true;
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return false;
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    await ensureProcessedEventsIndexes();

    const rawBody = await request.text();
    const headersList = await headers();
    const signature = headersList.get("x-razorpay-signature") || "";
    const eventId =
      headersList.get("x-razorpay-event-id") || `rzp_${Date.now()}`;

    const { webhookSecret } = await getRazorpayConfig();
    if (!webhookSecret) {
      console.error("Missing Razorpay webhook secret");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const verified = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!verified) {
      console.error("Invalid Razorpay webhook signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody) as { event: string; payload: unknown };

    const isFirstSeen = await markEventProcessed(eventId, event.event);
    if (!isFirstSeen) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await handleRazorpayWebhookEvent(event as never);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
