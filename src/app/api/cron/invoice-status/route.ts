/**
 * PropertyPro - Invoice Status Cron
 * Persists time-based invoice status transitions (SCHEDULED→ISSUED, →OVERDUE)
 * so reports and queries filtered by `status` stay accurate.
 *
 * Read paths overlay the effective status at request time; this cron keeps
 * the persisted field from drifting for batch filters and analytics.
 */

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models";
import { InvoiceStatus } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    await connectDB();
    const now = new Date();

    // SCHEDULED → ISSUED for invoices whose issueDate has arrived
    const issuedRes = await Invoice.updateMany(
      {
        status: InvoiceStatus.SCHEDULED,
        issueDate: { $lte: now },
        balanceRemaining: { $gt: 0 },
      },
      { $set: { status: InvoiceStatus.ISSUED, updatedAt: now } }
    );

    // ISSUED/PARTIAL → OVERDUE for anything past due with a balance
    const overdueRes = await Invoice.updateMany(
      {
        status: { $in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        dueDate: { $lt: now },
        balanceRemaining: { $gt: 0 },
      },
      { $set: { status: InvoiceStatus.OVERDUE, updatedAt: now } }
    );

    return NextResponse.json({
      success: true,
      message: "Invoice status sync completed",
      data: {
        issued: issuedRes.modifiedCount,
        overdue: overdueRes.modifiedCount,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error in invoice-status cron:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
