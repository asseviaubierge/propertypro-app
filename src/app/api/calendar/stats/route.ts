/**
 * PropertyPro - Calendar Statistics API
 * Get calendar statistics and analytics data
 */

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Event } from "@/models";
import {
  AuthenticatedAccessUser,
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { EventType, EventStatus } from "@/types";
import { buildCalendarScope } from "@/lib/calendar-scope";

// ============================================================================
// GET /api/calendar/stats - Get calendar statistics
// ============================================================================
export const GET = withPermissionAndDB("profile_management")(async (
  user: AuthenticatedAccessUser,
  request: NextRequest,
  context?: { tenantProfile?: { _id?: unknown } | null },
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

    const scopeFilter = await buildCalendarScope(
      user,
      context?.tenantProfile,
    );

    const softDeleteFilter = {
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    const scopedQuery = (...extraFilters: Record<string, unknown>[]) => ({
      $and: [
        softDeleteFilter,
        ...(Object.keys(scopeFilter).length > 0 ? [scopeFilter] : []),
        ...extraFilters,
      ],
    });

    const baseQuery = scopedQuery(
      ...(Object.keys(dateFilter).length > 0
        ? [{ startDate: dateFilter }]
        : []),
    );

    // Get total events count
    const totalEvents = await Event.countDocuments(baseQuery);

    // Get upcoming events (from now)
    const now = new Date();
    const upcomingEvents = await Event.countDocuments(
      scopedQuery(
        { startDate: { $gte: now } },
        { status: { $nin: [EventStatus.CANCELLED, EventStatus.COMPLETED] } },
      ),
    );

    // Get today's events
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const todayEvents = await Event.countDocuments(
      scopedQuery({
        startDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),
    );

    // Get pending RSVPs for events organized by the user
    // Count attendees with pending status in events organized by the user
    const pendingRSVPsAgg = await Event.aggregate([
      {
        $match: scopedQuery(
          { startDate: { $gte: now } },
          { status: { $nin: [EventStatus.CANCELLED, EventStatus.COMPLETED] } },
        ),
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
    const recentEvents = await Event.countDocuments(
      scopedQuery({ createdAt: { $gte: thirtyDaysAgo } }),
    );

    // Get completion rate
    const completedEvents = eventsByStatus[EventStatus.COMPLETED] ?? 0;
    const completionRate =
      totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;

    // Get average events per week (last 4 weeks)
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const recentEventsCount = await Event.countDocuments(
      scopedQuery({ startDate: { $gte: fourWeeksAgo } }),
    );
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
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ];
    const busiestDayName = busiestDay ? dayNames[busiestDay - 1] : null;

    // Get monthly trend (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyTrend = await Event.aggregate([
      {
        $match: scopedQuery({ startDate: { $gte: sixMonthsAgo } }),
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
          totalEvents > 0 && pendingRSVPs > 0
            ? Math.max(
                0,
                Math.round(((totalEvents - pendingRSVPs) / totalEvents) * 100),
              )
            : totalEvents > 0
              ? 100
              : 0,
      },
    };

    return createSuccessResponse(
      stats,
      "Statistiques du calendrier récupérées avec succès",
    );
  } catch (error) {
    return handleApiError(error);
  }
});
