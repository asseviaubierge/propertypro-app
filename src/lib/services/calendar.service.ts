/**
 * PropertyPro - Calendar Service
 * Service for managing calendar events and scheduling
 */

import { Event } from "@/models";
import {
  IEvent,
  IEventLocation,
  EventType,
  EventStatus,
  EventPriority,
  RecurrenceType,
  IEventRecurrence,
  UserRole,
} from "@/types";
import mongoose from "mongoose";

export interface CreateEventParams {
  title: string;
  description?: string;
  type: EventType;
  priority?: EventPriority;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  timezone?: string;
  location?: IEventLocation;
  propertyId?: string;
  unitNumber?: string;
  organizer: string;
  attendeeIds?: string[];
  tenantId?: string;
  leaseId?: string;
  maintenanceRequestId?: string;
  recurrence?: IEventRecurrence;
  reminderMinutes?: number[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateEventParams extends Partial<CreateEventParams> {
  status?: EventStatus;
}

export interface EventQueryParams {
  startDate?: Date;
  endDate?: Date;
  type?: EventType;
  status?: EventStatus;
  priority?: EventPriority;
  organizer?: string;
  attendeeId?: string;
  propertyId?: string;
  tenantId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CalendarViewParams {
  startDate: Date;
  endDate: Date;
  userId?: string;
  propertyIds?: string[];
  eventTypes?: EventType[];
  includeRecurring?: boolean;
}

export class CalendarService {
  // Create a new event
  async createEvent(
    params: CreateEventParams,
    createdBy: string
  ): Promise<IEvent> {
    const {
      attendeeIds = [],
      reminderMinutes = [15], // Default 15 minutes reminder
      recurrence,
      ...eventData
    } = params;

    // Prepare attendees
    const attendees = attendeeIds.map((userId) => ({
      userId: new mongoose.Types.ObjectId(userId),
      email: "", // Will be populated by the API
      name: "", // Will be populated by the API
      role: UserRole.TENANT, // Default role, will be updated
      status: "pending" as const,
    }));

    // Prepare reminders
    const reminders = reminderMinutes.map((minutes) => ({
      type: "email" as const,
      minutesBefore: minutes,
      sent: false,
    }));

    // Clean up empty string fields that should be undefined for ObjectId fields
    const cleanedEventData = { ...eventData };
    if (cleanedEventData.propertyId === "") delete cleanedEventData.propertyId;
    if (cleanedEventData.tenantId === "") delete cleanedEventData.tenantId;
    if (cleanedEventData.leaseId === "") delete cleanedEventData.leaseId;
    if (cleanedEventData.maintenanceRequestId === "")
      delete cleanedEventData.maintenanceRequestId;

    // Create event
    const event = new Event({
      ...cleanedEventData,
      attendees,
      reminders,
      recurrence,
      isRecurring: !!recurrence && recurrence.type !== RecurrenceType.NONE,
      createdBy: new mongoose.Types.ObjectId(createdBy),
    });

    await event.save();

    // Populate related data
    await event.populate([
      { path: "organizer", select: "firstName lastName email" },
      { path: "propertyId", select: "name address" },
      {
        path: "tenantId",
        select: "userId",
        populate: { path: "userId", select: "firstName lastName email" },
      },
    ]);

    // Generate recurring events if needed
    if (event.isRecurring && recurrence) {
      await this.generateRecurringEvents(event, recurrence);
    }

    return event;
  }

  // Update an event
  async updateEvent(
    eventId: string,
    params: UpdateEventParams,
    updatedBy: string
  ): Promise<IEvent | null> {
    const event = await Event.findById(eventId);
    if (!event) return null;

    // Update event data
    Object.assign(event, params);
    event.updatedBy = new mongoose.Types.ObjectId(updatedBy);

    await event.save();

    // Populate related data
    await event.populate([
      { path: "organizer", select: "firstName lastName email" },
      { path: "propertyId", select: "name address" },
      {
        path: "tenantId",
        select: "userId",
        populate: { path: "userId", select: "firstName lastName email" },
      },
    ]);

    return event;
  }

  // Delete an event (soft delete)
  async deleteEvent(eventId: string): Promise<boolean> {
    const result = await Event.findByIdAndUpdate(
      eventId,
      { deletedAt: new Date() },
      { new: true }
    );
    return !!result;
  }

  // Get events with filtering and pagination
  async getEvents(params: EventQueryParams): Promise<{
    events: IEvent[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      startDate,
      endDate,
      type,
      status,
      priority,
      organizer,
      attendeeId,
      propertyId,
      tenantId,
      search,
      page = 1,
      limit = 20,
      sortBy = "startDate",
      sortOrder = "asc",
    } = params;

    // Build query - explicitly filter for non-deleted events
    const query: any = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = startDate;
      if (endDate) query.startDate.$lte = endDate;
    }

    if (type) query.type = type;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (organizer) query.organizer = new mongoose.Types.ObjectId(organizer);
    if (propertyId) query.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (tenantId) query.tenantId = new mongoose.Types.ObjectId(tenantId);
    if (attendeeId)
      query["attendees.userId"] = new mongoose.Types.ObjectId(attendeeId);

    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [events, total] = await Promise.all([
      Event.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate([
          { path: "organizer", select: "firstName lastName email" },
          { path: "propertyId", select: "name address" },
          {
            path: "tenantId",
            select: "userId",
            populate: { path: "userId", select: "firstName lastName email" },
          },
        ])
        .lean(),
      Event.countDocuments(query),
    ]);

    return {
      events: events as IEvent[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get calendar view with events for a specific date range
  async getCalendarView(params: CalendarViewParams): Promise<IEvent[]> {
    const {
      startDate,
      endDate,
      userId,
      propertyIds = [],
      eventTypes = [],
      includeRecurring = true,
    } = params;

    const query: any = {
      deletedAt: null,
      $or: [
        {
          startDate: { $gte: startDate, $lte: endDate },
        },
        {
          endDate: { $gte: startDate, $lte: endDate },
        },
        {
          startDate: { $lte: startDate },
          endDate: { $gte: endDate },
        },
      ],
    };

    if (userId) {
      query.$or = [
        { organizer: new mongoose.Types.ObjectId(userId) },
        { "attendees.userId": new mongoose.Types.ObjectId(userId) },
      ];
    }

    if (propertyIds.length > 0) {
      query.propertyId = {
        $in: propertyIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    if (eventTypes.length > 0) {
      query.type = { $in: eventTypes };
    }

    if (!includeRecurring) {
      query.parentEventId = { $exists: false };
    }

    const events = await Event.find(query)
      .sort({ startDate: 1 })
      .populate([
        { path: "organizer", select: "firstName lastName email" },
        { path: "propertyId", select: "name address" },
        {
          path: "tenantId",
          select: "userId",
          populate: { path: "userId", select: "firstName lastName email" },
        },
      ])
      .lean();

    return events as IEvent[];
  }

  // Generate recurring events
  private async generateRecurringEvents(
    parentEvent: IEvent,
    recurrence: IEventRecurrence
  ): Promise<void> {
    const { type, interval, endDate, occurrences } = recurrence;

    if (type === RecurrenceType.NONE) return;

    const events: Partial<IEvent>[] = [];
    let currentDate = new Date(parentEvent.startDate);
    let count = 0;
    const maxOccurrences = occurrences || 100; // Limit to prevent infinite loops

    while (count < maxOccurrences) {
      // Calculate next occurrence
      switch (type) {
        case RecurrenceType.DAILY:
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case RecurrenceType.WEEKLY:
          currentDate.setDate(currentDate.getDate() + 7 * interval);
          break;
        case RecurrenceType.MONTHLY:
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case RecurrenceType.YEARLY:
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
        default:
          return;
      }

      // Check if we've reached the end date
      if (endDate && currentDate > endDate) break;

      // Calculate end date for this occurrence
      const duration =
        parentEvent.endDate.getTime() - parentEvent.startDate.getTime();
      const occurrenceEndDate = new Date(currentDate.getTime() + duration);

      // Create recurring event instance
      const recurringEvent = {
        ...parentEvent.toObject(),
        _id: new mongoose.Types.ObjectId(),
        startDate: new Date(currentDate),
        endDate: occurrenceEndDate,
        parentEventId: parentEvent._id,
        isRecurring: false, // Individual instances are not recurring
        recurrence: undefined, // Remove recurrence from instances
      };

      delete recurringEvent.__v;
      delete recurringEvent.createdAt;
      delete recurringEvent.updatedAt;

      events.push(recurringEvent);
      count++;
    }

    // Bulk insert recurring events
    if (events.length > 0) {
      await Event.insertMany(events);
    }
  }

  // Get upcoming events for a user
  async getUpcomingEvents(
    userId: string,
    limit: number = 10
  ): Promise<IEvent[]> {
    const now = new Date();
    const query = {
      deletedAt: null,
      startDate: { $gte: now },
      $or: [
        { organizer: new mongoose.Types.ObjectId(userId) },
        { "attendees.userId": new mongoose.Types.ObjectId(userId) },
      ],
    };

    const events = await Event.find(query)
      .sort({ startDate: 1 })
      .limit(limit)
      .populate([
        { path: "organizer", select: "firstName lastName email" },
        { path: "propertyId", select: "name address" },
        {
          path: "tenantId",
          select: "userId",
          populate: { path: "userId", select: "firstName lastName email" },
        },
      ])
      .lean();

    return events as IEvent[];
  }

  // Update attendee response
  async updateAttendeeResponse(
    eventId: string,
    userId: string,
    status: "accepted" | "declined" | "tentative",
    notes?: string
  ): Promise<boolean> {
    const result = await Event.updateOne(
      { _id: eventId, "attendees.userId": new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          "attendees.$.status": status,
          "attendees.$.responseAt": new Date(),
          "attendees.$.notes": notes,
        },
      }
    );

    return result.modifiedCount > 0;
  }
}

export const calendarService = new CalendarService();
