/**
 * PropertyPro - Invoice API Routes
 * RESTful API endpoints for invoice management
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice, Lease, Payment, User, Property } from "@/models";
import { InvoiceStatus, InvoiceType } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { computeEffectiveInvoiceStatus } from "@/lib/invoice/invoice-shared";
import { Types } from "mongoose";

// ============================================================================
// GET /api/invoices - List invoices with filtering
// ============================================================================
export const GET = withPermissionAndDB("financial_management")(async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId");
    const propertyId = searchParams.get("propertyId");
    const leaseId = searchParams.get("leaseId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") || "dueDate";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const search = (searchParams.get("search") || "").trim();

    // Build filter query
    const filter: any = {};

    if (user.isTenant) {
      if (requestedTenantId && requestedTenantId !== user.id) {
        return createErrorResponse("You can only view your own invoices", 403);
      }
      filter.tenantId = new Types.ObjectId(user.id);
    } else if (requestedTenantId) {
      filter.tenantId = new Types.ObjectId(requestedTenantId);
    }

    if (propertyId) filter.propertyId = new Types.ObjectId(propertyId);
    if (leaseId) filter.leaseId = new Types.ObjectId(leaseId);
    if (status) {
      filter.status = status;
    } else {
      // Exclude fully paid invoices by default so only actionable items appear
      filter.balanceRemaining = { $gt: 0 };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // If a search term is provided, use aggregation to match across joined fields
    let invoices: any[] = [];
    let total = 0;

    if (search) {
      const matchStage: any = { ...filter };
      matchStage.$or = [{ deletedAt: null }, { deletedAt: { $exists: false } }];

      const pipeline: any[] = [
        { $match: matchStage },
        {
          $lookup: {
            from: "users",
            localField: "tenantId",
            foreignField: "_id",
            as: "tenantId",
          },
        },
        { $unwind: { path: "$tenantId", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "propertyId",
          },
        },
        { $unwind: { path: "$propertyId", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { invoiceNumber: { $regex: search, $options: "i" } },
              { "tenantId.firstName": { $regex: search, $options: "i" } },
              { "tenantId.lastName": { $regex: search, $options: "i" } },
              { "tenantId.email": { $regex: search, $options: "i" } },
              { "propertyId.name": { $regex: search, $options: "i" } },
              { notes: { $regex: search, $options: "i" } },
            ],
          },
        },
        { $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            metadata: [{ $count: "total" }],
          },
        },
        { $unwind: { path: "$metadata", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            invoices: "$data",
            total: { $ifNull: ["$metadata.total", 0] },
          },
        },
      ];

      const aggResult = await Invoice.aggregate(pipeline);
      invoices = aggResult[0]?.invoices || [];
      total = aggResult[0]?.total || 0;
    } else {
      const [docs, count] = await Promise.all([
        Invoice.find(filter)
          .populate({
            path: "leaseId",
            select: "startDate endDate propertyId",
            populate: {
              path: "propertyId",
              select: "name address",
            },
          })
          .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Invoice.countDocuments(filter),
      ]);

      const tenantIds = Array.from(
        new Set(
          docs
            .map((doc: any) => doc.tenantId?.toString())
            .filter(Boolean) as string[]
        )
      );
      const propertyIds = Array.from(
        new Set(
          docs
            .map((doc: any) => doc.propertyId?.toString())
            .filter(Boolean) as string[]
        )
      );

      const [tenantRows, propertyRows] = await Promise.all([
        tenantIds.length
          ? User.collection
              .find({
                _id: { $in: tenantIds.map((id) => new Types.ObjectId(id)) },
              })
              .project({
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                avatar: 1,
                deletedAt: 1,
              })
              .toArray()
          : Promise.resolve([]),
        propertyIds.length
          ? Property.collection
              .find({
                _id: { $in: propertyIds.map((id) => new Types.ObjectId(id)) },
              })
              .project({
                _id: 1,
                name: 1,
                address: 1,
                ownerId: 1,
                deletedAt: 1,
              })
              .toArray()
          : Promise.resolve([]),
      ]);

      const tenantMap = new Map(
        tenantRows.map((tenant: any) => [tenant._id.toString(), tenant])
      );
      const propertyMap = new Map(
        propertyRows.map((property: any) => [property._id.toString(), property])
      );

      invoices = docs.map((doc: any) => {
        const tenantId = doc.tenantId?.toString();
        const propertyId = doc.propertyId?.toString();

        return {
          ...doc,
          tenantId: tenantId ? tenantMap.get(tenantId) || null : null,
          propertyId: propertyId ? propertyMap.get(propertyId) || null : null,
        };
      });
      total = count;
    }

    // Overlay an effective status on each row so stale "issued" rows that are
    // actually past due render as "overdue" until the daily cron persists it.
    const now = new Date();
    const invoicesWithStatus = invoices.map((inv) => ({
      ...inv,
      status: computeEffectiveInvoiceStatus(inv, now),
    }));

    return createSuccessResponse(
      {
        invoices: invoicesWithStatus,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      "Invoices retrieved successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/invoices - Create new invoice
// Supports both lease-based and standalone invoices
// ============================================================================
export const POST = withPermissionAndDB("financial_management")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();
    const {
      leaseId,
      tenantId,
      propertyId,
      category,
      dueDate,
      lineItems,
      notes,
      taxAmount,
      discountAmount,
      issueDate = new Date(),
    } = body;

    // Validate required fields
    if (!category) {
      return createErrorResponse("Category is required", 400);
    }

    if (!dueDate) {
      return createErrorResponse("Due date is required", 400);
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return createErrorResponse("At least one line item is required", 400);
    }

    let resolvedTenantId: any;
    let resolvedPropertyId: any;
    let resolvedLeaseId: any;
    let resolvedUnitId: any;
    let gracePeriodDays = 5;

    if (leaseId) {
      // Lease-based invoice: resolve tenant/property from lease
      const lease = await Lease.findById(leaseId).populate(
        "tenantId propertyId"
      );
      if (!lease) {
        return createErrorResponse("Lease not found", 404);
      }

      resolvedTenantId = lease.tenantId._id;
      resolvedPropertyId = lease.propertyId._id;
      resolvedLeaseId = lease._id;
      resolvedUnitId = lease.unitId;
      gracePeriodDays =
        lease.terms?.paymentConfig?.lateFeeConfig?.gracePeriodDays || 5;

      if (tenantId && tenantId !== resolvedTenantId.toString()) {
        return createErrorResponse(
          "Selected tenant does not match the lease tenant",
          400
        );
      }

      if (propertyId && propertyId !== resolvedPropertyId.toString()) {
        return createErrorResponse(
          "Selected property does not match the lease property",
          400
        );
      }
    } else {
      // Standalone invoice: tenant and property are required
      if (!tenantId) {
        return createErrorResponse("Tenant is required", 400);
      }
      if (!propertyId) {
        return createErrorResponse("Property is required", 400);
      }

      resolvedTenantId = new Types.ObjectId(tenantId);
      resolvedPropertyId = new Types.ObjectId(propertyId);

      const matchingLease = await Lease.findOne({
        tenantId: resolvedTenantId,
        propertyId: resolvedPropertyId,
        status: { $in: ["active", "pending"] },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      }).select("_id unitId terms");

      if (!matchingLease) {
        return createErrorResponse(
          "Tenant must have an active or pending lease for the selected property",
          400
        );
      }

      resolvedLeaseId = matchingLease._id;
      resolvedUnitId = matchingLease.unitId;
      gracePeriodDays =
        matchingLease.terms?.paymentConfig?.lateFeeConfig?.gracePeriodDays || 5;
    }

    // Calculate totals
    const subtotal = lineItems.reduce(
      (sum: number, item: any) => sum + item.amount,
      0
    );
    const tax = taxAmount || 0;
    const discount = discountAmount || 0;
    const totalAmount = Math.max(0, subtotal + tax - discount);

    // Generate invoice number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invoiceNumber = `INV-${year}${month}-${random}`;

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      tenantId: resolvedTenantId,
      propertyId: resolvedPropertyId,
      leaseId: resolvedLeaseId || undefined,
      unitId: resolvedUnitId || undefined,
      category,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      status: InvoiceStatus.SCHEDULED,
      subtotal,
      taxAmount: tax,
      discountAmount: discount,
      totalAmount,
      balanceRemaining: totalAmount,
      lineItems,
      gracePeriodEnd: new Date(
        new Date(dueDate).getTime() +
          gracePeriodDays * 24 * 60 * 60 * 1000
      ),
      notes,
      metadata: {
        ...body.metadata,
        createdByUserId: user.id,
      },
    });

    await invoice.save();

    // Populate the response
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate("tenantId", "firstName lastName email")
      .populate({
  path: "propertyId",
  select: "name address ownerId",
  populate: {
    path: "ownerId",
    select:
      "firstName lastName email phone accountType businessName businessLogo cip ifu rccm",
  },
})
      .populate({
        path: "leaseId",
        select: "startDate endDate propertyId",
        populate: {
          path: "propertyId",
          select: "name address",
        },
      });

    return createSuccessResponse(
      populatedInvoice,
      "Invoice created successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/invoices - Bulk update invoices
// ============================================================================
export const PATCH = withPermissionAndDB("financial_management")(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const body = await request.json();
    const { invoiceIds, updates } = body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return createErrorResponse("Invoice IDs are required", 400);
    }

    if (!updates || typeof updates !== "object") {
      return createErrorResponse("Updates object is required", 400);
    }

    // Validate invoice IDs
    const objectIds = invoiceIds.map((id: string) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid invoice ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    // Perform bulk update
    const result = await Invoice.updateMany(
      { _id: { $in: objectIds } },
      { $set: updates }
    );

    return createSuccessResponse(
      {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      `Updated ${result.modifiedCount} invoices`
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/invoices - Bulk soft delete invoices
// ============================================================================
export const DELETE = withPermissionAndDB("financial_management")(
  async (_user: AuthenticatedAccessUser, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceIds = searchParams.get("ids")?.split(",") || [];

    if (invoiceIds.length === 0) {
      return createErrorResponse("Invoice IDs are required", 400);
    }

    // Validate invoice IDs
    const objectIds = invoiceIds.map((id: string) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid invoice ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    // Check if any invoices have payments
    const invoicesWithPayments = await Invoice.find({
      _id: { $in: objectIds },
      amountPaid: { $gt: 0 },
    });

    if (invoicesWithPayments.length > 0) {
      return createErrorResponse(
        "Cannot delete invoices that have received payments",
        400
      );
    }

    // Perform soft delete
    const result = await Invoice.updateMany(
      { _id: { $in: objectIds } },
      { $set: { deletedAt: new Date(), status: InvoiceStatus.CANCELLED } }
    );

    return createSuccessResponse(
      {
        deletedCount: result.modifiedCount,
      },
      `Deleted ${result.modifiedCount} invoices`
    );
  } catch (error) {
    return handleApiError(error);
  }
});
