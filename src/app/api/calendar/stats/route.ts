/**
 * PropertyPro - Calendar Statistics API
 * Get calendar statistics and analytics data
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Event } from "@/models";
import mongoose from "mongoose";
import {
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { EventType, EventStatus } from "@/types";

// ============================================================================
// GET /api/calendar/stats - Get calendar statistics
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: any,
  request: NextRequest,
) => {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Base filters
    const userObjectId = new mongoose.Types.ObjectId(user.id);
    const userFilter = {
      $or: [
        { organizer: userObjectId },
        { createdBy: userObjectId },
        { "attendees.userId": userObjectId },
      ],
    };

    const softDeleteFilter = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    const baseQuery = {
      $and: [
        userFilter,
        softDeleteFilter,
        ...(Object.keys(dateFilter).length > 0
          ? [{ startDate: dateFilter }]
          : []),
      ],
    };

    // Get total events count
    const totalEvents = await Event.countDocuments(baseQuery);

    // Get upcoming events (from now)
    const now = new Date();
    const upcomingEvents = await Event.countDocuments({
      $and: [
        userFilter,
        softDeleteFilter,
        { startDate: { $gte: now } },
        { status: { $nin: [EventStatus.CANCELLED, EventStatus.COMPLETED] } },
      ],
    });

    // Get today's events
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const todayEvents = await Event.countDocuments({
      $and: [
        userFilter,
        softDeleteFilter,
        {
          startDate: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      ],
    });

    // Get pending RSVPs for events organized by the user
    // Count attendees with pending status in events organized by the user
    const pendingRSVPsAgg = await Event.aggregate([
      {
        $match: {
          organizer: new mongoose.Types.ObjectId(user.id),
          startDate: { $gte: now }, // Only count future events
          status: { $nin: [EventStatus.CANCELLED, EventStatus.COMPLETED] },
        },
      },
      {
        $unwind: "$attendees",
      },
      {
        $match: {
          "attendees.status": "pending",
        },
      },
      {
        $count: "pendingCount",
      },
    ]);

    const pendingRSVPs =
      pendingRSVPsAgg.length > 0 ? pendingRSVPsAgg[0].pendingCount : 0;

    // Get events by type
    const eventsByTypeAgg = await Event.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const eventsByType: Record<string, number> = {};
    Object.values(EventType).forEach((type) => {
      eventsByType[type] = 0;
    });
    eventsByTypeAgg.forEach((item) => {
      eventsByType[item._id] = item.count;
    });

    // Get events by status
    const eventsByStatusAgg = await Event.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const eventsByStatus: Record<string, number> = {};
    Object.values(EventStatus).forEach((status) => {
      eventsByStatus[status] = 0;
    });
    eventsByStatusAgg.forEach((item) => {
      eventsByStatus[item._id] = item.count;
    });

    // Get recent activity (events created in last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = await Event.countDocuments({
      $and: [
        userFilter,
        softDeleteFilter,
        { createdAt: { $gte: thirtyDaysAgo } },
      ],
    });

    // Get completion rate
    const completedEvents = eventsByStatus[EventStatus.COMPLETED] ?? 0;
    const completionRate =
      totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;

    // Get average events per week (last 4 weeks)
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const recentEventsCount = await Event.countDocuments({
      $and: [
        userFilter,
        softDeleteFilter,
        { startDate: { $gte: fourWeeksAgo } },
      ],
    });
    const avgEventsPerWeek = recentEventsCount / 4;

    // Get busiest day of week
    const dayOfWeekAgg = await Event.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $dayOfWeek: "$startDate" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    const busiestDay = dayOfWeekAgg.length > 0 ? dayOfWeekAgg[0]._id : null;
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const busiestDayName = busiestDay ? dayNames[busiestDay - 1] : null;

    // Get monthly trend (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyTrend = await Event.aggregate([
      {
        $match: {
          $and: [
            userFilter,
            softDeleteFilter,
            { startDate: { $gte: sixMonthsAgo } },
          ],
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$startDate" },
            month: { $month: "$startDate" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const stats = {
      totalEvents,
      upcomingEvents,
      todayEvents,
      pendingRSVPs,
      eventsByType,
      eventsByStatus,
      recentEvents,
      completionRate: Math.round(completionRate * 100) / 100,
      avgEventsPerWeek: Math.round(avgEventsPerWeek * 100) / 100,
      busiestDay: busiestDayName,
      monthlyTrend,
      summary: {
        totalEvents,
        activeEvents: upcomingEvents,
        completedEvents,
        cancelledEvents: eventsByStatus[EventStatus.CANCELLED] ?? 0,
        responseRate:
          pendingRSVPs > 0
            ? Math.round(((totalEvents - pendingRSVPs) / totalEvents) * 100)
            : 100,
      },
    };

    return createSuccessResponse(
      stats,
      "Calendar statistics retrieved successfully",
    );
  } catch (error) {
    return handleApiError(error);
  }
});
