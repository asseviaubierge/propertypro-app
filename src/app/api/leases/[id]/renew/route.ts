import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Lease from "@/models/Lease";
import { LeaseStatus } from "@/types";
import mongoose from "mongoose";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const { id } = params;
    const body = await req.json();

    const {
      newStartDate,
      newEndDate,
      newTerms,
      notes,
      renewalType
    } = body;

    // 1. Find the existing lease
    const oldLease = await Lease.findById(id);

    if (!oldLease) {
      return NextResponse.json(
        { success: false, error: "Lease not found" },
        { status: 404 }
      );
    }

    // 2. Create the new lease object
    // Default start date is day after old end date
    const defaultStartDate = new Date(oldLease.endDate);
    defaultStartDate.setDate(defaultStartDate.getDate() + 1);

    const newLeaseData = {
      propertyId: oldLease.propertyId,
      unitId: oldLease.unitId,
      tenantId: oldLease.tenantId,
      startDate: newStartDate ? new Date(newStartDate) : defaultStartDate,
      endDate: new Date(newEndDate),
      status: LeaseStatus.DRAFT, // Start as draft for review/signing
      terms: {
        ...oldLease.terms,
        // Override with new terms if provided
        ...(newTerms || {}),
      },
      parentLeaseId: oldLease._id,
      paymentStatus: "pending",
      documents: [], // Don't copy signed docs
      renewalOptions: {
        available: true,
      },
      notes: notes || `Renewed from lease ${oldLease._id}`,
    };

    // 3. Save the new lease
    const newLease = await Lease.create(newLeaseData);

    // 4. Update the old lease
    // We mark it as RENEWED and link to the new lease
    oldLease.status = LeaseStatus.RENEWED;
    oldLease.renewedLeaseId = newLease._id as mongoose.Types.ObjectId;
    await oldLease.save();

    return NextResponse.json({
      success: true,
      message: "Lease renewed successfully",
      data: {
        oldLease,
        newLease,
      },
    });
  } catch (error: any) {
    console.error("Error renewing lease:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
