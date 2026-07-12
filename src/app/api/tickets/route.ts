/**
 * PropertyPro - Support Tickets API Routes
 * CRUD operations for support ticket management
 */

import { NextRequest } from "next/server";
import { Ticket, Property, User } from "@/models";
import { UserRole, TicketStatus } from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  parsePaginationParams,
  parseRequestBody,
  createPaginationInfo,
  withAccessAndDB,
} from "@/lib/api-utils";
import {
  buildTenantTicketFilter,
  tenantOwnsRecord,
  getTenantIdentityIds,
} from "@/lib/inbox-visibility";
import {
  ticketSchema,
  paginationSchema,
  validateSchema,
} from "@/lib/validations";

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
// GET /api/tickets - Get all tickets with pagination and filtering
// ============================================================================

export const GET = withAccessAndDB(TICKET_READ_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  context?: { tenantProfile?: any },
) => {
  try {
    const { searchParams } = new URL(request.url);
    const paginationParams = parsePaginationParams(searchParams);

    const filterParams = {
      ...paginationParams,
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      propertyId: searchParams.get("propertyId") ?? undefined,
      assignedTo: searchParams.get("assignedTo") ?? undefined,
    };

    const validation = validateSchema(paginationSchema, paginationParams);
    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

    const query: Record<string, unknown> = {};

    if (user.isTenant) {
      Object.assign(
        query,
        buildTenantTicketFilter(user, context?.tenantProfile),
      );
    }

    if (filterParams.status) {
      query.status = filterParams.status;
    }
    if (filterParams.priority) {
      query.priority = filterParams.priority;
    }
    if (filterParams.category) {
      query.category = filterParams.category;
    }
    if (filterParams.propertyId) {
      query.propertyId = filterParams.propertyId;
    }
    if (filterParams.assignedTo) {
      query.assignedTo = filterParams.assignedTo;
    }

    if (filterParams.search) {
      query.$or = [
        { title: { $regex: filterParams.search, $options: "i" } },
        { description: { $regex: filterParams.search, $options: "i" } },
        { ticketNumber: { $regex: filterParams.search, $options: "i" } },
      ];
    }

    const { page = 1, limit = 12, sortBy, sortOrder } = paginationParams;
    const skip = (page - 1) * limit;

    const sort: Record<string, 1 | -1> = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("tenantId", "firstName lastName email avatar")
        .populate("propertyId", "name address")
        .populate("assignedTo", "firstName lastName email avatar")
        .populate("createdBy.userId", "firstName lastName email avatar")
        .lean(),
      Ticket.countDocuments(query),
    ]);

    const pagination = createPaginationInfo(page, limit, total);

    const transformedData = tickets.map((ticket: any) => ({
      ...ticket,
      tenant: ticket.tenantId || {},
      property: ticket.propertyId || null,
      assignedUser: ticket.assignedTo || null,
    }));

    return createSuccessResponse(
      transformedData,
      "Tickets fetched successfully",
      pagination,
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/tickets - Create a new ticket
// ============================================================================

export const POST = withAccessAndDB(TICKET_WRITE_ACCESS)(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  context?: { tenantProfile?: any },
) => {
  try {
    const body = await parseRequestBody(request);
    if (!body.success) {
      return createErrorResponse(body.error ?? "Invalid request body", 400);
    }

    const validation = validateSchema(ticketSchema, body.data);
    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

    const data = validation.data;

    if (user.isTenant) {
      data.tenantId = user.id;
    }

    data.createdBy = {
      userId: user.id,
      role: user.originalRole,
    };

    const tenant = await User.findById(data.tenantId);
    if (!tenant) {
      return createErrorResponse("Tenant not found", 404);
    }

    if (
      user.isTenant &&
      !tenantOwnsRecord(
        data.tenantId,
        getTenantIdentityIds(user, context?.tenantProfile),
      )
    ) {
      return createErrorResponse("Forbidden", 403);
    }

    if (data.propertyId) {
      const property = await Property.findById(data.propertyId);
      if (!property) {
        return createErrorResponse("Property not found", 404);
      }
    }

    if (data.assignedTo) {
      const assignee = await User.findById(data.assignedTo);
      if (!assignee) {
        return createErrorResponse("Assigned user not found", 404);
      }
    }

    const ticket = await Ticket.create({
      ...data,
      status: TicketStatus.OPEN,
    });

    const populated = await Ticket.findById(ticket._id)
      .populate("tenantId", "firstName lastName email avatar")
      .populate("propertyId", "name address")
      .populate("assignedTo", "firstName lastName email avatar")
      .populate("createdBy.userId", "firstName lastName email avatar");

    return createSuccessResponse(populated, "Ticket created successfully");
  } catch (error) {
    return handleApiError(error);
  }
});
