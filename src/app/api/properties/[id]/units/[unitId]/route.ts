/**
 * PropertyPro - Individual Unit API Routes
 * Handle CRUD operations for individual units
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Property, Lease } from "@/models";
import { UserRole, LeaseStatus } from "@/types";
import { deleteFromR2 } from "@/lib/r2-server";
import { isR2Url, extractObjectKey } from "@/lib/r2";
import { resolveAccessProfile } from "@/lib/server-permissions";

// GET /api/properties/[id]/units/[unitId] - Get a specific unit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Await params before using its properties
    const { id, unitId } = await params;

    // Verify property exists and user has access
    const property = await Property.findById(id);
    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this property
    const accessProfile = await resolveAccessProfile(session.user.role);

    // Single company architecture - Admin and Manager can access all units
    if (!accessProfile.isCompanyStaff) {
      // Tenants can only access units they are associated with
      // For now, we'll restrict tenant access to individual units
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the specific unit from embedded units array
    const unit = property.units.find((u: any) => u._id.toString() === unitId);

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    return NextResponse.json(unit);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/properties/[id]/units/[unitId] - Update a specific unit
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Await params before using its properties
    const { id, unitId } = await params;

    // Verify property exists and user has access
    const property = await Property.findById(id);
    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this property
    const accessProfile = await resolveAccessProfile(session.user.role);

    // Single company architecture - Admin and Manager can update units for all properties
    if (!accessProfile.isCompanyStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the existing unit in the embedded units array
    const unitIndex = property.units.findIndex(
      (u: any) => u._id.toString() === unitId
    );

    if (unitIndex === -1) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const existingUnit = property.units[unitIndex];
    const body = await request.json();

    // Check if unit number already exists for this property (excluding current unit)
    if (body.unitNumber !== existingUnit.unitNumber) {
      const duplicateUnit = property.units.find(
        (u: any) =>
          u.unitNumber === body.unitNumber && u._id.toString() !== unitId
      );

      if (duplicateUnit) {
        return NextResponse.json(
          { error: "Unit number already exists for this property" },
          { status: 400 }
        );
      }
    }

    // Transform the update data to match the schema
    const updateData: any = {
      ...existingUnit.toObject(),
      ...body,
      // Handle parking data structure
      parking:
        body.parking ||
        (body.parkingIncluded !== undefined
          ? {
              included: body.parkingIncluded || false,
              spaces: body.parkingSpaces || 0,
              type: body.parkingType || "open",
              gated: body.parkingGated || false,
              assigned: body.parkingAssigned || false,
            }
          : existingUnit.parking),
      // Handle utilities data structure
      utilities: body.utilities || {
        electricity: body.electricityIncluded ? "included" : UserRole.TENANT,
        water: body.waterIncluded ? "included" : UserRole.TENANT,
        gas: body.gasIncluded ? "included" : UserRole.TENANT,
        internet: body.internetIncluded ? "included" : UserRole.TENANT,
        heating: body.heatingIncluded ? "included" : UserRole.TENANT,
        cooling: body.coolingIncluded ? "included" : UserRole.TENANT,
        cable: existingUnit.utilities?.cable || UserRole.TENANT,
        trash: existingUnit.utilities?.trash || "included",
        sewer: existingUnit.utilities?.sewer || "included",
      },
      // Handle appliances data structure
      appliances: body.appliances || {
        refrigerator: body.refrigerator || false,
        stove: body.stove || false,
        oven: body.oven || false,
        microwave: body.microwave || false,
        dishwasher: body.dishwasher || false,
        washer: body.washer || false,
        dryer: body.dryer || false,
      },
    };

    if (String(updateData.status).toLowerCase() === "occupied") {
      const activeLease = await Lease.findOne({
        propertyId: id,
        unitId,
        status: LeaseStatus.ACTIVE,
      });
      if (!activeLease) {
        updateData.status = "available";
        updateData.currentTenantId = undefined;
        updateData.currentLeaseId = undefined;
      } else {
        updateData.currentTenantId = activeLease.tenantId;
        updateData.currentLeaseId = activeLease._id;
      }
    } else {
      updateData.currentTenantId = undefined;
      updateData.currentLeaseId = undefined;
    }

    // Check if unit status is changing to trigger property synchronization
    const oldUnitStatus = existingUnit.status;
    const newUnitStatus = updateData.status;
    const statusChanged = oldUnitStatus !== newUnitStatus;

    // Update the unit in the array
    property.units[unitIndex] = updateData;
    await property.save();

    // Trigger property status synchronization if unit status changed
    let syncWarning: string | null = null;

    if (statusChanged) {
      try {
        const { propertyStatusSynchronizer } = await import(
          "@/lib/services/property-status-sync.service"
        );

        await propertyStatusSynchronizer.syncAfterUnitStatusChange(
          id,
          unitId,
          oldUnitStatus,
          newUnitStatus,
          {
            triggeredBy: `unit-api-update:${unitId}`,
            logChanges: true,
          }
        );
      } catch (syncError) {
        const baseWarning =
          "Unit updated but status synchronization could not be verified";
        syncWarning =
          syncError instanceof Error && syncError.message
            ? `${baseWarning}: ${syncError.message}`
            : baseWarning;
      }
    }

    const responsePayload = NextResponse.json(property.units[unitIndex]);
    if (syncWarning) {
      responsePayload.headers.set("x-propertypro-warning", syncWarning);
    }

    return responsePayload;
  } catch (error) {
    if (error.name === "ValidationError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/properties/[id]/units/[unitId] - Delete a specific unit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Suppression d'une unité réservée au Super Administrateur.
    const deleteAccessProfile = await resolveAccessProfile(session.user.role);
    if (deleteAccessProfile.systemRole !== UserRole.ADMIN) {
      return NextResponse.json(
        {
          error:
            "Suppression réservée au Super Administrateur afin de préserver l'historique et les preuves",
        },
        { status: 403 }
      );
    }

    await connectDB();

    // Await params before using its properties
    const { id, unitId } = await params;

    // Verify property exists and user has access
    const property = await Property.findById(id);
    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this property
    const accessProfile = await resolveAccessProfile(session.user.role);

    // Single company architecture - Admin and Manager can delete units for all properties
    if (!accessProfile.isCompanyStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the existing unit in the embedded units array
    const unitIndex = property.units.findIndex(
      (u: any) => u._id.toString() === unitId
    );

    if (unitIndex === -1) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const existingUnit = property.units[unitIndex];

    // Check if unit has active lease or tenant
    if (existingUnit.currentTenantId || existingUnit.currentLeaseId) {
      return NextResponse.json(
        { error: "Cannot delete unit with active tenant or lease" },
        { status: 400 }
      );
    }

    // Delete unit images from storage before deleting the unit
    if (Array.isArray(existingUnit?.images)) {
      const imageDeletePromises = existingUnit.images.map(
        async (imageUrl: string) => {
          try {
            // Extract object key from URL
            let objectKey: string | null = imageUrl;
            if (
              imageUrl.startsWith("http://") ||
              imageUrl.startsWith("https://")
            ) {
              if (isR2Url(imageUrl)) {
                objectKey = extractObjectKey(imageUrl);
              } else {
                console.warn(`Skipping non-R2 URL: ${imageUrl}`);
                return;
              }
            }

            if (!objectKey) {
              console.warn(`Could not extract object key from: ${imageUrl}`);
              return;
            }

            const deleted = await deleteFromR2(objectKey);
            if (deleted) {
            } else {
              console.warn(
                `Failed to delete unit image from storage: ${imageUrl}`
              );
            }
          } catch (error) {
            console.error(
              `Error deleting unit image from storage: ${imageUrl}`,
              error
            );
            // Continue even if storage deletion fails
          }
        }
      );

      // Wait for all image deletions to complete
      await Promise.allSettled(imageDeletePromises);
    }

    // Store the old unit status for synchronization
    const deletedUnitStatus = existingUnit.status;

    // Remove the unit from the embedded array
    property.units.splice(unitIndex, 1);

    // Update property metadata
    property.totalUnits = property.units.length;
    property.isMultiUnit = property.units.length > 1;

    await property.save();

    // Trigger property status synchronization after unit deletion
    let syncWarning: string | null = null;

    try {
      const { propertyStatusSynchronizer } = await import(
        "@/lib/services/property-status-sync.service"
      );

      await propertyStatusSynchronizer.syncPropertyStatus(id, {
        triggeredBy: `unit-deletion:${unitId}`,
        logChanges: true,
      });
    } catch (syncError) {
      const baseWarning =
        "Unit deleted but status synchronization could not be verified";
      syncWarning =
        syncError instanceof Error && syncError.message
          ? `${baseWarning}: ${syncError.message}`
          : baseWarning;
    }

    const responsePayload = NextResponse.json({
      message: "Unit deleted successfully",
    });
    if (syncWarning) {
      responsePayload.headers.set("x-propertypro-warning", syncWarning);
    }

    return responsePayload;
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
