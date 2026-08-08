/**
 * PropertyPro - Calendar RSVP API
 * Handle RSVP responses for calendar event invitations
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Event, User } from "@/models";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withDatabase,
  parseRequestBody,
} from "@/lib/api-utils";
import { calendarEmailService } from "@/lib/services/calendar-email.service";
import { z } from "zod";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const rsvpSchema = z.object({
  token: z.string().min(1, "Token is required"),
  response: z.enum(["accepted", "declined", "tentative"]),
  message: z.string().optional(),
});

const rsvpQuerySchema = z.object({
  token: z.string().min(1, "Token is required"),
  response: z.enum(["accepted", "declined", "tentative"]).optional(),
});

// ============================================================================
// GET /api/calendar/rsvp - Get RSVP details from token
// ============================================================================
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validation = rsvpQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return createErrorResponse(
        `Invalid query parameters: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const { token, response } = validation.data;

    // If response is provided, process it immediately
    if (response) {
      const result = await calendarEmailService.processRSVP(token, response);

      if (!result.success) {
        return createErrorResponse(
          result.error || "Failed to process RSVP",
          400,
        );
      }

      return createSuccessResponse(
        {
          event: result.event,
          attendee: result.attendee,
          response,
          message: "RSVP processed successfully",
        },
        "RSVP processed successfully",
      );
    }

    // Otherwise, just decode token and return event details
    try {
      const payload = JSON.parse(Buffer.from(token, "base64").toString());
      const { eventId, attendeeId, email, external } = payload;

      const event = await Event.findById(eventId).populate(
        "organizer",
        "firstName lastName email",
      );
      if (!event) {
        return createErrorResponse("Événement introuvable", 400);
      }

      // Handle external users (not registered in system)
      if (external) {
        return createSuccessResponse(
          {
            event: {
              _id: event._id,
              title: event.title,
              description: event.description,
              startDate: event.startDate,
              endDate: event.endDate,
              location: event.location,
              type: event.type,
              allDay: event.allDay,
              organizer: event.organizer,
            },
            attendee: {
              email: email,
              firstName: email.split("@")[0],
              lastName: "",
              isExternal: true,
            },
            currentResponse: "pending", // External users start as pending
            respondedAt: null,
            isExternal: true,
          },
          "RSVP details retrieved successfully",
        );
      }

      // Handle registered users
      const attendee = await User.findById(attendeeId);
      if (!attendee) {
        return createErrorResponse("Attendee not found", 400);
      }

      // Find attendee in event
      const eventAttendee = event.attendees.find(
        (a) => a.userId.toString() === attendeeId,
      );

      if (!eventAttendee) {
        return createErrorResponse("Attendee not found in event", 400);
      }

      return createSuccessResponse(
        {
          event: {
            _id: event._id,
            title: event.title,
            description: event.description,
            startDate: event.startDate,
            endDate: event.endDate,
            location: event.location,
            type: event.type,
            allDay: event.allDay,
            organizer: event.organizer,
          },
          attendee: {
            _id: attendee._id,
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            email: attendee.email,
            isExternal: false,
          },
          currentResponse: eventAttendee.status,
          respondedAt: eventAttendee.respondedAt,
          isExternal: false,
        },
        "RSVP details retrieved successfully",
      );
    } catch (error) {
      return createErrorResponse("Invalid token format", 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// POST /api/calendar/rsvp - Process RSVP response
// ============================================================================
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Requête invalide", 400);
    }

    // Validate request body
    const validation = rsvpSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const { token, response, message } = validation.data;

    // Process RSVP
    const result = await calendarEmailService.processRSVP(token, response);

    if (!result.success) {
      return createErrorResponse(result.error || "Failed to process RSVP", 400);
    }

    // If there's a message, save it as a note
    if (message && result.event) {
      await Event.updateOne(
        { _id: result.event._id, "attendees.userId": result.attendee?._id },
        {
          $set: {
            "attendees.$.notes": message,
          },
        },
      );
    }

    return createSuccessResponse(
      {
        event: result.event,
        attendee: result.attendee,
        response,
        message: "RSVP processed successfully",
      },
      "RSVP processed successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// PUT /api/calendar/rsvp - Update existing RSVP response
// ============================================================================
export const PUT = withDatabase(async (request: NextRequest) => {
  try {
    const { success, data: body, error } = await parseRequestBody(request);
    if (!success) {
      return createErrorResponse(error ?? "Requête invalide", 400);
    }

    // Validate request body
    const validation = rsvpSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        `Validation failed: ${validation.error.errors
          .map((e) => e.message)
          .join(", ")}`,
        400,
      );
    }

    const { token, response, message } = validation.data;

    // Process RSVP using the enhanced service method
    const result = await calendarEmailService.processRSVP(token, response);

    if (!result.success) {
      return createErrorResponse(result.error || "Failed to process RSVP", 400);
    }

    // If there's a message and it's a registered user, save it as a note
    if (message && result.attendee && !result.isExternal) {
      await Event.updateOne(
        { _id: result.event?._id, "attendees.userId": result.attendee._id },
        {
          $set: {
            "attendees.$.notes": message,
          },
        },
      );
    }

    return createSuccessResponse(
      {
        event: result.event,
        attendee: result.attendee,
        isExternal: result.isExternal,
        email: result.email,
        response,
        message: "RSVP updated successfully",
      },
      "RSVP updated successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});

// ============================================================================
// Helper function to send bulk invitations
// ============================================================================
export async function sendEventInvitations(
  eventId: string,
  organizerId: string,
  attendeeIds: string[],
) {
  try {
    const event = await Event.findById(eventId);
    const organizer = await User.findById(organizerId);

    if (!event || !organizer) {
      throw new Error("Event or organizer not found");
    }

    const result = await calendarEmailService.sendEventInvitations(
      event,
      organizer,
      attendeeIds,
    );

    return result;
  } catch (error) {
    console.error("Failed to send event invitations:", error);
    return {
      success: false,
      sent: 0,
      failed: attendeeIds.length,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

// ============================================================================
// Helper function to send event reminders
// ============================================================================
export async function sendEventReminders(
  eventId: string,
  reminderType: "1_hour" | "1_day" | "1_week",
) {
  try {
    const event = await Event.findById(eventId);

    if (!event) {
      throw new Error("Événement introuvable");
    }

    const result = await calendarEmailService.sendEventReminders(
      event,
      reminderType,
    );
    return result;
  } catch (error) {
    console.error("Failed to send event reminders:", error);
    return { success: false, sent: 0, failed: 0 };
  }
}
