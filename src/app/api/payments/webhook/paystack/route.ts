/**
 * PropertyPro - Paystack Webhook Handler
 * Verifies and processes Paystack webhook events (charge.success). Signature is
 * verified against the secret key (HMAC-SHA512 of the raw body); events are
 * de-duped by event + reference so retries are processed at most once.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  getPaystackConfig,
  verifyWebhookSignature,
  handlePaystackWebhookEvent,
} from "@/lib/services/paystack.service";

const PROCESSED_EVENTS_COLLECTION = "paystack_webhook_events";
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
    const signature = headersList.get("x-paystack-signature") || "";

    const { secretKey } = await getPaystackConfig();
    if (!secretKey) {
      console.error("Missing Paystack secret key");
      return NextResponse.json(
        { error: "Secret key not configured" },
        { status: 500 }
      );
    }

    const verified = verifyWebhookSignature(rawBody, signature, secretKey);
    if (!verified) {
      console.error("Invalid Paystack webhook signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      data: { id?: string | number; reference?: string };
    };

    // Paystack has no stable event id — key on event + reference (+ data id).
    const eventId = `${event.event}:${event.data?.reference || ""}:${
      event.data?.id ?? ""
    }`;
    const isFirstSeen = await markEventProcessed(eventId, event.event);
    if (!isFirstSeen) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await handlePaystackWebhookEvent(event as never);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
