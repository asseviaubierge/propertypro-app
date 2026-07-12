/**
 * PropertyPro - Calendar Email Service
 * Handles email notifications for calendar events including invitations, reminders, and RSVP tracking
 */

import { EmailService } from "@/lib/email-service";
import { IEvent, IUser, IEventLocation, LocationType } from "@/types";
import { Event, User } from "@/models";
import mongoose from "mongoose";

export interface EventInvitation {
  eventId: string;
  attendeeId: string;
  email: string;
  name: string;
  token: string;
  status: "pending" | "accepted" | "declined" | "tentative";
  sentAt: Date;
  respondedAt?: Date;
}

export interface ReminderSchedule {
  eventId: string;
  attendeeId: string;
  reminderType: "1_hour" | "1_day" | "1_week";
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
}

export interface EmailDispatchResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

export class CalendarEmailService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Format event location for email display
   */
  private formatLocationForEmail(
    location?: IEventLocation
  ): string | undefined {
    if (!location) return undefined;

    if (location.type === LocationType.PHYSICAL && location.address) {
      return location.address;
    }

    if (location.type === LocationType.ONLINE) {
      if (location.meetingLink) {
        return location.meetingLink;
      }
      if (location.platform) {
        return `Online Meeting (${location.platform.replace("_", " ")})${
          location.meetingId ? ` - ID: ${location.meetingId}` : ""
        }`;
      }
      return "Online Meeting";
    }

    return undefined;
  }

  /**
   * Send event invitations to all attendees
   */
  async sendEventInvitations(
    event: IEvent,
    organizer: IUser,
    attendeeIds: string[]
  ): Promise<EmailDispatchResult> {
    try {
      const attendees = await this.findUsersByIds(attendeeIds);

      if (attendees.length === 0) {
        return this.finalizeDispatchResult(this.createDispatchResult());
      }

      const organizerName = this.getFullName(organizer);
      const eventDetails = {
        ...this.buildEventEmailDetails(event),
        organizer: organizerName,
      };

      return this.dispatchEmails(
        attendees,
        async (attendee) => {
          const invitationToken = this.generateInvitationToken(
            String(event._id),
            String(attendee._id)
          );

          const emailSent = await this.emailService.sendEventInvitation(
            attendee.email,
            this.getFullName(attendee),
            eventDetails,
            invitationToken
          );

          if (!emailSent) {
            return false;
          }

          await Event.updateOne(
            { _id: event._id, "attendees.userId": attendee._id },
            {
              $set: {
                "attendees.$.status": "pending",
                "attendees.$.invitedAt": new Date(),
                "attendees.$.invitationToken": invitationToken,
              },
            }
          );

          return true;
        },
        (attendee) => `Failed to send invitation to ${attendee.email}`
      );
    } catch (error) {
      return this.failureDispatchResult(
        attendeeIds.length,
        "Failed to send invitations",
        error
      );
    }
  }

  /**
   * Send event invitations to external email addresses (non-registered users)
   */
  async sendEventInvitationsToEmails(
    event: IEvent,
    organizer: IUser,
    emailAddresses: string[]
  ): Promise<EmailDispatchResult> {
    try {
      if (emailAddresses.length === 0) {
        return this.finalizeDispatchResult(this.createDispatchResult());
      }

      const organizerName = this.getFullName(organizer);
      const eventDetails = {
        ...this.buildEventEmailDetails(event),
        organizer: organizerName,
      };

      return this.dispatchEmails(
        emailAddresses,
        async (email) => {
          const invitationToken = this.generateExternalInvitationToken(
            String(event._id),
            email
          );

          return this.emailService.sendEventInvitation(
            email,
            this.getNameFromEmail(email),
            eventDetails,
            invitationToken
          );
        },
        (email) => `Failed to send invitation to ${email}`
      );
    } catch (error) {
      return this.failureDispatchResult(
        emailAddresses.length,
        "Failed to send invitations",
        error
      );
    }
  }

  /**
   * Send event reminders to attendees
   */
  async sendEventReminders(
    event: IEvent,
    reminderType: "1_hour" | "1_day" | "1_week"
  ): Promise<EmailDispatchResult> {
    try {
      const attendees = await this.loadAttendeeUsers(event, (attendee) =>
        ["accepted", "tentative"].includes(attendee.status)
      );

      if (attendees.length === 0) {
        return this.finalizeDispatchResult(this.createDispatchResult());
      }

      const eventDetails = this.buildEventEmailDetails(event);

      return this.dispatchEmails(
        attendees,
        (attendee) =>
          this.emailService.sendEventReminder(
            attendee.email,
            this.getFullName(attendee),
            eventDetails,
            reminderType
          ),
        (attendee) => `Failed to send reminder to ${attendee.email}`
      );
    } catch (error) {
      return this.failureDispatchResult(
        event.attendees.length,
        "Failed to send event reminders",
        error
      );
    }
  }

  /**
   * Send event cancellation notifications
   */
  async sendEventCancellation(
    event: IEvent,
    organizer: IUser,
    reason?: string
  ): Promise<EmailDispatchResult> {
    try {
      const attendees = await this.loadAttendeeUsers(event);

      if (attendees.length === 0) {
        return this.finalizeDispatchResult(this.createDispatchResult());
      }

      const organizerName = this.getFullName(organizer);
      const cancellationDetails = {
        title: event.title,
        startDate: new Date(event.startDate),
        location: this.formatLocationForEmail(event.location),
        organizer: organizerName,
        reason,
      };

      return this.dispatchEmails(
        attendees,
        (attendee) =>
          this.emailService.sendEventCancellation(
            attendee.email,
            this.getFullName(attendee),
            cancellationDetails
          ),
        (attendee) => `Failed to send cancellation to ${attendee.email}`
      );
    } catch (error) {
      return this.failureDispatchResult(
        event.attendees.length,
        "Failed to send event cancellations",
        error
      );
    }
  }

  /**
   * Send event update notifications
   */
  async sendEventUpdate(
    event: IEvent,
    organizer: IUser,
    changes: string[]
  ): Promise<EmailDispatchResult> {
    try {
      const attendees = await this.loadAttendeeUsers(event);

      if (attendees.length === 0) {
        return this.finalizeDispatchResult(this.createDispatchResult());
      }

      const organizerName = this.getFullName(organizer);
      const updateDetails = {
        title: event.title,
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : undefined,
        location: this.formatLocationForEmail(event.location),
        organizer: organizerName,
        allDay: event.allDay,
      };

      return this.dispatchEmails(
        attendees,
        (attendee) =>
          this.emailService.sendEventUpdate(
            attendee.email,
            this.getFullName(attendee),
            updateDetails,
            changes
          ),
        (attendee) => `Failed to send update to ${attendee.email}`
      );
    } catch (error) {
      return this.failureDispatchResult(
        event.attendees.length,
        "Failed to send event updates",
        error
      );
    }
  }

  /**
   * Process RSVP response
   */
  async processRSVP(
    token: string,
    response: "accepted" | "declined" | "tentative"
  ): Promise<{
    success: boolean;
    event?: IEvent;
    attendee?:
      | IUser
      | {
          email: string;
          firstName: string;
          lastName: string;
          isExternal: boolean;
        };
    isExternal?: boolean;
    email?: string;
    error?: string;
  }> {
    try {
      // Decode token to get event and attendee information
      const tokenData = this.decodeInvitationTokenEnhanced(token);

      // Find event
      const event = await Event.findById(tokenData.eventId);
      if (!event) {
        return { success: false, error: "Event not found" };
      }

      // Handle external users (not registered in system)
      if (tokenData.external) {
        if (!tokenData.email) {
          return { success: false, error: "Invalid token: missing email" };
        }

        await this.emailService.sendRSVPConfirmation(
          tokenData.email,
          this.getNameFromEmail(tokenData.email),
          {
            title: event.title,
            startDate: new Date(event.startDate),
            location: this.formatLocationForEmail(event.location),
          },
          response
        );

        return {
          success: true,
          event,
          attendee: {
            email: tokenData.email,
            firstName: this.getNameFromEmail(tokenData.email),
            lastName: "",
            isExternal: true,
          },
          isExternal: true,
          email: tokenData.email,
        };
      }

      // Handle registered users
      const attendee = await User.findById(tokenData.attendeeId);
      if (!attendee) {
        return { success: false, error: "Attendee not found" };
      }

      // Update attendee status in event
      await Event.updateOne(
        { _id: tokenData.eventId, "attendees.userId": tokenData.attendeeId },
        {
          $set: {
            "attendees.$.status": response,
            "attendees.$.respondedAt": new Date(),
          },
        }
      );

      // Send confirmation email
      await this.emailService.sendRSVPConfirmation(
        attendee.email,
        this.getFullName(attendee),
        {
          title: event.title,
          startDate: new Date(event.startDate),
          location: this.formatLocationForEmail(event.location),
        },
        response
      );

      return { success: true, event, attendee };
    } catch (error) {
      return { success: false, error: this.toErrorMessage(error) };
    }
  }

  /**
   * Generate invitation token
   */
  private buildEventEmailDetails(event: IEvent) {
    return {
      title: event.title,
      description: event.description,
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined,
      location: this.formatLocationForEmail(event.location),
      type: event.type,
      allDay: event.allDay,
    };
  }

  private getFullName(user: IUser): string {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return name || user.email;
  }

  private getNameFromEmail(email: string): string {
    const [name] = email.split("@");
    return name || email;
  }

  private createDispatchResult(): EmailDispatchResult {
    return {
      success: true,
      sent: 0,
      failed: 0,
      errors: [],
    };
  }

  private finalizeDispatchResult(
    result: EmailDispatchResult
  ): EmailDispatchResult {
    result.success = result.failed === 0;
    return result;
  }

  private failureDispatchResult(
    failed: number,
    message: string,
    error?: unknown
  ): EmailDispatchResult {
    const reason = error
      ? `${message}: ${this.toErrorMessage(error)}`
      : message;

    return {
      success: false,
      sent: 0,
      failed,
      errors: [reason],
    };
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "Unexpected error";
  }

  private async findUsersByIds(
    ids: Array<string | mongoose.Types.ObjectId | null | undefined>
  ): Promise<IUser[]> {
    const normalizedIds = ids
      .filter((id): id is string | mongoose.Types.ObjectId => Boolean(id))
      .map((id) =>
        typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
      );

    if (normalizedIds.length === 0) {
      return [];
    }

    return User.find({ _id: { $in: normalizedIds } });
  }

  private async loadAttendeeUsers(
    event: IEvent,
    predicate?: (attendee: IEvent["attendees"][number]) => boolean
  ): Promise<IUser[]> {
    const ids = event.attendees
      .filter((attendee) => (predicate ? predicate(attendee) : true))
      .map((attendee) => attendee.userId);

    return this.findUsersByIds(ids);
  }

  private async dispatchEmails<T>(
    items: T[],
    sender: (item: T) => Promise<boolean>,
    failureMessage: (item: T) => string
  ): Promise<EmailDispatchResult> {
    const outcome = this.createDispatchResult();

    for (const item of items) {
      const failure = failureMessage(item);

      try {
        const delivered = await sender(item);

        if (delivered) {
          outcome.sent += 1;
        } else {
          outcome.failed += 1;
          outcome.errors.push(failure);
        }
      } catch (error) {
        outcome.failed += 1;
        outcome.errors.push(`${failure}: ${this.toErrorMessage(error)}`);
      }
    }

    return this.finalizeDispatchResult(outcome);
  }

  private generateInvitationToken(eventId: string, attendeeId: string): string {
    const payload = { eventId, attendeeId, timestamp: Date.now() };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  /**
   * Generate invitation token for external users
   */
  private generateExternalInvitationToken(
    eventId: string,
    email: string
  ): string {
    const payload = { eventId, email, timestamp: Date.now(), external: true };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  /**
   * Decode invitation token (legacy - for registered users only)
   */
  private decodeInvitationToken(token: string): {
    eventId: string;
    attendeeId: string;
  } {
    try {
      const payload = JSON.parse(Buffer.from(token, "base64").toString());
      return { eventId: payload.eventId, attendeeId: payload.attendeeId };
    } catch (error) {
      throw new Error("Invalid token format");
    }
  }

  /**
   * Enhanced token decoder that handles both registered and external users
   */
  private decodeInvitationTokenEnhanced(token: string): {
    eventId: string;
    attendeeId?: string;
    email?: string;
    external?: boolean;
    timestamp: number;
  } {
    try {
      const payload = JSON.parse(Buffer.from(token, "base64").toString());

      // Validate required fields
      if (!payload.eventId || !payload.timestamp) {
        throw new Error("Invalid token: missing required fields");
      }

      return {
        eventId: payload.eventId,
        attendeeId: payload.attendeeId,
        email: payload.email,
        external: payload.external || false,
        timestamp: payload.timestamp,
      };
    } catch (error) {
      throw new Error("Invalid token format");
    }
  }

  /**
   * Schedule automatic reminders for an event
   */
  async scheduleEventReminders(event: IEvent): Promise<void> {
    const eventStart = new Date(event.startDate);
    const now = new Date();

    // Schedule reminders based on event.reminders configuration
    for (const reminder of event.reminders || []) {
      const reminderTime = new Date(
        eventStart.getTime() - reminder.minutesBefore * 60 * 1000
      );

      if (reminderTime <= now) {
        continue;
      }

      // Hook for integrating a background scheduler.
    }
  }
}

// Export singleton instance
export const calendarEmailService = new CalendarEmailService();
