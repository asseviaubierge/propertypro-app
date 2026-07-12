/**
 * PropertyPro - Stripe Webhook Handler
 * Handles Stripe webhook events for payment processing
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import mongoose from "mongoose";
import { constructWebhookEvent, handleWebhookEvent } from "@/lib/stripe";
import { getStripeWebhookSecret } from "@/lib/services/payment-config.service";
import connectDB from "@/lib/mongodb";

const PROCESSED_EVENTS_COLLECTION = "stripe_webhook_events";
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
    // Connect to database
    await connectDB();
    await ensureProcessedEventsIndexes();

    // Get the raw body
    const body = await request.text();

    // Get the Stripe signature from headers
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      console.error("Missing Stripe signature");
      return NextResponse.json(
        { error: "Missing Stripe signature" },
        { status: 400 }
      );
    }

    // Resolve the signing secret DB-first (admin settings) with env fallback.
    const webhookSecret = await getStripeWebhookSecret();
    if (!webhookSecret) {
      console.error("Missing Stripe webhook secret");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Construct the Stripe event
    const event = await constructWebhookEvent(body, signature, webhookSecret);

    // Idempotency: skip if already processed
    const isFirstSeen = await markEventProcessed(event.id, event.type);
    if (!isFirstSeen) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Handle the event
    await handleWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
