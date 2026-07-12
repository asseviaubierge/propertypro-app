/**
 * PropertyPro - Individual Event API
 * API endpoints for managing individual calendar events
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Event, User } from "@/models";
import {
  UserRole,
  EventStatus,
  EventPriority,
  LocationType,
  OnlinePlatform,
} from "@/types";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
  parseRequestBody,
} from "@/lib/api-utils";
import {
  calendarService,
  UpdateEventParams,
} from "@/lib/services/calendar.service";
import { z } from "zod";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateEventSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Title too long")
      .optional(),
    description: z.string().max(2000, "Description too long").optional(),
    status: z.nativeEnum(EventStatus).optional(),
    priority: z.nativeEnum(EventPriority).optional(),
    startDate: z
      .string()
      .transform((str) => new Date(str))
      .optional(),
    endDate: z
      .string()
      .transform((str) => new Date(str))
      .optional(),
    allDay: z.boolean().optional(),
    timezone: z.string().optional(),
    location: z
      .object({
        type: z.nativeEnum(LocationType),
        address: z.string().optional(),
        platform: z.nativeEnum(OnlinePlatform).optional(),
        meetingLink: z.string().url().optional().or(z.literal("")),
        meetingId: z.string().optional(),
        passcode: z.string().optional(),
      })
      .optional(),
    unitNumber: z.string().optional(),
    attendeeIds: z.array(z.string()).optional(),
    attendeeEmails: z.string().optional(),
    reminderMinutes: z.array(z.number()).optional(),
    notes: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  );

const attendeeResponseSchema = z.object({
  status: z.enum(["accepted", "declined", "tentative"]),
  notes: z.string().optional(),
});

// ============================================================================
// GET /api/calendar/events/[id] - Get event by ID
// ============================================================================
export const GET = withPermissionAndDB("property_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const eventId = id;

    // Find the event
    const event = await Event.findById(eventId).populate([
      { path: "organizer", select: "firstName lastName email" },
      { path: "propertyId", select: "name address" },
      {
        path: "tenantId",
        select: "userId",
        populate: { path: "userId", select: "firstName lastName email" },
      },
      { path: "leaseId", select: "startDate endDate rentAmount" },
      {
        path: "maintenanceRequestId",
        select: "title description priority status",
      },
    ]);

    if (!event) {
      return createErrorResponse("Event not found", 404);
    }

    // Check permissions
    const isOrganizer = event.organizer._id.toString() === user.id.toString();
    const isAttendee = event.attendees.some(
      (attendee) => attendee.userId.toString() === user.id.toString(),
    );

    if (user.isTenant && !isOrganizer && !isAttendee) {
      return createErrorResponse("Access denied", 403);
    }

    return createSuccessResponse(event, "Event retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/calendar/events/[id] - Update event
// ============================================================================
export const PUT = withPermissionAndDB("property_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const eventId = id;

    // Validate event ID
    if (!eventId || eventId === "undefined" || eventId === "null") {
      return createErrorResponse("Invalid event ID provided", 400);
    }

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    // Validate request body
    const validation = updateEventSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const updateData = validation.data as UpdateEventParams & {
      attendeeEmails?: string;
    };

    // Check if event exists and user has permission
    const existingEvent = await Event.findById(eventId);
    if (!existingEvent) {
      return createErrorResponse("Event not found", 404);
    }

    const isOrganizer =
      existingEvent.organizer.toString() === user.id.toString();
    if (!isOrganizer && !user.isAdmin) {
      return createErrorResponse(
        "Only the event organizer can update this event",
        403,
      );
    }

    // Process attendee emails if provided
    let finalAttendeeIds =
      updateData.attendeeIds ||
      existingEvent.attendees.map((a) => a.userId.toString());
    let externalAttendeeEmails: string[] = [];

    if (updateData.attendeeEmails && updateData.attendeeEmails.trim()) {
      try {
        // Parse comma-separated emails
        const emails = updateData.attendeeEmails
          .split(",")
          .map((email) => email.trim())
          .filter((email) => email.length > 0);

        if (emails.length > 0) {
          // Find users by email
          const { User } = await import("@/models");
          const foundUsers = await User.find({
            email: { $in: emails },
          }).select("_id email");

          const foundEmails = foundUsers.map((user) => user.email);
          const foundUserIds = foundUsers.map((user) => user._id.toString());

          // Add found users to attendees
          finalAttendeeIds = [
            ...new Set([...finalAttendeeIds, ...foundUserIds]),
          ];

          // Track external emails (not found in system)
          externalAttendeeEmails = emails.filter(
            (email) => !foundEmails.includes(email),
          );
        }
      } catch (error) {
        console.error("Error processing attendee emails:", error);
      }
    }

    // Remove attendeeEmails from updateData as it's not a direct field
    const { attendeeEmails, ...eventUpdateData } = updateData;
    eventUpdateData.attendeeIds = finalAttendeeIds;

    // Update the event
    const updatedEvent = await calendarService.updateEvent(
      eventId,
      eventUpdateData,
      user.id.toString(),
    );

    if (!updatedEvent) {
      return createErrorResponse("Failed to update event", 500);
    }

    // Send invitations to new external attendees if any
    if (externalAttendeeEmails.length > 0) {
      try {
        const { calendarEmailService } =
          await import("@/lib/services/calendar-email.service");
        const organizer = await User.findById(user.id);
        if (organizer) {
          const externalInvitationResult =
            await calendarEmailService.sendEventInvitationsToEmails(
              updatedEvent,
              organizer,
              externalAttendeeEmails,
            );
        }
      } catch (error) {
        console.error("Error sending external invitations:", error);
      }
    }

    return createSuccessResponse(updatedEvent, "Event updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// DELETE /api/calendar/events/[id] - Delete event
// ============================================================================
export const DELETE = withPermissionAndDB("property_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const eventId = id;

    // Validate event ID
    if (!eventId || eventId === "undefined" || eventId === "null") {
      return createErrorResponse("Invalid event ID provided", 400);
    }

    // Check if event exists and user has permission
    const existingEvent = await Event.findById(eventId);
    if (!existingEvent) {
      return createErrorResponse("Event not found", 404);
    }

    const isOrganizer =
      existingEvent.organizer.toString() === user.id.toString();
    if (!isOrganizer && !user.isAdmin) {
      return createErrorResponse(
        "Only the event organizer can delete this event",
        403,
      );
    }

    // Delete the event (soft delete)
    const deleted = await calendarService.deleteEvent(eventId);

    if (!deleted) {
      return createErrorResponse("Failed to delete event", 500);
    }

    return createSuccessResponse(
      { eventId, deleted: true },
      "Event deleted successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PATCH /api/calendar/events/[id] - Update attendee response
// ============================================================================
export const PATCH = withPermissionAndDB("property_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const eventId = id;

    // Validate event ID
    if (!eventId || eventId === "undefined" || eventId === "null") {
      return createErrorResponse("Invalid event ID provided", 400);
    }

    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Invalid request body", 400);
    }

    const { action, ...data } = body;

    if (action === "respond") {
      // Validate attendee response
      const validation = attendeeResponseSchema.safeParse(data);
      if (!validation.success) {
        return createErrorResponse(
          `Validation failed: ${validation.error.errors
            .map((e) => e.message)
            .join(", ")}`,
          400,
        );
      }

      const { status, notes } = validation.data;

      // Update attendee response
      const updated = await calendarService.updateAttendeeResponse(
        eventId,
        user.id.toString(),
        status,
        notes,
      );

      if (!updated) {
        return createErrorResponse(
          "Failed to update response or you're not an attendee",
          400,
        );
      }

      return createSuccessResponse(
        { eventId, status, notes },
        "Response updated successfully",
      );
    }

    return createErrorResponse("Invalid action", 400);
  } catch (error) {
    return handleApiError(error);
  }
});
