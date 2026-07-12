/**
 * PropertyPro - Individual Ticket API Routes
 * GET, PUT operations for individual ticket management
 */

import { NextRequest } from "next/server";
import { Ticket } from "@/models";
import { UserRole, TicketStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parseRequestBody,
  isValidObjectId,
  withAccessAndDB,
} from "@/lib/api-utils";
import { getTenantIdentityIds, tenantOwnsRecord } from "@/lib/inbox-visibility";

const TICKET_READ_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "maintenance_view",
    "maintenance_management",
    "maintenance_assign",
    "work_orders",
  ],
  match: "any" as const,
};

const TICKET_WRITE_ACCESS = {
  roles: [UserRole.TENANT],
  permissions: [
    "maintenance_create",
    "maintenance_management",
    "maintenance_assign",
    "work_orders",
  ],
  match: "any" as const,
};

// ============================================================================
// GET /api/tickets/[id] - Get ticket details
// ============================================================================

export const GET = withAccessAndDB(TICKET_READ_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  {
    params,
    tenantProfile,
  }: { params: Promise<{ id: string }>; tenantProfile?: any },
) => {
  try {
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return createErrorResponse("Invalid ticket ID", 400);
    }

    const ticket = await Ticket.findById(id)
      .populate("tenantId", "firstName lastName email avatar phone")
      .populate("propertyId", "name address units")
      .populate("assignedTo", "firstName lastName email avatar")
      .populate("createdBy.userId", "firstName lastName email avatar")
      .populate("comments.userId", "firstName lastName email avatar role");

    if (!ticket) {
      return createErrorResponse("Ticket not found", 404);
    }

    if (
      user.isTenant &&
      !tenantOwnsRecord(
        ticket.tenantId?._id ?? ticket.tenantId,
        getTenantIdentityIds(user, tenantProfile),
      )
    ) {
      return createErrorResponse("Forbidden", 403);
    }

    const ticketObj = ticket.toObject();
    const transformed = {
      ...ticketObj,
      tenant: ticketObj.tenantId ?? {},
      property: ticketObj.propertyId ?? null,
      assignedUser: ticketObj.assignedTo ?? null,
    };

    return createSuccessResponse(transformed, "Ticket fetched successfully");
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/tickets/[id] - Update ticket
// ============================================================================

export const PUT = withAccessAndDB(TICKET_WRITE_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  {
    params,
    tenantProfile,
  }: { params: Promise<{ id: string }>; tenantProfile?: any },
) => {
  try {
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return createErrorResponse("Invalid ticket ID", 400);
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return createErrorResponse("Ticket not found", 404);
    }

    if (user.isTenant) {
      if (
        !tenantOwnsRecord(
          ticket.tenantId,
          getTenantIdentityIds(user, tenantProfile),
        )
      ) {
        return createErrorResponse("Forbidden", 403);
      }
      if (ticket.status !== TicketStatus.OPEN) {
        return createErrorResponse("Only open tickets can be modified", 400);
      }
    }

    const body = await parseRequestBody(request);
    if (!body.success) {
      return createErrorResponse(body.error ?? "Invalid request body", 400);
    }

    const updates = body.data;
    const protectedFields = [
      "_id",
      "ticketNumber",
      "tenantId",
      "createdAt",
      "updatedAt",
    ];
    protectedFields.forEach((field) => delete updates[field]);

    if (user.isTenant) {
      const allowedTenantFields = [
        "title",
        "description",
        "category",
        "priority",
        "attachments",
      ];
      Object.keys(updates).forEach((key) => {
        if (!allowedTenantFields.includes(key)) {
          delete updates[key];
        }
      });
    }

    if (updates.status) {
      if (
        updates.status === TicketStatus.RESOLVED &&
        ticket.status !== TicketStatus.RESOLVED
      ) {
        updates.resolvedAt = new Date();
      }
      if (
        updates.status === TicketStatus.CLOSED &&
        ticket.status !== TicketStatus.CLOSED
      ) {
        updates.closedAt = new Date();
      }
    }

    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate("tenantId", "firstName lastName email avatar")
      .populate("propertyId", "name address")
      .populate("assignedTo", "firstName lastName email avatar");

    return createSuccessResponse(updatedTicket, "Ticket updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
});
