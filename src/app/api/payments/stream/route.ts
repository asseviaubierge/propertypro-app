/**
 * PropertyPro - Real-time Payment Updates API
 * Server-Sent Events endpoint for real-time payment status updates
 */

import { NextRequest } from "next/server";

// Store active connections
const connections = new Map<string, ReadableStreamDefaultController>();

// Simulate payment updates (in production, this would be triggered by actual payment events)
let updateInterval: NodeJS.Timeout | null = null;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const leaseId = searchParams.get("leaseId");
  const propertyId = searchParams.get("propertyId");

  // Create a unique connection ID
  const connectionId = `${Date.now()}-${Math.random()}`;


  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Store the connection
      connections.set(connectionId, controller);

      // Send initial connection message
      const initialMessage = {
        type: "connection_established",
        timestamp: new Date().toISOString(),
        connectionId,
        filters: { tenantId, leaseId, propertyId },
      };

      controller.enqueue(`data: ${JSON.stringify(initialMessage)}\n\n`);

      // Start sending periodic updates if this is the first connection
      if (connections.size === 1 && !updateInterval) {
        startPeriodicUpdates();
      }
    },

    cancel() {
      // Clean up when connection is closed
      connections.delete(connectionId);

      // Stop updates if no more connections
      if (connections.size === 0 && updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    },
  });

  // Return the stream with appropriate headers for SSE
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}

function startPeriodicUpdates() {
  updateInterval = setInterval(() => {
    // Simulate payment status changes
    const mockPaymentUpdate = {
      type: "payment_status_change",
      payment: {
        _id: `payment_${Date.now()}`,
        tenantId: "tenant_1",
        leaseId: "lease_1",
        amount: 1500 + Math.random() * 500,
        status: getRandomPaymentStatus(),
        dueDate: new Date(),
        type: "rent",
        description: "Monthly Rent Payment",
        updatedAt: new Date(),
      },
      timestamp: new Date().toISOString(),
    };

    // Send update to all connected clients
    broadcastUpdate(mockPaymentUpdate);
  }, 10000); // Send updates every 10 seconds
}

function broadcastUpdate(update: any) {
  const message = `data: ${JSON.stringify(update)}\n\n`;

  // Send to all active connections
  for (const [connectionId, controller] of connections.entries()) {
    try {
      controller.enqueue(message);
    } catch (error) {
      console.error("Error sending update to connection:", connectionId, error);
      // Remove failed connection
      connections.delete(connectionId);
    }
  }


}

function getRandomPaymentStatus() {
  const statuses = ["pending", "paid", "overdue", "partial", "cancelled", "refunded", "failed"];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

// Function to trigger payment updates (would be called from payment processing)
export function triggerPaymentUpdate(paymentData: any) {
  const update = {
    type: "payment_status_change",
    payment: paymentData,
    timestamp: new Date().toISOString(),
  };

  broadcastUpdate(update);
}

// Function to trigger new payment creation
export function triggerPaymentCreated(paymentData: any) {
  const update = {
    type: "payment_created",
    payment: paymentData,
    timestamp: new Date().toISOString(),
  };

  broadcastUpdate(update);
}

// Function to trigger payment deletion
export function triggerPaymentDeleted(paymentData: any) {
  const update = {
    type: "payment_deleted",
    payment: paymentData,
    timestamp: new Date().toISOString(),
  };

  broadcastUpdate(update);
}
