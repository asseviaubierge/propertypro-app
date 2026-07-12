/**
 * PropertyPro - Tenant Tickets API Routes
 * Simplified ticket creation endpoint for tenants
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
  createPaginationInfo,
  parsePaginationParams,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { ticketSchema, validateSchema } from "@/lib/validations";

// ============================================================================
// GET /api/tenant/tickets - Get tenant's own tickets
// ============================================================================

export const GET = withPermissionAndDB("maintenance_requests")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const paginationParams = parsePaginationParams(searchParams);

      const query: Record<string, unknown> = {
        tenantId: user.id,
      };

      const status = searchParams.get("status");
      if (status) {
        query.status = status;
      }

      const category = searchParams.get("category");
      if (category) {
        query.category = category;
      }

      if (paginationParams.search) {
        query.$or = [
          { title: { $regex: paginationParams.search, $options: "i" } },
          { description: { $regex: paginationParams.search, $options: "i" } },
          { ticketNumber: { $regex: paginationParams.search, $options: "i" } },
        ];
      }

      const { page = 1, limit = 12 } = paginationParams;
      const skip = (page - 1) * limit;

      const [tickets, total] = await Promise.all([
        Ticket.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("propertyId", "name address")
          .populate("assignedTo", "firstName lastName avatar")
          .lean(),
        Ticket.countDocuments(query),
      ]);

      const pagination = createPaginationInfo(page, limit, total);

      return createSuccessResponse(
        tickets,
        "Tickets fetched successfully",
        pagination
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// ============================================================================
// POST /api/tenant/tickets - Create ticket as tenant
// ============================================================================

export const POST = withPermissionAndDB("maintenance_requests")(
  async (user: AuthenticatedAccessUser, request: NextRequest) => {
    try {
      const body = await parseRequestBody(request);
      if (!body.success) {
        return createErrorResponse(body.error!, 400);
      }

      const ticketData = {
        ...body.data,
        tenantId: user.id,
        createdBy: {
          userId: user.id,
          role: user.originalRole,
        },
      };

      const validation = validateSchema(ticketSchema, ticketData);
      if (!validation.success) {
        return createErrorResponse(validation.errors.join(", "), 400);
      }

      const ticket = await Ticket.create({
        ...validation.data,
        status: TicketStatus.OPEN,
      });

      const populated = await Ticket.findById(ticket._id)
        .populate("propertyId", "name address")
        .populate("tenantId", "firstName lastName email avatar")
        .populate("createdBy.userId", "firstName lastName email avatar");

      return createSuccessResponse(populated, "Ticket created successfully");
    } catch (error) {
      return handleApiError(error);
    }
  }
);
