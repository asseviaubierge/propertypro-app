/**
 * PropertyPro - Ticket Comments API Routes
 * GET, POST operations for ticket comments
 */

import { NextRequest } from "next/server";
import { Ticket } from "@/models";
import { UserRole } from "@/types";
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
import { ticketCommentSchema, validateSchema } from "@/lib/validations";

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
// GET /api/tickets/[id]/comments - Get ticket comments
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
      .select("comments tenantId")
      .populate("comments.userId", "firstName lastName email avatar role");

    if (!ticket) {
      return createErrorResponse("Ticket not found", 404);
    }

    if (
      user.isTenant &&
      !tenantOwnsRecord(
        ticket.tenantId,
        getTenantIdentityIds(user, tenantProfile),
      )
    ) {
      return createErrorResponse("Forbidden", 403);
    }

    let comments = ticket.comments ?? [];
    if (user.isTenant) {
      comments = comments.filter((comment: any) => !comment.isInternal);
    }

    return createSuccessResponse(comments, "Comments fetched successfully");
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/tickets/[id]/comments - Add comment to ticket
// ============================================================================

export const POST = withAccessAndDB(TICKET_WRITE_ACCESS)(async (
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

    if (
      user.isTenant &&
      !tenantOwnsRecord(
        ticket.tenantId,
        getTenantIdentityIds(user, tenantProfile),
      )
    ) {
      return createErrorResponse("Forbidden", 403);
    }

    const body = await parseRequestBody(request);
    if (!body.success) {
      return createErrorResponse(body.error ?? "Invalid request body", 400);
    }

    const validation = validateSchema(ticketCommentSchema, body.data);
    if (!validation.success) {
      return createErrorResponse(validation.errors.join(", "), 400);
    }

    const commentData = validation.data;
    if (user.isTenant) {
      commentData.isInternal = false;
    }

    ticket.comments.push({
      userId: user.id,
      message: commentData.message,
      attachments: commentData.attachments ?? [],
      isInternal: commentData.isInternal ?? false,
    } as any);
    await ticket.save();

    const updated = await Ticket.findById(id)
      .select("comments")
      .populate("comments.userId", "firstName lastName email avatar role");

    const latestComment =
      updated?.comments?.[Math.max((updated?.comments?.length ?? 1) - 1, 0)] ??
      null;

    return createSuccessResponse(latestComment, "Comment added successfully");
  } catch (error) {
    return handleApiError(error);
  }
});
